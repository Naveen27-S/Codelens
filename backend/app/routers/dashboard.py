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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve the user's recently saved/edited programs from CodeHistory."""
    programs = (
        db.query(CodeHistory)
        .filter(CodeHistory.user_id == current_user.id)
        .order_by(CodeHistory.updated_at.desc(), CodeHistory.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        RecentProgramResponse(
            id=p.id,
            title=p.title,
            language=p.language,
            lastEdited=(p.updated_at or p.created_at).isoformat() if (p.updated_at or p.created_at) else "recently",
            sourceCode=p.source_code,
        )
        for p in programs
    ]


@router.get("/visualizations", response_model=List[RecentVisualizationResponse])
def get_recent_visualizations(
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve recent visualizations executed by the user."""
    from ..models.user_activity import UserActivity

    activities = (
        db.query(UserActivity)
        .filter(
            UserActivity.user_id == current_user.id,
            UserActivity.activity_type.in_(["visualization_completed", "visualization"]),
        )
        .order_by(UserActivity.started_at.desc())
        .limit(limit)
        .all()
    )

    results = []
    for a in activities:
        meta = a.metadata_json or {}
        results.append(
            RecentVisualizationResponse(
                id=a.id,
                programName=a.program_name or a.title or "Algorithm",
                language=a.language or "python",
                steps=meta.get("steps", 12),
                status=a.status or "completed",
                timestamp=a.started_at.isoformat() if a.started_at else "recently",
                sourceCode=meta.get("source_code"),
                mermaidExplanation=meta.get("mermaid_explanation"),
            )
        )
    return results


@router.get("/progress", response_model=List[LanguageProgressResponse])
def get_learning_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve learning progress across languages and concepts based on user practice."""
    from ..models.user_activity import UserActivity

    # Count activities by language/topic
    py_count = db.query(func.count(UserActivity.id)).filter(UserActivity.user_id == current_user.id, UserActivity.language.ilike("%python%")).scalar() or 0
    java_count = db.query(func.count(UserActivity.id)).filter(UserActivity.user_id == current_user.id, UserActivity.language.ilike("%java%")).scalar() or 0
    ds_count = db.query(func.count(UserActivity.id)).filter(UserActivity.user_id == current_user.id, UserActivity.topic.in_(["Arrays", "Linked Lists", "Stacks", "Queues", "Trees", "Graphs"])).scalar() or 0
    algo_count = db.query(func.count(UserActivity.id)).filter(UserActivity.user_id == current_user.id, UserActivity.topic.in_(["Sorting", "Recursion", "Binary Search", "Dynamic Programming"])).scalar() or 0

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
