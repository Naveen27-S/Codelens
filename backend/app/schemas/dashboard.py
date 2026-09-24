from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Union
from datetime import datetime


class ActivityCreate(BaseModel):
    activity_type: str
    title: str
    description: Optional[str] = None
    program_name: Optional[str] = None
    language: Optional[str] = None
    topic: Optional[str] = None
    status: Optional[str] = "completed"
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    metadata_json: Optional[Dict[str, Any]] = None


class ActivityResponse(BaseModel):
    id: Union[int, str]
    user_id: int
    activity_type: str
    title: str
    description: Optional[str] = None
    program_name: Optional[str] = None
    language: Optional[str] = None
    topic: Optional[str] = None
    status: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        orm_mode = True


class ActivityListResponse(BaseModel):
    items: List[ActivityResponse]
    total: int
    page: int
    limit: int
    pages: int


class StreakResponse(BaseModel):
    current_streak: int
    longest_streak: int
    last_active_date: Optional[str] = None
    streak_message: str


class LearningTimeResponse(BaseModel):
    today_seconds: float
    week_seconds: float
    month_seconds: float
    today_formatted: str
    week_formatted: str
    month_formatted: str


class DayActivityItem(BaseModel):
    date: str
    day: str
    executions: int
    visualizations: int
    aiExplanations: int
    total: int


class DailyActivityResponse(BaseModel):
    days: List[DayActivityItem]
    total_week_activity: int


class DashboardStatsResponse(BaseModel):
    totalPrograms: int
    totalExecutions: int
    totalVisualizations: int
    learningHours: float
    programsTrend: int
    executionsTrend: int
    visualizationsTrend: int
    learningTrend: int


class RecentProgramResponse(BaseModel):
    id: Union[int, str]
    title: str
    language: str
    lastEdited: str
    sourceCode: Optional[str] = None


class RecentVisualizationResponse(BaseModel):
    id: Union[int, str]
    programName: str
    language: str
    steps: int
    status: str
    timestamp: str
    sourceCode: Optional[str] = None
    mermaidExplanation: Optional[str] = None


class LanguageProgressResponse(BaseModel):
    label: str
    percentage: int
    color: str


class RecommendationResponse(BaseModel):
    id: str
    topic: str
    difficulty: str
    problems: int
    icon: str


class CalendarDayItem(BaseModel):
    date: str   # ISO date string e.g. "2026-08-01"
    count: int  # total activities that day


class CalendarActivityResponse(BaseModel):
    days: List[CalendarDayItem]
    max_count: int  # used for intensity normalization in the UI
<<<<<<< Updated upstream
=======


# ── Dashboard History Schemas ──────────────────────────────────────────────────

class DashboardHistoryEventCreate(BaseModel):
    """Payload sent by the frontend to record a dashboard history event."""
    event_type: str             # dashboard_open | program_open | visualization_open | history_search | activity_filter | stat_view
    title: str
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class DashboardHistoryEventResponse(BaseModel):
    """A single dashboard history event returned by the API."""
    id: str                     # stringified MongoDB ObjectId
    user_id: int
    event_type: str
    title: str
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[str] = None   # ISO string


class DashboardHistoryListResponse(BaseModel):
    """Paginated list of dashboard history events."""
    items: List[DashboardHistoryEventResponse]
    total: int
    page: int
    limit: int
    pages: int


class DashboardHistoryStatsResponse(BaseModel):
    """Aggregate statistics for a user's dashboard history."""
    total: int
    today: int
    this_week: int
    this_month: int
    by_event_type: Dict[str, int]


class SessionTimeRequest(BaseModel):
    duration_seconds: float
    language: Optional[str] = None
    topic: Optional[str] = None
    activity_type: Optional[str] = "practice"
    title: Optional[str] = None
    description: Optional[str] = None

>>>>>>> Stashed changes
