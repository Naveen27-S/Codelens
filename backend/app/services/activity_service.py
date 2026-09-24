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

def _user_query(user_id: Any) -> dict:
    """Query MongoDB for user_id matching both integer and string formats."""
    try:
        u_int = int(user_id)
        return {"$or": [{"user_id": u_int}, {"user_id": str(user_id)}]}
    except (ValueError, TypeError):
        return {"user_id": user_id}

def get_effective_duration(doc: dict) -> float:
    """Calculate realistic practice duration in seconds for an activity document."""
    raw = doc.get("duration_seconds")
    try:
        raw_float = float(raw) if raw is not None else 0.0
    except (ValueError, TypeError):
        raw_float = 0.0

    act_type = str(doc.get("activity_type") or "").lower()
    # Floor sub-second raw CPU runner times to realistic coding/practice session time (minimum 60s)
    if act_type in ("code_execution", "execution") and raw_float < 30.0:
        return 60.0
    if act_type in ("visualization_completed", "visualization") and raw_float < 30.0:
        return 60.0
    if act_type in ("practice", "practice_completed") and raw_float < 60.0:
        return 120.0
    if raw_float <= 0.0:
        return 60.0
    return raw_float

def format_duration(seconds: float) -> str:
    """Format seconds into user friendly 'Xh Ym' or 'Xm' string."""
    if not seconds or seconds <= 0:
        return "0m"
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    if hours > 0:
        return f"{hours}h {minutes}m"
    if minutes > 0:
        return f"{minutes}m"
    return "1m" if seconds > 0 else "0m"

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
    elif duration is None or (duration < 10.0 and data.activity_type in ("code_execution", "practice", "visualization_completed")):
        # Default nominal duration based on activity type if not provided or sub-second execution
        duration_map = {
            "code_execution": 60.0,
            "visualization_completed": 60.0,
            "ai_tutor": 180.0,
            "practice": 180.0,
            "program_saved": 30.0,
            "editor_open": 30.0,
        }
        duration = max(float(duration or 0), duration_map.get(data.activity_type, 60.0))

    completed_at = data.completed_at or (started + timedelta(seconds=float(duration)))
    if completed_at.tzinfo is None:
        completed_at = completed_at.replace(tzinfo=timezone.utc)

    # Normalize user_id to integer if possible
    try:
        norm_user_id = int(user_id)
    except (ValueError, TypeError):
        norm_user_id = user_id

    activity_doc = {
        "user_id": norm_user_id,
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

def record_session_time(
    user_id: int,
    duration_seconds: float,
    activity_type: str = "practice",
    language: Optional[str] = None,
    topic: Optional[str] = None,
    title: Optional[str] = None,
    description: Optional[str] = None,
    db: Session = None
) -> Dict[str, Any]:
    """Record active user platform / editor practice time."""
    now = datetime.now(timezone.utc)
    dur = max(1.0, float(duration_seconds))
    started = now - timedelta(seconds=dur)
    act_data = ActivityCreate(
        activity_type=activity_type,
        title=title or f"Active Practice Session ({format_duration(dur)})",
        description=description or f"Practiced in CodeLens {language or 'editor'} for {format_duration(dur)}.",
        language=language,
        topic=topic or "Practice",
        status="completed",
        started_at=started,
        completed_at=now,
        duration_seconds=dur,
        metadata_json={"session_type": "heartbeat", "platform": "codelens_web"}
    )
    return create_activity(user_id=user_id, data=act_data, db=db)

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
    
    query = dict(_user_query(user_id))

    # Activity type filter
    if activity_type and activity_type.lower() != "all":
        type_mapping = {
            "code_execution": ["code_execution", "execution"],
            "visualization": ["visualization_started", "visualization_completed", "visualization"],
            "ai_tutor": ["ai_tutor", "ai_explanation"],
            "practice": ["practice", "practice_completed", "code_execution", "execution", "visualization_completed", "visualization"],
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
    cursor = mongo_db.activities.find(_user_query(user_id)).sort([("started_at", -1), ("_id", -1)]).limit(limit)
    
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
    """Calculate user's current consecutive practice days and longest streak from MongoDB activities, executions, programs, and dashboard visits."""
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

    # 4. Dashboard & platform access events in MongoDB
    for doc in mongo_db.dashboard_history.find(user_q, {"created_at": 1}):
        d = parse_to_date(doc.get("created_at"))
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
    """Calculate accumulated learning and practice duration from MongoDB."""
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

    user_q = _user_query(user_id)

    def sum_duration(since_date: datetime) -> float:
        total = 0.0
        # Sum from activities collection
        query = {
            "$and": [
                user_q,
                {"$or": [
                    {"started_at": {"$gte": since_date}},
                    {"created_at": {"$gte": since_date}}
                ]}
            ]
        }
        for doc in mongo_db.activities.find(query):
            total += get_effective_duration(doc)
        
        # If no activities in range, also check executions
        if total == 0.0:
            exec_count = mongo_db.executions.count_documents({
                "$and": [
                    user_q,
                    {"created_at": {"$gte": since_date}}
                ]
            })
            total += float(exec_count * 60.0)

        return total

    today_sum = sum_duration(start_today)
    week_sum = sum_duration(start_week)
    month_sum = sum_duration(start_month)

    # Ensure cumulative consistency: month >= week >= today
    week_sum = max(week_sum, today_sum)
    month_sum = max(month_sum, week_sum)

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

    user_q = _user_query(user_id)

    for i in range(days - 1, -1, -1):
        target_date = (now - timedelta(days=i)).date()
        start_of_day = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=timezone.utc)
        end_of_day = start_of_day + timedelta(days=1)

        date_condition = {
            "$or": [
                {"started_at": {"$gte": start_of_day, "$lt": end_of_day}},
                {"created_at": {"$gte": start_of_day, "$lt": end_of_day}}
            ]
        }

        execs = mongo_db.activities.count_documents({
            "$and": [
                user_q,
                date_condition,
                {"activity_type": {"$in": ["code_execution", "execution", "practice"]}}
            ]
        })
        # Also check standalone executions
        direct_execs = mongo_db.executions.count_documents({
            "$and": [
                user_q,
                {"created_at": {"$gte": start_of_day, "$lt": end_of_day}}
            ]
        })
        total_day_execs = max(execs, direct_execs)

        vizs = mongo_db.activities.count_documents({
            "$and": [
                user_q,
                date_condition,
                {"activity_type": {"$in": ["visualization_started", "visualization_completed", "visualization"]}}
            ]
        })

        ais = mongo_db.activities.count_documents({
            "$and": [
                user_q,
                date_condition,
                {"activity_type": {"$in": ["ai_tutor", "ai_explanation"]}}
            ]
        })

        day_total = total_day_execs + vizs + ais
        total_week += day_total

        daily_items.append(
            DayActivityItem(
                date=target_date.isoformat(),
                day=day_names[target_date.weekday()],
                executions=total_day_execs,
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

    user_q = _user_query(user_id)

    # ── 1. Programs Saved (programs collection) ───────────────────────────────
    hist_count = mongo_db.programs.count_documents(user_q)

    # ── 2. Code Runs ─────────────────────────────────────────────────────────
    exec_count = mongo_db.activities.count_documents({
        "$and": [user_q, {"activity_type": {"$in": ["code_execution", "execution"]}}]
    })
    exec_direct = mongo_db.executions.count_documents(user_q)
    total_exec = max(exec_count, exec_direct)

    # ── 3. Visualizations ────────────────────────────────────────────────────
    viz_count = mongo_db.activities.count_documents({
        "$and": [user_q, {"activity_type": {"$in": ["visualization_started", "visualization_completed", "visualization"]}}]
    })

    # ── 4. Programs Practiced ────────────────────────────────────────────────
    practice_count = mongo_db.activities.count_documents({
        "$and": [user_q, {"activity_type": {"$in": ["practice", "practice_completed", "code_execution", "execution"]}}]
    })

    # ── 5. Learning Hours (sum of effective duration_seconds across all activities) ────
    total_seconds = 0.0
    for doc in mongo_db.activities.find(user_q):
        total_seconds += get_effective_duration(doc)
    if total_seconds == 0.0 and total_exec > 0:
        total_seconds = float(total_exec * 60.0)

    learning_hours = round(total_seconds / 3600.0, 1)

    # ── 6. Longest Streak & Day Streak ───────────────────────────────────────
    streak_info = get_streak_info(user_id=user_id, db=db)
    longest_streak = streak_info.longest_streak

    # ── 7. Week-over-week trend helper ────────────────────────────────────────
    def calc_trend(this_w: int, last_w: int) -> int:
        if last_w == 0:
            return 12 if this_w > 0 else 0
        return max(-99, min(999, int(((this_w - last_w) / last_w) * 100)))

    this_w_exec = mongo_db.activities.count_documents({
        "$and": [user_q, {"started_at": {"$gte": start_this_week}}, {"activity_type": {"$in": ["code_execution", "execution"]}}]
    })
    last_w_exec = mongo_db.activities.count_documents({
        "$and": [user_q, {"started_at": {"$gte": start_last_week, "$lt": start_this_week}}, {"activity_type": {"$in": ["code_execution", "execution"]}}]
    })
    this_w_viz = mongo_db.activities.count_documents({
        "$and": [user_q, {"started_at": {"$gte": start_this_week}}, {"activity_type": {"$in": ["visualization_started", "visualization_completed", "visualization"]}}]
    })
    last_w_viz = mongo_db.activities.count_documents({
        "$and": [user_q, {"started_at": {"$gte": start_last_week, "$lt": start_this_week}}, {"activity_type": {"$in": ["visualization_started", "visualization_completed", "visualization"]}}]
    })
    this_w_prog = mongo_db.programs.count_documents({
        "$and": [user_q, {"created_at": {"$gte": start_this_week}}]
    })
    last_w_prog = mongo_db.programs.count_documents({
        "$and": [user_q, {"created_at": {"$gte": start_last_week, "$lt": start_this_week}}]
    })
    this_w_prac = mongo_db.activities.count_documents({
        "$and": [user_q, {"started_at": {"$gte": start_this_week}}, {"activity_type": {"$in": ["practice", "practice_completed", "code_execution"]}}]
    })
    last_w_prac = mongo_db.activities.count_documents({
        "$and": [user_q, {"started_at": {"$gte": start_last_week, "$lt": start_this_week}}, {"activity_type": {"$in": ["practice", "practice_completed", "code_execution"]}}]
    })

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
        learningTrend=calc_trend(int(total_seconds), int(total_seconds * 0.8))
    )

def get_calendar_activity(user_id: int, days: int = 180, db: Session = None) -> CalendarActivityResponse:
    """Return per-day activity counts for the last N days (used for the heatmap calendar and mini calendar)."""
    mongo_db = get_mongodb()
    now = datetime.now(timezone.utc)

    if mongo_db is None:
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

    # 2. Also ensure any executions from mongo_db.executions are counted
    for doc in mongo_db.executions.find(user_q, {"created_at": 1}):
        d_str = extract_date(doc.get("created_at"))
        if d_str:
            day_map[d_str] = day_map.get(d_str, 0) + 1

    # 3. Also include saved programs from mongo_db.programs
    for doc in mongo_db.programs.find(user_q, {"created_at": 1, "updated_at": 1}):
        d_str = extract_date(doc.get("created_at")) or extract_date(doc.get("updated_at"))
        if d_str:
            day_map[d_str] = day_map.get(d_str, 0) + 1

    # 4. Also include dashboard visits and platform accesses from mongo_db.dashboard_history
    for doc in mongo_db.dashboard_history.find(user_q, {"created_at": 1}):
        d_str = extract_date(doc.get("created_at"))
        if d_str:
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
