from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # env_file="../.env",
        # env_ignore_empty=True,
        extra="ignore",
    )
    # to get a string like this run:
    # openssl rand -hex 32
    SECRET_KEY: str = "718d52839994c9e0e1351831dc252f25a51d6e690940601393878f37a585b65d"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30000

    # Google OAuth config
    GOOGLE_CLIENT_ID: str = "941271455567-19rfpkdkgrvjrla9uf56l2e4tf6j29gh.apps.googleusercontent.com"

    GOOGLE_CLOUD_PROJECT: str = "personal-ai-264306"

    DOCUMENT_AI_PROCESSOR_ID: str = "ef4832a8654dc6ca"
    DOCUMENT_AI_LOCATION: str = "eu"


settings = Settings()  # type: ignore
