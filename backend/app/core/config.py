from pathlib import Path
from typing import Annotated, List, Union

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# backend/app/core/config.py -> parents[2] is backend/
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    PROJECT_NAME: str = "NoDeck API"
    API_V1_STR: str = "/api/v1"

    # CORS. Plain strings, not AnyHttpUrl: pydantic v2 URL types normalise
    # "http://localhost:3000" to a trailing-slash form that never matches a
    # browser Origin header. NoDecode stops pydantic-settings from trying to
    # JSON-parse the comma-separated .env value before our validator runs.
    BACKEND_CORS_ORIGINS: Annotated[List[str], NoDecode] = []

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            items = [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            items = v if isinstance(v, list) else [v]
        else:
            raise ValueError(v)
        return [str(i).rstrip("/") for i in items if str(i).strip()]

    # Database
    POSTGRES_SERVER: str = "127.0.0.1"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "nodeck"
    POSTGRES_PORT: int = 5432
    SQL_ECHO: bool = False

    # Set to true ONLY when the app sits behind a proxy that overwrites
    # X-Forwarded-For. The header is client-controlled, so trusting it
    # without a proxy in front lets anyone forge a new identity per request
    # and walk straight past the rate limiter.
    TRUST_PROXY_HEADERS: bool = False

    # Auth
    SECRET_KEY: str = "CHANGE_ME_IN_PROD_TO_A_SUPER_SECRET_KEY"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # AI. Optional at boot: the client is built lazily, so the app starts
    # without a key and only /analysis endpoints fail.
    ANTHROPIC_API_KEY: str | None = None
    ANTHROPIC_MODEL: str = "claude-opus-5"
    ANTHROPIC_MAX_TOKENS: int = 16000

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=ENV_FILE,
        extra="ignore",
    )


settings = Settings()
