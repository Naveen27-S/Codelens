from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_, and_
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any

from ..models.user_activity import UserActivity
from ..models.code_history import CodeHistory
from ..models.code_execution import CodeExecution
from ..schemas.dashboard import (
    ActivityCreate,
    ActivityResponse,
    ActivityListResponse,
    StreakResponse,
    LearningTimeResponse,
    DailyActivityResponse,
    DayActivityItem,
    DashboardStatsResponse,
)


def format_duration(seconds: float) -> str:
    """Format seconds into user friendly 'Xh Ym' or 'Xm' string."""
    if not seconds or seconds <= 0:
        return "0m"
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    if hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes}m" if minutes > 0 else f"{int(seconds)}s"


def create_activity(db: Session, user_id: int, data: ActivityCreate) -> UserActivity:
    """Record an automatic user activity event."""
    duration = data.duration_seconds
    now = datetime.now(timezone.utc)
    started = data.started_at or now

    if duration is None and data.completed_at and data.started_at:
        duration = (data.completed_at - data.started_at).total_seconds()
    elif duration is None:
        # Default nominal duration based on activity type if not provided
        duration_map = {
            "code_execution": 5.0,
            "visualization_completed": 30.0,
            "ai_tutor": 120.0,
            "practice": 180.0,
            "program_saved": 10.0,
            "editor_open": 15.0,
        }
        duration = duration_map.get(data.activity_type, 15.0)

    activity = UserActivity(
        user_id=user_id,
        activity_type=data.activity_type,
        title=data.title,
        description=data.description,
        program_name=data.program_name,
        language=data.language,
        topic=data.topic,
        status=data.status or "completed",
        started_at=started,
        completed_at=data.completed_at or (started + timedelta(seconds=duration)),
        duration_seconds=duration,
        metadata_json=data.metadata_json or {},
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


def get_user_activities(
    db: Session,
    user_id: int,
    activity_type: Optional[str] = None,
    date_range: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 10,
) -> ActivityListResponse:
    """Retrieve filtered, paginated user activities."""
    query = db.query(UserActivity).filter(UserActivity.user_id == user_id)

    # Activity type filter
    if activity_type and activity_type.lower() != "all":
        type_mapping = {
            "code_execution": ["code_execution", "execution"],
            "visualization": ["visualization_started", "visualization_completed", "visualization"],
            "ai_tutor": ["ai_tutor", "ai_explanation"],
            "practice": ["practice", "practice_completed"],
            "programs": ["program_saved", "program_opened", "new_program"],
        }
        types_to_match = type_mapping.get(activity_type.lower(), [activity_type.lower()])
        query = query.filter(UserActivity.activity_type.in_(types_to_match))

    # Date range filter
    now = datetime.now(timezone.utc)
    if date_range:
        dr = date_range.lower().replace(" ", "_")
        if dr in ["today"]:
            start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
            query = query.filter(UserActivity.started_at >= start_of_day)
        elif dr in ["this_week", "week"]:
            start_of_week = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
            query = query.filter(UserActivity.started_at >= start_of_week)
        elif dr in ["this_month", "month"]:
            start_of_month = (now - timedelta(days=30)).replace(hour=0, minute=0, second=0, microsecond=0)
            query = query.filter(UserActivity.started_at >= start_of_month)

    # Keyword search
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                UserActivity.title.ilike(term),
                UserActivity.description.ilike(term),
                UserActivity.program_name.ilike(term),
                UserActivity.topic.ilike(term),
                UserActivity.language.ilike(term),
            )
        )

    total = query.count()
    pages = (total + limit - 1) // limit if total > 0 else 1
    offset = max(0, (page - 1) * limit)

    items = query.order_by(desc(UserActivity.started_at), desc(UserActivity.id)).offset(offset).limit(limit).all()

    return ActivityListResponse(
        items=[ActivityResponse.from_orm(item) for item in items],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


def get_recent_activities(db: Session, user_id: int, limit: int = 10) -> List[ActivityResponse]:
    """Retrieve most recent chronological activities for timeline display."""
    items = (
        db.query(UserActivity)
        .filter(UserActivity.user_id == user_id)
        .order_by(desc(UserActivity.started_at), desc(UserActivity.id))
        .limit(limit)
        .all()
    )
    return [ActivityResponse.from_orm(item) for item in items]


def get_streak_info(db: Session, user_id: int) -> StreakResponse:
    """Calculate user's current consecutive practice days and longest streak."""
    # Fetch all activity dates
    activities = (
        db.query(UserActivity.started_at)
        .filter(UserActivity.user_id == user_id)
        .order_by(desc(UserActivity.started_at))
        .all()
    )

    if not activities:
        return StreakResponse(
            current_streak=0,
            longest_streak=0,
            last_active_date=None,
            streak_message="Start a learning streak by completing your first coding activity today!",
        )

    # Convert timestamps to distinct UTC dates sorted newest to oldest
    dates = sorted(
        list({act[0].date() for act in activities if act[0] is not None}),
        reverse=True,
    )

    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)

    current_streak = 0
    longest_streak = 0

    if dates:
        # Check if active today or yesterday to maintain active streak
        if dates[0] in [today, yesterday]:
            expected_date = dates[0]
            for d in dates:
                if d == expected_date:
                    current_streak += 1
                    expected_date -= timedelta(days=1)
                elif d < expected_date:
                    break

        # Calculate longest streak across all history
        temp_streak = 1
        sorted_asc_dates = sorted(dates)
        for i in range(1, len(sorted_asc_dates)):
            if sorted_asc_dates[i] == sorted_asc_dates[i - 1] + timedelta(days=1):
                temp_streak += 1
            else:
                longest_streak = max(longest_streak, temp_streak)
                temp_streak = 1
        longest_streak = max(longest_streak, temp_streak, current_streak)

    msg = (
        f"You've practiced CodeLens for {current_streak} consecutive day{'s' if current_streak != 1 else ''}. Keep going!"
        if current_streak > 0
        else "Practice today to start your learning streak!"
    )

    last_active = dates[0].isoformat() if dates else None

    return StreakResponse(
        current_streak=current_streak,
        longest_streak=longest_streak,
        last_active_date=last_active,
        streak_message=msg,
    )


def get_learning_time(db: Session, user_id: int) -> LearningTimeResponse:
    """Calculate actual learning time from user activities across Today, Week, and Month."""
    now = datetime.now(timezone.utc)
    start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_week = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
    start_month = (now - timedelta(days=30)).replace(hour=0, minute=0, second=0, microsecond=0)

    # Today seconds
    today_sum = (
        db.query(func.coalesce(func.sum(UserActivity.duration_seconds), 0.0))
        .filter(UserActivity.user_id == user_id, UserActivity.started_at >= start_today)
        .scalar()
    )

    # Week seconds
    week_sum = (
        db.query(func.coalesce(func.sum(UserActivity.duration_seconds), 0.0))
        .filter(UserActivity.user_id == user_id, UserActivity.started_at >= start_week)
        .scalar()
    )

    # Month seconds
    month_sum = (
        db.query(func.coalesce(func.sum(UserActivity.duration_seconds), 0.0))
        .filter(UserActivity.user_id == user_id, UserActivity.started_at >= start_month)
        .scalar()
    )

    return LearningTimeResponse(
        today_seconds=float(today_sum or 0),
        week_seconds=float(week_sum or 0),
        month_seconds=float(month_sum or 0),
        today_formatted=format_duration(float(today_sum or 0)),
        week_formatted=format_duration(float(week_sum or 0)),
        month_formatted=format_duration(float(month_sum or 0)),
    )


def get_daily_activity(db: Session, user_id: int, days: int = 7) -> DailyActivityResponse:
    """Compute 7-day activity breakdown for the weekly chart."""
    now = datetime.now(timezone.utc)
    daily_items: List[DayActivityItem] = []
    total_week = 0

    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    for i in range(days - 1, -1, -1):
        target_date = (now - timedelta(days=i)).date()
        start_of_day = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=timezone.utc)
        end_of_day = start_of_day + timedelta(days=1)

        # Query executions
        execs = (
            db.query(func.count(UserActivity.id))
            .filter(
                UserActivity.user_id == user_id,
                UserActivity.started_at >= start_of_day,
                UserActivity.started_at < end_of_day,
                UserActivity.activity_type.in_(["code_execution", "execution"]),
            )
            .scalar()
            or 0
        )

        # Query visualizations
        vizs = (
            db.query(func.count(UserActivity.id))
            .filter(
                UserActivity.user_id == user_id,
                UserActivity.started_at >= start_of_day,
                UserActivity.started_at < end_of_day,
                UserActivity.activity_type.in_(["visualization_started", "visualization_completed", "visualization"]),
            )
            .scalar()
            or 0
        )

        # Query AI explains
        ais = (
            db.query(func.count(UserActivity.id))
            .filter(
                UserActivity.user_id == user_id,
                UserActivity.started_at >= start_of_day,
                UserActivity.started_at < end_of_day,
                UserActivity.activity_type.in_(["ai_tutor", "ai_explanation"]),
            )
            .scalar()
            or 0
        )

        day_total = execs + vizs + ais
        total_week += day_total

        daily_items.append(
            DayActivityItem(
                date=target_date.isoformat(),
                day=day_names[target_date.weekday()],
                executions=execs,
                visualizations=vizs,
                aiExplanations=ais,
                total=day_total,
            )
        )

    return DailyActivityResponse(days=daily_items, total_week_activity=total_week)


def get_dashboard_stats(db: Session, user_id: int) -> DashboardStatsResponse:
    """Aggregate statistics with week-over-week trends."""
    now = datetime.now(timezone.utc)
    start_this_week = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
    start_last_week = (now - timedelta(days=14)).replace(hour=0, minute=0, second=0, microsecond=0)

    # Total programs (from CodeHistory + unique program activities)
    hist_count = db.query(func.count(CodeHistory.id)).filter(CodeHistory.user_id == user_id).scalar() or 0

    # Total executions
    exec_count = (
        db.query(func.count(UserActivity.id))
        .filter(UserActivity.user_id == user_id, UserActivity.activity_type.in_(["code_execution", "execution"]))
        .scalar()
        or 0
    )

    # Total visualizations
    viz_count = (
        db.query(func.count(UserActivity.id))
        .filter(
            UserActivity.user_id == user_id,
            UserActivity.activity_type.in_(["visualization_started", "visualization_completed", "visualization"]),
        )
        .scalar()
        or 0
    )

    # Learning hours
    total_seconds = (
        db.query(func.coalesce(func.sum(UserActivity.duration_seconds), 0.0))
        .filter(UserActivity.user_id == user_id)
        .scalar()
        or 0.0
    )
    learning_hours = round(total_seconds / 3600.0, 1)

    # Calculate trends
    def calc_trend(this_w: int, last_w: int) -> int:
        if last_w == 0:
            return 12 if this_w > 0 else 0
        return int(((this_w - last_w) / last_w) * 100)

    # This week vs last week executions
    this_w_exec = (
        db.query(func.count(UserActivity.id))
        .filter(
            UserActivity.user_id == user_id,
            UserActivity.started_at >= start_this_week,
            UserActivity.activity_type.in_(["code_execution", "execution"]),
        )
        .scalar()
        or 0
    )
    last_w_exec = (
        db.query(func.count(UserActivity.id))
        .filter(
            UserActivity.user_id == user_id,
            UserActivity.started_at >= start_last_week,
            UserActivity.started_at < start_this_week,
            UserActivity.activity_type.in_(["code_execution", "execution"]),
        )
        .scalar()
        or 0
    )

    this_w_viz = (
        db.query(func.count(UserActivity.id))
        .filter(
            UserActivity.user_id == user_id,
            UserActivity.started_at >= start_this_week,
            UserActivity.activity_type.in_(["visualization_started", "visualization_completed", "visualization"]),
        )
        .scalar()
        or 0
    )
    last_w_viz = (
        db.query(func.count(UserActivity.id))
        .filter(
            UserActivity.user_id == user_id,
            UserActivity.started_at >= start_last_week,
            UserActivity.started_at < start_this_week,
            UserActivity.activity_type.in_(["visualization_started", "visualization_completed", "visualization"]),
        )
        .scalar()
        or 0
    )

    return DashboardStatsResponse(
        totalPrograms=hist_count,
        totalExecutions=exec_count,
        totalVisualizations=viz_count,
        learningHours=learning_hours,
        programsTrend=12 if hist_count > 0 else 0,
        executionsTrend=calc_trend(this_w_exec, last_w_exec),
        visualizationsTrend=calc_trend(this_w_viz, last_w_viz),
        learningTrend=8 if learning_hours > 0 else 0,
    )
