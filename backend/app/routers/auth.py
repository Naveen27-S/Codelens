from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..schemas.user import UserCreate, UserResponse, UserUpdate, PasswordChange
from ..schemas.auth import UserLogin, Token
from ..core.database import get_db
from ..core.security import create_access_token, verify_password, get_password_hash
from ..services.auth_service import get_user_by_email, create_user, get_current_user
from ..models.user import User
from ..models.code_history import CodeHistory
from datetime import timedelta
from ..core.config import settings

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user: UserCreate, db: Session = Depends(get_db)):
    """Register a new user with email + password. Email must be unique."""
    # Check email uniqueness
    existing = get_user_by_email(db, email=user.email.strip().lower())
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered. Please sign in instead.",
        )
    return create_user(db=db, user=user)


@router.post("/login", response_model=Token)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """Authenticate with email + password. Returns a JWT access token."""
    user = get_user_by_email(db, email=user_data.email.strip().lower())
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    if not verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        # sub = email (unique identifier)
        data={"sub": user.email},
        expires_delta=access_token_expires,
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile. Never returns password_hash."""
    return current_user


@router.put("/me", response_model=UserResponse)
def update_profile(
    update_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the authenticated user's full_name and/or email."""
    if update_data.email:
        new_email = update_data.email.strip().lower()
        if new_email != current_user.email:
            # Check uniqueness of new email
            existing = get_user_by_email(db, email=new_email)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="That email address is already in use.",
                )
        current_user.email = new_email

    if update_data.full_name:
        current_user.full_name = update_data.full_name.strip()

    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    payload: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change the authenticated user's password after verifying the current one."""
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )
    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters.",
        )
    current_user.password_hash = get_password_hash(payload.new_password)
    db.commit()
    return {"message": "Password changed successfully."}


@router.delete("/me", status_code=status.HTTP_200_OK)
def delete_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete the authenticated user's account and all associated data."""
    # Delete related history first (cascade may handle this, but be explicit)
    db.query(CodeHistory).filter(CodeHistory.user_id == current_user.id).delete()
    db.delete(current_user)
    db.commit()
    return {"message": "Account deleted successfully."}

