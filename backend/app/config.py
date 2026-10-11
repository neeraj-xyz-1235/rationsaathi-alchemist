"""Environment settings (plan_backend.txt section 1). Reads backend/.env if present."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = ""
    # Receipt reading with any free OpenAI-compatible API (Groq, Gemini, OpenRouter, Ollama).
    # Leave LLM_BASE_URL / LLM_MODEL empty to use the regex reader only.
    LLM_BASE_URL: str = ""
    LLM_API_KEY: str = ""
    LLM_MODEL: str = ""
    LLM_TIMEOUT_S: float = 8.0
    # Ration-card proof check: a vision-capable model on the SAME provider (LLM_BASE_URL/API_KEY).
    # Empty = no AI check; every proof then waits for manual review.
    LLM_VISION_MODEL: str = ""
    VISION_TIMEOUT_S: float = 30.0
    APP_ORIGIN: str = "http://localhost:5173"      # several allowed: comma separated
    COOKIE_SECURE: bool = False
    ENABLE_DOCS: bool = True
    EMAIL_PROVIDER: str = "brevo"        # "brevo" or "resend"
    EMAIL_API_KEY: str = ""
    EMAIL_FROM: str = ""


settings = Settings()
