"""PDF text extraction and merge of parsed deck data into a SIP.

Split out of the endpoint because both halves have real edge cases worth
testing on their own: extraction has to cope with image-only decks, and the
merge has to guarantee it never overwrites something a founder typed.
"""

import io
import logging
from typing import Any, Optional

from pypdf import PdfReader
from pypdf.errors import PdfReadError

from app.schemas.report import ParsedDeckSIP

logger = logging.getLogger(__name__)

# A deck that reaches these limits is either unusual or hostile; either way the
# prompt gets unwieldy and the marginal page adds nothing to extraction.
MAX_PAGES = 60
MAX_CHARS = 60_000

# Below this, the "PDF" is almost certainly scanned images or vector artwork
# with no embedded text layer. Sending it to the model would burn a call to
# extract nothing, so fail early with advice the founder can act on.
MIN_USABLE_CHARS = 200


class DeckParseError(RuntimeError):
    """The file could not be read as a text-bearing PDF."""


def extract_pdf_text(raw: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(raw))
    except (PdfReadError, ValueError, OSError):
        raise DeckParseError("That file is not a readable PDF.") from None

    if reader.is_encrypted:
        # An empty user password is common for "protected" decks and often
        # succeeds; anything else needs a password we do not have.
        try:
            if reader.decrypt("") == 0:
                raise DeckParseError("That PDF is password protected.")
        except (NotImplementedError, PdfReadError):
            raise DeckParseError("That PDF uses an unsupported encryption method.") from None

    pages: list[str] = []
    total = 0
    for index, page in enumerate(reader.pages[:MAX_PAGES]):
        try:
            text = page.extract_text() or ""
        except Exception:
            # One malformed page must not lose the other fifty-nine.
            logger.warning("could not extract page %s of uploaded deck", index + 1)
            continue
        text = text.strip()
        if not text:
            continue
        # Slide numbers matter: the model uses them to tell a Traction slide
        # from a Market slide when the headings are images.
        pages.append(f"--- Slide {index + 1} ---\n{text}")
        total += len(text)
        if total >= MAX_CHARS:
            break

    combined = "\n\n".join(pages)
    if len(combined) < MIN_USABLE_CHARS:
        raise DeckParseError(
            "That PDF has no selectable text - it looks like scanned images. "
            "Export it from the original slides, or fill the profile in by hand."
        )
    return combined[:MAX_CHARS]


def _is_empty(value: Any) -> bool:
    return value in (None, "", [], {})


def apply_parsed_deck(
    sip_data: Optional[dict], parsed: ParsedDeckSIP
) -> tuple[dict, list[str]]:
    """Fill only the gaps, and report what was filled.

    Returns a NEW dict; the caller reassigns it, because the JSONB column has
    no MutableDict and would not notice an in-place edit.
    """
    sip: dict[str, Any] = {k: dict(v) if isinstance(v, dict) else v
                           for k, v in (sip_data or {}).items()}
    filled: list[str] = []

    # (section, field, incoming value, human label)
    candidates = [
        ("problem", "description", parsed.problem_description, "Problem description"),
        ("problem", "pain_points", parsed.pain_points, "Pain points"),
        ("solution", "description", parsed.solution_description, "Solution description"),
        ("solution", "product_name", parsed.product_name, "Product name"),
        ("solution", "value_proposition", parsed.value_proposition, "Value proposition"),
        ("solution", "moat", parsed.moat, "Moat"),
        ("solution", "tech_stack", parsed.tech_stack, "Tech stack"),
        ("market", "tam", parsed.tam, "TAM"),
        ("market", "sam", parsed.sam, "SAM"),
        ("market", "som", parsed.som, "SOM"),
        ("market", "target_customer_persona", parsed.target_customer_persona, "Target customer"),
        ("traction", "milestones", parsed.milestones, "Milestones"),
        ("traction", "customer_logos", parsed.customer_logos, "Customer logos"),
        ("fundraising", "round_stage", parsed.round_stage, "Round stage"),
        ("fundraising", "ask_amount", parsed.ask_amount, "Ask amount"),
        ("fundraising", "use_of_funds", parsed.use_of_funds, "Use of funds"),
    ]

    for section, field, value, label in candidates:
        if _is_empty(value):
            continue
        current = sip.setdefault(section, {})
        if not isinstance(current, dict):
            # Stored data is the wrong shape; leave it alone rather than
            # clobbering something we do not understand.
            continue
        if _is_empty(current.get(field)):
            current[field] = value
            filled.append(label)

    return sip, filled
