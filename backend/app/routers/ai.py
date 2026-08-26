from fastapi import APIRouter, Depends, HTTPException
from ..schemas.ai import AIExplainRequest, AIDebugRequest, AIResponse, AIVisualizeRequest
from ..services.ai_service import explain_code, debug_code, visualize_code
from ..services.auth_service import get_current_user
from ..models.user import User

router = APIRouter()

@router.post("/explain", response_model=AIResponse)
def api_explain_code(
    req: AIExplainRequest,
    current_user: User = Depends(get_current_user)
):
    explanation = explain_code(req.language, req.code)
    return {"explanation": explanation}

@router.post("/debug", response_model=AIResponse)
def api_debug_code(
    req: AIDebugRequest,
    current_user: User = Depends(get_current_user)
):
    result = debug_code(req.language, req.code, req.error)
    return result

@router.post("/chat")
def api_chat(
    # Stub for future chat endpoint implementation 
    current_user: User = Depends(get_current_user)
):
    return {"message": "Chat feature not fully implemented"}

@router.post("/visualize")
def api_visualize_code(
    req: AIVisualizeRequest
):
    mermaid_code = visualize_code(req.language, req.code)
    # Re-using AIResponse schema since it's flexible, or we can just return a dict
    return {"explanation": mermaid_code}
