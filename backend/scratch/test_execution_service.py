"""
Test the full execution_service.execute_code() function end-to-end.
Run from the backend/ directory:
    python scratch/test_execution_service.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load .env
from dotenv import load_dotenv  # noqa: F401
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from app.schemas.execution import ExecutionRequest
from app.services.execution_service import execute_code

print("=" * 60)
print("TEST: Full execute_code() call (Python hello world)")

req = ExecutionRequest(
    language="python",
    code='print("Hello from execute_code!")\n',
    input="",
    program_name="Smoke Test"
)

try:
    result = execute_code(exec_req=req, user_id=1)
    print("SUCCESS:", result)
except Exception as e:
    print("ERROR:", e)
    import traceback
    traceback.print_exc()
