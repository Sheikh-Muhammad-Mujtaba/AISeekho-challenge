from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "SalesOps Agent"

    # ── Database (Neon Postgres) ─────────────────────────────────────────
    DATABASE_URL: str = ""

    # ── Neon Auth (Better Auth) ──────────────────────────────────────────
    NEON_AUTH_URL: str = ""      # e.g. https://ep-xxx.neonauth.c-7.us-east-1.aws.neon.tech/neondb/auth
    NEON_AUTH_JWKS_URL: str = "" # e.g. https://ep-xxx.neonauth.c-7.us-east-1.aws.neon.tech/neondb/auth/.well-known/jwks.json

    # ── ERPNext ──────────────────────────────────────────────────────────
    ERPNEXT_BASE_URL: str = ""
    ERPNEXT_API_TOKEN: str = ""

    # ── Google ───────────────────────────────────────────────────────────
    GOOGLE_PLACES_API_KEY: str = ""

    # ── Gemini (via OpenAI-compatible endpoint) ──────────────────────────
    GEMINI_API_KEY: str = ""
    GEMINI_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta/openai/"
    GEMINI_MODEL: str = "gemini-2.5-flash"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
