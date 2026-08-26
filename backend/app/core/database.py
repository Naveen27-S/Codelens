from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings

# Build URL safely using SQLAlchemy URL.create (handles special chars in password)
_db_url = settings.get_database_url()

engine = create_engine(
    _db_url,
    pool_pre_ping=True,    # detect stale connections
    pool_recycle=1800,     # recycle connections every 30 min
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a database session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
