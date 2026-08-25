"""Cohort screening for accelerators.

The paying customer in roadmap phases 0-2 runs a cohort: thirty decks arrive at
once and need consistent scoring and a single ranked report. Everything here is
assembled from parts that already exist - the PDF parser, the durable job
queue, the same scoring path a self-serve founder gets - because the roadmap's
integrity rule is that scoring stays independent of who is paying.
"""

import csv
import io
import logging
import re
import uuid
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy import Integer, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.api.v1.endpoints.startups import MAX_DECK_BYTES, _slugify
from app.models.cohort import Cohort
from app.models.outcome import Outcome
from app.models.report import Report, ReportStatus, ReportType
from app.models.startup import Startup
from app.models.user import User, UserRole
from app.schemas import cohort as cohort_schema
from app.services.ai import AIConfigurationError, ai_service
from app.services.deck_parser import DeckParseError, apply_parsed_deck, extract_pdf_text

logger = logging.getLogger(__name__)
router = APIRouter()

# One cohort intake at a time. Thirty PDFs is already a large multipart body,
# and each one costs a model call to parse.
MAX_FILES_PER_REQUEST = 40
MAX_TOTAL_BYTES = 120 * 1024 * 1024


def require_screener(user: User = Depends(deps.get_current_user)) -> User:
    """Cohort routes are for accelerators, not founders.

    A founder reaching these would see other people's startups in a ranking,
    so this is an authorisation boundary rather than a UI concern.
    """
    if user.role not in (UserRole.ACCELERATOR.value, UserRole.ADMIN.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cohort screening is available to accelerator accounts.",
        )
    return user


async def get_owned_cohort(db: AsyncSession, cohort_id: uuid.UUID, user: User) -> Cohort:
    """Mirrors get_owned_startup: 404 if absent, 403 if someone else's."""
    result = await db.execute(select(Cohort).filter(Cohort.id == cohort_id))
    cohort = result.scalars().first()
    if not cohort:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cohort not found")
    if cohort.owner_id != user.id and user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions"
        )
    return cohort


async def _counts(db: AsyncSession, cohort_id: uuid.UUID) -> tuple[int, int]:
    """(startups, scored). Two aggregates rather than loading every row."""
    total = await db.scalar(
        select(func.count(Startup.id)).where(Startup.cohort_id == cohort_id)
    )
    scored = await db.scalar(
        select(func.count(func.distinct(Report.startup_id)))
        .join(Startup, Report.startup_id == Startup.id)
        .where(
            Startup.cohort_id == cohort_id,
            Report.type == ReportType.FUNDABILITY_SCORE.value,
            Report.status == ReportStatus.COMPLETED.value,
        )
    )
    return int(total or 0), int(scored or 0)


async def _as_out(db: AsyncSession, cohort: Cohort) -> dict:
    total, scored = await _counts(db, cohort.id)
    return {
        "id": cohort.id,
        "name": cohort.name,
        "description": cohort.description,
        "created_at": cohort.created_at,
        "startup_count": total,
        "scored_count": scored,
    }


@router.post("", response_model=cohort_schema.CohortOut, status_code=status.HTTP_201_CREATED)
async def create_cohort(
    cohort_in: cohort_schema.CohortCreate,
    db: AsyncSession = Depends(deps.get_db),
    user: User = Depends(require_screener),
) -> Any:
    cohort = Cohort(owner_id=user.id, name=cohort_in.name, description=cohort_in.description)
    db.add(cohort)
    await db.commit()
    await db.refresh(cohort)
    return await _as_out(db, cohort)


@router.get("", response_model=List[cohort_schema.CohortOut])
async def list_cohorts(
    db: AsyncSession = Depends(deps.get_db),
    user: User = Depends(require_screener),
) -> Any:
    result = await db.execute(
        select(Cohort).filter(Cohort.owner_id == user.id).order_by(Cohort.created_at.desc())
    )
    return [await _as_out(db, c) for c in result.scalars().all()]


@router.get("/{cohort_id}", response_model=cohort_schema.CohortOut)
async def read_cohort(
    cohort_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    user: User = Depends(require_screener),
) -> Any:
    return await _as_out(db, await get_owned_cohort(db, cohort_id, user))


@router.delete("/{cohort_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cohort(
    cohort_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    user: User = Depends(require_screener),
) -> None:
    """Delete a cohort and everything imported into it.

    Children go first: the foreign keys have no ON DELETE CASCADE, so Postgres
    would otherwise reject the delete.
    """
    cohort = await get_owned_cohort(db, cohort_id, user)

    ids = (
        await db.execute(select(Startup.id).where(Startup.cohort_id == cohort.id))
    ).scalars().all()
    if ids:
        await db.execute(delete(Outcome).where(Outcome.startup_id.in_(ids)))
        await db.execute(delete(Report).where(Report.startup_id.in_(ids)))
        await db.execute(delete(Startup).where(Startup.id.in_(ids)))
    await db.delete(cohort)
    await db.commit()


def _name_from_filename(filename: str) -> str:
    """A readable placeholder until the parser finds the real name."""
    stem = re.sub(r"\.pdf$", "", filename or "", flags=re.I)
    stem = re.sub(r"[_-]+", " ", stem).strip()
    return (stem[:120] or "Untitled deck").title()


@router.post("/{cohort_id}/decks", response_model=cohort_schema.DeckImportResponse)
async def import_decks(
    cohort_id: uuid.UUID,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(deps.get_db),
    user: User = Depends(require_screener),
) -> Any:
    """Import a batch of decks and queue each one for scoring.

    Every file is handled independently and its outcome reported by name. One
    unreadable PDF must not cost the other twenty-nine, and a silent gap in the
    ranking is worse than a named failure.

    Parsing runs inline because the accelerator is waiting to see what came
    through; scoring is only ever queued, so a restart mid-batch loses nothing.
    """
    cohort = await get_owned_cohort(db, cohort_id, user)

    if len(files) > MAX_FILES_PER_REQUEST:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Upload at most {MAX_FILES_PER_REQUEST} decks at a time.",
        )

    results: list[dict] = []
    total_bytes = 0

    for upload in files:
        filename = upload.filename or "unnamed.pdf"
        try:
            if (upload.content_type or "").lower() not in (
                "application/pdf",
                "application/x-pdf",
            ):
                raise DeckParseError("Not a PDF.")

            raw = await upload.read()
            total_bytes += len(raw)
            if len(raw) > MAX_DECK_BYTES:
                raise DeckParseError(
                    f"Larger than {MAX_DECK_BYTES // (1024 * 1024)}MB."
                )
            if total_bytes > MAX_TOTAL_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="That batch is too large. Split it and upload again.",
                )

            text = extract_pdf_text(raw)
            parsed = await ai_service.parse_deck(text, _name_from_filename(filename))

            name = _name_from_filename(filename)
            startup = Startup(
                # The accelerator owns it, so every existing ownership check,
                # report route and worker path applies with no special case.
                founder_id=user.id,
                cohort_id=cohort.id,
                name=name,
                slug=_slugify(name),
                one_liner=parsed.one_liner,
                stage=parsed.round_stage,
                sip_data={},
            )
            merged, filled = apply_parsed_deck({}, parsed)
            startup.sip_data = merged
            db.add(startup)
            await db.flush()

            report = Report(
                startup_id=startup.id,
                type=ReportType.FUNDABILITY_SCORE.value,
                status=ReportStatus.PENDING.value,
            )
            db.add(report)
            await db.flush()

            results.append(
                {
                    "filename": filename,
                    "ok": True,
                    "startup_id": startup.id,
                    "startup_name": startup.name,
                    "report_id": report.id,
                    "fields_filled": filled,
                }
            )
        except HTTPException:
            raise
        except AIConfigurationError:
            # A missing or rejected key fails identically for every file, so
            # continuing would report thirty bogus "could not read this deck"
            # errors and send the accelerator hunting through their PDFs for a
            # problem that is on our side. Stop and say so.
            logger.exception("deck import unavailable: analysis is not configured")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "Deck analysis is not configured on the server, so no decks "
                    "were imported. Nothing is wrong with your files."
                ),
            ) from None
        except DeckParseError as exc:
            results.append({"filename": filename, "ok": False, "error": str(exc)})
        except Exception:
            # The parser reaching the model can fail for reasons that must not
            # be echoed back: the detail goes to the log, not the response.
            logger.exception("deck import failed for %s in cohort %s", filename, cohort.id)
            results.append(
                {"filename": filename, "ok": False, "error": "Could not read this deck."}
            )

    await db.commit()

    imported = sum(1 for r in results if r["ok"])
    return {
        "cohort_id": cohort.id,
        "imported": imported,
        "failed": len(results) - imported,
        "results": results,
    }


def _band(score: Optional[int]) -> str:
    if score is None:
        return "unscored"
    if score >= 70:
        return "70+"
    if score >= 50:
        return "50-69"
    if score >= 30:
        return "30-49"
    return "under 30"


async def _rows(db: AsyncSession, cohort_id: uuid.UUID) -> list[dict]:
    """Every startup in the cohort with its latest fundability report.

    One correlated subquery for the latest report id, the same pattern the
    dashboard uses for latest_score, so the cost does not grow with cohort size.
    """
    latest_report = (
        select(Report.id)
        .where(
            Report.startup_id == Startup.id,
            Report.type == ReportType.FUNDABILITY_SCORE.value,
        )
        .order_by(Report.created_at.desc())
        .limit(1)
        .correlate(Startup)
        .scalar_subquery()
    )

    result = await db.execute(
        select(Startup, Report, Outcome)
        .outerjoin(Report, Report.id == latest_report)
        .outerjoin(Outcome, Outcome.startup_id == Startup.id)
        .where(Startup.cohort_id == cohort_id)
    )

    rows = []
    for startup, report, outcome in result.all():
        content = (report.content or {}) if report else {}
        score = None
        if report and report.status == ReportStatus.COMPLETED.value:
            score = (report.score_summary or {}).get("total_score")
        rows.append(
            {
                "startup_id": startup.id,
                "name": startup.name,
                "one_liner": startup.one_liner,
                "stage": startup.stage,
                "industry": startup.industry or [],
                "status": report.status if report else "NOT_QUEUED",
                "total_score": score,
                "breakdown": (report.score_summary or {}).get("breakdown") if report else None,
                "confidence": content.get("confidence"),
                "top_fixes": content.get("top_fixes") or [],
                "error": content.get("error"),
                "outcome_status": outcome.status if outcome else None,
                "raised_amount": outcome.raised_amount if outcome else None,
            }
        )

    # Highest score first; anything unscored sits at the bottom rather than
    # ranking as a zero - "not measured" is not "measured badly".
    rows.sort(key=lambda r: (r["total_score"] is None, -(r["total_score"] or 0), r["name"]))
    return rows


@router.get("/{cohort_id}/report", response_model=cohort_schema.CohortReport)
async def cohort_report(
    cohort_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    user: User = Depends(require_screener),
) -> Any:
    cohort = await get_owned_cohort(db, cohort_id, user)
    rows = await _rows(db, cohort.id)

    distribution: dict[str, int] = {}
    for row in rows:
        band = _band(row["total_score"])
        distribution[band] = distribution.get(band, 0) + 1

    return {
        "cohort": await _as_out(db, cohort),
        "rows": rows,
        "distribution": distribution,
    }


@router.get("/{cohort_id}/export")
async def export_cohort_csv(
    cohort_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    user: User = Depends(require_screener),
) -> Any:
    """The outcome dataset, as a file.

    The roadmap calls this the seed of the moat, which means it has to leave the
    system without a database client. csv.writer rather than string joining, so
    a company name containing a comma or a quote cannot corrupt the file.
    """
    cohort = await get_owned_cohort(db, cohort_id, user)
    rows = await _rows(db, cohort.id)

    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(
        [
            "startup", "one_liner", "stage", "industry", "status", "score",
            "confidence", "outcome", "raised_amount", "cohort", "startup_id",
        ]
    )
    for row in rows:
        writer.writerow(
            [
                row["name"],
                row["one_liner"] or "",
                row["stage"] or "",
                "; ".join(row["industry"]),
                row["status"],
                row["total_score"] if row["total_score"] is not None else "",
                row["confidence"] or "",
                row["outcome_status"] or "UNKNOWN",
                row["raised_amount"] if row["raised_amount"] is not None else "",
                cohort.name,
                str(row["startup_id"]),
            ]
        )

    # Not _slugify: that appends a random suffix to keep startup slugs
    # globally unique, which in a download name is just noise.
    stem = re.sub(r"[^a-z0-9]+", "-", (cohort.name or "cohort").lower()).strip("-")[:60]
    filename = f"{stem or 'cohort'}-outcomes.csv"
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
