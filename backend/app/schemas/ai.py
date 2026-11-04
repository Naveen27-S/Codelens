from pydantic import BaseModel
from typing import Optional, List, Any, Dict

class AIExplainRequest(BaseModel):
    language: str
    code: str
    explanation_level: Optional[str] = "intermediate"

class AIVisualizeRequest(BaseModel):
    language: str
    code: str

class AIDebugRequest(BaseModel):
    language: str
    code: str
    error: Optional[str] = ""
    compiler_output: Optional[str] = None
    runtime_error: Optional[str] = None
    terminal_output: Optional[str] = None
    line_number: Optional[int] = None
    stdin: Optional[str] = None
    expected_output: Optional[str] = None
    actual_output: Optional[str] = None
    program_id: Optional[str] = None

class AIExplainErrorRequest(BaseModel):
    language: str
    code: str
    error_message: str
    line_number: Optional[int] = None
    terminal_output: Optional[str] = None

class AIExplainCodeRequest(BaseModel):
    language: str
    code: str
    selected_code: Optional[str] = None
    explanation_level: Optional[str] = "beginner"

class AIAnalyzeOutputRequest(BaseModel):
    language: str
    code: str
    stdin: Optional[str] = ""
    expected_output: str
    actual_output: str

class AIDebugActionRequest(BaseModel):
    debug_id: str
    action: str  # "applied", "undone", "copied", "ignored"
    language: Optional[str] = None
    error_type: Optional[str] = None

class AIResponse(BaseModel):
    explanation: Optional[str] = None
    problem: Optional[str] = None
    solution: Optional[str] = None
    corrected_code: Optional[str] = None
    line_number: Optional[int] = None
    offending_line: Optional[str] = None
    suggested_fix: Optional[str] = None
    status: Optional[str] = None
    error_type: Optional[str] = None
    error_message: Optional[str] = None
    cause: Optional[str] = None
    changes: Optional[List[str]] = None
    debug_id: Optional[str] = None
    expected_concept: Optional[str] = None
    simple_example: Optional[str] = None

class AICodeExplanationResponse(BaseModel):
    status: str = "success"
    summary: str
    algorithm_overview: Optional[str] = None
    variables: Optional[List[Dict[str, Any]]] = None
    functions_methods: Optional[List[Dict[str, Any]]] = None
    loops_conditions: Optional[List[str]] = None
    data_structures: Optional[List[str]] = None
    time_complexity: Optional[str] = None
    space_complexity: Optional[str] = None
    step_by_step: Optional[List[str]] = None
    full_explanation: Optional[str] = None

class AIComplexityRequest(BaseModel):
    language: str
    code: str
    problem_context: Optional[str] = None

class ComplexityBenchmarkPoint(BaseModel):
    n: int
    current_ops: float
    optimal_ops: float
    brute_ops: float

class AlternativeSolution(BaseModel):
    name: str
    approach_type: str  # "current" | "optimal" | "tradeoff" | "brute_force"
    time_complexity: str
    space_complexity: str
    pros: str
    cons: str
    code: str
    speedup_factor: Optional[str] = None

class OptimizationTechnique(BaseModel):
    title: str
    description: str
    impact: str  # "High" | "Medium" | "Low"
    technique_type: str
    code_example: Optional[str] = None

class AIComplexityResponse(BaseModel):
    status: str = "success"
    time_complexity: str
    time_complexity_best: str
    time_complexity_worst: str
    time_complexity_average: str
    space_complexity: str
    auxiliary_space: str
    complexity_category: str
    time_explanation: str
    space_explanation: str
    operations_formula: str
    benchmarks: List[ComplexityBenchmarkPoint]
    alternatives: List[AlternativeSolution]
    optimizations: List[OptimizationTechnique]
