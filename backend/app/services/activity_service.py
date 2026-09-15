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

def _user_query(user_id: Any) -> dict:
    """Query MongoDB for user_id matching both integer and string formats."""
    try:
        u_int = int(user_id)
        return {"$or": [{"user_id": u_int}, {"user_id": str(user_id)}]}
    except (ValueError, TypeError):
        return {"user_id": user_id}


def get_streak_info(user_id: int, db: Session = None) -> StreakResponse:
    """Calculate user's current consecutive practice days and longest streak from MongoDB activities, executions, and programs."""
    mongo_db = get_mongodb()
    if mongo_db is None:
        return StreakResponse(
            current_streak=0, longest_streak=0, last_active_date=None,
            streak_message="Start a learning streak by completing your first coding activity today!"
        )

    user_q = _user_query(user_id)
    dates_set = set()

    def parse_to_date(val: Any) -> Optional[datetime.date]:
        if not val:
            return None
        if isinstance(val, datetime):
            return val.date()
        if isinstance(val, str):
            try:
                dt_str = val
                if dt_str.endswith("Z"):
                    dt_str = dt_str[:-1] + "+00:00"
                return datetime.fromisoformat(dt_str).date()
            except Exception:
                try:
                    return datetime.strptime(val[:10], "%Y-%m-%d").date()
                except Exception:
                    return None
        return None

    # 1. Activities in MongoDB
    for doc in mongo_db.activities.find(user_q, {"started_at": 1, "created_at": 1}):
        d = parse_to_date(doc.get("started_at")) or parse_to_date(doc.get("created_at"))
        if d:
            dates_set.add(d)

    # 2. Executions in MongoDB
    for doc in mongo_db.executions.find(user_q, {"created_at": 1}):
        d = parse_to_date(doc.get("created_at"))
        if d:
            dates_set.add(d)

    # 3. Programs saved in MongoDB
    for doc in mongo_db.programs.find(user_q, {"created_at": 1, "updated_at": 1}):
        d = parse_to_date(doc.get("created_at")) or parse_to_date(doc.get("updated_at"))
        if d:
            dates_set.add(d)

    # Unique sorted dates (newest first)
    dates = sorted(list(dates_set), reverse=True)

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
    """
    Aggregate all dashboard statistics from MongoDB.
    Returns data for all 7 stat cards:
      Programs Saved / Code Runs / Visualizations /
      Day Streak / Learning Time / Programs Practiced / Coding Streak
    """
    mongo_db = get_mongodb()
    if mongo_db is None:
        return DashboardStatsResponse(
            totalPrograms=0, totalExecutions=0, totalVisualizations=0,
            totalPracticed=0, learningHours=0.0, longestStreak=0,
            programsTrend=0, executionsTrend=0, visualizationsTrend=0,
            practiceTrend=0, learningTrend=0
        )

    now = datetime.now(timezone.utc)
    start_this_week = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
    start_last_week = (now - timedelta(days=14)).replace(hour=0, minute=0, second=0, microsecond=0)

    # ── 1. Programs Saved (programs collection) ───────────────────────────────
    hist_count = mongo_db.programs.count_documents({"user_id": user_id})

    # ── 2. Code Runs ─────────────────────────────────────────────────────────
    exec_count = mongo_db.activities.count_documents({
        "user_id": user_id,
        "activity_type": {"$in": ["code_execution", "execution"]}
    })
    exec_direct = mongo_db.executions.count_documents({"user_id": user_id})
    total_exec = max(exec_count, exec_direct)

    # ── 3. Visualizations ────────────────────────────────────────────────────
    viz_count = mongo_db.activities.count_documents({
        "user_id": user_id,
        "activity_type": {"$in": ["visualization_started", "visualization_completed", "visualization"]}
    })

    # ── 4. Programs Practiced ────────────────────────────────────────────────
    practice_count = mongo_db.activities.count_documents({
        "user_id": user_id,
        "activity_type": {"$in": ["practice", "practice_completed"]}
    })

    # ── 5. Learning Hours (sum of duration_seconds across all activities) ────
    res = list(mongo_db.activities.aggregate([
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": None, "total": {"$sum": "$duration_seconds"}}}
    ]))
    total_seconds = float(res[0]["total"]) if res and res[0]["total"] else 0.0
    learning_hours = round(total_seconds / 3600.0, 1)

    # ── 6. Longest Streak (computed from calendar of unique active days) ─────
    start_180 = (now - timedelta(days=180)).replace(hour=0, minute=0, second=0, microsecond=0)
    cal_pipeline = [
        {"$match": {"user_id": user_id, "started_at": {"$gte": start_180}}},
        {
            "$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$started_at", "timezone": "UTC"}},
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    active_dates = {r["_id"] for r in mongo_db.activities.aggregate(cal_pipeline) if r["_id"]}

    longest_streak = 0
    current_streak_local = 0
    check = (now - timedelta(days=180)).date()
    today = now.date()
    while check <= today:
        if check.isoformat() in active_dates:
            current_streak_local += 1
            longest_streak = max(longest_streak, current_streak_local)
        else:
            current_streak_local = 0
        check += timedelta(days=1)

    # ── 7. Week-over-week trend helper ────────────────────────────────────────
    def calc_trend(this_w: int, last_w: int) -> int:
        if last_w == 0:
            return 12 if this_w > 0 else 0
        return max(-99, min(999, int(((this_w - last_w) / last_w) * 100)))

    this_w_exec = mongo_db.activities.count_documents({
        "user_id": user_id, "started_at": {"$gte": start_this_week},
        "activity_type": {"$in": ["code_execution", "execution"]}
    })
    last_w_exec = mongo_db.activities.count_documents({
        "user_id": user_id, "started_at": {"$gte": start_last_week, "$lt": start_this_week},
        "activity_type": {"$in": ["code_execution", "execution"]}
    })
    this_w_viz = mongo_db.activities.count_documents({
        "user_id": user_id, "started_at": {"$gte": start_this_week},
        "activity_type": {"$in": ["visualization_started", "visualization_completed", "visualization"]}
    })
    last_w_viz = mongo_db.activities.count_documents({
        "user_id": user_id, "started_at": {"$gte": start_last_week, "$lt": start_this_week},
        "activity_type": {"$in": ["visualization_started", "visualization_completed", "visualization"]}
    })
    this_w_prog = mongo_db.activities.count_documents({
        "user_id": user_id, "started_at": {"$gte": start_this_week},
        "activity_type": "program_saved"
    })
    last_w_prog = mongo_db.activities.count_documents({
        "user_id": user_id, "started_at": {"$gte": start_last_week, "$lt": start_this_week},
        "activity_type": "program_saved"
    })
    this_w_prac = mongo_db.activities.count_documents({
        "user_id": user_id, "started_at": {"$gte": start_this_week},
        "activity_type": {"$in": ["practice", "practice_completed"]}
    })
    last_w_prac = mongo_db.activities.count_documents({
        "user_id": user_id, "started_at": {"$gte": start_last_week, "$lt": start_this_week},
        "activity_type": {"$in": ["practice", "practice_completed"]}
    })
    res_this = list(mongo_db.activities.aggregate([
        {"$match": {"user_id": user_id, "started_at": {"$gte": start_this_week}}},
        {"$group": {"_id": None, "total": {"$sum": "$duration_seconds"}}}
    ]))
    res_last = list(mongo_db.activities.aggregate([
        {"$match": {"user_id": user_id, "started_at": {"$gte": start_last_week, "$lt": start_this_week}}},
        {"$group": {"_id": None, "total": {"$sum": "$duration_seconds"}}}
    ]))
    this_w_learn_s = float(res_this[0]["total"]) if res_this else 0.0
    last_w_learn_s = float(res_last[0]["total"]) if res_last else 0.0

    return DashboardStatsResponse(
        totalPrograms=hist_count,
        totalExecutions=total_exec,
        totalVisualizations=viz_count,
        totalPracticed=practice_count,
        learningHours=learning_hours,
        longestStreak=longest_streak,
        programsTrend=calc_trend(this_w_prog, last_w_prog),
        executionsTrend=calc_trend(this_w_exec, last_w_exec),
        visualizationsTrend=calc_trend(this_w_viz, last_w_viz),
        practiceTrend=calc_trend(this_w_prac, last_w_prac),
        learningTrend=calc_trend(int(this_w_learn_s), int(last_w_learn_s))
    )


def get_calendar_activity(user_id: int, days: int = 180, db: Session = None) -> CalendarActivityResponse:
    """Return per-day activity counts for the last N days (used for the heatmap calendar and mini calendar)."""
    mongo_db = get_mongodb()
    now = datetime.now(timezone.utc)

    if mongo_db is None:
        # Return empty calendar when MongoDB is unavailable
        empty_days = []
        for i in range(days, -1, -1):
            d = (now - timedelta(days=i)).date()
            empty_days.append(CalendarDayItem(date=d.isoformat(), count=0))
        return CalendarActivityResponse(days=empty_days, max_count=0)

    user_q = _user_query(user_id)
    day_map: Dict[str, int] = {}

    def extract_date(val: Any) -> Optional[str]:
        if not val:
            return None
        if isinstance(val, datetime):
            return val.strftime("%Y-%m-%d")
        if isinstance(val, str):
            try:
                return val.split("T")[0][:10]
            except Exception:
                return None
        return None

    # 1. Tally from mongo_db.activities
    for doc in mongo_db.activities.find(user_q, {"started_at": 1, "created_at": 1}):
        d_str = extract_date(doc.get("started_at")) or extract_date(doc.get("created_at"))
        if d_str:
            day_map[d_str] = day_map.get(d_str, 0) + 1

    # 2. Also ensure any executions from mongo_db.executions are counted if not in activities
    for doc in mongo_db.executions.find(user_q, {"created_at": 1}):
        d_str = extract_date(doc.get("created_at"))
        if d_str and d_str not in day_map:
            day_map[d_str] = day_map.get(d_str, 0) + 1

    # 3. Also include saved programs from mongo_db.programs
    for doc in mongo_db.programs.find(user_q, {"created_at": 1, "updated_at": 1}):
        d_str = extract_date(doc.get("created_at")) or extract_date(doc.get("updated_at"))
        if d_str and d_str not in day_map:
            day_map[d_str] = day_map.get(d_str, 0) + 1

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
