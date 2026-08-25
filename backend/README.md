# NoDeck Backend

FastAPI + SQLAlchemy 2 (async) + PostgreSQL. Anthropic for generation.

## Setup

```bash
python -m venv .venv
.venv/Scripts/activate        # Windows;  source .venv/bin/activate on POSIX
pip install -r requirements.txt

cp .env.example .env          # then fill in SECRET_KEY and ANTHROPIC_API_KEY
python init_db.py             # creates the tables
python migrate.py             # applies additive column changes
uvicorn app.main:app --port 8000
```

The `nodeck` database must exist first:

```bash
docker exec shared-postgres psql -U postgres -c "CREATE DATABASE nodeck;"
```

Docs at http://127.0.0.1:8000/api/v1/docs

The app boots without `ANTHROPIC_API_KEY` — the client is built lazily, so only
the generation endpoints fail. Everything else, including PDF text extraction,
works without one.

> On Windows, `--reload` has been observed announcing a restart it never
> performs, so edits appear not to take effect. If a change seems ignored,
> restart the process rather than trusting the reloader.

## Schema changes

No Alembic yet. `init_db.py` runs `create_all`, which creates missing *tables*
but silently ignores new *columns* on tables that already exist — so adding a
field to a model is invisible to a database that already has rows.

New columns therefore go in `migrate.py`, which is idempotent (every statement
is `IF NOT EXISTS`) and safe to re-run. Adopt Alembic before there is data
worth keeping.

## API

No route has a trailing slash.

### Auth and users

| Method | Path | |
|---|---|---|
| POST | `/api/v1/auth/register` | always creates a FOUNDER; a client-supplied role is ignored |
| POST | `/api/v1/auth/login` | form-encoded; `username` is the email |
| GET | `/api/v1/users/me` | |

### Startups

| Method | Path | |
|---|---|---|
| GET POST | `/api/v1/startups` | own startups only; GET includes `latest_score` |
| GET | `/api/v1/startups/{id}` | |
| PATCH | `/api/v1/startups/{id}` | name, one-liner, stage, industry |
| DELETE | `/api/v1/startups/{id}` | also deletes its reports and investor views |
| PUT | `/api/v1/startups/{id}/sip` | merges sections; absent sections untouched |
| POST | `/api/v1/startups/{id}/upload-deck` | PDF; runs inline, fills only empty fields |
| GET | `/api/v1/startups/{id}/reports` | newest first |

### Generation

All three return `202` with a `report_id` and are picked up by the job worker
(`app/services/worker.py`). Poll the report until it leaves `PENDING`. Each requires a problem description, a
solution description and a TAM — the call costs real money, so an empty
profile is rejected with a `400` naming what is missing.

| Method | Path | |
|---|---|---|
| POST | `/api/v1/analysis/{id}/fundability` | score out of 100 |
| POST | `/api/v1/analysis/{id}/memo` | investment memo |
| POST | `/api/v1/analysis/{id}/deck` | pitch deck |
| GET | `/api/v1/analysis/reports/{id}` | poll for COMPLETED / FAILED |

### Investor views

| Method | Path | |
|---|---|---|
| POST | `/api/v1/analysis/{id}/investor-views` | `202` with a `view_id` |
| GET | `/api/v1/analysis/{id}/investor-views` | newest first |
| GET | `/api/v1/analysis/investor-views/{id}` | poll for COMPLETED / FAILED |

## Ownership

Every startup route resolves through `get_owned_startup()`: `404` if it does
not exist, `403` if it belongs to another founder. Report and investor-view
lookups enforce ownership inside the query itself, so someone else's report is
indistinguishable from one that does not exist.

## Prompts

Live in `app/services/ai.py`, following `design/prompts.md`. One deliberate
divergence: that document specifies per-task `temperature` values, but sampling
parameters were removed on Claude Opus 5 and now return a `400`. Consistency
comes instead from schema-constrained structured output plus explicit
calibration language in each system prompt.

The SIP reaches the model verbatim, so every prompt that embeds it wraps it in
tags and states that tagged content is data, never instructions.
