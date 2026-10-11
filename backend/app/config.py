from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = ""
    anthropic_api_key: str = ""
    llm_model: str = "claude-opus-5-5"
    app_origin: str = "http://localhost:5173"
    cookie_secure: bool = False
    enable_docs: bool = True
    seed_password: str = ""


settings = Settings()
