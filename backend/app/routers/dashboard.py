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
)
from ..services import activity_service

router = APIRouter()


@router.post("/activity", response_model=ActivityResponse)
def record_activity(
    req: ActivityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record an automatic user activity event (Run Code, Visualize, Practice, etc.)."""
    return activity_service.create_activity(db=db, user_id=current_user.id, data=req)


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
    """Retrieve learning progress across languages and concepts based on MongoDB activities."""
    from ..database.mongodb import get_mongodb
    mongo_db = get_mongodb()

    py_count = mongo_db.activities.count_documents({
        "user_id": current_user.id,
        "language": {"$regex": "python", "$options": "i"}
    })
    java_count = mongo_db.activities.count_documents({
        "user_id": current_user.id,
        "language": {"$regex": "java", "$options": "i"}
    })
    
    ds_topics = ["Arrays", "Linked Lists", "Stacks", "Queues", "Trees", "Graphs"]
    ds_count = mongo_db.activities.count_documents({
        "user_id": current_user.id,
        "topic": {"$in": ds_topics}
    })
    
    algo_topics = ["Sorting", "Recursion", "Binary Search", "Dynamic Programming"]
    algo_count = mongo_db.activities.count_documents({
        "user_id": current_user.id,
        "topic": {"$in": algo_topics}
    })

    return [
        LanguageProgressResponse(label="Python", percentage=min(100, max(25, py_count * 8)), color="bg-indigo-500"),
        LanguageProgressResponse(label="Java", percentage=min(100, max(15, java_count * 8)), color="bg-violet-500"),
        LanguageProgressResponse(label="Data Structures", percentage=min(100, max(20, ds_count * 10)), color="bg-emerald-500"),
        LanguageProgressResponse(label="Algorithms", percentage=min(100, max(10, algo_count * 10)), color="bg-amber-500"),
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
