from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class ProgramCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    language: str = Field(..., min_length=1, max_length=50)
    code: str = Field(..., min_length=1)

class ProgramUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    language: Optional[str] = Field(None, min_length=1, max_length=50)
    code: Optional[str] = Field(None, min_length=1)

class ProgramResponse(BaseModel):
    program_id: str
    user_id: int
    name: str
    language: str
    code: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True
