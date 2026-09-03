from typing import Optional, Dict, Any

class LanguageService:
    @staticmethod
    def get_language_config(language: str) -> Optional[Dict[str, Any]]:
        configs = {
            "python": {
                "source_file": "main.py",
                "compile_cmd": None,
                "run_cmd": ["python", "main.py"],
                "docker_image": "python:3.10-slim",
                "extension": ".py"
            },
            "java": {
                "source_file": "Main.java",
                "compile_cmd": ["javac", "Main.java"],
                "run_cmd": ["java", "Main"],
                "docker_image": "openjdk:17-slim",
                "extension": ".java"
            },
            "c": {
                "source_file": "main.c",
                "compile_cmd": ["gcc", "main.c", "-o", "main"],
                "run_cmd": ["./main"],
                "docker_image": "gcc:latest",
                "extension": ".c"
            },
            "cpp": {
                "source_file": "main.cpp",
                "compile_cmd": ["g++", "main.cpp", "-o", "main"],
                "run_cmd": ["./main"],
                "docker_image": "gcc:latest",
                "extension": ".cpp"
            }
        }
        return configs.get(language.lower().strip())
