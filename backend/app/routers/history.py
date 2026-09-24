from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional, Any, Dict
from ..schemas.history import HistoryCreate, HistoryResponse, HistoryUpdate
from ..core.database import get_db
from ..services.auth_service import get_current_user
from ..models.user import User
from ..models.code_history import CodeHistory
from ..database.mongodb import get_mongodb

router = APIRouter()


def _user_query(user_id: int | str) -> dict:
    return {"$or": [{"user_id": user_id}, {"user_id": str(user_id)}]}


@router.post("/", response_model=HistoryResponse)
def create_history(
    history: HistoryCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_history = CodeHistory(
        user_id=current_user.id,
        title=history.title,
        language=history.language,
        source_code=history.source_code,
        description=history.description
    )
    try:
        db.add(db_history)
        db.commit()
        db.refresh(db_history)
    except Exception:
        pass
    return db_history


@router.get("/summary")
@router.get("/all")
def get_history_summary(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Return comprehensive CodeLens data history for the authenticated user,
    including saved programs, execution logs, and aggregate statistics.
    """
    mongo_db = get_mongodb()
    if mongo_db is None:
        return {
            "saved_programs": [],
            "executions": [],
            "stats": {
                "total_programs": 0,
                "total_executions": 0,
                "successful_executions": 0,
                "failed_executions": 0
            }
        }

    user_q = _user_query(current_user.id)

    # 1. Fetch saved programs
    programs_cursor = mongo_db.programs.find(user_q).sort("updated_at", -1)
    saved_programs = []
    for doc in programs_cursor:
        saved_programs.append({
            "program_id": doc.get("program_id", ""),
            "name": doc.get("name", "Untitled"),
            "language": doc.get("language", "python"),
            "code": doc.get("code", ""),
            "description": doc.get("description", ""),
            "output": doc.get("output", ""),
            "status": doc.get("status", "completed"),
            "created_at": doc.get("created_at", ""),
            "updated_at": doc.get("updated_at", "")
        })

    # 2. Fetch past executions
    exec_q = {"user_id": current_user.id}
    exec_cursor = mongo_db.executions.find(exec_q).sort("created_at", -1).limit(100)
    executions = []
    for doc in exec_cursor:
        executions.append({
            "execution_id": doc.get("execution_id", ""),
            "program_name": doc.get("program_name") or f"{doc.get('language', 'Code').capitalize()} Program",
            "language": doc.get("language", ""),
            "code": doc.get("code", ""),
            "input": doc.get("input", ""),
            "status": doc.get("status", "success"),
            "stdout": doc.get("stdout", ""),
            "stderr": doc.get("stderr", ""),
            "execution_time": doc.get("execution_time", 0.0),
            "created_at": doc.get("created_at", "")
        })

    # 3. Aggregate Stats
    total_exec = mongo_db.executions.count_documents(exec_q)
    success_exec = mongo_db.executions.count_documents({"user_id": current_user.id, "status": "success"})
    failed_exec = total_exec - success_exec

    return {
        "saved_programs": saved_programs,
        "executions": executions,
        "stats": {
            "total_programs": len(saved_programs),
            "total_executions": total_exec,
            "successful_executions": success_exec,
            "failed_executions": failed_exec
        }
    }


@router.delete("", status_code=status.HTTP_200_OK)
@router.delete("/", status_code=status.HTTP_200_OK)
def clear_all_history(
    clear_code: bool = Query(True, description="Delete all saved code snippets"),
    clear_executions: bool = Query(True, description="Delete all execution records"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Remove all saved code history and execution records for the authenticated user
    from MongoDB Atlas and SQLite.
    """
    mongo_db = get_mongodb()
    deleted_programs = 0
    deleted_executions = 0

    if mongo_db is not None:
        user_q = _user_query(current_user.id)
        if clear_code:
            res_p = mongo_db.programs.delete_many(user_q)
            deleted_programs = res_p.deleted_count
        if clear_executions:
            res_e = mongo_db.executions.delete_many({"user_id": current_user.id})
            deleted_executions = res_e.deleted_count
            try:
                mongo_db.dashboard_history.delete_many({"user_id": current_user.id})
            except Exception:
                pass

    # Clear SQLite CodeHistory if present
    if clear_code:
        try:
            db.query(CodeHistory).filter(CodeHistory.user_id == current_user.id).delete()
            db.commit()
        except Exception:
            pass

    return {
        "status": "success",
        "message": f"Successfully deleted {deleted_programs} saved code snippet(s) and {deleted_executions} execution record(s).",
        "deleted_programs": deleted_programs,
        "deleted_executions": deleted_executions
    }


@router.get("/", response_model=List[HistoryResponse])
def get_histories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return db.query(CodeHistory).filter(CodeHistory.user_id == current_user.id).all()
    except Exception:
        return []


@router.get("/{history_id}", response_model=HistoryResponse)
def get_history(
    history_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    history = db.query(CodeHistory).filter(CodeHistory.id == history_id, CodeHistory.user_id == current_user.id).first()
    if not history:
        raise HTTPException(status_code=404, detail="History not found")
    return history


@router.put("/{history_id}", response_model=HistoryResponse)
def update_history(
    history_id: int, 
    history_update: HistoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    history = db.query(CodeHistory).filter(CodeHistory.id == history_id, CodeHistory.user_id == current_user.id).first()
    if not history:
        raise HTTPException(status_code=404, detail="History not found")
    
    update_data = history_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(history, key, value)
        
    db.commit()
    db.refresh(history)
    return history


@router.delete("/{history_id}")
def delete_history(
    history_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    history = db.query(CodeHistory).filter(CodeHistory.id == history_id, CodeHistory.user_id == current_user.id).first()
    if not history:
        raise HTTPException(status_code=404, detail="History not found")
    
    db.delete(history)
    db.commit()
    return {"status": "success"}

