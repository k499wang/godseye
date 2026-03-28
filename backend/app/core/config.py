import os
from pathlib import Path
from dataclasses import dataclass, field

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[3]
BACKEND_DIR = Path(__file__).resolve().parents[2]

load_dotenv(ROOT_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env", override=True)


def _parse_csv(value: str | None, *, default: list[str]) -> list[str]:
    if not value:
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


def _normalize_database_url(value: str | None) -> str:
    if not value:
        return "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"
    if value.startswith("postgresql+asyncpg://"):
        return value
    if value.startswith("postgresql://"):
        return value.replace("postgresql://", "postgresql+asyncpg://", 1)
    if value.startswith("postgres://"):
        return value.replace("postgres://", "postgresql+asyncpg://", 1)
    return value


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Prediction Market Analyzer API")
    app_version: str = os.getenv("APP_VERSION", "0.1.0")
    environment: str = os.getenv("ENVIRONMENT", "development")
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    lenient_cors: bool = os.getenv("LENIENT_CORS", "true").lower() == "true"
    database_url: str = _normalize_database_url(
        os.getenv("DATABASE_URL")
        or os.getenv("SUPABASE_DB_URL")
        or os.getenv("SUPABASE_DATABASE_URL")
    )
    db_ssl_require: bool = os.getenv("DB_SSL_REQUIRE", "true").lower() == "true"
    supabase_url: str | None = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_service_key: str | None = os.getenv("SUPABASE_SERVICE_KEY")
    supabase_publishable_key: str | None = os.getenv(
        "SUPABASE_PUBLISHABLE_KEY"
    ) or os.getenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY")
    polymarket_gamma_base_url: str = os.getenv(
        "POLYMARKET_GAMMA_BASE_URL",
        "https://gamma-api.polymarket.com",
    )
    polymarket_timeout_seconds: float = float(os.getenv("POLYMARKET_TIMEOUT_SECONDS", "10"))
    polymarket_max_retries: int = int(os.getenv("POLYMARKET_MAX_RETRIES", "3"))
    cors_origins: list[str] = field(
        default_factory=lambda: _parse_csv(
            os.getenv("CORS_ORIGINS"),
            default=["http://localhost:3000"],
        )
    )


settings = Settings()
