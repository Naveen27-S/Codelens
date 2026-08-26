from pydantic import BaseModel
from typing import Optional

class AIExplainRequest(BaseModel):
    language: str
    code: str

class AIVisualizeRequest(BaseModel):
    language: str
    code: str

class AIDebugRequest(BaseModel):
    language: str
    code: str
    error: str

class AIResponse(BaseModel):
    explanation: Optional[str] = None
    problem: Optional[str] = None
    solution: Optional[str] = None
    corrected_code: Optional[str] = None
