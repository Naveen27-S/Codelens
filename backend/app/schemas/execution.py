from pydantic import BaseModel, Field, field_validator
from typing import Optional, List

# Configuration limits
MAX_CODE_SIZE = 262144  # 256 KB
MAX_INPUT_SIZE = 65536  # 64 KB
SUPPORTED_LANGUAGES = {"python", "java", "c", "cpp"}

class ExecutionRequest(BaseModel):
    language: str
    code: str
    input: Optional[str] = ""
    program_id: Optional[str] = None
    program_name: Optional[str] = None

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        lang = value.lower().strip()
        if lang not in SUPPORTED_LANGUAGES:
            raise ValueError(f"Unsupported language: {value}. Supported: {', '.join(SUPPORTED_LANGUAGES)}")
        return lang

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Source code cannot be empty")
        if len(value) > MAX_CODE_SIZE:
            raise ValueError(f"Source code size exceeds maximum limit of {MAX_CODE_SIZE // 1024} KB")
        return value

    @field_validator("input")
    @classmethod
    def validate_input(cls, value: Optional[str]) -> str:
        val = value or ""
        if len(val) > MAX_INPUT_SIZE:
            raise ValueError(f"Input size exceeds maximum limit of {MAX_INPUT_SIZE // 1024} KB")
        return val

class ExecutionResponse(BaseModel):
    execution_id: str
    status: str
    language: str
    stdout: str
    stderr: str
    execution_time: float
    exit_code: Optional[int] = None
    memory_used: Optional[float] = None
    program_name: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True

class ExecutionHistoryItem(BaseModel):
    execution_id: str
    user_id: int
    program_id: Optional[str] = None
    program_name: Optional[str] = None
    language: str
    code: str
    input: Optional[str] = ""
    status: str
    stdout: str
    stderr: str
    execution_time: float
    memory_used: Optional[float] = None
    created_at: str

    class Config:
        from_attributes = True

class ExecutionStats(BaseModel):
    total: int
    successful: int
    failed: int

class ExecutionListResponse(BaseModel):
    items: List[ExecutionHistoryItem]
    total: int
    page: int
    limit: int
    pages: int
    stats: ExecutionStats
