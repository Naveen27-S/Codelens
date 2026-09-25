from datetime import datetime, timezone
from typing import Optional, Union, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from ..core.config import settings
from ..database.mongodb import get_mongodb
from ..schemas.auth import TokenData
from ..schemas.user import UserCreate
from ..core.security import get_password_hash

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


class MongoUser:
    """User entity wrapping a document from the MongoDB 'users' collection."""
    def __init__(self, doc: dict):
        self.id: Union[int, str] = doc.get("id") if doc.get("id") is not None else str(doc.get("_id", ""))
        self._id = doc.get("_id")
        self.email: str = doc.get("email", "")
        self.full_name: str = doc.get("full_name", "")
        self.username: Optional[str] = doc.get("username")
        self.password_hash: str = doc.get("password_hash", "")
        self.profile_image: Optional[str] = doc.get("profile_image")
        self.is_active: bool = doc.get("is_active", True)
        self.created_at: datetime = doc.get("created_at") or datetime.now(timezone.utc)
        self.updated_at: datetime = doc.get("updated_at") or datetime.now(timezone.utc)
        self.last_login: Optional[datetime] = doc.get("last_login")
        self.last_accessed_at: Optional[datetime] = doc.get("last_accessed_at")
        self.login_count: int = doc.get("login_count", 0)

    def __getitem__(self, item: str) -> Any:
        return getattr(self, item)

    def get(self, item: str, default: Any = None) -> Any:
        return getattr(self, item, default)


# Alias for backwards compatibility across existing route type annotations
User = MongoUser


def _get_next_user_id(coll) -> int:
    """Return the next unique auto-incrementing integer user id in MongoDB."""
    try:
        last = coll.find_one({"id": {"$type": "number"}}, sort=[("id", -1)])
        if last and "id" in last and isinstance(last["id"], (int, float)):
            return int(last["id"]) + 1
    except Exception:
        pass
    return 1


def get_user_by_email(email: str, db: Any = None) -> Optional[MongoUser]:
    """
    Retrieve user by email from MongoDB Atlas.
    (Optional db arg accepted for backward compatibility).
    """
    # If caller passed (db, email) due to legacy signature:
    if isinstance(email, str) and "@" in email:
        target_email = email
    elif isinstance(db, str) and "@" in db:
        target_email = db
    else:
        target_email = str(email)

    mongo_db = get_mongodb()
    if mongo_db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB Atlas connection unavailable.",
        )

    doc = mongo_db.users.find_one({"email": target_email.strip().lower()})
    if doc:
        return MongoUser(doc)
    return None


def get_user_by_id(user_id: Union[int, str]) -> Optional[MongoUser]:
    """Retrieve user by id from MongoDB Atlas."""
    mongo_db = get_mongodb()
    if mongo_db is None:
        return None

    query: dict = {"$or": [{"id": user_id}]}
    if isinstance(user_id, int):
        query["$or"].append({"id": str(user_id)})
    elif isinstance(user_id, str) and user_id.isdigit():
        query["$or"].append({"id": int(user_id)})

    doc = mongo_db.users.find_one(query)
    if doc:
        return MongoUser(doc)
    return None


def create_user(user: UserCreate, db: Any = None) -> MongoUser:
    """
    Create a new user document in MongoDB Atlas.
    Auto-generates a unique username and auto-incrementing integer id.
    """
    mongo_db = get_mongodb()
    if mongo_db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB Atlas connection unavailable.",
        )

    coll = mongo_db.users
    normalized_email = user.email.strip().lower()

    if coll.find_one({"email": normalized_email}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered. Please sign in instead.",
        )

    hashed_password = get_password_hash(user.password)
    base_username = normalized_email.split("@")[0][:50]
    username = base_username

    counter = 1
    while coll.find_one({"username": username}):
        username = f"{base_username}{counter}"
        counter += 1

    next_id = _get_next_user_id(coll)
    now = datetime.now(timezone.utc)

    user_doc = {
        "id": next_id,
        "username": username,
        "full_name": user.full_name.strip(),
        "email": normalized_email,
        "password_hash": hashed_password,
        "profile_image": None,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }

    result = coll.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    return MongoUser(user_doc)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Any = None,
) -> MongoUser:
    """
    Authenticate JWT bearer token and load user profile from MongoDB Atlas.
    (Optional db arg accepted for backward compatibility with existing route dependency graphs).
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception

    user = get_user_by_email(token_data.email)
    if user is None:
        raise credentials_exception
    return user
