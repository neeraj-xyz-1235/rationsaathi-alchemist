"""Environment settings (plan_backend.txt section 1). Reads backend/.env if present."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = ""
    ANTHROPIC_API_KEY: str = ""
    LLM_MODEL: str = "claude-opus-5-5"
    APP_ORIGIN: str = "http://localhost:5173"
    COOKIE_SECURE: bool = False
    ENABLE_DOCS: bool = True
    EMAIL_API_KEY: str = ""
    EMAIL_FROM: str = ""


settings = Settings()
