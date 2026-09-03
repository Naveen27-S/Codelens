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
