import json
import re
import logging
import google.generativeai as genai
from ..core.config import settings

logger = logging.getLogger(__name__)


def get_gemini_model():
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set")
    genai.configure(api_key=settings.GEMINI_API_KEY)
    return genai.GenerativeModel('gemini-2.5-flash')


# ---------------------------------------------------------------------------
# Rule-based fallback error explainer
# Provides plain-English explanations when Gemini is unavailable.
# ---------------------------------------------------------------------------

_PYTHON_RULES = [
    (r"IndentationError", "IndentationError",
     "Python requires consistent indentation (spaces or tabs, not mixed).",
     "Fix indentation on the highlighted line to match the surrounding block."),
    (r"NameError: name '(.+?)' is not defined", "NameError",
     "A variable or function name was used before it was defined.",
     "Define '{match}' before using it, or check for a typo in the name."),
    (r"ZeroDivisionError", "ZeroDivisionError",
     "The program attempted to divide a number by zero.",
     "Add a check to ensure the divisor is not zero before performing division."),
    (r"TypeError", "TypeError",
     "An operation was applied to a value of the wrong type.",
     "Check that you are using compatible types (e.g. int + int, not int + str)."),
    (r"IndexError", "IndexError",
     "A list or sequence was accessed with an out-of-range index.",
     "Verify that the index is within the valid range of the sequence."),
    (r"KeyError", "KeyError",
     "A dictionary was accessed with a key that does not exist.",
     "Check that the key exists before accessing it, or use dict.get(key, default)."),
    (r"SyntaxError", "SyntaxError",
     "The code has a syntax mistake that Python cannot parse.",
     "Look for missing colons, unclosed brackets, or incorrect keywords near the indicated line."),
    (r"ModuleNotFoundError|ImportError", "ImportError",
     "A module could not be found or imported.",
     "Install the missing package (pip install <name>) or check the import statement for typos."),
    (r"RecursionError", "RecursionError",
     "The program exceeded Python's recursion limit (infinite recursion).",
     "Add a base case to the recursive function to stop recursion at the right time."),
]

_JAVA_RULES = [
    (r"cannot find symbol", "Undefined Symbol",
     "A variable, method, or class name is used but was never declared.",
     "Check spelling, ensure the variable is declared in the correct scope, and verify imports."),
    (r"NullPointerException", "NullPointerException",
     "An operation was performed on a null (uninitialized) object reference.",
     "Initialize the object before using it, or add a null check before the call."),
    (r"ArrayIndexOutOfBoundsException", "Array Index Out of Bounds",
     "The program tried to access an array element at an invalid index.",
     "Ensure array indices are within [0, array.length - 1]."),
    (r"ClassCastException", "ClassCastException",
     "An object was cast to an incompatible type.",
     "Use instanceof to check the type before casting."),
    (r"StackOverflowError", "Stack Overflow",
     "Infinite recursion caused the call stack to overflow.",
     "Add or correct the base case in the recursive method."),
    (r"missing return statement", "Missing Return Statement",
     "A method with a non-void return type is missing a return statement in some code path.",
     "Ensure every branch of the method returns a value of the correct type."),
    (r"incompatible types", "Type Mismatch",
     "A value of one type was assigned or passed where a different type is expected.",
     "Check the type of the variable/expression and cast or convert it as needed."),
]

_C_CPP_RULES = [
    (r"undefined reference to", "Linker Error: Undefined Reference",
     "A function or variable is declared but its definition (implementation) is missing.",
     "Provide the function definition, link the correct library, or check for typos in the name."),
    (r"expected\s+'?;'?", "Missing Semicolon",
     "A semicolon is missing at the end of a statement.",
     "Add a semicolon at the end of the indicated line."),
    (r"use of undeclared identifier|undeclared .+ first use", "Undeclared Identifier",
     "A variable or function is used without being declared first.",
     "Declare the variable or include the required header file before using it."),
    (r"segmentation fault|Segmentation fault", "Segmentation Fault",
     "The program accessed memory it does not own (e.g., null pointer, out-of-bounds array).",
     "Check pointer initialization, array bounds, and ensure you are not accessing freed memory."),
    (r"no matching function for call", "No Matching Function",
     "A function call does not match any known overload for the given argument types.",
     "Check the argument types and count match the function signature."),
    (r"redefinition of", "Redefinition Error",
     "A variable, function, or class is defined more than once.",
     "Remove the duplicate definition or use include guards (#ifndef) in header files."),
    (r"error: '(.+?)' was not declared", "Undeclared Identifier",
     "An identifier was used before it was declared.",
     "Declare '{match}' before use or include the appropriate header."),
]


def get_rule_based_explanation(language: str, code: str, error: str) -> dict:
    """
    Return a plain-English explanation dict for common errors using regex rules.
    Used as a fallback when Gemini is unavailable.
    """
    rules = {
        "python": _PYTHON_RULES,
        "java": _JAVA_RULES,
        "c": _C_CPP_RULES,
        "cpp": _C_CPP_RULES,
    }.get(language.lower(), [])

    for pattern, problem, explanation, solution in rules:
        match = re.search(pattern, error, re.IGNORECASE)
        if match:
            groups = match.groups()
            matched_text = groups[0] if groups else ""
            return {
                "problem": problem,
                "explanation": explanation.replace("{match}", matched_text),
                "solution": solution.replace("{match}", matched_text),
                "corrected_code": "",
            }

    # Generic fallback when no rule matches
    first_line = error.strip().splitlines()[0][:200] if error.strip() else "Unknown error"
    return {
        "problem": "Execution Error",
        "explanation": f"An error occurred during execution: {first_line}",
        "solution": "Review the error message above carefully and check the indicated line.",
        "corrected_code": "",
    }


def explain_code(language: str, code: str, explanation_level: str = "intermediate") -> str:
    level = (explanation_level or "intermediate").lower()
    
    if level == "beginner":
        level_instructions = """
        - Target audience: Absolute beginner programmer.
        - Tone: Encouraging, friendly, intuitive, zero intimidating technical jargon.
        - Analogies: Use relatable everyday analogies (e.g. variables as labeled boxes, functions as recipes, loops as repetition).
        - Structure: Explain what the code does step-by-step in plain English, explaining every variable and simple concept.
        """
    elif level == "advanced":
        level_instructions = """
        - Target audience: Senior software engineer or computer science researcher.
        - Tone: Rigorous, precise, technical.
        - Focus: Deep-dive into memory layout (stack vs heap), pointer/reference behavior, algorithmic invariants, Big-O time and space complexity, hardware/cache implications, and potential compiler optimizations.
        """
    else:
        level_instructions = """
        - Target audience: Intermediate developer or student.
        - Tone: Clear, balanced, structured, and informative.
        - Focus: Important control flow, variable state changes, function roles, edge cases, and standard time/space complexity.
        """

    try:
        model = get_gemini_model()
        prompt = f"""
        Explain the following {language} code at a {level.upper()} explanation level.
        
        {level_instructions}
        
        Code:
        ```{language}
        {code}
        ```
        """
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"AI Service Error: {str(e)}"


def debug_code(language: str, code: str, error: str) -> dict:
    """
    Return a structured error explanation dict with keys:
        problem, explanation, solution, corrected_code

    Tries Gemini first; falls back to rule-based explainer if:
    - GEMINI_API_KEY is not set
    - The API call fails for any reason
    """
    # Fast path: no API key configured
    if not settings.GEMINI_API_KEY:
        logger.info("GEMINI_API_KEY not set — using rule-based error explanation")
        return get_rule_based_explanation(language, code, error)

    try:
        model = get_gemini_model()
        prompt = f"""
        The following {language} code produced an error. 
        Code:
        ```{language}
        {code}
        ```
        Error:
        {error}
        
        Please provide:
        1. A description of the problem.
        2. An explanation of why it happened.
        3. A solution.
        4. The corrected code.
        
        Format your response exactly as a JSON object (without markdown wrapping or code blocks around the JSON):
        {{
            "problem": "...",
            "explanation": "...",
            "solution": "...",
            "corrected_code": "..."
        }}
        """
        response = model.generate_content(prompt)
        text = response.text
        # Strip markdown code fences if the model wrapped the JSON anyway
        text = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text.strip())

        try:
            return json.loads(text.strip())
        except json.JSONDecodeError:
            logger.warning("Gemini returned non-JSON; falling back to rule-based explainer")
            return get_rule_based_explanation(language, code, error)

    except Exception as e:
        logger.warning("Gemini debug_code failed (%s); falling back to rule-based explainer", e)
        return get_rule_based_explanation(language, code, error)



# ---------------------------------------------------------------------------
# Mermaid extraction and sanitization helpers
# ---------------------------------------------------------------------------

# Diagram type keywords that are valid starts for a Mermaid diagram
_MERMAID_STARTS = (
    "flowchart", "graph", "sequencediagram", "classDiagram",
    "stateDiagram", "erDiagram", "gantt", "pie", "gitGraph", "mindmap",
)

def _extract_mermaid(text: str) -> str:
    """
    Extract ONLY the Mermaid diagram source from an AI response.

    Strategy (multi-pass):
    1. If the text contains ```mermaid ... ``` fences, take the content inside.
    2. Else if the text contains ``` ... ``` fences (any language), take the content.
    3. Else search for the first line that starts a known diagram type
       (flowchart, graph, sequenceDiagram, …) and return from there to end,
       discarding any trailing prose lines that don't look like Mermaid.
    4. If none of the above work, return the text as-is (sanitizer will catch it).
    """
    if not text:
        return ""
    # Pass 1: explicit ```mermaid fence
    m = re.search(r"```mermaid\s*\n([\s\S]*?)```", text, re.IGNORECASE)
    if m:
        return m.group(1).strip()

    # Pass 2: any ``` fence
    m = re.search(r"```[^\n]*\n([\s\S]*?)```", text)
    if m:
        candidate = m.group(1).strip()
        if any(candidate.lower().startswith(kw.lower()) for kw in _MERMAID_STARTS):
            return candidate

    # Pass 3: find first Mermaid-like line and take from there
    lines = text.splitlines()
    start_idx = None
    for i, line in enumerate(lines):
        stripped = line.strip().lower()
        if any(stripped.startswith(kw.lower()) for kw in _MERMAID_STARTS):
            start_idx = i
            break

    if start_idx is not None:
        diagram_lines = lines[start_idx:]
        while diagram_lines and not re.search(r"--?>|==?>|-\.->|[\[\(\{\}>]", diagram_lines[-1]):
            if not diagram_lines[-1].strip():
                diagram_lines.pop()
            else:
                break
        return "\n".join(diagram_lines).strip()

    return text.strip()


def _sanitize_label_content(label: str) -> str:
    """Sanitize and double-quote the inner content of a node or edge label."""
    if not label:
        return '""'
    
    label = label.strip()

    # If already enclosed in double quotes, strip outer pair
    if label.startswith('"') and label.endswith('"') and len(label) >= 2:
        label = label[1:-1]

    # Convert inner double quotes to single quotes to prevent breaking Mermaid string boundaries
    label = label.replace('"', "'")

    # Escape HTML special characters for htmlLabels compatibility
    label = label.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

    # Replace newlines with <br/>
    label = label.replace('\r\n', '<br/>').replace('\n', '<br/>')

    return f'"{label}"'


def _sanitize_mermaid_line(line: str) -> str:
    """
    Sanitize a single line of Mermaid diagram code.
    Handles node definitions (with shape brackets) and edge labels.
    """
    line_str = line.strip()
    if not line_str or line_str.startswith("%%"):
        return line

    lower_line = line_str.lower()
    if any(lower_line.startswith(kw) for kw in _MERMAID_STARTS):
        return line_str

    SHAPES = [
        (r'\(\(', r'\)\)', '((', '))'),   # Circle: ((label))
        (r'\[\[', r'\]\]', '[[', ']]'),   # Subroutine: [[label]]
        (r'\[\(', r'\)\]', '[(', ')]'),   # Database: [(label)]
        (r'\(\[', r'\]\)', '([', '])'),   # Stadium: ([label])
        (r'\{\{', r'\}\}', '{{', '}}'),   # Hexagon: {{label}}
        (r'\[/',  r'/\]',  '[/', '/]'),   # Parallelogram: [/label/]
        (r'\[\\', r'\\\]', '[\\', '\\]'), # Parallelogram: [\label\]
        (r'\[/',  r'\\\]', '[/', '\\]'),  # Trapezoid: [/label\]
        (r'\[\\', r'/\]',  '[\\', '/]'),  # Trapezoid: [\label/]
        (r'>',    r'\]',   '>',  ']'),    # Asymmetric: >label]
        (r'\[',   r'\]',   '[',  ']'),    # Rectangle: [label]
        (r'\{',   r'\}',   '{',  '}'),    # Rhombus: {label}
        (r'\(',   r'\)',   '(',  ')'),    # Round: (label)
    ]

    # Sanitize edge labels
    def fix_edge1(m):
        lbl = m.group(1).strip()
        clean = _sanitize_label_content(lbl)
        return f"-- {clean} -->"
    line_str = re.sub(r'--\s*([^-\n>]+?)\s*-->', fix_edge1, line_str)

    def fix_edge2(m):
        lbl = m.group(1).strip()
        clean = _sanitize_label_content(lbl)
        return f"-->|{clean}|"
    line_str = re.sub(r'-->\|([^|\n]+?)\|', fix_edge2, line_str)

    # Sanitize node declarations iteratively across the line
    node_regex = re.compile(
        r'(?P<id>[A-Za-z0-9_]+)\s*(?P<open>\(\(|\[\[|\[\(|\(\[\|\{\{|\[/|\[\\|>|\[|\{|\()(?P<rest>.*)'
    )

    result_parts = []
    curr = line_str

    while True:
        m = node_regex.search(curr)
        if not m:
            result_parts.append(curr)
            break

        prefix = curr[:m.start()]
        node_id = m.group('id')
        open_delim = m.group('open')
        rest = m.group('rest')

        matched_shape = None
        for shape in SHAPES:
            if open_delim == shape[2]:
                matched_shape = shape
                break

        if not matched_shape:
            result_parts.append(curr[:m.end()])
            curr = curr[m.end():]
            continue

        _, _, op_str, cl_str = matched_shape

        edge_match = re.search(r'--?>|==?>|-\.->', rest)
        search_end = edge_match.start() if edge_match else len(rest)

        cl_idx = rest[:search_end].rfind(cl_str)
        if cl_idx == -1:
            cl_idx = rest.rfind(cl_str)

        if cl_idx == -1:
            result_parts.append(curr[:m.end()])
            curr = curr[m.end():]
            continue

        label_raw = rest[:cl_idx]
        remainder = rest[cl_idx + len(cl_str):]

        clean_label = _sanitize_label_content(label_raw)
        result_parts.append(f"{prefix}{node_id}{op_str}{clean_label}{cl_str}")
        curr = remainder

    return "".join(result_parts)


def _sanitize_mermaid(source: str) -> str:
    """
    Post-process AI-generated Mermaid source to fix common parsing issues:
    - Normalise line endings & remove stray backtick fences
    - Remove explanatory prose before/after diagram declaration
    - Wrap node and edge labels in double quotes `"..."` and escape inner quotes/brackets
    - Ensure first line is a valid diagram declaration
    """
    source = source.replace("\r\n", "\n").replace("\r", "\n")
    source = re.sub(r"^```[^\n]*\n?", "", source.strip(), flags=re.MULTILINE)
    source = re.sub(r"```\s*$", "", source.strip(), flags=re.MULTILINE)
    source = source.strip()

    lines = source.splitlines()
    start_idx = 0
    for i, line in enumerate(lines):
        stripped = line.strip().lower()
        if any(stripped.startswith(kw.lower()) for kw in _MERMAID_STARTS):
            start_idx = i
            break
    lines = lines[start_idx:]

    fixed_lines = [_sanitize_mermaid_line(line) for line in lines]
    result = "\n".join(fixed_lines).strip()

    if not any(result.lower().startswith(kw.lower()) for kw in _MERMAID_STARTS):
        return 'flowchart TD\n    E["Diagram generation failed — please try again"]'

    return result


def visualize_code(language: str, code: str) -> str:
    """
    Generate a Mermaid.js flowchart for the given source code.

    Returns a clean, sanitized Mermaid diagram string ready for direct
    use in mermaid.render(). Never returns raw AI prose.
    """
    try:
        model = get_gemini_model()

        prompt = f"""\
You are a Mermaid.js diagram generator. Output ONLY raw Mermaid diagram syntax — no explanations, no markdown fences, no prose.

Generate a `flowchart TD` diagram for the following {language} code.

MANDATORY SYNTAX RULES (Mermaid v11):
1. First line MUST be exactly: flowchart TD
2. EVERY node label MUST be wrapped in double quotes:
   Example:   A["Start"]   B["Initialize arr, n"]   C{{"i < n?"}}   D["arr[i] > largest?"]
3. If code inside a label uses double quotes, convert them to single quotes (e.g. A["Print: 'Hello'"]).
4. Use only alphanumeric node IDs (A, B, C, N1, N2). Do NOT use special characters in node IDs.
5. Use standard node shapes:
   - Rectangle:     A["Label"]
   - Diamond:       B{{"Label"}}
   - Round:         C("Label")
   - Circle:        D(("Label"))
6. Edge text MUST also be wrapped in double quotes:
   Example:   A -- "Yes" --> B    or    A -->|"No"| C
7. Keep labels concise and clean (max 50 characters).
8. Do NOT output any text before or after the diagram.

{language.upper()} code:
```
{code}
```

Mermaid diagram:"""

        response = model.generate_content(prompt)
        raw = response.text or ""

        # Step 1: extract the diagram from whatever the model returned
        extracted = _extract_mermaid(raw)

        # Step 2: sanitize common AI mistakes
        sanitized = _sanitize_mermaid(extracted)

        logger.info(
            "visualize_code: extracted=%d chars, sanitized=%d chars, first_line=%r",
            len(extracted), len(sanitized),
            sanitized.splitlines()[0] if sanitized else "(empty)"
        )

        return sanitized

    except Exception as e:
        logger.error("visualize_code error: %s", e)
        return f'flowchart TD\n    E["AI Service Error: {str(e)[:80]}"]'


