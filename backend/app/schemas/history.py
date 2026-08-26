from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class HistoryBase(BaseModel):
    title: str
    language: str
    source_code: str
    description: Optional[str] = None

class HistoryCreate(HistoryBase):
    pass

class HistoryUpdate(BaseModel):
    title: Optional[str] = None
    language: Optional[str] = None
    source_code: Optional[str] = None
    description: Optional[str] = None

class HistoryResponse(HistoryBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
