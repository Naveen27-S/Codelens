import uuid
import logging
from datetime import datetime, timezone
from ..database.mongodb import get_mongodb
from ..schemas.execution import ExecutionRequest
from .sandbox_service import SandboxFactory
from .activity_service import create_activity
from ..schemas.dashboard import ActivityCreate

logger = logging.getLogger(__name__)


def execute_code(exec_req: ExecutionRequest, user_id: int):
    language = exec_req.language.lower().strip()
    code = exec_req.code
    input_data = exec_req.input or ""
    program_id = exec_req.program_id
    program_name = exec_req.program_name or f"{language.capitalize()} Program"

    # Generate a unique execution ID
    execution_id = f"exec_{uuid.uuid4().hex[:12]}"

    # 5 seconds default timeout as per spec
    timeout = 5.0

    # Execute code via sandbox — this must always succeed
    sandbox = SandboxFactory.get_sandbox()
    sandbox_result = sandbox.execute(
        language=language,
        code=code,
        input_data=input_data,
        timeout=timeout
    )

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    # Build the response payload (always returned, even if DB fails)
    response_payload = {
        "execution_id": execution_id,
        "status": sandbox_result.status,
        "language": language,
        "stdout": sandbox_result.stdout,
        "stderr": sandbox_result.stderr,
        "execution_time": round(sandbox_result.execution_time, 3),
        "exit_code": sandbox_result.exit_code,
        "memory_used": sandbox_result.memory_used,
        "program_name": program_name,
        "created_at": now_iso
    }

    # ── MongoDB persistence ────────────────────────────────────────────────
    # IMPORTANT: MongoDB failure must NEVER prevent the result from being returned.
    exec_record = {
        "execution_id": execution_id,
        "user_id": user_id,
        "program_id": program_id,
        "program_name": program_name,
        "language": language,
        "code": code,
        "input": input_data,
        "status": sandbox_result.status,
        "stdout": sandbox_result.stdout,
        "stderr": sandbox_result.stderr,
        "execution_time": round(sandbox_result.execution_time, 3),
        "exit_code": sandbox_result.exit_code,
        "memory_used": sandbox_result.memory_used,
        "created_at": now_iso
    }

    try:
        mongo_db = get_mongodb()
        if mongo_db is not None:
            mongo_db.executions.insert_one(exec_record)
        else:
            logger.warning("MongoDB unavailable — execution record not saved (execution_id=%s)", execution_id)
    except Exception as db_err:
        logger.error("MongoDB insert failed for execution_id=%s: %s", execution_id, db_err)

    # ── Activity logging ───────────────────────────────────────────────────
    try:
        activity_status = "completed"
        if sandbox_result.status in ["compilation_error", "runtime_error", "timeout", "memory_limit", "execution_error"]:
            activity_status = "error"

        activity_title = f"{program_name} Executed" if program_name else f"{language.capitalize()} Program Executed"
        activity_desc = f"Executed {language} code snippet ({sandbox_result.status})."

        activity_data = ActivityCreate(
            activity_type="code_execution",
            title=activity_title,
            description=activity_desc,
            program_name=program_name,
            language=language,
            topic=None,
            status=activity_status,
            started_at=now,
            completed_at=now,
            duration_seconds=sandbox_result.execution_time,
            metadata_json={
                "execution_id": execution_id,
                "status": sandbox_result.status,
                "program_id": program_id,
                "source_code": code,
                "input": input_data
            }
        )
        create_activity(user_id=user_id, data=activity_data)
    except Exception as act_err:
        logger.error("Activity logging failed for execution_id=%s: %s", execution_id, act_err)

    return response_payload
