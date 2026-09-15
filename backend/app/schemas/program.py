from pydantic import BaseModel, Field
from typing import Optional, Union
from datetime import datetime

class ProgramCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    language: str = Field(..., min_length=1, max_length=50)
    code: str = Field(..., min_length=1)
    description: Optional[str] = ""
    output: Optional[str] = ""
    status: Optional[str] = "completed"

class ProgramUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    language: Optional[str] = Field(None, min_length=1, max_length=50)
    code: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    output: Optional[str] = None
    status: Optional[str] = None

class ProgramResponse(BaseModel):
    program_id: str
    user_id: Union[int, str]
    name: str
    language: str
    code: str
    description: Optional[str] = ""
    output: Optional[str] = ""
    status: Optional[str] = "completed"
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True

