from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..schemas.history import HistoryCreate, HistoryResponse, HistoryUpdate
from ..core.database import get_db
from ..services.auth_service import get_current_user
from ..models.user import User
from ..models.code_history import CodeHistory

router = APIRouter()

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
    db.add(db_history)
    db.commit()
    db.refresh(db_history)
    return db_history

@router.get("/", response_model=List[HistoryResponse])
def get_histories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(CodeHistory).filter(CodeHistory.user_id == current_user.id).all()

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
