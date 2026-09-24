"""
test_pipeline.py
----------------
Self-contained pytest suite for the CodeLens backend execution pipeline.

Covers:
  1. C hello-world — compile + run (verifies MinGW path fix works)
  2. C++ hello-world — compile + run
  3. Python hello-world — interpret + run
  4. Java hello-world — compile + run
  5. AI / rule-based error explanation — intentional Python SyntaxError
  6. AI / rule-based error explanation — intentional C undefined reference

Run from the backend directory:
    .venv\\Scripts\\pytest scratch\\test_pipeline.py -v
"""

import sys
import os

# Allow imports from the backend package without a full install
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from app.services.sandbox_service import LocalSandbox
from app.services.ai_service import get_rule_based_explanation, debug_code


SANDBOX = LocalSandbox()


# ── Helpers ──────────────────────────────────────────────────────────────

def run(language: str, code: str, stdin: str = "") -> object:
    """Execute code and return the ExecutionResult."""
    return SANDBOX.execute(language=language, code=code, input_data=stdin, timeout=10.0)


# ── Hello-world compilation tests ────────────────────────────────────────

def test_c_hello_world():
    code = r"""
#include <stdio.h>
int main(void) {
    printf("Hello, C!\n");
    return 0;
}
"""
    result = run("c", code)
    assert result.status == "success", (
        f"C compilation/run failed.\nstderr: {result.stderr}"
    )
    assert "Hello, C!" in result.stdout


def test_cpp_hello_world():
    code = r"""
#include <iostream>
int main() {
    std::cout << "Hello, C++!" << std::endl;
    return 0;
}
"""
    result = run("cpp", code)
    assert result.status == "success", (
        f"C++ compilation/run failed.\nstderr: {result.stderr}"
    )
    assert "Hello, C++!" in result.stdout


def test_python_hello_world():
    code = 'print("Hello, Python!")\n'
    result = run("python", code)
    assert result.status == "success", (
        f"Python run failed.\nstderr: {result.stderr}"
    )
    assert "Hello, Python!" in result.stdout


def test_java_hello_world():
    code = """
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Java!");
    }
}
"""
    result = run("java", code)
    assert result.status == "success", (
        f"Java compilation/run failed.\nstderr: {result.stderr}"
    )
    assert "Hello, Java!" in result.stdout


# ── Error explanation tests ───────────────────────────────────────────────

def test_rule_based_python_syntax_error():
    """Rule-based explainer must identify Python SyntaxError."""
    error = "SyntaxError: invalid syntax"
    code = "def foo(n)\n    return n"
    result = get_rule_based_explanation("python", code, error)
    assert isinstance(result, dict)
    assert "problem" in result and result["problem"]
    assert "explanation" in result and result["explanation"]
    assert "solution" in result and result["solution"]
    # Should match the SyntaxError rule
    assert "syntax" in result["problem"].lower() or "syntax" in result["explanation"].lower()


def test_rule_based_c_undefined_reference():
    """Rule-based explainer must identify C linker / undefined reference."""
    error = "undefined reference to `my_function'"
    code = "int main() { my_function(); return 0; }"
    result = get_rule_based_explanation("c", code, error)
    assert isinstance(result, dict)
    assert "problem" in result and result["problem"]
    assert "undefined" in result["problem"].lower() or "linker" in result["problem"].lower()


def test_debug_code_returns_dict_on_broken_python():
    """
    debug_code() must always return a valid dict even when Gemini is
    unavailable (falls back to rule-based explainer).
    """
    broken_code = "def fib(n)\n    return n"
    error = "SyntaxError: invalid syntax"
    result = debug_code("python", broken_code, error)
    assert isinstance(result, dict)
    required_keys = {"problem", "explanation", "solution", "corrected_code"}
    assert required_keys.issubset(result.keys()), (
        f"Missing keys in debug_code result: {required_keys - result.keys()}"
    )


def test_no_hardcoded_machine_paths():
    """
    Ensure no machine-specific absolute paths leak into sandbox_service source.
    Reads the source file and checks for patterns that should never be present.
    """
    service_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "app", "services", "sandbox_service.py"
    )
    with open(service_path, encoding="utf-8") as f:
        source = f.read()

    forbidden_patterns = [
        r"C:\\Users\\",   # any absolute Windows user path
        "BRECHT~1",       # old hardcoded WinLibs short path
        "MICROS~1",       # old hardcoded path segment
    ]
    # Note: "NAVEEN~1" patterns are legitimately absent; we exclude generic
    # "NAVEEN" since it could appear in dynamically-generated error messages
    # during import. We check for the hardcoded SHORT paths that were the bug.
    for pattern in forbidden_patterns:
        occurrences = [
            (i, source[max(0,i-30):i+len(pattern)+30])
            for i in range(len(source))
            if source[i:i+len(pattern)] == pattern
        ]
        assert not occurrences, (
            f"Forbidden hardcoded path '{pattern}' found in sandbox_service.py at positions: "
            + str([(pos, ctx) for pos, ctx in occurrences[:3]])
        )
