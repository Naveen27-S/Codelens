"""
app/services/dashboard_history_service.py

Service layer for the dashboard_history MongoDB collection.
Tracks every significant user action performed on the dashboard:
  - dashboard_open      : user visits the dashboard page
  - program_open        : user opens a saved program from the dashboard
  - visualization_open  : user re-opens a past visualization from history card
  - activity_filter     : user applies a filter on the activity timeline
  - stat_view           : user views an aggregated stat card
  - history_search      : user searches their activity history

All functions are None-safe: if MongoDB is unavailable they return sensible
empty defaults so the API never crashes.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from bson import ObjectId

from ..database.mongodb import get_mongodb


# ── helpers ────────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _user_query(user_id: Any) -> dict:
    """Query MongoDB for user_id matching both integer and string formats."""
    try:
        u_int = int(user_id)
        return {"$or": [{"user_id": u_int}, {"user_id": str(user_id)}]}
    except (ValueError, TypeError):
        return {"user_id": user_id}


def _doc_to_dict(doc: dict) -> dict:
    """Convert a MongoDB document to a JSON-serialisable dict."""
    doc["id"] = str(doc.pop("_id"))
    for k, v in doc.items():
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc


# ── write operations ───────────────────────────────────────────────────────────

def record_dashboard_event(
    user_id: int,
    event_type: str,
    title: str,
    description: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Insert a single dashboard history event for the given user.

    Parameters
    ----------
    user_id    : authenticated user's primary key
    event_type : one of dashboard_open | program_open | visualization_open |
                 activity_filter | stat_view | history_search
    title      : human-readable label shown in the UI history list
    description: optional longer description / context
    metadata   : arbitrary extra data (program_id, language, filter, etc.)

    Returns the inserted document as a dict (id = stringified ObjectId).
    """
    mongo_db = get_mongodb()
    now = _now()
    try:
        norm_user_id = int(user_id)
    except (ValueError, TypeError):
        norm_user_id = user_id

    doc = {
        "user_id": norm_user_id,
        "event_type": event_type,
        "title": title,
        "description": description,
        "metadata": metadata or {},
        "created_at": now,
    }
    if mongo_db is None:
        doc["id"] = "offline"
        return doc

    result = mongo_db["dashboard_history"].insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    for k, v in list(doc.items()):
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc


# ── read operations ────────────────────────────────────────────────────────────

def get_dashboard_history(
    user_id: int,
    event_type: Optional[str] = None,
    date_range: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> Dict[str, Any]:
    """
    Return paginated dashboard history events for the given user.
    Supports filtering by event_type, date_range, and keyword search.
    """
    mongo_db = get_mongodb()
    if mongo_db is None:
        return {"items": [], "total": 0, "page": page, "limit": limit, "pages": 1}

    user_q = _user_query(user_id)
    conditions: List[Dict[str, Any]] = [user_q]

    if event_type and event_type.lower() not in ("all", ""):
        conditions.append({"event_type": event_type.lower()})

    now = _now()
    if date_range:
        dr = date_range.lower().replace(" ", "_")
        if dr == "today":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            conditions.append({"created_at": {"$gte": start}})
        elif dr in ("this_week", "week"):
            start = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
            conditions.append({"created_at": {"$gte": start}})
        elif dr in ("this_month", "month"):
            start = (now - timedelta(days=30)).replace(hour=0, minute=0, second=0, microsecond=0)
            conditions.append({"created_at": {"$gte": start}})

    if search and search.strip():
        term = search.strip()
        conditions.append({
            "$or": [
                {"title": {"$regex": term, "$options": "i"}},
                {"description": {"$regex": term, "$options": "i"}},
            ]
        })

    query: Dict[str, Any] = {"$and": conditions} if len(conditions) > 1 else conditions[0]

    total = mongo_db["dashboard_history"].count_documents(query)
    pages = max(1, (total + limit - 1) // limit)
    skip = max(0, (page - 1) * limit)

    cursor = (
        mongo_db["dashboard_history"]
        .find(query)
        .sort([("created_at", -1), ("_id", -1)])
        .skip(skip)
        .limit(limit)
    )

    items = [_doc_to_dict(doc) for doc in cursor]
    return {"items": items, "total": total, "page": page, "limit": limit, "pages": pages}


def get_recent_dashboard_history(user_id: int, limit: int = 10) -> List[Dict[str, Any]]:
    """Return the most recent N dashboard history events for the given user."""
    mongo_db = get_mongodb()
    if mongo_db is None:
        return []
    cursor = (
        mongo_db["dashboard_history"]
        .find(_user_query(user_id))
        .sort([("created_at", -1), ("_id", -1)])
        .limit(limit)
    )
    return [_doc_to_dict(doc) for doc in cursor]


def get_dashboard_history_stats(user_id: int) -> Dict[str, Any]:
    """
    Return aggregate statistics for the user's dashboard history:
    total events, today/week/month counts, and breakdown by event_type.
    """
    mongo_db = get_mongodb()
    if mongo_db is None:
        return {"total": 0, "today": 0, "this_week": 0, "this_month": 0, "by_event_type": {}}

    now = _now()
    start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_week = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
    start_month = (now - timedelta(days=30)).replace(hour=0, minute=0, second=0, microsecond=0)

    base = _user_query(user_id)
    total = mongo_db["dashboard_history"].count_documents(base)
    today_count = mongo_db["dashboard_history"].count_documents(
        {"$and": [base, {"created_at": {"$gte": start_today}}]}
    )
    week_count = mongo_db["dashboard_history"].count_documents(
        {"$and": [base, {"created_at": {"$gte": start_week}}]}
    )
    month_count = mongo_db["dashboard_history"].count_documents(
        {"$and": [base, {"created_at": {"$gte": start_month}}]}
    )

    pipeline = [
        {"$match": base},
        {"$group": {"_id": "$event_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    breakdown = {
        r["_id"]: r["count"]
        for r in mongo_db["dashboard_history"].aggregate(pipeline)
        if r["_id"]
    }

    return {
        "total": total,
        "today": today_count,
        "this_week": week_count,
        "this_month": month_count,
        "by_event_type": breakdown,
    }


# ── delete operations ──────────────────────────────────────────────────────────

def delete_dashboard_history_item(user_id: int, item_id: str) -> bool:
    """Delete a single dashboard history record by ObjectId. Returns True if deleted."""
    mongo_db = get_mongodb()
    if mongo_db is None:
        return False
    try:
        oid = ObjectId(item_id)
    except Exception:
        return False
    result = mongo_db["dashboard_history"].delete_one({"$and": [{"_id": oid}, _user_query(user_id)]})
    return result.deleted_count > 0


def clear_dashboard_history(user_id: int) -> int:
    """Delete ALL dashboard history events for the given user. Returns count removed."""
    mongo_db = get_mongodb()
    if mongo_db is None:
        return 0
    result = mongo_db["dashboard_history"].delete_many(_user_query(user_id))
    return result.deleted_count
