"""The only unauthenticated route in the application.

Everything here is reachable by anyone holding a link, so the rules are
stricter than elsewhere:

  * Nothing is reflected. `_public_profile` names every field it emits, so a
    column added to Startup or a section added to the SIP is invisible here
    until someone deliberately exposes it. A serialiser that mirrored the
    model would leak the next thing anybody adds.

  * The critique never leaves the account. Red flags, the investment memo and
    investor views are the founder's own diagnosis of their weaknesses -
    sharing a link must not hand those to the person they are pitching. A
    founder who wants to send them can export and send them deliberately.

  * A disabled link and a link that never existed are the same 404, so the
    endpoint cannot be used to test whether a token was ever valid.
"""

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.core.ratelimit import SlidingWindowLimiter
from app.models.report import Report, ReportStatus, ReportType
from app.core.config import settings
from app.models.startup import Startup

logger = logging.getLogger(__name__)
router = APIRouter()

# Generous for a human opening a link they were sent, tight enough that
# nobody scans this route for free. Applied per client address.
_limiter = SlidingWindowLimiter(limit=60, window_seconds=60.0)


def _client_key(request: Request) -> str:
    """Identify the caller for rate limiting.

    X-Forwarded-For is trusted only when a proxy is expected to set it. It
    is client-controlled, so behind no proxy it would let anyone mint a
    fresh identity per request and bypass the limit entirely.
    """
    if settings.TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _pick(source: Optional[dict], *fields: str) -> dict:
    """Copy only the named keys, dropping empties."""
    source = source or {}
    if not isinstance(source, dict):
        return {}
    return {f: source[f] for f in fields if source.get(f) not in (None, "", [], {})}


def _public_profile(startup: Startup, score: Optional[dict]) -> dict:
    """Build the shared payload field by field.

    The SIP is a free-form JSONB blob, so it is picked apart rather than passed
    through: a founder may have stored anything in it, and only the sections
    that belong in a pitch are republished.
    """
    sip = startup.sip_data or {}

    team = [
        picked
        for member in (sip.get("team") or [])
        # LinkedIn is included on purpose - it is the point of a team slide -
        # but a bare, empty member row is dropped rather than shown as blank.
        if (picked := _pick(member, "name", "role", "bio", "superpower", "linkedin"))
    ]

    return {
        "name": startup.name,
        "one_liner": startup.one_liner,
        "stage": startup.stage,
        "industry": startup.industry or [],
        "identity": _pick(sip.get("identity"), "website", "location", "founded_year"),
        "problem": _pick(
            sip.get("problem"), "description", "pain_points", "current_solutions", "validated"
        ),
        "solution": _pick(
            sip.get("solution"),
            "product_name",
            "description",
            "value_proposition",
            "tech_stack",
            "moat",
        ),
        "market": _pick(
            sip.get("market"), "tam", "sam", "som", "market_growth_rate",
            "target_customer_persona",
        ),
        "traction": _pick(sip.get("traction"), "metrics", "milestones", "customer_logos"),
        "team": team,
        "fundraising": _pick(
            sip.get("fundraising"), "round_stage", "ask_amount", "use_of_funds"
        ),
        # Present only when the founder opted in. Green flags travel with it;
        # red flags never do.
        "score": score,
    }


# Deliberately excluded, and why:
#   identity.contact_email  - a public page is a spam target; the founder gives
#                             out their address themselves.
#   fundraising.valuation_cap - live deal terms, not pitch material.
#   red_flags, memo, investor views - the founder's own critique.
#   founder_id, slug, timestamps, share_token - internal.


@router.get("/{share_token}")
async def read_shared_profile(
    share_token: str,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(deps.get_db),
) -> Any:
    """Fetch a shared profile. No authentication."""
    # Search engines must not index a link the founder shared with one investor.
    response.headers["X-Robots-Tag"] = "noindex, nofollow"

    key = _client_key(request)
    if not _limiter.allow(key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please slow down.",
            headers={"Retry-After": str(_limiter.retry_after(key))},
        )

    # Length-guard before touching the database: a token is a fixed-size secret,
    # so anything else is noise and should not cost a query.
    if not 20 <= len(share_token) <= 64:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    result = await db.execute(
        select(Startup).where(Startup.share_token == share_token)
    )
    startup = result.scalars().first()
    if not startup:
        # Same response as a revoked link: no way to tell the two apart.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    score = None
    if startup.share_score:
        result = await db.execute(
            select(Report)
            .where(
                Report.startup_id == startup.id,
                Report.type == ReportType.FUNDABILITY_SCORE.value,
                Report.status == ReportStatus.COMPLETED.value,
            )
            .order_by(Report.created_at.desc())
            .limit(1)
        )
        report = result.scalars().first()
        if report and report.content:
            content = report.content
            score = {
                "total_score": content.get("total_score"),
                "breakdown": content.get("breakdown"),
                "summary": content.get("summary"),
                "green_flags": content.get("green_flags") or [],
                # red_flags is absent by construction, not filtered out later.
            }

    return _public_profile(startup, score)
