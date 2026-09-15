from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import ServerSelectionTimeoutError, ConfigurationError, OperationFailure
from ..core.config import settings
import logging

logger = logging.getLogger(__name__)

_client = None
_db = None


def _create_indexes(db) -> None:
    """
    Ensure required indexes exist on the executions, activities, and
    dashboard_history collections. Called once after a successful connection.
    """
    try:
        # ── executions ──────────────────────────────────────────────────────
        ex = db["executions"]
        ex.create_index([("user_id", ASCENDING)], name="idx_user_id")
        ex.create_index(
            [("user_id", ASCENDING), ("created_at", DESCENDING)],
            name="idx_user_created"
        )
        ex.create_index(
            [("execution_id", ASCENDING)],
            unique=True,
            name="idx_execution_id_unique"
        )
        # ── activities ──────────────────────────────────────────────────────
        ac = db["activities"]
        ac.create_index([("user_id", ASCENDING)], name="idx_act_user_id")
        ac.create_index(
            [("user_id", ASCENDING), ("started_at", DESCENDING)],
            name="idx_act_user_started"
        )
        ac.create_index([("activity_type", ASCENDING)], name="idx_act_type")
        # ── dashboard_history ───────────────────────────────────────────────
        dh = db["dashboard_history"]
        dh.create_index([("user_id", ASCENDING)], name="idx_dh_user_id")
        dh.create_index(
            [("user_id", ASCENDING), ("created_at", DESCENDING)],
            name="idx_dh_user_created"
        )
        dh.create_index([("event_type", ASCENDING)], name="idx_dh_event_type")
        logger.info("MongoDB indexes ensured on executions / activities / dashboard_history")
    except OperationFailure as e:
        logger.warning("MongoDB index creation warning: %s", e)
    except Exception as e:
        logger.error("MongoDB index creation failed: %s", e)


def get_mongodb():
    """
    Returns the MongoDB database instance (lazy singleton).
    On first call, connects to the configured MONGODB_URL, pings the
    server, and creates the required indexes on the executions collection.

    If the connection cannot be established the function logs a warning
    and returns None.  Callers must handle None — the app must never crash
    because MongoDB is unavailable.
    """
    global _client, _db
    if _db is None:
        try:
            _client = MongoClient(settings.MONGODB_URL, serverSelectionTimeoutMS=5000)
            # Force a connection check so we fail fast here rather than on first query
            _client.admin.command("ping")
            _db = _client[settings.MONGODB_DB]
            logger.info("✅ MongoDB connected: %s", settings.MONGODB_DB)
            _create_indexes(_db)
        except (ServerSelectionTimeoutError, ConfigurationError, Exception) as e:
            logger.warning(
                "⚠️  MongoDB unavailable: %s. Execution history will not be saved.", e
            )
            _db = None
    return _db
