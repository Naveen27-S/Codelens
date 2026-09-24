from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import uuid
from datetime import datetime, timezone

from ..schemas.program import ProgramCreate, ProgramUpdate, ProgramResponse
from ..database.mongodb import get_mongodb
from ..services.auth_service import get_current_user
from ..models.user import User

router = APIRouter()


def _user_query(user_id: int | str) -> dict:
    """Match user_id whether stored as integer or string."""
    return {"$or": [{"user_id": user_id}, {"user_id": str(user_id)}]}


def _sanitize_program_doc(doc: dict) -> dict:
    """Ensure required fields for ProgramResponse are present."""
    if not doc:
        return doc
    doc["description"] = doc.get("description") or ""
    doc["output"] = doc.get("output") or ""
    doc["status"] = doc.get("status") or "completed"
    return doc


@router.post("", response_model=ProgramResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=ProgramResponse, status_code=status.HTTP_201_CREATED)
def create_program(
    req: ProgramCreate,
    current_user: User = Depends(get_current_user)
):
    mongo_db = get_mongodb()
    if mongo_db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB service unavailable. Unable to save program."
        )

    program_id = f"prog_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    lang_clean = req.language.strip().lower()
    # Normalize c++ aliases
    if lang_clean in ("cpp", "c++"):
        lang_clean = "cpp"
    elif lang_clean in ("py", "python"):
        lang_clean = "python"

    doc = {
        "program_id": program_id,
        "user_id": current_user.id,
        "name": req.name.strip(),
        "language": lang_clean,
        "code": req.code,
        "description": req.description or "",
        "output": req.output or "",
        "status": req.status or "completed",
        "created_at": now_iso,
        "updated_at": now_iso
    }

    mongo_db.programs.insert_one(doc)

    # Record program_saved activity in MongoDB activities collection
    try:
        from ..services.activity_service import create_activity
        from ..schemas.dashboard import ActivityCreate
        lang_display = "C++" if lang_clean == "cpp" else lang_clean.capitalize()
        create_activity(
            user_id=current_user.id,
            data=ActivityCreate(
                activity_type="program_saved",
                title=f"Saved {lang_display} Program",
                description=req.description or f'Saved program "{req.name}" to the programs library.',
                program_name=req.name,
                language=lang_clean,
                status=req.status or "completed",
                started_at=now,
                completed_at=now,
                duration_seconds=1.0,
                metadata_json={
                    "program_id": program_id,
                    "source_code": req.code,
                    "output": req.output or "",
                    "description": req.description or "",
                },
            )
        )
    except Exception:
        pass  # never block the save response

    return _sanitize_program_doc(doc)


@router.get("", response_model=List[ProgramResponse])
@router.get("/", response_model=List[ProgramResponse])
def list_programs(
    current_user: User = Depends(get_current_user)
):
    mongo_db = get_mongodb()
    if mongo_db is None:
        return []

    cursor = mongo_db.programs.find(_user_query(current_user.id)).sort("updated_at", -1)
    return [_sanitize_program_doc(p) for p in cursor]


@router.get("/{program_id}", response_model=ProgramResponse)
def get_program(
    program_id: str,
    current_user: User = Depends(get_current_user)
):
    mongo_db = get_mongodb()
    if mongo_db is None:
        raise HTTPException(status_code=503, detail="MongoDB service unavailable")

    query = {"program_id": program_id, **_user_query(current_user.id)}
    doc = mongo_db.programs.find_one(query)
    if not doc:
        raise HTTPException(status_code=404, detail="Program not found")
    return _sanitize_program_doc(doc)


@router.put("/{program_id}", response_model=ProgramResponse)
def update_program(
    program_id: str,
    req: ProgramUpdate,
    current_user: User = Depends(get_current_user)
):
    mongo_db = get_mongodb()
    if mongo_db is None:
        raise HTTPException(status_code=503, detail="MongoDB service unavailable")

    query = {"program_id": program_id, **_user_query(current_user.id)}
    doc = mongo_db.programs.find_one(query)
    if not doc:
        raise HTTPException(status_code=404, detail="Program not found")

    update_data = {}
    if req.name is not None:
        update_data["name"] = req.name.strip()
    if req.language is not None:
        l = req.language.strip().lower()
        if l in ("cpp", "c++"):
            l = "cpp"
        elif l in ("py", "python"):
            l = "python"
        update_data["language"] = l
    if req.code is not None:
        update_data["code"] = req.code
    if req.description is not None:
        update_data["description"] = req.description
    if req.output is not None:
        update_data["output"] = req.output
    if req.status is not None:
        update_data["status"] = req.status

    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        mongo_db.programs.update_one(query, {"$set": update_data})
        doc = mongo_db.programs.find_one(query)

    return _sanitize_program_doc(doc)


@router.delete("/{program_id}", status_code=status.HTTP_200_OK)
def delete_program(
    program_id: str,
    current_user: User = Depends(get_current_user)
):
    mongo_db = get_mongodb()
    if mongo_db is None:
        raise HTTPException(status_code=503, detail="MongoDB service unavailable")

    query = {"program_id": program_id, **_user_query(current_user.id)}
    res = mongo_db.programs.delete_one(query)
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Program not found")
    return {"status": "success", "message": "Program deleted successfully"}


@router.delete("", status_code=status.HTTP_200_OK)
@router.delete("/", status_code=status.HTTP_200_OK)
def clear_all_programs(
    current_user: User = Depends(get_current_user)
):
    """Delete all saved programs for the authenticated user from MongoDB Atlas."""
    mongo_db = get_mongodb()
    if mongo_db is None:
        raise HTTPException(status_code=503, detail="MongoDB service unavailable")

    res = mongo_db.programs.delete_many(_user_query(current_user.id))
    return {
        "status": "success",
        "message": f"Successfully deleted {res.deleted_count} saved program(s).",
        "deleted_count": res.deleted_count
    }


