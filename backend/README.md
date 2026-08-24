# NoDeck Backend

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
.\venv\Scripts\Activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Setup Database:
   - Make sure PostgreSQL is running and you have a database named `nodeck`.
   - Update `.env` (copy from `.env.example`).
   - (Alembic Setup Pending)

4. Run Server:
```bash
uvicorn app.main:app --reload
```
