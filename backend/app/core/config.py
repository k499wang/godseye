import os
from dataclasses import dataclass, field


def _parse_csv(value: str | None, *, default: list[str]) -> list[str]:
    if not value:
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Prediction Market Analyzer API")
    app_version: str = os.getenv("APP_VERSION", "0.1.0")
    environment: str = os.getenv("ENVIRONMENT", "development")
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres",
    )
    cors_origins: list[str] = field(
        default_factory=lambda: _parse_csv(
            os.getenv("CORS_ORIGINS"),
            default=["http://localhost:3000"],
        )
    )


settings = Settings()
