import google.generativeai as genai
from ..core.config import settings

def get_gemini_model():
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set")
    genai.configure(api_key=settings.GEMINI_API_KEY)
    # Use gemini-2.5-flash as default, or whatever is preferred
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
        # Parse JSON carefully, assuming the model might still return markdown
        import json
        text = response.text
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        
        try:
            return json.loads(text.strip())
        except json.JSONDecodeError:
            return {
                "problem": "Could not parse AI response",
                "explanation": response.text,
                "solution": "",
                "corrected_code": code
            }
    except Exception as e:
        return {
            "problem": "AI Service Error",
            "explanation": str(e),
            "solution": "",
            "corrected_code": ""
        }

def visualize_code(language: str, code: str) -> str:
    try:
        model = get_gemini_model()
        prompt = f"""
        Analyze the following {language} code and generate a valid Mermaid.js flowchart diagram representing its control flow, logic, or architecture.
        
        Strict Rules for the Mermaid syntax:
        1. Start with `flowchart TD`.
        2. Use only simple node shapes: `A[Text]`, `B{{Condition}}`, `C((Start/End))`.
        3. ALWAYS wrap node labels in quotes if they contain special characters (e.g. `<`, `>`, `=`, `?`, `:`), like this: `B{{"n <= 1?"}}` or `A["Start: func()"]`.
        4. ALWAYS explicitly define connections between nodes using `-->`. Do not place nodes on the same line without a connector.
        5. ONLY return the raw Mermaid syntax. Do not wrap it in markdown code blocks.
        
        Code:
        ```{language}
        {code}
        ```
        """
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Use regex to extract mermaid code if Gemini wrapped it despite instructions
        import re
        match = re.search(r"```(?:mermaid)?(.*?)```", text, re.DOTALL)
        if match:
            text = match.group(1).strip()
            
        return text.strip()
    except Exception as e:
        # Return a simple error graph if it fails
        return f"graph TD\nError[\"AI Service Error: {str(e)}\"]"
