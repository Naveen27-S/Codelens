from .auth import Token, TokenData, UserLogin
from .user import UserCreate, UserResponse
from .execution import ExecutionRequest, ExecutionResponse
from .history import HistoryCreate, HistoryResponse, HistoryUpdate
from .ai import AIExplainRequest, AIDebugRequest, AIResponse
from .dashboard import (
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
