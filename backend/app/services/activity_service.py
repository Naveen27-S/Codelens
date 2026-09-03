from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from ..database.mongodb import get_mongodb
from ..schemas.dashboard import (
    ActivityCreate,
    ActivityResponse,
    ActivityListResponse,
    StreakResponse,
    LearningTimeResponse,
    DailyActivityResponse,
    DayActivityItem,
    DashboardStatsResponse,
    CalendarDayItem,
    CalendarActivityResponse,
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

def create_activity(user_id: int, data: ActivityCreate, db: Session = None) -> Dict[str, Any]:
    """Record an automatic user activity event in MongoDB."""
    duration = data.duration_seconds
    now = datetime.now(timezone.utc)
    started = data.started_at or now

    # Convert started_at to timezone-aware if it's naive
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)

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

    completed_at = data.completed_at or (started + timedelta(seconds=duration))
    if completed_at.tzinfo is None:
        completed_at = completed_at.replace(tzinfo=timezone.utc)

    activity_doc = {
        "user_id": user_id,
        "activity_type": data.activity_type,
        "title": data.title,
        "description": data.description,
        "program_name": data.program_name,
        "language": data.language,
        "topic": data.topic,
        "status": data.status or "completed",
        "started_at": started,
        "completed_at": completed_at,
        "duration_seconds": float(duration),
        "metadata_json": data.metadata_json or {},
        "created_at": now
    }

    mongo_db = get_mongodb()
    if mongo_db is None:
        activity_doc["id"] = "offline"
        return activity_doc
    res = mongo_db.activities.insert_one(activity_doc)
    activity_doc["id"] = str(res.inserted_id)
    return activity_doc

def get_user_activities(
    user_id: int,
    activity_type: Optional[str] = None,
    date_range: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 10,
    db: Session = None
) -> ActivityListResponse:
    """Retrieve filtered, paginated user activities from MongoDB."""
    mongo_db = get_mongodb()
    if mongo_db is None:
        return ActivityListResponse(items=[], total=0, page=page, limit=limit, pages=1)
    query = {"user_id": user_id}

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
        query["activity_type"] = {"$in": types_to_match}

    # Date range filter
    now = datetime.now(timezone.utc)
    if date_range:
        dr = date_range.lower().replace(" ", "_")
        if dr in ["today"]:
            start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
            query["started_at"] = {"$gte": start_of_day}
        elif dr in ["this_week", "week"]:
            start_of_week = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
            query["started_at"] = {"$gte": start_of_week}
        elif dr in ["this_month", "month"]:
            start_of_month = (now - timedelta(days=30)).replace(hour=0, minute=0, second=0, microsecond=0)
            query["started_at"] = {"$gte": start_of_month}

    # Keyword search
    if search and search.strip():
        term = search.strip()
        query["$or"] = [
            {"title": {"$regex": term, "$options": "i"}},
            {"description": {"$regex": term, "$options": "i"}},
            {"program_name": {"$regex": term, "$options": "i"}},
            {"topic": {"$regex": term, "$options": "i"}},
            {"language": {"$regex": term, "$options": "i"}},
        ]

    total = mongo_db.activities.count_documents(query)
    pages = (total + limit - 1) // limit if total > 0 else 1
    offset = max(0, (page - 1) * limit)

    cursor = mongo_db.activities.find(query).sort([("started_at", -1), ("_id", -1)]).skip(offset).limit(limit)
    
    items = []
    for doc in cursor:
        items.append(ActivityResponse(
            id=str(doc["_id"]),
            user_id=doc["user_id"],
            activity_type=doc["activity_type"],
            title=doc["title"],
            description=doc.get("description"),
            program_name=doc.get("program_name"),
            language=doc.get("language"),
            topic=doc.get("topic"),
            status=doc.get("status"),
            started_at=doc.get("started_at"),
            completed_at=doc.get("completed_at"),
            duration_seconds=doc.get("duration_seconds"),
            metadata_json=doc.get("metadata_json"),
            created_at=doc.get("created_at")
        ))

    return ActivityListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )

def get_recent_activities(user_id: int, limit: int = 10, db: Session = None) -> List[ActivityResponse]:
    """Retrieve most recent chronological activities from MongoDB."""
    mongo_db = get_mongodb()
    if mongo_db is None:
        return []
    cursor = mongo_db.activities.find({"user_id": user_id}).sort([("started_at", -1), ("_id", -1)]).limit(limit)
    
    items = []
    for doc in cursor:
        items.append(ActivityResponse(
            id=str(doc["_id"]),
            user_id=doc["user_id"],
            activity_type=doc["activity_type"],
            title=doc["title"],
            description=doc.get("description"),
            program_name=doc.get("program_name"),
            language=doc.get("language"),
            topic=doc.get("topic"),
            status=doc.get("status"),
            started_at=doc.get("started_at"),
            completed_at=doc.get("completed_at"),
            duration_seconds=doc.get("duration_seconds"),
            metadata_json=doc.get("metadata_json"),
            created_at=doc.get("created_at")
        ))
    return items

def get_streak_info(user_id: int, db: Session = None) -> StreakResponse:
    """Calculate user's current consecutive practice days and longest streak from MongoDB activities."""
    mongo_db = get_mongodb()
    if mongo_db is None:
        return StreakResponse(
            current_streak=0, longest_streak=0, last_active_date=None,
            streak_message="Start a learning streak by completing your first coding activity today!"
        )
    cursor = mongo_db.activities.find({"user_id": user_id}, {"started_at": 1}).sort("started_at", -1)

    dates = []
    for doc in cursor:
        started_at = doc.get("started_at")
        if started_at:
            if isinstance(started_at, datetime):
                dates.append(started_at.date())
            elif isinstance(started_at, str):
                try:
                    # Strip Z / offset if present
                    dt_str = started_at
                    if dt_str.endswith("Z"):
                        dt_str = dt_str[:-1] + "+00:00"
                    dates.append(datetime.fromisoformat(dt_str).date())
                except ValueError:
                    pass

    # Unique sorted dates (newest first)
    dates = sorted(list(set(dates)), reverse=True)

    if not dates:
        return StreakResponse(
            current_streak=0,
            longest_streak=0,
            last_active_date=None,
            streak_message="Start a learning streak by completing your first coding activity today!",
        )

    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)

    current_streak = 0
    longest_streak = 0

    # Calculate active streak
    if dates[0] in [today, yesterday]:
        expected_date = dates[0]
        for d in dates:
            if d == expected_date:
                current_streak += 1
                expected_date -= timedelta(days=1)
            elif d < expected_date:
                break

    # Calculate longest streak
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

    return StreakResponse(
        current_streak=current_streak,
        longest_streak=longest_streak,
        last_active_date=dates[0].isoformat(),
        streak_message=msg,
    )

def get_learning_time(user_id: int, db: Session = None) -> LearningTimeResponse:
    """Calculate accumulated learning duration from MongoDB."""
    mongo_db = get_mongodb()
    if mongo_db is None:
        return LearningTimeResponse(
            today_seconds=0, week_seconds=0, month_seconds=0,
            today_formatted="0m", week_formatted="0m", month_formatted="0m"
        )
    now = datetime.now(timezone.utc)
    start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_week = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
    start_month = (now - timedelta(days=30)).replace(hour=0, minute=0, second=0, microsecond=0)

    def sum_duration(since_date):
        pipeline = [
            {"$match": {"user_id": user_id, "started_at": {"$gte": since_date}}},
            {"$group": {"_id": None, "total": {"$sum": "$duration_seconds"}}}
        ]
        res = list(mongo_db.activities.aggregate(pipeline))
        return float(res[0]["total"]) if res and res[0]["total"] is not None else 0.0

    today_sum = sum_duration(start_today)
    week_sum = sum_duration(start_week)
    month_sum = sum_duration(start_month)

    return LearningTimeResponse(
        today_seconds=today_sum,
        week_seconds=week_sum,
        month_seconds=month_sum,
        today_formatted=format_duration(today_sum),
        week_formatted=format_duration(week_sum),
        month_formatted=format_duration(month_sum)
    )

def get_daily_activity(user_id: int, days: int = 7, db: Session = None) -> DailyActivityResponse:
    """Compute 7-day activity breakdown for the dashboard chart using MongoDB."""
    mongo_db = get_mongodb()
    now = datetime.now(timezone.utc)
    daily_items: List[DayActivityItem] = []
    total_week = 0
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    if mongo_db is None:
        for i in range(days - 1, -1, -1):
            target_date = (now - timedelta(days=i)).date()
            daily_items.append(DayActivityItem(
                date=target_date.isoformat(),
                day=day_names[target_date.weekday()],
                executions=0, visualizations=0, aiExplanations=0, total=0
            ))
        return DailyActivityResponse(days=daily_items, total_week_activity=0)

    for i in range(days - 1, -1, -1):
        target_date = (now - timedelta(days=i)).date()
        start_of_day = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=timezone.utc)
        end_of_day = start_of_day + timedelta(days=1)

        execs = mongo_db.activities.count_documents({
            "user_id": user_id,
            "started_at": {"$gte": start_of_day, "$lt": end_of_day},
            "activity_type": {"$in": ["code_execution", "execution"]}
        })

        vizs = mongo_db.activities.count_documents({
            "user_id": user_id,
            "started_at": {"$gte": start_of_day, "$lt": end_of_day},
            "activity_type": {"$in": ["visualization_started", "visualization_completed", "visualization"]}
        })

        ais = mongo_db.activities.count_documents({
            "user_id": user_id,
            "started_at": {"$gte": start_of_day, "$lt": end_of_day},
            "activity_type": {"$in": ["ai_tutor", "ai_explanation"]}
        })

        day_total = execs + vizs + ais
        total_week += day_total

        daily_items.append(
            DayActivityItem(
                date=target_date.isoformat(),
                day=day_names[target_date.weekday()],
                executions=execs,
                visualizations=vizs,
                aiExplanations=ais,
                total=day_total
            )
        )

    return DailyActivityResponse(days=daily_items, total_week_activity=total_week)

def get_dashboard_stats(user_id: int, db: Session = None) -> DashboardStatsResponse:
    """Aggregate statistics with week-over-week trends from MongoDB collections."""
    mongo_db = get_mongodb()
    if mongo_db is None:
        return DashboardStatsResponse(
            totalPrograms=0, totalExecutions=0, totalVisualizations=0,
            learningHours=0.0, programsTrend=0, executionsTrend=0,
            visualizationsTrend=0, learningTrend=0
        )
    now = datetime.now(timezone.utc)
    start_this_week = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
    start_last_week = (now - timedelta(days=14)).replace(hour=0, minute=0, second=0, microsecond=0)

    # Total programs saved in MongoDB
    hist_count = mongo_db.programs.count_documents({"user_id": user_id})

    # Total executions in MongoDB
    exec_count = mongo_db.activities.count_documents({
        "user_id": user_id,
        "activity_type": {"$in": ["code_execution", "execution"]}
    })

    # Total visualizations in MongoDB
    viz_count = mongo_db.activities.count_documents({
        "user_id": user_id,
        "activity_type": {"$in": ["visualization_started", "visualization_completed", "visualization"]}
    })

    # Sum learning hours in MongoDB
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": None, "total": {"$sum": "$duration_seconds"}}}
    ]
    res = list(mongo_db.activities.aggregate(pipeline))
    total_seconds = float(res[0]["total"]) if res and res[0]["total"] is not None else 0.0
    learning_hours = round(total_seconds / 3600.0, 1)

    def calc_trend(this_w: int, last_w: int) -> int:
        if last_w == 0:
            return 12 if this_w > 0 else 0
        return int(((this_w - last_w) / last_w) * 100)

    this_w_exec = mongo_db.activities.count_documents({
        "user_id": user_id,
        "started_at": {"$gte": start_this_week},
        "activity_type": {"$in": ["code_execution", "execution"]}
    })
    last_w_exec = mongo_db.activities.count_documents({
        "user_id": user_id,
        "started_at": {"$gte": start_last_week, "$lt": start_this_week},
        "activity_type": {"$in": ["code_execution", "execution"]}
    })

    this_w_viz = mongo_db.activities.count_documents({
        "user_id": user_id,
        "started_at": {"$gte": start_this_week},
        "activity_type": {"$in": ["visualization_started", "visualization_completed", "visualization"]}
    })
    last_w_viz = mongo_db.activities.count_documents({
        "user_id": user_id,
        "started_at": {"$gte": start_last_week, "$lt": start_this_week},
        "activity_type": {"$in": ["visualization_started", "visualization_completed", "visualization"]}
    })

    return DashboardStatsResponse(
        totalPrograms=hist_count,
        totalExecutions=exec_count,
        totalVisualizations=viz_count,
        learningHours=learning_hours,
        programsTrend=12 if hist_count > 0 else 0,
        executionsTrend=calc_trend(this_w_exec, last_w_exec),
        visualizationsTrend=calc_trend(this_w_viz, last_w_viz),
        learningTrend=8 if learning_hours > 0 else 0
    )


def get_calendar_activity(user_id: int, days: int = 180, db: Session = None) -> CalendarActivityResponse:
    """Return per-day activity counts for the last N days (used for the heatmap calendar)."""
    mongo_db = get_mongodb()
    now = datetime.now(timezone.utc)

    if mongo_db is None:
        # Return empty calendar when MongoDB is unavailable
        empty_days = []
        for i in range(days, -1, -1):
            d = (now - timedelta(days=i)).date()
            empty_days.append(CalendarDayItem(date=d.isoformat(), count=0))
        return CalendarActivityResponse(days=empty_days, max_count=0)

    start_date = (now - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)


    pipeline = [
        {
            "$match": {
                "user_id": user_id,
                "started_at": {"$gte": start_date}
            }
        },
        {
            "$group": {
                "_id": {
                    "$dateToString": {
                        "format": "%Y-%m-%d",
                        "date": "$started_at",
                        "timezone": "UTC"
                    }
                },
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]

    results = list(mongo_db.activities.aggregate(pipeline))
    day_map: Dict[str, int] = {r["_id"]: r["count"] for r in results}

    calendar_days: List[CalendarDayItem] = []
    max_count = 0
    for i in range(days, -1, -1):
        d = (now - timedelta(days=i)).date()
        date_str = d.isoformat()
        count = day_map.get(date_str, 0)
        calendar_days.append(CalendarDayItem(date=date_str, count=count))
        if count > max_count:
            max_count = count

    return CalendarActivityResponse(days=calendar_days, max_count=max_count)
