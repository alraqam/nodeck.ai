import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.api.v1.endpoints.analysis import process_investor_view, process_report
from app.core.config import settings
from app.services import worker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run the job workers alongside the API.

    In-process for now, which is the honest MVP shape: it needs no broker and
    no second deployment, and the durability comes from the database rather
    than from the worker staying alive. Moving these tasks to their own
    process later requires no change to the queue itself.
    """
    released = await worker.recover_orphans()
    if released:
        logger.info("recovered %s job(s) interrupted by a previous shutdown", released)

    tasks = worker.start(process_report, process_investor_view)
    logger.info("job workers started")
    try:
        yield
    finally:
        await worker.stop(tasks)
        logger.info("job workers stopped")


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=None,
    lifespan=lifespan,
)

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    return {"message": "Welcome to NoDeck API", "version": "0.1.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}
