from pathlib import Path
from typing import Annotated, List, Union

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# backend/app/core/config.py -> parents[2] is backend/
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


# Values that have appeared in this repo or in setup instructions, plus the
# obvious hand-typed ones. Any of these means the key is public knowledge.
WEAK_SECRETS = frozenset(
    {
        "change_me",
        "changeme",
        "secret",
        "password",
        "test",
        "changethis",
        "change_me_in_prod_to_a_super_secret_key",
        "your-secret-key",
    }
)

_GENERATE_HINT = (
    'python -c "import secrets; print(secrets.token_urlsafe(48))"'
)


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
    # No default. A placeholder here is worse than no value at all: the app
    # boots, everything works, and every token is forgeable by anyone who has
    # read this file. Failing to start is the only outcome that cannot be
    # missed.
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # AI. Optional at boot: the client is built lazily, so the app starts
    # without a key and only /analysis endpoints fail.
    ANTHROPIC_API_KEY: str | None = None
    ANTHROPIC_MODEL: str = "claude-opus-5"
    ANTHROPIC_MAX_TOKENS: int = 16000

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_real(cls, v: str) -> str:
        """Refuse to start on a guessable signing key.

        With a known key anyone can mint a valid token for any account without
        a password. There is no partial failure to fall back on and nothing
        visible to warn about, so this has to stop the process.
        """
        if v.strip().lower() in WEAK_SECRETS:
            raise ValueError(
                "SECRET_KEY is a known placeholder, so every session token would "
                f"be forgeable. Generate one with: {_GENERATE_HINT}"
            )
        if len(v) < 32:
            raise ValueError(
                f"SECRET_KEY is {len(v)} characters; use at least 32. "
                f"Generate one with: {_GENERATE_HINT}"
            )
        return v

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
