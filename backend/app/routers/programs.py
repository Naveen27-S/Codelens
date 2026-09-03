from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import uuid
from datetime import datetime, timezone

from ..schemas.program import ProgramCreate, ProgramUpdate, ProgramResponse
from ..database.mongodb import get_mongodb
from ..services.auth_service import get_current_user
from ..models.user import User

router = APIRouter()

@router.post("/", response_model=ProgramResponse, status_code=status.HTTP_201_CREATED)
def create_program(
    req: ProgramCreate,
    current_user: User = Depends(get_current_user)
):
    mongo_db = get_mongodb()
    program_id = f"prog_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    
    doc = {
        "program_id": program_id,
        "user_id": current_user.id,
        "name": req.name,
        "language": req.language,
        "code": req.code,
        "created_at": now,
        "updated_at": now
    }
    
    mongo_db.programs.insert_one(doc)
    return doc

@router.get("/", response_model=List[ProgramResponse])
def list_programs(
    current_user: User = Depends(get_current_user)
):
    mongo_db = get_mongodb()
    cursor = mongo_db.programs.find({"user_id": current_user.id})
    return list(cursor)

@router.get("/{program_id}", response_model=ProgramResponse)
def get_program(
    program_id: str,
    current_user: User = Depends(get_current_user)
):
    mongo_db = get_mongodb()
    doc = mongo_db.programs.find_one({"program_id": program_id, "user_id": current_user.id})
    if not doc:
        raise HTTPException(status_code=404, detail="Program not found")
    return doc

@router.put("/{program_id}", response_model=ProgramResponse)
def update_program(
    program_id: str,
    req: ProgramUpdate,
    current_user: User = Depends(get_current_user)
):
    mongo_db = get_mongodb()
    doc = mongo_db.programs.find_one({"program_id": program_id, "user_id": current_user.id})
    if not doc:
        raise HTTPException(status_code=404, detail="Program not found")
        
    update_data = {}
    if req.name is not None:
        update_data["name"] = req.name
    if req.language is not None:
        update_data["language"] = req.language
    if req.code is not None:
        update_data["code"] = req.code
        
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        mongo_db.programs.update_one(
            {"program_id": program_id, "user_id": current_user.id},
            {"$set": update_data}
        )
        # Fetch updated doc
        doc = mongo_db.programs.find_one({"program_id": program_id, "user_id": current_user.id})
        
    return doc

@router.delete("/{program_id}", status_code=status.HTTP_200_OK)
def delete_program(
    program_id: str,
    current_user: User = Depends(get_current_user)
):
    mongo_db = get_mongodb()
    res = mongo_db.programs.delete_one({"program_id": program_id, "user_id": current_user.id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Program not found")
    return {"status": "success", "message": "Program deleted successfully"}
