import tempfile
import os
import subprocess
import time
from sqlalchemy.orm import Session
from ..models.code_execution import CodeExecution
from ..schemas.execution import ExecutionRequest

def execute_code(db: Session, exec_req: ExecutionRequest, user_id: int = None):
    language = exec_req.language.lower()
    code = exec_req.code
    
    lang_config = {
        "python": {
            "image": "python:3.10-slim",
            "ext": ".py",
            "cmd": ["python", "main.py"]
        },
        "javascript": {
            "image": "node:18-alpine",
            "ext": ".js",
            "cmd": ["node", "main.js"]
        },
        "java": {
            "image": "openjdk:17",
            "ext": ".java",
            "cmd": ["sh", "-c", "javac Main.java && java Main"]
        },
        "cpp": {
            "image": "gcc:latest",
            "ext": ".cpp",
            "cmd": ["sh", "-c", "g++ main.cpp -o main && ./main"]
        }
    }
    
    if language not in lang_config:
        return {"status": "error", "error": f"Unsupported language: {language}"}
        
    config = lang_config[language]
    filename = "Main.java" if language == "java" else f"main{config['ext']}"
    
    output = ""
    error = ""
    status = "success"
    execution_time = 0.0
    
    # Create a temporary directory
    with tempfile.TemporaryDirectory() as temp_dir:
        # Windows path to unix path for docker if necessary, but docker run -v handles windows paths typically.
        # Ensure temp_dir is an absolute path.
        abs_temp_dir = os.path.abspath(temp_dir)
        
        file_path = os.path.join(abs_temp_dir, filename)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code)
            
        start_time = time.time()
        
        try:
            # Local platform-aware command execution
            if os.name == 'nt':
                # Windows
                if language == "python":
                    cmd = "python main.py"
                elif language == "javascript":
                    cmd = "node main.js"
                elif language == "java":
                    cmd = "javac Main.java && java Main"
                elif language == "cpp":
                    cmd = "g++ main.cpp -o main.exe && main.exe"
                else:
                    cmd = ""
            else:
                # Unix-like
                if language == "python":
                    cmd = "python3 main.py"
                elif language == "javascript":
                    cmd = "node main.js"
                elif language == "java":
                    cmd = "javac Main.java && java Main"
                elif language == "cpp":
                    cmd = "g++ main.cpp -o main && ./main"
                else:
                    cmd = ""

            result = subprocess.run(
                cmd,
                cwd=abs_temp_dir,
                shell=True,
                capture_output=True,
                text=True,
                timeout=10
            )
            
            output = result.stdout
            if result.returncode != 0:
                status = "error"
                error = result.stderr if result.stderr else f"Exit code {result.returncode}"
        except subprocess.TimeoutExpired:
            status = "error"
            error = "Execution timed out (10s limit)"
        except Exception as e:
            status = "error"
            error = str(e)
            
        execution_time = time.time() - start_time
        
    # Save to db
    db_exec = CodeExecution(
        user_id=user_id,
        language=language,
        source_code=code,
        input_data=exec_req.input,
        output=output,
        error=error,
        status=status,
        execution_time=execution_time
    )
    db.add(db_exec)
    db.commit()
    db.refresh(db_exec)
    
    return {
        "status": status,
        "output": output,
        "error": error,
        "execution_time": execution_time
    }
