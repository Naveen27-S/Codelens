from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, Union


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str
    confirm_password: Optional[str] = None


class AccountDeleteRequest(BaseModel):
    password: Optional[str] = None


class UserResponse(BaseModel):
    id: Union[int, str]
    full_name: str
    email: str
    username: Optional[str] = None
    created_at: datetime
    last_login: Optional[datetime] = None
    last_accessed_at: Optional[datetime] = None
    login_count: Optional[int] = 0

    class Config:
        from_attributes = True
