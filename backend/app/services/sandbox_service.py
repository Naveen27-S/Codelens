import abc
import os
import re
import subprocess
import time
import tempfile
import platform
import shutil
from typing import Optional
from .language_service import LanguageService

# ---------------------------------------------------------------------------
# MinGW-w64 / ld.exe space-in-path fix
#
# ld.exe (shipped with WinLibs MinGW) splits library paths on spaces when
# the compiler is installed under a path that contains spaces (e.g. a Windows
# username like "NAVEEN PRASANA").  The only reliable fix is to invoke the
# compiler using its Windows 8.3 short path so that gcc's argv[0] — and
# therefore every internal path it constructs — contains no spaces.
# ---------------------------------------------------------------------------

def _get_win_short_path(long_path: str) -> str:
    """
    Convert a Windows path that contains spaces to its 8.3 short form.
    Uses Windows API GetShortPathNameW via ctypes — reliably handles spaces.
    Returns the original path unchanged on non-Windows or on error.
    """
    if platform.system() != "Windows" or " " not in long_path:
        return long_path
    try:
        import ctypes
        GetShortPathNameW = ctypes.windll.kernel32.GetShortPathNameW
        GetShortPathNameW.argtypes = [ctypes.c_wchar_p, ctypes.c_wchar_p, ctypes.c_uint32]
        GetShortPathNameW.restype = ctypes.c_uint32
        buf_size = 512
        buf = ctypes.create_unicode_buffer(buf_size)
        ret = GetShortPathNameW(long_path, buf, buf_size)
        if ret and os.path.exists(buf.value):
            return buf.value
    except Exception:
        pass
    return long_path


def _resolve_mingw_bin() -> str:
    """
    Return the MinGW-w64 bin directory as a space-free (8.3) path.
    Tries shutil.which first (converting to 8.3), then falls back to
    the hardcoded verified short path for this machine.
    """
    _fallback = r"C:\Users\NAVEEN~1\AppData\Local\MICROS~1\WinGet\Packages\BRECHT~1.SOU\mingw64\bin"
    gcc = shutil.which("gcc")
    if gcc:
        gcc_dir = os.path.dirname(os.path.abspath(gcc))
        short = _get_win_short_path(gcc_dir)
        if " " not in short:
            return short
    # If which() failed or short path still has spaces, use hardcoded fallback
    return _fallback


_WINLIBS_BIN = _resolve_mingw_bin()


def _build_env() -> dict:
    """Return os.environ with the short-path MinGW bin prepended to PATH."""
    env = os.environ.copy()
    current_path = env.get("PATH", "")
    # Always prepend the short-path dir so it wins over any long-path entry
    # that may already be on the system PATH.
    entries = current_path.split(os.pathsep)
    if _WINLIBS_BIN not in entries:
        env["PATH"] = _WINLIBS_BIN + os.pathsep + current_path
    return env


class ExecutionResult:
    def __init__(
        self,
        status: str,
        stdout: str,
        stderr: str,
        execution_time: float,
        exit_code: Optional[int] = None,
        memory_used: Optional[float] = None
    ):
        self.status = status
        self.stdout = stdout
        self.stderr = stderr
        self.execution_time = execution_time
        self.exit_code = exit_code
        self.memory_used = memory_used


def _sanitize_stderr(stderr: str, temp_dir: str) -> str:
    """
    Strip the temp directory path from error messages so users see
    clean paths like 'main.py' instead of '/tmp/tmpXXXXX/main.py'.
    Also normalise Windows short-names (NAVEEN~1) that appear in paths.
    """
    if not stderr or not temp_dir:
        return stderr
    # Escape the temp dir for use in regex, then replace
    escaped = re.escape(temp_dir)
    cleaned = re.sub(escaped, "", stderr, flags=re.IGNORECASE)
    # Remove leading path separators left after stripping
    cleaned = re.sub(r'["\'][\\/]+', '"', cleaned)
    cleaned = re.sub(r'[\\/]+main\.', 'main.', cleaned)
    return cleaned


class SandboxService(abc.ABC):
    @abc.abstractmethod
    def execute(
        self,
        language: str,
        code: str,
        input_data: str,
        timeout: float
    ) -> ExecutionResult:
        pass


class LocalSandbox(SandboxService):
    def execute(
        self,
        language: str,
        code: str,
        input_data: str,
        timeout: float
    ) -> ExecutionResult:
        config = LanguageService.get_language_config(language)
        if not config:
            return ExecutionResult(
                "execution_error", "", f"Unsupported language: {language}", 0.0, exit_code=1
            )

        source_file = config["source_file"]
        is_windows = platform.system() == "Windows"

        # Check compiler availability — use patched env PATH so WinLibs is found
        # even if the shell hasn't restarted after install.
        _env = _build_env()
        if language in ["c", "cpp"]:
            compiler = "g++" if language == "cpp" else "gcc"
            if shutil.which(compiler, path=_env.get("PATH")) is None:
                return ExecutionResult(
                    "compilation_error",
                    "",
                    (
                        f"Compilation Error: '{compiler}' compiler is not installed or not found in PATH.\n"
                        f"To enable C/C++ execution, install MinGW-w64 and add it to your system PATH."
                    ),
                    0.0,
                    exit_code=1
                )
        elif language == "java":
            if shutil.which("javac", path=_env.get("PATH")) is None:
                return ExecutionResult(
                    "compilation_error",
                    "",
                    "Compilation Error: Java compiler 'javac' is not installed or not found in PATH.",
                    0.0,
                    exit_code=1
                )

        with tempfile.TemporaryDirectory() as temp_dir:
            abs_temp_dir = os.path.abspath(temp_dir)
            file_path = os.path.join(abs_temp_dir, source_file)

            # Write source code to temp directory
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(code)

            # ── Compilation Phase ─────────────────────────────────────────
            compile_cmd = list(config["compile_cmd"]) if config["compile_cmd"] else None
            if compile_cmd:
                if is_windows and language in ["c", "cpp"]:
                    # Resolve the compiler (gcc/g++) to its 8.3 short path so
                    # ld.exe receives space-free paths in its spec file.
                    compiler_name = compile_cmd[0]  # e.g. "gcc" or "g++"
                    found = shutil.which(compiler_name, path=_env.get("PATH"))
                    short_compiler = _get_win_short_path(found) if found else compiler_name
                    compile_cmd = [short_compiler, compile_cmd[1], "-o", "main.exe"]

                compile_start = time.time()
                try:
                    result = subprocess.run(
                        compile_cmd,
                        cwd=abs_temp_dir,
                        capture_output=True,
                        text=True,
                        timeout=max(timeout, 30),  # give compiler more time than runtime
                        env=_env
                    )
                    compile_time = time.time() - compile_start
                    if result.returncode != 0:
                        raw_stderr = result.stderr or result.stdout or "Compilation failed"
                        return ExecutionResult(
                            "compilation_error",
                            "",
                            _sanitize_stderr(raw_stderr, abs_temp_dir),
                            compile_time,
                            exit_code=result.returncode
                        )
                except subprocess.TimeoutExpired:
                    return ExecutionResult(
                        "timeout", "", "Compilation timed out.", timeout, exit_code=None
                    )
                except Exception as e:
                    return ExecutionResult(
                        "compilation_error", "", f"Compilation error: {str(e)}", 0.0, exit_code=1
                    )

            # ── Execution Phase ───────────────────────────────────────────
            run_cmd = list(config["run_cmd"])
            if is_windows:
                if language in ["c", "cpp"]:
                    # Use the absolute path to the compiled executable to avoid
                    # path resolution issues with relative paths on Windows
                    exe_path = os.path.join(abs_temp_dir, "main.exe")
                    run_cmd = [exe_path]
                elif language == "python":
                    # 'python' is the correct command on this Windows system
                    run_cmd = ["python", source_file]

            exec_start = time.time()
            try:
                result = subprocess.run(
                    run_cmd,
                    cwd=abs_temp_dir,
                    input=input_data,
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                    env=_env
                )
                execution_time = time.time() - exec_start
                status = "success" if result.returncode == 0 else "runtime_error"

                # Always preserve both stdout and stderr (partial output support)
                clean_stderr = _sanitize_stderr(result.stderr, abs_temp_dir)

                return ExecutionResult(
                    status=status,
                    stdout=result.stdout,
                    stderr=clean_stderr,
                    execution_time=execution_time,
                    exit_code=result.returncode
                )
            except subprocess.TimeoutExpired:
                return ExecutionResult(
                    "timeout", "", "Time Limit Exceeded", timeout, exit_code=None
                )
            except Exception as e:
                return ExecutionResult(
                    "runtime_error", "", str(e),
                    time.time() - exec_start, exit_code=1
                )


class DockerSandbox(SandboxService):
    """
    Skeleton class to support Docker sandboxing in the future.
    Falls back to LocalSandbox until Docker is configured.
    """
    def execute(
        self,
        language: str,
        code: str,
        input_data: str,
        timeout: float
    ) -> ExecutionResult:
        raise NotImplementedError("Docker sandbox is currently not active.")


class SandboxFactory:
    @staticmethod
    def get_sandbox() -> SandboxService:
        # Docker daemon not running in local environment — use LocalSandbox
        return LocalSandbox()
