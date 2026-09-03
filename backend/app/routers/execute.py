import math
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional
from ..schemas.execution import (
    ExecutionRequest,
    ExecutionResponse,
    ExecutionHistoryItem,
    ExecutionListResponse,
    ExecutionStats,
)
from ..services.execution_service import execute_code
from ..services.auth_service import get_current_user
from ..models.user import User
from ..database.mongodb import get_mongodb

router = APIRouter()

@router.post("/execute", response_model=ExecutionResponse)
def execute_code_endpoint(
    exec_req: ExecutionRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Execute user-provided code in a secure sandbox.
    Saves the execution in MongoDB executions collection and logs activity.
    Requires authentication.
    """
    return execute_code(exec_req=exec_req, user_id=current_user.id)

@router.get("/executions", response_model=ExecutionListResponse)
def get_executions(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    status: Optional[str] = Query(None, description="Filter by status (e.g. success, runtime_error, compilation_error, timeout)"),
    language: Optional[str] = Query(None, description="Filter by language"),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve paginated code execution records and execution statistics for the authenticated user.
    Sorted newest first.
    """
    mongo_db = get_mongodb()
    
    query = {"user_id": current_user.id}
    if status:
        query["status"] = status.lower().strip()
    if language:
        query["language"] = language.lower().strip()

    total_count = mongo_db.executions.count_documents(query)
    
    # Calculate user's overall execution stats
    user_total = mongo_db.executions.count_documents({"user_id": current_user.id})
    user_success = mongo_db.executions.count_documents({"user_id": current_user.id, "status": "success"})
    user_failed = user_total - user_success

    skip = (page - 1) * limit
    cursor = mongo_db.executions.find(query).sort("created_at", -1).skip(skip).limit(limit)
    
    items = []
    for doc in cursor:
        items.append({
            "execution_id": doc["execution_id"],
            "user_id": doc["user_id"],
            "program_id": doc.get("program_id"),
            "program_name": doc.get("program_name") or f"{doc.get('language', 'Code').capitalize()} Program",
            "language": doc["language"],
            "code": doc.get("code", ""),
            "input": doc.get("input", ""),
            "status": doc["status"],
            "stdout": doc.get("stdout", ""),
            "stderr": doc.get("stderr", ""),
            "execution_time": doc.get("execution_time", 0.0),
            "memory_used": doc.get("memory_used"),
            "created_at": doc.get("created_at", "")
        })

    pages = math.ceil(total_count / limit) if total_count > 0 else 1

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "limit": limit,
        "pages": pages,
        "stats": {
            "total": user_total,
            "successful": user_success,
            "failed": user_failed
        }
    }

@router.get("/executions/{execution_id}", response_model=ExecutionHistoryItem)
def get_execution_detail(
    execution_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve full details of a specific code execution record.
    Checks that the record belongs to the authenticated user.
    """
    mongo_db = get_mongodb()
    doc = mongo_db.executions.find_one({"execution_id": execution_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Execution record not found")
    if doc["user_id"] != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        
    return {
        "execution_id": doc["execution_id"],
        "user_id": doc["user_id"],
        "program_id": doc.get("program_id"),
        "program_name": doc.get("program_name") or f"{doc.get('language', 'Code').capitalize()} Program",
        "language": doc["language"],
        "code": doc.get("code", ""),
        "input": doc.get("input", ""),
        "status": doc["status"],
        "stdout": doc.get("stdout", ""),
        "stderr": doc.get("stderr", ""),
        "execution_time": doc.get("execution_time", 0.0),
        "memory_used": doc.get("memory_used"),
        "created_at": doc.get("created_at", "")
    }

@router.delete("/executions/{execution_id}")
def delete_execution(
    execution_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Delete a specific execution record owned by the authenticated user.
    """
    mongo_db = get_mongodb()
    doc = mongo_db.executions.find_one({"execution_id": execution_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Execution record not found")
    if doc["user_id"] != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        
    mongo_db.executions.delete_one({"execution_id": execution_id})
    return {"message": "Execution record deleted successfully", "execution_id": execution_id}
