"""Environment configuration. Loaded from env (Doppler in prod, .env locally)."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    env: str = Field(default="development")

    # OpenAI
    openai_api_key: str
    openai_realtime_model: str = "gpt-realtime"
    openai_realtime_voice: str = "marin"

    # Twilio
    twilio_account_sid: str
    twilio_auth_token: str
    twilio_phone_number: str

    # Supabase (optional in dev — falls back to in-memory store if absent)
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None

    # App URLs
    voice_api_url: str = "https://voice.kayo.me"
    dashboard_url: str = "https://app.kayo.me"

    # Sentry (optional)
    sentry_dsn_voice: str | None = None

    # Scheduler
    enable_scheduler: bool = True
    scheduler_timezone: str = "Asia/Tokyo"

    # Shared secret between dashboard and voice for the /calls/start endpoint.
    internal_api_key: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
