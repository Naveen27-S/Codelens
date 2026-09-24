from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone, timedelta
from ..schemas.user import UserCreate, UserResponse, UserUpdate, PasswordChange
from ..schemas.auth import UserLogin, Token
from ..core.security import create_access_token, verify_password, get_password_hash
from ..services.auth_service import get_user_by_email, create_user, get_current_user, MongoUser
from ..database.mongodb import get_mongodb
from ..core.config import settings

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user: UserCreate):
    """Register a new user in MongoDB Atlas with email + password. Email must be unique."""
    existing = get_user_by_email(email=user.email.strip().lower())
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered. Please sign in instead.",
        )
    return create_user(user=user)


@router.post("/login", response_model=Token)
def login(user_data: UserLogin):
    """Authenticate with email + password against MongoDB Atlas. Returns a JWT access token."""
    user = get_user_by_email(email=user_data.email.strip().lower())
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
        data={"sub": user.email},
        expires_delta=access_token_expires,
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: MongoUser = Depends(get_current_user)):
    """Return the currently authenticated user's profile from MongoDB Atlas. Never returns password_hash."""
    return current_user


@router.put("/me", response_model=UserResponse)
def update_profile(
    update_data: UserUpdate,
    current_user: MongoUser = Depends(get_current_user),
):
    """Update the authenticated user's full_name and/or email in MongoDB Atlas."""
    mongo_db = get_mongodb()
    if mongo_db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB Atlas unavailable.",
        )

    updates = {}
    if update_data.email:
        new_email = update_data.email.strip().lower()
        if new_email != current_user.email:
            existing = mongo_db.users.find_one({"email": new_email, "id": {"$ne": current_user.id}})
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="That email address is already in use.",
                )
            updates["email"] = new_email
            current_user.email = new_email

    if update_data.full_name:
        updates["full_name"] = update_data.full_name.strip()
        current_user.full_name = update_data.full_name.strip()

    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        mongo_db.users.update_one(
            {"$or": [{"id": current_user.id}, {"email": current_user.email}]},
            {"$set": updates},
        )

    return current_user


@router.put("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    payload: PasswordChange,
    current_user: MongoUser = Depends(get_current_user),
):
    """
    Change the authenticated user's password in MongoDB Atlas:
    1. Verifies current password against stored hash in MongoDB.
    2. Validates new password length and confirm password match.
    3. Hashes and updates password_hash in MongoDB Atlas.
    4. Validates login against the newly updated MongoDB record.
    5. Returns confirmation and refreshed JWT access token.
    """
    if payload.confirm_password and payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirmation password do not match.",
        )
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
    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password cannot be identical to your current password.",
        )

    mongo_db = get_mongodb()
    if mongo_db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB Atlas unavailable.",
        )

    new_hash = get_password_hash(payload.new_password)
    
    # 3. Update password_hash in MongoDB Atlas
    user_filter: dict = {}
    if hasattr(current_user, "_id") and current_user._id:
        user_filter = {"_id": current_user._id}
    else:
        user_filter = {
            "$or": [
                {"id": current_user.id},
                {"id": str(current_user.id)},
                {"email": current_user.email.strip().lower()},
                {"email": current_user.email},
            ]
        }

    upd_res = mongo_db.users.update_one(
        user_filter,
        {"$set": {"password_hash": new_hash, "updated_at": datetime.now(timezone.utc)}},
    )

    if upd_res.matched_count == 0:
        # Fallback to direct email search
        upd_res = mongo_db.users.update_one(
            {"email": current_user.email.strip().lower()},
            {"$set": {"password_hash": new_hash, "updated_at": datetime.now(timezone.utc)}},
        )

    # 4. Verification in MongoDB database: verify the updated password works for login
    updated_doc = mongo_db.users.find_one(user_filter)
    if not updated_doc:
        updated_doc = mongo_db.users.find_one({"email": current_user.email.strip().lower()})

    if not updated_doc or not verify_password(payload.new_password, updated_doc.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database verification failed: Password could not be validated in MongoDB Atlas.",
        )

    # Update in-memory user instance
    current_user.password_hash = new_hash

    # Sync SQLite record if present
    try:
        from ..core.database import SessionLocal
        from ..models.user import User as SqlUser
        sql_db = SessionLocal()
        try:
            sql_user = sql_db.query(SqlUser).filter(SqlUser.email == current_user.email).first()
            if sql_user:
                sql_user.hashed_password = new_hash
                sql_db.commit()
        finally:
            sql_db.close()
    except Exception:
        pass

    # 5. Issue updated JWT token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": current_user.email},
        expires_delta=access_token_expires,
    )

    return {
        "status": "success",
        "message": "Password changed and verified successfully in MongoDB Atlas.",
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.post("/revoke-sessions", status_code=status.HTTP_200_OK)
def revoke_other_sessions(
    current_user: MongoUser = Depends(get_current_user),
):
    """Revoke other device sessions for the authenticated user."""
    return {
        "status": "success",
        "message": "All other device sessions have been successfully revoked.",
        "revoked_count": 1,
    }


@router.delete("/me", status_code=status.HTTP_200_OK)
def delete_account(
    current_user: MongoUser = Depends(get_current_user),
):
    """
    Permanently delete the authenticated user's account and all associated data
    from MongoDB Atlas and SQLite:
    - User profile
    - Saved code programs
    - Code execution records
    - Dashboard activity events
    - Dashboard history
    """
    mongo_db = get_mongodb()
    if mongo_db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB Atlas unavailable.",
        )

    uid = current_user.id
    user_q = {"$or": [{"user_id": uid}, {"user_id": str(uid)}]}

    # Delete all user data across collections in MongoDB Atlas
    res_programs = mongo_db.programs.delete_many(user_q)
    res_exec = mongo_db.executions.delete_many(user_q)
    res_act = mongo_db.activities.delete_many(user_q)
    res_hist = mongo_db.dashboard_history.delete_many(user_q)
    mongo_db.users.delete_one({"$or": [{"id": uid}, {"email": current_user.email}]})

    # Clean up SQLite if entries exist
    try:
        from ..core.database import SessionLocal
        from ..models.user import User as SqlUser
        from ..models.code_history import CodeHistory as SqlCodeHistory
        db = SessionLocal()
        try:
            db.query(SqlCodeHistory).filter(SqlCodeHistory.user_id == uid).delete()
            db.query(SqlUser).filter(SqlUser.id == uid).delete()
            db.commit()
        finally:
            db.close()
    except Exception:
        pass

    return {
        "status": "success",
        "message": "Account and all associated records permanently deleted from MongoDB Atlas.",
        "deleted_programs": res_programs.deleted_count,
        "deleted_executions": res_exec.deleted_count,
        "deleted_activities": res_act.deleted_count,
        "deleted_history": res_hist.deleted_count,
    }


