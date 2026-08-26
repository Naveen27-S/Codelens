from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ExecutionRequest(BaseModel):
    language: str
    code: str
    input: Optional[str] = ""

class ExecutionResponse(BaseModel):
    status: str
    output: Optional[str] = None
    error: Optional[str] = None
    execution_time: Optional[float] = None
    
    class Config:
        from_attributes = True
