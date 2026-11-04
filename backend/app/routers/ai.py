from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional
from ..schemas.ai import (
    AIExplainRequest, AIDebugRequest, AIResponse, AIVisualizeRequest,
    AIExplainErrorRequest, AIExplainCodeRequest, AIAnalyzeOutputRequest,
    AIDebugActionRequest, AICodeExplanationResponse
)
from ..services.ai_service import (
    explain_code, debug_code, visualize_code, verify_gemini_connection,
    explain_terminal_error, explain_code_deep, analyze_logic_output,
    record_debug_action, get_debug_stats
)
from jose import jwt as _jwt_lib
import os as _os

router = APIRouter()


def _get_optional_user_id(authorization: Optional[str] = Header(None)) -> Optional[int]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        token = authorization.split(" ", 1)[1]
        secret = _os.environ.get("SECRET_KEY", "codelens_secret_key_default")
        payload = _jwt_lib.decode(token, secret, algorithms=["HS256"])
        return payload.get("user_id") or payload.get("sub")
    except Exception:
        return None


@router.get("/verify-gemini")
@router.post("/verify-gemini")
def api_verify_gemini(
    x_gemini_api_key: Optional[str] = Header(None)
):
    """
    Test and verify Gemini AI connection status with current or provided key.
    """
    return verify_gemini_connection(api_key_override=x_gemini_api_key)


@router.post("/explain", response_model=AIResponse)
def api_explain_code(
    req: AIExplainRequest,
    x_gemini_api_key: Optional[str] = Header(None)
):
    explanation = explain_code(req.language, req.code, req.explanation_level or "intermediate")
    return {"explanation": explanation}


@router.post("/debug", response_model=AIResponse)
def api_debug_code(
    req: AIDebugRequest,
    x_gemini_api_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    user_id = _get_optional_user_id(authorization)
    result = debug_code(
        language=req.language,
        code=req.code,
        error=req.error or "",
        compiler_output=req.compiler_output,
        runtime_error=req.runtime_error,
        terminal_output=req.terminal_output,
        line_number=req.line_number,
        stdin=req.stdin,
        expected_output=req.expected_output,
        actual_output=req.actual_output,
        user_id=user_id,
        program_id=req.program_id,
        api_key_override=x_gemini_api_key,
    )
    return result


@router.post("/explain-error")
def api_explain_terminal_error(
    req: AIExplainErrorRequest,
    x_gemini_api_key: Optional[str] = Header(None)
):
    """
    Dedicated terminal error explainer. Called when user clicks 'Explain with AI'
    after execution failure. Returns beginner-friendly explanation with simple_example.
    """
    result = explain_terminal_error(
        language=req.language,
        code=req.code,
        error_message=req.error_message,
        line_number=req.line_number,
        terminal_output=req.terminal_output,
        api_key_override=x_gemini_api_key,
    )
    return result


@router.post("/explain-code")
def api_explain_code_deep(
    req: AIExplainCodeRequest,
    x_gemini_api_key: Optional[str] = Header(None)
):
    """
    Full code explanation endpoint. Returns structured breakdown:
    algorithm, variables, functions, complexity, step-by-step walkthrough.
    """
    result = explain_code_deep(
        language=req.language,
        code=req.code,
        selected_code=req.selected_code,
        explanation_level=req.explanation_level or "beginner",
        api_key_override=x_gemini_api_key,
    )
    return result


@router.post("/analyze-output")
def api_analyze_logic_output(
    req: AIAnalyzeOutputRequest,
    x_gemini_api_key: Optional[str] = Header(None)
):
    """
    Logic mismatch analyzer. Called when code runs successfully but output differs
    from expected. Returns detailed logical error diagnosis.
    """
    result = analyze_logic_output(
        language=req.language,
        code=req.code,
        stdin=req.stdin or "",
        expected_output=req.expected_output,
        actual_output=req.actual_output,
        api_key_override=x_gemini_api_key,
    )
    return result


@router.post("/debug-action")
def api_record_debug_action(
    req: AIDebugActionRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Record user's response to AI debug suggestion: applied / undone / copied / ignored.
    Updates MongoDB debug_sessions and logs activity for dashboard stats.
    """
    user_id = _get_optional_user_id(authorization)
    success = record_debug_action(
        debug_id=req.debug_id,
        action=req.action,
        user_id=user_id,
    )
    return {"success": success, "debug_id": req.debug_id, "action": req.action}


@router.get("/debug-stats")
def api_get_debug_stats(
    authorization: Optional[str] = Header(None)
):
    """
    Retrieve AI debugging metrics for dashboard cards.
    Returns total_sessions, errors_fixed, error type breakdowns, recent sessions.
    """
    user_id = _get_optional_user_id(authorization)
    stats = get_debug_stats(user_id=user_id)
    return stats


@router.post("/chat")
def api_chat():
    return {"message": "Chat feature not fully implemented"}


@router.post("/visualize")
def api_visualize_code(
    req: AIVisualizeRequest,
    x_gemini_api_key: Optional[str] = Header(None)
):
    mermaid_code = visualize_code(req.language, req.code, api_key_override=x_gemini_api_key)
    return {"explanation": mermaid_code}
