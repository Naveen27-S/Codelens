from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List

from ..core.database import get_db
from ..services.auth_service import get_current_user
from ..models.user import User
from ..models.code_history import CodeHistory
from ..schemas.dashboard import (
    ActivityCreate,
    ActivityResponse,
    ActivityListResponse,
    StreakResponse,
    LearningTimeResponse,
    DailyActivityResponse,
    DashboardStatsResponse,
    RecentProgramResponse,
    RecentVisualizationResponse,
    LanguageProgressResponse,
    RecommendationResponse,
    CalendarActivityResponse,
    DashboardHistoryEventCreate,
    DashboardHistoryEventResponse,
    DashboardHistoryListResponse,
    DashboardHistoryStatsResponse,
    SessionTimeRequest,
)
from ..schemas.program import ProgramCreate, ProgramUpdate, ProgramResponse
from ..services import activity_service
from ..services import dashboard_history_service


router = APIRouter()


@router.post("/activity", response_model=ActivityResponse)
def record_activity(
    req: ActivityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record an automatic user activity event (Run Code, Visualize, Practice, etc.)."""
    return activity_service.create_activity(db=db, user_id=current_user.id, data=req)


@router.post("/session-time", response_model=ActivityResponse)
def record_user_session_time(
    req: SessionTimeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record active user platform / editor practice time."""
    result = activity_service.record_session_time(
        user_id=current_user.id,
        duration_seconds=req.duration_seconds,
        activity_type=req.activity_type or "practice",
        language=req.language,
        topic=req.topic,
        title=req.title,
        description=req.description,
        db=db,
    )
    return ActivityResponse(**result)


@router.get("/activity", response_model=ActivityListResponse)
def list_user_activities(
    activity_type: Optional[str] = Query(None, description="Filter by activity category"),
    date_range: Optional[str] = Query(None, description="Filter by date range (today, this_week, this_month)"),
    search: Optional[str] = Query(None, description="Search term for title, topic, or description"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve filtered, paginated user activities for the authenticated user."""
    return activity_service.get_user_activities(
        db=db,
        user_id=current_user.id,
        activity_type=activity_type,
        date_range=date_range,
        search=search,
        page=page,
        limit=limit,
    )

@router.get("/practice-time/history", response_model=ActivityListResponse)
def list_practice_time_history(
    date_range: Optional[str] = Query(None, description="Filter by date range (today, this_week, this_month)"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve paginated practice activities for the authenticated user."""
    return activity_service.get_user_activities(
        user_id=current_user.id,
        activity_type="practice",
        date_range=date_range,
        page=page,
        limit=limit,
        db=db,
    )


@router.get("/activity/recent", response_model=List[ActivityResponse])
def get_recent_activities_timeline(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve chronological recent activities for the timeline card."""
    return activity_service.get_recent_activities(db=db, user_id=current_user.id, limit=limit)


@router.get("/activity/daily", response_model=DailyActivityResponse)
def get_daily_activity_breakdown(
    days: int = Query(7, ge=1, le=30),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve 7-day daily activity breakdown for the coding activity chart."""
    return activity_service.get_daily_activity(db=db, user_id=current_user.id, days=days)


@router.get("/activity/calendar", response_model=CalendarActivityResponse)
def get_calendar_activity(
    days: int = Query(180, ge=7, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return per-day activity counts for the last N days for the heatmap calendar."""
    return activity_service.get_calendar_activity(user_id=current_user.id, days=days, db=db)


@router.get("/streak", response_model=StreakResponse)
def get_user_coding_streak(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Calculate the user's active consecutive coding streak."""
    return activity_service.get_streak_info(db=db, user_id=current_user.id)


@router.get("/learning-time", response_model=LearningTimeResponse)
def get_user_learning_time(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve aggregated learning durations (Today, This Week, This Month)."""
    return activity_service.get_learning_time(db=db, user_id=current_user.id)


@router.get("/stats", response_model=DashboardStatsResponse)
def get_dashboard_summary_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve aggregated statistics cards for the dashboard header."""
    return activity_service.get_dashboard_stats(db=db, user_id=current_user.id)


@router.get("/recent-programs", response_model=List[RecentProgramResponse])
def get_recent_programs(
    limit: int = Query(5, ge=1, le=20),
    current_user: User = Depends(get_current_user),
):
    """Retrieve the user's recently saved/edited programs from MongoDB."""
    from ..database.mongodb import get_mongodb
    mongo_db = get_mongodb()
    if mongo_db is None:
        return []
    programs = list(mongo_db.programs.find({"user_id": current_user.id}).sort("updated_at", -1).limit(limit))
    return [
        RecentProgramResponse(
            id=p["program_id"],
            title=p["name"],
            language=p["language"],
            lastEdited=p["updated_at"],
            sourceCode=p.get("code")
        )
        for p in programs
    ]


@router.get("/saved-programs")
def get_saved_programs_history(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    language: Optional[str] = Query(None, description="Filter by language"),
    search: Optional[str] = Query(None, description="Search by program name"),
    current_user: User = Depends(get_current_user),
):
    """
    Return the complete saved programs history for the authenticated user.
    Each record includes: program_id, name, language, code, line_count,
    created_at, updated_at.
    """
    from ..database.mongodb import get_mongodb
    mongo_db = get_mongodb()
    if mongo_db is None:
        return {"items": [], "total": 0, "page": page, "limit": limit, "pages": 1}

    query: dict = {"$or": [{"user_id": current_user.id}, {"user_id": str(current_user.id)}]}
    if language and language.lower() not in ("all", ""):
        lang_clean = language.strip().lower()
        if lang_clean == "c":
            query["language"] = {"$in": ["c", "C"]}
        elif lang_clean in ("cpp", "c++"):
            query["language"] = {"$in": ["cpp", "c++", "CPP", "C++"]}
        elif lang_clean in ("python", "py"):
            query["language"] = {"$in": ["python", "py", "Python", "PYTHON"]}
        elif lang_clean == "java":
            query["language"] = {"$in": ["java", "Java", "JAVA"]}
        else:
            query["language"] = {"$regex": f"^{lang_clean}$", "$options": "i"}

    if search and search.strip():
        query["name"] = {"$regex": search.strip(), "$options": "i"}

    total = mongo_db.programs.count_documents(query)
    pages = max(1, (total + limit - 1) // limit)
    skip = max(0, (page - 1) * limit)

    docs = list(
        mongo_db.programs.find(query)
        .sort([("updated_at", -1), ("_id", -1)])
        .skip(skip)
        .limit(limit)
    )

    items = []
    for p in docs:
        code = p.get("code", "")
        line_count = len(code.splitlines()) if code else 0
        items.append({
            "program_id": p.get("program_id", ""),
            "name": p.get("name", "Untitled Program"),
            "language": p.get("language", "python"),
            "code": code,
            "description": p.get("description", ""),
            "output": p.get("output", ""),
            "status": p.get("status", "completed"),
            "line_count": line_count,
            "created_at": p.get("created_at", ""),
            "updated_at": p.get("updated_at", ""),
        })

    return {"items": items, "total": total, "page": page, "limit": limit, "pages": pages}


@router.post("/saved-programs", response_model=ProgramResponse, status_code=status.HTTP_201_CREATED)
def save_program_via_dashboard(
    req: ProgramCreate,
    current_user: User = Depends(get_current_user),
):
    from .programs import create_program
    return create_program(req=req, current_user=current_user)


@router.put("/saved-programs/{program_id}", response_model=ProgramResponse)
def update_program_via_dashboard(
    program_id: str,
    req: ProgramUpdate,
    current_user: User = Depends(get_current_user),
):
    from .programs import update_program
    return update_program(program_id=program_id, req=req, current_user=current_user)


@router.get("/visualizations", response_model=List[RecentVisualizationResponse])
def get_recent_visualizations(
    limit: int = Query(5, ge=1, le=20),
    current_user: User = Depends(get_current_user),
):
    """Retrieve recent visualizations executed by the user from MongoDB."""
    from ..database.mongodb import get_mongodb
    from datetime import datetime
    mongo_db = get_mongodb()
    
    activities = list(
        mongo_db.activities.find({
            "user_id": current_user.id,
            "activity_type": {"$in": ["visualization_completed", "visualization"]}
        }).sort("started_at", -1).limit(limit)
    )

    results = []
    for a in activities:
        meta = a.get("metadata_json") or {}
        started_at = a.get("started_at")
        timestamp_str = started_at.isoformat() if isinstance(started_at, datetime) else str(started_at)
        
        results.append(
            RecentVisualizationResponse(
                id=str(a["_id"]),
                programName=a.get("program_name") or a.get("title") or "Algorithm",
                language=a.get("language") or "python",
                steps=meta.get("steps", 12),
                status=a.get("status") or "completed",
                timestamp=timestamp_str,
                sourceCode=meta.get("source_code"),
                mermaidExplanation=meta.get("mermaid_explanation"),
            )
        )
    return results


@router.get("/progress", response_model=List[LanguageProgressResponse])
def get_learning_progress(
    current_user: User = Depends(get_current_user),
):
    """Retrieve learning progress across languages and concepts based on MongoDB activities, executions, and programs."""
    from ..database.mongodb import get_mongodb
    from ..services.activity_service import _user_query
    mongo_db = get_mongodb()
    if mongo_db is None:
        return [
            LanguageProgressResponse(label="Python", percentage=25, color="bg-indigo-500"),
            LanguageProgressResponse(label="Java", percentage=20, color="bg-violet-500"),
            LanguageProgressResponse(label="C / C++", percentage=20, color="bg-cyan-500"),
            LanguageProgressResponse(label="Data Structures", percentage=20, color="bg-emerald-500"),
            LanguageProgressResponse(label="Algorithms", percentage=15, color="bg-amber-500"),
        ]

    user_q = _user_query(current_user.id)

    py_count = (
        mongo_db.activities.count_documents({"$and": [user_q, {"language": {"$regex": "python", "$options": "i"}}]})
        + mongo_db.executions.count_documents({"$and": [user_q, {"language": {"$regex": "python", "$options": "i"}}]})
    )
    java_count = (
        mongo_db.activities.count_documents({"$and": [user_q, {"language": {"$regex": "java", "$options": "i"}}]})
        + mongo_db.executions.count_documents({"$and": [user_q, {"language": {"$regex": "java", "$options": "i"}}]})
    )
    c_cpp_count = (
        mongo_db.activities.count_documents({"$and": [user_q, {"language": {"$regex": "(^c$|^cpp$|c\\+\\+)", "$options": "i"}}]})
        + mongo_db.executions.count_documents({"$and": [user_q, {"language": {"$regex": "(^c$|^cpp$|c\\+\\+)", "$options": "i"}}]})
    )
    
    ds_topics = ["Arrays", "Linked Lists", "Stacks", "Queues", "Trees", "Graphs"]
    ds_count = mongo_db.activities.count_documents({
        "$and": [user_q, {"topic": {"$in": ds_topics}}]
    })
    
    algo_topics = ["Sorting", "Recursion", "Binary Search", "Dynamic Programming"]
    algo_count = mongo_db.activities.count_documents({
        "$and": [user_q, {"topic": {"$in": algo_topics}}]
    })

    # Total user activities for scaling
    total_acts = mongo_db.activities.count_documents(user_q) + mongo_db.executions.count_documents(user_q)
    base_progress = min(40, max(15, total_acts * 4))

    return [
        LanguageProgressResponse(label="Python", percentage=min(100, max(25, py_count * 8 + (5 if py_count > 0 else 0))), color="bg-indigo-500"),
        LanguageProgressResponse(label="Java", percentage=min(100, max(20, java_count * 8 + (5 if java_count > 0 else 0))), color="bg-violet-500"),
        LanguageProgressResponse(label="C / C++", percentage=min(100, max(15, c_cpp_count * 8 + (5 if c_cpp_count > 0 else 0))), color="bg-cyan-500"),
        LanguageProgressResponse(label="Data Structures", percentage=min(100, max(20, ds_count * 10 + (base_progress // 2))), color="bg-emerald-500"),
        LanguageProgressResponse(label="Algorithms", percentage=min(100, max(15, algo_count * 10 + (base_progress // 2))), color="bg-amber-500"),
    ]


@router.get("/recommendations", response_model=List[RecommendationResponse])
def get_practice_recommendations():
    """Retrieve recommended DSA practice topics."""
    return [
        RecommendationResponse(id="arrays", topic="Arrays", difficulty="Beginner", problems=12, icon="📦"),
        RecommendationResponse(id="linked-lists", topic="Linked Lists", difficulty="Beginner", problems=8, icon="🔗"),
        RecommendationResponse(id="stacks", topic="Stacks", difficulty="Beginner", problems=6, icon="📚"),
        RecommendationResponse(id="queues", topic="Queues", difficulty="Intermediate", problems=6, icon="🚦"),
        RecommendationResponse(id="trees", topic="Trees", difficulty="Intermediate", problems=10, icon="🌲"),
        RecommendationResponse(id="graphs", topic="Graphs", difficulty="Advanced", problems=9, icon="🕸️"),
        RecommendationResponse(id="sorting", topic="Sorting", difficulty="Intermediate", problems=7, icon="🔢"),
        RecommendationResponse(id="recursion", topic="Recursion", difficulty="Intermediate", problems=8, icon="🔄"),
    ]


# ── Dashboard History Endpoints ────────────────────────────────────────────────

@router.post("/history", response_model=DashboardHistoryEventResponse, status_code=201)
def record_dashboard_history_event(
    req: DashboardHistoryEventCreate,
    current_user: User = Depends(get_current_user),
):
    """
    Record a dashboard history event (dashboard open, program open, etc.)
    into the MongoDB dashboard_history collection.
    """
    result = dashboard_history_service.record_dashboard_event(
        user_id=current_user.id,
        event_type=req.event_type,
        title=req.title,
        description=req.description,
        metadata=req.metadata,
    )
    return DashboardHistoryEventResponse(
        id=result["id"],
        user_id=current_user.id,
        event_type=result["event_type"],
        title=result["title"],
        description=result.get("description"),
        metadata=result.get("metadata"),
        created_at=result.get("created_at"),
    )


@router.get("/history", response_model=DashboardHistoryListResponse)
def list_dashboard_history(
    event_type: Optional[str] = Query(None, description="Filter by event type (dashboard_open, program_open, ...)"),
    date_range: Optional[str] = Query(None, description="today | this_week | this_month"),
    search: Optional[str] = Query(None, description="Keyword search in title/description"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    """
    Return paginated, filtered dashboard history events for the authenticated user
    from MongoDB dashboard_history collection.
    """
    data = dashboard_history_service.get_dashboard_history(
        user_id=current_user.id,
        event_type=event_type,
        date_range=date_range,
        search=search,
        page=page,
        limit=limit,
    )
    items = [
        DashboardHistoryEventResponse(
            id=item["id"],
            user_id=current_user.id,
            event_type=item["event_type"],
            title=item["title"],
            description=item.get("description"),
            metadata=item.get("metadata"),
            created_at=item.get("created_at"),
        )
        for item in data["items"]
    ]
    return DashboardHistoryListResponse(
        items=items,
        total=data["total"],
        page=data["page"],
        limit=data["limit"],
        pages=data["pages"],
    )


@router.get("/history/recent", response_model=List[DashboardHistoryEventResponse])
def get_recent_dashboard_history(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
):
    """Return the most recent N dashboard history events for the authenticated user."""
    docs = dashboard_history_service.get_recent_dashboard_history(
        user_id=current_user.id, limit=limit
    )
    return [
        DashboardHistoryEventResponse(
            id=d["id"],
            user_id=current_user.id,
            event_type=d["event_type"],
            title=d["title"],
            description=d.get("description"),
            metadata=d.get("metadata"),
            created_at=d.get("created_at"),
        )
        for d in docs
    ]


@router.get("/history/stats", response_model=DashboardHistoryStatsResponse)
def get_dashboard_history_stats(
    current_user: User = Depends(get_current_user),
):
    """Return aggregate statistics for the user's dashboard history (total, today, week, month, breakdown)."""
    stats = dashboard_history_service.get_dashboard_history_stats(user_id=current_user.id)
    return DashboardHistoryStatsResponse(**stats)


@router.delete("/history/{item_id}")
def delete_dashboard_history_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a single dashboard history record by its MongoDB ObjectId."""
    deleted = dashboard_history_service.delete_dashboard_history_item(
        user_id=current_user.id, item_id=item_id
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Dashboard history record not found or access denied.")
    return {"message": "Dashboard history record deleted.", "id": item_id}


@router.delete("/history")
def clear_all_dashboard_history(
    current_user: User = Depends(get_current_user),
):
    """Delete ALL dashboard history events for the authenticated user."""
    count = dashboard_history_service.clear_dashboard_history(user_id=current_user.id)
    return {"message": f"Cleared {count} dashboard history record(s).", "deleted_count": count}
