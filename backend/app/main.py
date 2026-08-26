from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .core.database import engine, Base
from . import models
from .routers import auth, execute, history, ai, dashboard

# Create all MySQL tables on startup (if they don't exist yet)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for CodeLens AI",
    version="1.0.0",
)

# CORS — origins read from settings (configured via .env)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(execute.router, prefix="/api", tags=["Execution"])
app.include_router(history.router, prefix="/api/history", tags=["History"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])


@app.get("/api/health", tags=["Health"])
def health_check():
    """Health check endpoint. Tests the MySQL connection."""
    db_status = "connected"
    db_error = None
    try:
        with engine.connect() as connection:
            from sqlalchemy import text
            connection.execute(text("SELECT 1"))
    except Exception as e:
        db_status = "disconnected"
        db_error = str(e)

    return {
        "status": "ok",
        "database": db_status,
        **({"error": db_error} if db_error else {}),
    }
