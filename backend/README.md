# NoDeck Backend

FastAPI + SQLAlchemy 2 (async) + PostgreSQL. Anthropic for analysis.

## Setup

```bash
python -m venv .venv
.venv/Scripts/activate        # Windows;  source .venv/bin/activate on POSIX
pip install -r requirements.txt

cp .env.example .env          # then fill in SECRET_KEY and ANTHROPIC_API_KEY
python init_db.py             # creates the tables
uvicorn app.main:app --reload --port 8000
```

The `nodeck` database must exist first:

```bash
docker exec shared-postgres psql -U postgres -c "CREATE DATABASE nodeck;"
```

Docs at http://127.0.0.1:8000/api/v1/docs

## Schema changes

There are no migrations yet: `init_db.py` runs `create_all`, which does **not**
alter existing tables. During the MVP, a model change means dropping and
recreating the database. Adopt Alembic before there is real data.

## API

| Method | Path | |
|---|---|---|
| POST | `/api/v1/auth/register` | always creates a FOUNDER |
| POST | `/api/v1/auth/login` | form-encoded; `username` is the email |
| GET | `/api/v1/users/me` | |
| GET POST | `/api/v1/startups` | own startups only |
| GET | `/api/v1/startups/{id}` | |
| PUT | `/api/v1/startups/{id}/sip` | merges sections; absent sections untouched |
| GET | `/api/v1/startups/{id}/reports` | |
| POST | `/api/v1/analysis/{id}/fundability` | 202, runs in the background |
| GET | `/api/v1/analysis/reports/{id}` | poll for COMPLETED / FAILED |

No route has a trailing slash.
