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
# Windows ld.exe space-in-path fix
#
# MinGW-w64's ld.exe fails with "cannot find" errors when its installation
# directory contains spaces.  The root cause: GCC uses its own baked-in
# prefix (not argv[0]) to locate helper binaries like ld.exe and as.exe.
# Passing a short (8.3) path as the compiler binary alone is NOT enough.
#
# The reliable fix is to pass "-B <short_bin_dir>" at compile time, which
# explicitly tells GCC where to find its auxiliary tools using a space-free
# path — overriding the baked-in prefix entirely.
#
# All paths are derived at runtime from shutil.which() — no hardcoded
# machine-specific paths anywhere in this file.
# ---------------------------------------------------------------------------


def _get_win_short_path(long_path: str) -> str:
    """
    Convert a Windows long path that contains spaces to its 8.3 short form
    using the Windows API GetShortPathNameW (via ctypes).

    Returns the original path unchanged on non-Windows, if there are no
    spaces, or if the API call fails for any reason.
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
        if ret and buf.value and os.path.exists(buf.value):
            return buf.value
    except Exception:
        pass
    return long_path


def _resolve_compiler_path(compiler_name: str) -> Optional[str]:
    """
    Locate a compiler binary (e.g. 'gcc', 'g++') via shutil.which() and
    return its space-free 8.3 path on Windows.

    Returns None if the compiler is not on PATH.
    Raises RuntimeError if the compiler is found but the path still contains
    spaces after 8.3 conversion (should never happen on modern Windows, but
    we fail loudly rather than silently pass a broken path to ld.exe).
    """
    found = shutil.which(compiler_name)
    if not found:
        return None

    abs_path = os.path.abspath(found)
    short_path = _get_win_short_path(abs_path)

    if platform.system() == "Windows" and " " in short_path:
        raise RuntimeError(
            f"Could not obtain a space-free 8.3 path for '{compiler_name}'.\n"
            f"Resolved to: {short_path}\n"
            "Ensure 8.3 short-name generation is enabled on your drive "
            "(run: fsutil 8dot3name query C:) and retry."
        )
    return short_path


def _resolve_mingw_bin() -> Optional[str]:
    """
    Return the MinGW-w64 bin directory as a space-free (8.3) path, or None
    if gcc is not installed.  Derived purely from shutil.which('gcc') —
    no hardcoded machine-specific paths.
    """
    gcc = shutil.which("gcc")
    if not gcc:
        return None
    gcc_dir = os.path.dirname(os.path.abspath(gcc))
    return _get_win_short_path(gcc_dir)


def _build_mingw_env(env: dict, mingw_bin: str) -> dict:
    """
    Set COMPILER_PATH and LIBRARY_PATH so GCC and ld.exe find their own
    auxiliary binaries and library files via space-free 8.3 paths.

    Root cause of the MinGW ld.exe space-in-path error:
    GCC/ld compute their own tool and library paths from their baked-in
    installation prefix (not from argv[0] or PATH).  On Windows the OS
    resolves junctions/8.3 paths back to long names via GetFinalPathName,
    so even invoking gcc.EXE via a short path gives it the long prefix.

    The fix: GCC respects two env vars that override the baked-in prefix:
    - COMPILER_PATH  — searched first for subprograms (ld.exe, as.exe ...)
    - LIBRARY_PATH   — searched first for .a/.o files (default-manifest.o ...)

    Both are set to their 8.3 short equivalents derived at runtime.
    """
    import glob
    mingw64_dir = os.path.dirname(mingw_bin)   # parent of bin/
    short_mingw64 = _get_win_short_path(mingw64_dir)

    # COMPILER_PATH: where GCC looks for ld.exe, as.exe, etc.
    env["COMPILER_PATH"] = mingw_bin

    # LIBRARY_PATH: where ld looks for default-manifest.o, libgcc.a, etc.
    # Include all GCC version-specific lib dirs generically.
    lib_dirs = [
        os.path.join(short_mingw64, "lib"),
        os.path.join(short_mingw64, "x86_64-w64-mingw32", "lib"),
    ]
    # Add GCC version dirs (e.g. lib/gcc/x86_64-w64-mingw32/16.1.0)
    gcc_ver_dirs = glob.glob(
        os.path.join(mingw64_dir, "lib", "gcc", "*", "*")
    )
    for d in gcc_ver_dirs:
        short_d = _get_win_short_path(d)
        if short_d not in lib_dirs:
            lib_dirs.append(short_d)

    env["LIBRARY_PATH"] = os.pathsep.join(lib_dirs)
    return env


def _build_env() -> dict:
    """
    Return a copy of os.environ with:
    - The MinGW bin directory prepended to PATH (space-free 8.3 form)
    - COMPILER_PATH and LIBRARY_PATH set to short-form paths (Windows only)
      so GCC and ld.exe find their tools without space-in-path errors.
    If gcc is not installed, the environment is returned unchanged.
    """
    env = os.environ.copy()
    mingw_bin = _resolve_mingw_bin()
    if mingw_bin:
        current_path = env.get("PATH", "")
        entries = current_path.split(os.pathsep)
        if mingw_bin not in entries:
            env["PATH"] = mingw_bin + os.pathsep + current_path
        if platform.system() == "Windows":
            env = _build_mingw_env(env, mingw_bin)
    return env


def _compiler_not_installed_msg(compiler: str) -> str:
    """Return a clear, platform-specific installation guide for a missing compiler."""
    system = platform.system()
    if system == "Windows":
        install_hint = (
            "  Windows: Install MinGW-w64 from https://winlibs.com or via WinGet:\n"
            "    winget install BrechtSanders.WinLibs.POSIX.UCRT\n"
            "  Then add the mingw64/bin folder to your system PATH and restart your terminal."
        )
    elif system == "Darwin":
        install_hint = (
            "  macOS: Install Xcode Command Line Tools:\n"
            "    xcode-select --install"
        )
    else:
        install_hint = (
            "  Linux: Install build-essential:\n"
            "    sudo apt-get install build-essential   # Debian / Ubuntu\n"
            "    sudo dnf install gcc gcc-c++           # Fedora / RHEL"
        )
    return (
        f"Compilation Error: '{compiler}' compiler not found in PATH.\n\n"
        f"To fix this:\n{install_hint}"
    )


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
    clean paths like 'main.c' instead of '/tmp/tmpXXXXX/main.c'.
    Also strip Windows 8.3 short-name segments that may appear.
    """
    if not stderr or not temp_dir:
        return stderr
    escaped = re.escape(temp_dir)
    cleaned = re.sub(escaped, "", stderr, flags=re.IGNORECASE)
    # Strip Windows short-form path segments (e.g. NAVEEN~1) that gcc may embed
    cleaned = re.sub(r"[A-Z0-9]{1,8}~\d+[/\\]?", "", cleaned)
    # Clean up residual path separators before filenames
    cleaned = re.sub(r'["\'][/\\]+', '"', cleaned)
    cleaned = re.sub(r'[/\\]+main\.', 'main.', cleaned)
    return cleaned.strip()


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

        # Build environment with compiler on PATH
        _env = _build_env()

        # ── Compiler presence checks ─────────────────────────────────────
        if language in ["c", "cpp"]:
            compiler = "g++" if language == "cpp" else "gcc"
            if shutil.which(compiler, path=_env.get("PATH")) is None:
                return ExecutionResult(
                    "compilation_error", "", _compiler_not_installed_msg(compiler),
                    0.0, exit_code=1
                )
        elif language == "java":
            if shutil.which("javac", path=_env.get("PATH")) is None:
                return ExecutionResult(
                    "compilation_error", "",
                    "Compilation Error: Java compiler 'javac' not found in PATH.\n"
                    "Install a JDK: https://adoptium.net",
                    0.0, exit_code=1
                )

        with tempfile.TemporaryDirectory() as temp_dir:
            abs_temp_dir = os.path.abspath(temp_dir)
            file_path = os.path.join(abs_temp_dir, source_file)

            with open(file_path, "w", encoding="utf-8") as f:
                f.write(code)

            # ── Compilation Phase ─────────────────────────────────────────
            compile_cmd = list(config["compile_cmd"]) if config["compile_cmd"] else None
            if compile_cmd:
                if is_windows and language in ["c", "cpp"]:
                    # GCC locates ld.exe/as.exe via its baked-in prefix, not
                    # argv[0].  COMPILER_PATH and LIBRARY_PATH env vars (set in
                    # _build_env) override the prefix so ld.exe is invoked via
                    # its space-free 8.3 path.  We also invoke gcc itself via
                    # its short path for consistency.
                    try:
                        compiler_name = compile_cmd[0]   # "gcc" or "g++"
                        short_compiler = _resolve_compiler_path(compiler_name) or compiler_name
                    except RuntimeError as path_err:
                        return ExecutionResult(
                            "compilation_error", "", str(path_err), 0.0, exit_code=1
                        )
                    source_filename = compile_cmd[1]
                    compile_cmd = [short_compiler, source_filename, "-o", "main.exe"]

                compile_start = time.time()
                try:
                    result = subprocess.run(
                        compile_cmd,
                        cwd=abs_temp_dir,
                        capture_output=True,
                        text=True,
                        timeout=max(timeout, 30),
                        env=_env
                    )
                    compile_time = time.time() - compile_start
                    if result.returncode != 0:
                        raw_stderr = result.stderr or result.stdout or "Compilation failed"
                        return ExecutionResult(
                            "compilation_error", "",
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
                    exe_path = os.path.join(abs_temp_dir, "main.exe")
                    run_cmd = [exe_path]
                elif language == "python":
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
