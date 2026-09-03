from pydantic_settings import BaseSettings
from sqlalchemy import URL


class Settings(BaseSettings):
    PROJECT_NAME: str = "CodeLens AI"

    # Database credentials — stored separately to avoid URL-encoding issues
    DB_DRIVER: str = "mysql+pymysql"
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_NAME: str = "codelens_db"
    DB_USER: str = "codelens_user"
    DB_PASSWORD: str = ""  # set in .env — never hardcoded here

    # JWT
    JWT_SECRET_KEY: str = "change-this-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Other services
    GEMINI_API_KEY: str = ""
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "codelens_db"

    # CORS — comma-separated string, parsed below
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def get_database_url(self) -> URL:
        """Build a SQLAlchemy URL object (avoids password URL-encoding issues)."""
        return URL.create(
            drivername=self.DB_DRIVER,
            username=self.DB_USER,
            password=self.DB_PASSWORD,  # passed as raw string — SQLAlchemy handles escaping
            host=self.DB_HOST,
            port=self.DB_PORT,
            database=self.DB_NAME,
        )

    def get_cors_origins(self) -> list[str]:
        """Parse the CORS_ORIGINS string into a list."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
