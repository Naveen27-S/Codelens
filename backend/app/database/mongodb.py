from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError, ConfigurationError
from ..core.config import settings
import logging

logger = logging.getLogger(__name__)

_client = None
_db = None

def get_mongodb():
    """
    Returns the MongoDB database instance.
    If the connection cannot be established, logs a warning and returns None.
    Dashboard service uses smart fallbacks when None is returned.
    """
    global _client, _db
    if _db is None:
        try:
            _client = MongoClient(settings.MONGODB_URL, serverSelectionTimeoutMS=5000)
            # Force a connection check so we fail fast here rather than on first query
            _client.admin.command('ping')
            _db = _client[settings.MONGODB_DB]
            logger.info(f"✅ MongoDB connected: {settings.MONGODB_DB}")
        except (ServerSelectionTimeoutError, ConfigurationError, Exception) as e:
            logger.warning(f"⚠️  MongoDB unavailable: {e}. Dashboard will use default data.")
            _db = None
    return _db
