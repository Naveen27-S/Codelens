import json
import re
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

import google.generativeai as genai
from ..core.config import settings
from ..database.mongodb import get_mongodb

logger = logging.getLogger(__name__)


def get_gemini_model(api_key_override: str = None):
    key = (api_key_override or "").strip() or settings.GEMINI_API_KEY
    if not key:
        raise ValueError("GEMINI_API_KEY is not set")
    genai.configure(api_key=key)
    for model_name in ['gemini-flash-latest', 'gemini-pro-latest', 'gemini-2.5-flash', 'gemini-1.5-flash']:
        try:
            return genai.GenerativeModel(model_name)
        except Exception:
            continue
    return genai.GenerativeModel('gemini-flash-latest')


# ---------------------------------------------------------------------------
# Rule-based fallback error explainer & categorizer
# Provides plain-English explanations when Gemini is unavailable.
# ---------------------------------------------------------------------------

_PYTHON_RULES = [
    (r"IndentationError", "Syntax Error", "Indentation Error",
     "Python requires consistent indentation across blocks (use 4 spaces consistently, never mix spaces and tabs).",
     "Fix indentation on the highlighted line to match the surrounding block.",
     "Python uses indentation instead of curly braces {} to know which code belongs inside a loop or function."),
    (r"NameError: name '(.+?)' is not defined", "Compilation Error", "Undefined Variable / Name",
     "The variable or function name '{match}' was used before it was declared or initialized.",
     "Define '{match}' with an initial value before using it, or check for a spelling mistake.",
     "You cannot read from a box that hasn't been created yet."),
    (r"ZeroDivisionError", "Runtime Error", "Division by Zero",
     "The program attempted to divide a number by zero, which is mathematically undefined and crashes the program.",
     "Add an 'if' check to ensure the divisor is not zero before performing the division.",
     "Dividing by zero is impossible in math, so computers raise an error."),
    (r"TypeError", "Compilation Error", "Type Mismatch",
     "An operation or function was applied to a value of the wrong data type (e.g., adding a string to an integer).",
     "Ensure data types match using explicit conversion like int() or str().",
     "Adding a number to a word like 5 + 'apples' doesn't make mathematical sense."),
    (r"IndexError", "Runtime Error", "List Index Out of Range",
     "The program tried to access a list position that does not exist in memory.",
     "Ensure your index is between 0 and len(list) - 1. Remember Python indices start at 0.",
     "If you have a 3-item list, valid indices are 0, 1, and 2. Asking for index 3 causes an IndexError."),
    (r"KeyError", "Runtime Error", "Dictionary Key Not Found",
     "A dictionary was accessed with a key that does not exist.",
     "Check that the key exists with 'if key in dict:' or use 'dict.get(key, default)'.",
     "Looking up a word not in the dictionary."),
    (r"SyntaxError", "Syntax Error", "Syntax Error",
     "The code contains a syntax mistake that the Python interpreter cannot parse.",
     "Look for missing colons (:), unclosed quotes, or unclosed parentheses near the indicated line.",
     "A grammatical error in code."),
    (r"ModuleNotFoundError|ImportError", "Compilation Error", "Module Not Found",
     "The imported module could not be found or is not available.",
     "Verify the module name spelling and ensure standard library modules are used.",
     "Asking for a tool that isn't in your toolbox."),
    (r"RecursionError", "Logical Error", "Maximum Recursion Depth Exceeded",
     "A recursive function kept calling itself without reaching a stopping condition (infinite recursion).",
     "Add or correct the base case in your recursive function so it terminates properly.",
     "Like placing two mirrors face-to-face creating an endless tunnel."),
]

_JAVA_RULES = [
    (r"Cannot find symbol: class '([^']+)'", "Compilation Error", "Unknown Data Type",
     "The data type '{match}' does not exist in Java. In Java, types like 'boolean' must be spelled accurately.",
     "Replace '{match}' with a valid Java type such as 'boolean', 'int', or 'String'.",
     "Using an invalid passport that border control does not recognize."),
    (r"Cannot find symbol: variable '([^']+)'", "Compilation Error", "Undefined Variable",
     "Variable '{match}' is used without being declared or was misspelled.",
     "Declare '{match}' with its data type or fix the spelling.",
     "Calling a person by a name that nobody recognizes."),
    (r"Cannot find symbol: method '([^']+)' on 'System\.out'", "Compilation Error", "Unknown Print Method",
     "Method '{match}' does not exist on 'System.out'. Did you mean 'println'?",
     "Change to 'System.out.println(...)'.",
     "Dialing a wrong extension number on a phone."),
    (r"Misspelled keyword '([^']+)'\. Did you mean '([^']+)'", "Syntax Error", "Misspelled Keyword",
     "Alphabet typo detected: '{match}' is misspelled. Java requires exact keyword spelling.",
     "Replace '{match}' with the correct keyword.",
     "Like writing 'recieve' instead of 'receive' in English."),
    (r"Package 'system' does not exist|Java is case-sensitive", "Compilation Error", "Case Sensitivity Error",
     "Java is case-sensitive: 'system' must be capitalized as 'System'.",
     "Use 'System.out.println' with capital 'S'.",
     "Proper names must start with a capital letter."),
    (r"Invalid assignment in condition", "Syntax Error", "Assignment in Condition",
     "Used a single '=' (assignment) inside a condition instead of '==' (equality comparison).",
     "Change '=' to '==' for comparison.",
     "Assigning a value is giving; comparing is checking."),
    (r"Not a statement.*Use '=' for assignment", "Syntax Error", "Invalid Statement '=='",
     "Used '==' (equality check) as a standalone statement instead of '=' (assignment).",
     "Change '==' to '=' to assign the value.",
     "Asking a question instead of giving an order."),
    (r"cannot find symbol", "Compilation Error", "Undefined Symbol / Variable",
     "A variable, method, or class name was used but was never declared in this scope.",
     "Check spelling, ensure the variable is declared with its type, and verify class imports.",
     "Referring to someone by a name nobody recognizes."),
    (r"NullPointerException", "Runtime Error", "Null Pointer Dereference",
     "The code tried to use an object reference that currently points to 'null' (nothing in memory).",
     "Initialize the object with 'new' before calling methods or check 'if (obj != null)'.",
     "Trying to open an empty box expecting something inside."),
    (r"ArrayIndexOutOfBoundsException", "Runtime Error", "Array Index Out of Bounds",
     "The code attempted to access an array index that is less than 0 or greater than/equal to array.length.",
     "Change loop conditions from 'i <= arr.length' to 'i < arr.length'.",
     "If an array has 5 items, valid indices are 0 to 4. Asking for arr[5] crashes the program."),
    (r"ClassCastException", "Runtime Error", "Invalid Object Cast",
     "An object was cast to a subclass type that it does not actually inherit from.",
     "Use 'instanceof' to verify the runtime type before casting.",
     "Treating a Cat object as if it were a Dog."),
    (r"StackOverflowError", "Logical Error", "Stack Overflow (Infinite Recursion)",
     "Infinite recursion consumed all available memory in the Java call stack.",
     "Add or fix the base condition in the recursive method so it eventually returns.",
     "Stacking blocks endlessly until the tower topples over."),
    (r"missing return statement", "Compilation Error", "Missing Return Statement",
     "A method with a non-void return type doesn't return a value in all execution paths.",
     "Ensure every code path (including if/else branches) returns a value of the declared type.",
     "Promising to deliver an answer but walking away silently."),
    (r"incompatible types", "Compilation Error", "Type Mismatch",
     "A value of one type was assigned or passed where another type is strictly required.",
     "Convert or cast the value explicitly, or fix the variable's declared type.",
     "Trying to fit a square peg into a round hole."),
    (r"unclosed string literal|unterminated string literal", "Syntax Error", "Unclosed String Literal",
     "A text string starts with a double quote but never ends with a closing double quote on the same line.",
     "Close the string with a double quote (\") before the semicolon.",
     "Opening a speech quote but forgetting to close it."),
    (r"missing\s+semicolon|expected\s+';'|missing\s*';'|SyntaxError.*semicolon", "Syntax Error", "Missing Semicolon ';'",
     "In Java, every statement must conclude with a terminating semicolon (;). Line {line_num} is missing a semicolon.",
     "Add a semicolon ';' at the end of the statement.",
     "Every sentence in Java ends with a semicolon, just like a period in English."),
]

_C_CPP_RULES = [
    (r"undefined reference to", "Compilation Error", "Undefined Reference (Linker Error)",
     "A function or variable was declared in a header or prototype, but its actual definition is missing.",
     "Implement the function body or check the function name spelling.",
     "Promising to build a house but never laying the bricks."),
    (r"expected\s+'?;'?", "Syntax Error", "Missing Semicolon",
     "Every statement in C/C++ must conclude with a semicolon (;).",
     "Add a semicolon (;) at the end of the statement on the indicated line.",
     "Like forgetting a period at the end of a sentence."),
    (r"use of undeclared identifier|undeclared .+ first use", "Compilation Error", "Undeclared Identifier",
     "A variable or function is referenced without being declared first.",
     "Declare the variable with its data type (e.g. int x;) before using it.",
     "Using a tool you haven't bought yet."),
    (r"segmentation fault|Segmentation fault", "Runtime Error", "Segmentation Fault",
     "The program attempted to read or write memory it does not have permission to access (invalid pointer or out-of-bounds array).",
     "Verify pointer initialization, check array boundaries, and ensure no NULL pointers are dereferenced.",
     "Trying to unlock someone else's front door with your key."),
    (r"no matching function for call", "Compilation Error", "No Matching Function Overload",
     "A function call does not match any existing declaration with those argument types or count.",
     "Verify the function signature and pass the expected number and types of arguments.",
     "Placing a telephone call to an invalid number."),
]


def get_rule_based_explanation(language: str, code: str, error: str) -> dict:
    """
    Return a comprehensive plain-English explanation dict for common errors using regex rules.
    Used as an offline fallback when Gemini is unavailable.
    """
    rules = {
        "python": _PYTHON_RULES,
        "java": _JAVA_RULES,
        "c": _C_CPP_RULES,
        "cpp": _C_CPP_RULES,
    }.get((language or "").lower(), _PYTHON_RULES)

    err_str = error or ""
    line_num = None
    line_match = re.search(r"(?:line\s*|:)(\d+)", err_str, re.IGNORECASE)
    if line_match:
        try:
            line_num = int(line_match.group(1))
        except Exception:
            pass

    code_lines = (code or "").splitlines()
    offending_line = ""
    if line_num and 1 <= line_num <= len(code_lines):
        offending_line = code_lines[line_num - 1]

    for item in rules:
        pattern = item[0]
        match = re.search(pattern, err_str, re.IGNORECASE)
        if match:
            error_type = item[1]
            problem = item[2]
            explanation = item[3]
            solution = item[4]
            example = item[5] if len(item) > 5 else "Check syntax and runtime bounds."

            matched_text = match.group(1) if match.groups() else ""
            explanation = explanation.replace("{match}", matched_text).replace("{line_num}", str(line_num or 'this line'))
            solution = solution.replace("{match}", matched_text).replace("{line_num}", str(line_num or 'this line'))

            fixed = offending_line.rstrip() if offending_line else ""

            # Check if compiler error contains "Did you mean '...'"
            did_you_mean = re.search(r"Did you mean '([^']+)'", err_str, re.IGNORECASE)
            if did_you_mean and matched_text and fixed:
                fixed = re.sub(r'\b' + re.escape(matched_text) + r'\b', did_you_mean.group(1), fixed)

            # Common typo dictionary if not caught by did_you_mean
            TYPE_CORRECTIONS = {
                'boolea': 'boolean', 'bolean': 'boolean', 'bool': 'boolean',
                'intt': 'int', 'interger': 'int', 'str': 'String', 'string': 'String',
                'doubl': 'double', 'flot': 'float', 'car': 'char', 'voidd': 'void',
                'whlie': 'while', 'fro': 'for', 'prntln': 'println', 'printl': 'println',
                'system': 'System'
            }
            if matched_text.lower() in TYPE_CORRECTIONS and fixed:
                fixed = re.sub(r'\b' + re.escape(matched_text) + r'\b', TYPE_CORRECTIONS[matched_text.lower()], fixed)

            if fixed:
                # 1. Check double/single quotes
                if fixed.count('"') % 2 != 0:
                    fixed += '"'
                elif fixed.count("'") % 2 != 0:
                    fixed += "'"
                # 2. Check parentheses
                open_p = fixed.count('(')
                close_p = fixed.count(')')
                if open_p > close_p:
                    fixed += ')' * (open_p - close_p)
                # 3. Check square brackets
                open_b = fixed.count('[')
                close_b = fixed.count(']')
                if open_b > close_b:
                    fixed += ']' * (open_b - close_b)
                # 4. Check semicolon for Java / C / C++
                if language in ("java", "c", "cpp"):
                    if not fixed.endswith(";") and not fixed.endswith("{") and not fixed.endswith("}"):
                        fixed += ";"

            suggested_snippet = fixed if (fixed and fixed != offending_line.rstrip()) else ""

            corrected_code = code
            if line_num and 1 <= line_num <= len(code_lines) and suggested_snippet and suggested_snippet != offending_line.rstrip() and "\n" not in suggested_snippet:
                new_lines = list(code_lines)
                new_lines[line_num - 1] = suggested_snippet
                corrected_code = "\n".join(new_lines)

            return {
                "status": "error",
                "error_type": error_type,
                "problem": problem,
                "error_message": err_str.strip().splitlines()[0] if err_str.strip() else problem,
                "line_number": line_num,
                "offending_line": offending_line,
                "explanation": explanation,
                "cause": f"Identified {problem} in {language.capitalize()} code.",
                "solution": solution,
                "suggested_fix": suggested_snippet,
                "corrected_code": corrected_code,
                "changes": [f"Fix {problem} on line {line_num or 'indicated'}"],
                "simple_example": example,
            }

    # Generic fallback
    first_line = err_str.strip().splitlines()[0][:200] if err_str.strip() else "Runtime Execution Error"
    fixed_line = offending_line.rstrip() if offending_line else ""
    if fixed_line:
        if fixed_line.count('"') % 2 != 0:
            fixed_line += '"'
        elif fixed_line.count("'") % 2 != 0:
            fixed_line += "'"
        open_p = fixed_line.count('(')
        close_p = fixed_line.count(')')
        if open_p > close_p:
            fixed_line += ')' * (open_p - close_p)
        open_b = fixed_line.count('[')
        close_b = fixed_line.count(']')
        if open_b > close_b:
            fixed_line += ']' * (open_b - close_b)
        if language in ("java", "c", "cpp"):
            if not fixed_line.endswith(";") and not fixed_line.endswith("{") and not fixed_line.endswith("}"):
                fixed_line += ";"

    corrected_code = code
    if line_num and 1 <= line_num <= len(code_lines) and fixed_line != offending_line.rstrip():
        new_lines = list(code_lines)
        new_lines[line_num - 1] = fixed_line
        corrected_code = "\n".join(new_lines)

    is_str_issue = "string" in err_str.lower() or "quote" in err_str.lower()
    is_semi_issue = "semicolon" in err_str.lower() or "missing ;" in err_str.lower()
    fallback_prob = "Unclosed String Literal (Syntax Error)" if is_str_issue else ("Missing Semicolon ';' (Syntax Error)" if is_semi_issue else "Execution Error Detected")

    return {
        "status": "error",
        "error_type": "Syntax Error" if (is_str_issue or is_semi_issue or "syntax" in err_str.lower()) else ("Runtime Error" if "exception" in err_str.lower() or "error" in err_str.lower() else "Logical Error"),
        "problem": fallback_prob,
        "error_message": first_line,
        "line_number": line_num,
        "offending_line": offending_line,
        "explanation": f"Line {line_num or '?'}: {first_line}. The system caught an unresolved syntax error.",
        "cause": "A syntax error or unclosed token prevented code compilation and execution.",
        "solution": "Close the quotation mark and terminate the statement with a semicolon." if is_str_issue else ("Add a semicolon ';' to terminate the statement." if is_semi_issue else "Examine the error message and correct the syntax."),
        "suggested_fix": fixed_line if fixed_line != offending_line.rstrip() else "",
        "corrected_code": corrected_code if corrected_code != code else None,
        "changes": ["Corrected syntax mistake on line " + str(line_num or '?')],
        "simple_example": "Like driving until reaching a closed road with no detour.",
    }


def verify_gemini_connection(api_key_override: str = None) -> dict:
    key = (api_key_override or "").strip() or settings.GEMINI_API_KEY
    if not key:
        return {
            "status": "not_configured",
            "connected": False,
            "message": "GEMINI_API_KEY is not configured.",
            "model": None
        }
    try:
        genai.configure(api_key=key)
        model = get_gemini_model(api_key_override)
        res = model.generate_content("Ping. Reply with: PONG")
        return {
            "status": "connected",
            "connected": True,
            "model": "Gemini AI",
            "message": "Connected successfully to Google Gemini AI API."
        }
    except Exception as e:
        logger.warning("Gemini verify connection failed: %s", e)
        return {
            "status": "error",
            "connected": False,
            "message": f"Gemini connection failed: {str(e)}",
            "model": None
        }


# ---------------------------------------------------------------------------
# Core AI Debugging Engine
# ---------------------------------------------------------------------------

def debug_code(
    language: str,
    code: str,
    error: str = "",
    compiler_output: Optional[str] = None,
    runtime_error: Optional[str] = None,
    terminal_output: Optional[str] = None,
    line_number: Optional[int] = None,
    stdin: Optional[str] = None,
    expected_output: Optional[str] = None,
    actual_output: Optional[str] = None,
    user_id: Optional[Any] = None,
    program_id: Optional[str] = None,
    api_key_override: str = None,
) -> dict:
    """
    Intelligent AI-powered code analysis and debugging engine.
    Analyzes code across syntax, compilation, runtime, logical, and data structure errors.
    Returns structured JSON with problem, cause, explanation, solution, changes, and corrected code.
    Saves debug session to MongoDB Atlas for user history and dashboard analytics.
    """
    combined_error = (error or "").strip()
    if terminal_output and terminal_output.strip():
        combined_error += f"\nTerminal Output:\n{terminal_output.strip()}"
    if compiler_output and compiler_output.strip():
        combined_error += f"\nCompiler Output:\n{compiler_output.strip()}"
    if runtime_error and runtime_error.strip():
        combined_error += f"\nRuntime Error:\n{runtime_error.strip()}"

    debug_id = f"dbg_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)

    # Check if there is really no error and no expected/actual mismatch
    has_output_mismatch = bool(
        expected_output and actual_output and expected_output.strip() != actual_output.strip()
    )
    is_empty_error = not combined_error.strip() and not has_output_mismatch

    if is_empty_error and (code or "").strip():
        # Verify if code has apparent logical or syntax issues
        combined_error = "User requested proactive code review and logic diagnosis."

    key = (api_key_override or "").strip() or settings.GEMINI_API_KEY
    result = None

    if key:
        try:
            model = get_gemini_model(key)
            prompt = f"""\
You are an expert programming mentor, compiler diagnostician, and code debugger.
Analyze this {language.upper()} code thoroughly:

CODE:
```{language}
{code}
```

COMPILER / RUNTIME / TERMINAL ERROR:
```
{combined_error if combined_error else "No explicit compiler error reported."}
```
{f"CUSTOM INPUT (STDIN):\n```\n{stdin}\n```" if stdin else ""}
{f"EXPECTED OUTPUT:\n```\n{expected_output}\n```" if expected_output else ""}
{f"ACTUAL OUTPUT:\n```\n{actual_output}\n```" if actual_output else ""}
{f"REPORTED ERROR LINE: {line_number}" if line_number else ""}

DIAGNOSTIC REQUIREMENTS:
1. Classify the error into exactly ONE of these categories:
   - "Syntax Error"
   - "Compilation Error"
   - "Runtime Error"
   - "Logical Error"
   - "Data Structure Error"
   - "No Error" (only if code is 100% correct and expected output matches)
2. Identify the exact 1-indexed line number where the issue originates.
3. Extract the offending line as written in original code.
4. Provide the exact single-line or localized fix snippet.
5. Provide the COMPLETE corrected code for the whole program so it compiles, runs cleanly, and produces expected output.
6. Provide a user-friendly mistake title (problem).
7. Explain in beginner-friendly, simple language WHY this error occurred.
8. Explain the step-by-step solution HOW to fix it.
9. List the specific changes made in a bulleted array.
10. Provide a simple everyday analogy or example explaining the concept to a student.

Output ONLY a raw, valid JSON object matching this schema without markdown fences:
{{
  "status": "error",
  "error_type": "Runtime Error",
  "problem": "Array Index Out of Bounds",
  "error_message": "ArrayIndexOutOfBoundsException: Index 5 out of bounds for length 5",
  "line_number": 12,
  "offending_line": "for (int i = 0; i <= arr.length; i++)",
  "suggested_fix": "for (int i = 0; i < arr.length; i++)",
  "explanation": "You are trying to access an array position that does not exist in memory.",
  "cause": "The loop is running one iteration beyond the array length.",
  "solution": "Use i < arr.length instead of i <= arr.length.",
  "changes": [
    "Changed loop condition from <= to < on line 12 to stay within array bounds"
  ],
  "simple_example": "If a bus has 5 seats numbered 0 through 4, asking for passenger seat 5 will cause an error because that seat does not exist.",
  "corrected_code": "..."
}}
"""
            response = model.generate_content(prompt)
            raw_text = response.text or ""
            clean_json = re.sub(r"^```(?:json)?\s*", "", raw_text.strip(), flags=re.IGNORECASE)
            clean_json = re.sub(r"\s*```$", "", clean_json.strip())

            parsed = json.loads(clean_json.strip())
            if isinstance(parsed, dict):
                result = parsed
                if "line_number" in result and result["line_number"] is not None:
                    try:
                        result["line_number"] = int(result["line_number"])
                    except Exception:
                        pass
        except Exception as e:
            logger.warning("Gemini debug_code failed (%s); falling back to rule-based explainer", e)

    if not result:
        result = get_rule_based_explanation(language, code, combined_error)

    result["debug_id"] = debug_id
    if "status" not in result:
        result["status"] = "error" if combined_error else "no_error"

    # Persist debugging session to MongoDB Atlas
    try:
        mongo_db = get_mongodb()
        if mongo_db is not None:
            doc = {
                "debug_id": debug_id,
                "user_id": user_id,
                "program_id": program_id,
                "language": language,
                "original_code": code,
                "error_type": result.get("error_type", "Runtime Error"),
                "error_message": result.get("error_message") or result.get("problem"),
                "problem": result.get("problem"),
                "explanation": result.get("explanation"),
                "cause": result.get("cause"),
                "solution": result.get("solution"),
                "line_number": result.get("line_number"),
                "offending_line": result.get("offending_line"),
                "suggested_fix": result.get("suggested_fix"),
                "corrected_code": result.get("corrected_code"),
                "changes": result.get("changes", []),
                "expected_output": expected_output,
                "actual_output": actual_output,
                "applied_fix": False,
                "action": "pending",
                "created_at": now,
            }
            mongo_db.debug_sessions.insert_one(doc)
            logger.info("Saved debug session %s to MongoDB Atlas for user %s", debug_id, user_id)
    except Exception as dbe:
        logger.warning("Failed to persist debug session to MongoDB: %s", dbe)

    return result


def explain_terminal_error(
    language: str,
    code: str,
    error_message: str,
    line_number: Optional[int] = None,
    terminal_output: Optional[str] = None,
    api_key_override: str = None,
) -> dict:
    """
    Dedicated terminal error analyzer providing a clear beginner explanation:
    1. What the error means
    2. Why it happened
    3. Which line caused the error
    4. What the user should change
    5. Corrected code suggestion
    6. A simple example / analogy explaining the concept
    """
    full_text = error_message
    if terminal_output:
        full_text += f"\n{terminal_output}"

    key = (api_key_override or "").strip() or settings.GEMINI_API_KEY
    if key:
        try:
            model = get_gemini_model(key)
            prompt = f"""\
You are an empathetic, beginner-friendly programming instructor.
A student ran their {language.upper()} code and the terminal produced this error:

ERROR:
```{language}
{full_text}
```

CODE:
```{language}
{code}
```
{f"LINE NUMBER: {line_number}" if line_number else ""}

Provide a beginner-friendly explanation containing:
1. Error Name (clean title)
2. What it means (in simple English with zero confusing jargon)
3. Why it happened (specifically in their code)
4. Which line caused it (1-indexed line number)
5. How to fix it (step-by-step instructions)
6. Corrected replacement code snippet
7. A simple real-world analogy or example explaining the underlying concept

Return ONLY a valid JSON object without markdown fences:
{{
  "error_type": "Runtime Error",
  "problem": "Array Index Out of Bounds",
  "explanation": "You are trying to access an array position that does not exist.",
  "cause": "Your array contains 5 elements, so valid indexes are 0 to 4. Your code attempts to access index 5.",
  "solution": "Change the loop condition from i <= arr.length to i < arr.length.",
  "line_number": {line_number or 1},
  "suggested_fix": "...",
  "simple_example": "If an elevator only goes up to the 5th floor, pressing button 6 will give you an error because the 6th floor doesn't exist."
}}
"""
            res = model.generate_content(prompt)
            clean = re.sub(r"^```(?:json)?\s*", "", (res.text or "").strip(), flags=re.IGNORECASE)
            clean = re.sub(r"\s*```$", "", clean.strip())
            parsed = json.loads(clean)
            if isinstance(parsed, dict):
                parsed["status"] = "success"
                return parsed
        except Exception as e:
            logger.warning("Gemini explain_terminal_error failed: %s", e)

    fallback = get_rule_based_explanation(language, code, full_text)
    return {
        "status": "success",
        "error_type": fallback.get("error_type", "Runtime Error"),
        "problem": fallback.get("problem", "Execution Error"),
        "explanation": fallback.get("explanation"),
        "cause": fallback.get("cause"),
        "solution": fallback.get("solution"),
        "line_number": fallback.get("line_number") or line_number,
        "suggested_fix": fallback.get("suggested_fix"),
        "simple_example": fallback.get("simple_example", "Make sure your index and variable types are valid before running."),
    }


def explain_code_deep(
    language: str,
    code: str,
    selected_code: Optional[str] = None,
    explanation_level: str = "beginner",
    api_key_override: str = None,
) -> dict:
    """
    Comprehensive code analyzer returning structured breakdown:
    - What the code does
    - Algorithm overview
    - Variables and roles
    - Functions/methods
    - Loops and conditions
    - Data structures
    - Time & Space complexity
    - Step-by-step walkthrough
    """
    target_code = selected_code.strip() if selected_code and selected_code.strip() else code
    key = (api_key_override or "").strip() or settings.GEMINI_API_KEY
    if key:
        try:
            model = get_gemini_model(key)
            prompt = f"""\
You are an expert computer science professor.
Analyze the following {language.upper()} code at a {explanation_level.upper()} level.

CODE:
```{language}
{target_code}
```

Provide a structured breakdown including:
1. Executive summary of what the code does
2. Algorithm overview
3. Key variables and their roles
4. Functions/methods breakdown
5. Loops and conditional logic
6. Data structures used
7. Time complexity with Big-O notation and clear reason
8. Space complexity with Big-O notation and clear reason
9. Step-by-step execution walkthrough

Output ONLY a valid JSON object without markdown fences:
{{
  "summary": "This program calculates the sum of all elements in an array...",
  "algorithm_overview": "Linear traversal summing values into an accumulator...",
  "variables": [
    {{"name": "arr", "type": "int[]", "role": "Stores input integers"}},
    {{"name": "sum", "type": "int", "role": "Accumulates total sum"}}
  ],
  "functions_methods": [
    {{"name": "main", "role": "Entry point that initializes array and calls helper"}}
  ],
  "loops_conditions": [
    "for loop iterating from index 0 to arr.length - 1"
  ],
  "data_structures": ["Array (1D fixed size)"],
  "time_complexity": "O(N) - visits each element in the array exactly once",
  "space_complexity": "O(1) - uses only a single integer accumulator for memory",
  "step_by_step": [
    "Step 1: Initializes array with sample values",
    "Step 2: Sets sum accumulator to 0",
    "Step 3: Loops through elements and adds each to sum",
    "Step 4: Prints total sum to console"
  ]
}}
"""
            res = model.generate_content(prompt)
            clean = re.sub(r"^```(?:json)?\s*", "", (res.text or "").strip(), flags=re.IGNORECASE)
            clean = re.sub(r"\s*```$", "", clean.strip())
            parsed = json.loads(clean)
            if isinstance(parsed, dict):
                parsed["status"] = "success"
                return parsed
        except Exception as e:
            logger.warning("Gemini explain_code_deep failed: %s", e)

    # Offline rule-based code explanation fallback
    lines = [l.strip() for l in target_code.splitlines() if l.strip()]
    return {
        "status": "success",
        "summary": f"This {language.capitalize()} program contains {len(lines)} lines of source code.",
        "algorithm_overview": "Sequential execution of statements and control flow.",
        "variables": [{"name": "Variables", "type": "Inferred", "role": "Program state variables"}],
        "functions_methods": [{"name": "Main", "role": "Main execution flow"}],
        "loops_conditions": ["Contains conditional evaluation or sequential statements"],
        "data_structures": ["Standard primitive and collection types"],
        "time_complexity": "O(N) - Typical linear time complexity for input processing",
        "space_complexity": "O(1) - Standard in-memory variable allocation",
        "step_by_step": [
            f"Line {i+1}: {line[:60]}" for i, line in enumerate(lines[:8])
        ]
    }


def analyze_logic_output(
    language: str,
    code: str,
    stdin: str,
    expected_output: str,
    actual_output: str,
    api_key_override: str = None,
) -> dict:
    """
    Dedicated logic analyzer when code executed without crash (exit code 0),
    but the actual output does not match expected output.
    """
    key = (api_key_override or "").strip() or settings.GEMINI_API_KEY
    if key:
        try:
            model = get_gemini_model(key)
            prompt = f"""\
You are an expert algorithmic logic debugger.
A student wrote this {language.upper()} code which ran without compiler or runtime crash,
but produced INCORRECT output:

CODE:
```{language}
{code}
```

INPUT (STDIN):
```
{stdin}
```

EXPECTED OUTPUT:
```
{expected_output}
```

ACTUAL OUTPUT:
```
{actual_output}
```

YOUR TASK:
1. Identify why the logic produces '{actual_output}' instead of '{expected_output}'.
2. Pinpoint the exact line number where the logical flaw occurs (e.g., inverted condition, off-by-one, wrong accumulator start value, wrong formula).
3. Provide the corrected line.
4. Provide the COMPLETE corrected code.
5. Explain in simple beginner terms what went wrong logically.
6. Detail the changes made.

Return ONLY a valid JSON object without markdown fences:
{{
  "status": "error",
  "error_type": "Logical Error",
  "problem": "Incorrect Output Calculation",
  "error_message": "Output mismatch: expected '{expected_output}' but received '{actual_output}'",
  "line_number": 5,
  "offending_line": "...",
  "suggested_fix": "...",
  "explanation": "Why the current logic generates the wrong result...",
  "cause": "The condition evaluated in reverse or loop terminated early...",
  "solution": "Update the calculation / condition to...",
  "changes": ["Modified line 5 to calculate correctly"],
  "corrected_code": "..."
}}
"""
            res = model.generate_content(prompt)
            clean = re.sub(r"^```(?:json)?\s*", "", (res.text or "").strip(), flags=re.IGNORECASE)
            clean = re.sub(r"\s*```$", "", clean.strip())
            parsed = json.loads(clean)
            if isinstance(parsed, dict):
                return parsed
        except Exception as e:
            logger.warning("Gemini analyze_logic_output failed: %s", e)

    return {
        "status": "error",
        "error_type": "Logical Error",
        "problem": "Output Logic Mismatch",
        "error_message": f"Expected output '{expected_output.strip()}' but got '{actual_output.strip()}'",
        "line_number": 1,
        "offending_line": code.splitlines()[0] if code else "",
        "suggested_fix": "Verify loop boundaries and comparison operators.",
        "explanation": f"The program executed cleanly, but the calculated result '{actual_output.strip()}' did not match your expected output '{expected_output.strip()}'.",
        "cause": "Algorithmic logic or conditional calculation error.",
        "solution": "Review variable transformations and check edge cases.",
        "changes": ["Review the core algorithm statements"],
        "corrected_code": code
    }


def record_debug_action(debug_id: str, action: str, user_id: Any = None) -> bool:
    """
    Record whether the user applied, copied, undid, or ignored the AI fix.
    """
    try:
        mongo_db = get_mongodb()
        if mongo_db is not None and debug_id:
            now = datetime.now(timezone.utc)
            mongo_db.debug_sessions.update_one(
                {"debug_id": debug_id},
                {"$set": {"action": action, "applied_fix": action == "applied", "updated_at": now}}
            )
            # If user applied fix, log to activities
            if user_id and action == "applied":
                mongo_db.activities.insert_one({
                    "user_id": user_id,
                    "activity_type": "debug_fix_applied",
                    "title": "Applied AI Code Fix",
                    "description": f"Applied AI debugging fix for session {debug_id}",
                    "duration_seconds": 60.0,
                    "started_at": now,
                    "completed_at": now,
                    "status": "completed",
                    "created_at": now,
                })
            return True
    except Exception as e:
        logger.warning("Error recording debug action: %s", e)
    return False


def get_debug_stats(user_id: Any = None) -> dict:
    """
    Retrieve aggregated AI debugging metrics for dashboard cards and charts.
    """
    default_stats = {
        "total_sessions": 0,
        "errors_fixed": 0,
        "syntax_errors": 0,
        "runtime_errors": 0,
        "logical_errors": 0,
        "compilation_errors": 0,
        "data_structure_errors": 0,
        "most_common_errors": [],
        "recent_sessions": []
    }
    try:
        mongo_db = get_mongodb()
        if mongo_db is None:
            return default_stats

        query = {}
        if user_id:
            try:
                u_int = int(user_id)
                query = {"$or": [{"user_id": u_int}, {"user_id": str(user_id)}]}
            except Exception:
                query = {"user_id": user_id}

        total_sessions = mongo_db.debug_sessions.count_documents(query)
        fixed_query = {**query, "applied_fix": True}
        errors_fixed = mongo_db.debug_sessions.count_documents(fixed_query)

        def count_type(err_type):
            return mongo_db.debug_sessions.count_documents({**query, "error_type": err_type})

        syntax_count = count_type("Syntax Error")
        runtime_count = count_type("Runtime Error")
        logical_count = count_type("Logical Error")
        comp_count = count_type("Compilation Error")
        ds_count = count_type("Data Structure Error")

        # Top error titles
        pipeline = [
            {"$match": query},
            {"$group": {"_id": "$problem", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 5}
        ]
        top_errors = list(mongo_db.debug_sessions.aggregate(pipeline))
        most_common = [{"name": str(item["_id"] or "General Error"), "count": item["count"]} for item in top_errors]

        # Recent 6 sessions
        recent = list(
            mongo_db.debug_sessions.find(query, {
                "debug_id": 1,
                "problem": 1,
                "error_type": 1,
                "language": 1,
                "applied_fix": 1,
                "created_at": 1,
                "_id": 0
            }).sort("created_at", -1).limit(6)
        )

        return {
            "total_sessions": total_sessions,
            "errors_fixed": errors_fixed,
            "syntax_errors": syntax_count,
            "runtime_errors": runtime_count,
            "logical_errors": logical_count,
            "compilation_errors": comp_count,
            "data_structure_errors": ds_count,
            "most_common_errors": most_common,
            "recent_sessions": recent
        }
    except Exception as e:
        logger.warning("Error fetching debug stats: %s", e)
        return default_stats


# ---------------------------------------------------------------------------
# Backward-compatible explain_code & flowchart visualizer
# ---------------------------------------------------------------------------

def explain_code(language: str, code: str, explanation_level: str = "intermediate") -> str:
    res = explain_code_deep(language, code, explanation_level=explanation_level)
    return res.get("summary") or "Code analysis complete."


_MERMAID_STARTS = (
    "flowchart", "graph", "sequencediagram", "classDiagram",
    "stateDiagram", "erDiagram", "gantt", "pie", "gitGraph", "mindmap",
)

def _extract_mermaid(text: str) -> str:
    if not text:
        return ""
    m = re.search(r"```mermaid\s*\n([\s\S]*?)```", text, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    m = re.search(r"```[^\n]*\n([\s\S]*?)```", text)
    if m:
        candidate = m.group(1).strip()
        if any(candidate.lower().startswith(kw.lower()) for kw in _MERMAID_STARTS):
            return candidate
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
    if not label:
        return '""'
    label = label.strip()
    if label.startswith('"') and label.endswith('"') and len(label) >= 2:
        label = label[1:-1]
    label = label.replace('"', "'")
    label = label.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    label = label.replace('\r\n', '<br/>').replace('\n', '<br/>')
    return f'"{label}"'


def _sanitize_mermaid_line(line: str) -> str:
    line_str = line.strip()
    if not line_str or line_str.startswith("%%"):
        return line
    lower_line = line_str.lower()
    if any(lower_line.startswith(kw) for kw in _MERMAID_STARTS):
        return line_str

    SHAPES = [
        (r'\(\(', r'\)\)', '((', '))'),
        (r'\[\[', r'\]\]', '[[', ']]'),
        (r'\[\(', r'\)\]', '[(', ')]'),
        (r'\(\[', r'\]\)', '([', '])'),
        (r'\{\{', r'\}\}', '{{', '}}'),
        (r'\[/',  r'/\]',  '[/', '/]'),
        (r'\[\\', r'\\\]', '[\\', '\\]'),
        (r'\[/',  r'\\\]', '[/', '\\]'),
        (r'\[\\', r'/\]',  '[\\', '/]'),
        (r'>',    r'\]',   '>',  ']'),
        (r'\[',   r'\]',   '[',  ']'),
        (r'\{',   r'\}',   '{',  '}'),
        (r'\(',   r'\)',   '(',  ')'),
    ]

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


def visualize_code(language: str, code: str, api_key_override: str = None) -> str:
    try:
        model = get_gemini_model(api_key_override)
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
        extracted = _extract_mermaid(raw)
        sanitized = _sanitize_mermaid(extracted)
        return sanitized
    except Exception as e:
        logger.error("visualize_code error: %s", e)
        return f'flowchart TD\n    E["AI Service Error: {str(e)[:80]}"]'


def heuristic_complexity_analysis(language: str, code: str) -> dict:
    code_clean = re.sub(r'//.*|/\*.*?\*/|#.*', '', code, flags=re.DOTALL)
    lines = [l.strip() for l in code_clean.splitlines() if l.strip()]

    # Detect loops
    for_count = len(re.findall(r'\bfor\s*\(|\bfor\s+\w+\s+in\b', code_clean))
    while_count = len(re.findall(r'\bwhile\s*\(|\bwhile\s+', code_clean))
    total_loops = for_count + while_count

    # Check loop nesting depth
    nesting_depth = 0
    curr_depth = 0
    for line in lines:
        if re.search(r'\b(for|while)\b', line):
            curr_depth += 1
            if curr_depth > nesting_depth:
                nesting_depth = curr_depth
        if '}' in line or (language.lower() == 'python' and line.startswith('return')):
            curr_depth = max(0, curr_depth - 1)

    has_sqrt_loop = bool(re.search(r'i\s*\*\s*i\s*<=|Math\.sqrt|sqrt\(', code_clean))
    has_half_loop = bool(re.search(r'num\s*/\s*2|n\s*/\s*2|length\s*/\s*2', code_clean))
    has_log_division = bool(re.search(r'/\s*10|/=\s*10|>>=|<<=|/\s*2|/=\s*2', code_clean))
    has_recursion = bool(re.search(r'\b(\w+)\s*\(.*?\b\1\s*\(', code_clean))

    has_dynamic_array = bool(re.search(r'new\s+(int|String|ArrayList|List|int\[\]|vector|list)|\[\]\s*=|append\(', code_clean))
    has_hash_map = bool(re.search(r'HashMap|HashSet|Map|Set|dict\(|\{\}', code_clean))

    if has_recursion:
        time_comp = "O(2^N)"
        time_best = "O(1)"
        time_worst = "O(2^N)"
        time_avg = "O(2^N)"
        category = "Exponential"
        ops_formula = "f(N) = 2^N"
        time_expl = "Recursive branching calls itself multiple times per step, forming a recursion tree."
    elif nesting_depth >= 2 or (for_count >= 2 and total_loops >= 2 and 'i' in code_clean and 'j' in code_clean):
        time_comp = "O(N^2)"
        time_best = "O(N)"
        time_worst = "O(N^2)"
        time_avg = "O(N^2)"
        category = "Quadratic"
        ops_formula = "f(N) = N^2"
        time_expl = "Nested iteration loops iterate over the data set for each outer element, resulting in quadratic growth."
    elif has_sqrt_loop:
        time_comp = "O(√N)"
        time_best = "O(1)"
        time_worst = "O(√N)"
        time_avg = "O(√N)"
        category = "Square Root"
        ops_formula = "f(N) = √N"
        time_expl = "Loop terminates at the square root of N, significantly reducing operational checks."
    elif has_half_loop or total_loops == 1:
        if has_log_division and total_loops == 1 and ('num = num /' in code_clean or 'num /= ' in code_clean or 'n = n /' in code_clean):
            time_comp = "O(log N)"
            time_best = "O(1)"
            time_worst = "O(log N)"
            time_avg = "O(log N)"
            category = "Logarithmic"
            ops_formula = "f(N) = log10(N)"
            time_expl = "The loop divides the input value by 10 (or 2) each cycle, reducing digits logarithmically."
        else:
            time_comp = "O(N)"
            time_best = "O(1)"
            time_worst = "O(N)"
            time_avg = "O(N)"
            category = "Linear"
            ops_formula = "f(N) = N / 2" if has_half_loop else "f(N) = N"
            time_expl = "Linear iteration checks values proportional to input size N."
    else:
        time_comp = "O(1)"
        time_best = "O(1)"
        time_worst = "O(1)"
        time_avg = "O(1)"
        category = "Constant"
        ops_formula = "f(N) = 1"
        time_expl = "Code executes in constant time with a fixed set of operations independent of input magnitude."

    if has_hash_map or has_dynamic_array:
        space_comp = "O(N)"
        aux_space = "O(N)"
        space_expl = "Allocates linear auxiliary storage (arrays or hash structures) scaling with input size."
    elif has_recursion:
        space_comp = "O(N)"
        aux_space = "O(N)"
        space_expl = "Recursion stack frames scale linearly with the maximum call depth."
    else:
        space_comp = "O(1)"
        aux_space = "O(1)"
        space_expl = "Uses constant auxiliary memory (O(1)) with only primitive stack variables."

    n_values = [10, 50, 100, 500, 1000, 10000]
    benchmarks = []
    for n in n_values:
        if time_comp == "O(1)":
            c_ops = 1
        elif time_comp == "O(log N)":
            c_ops = round(math.log10(max(1, n)) * 3)
        elif time_comp == "O(√N)":
            c_ops = round(math.isqrt(n))
        elif time_comp == "O(N)":
            c_ops = round(n / 2 if has_half_loop else n)
        elif time_comp == "O(N^2)":
            c_ops = min(1000000, n * n)
        else:
            c_ops = min(1000000, 2 ** min(20, n))

        opt_ops = round(math.isqrt(n)) if time_comp in ("O(N)", "O(N^2)") else max(1, round(math.log2(n)))
        brute_ops = min(1000000, n * n) if time_comp != "O(N^2)" else min(1000000, n ** 3)

        benchmarks.append({
            "n": n,
            "current_ops": float(c_ops),
            "optimal_ops": float(opt_ops),
            "brute_ops": float(brute_ops)
        })

    is_prime_check = bool(re.search(r'prime|num\s*%\s*i', code_clean, re.IGNORECASE))
    is_reverse = bool(re.search(r'rev\s*=|digit\s*=|num\s*%\s*10', code_clean, re.IGNORECASE))

    if is_prime_check:
        alts = [
            {
                "name": "Current Approach (Trial Division to N/2)",
                "approach_type": "current",
                "time_complexity": "O(N)",
                "space_complexity": "O(1)",
                "pros": "Simple to implement and intuitively straightforward.",
                "cons": "Redundant checks: factors greater than √N already have paired factors below √N.",
                "code": "for (int i = 2; i <= num / 2; i++) {\n    if (num % i == 0) return false;\n}",
                "speedup_factor": "1x (Baseline)"
            },
            {
                "name": "Optimal Square Root Trial Division",
                "approach_type": "optimal",
                "time_complexity": "O(√N)",
                "space_complexity": "O(1)",
                "pros": "Drastically reduces iterations from N/2 to √N (e.g. for N=10,000: 5,000 steps down to 100).",
                "cons": "Slightly more mathematical awareness needed.",
                "code": "for (int i = 2; i * i <= num; i++) {\n    if (num % i == 0) return false;\n}",
                "speedup_factor": "50x - 300x faster for large N"
            },
            {
                "name": "6k ± 1 Optimized Prime Check",
                "approach_type": "tradeoff",
                "time_complexity": "O(√N / 3)",
                "space_complexity": "O(1)",
                "pros": "Skips all multiples of 2 and 3, testing only numbers of form 6k±1. 3x faster than standard √N.",
                "cons": "Requires special handling for 2 and 3.",
                "code": "if (num <= 3) return num > 1;\nif (num % 2 == 0 || num % 3 == 0) return false;\nfor (int i = 5; i * i <= num; i += 6) {\n    if (num % i == 0 || num % (i + 2) == 0) return false;\n}",
                "speedup_factor": "3x faster than √N"
            }
        ]
        opts = [
            {
                "title": "Square Root Boundary Pruning (i * i <= N)",
                "description": "Every composite number N has a prime divisor p ≤ √N. Replacing i <= num / 2 with i * i <= num cuts operations by up to 99%.",
                "impact": "High (99% fewer loop cycles)",
                "technique_type": "Mathematical Pruning",
                "code_example": "for (int i = 2; i * i <= num; i++)"
            },
            {
                "title": "Immediate Early Break on Divisibility",
                "description": "Ensure an immediate break or return false as soon as a factor is found to avoid running subsequent loop iterations.",
                "impact": "High (Instant for even numbers)",
                "technique_type": "Early Exit",
                "code_example": "if (num % i == 0) { prime = false; break; }"
            },
            {
                "title": "Pre-check Even Numbers",
                "description": "Filter out num % 2 == 0 upfront and increment by 2 in the loop (i += 2) to cut comparisons in half.",
                "impact": "Medium (50% reduction)",
                "technique_type": "Step-Skip Optimization",
                "code_example": "if (num % 2 == 0) return num == 2;\nfor (int i = 3; i * i <= num; i += 2)"
            }
        ]
    elif is_reverse:
        alts = [
            {
                "name": "Current Approach (Iterative Modulo & Division)",
                "approach_type": "current",
                "time_complexity": "O(log10 N)",
                "space_complexity": "O(1)",
                "pros": "Optimal mathematical reversal without string memory allocations.",
                "cons": "Must guard against 32-bit integer overflow.",
                "code": "while (num != 0) {\n    rev = rev * 10 + num % 10;\n    num /= 10;\n}",
                "speedup_factor": "1x (Optimal Time)"
            },
            {
                "name": "String Conversion & Reversal",
                "approach_type": "tradeoff",
                "time_complexity": "O(log10 N)",
                "space_complexity": "O(log10 N)",
                "pros": "High-level, readable in 1 line.",
                "cons": "Heap memory allocation for StringBuilder / string copies.",
                "code": "new StringBuilder(String.valueOf(num)).reverse().toString();",
                "speedup_factor": "Slower due to string allocation"
            }
        ]
        opts = [
            {
                "title": "Prevent Integer Overflow",
                "description": "In 32-bit environments, verify rev > Integer.MAX_VALUE / 10 before multiplying by 10 to prevent numeric wraparound.",
                "impact": "High (Correctness & Safety)",
                "technique_type": "Boundary Guard",
                "code_example": "if (rev > Integer.MAX_VALUE / 10) return 0;"
            }
        ]
    else:
        alts = [
            {
                "name": "Current Implementation",
                "approach_type": "current",
                "time_complexity": time_comp,
                "space_complexity": space_comp,
                "pros": "Direct implementation solving the stated task.",
                "cons": "May scale sub-optimally with larger datasets.",
                "code": code.strip()[:160] + "...",
                "speedup_factor": "1x (Baseline)"
            },
            {
                "name": "Optimal Algorithmic Alternative",
                "approach_type": "optimal",
                "time_complexity": "O(log N)" if time_comp == "O(N)" else ("O(N log N)" if time_comp == "O(N^2)" else "O(1)"),
                "space_complexity": "O(1)",
                "pros": "Reduces computational order of magnitude for enterprise-scale inputs.",
                "cons": "May require extra preprocessing or auxiliary hash table.",
                "code": "// Optimized variant utilizing caching or binary search\n// Achieves lower asymptotic complexity",
                "speedup_factor": "10x - 1000x faster for large datasets"
            }
        ]
        opts = [
            {
                "title": "Algorithmic Reduction",
                "description": "Examine loop termination and indexing to convert linear scans into logarithmic or constant time lookups.",
                "impact": "High",
                "technique_type": "Complexity Reduction",
                "code_example": "// Replace nested scan with Hash Map or Binary Search"
            },
            {
                "title": "In-Place Memory Reuse",
                "description": "Avoid duplicate array allocations and preserve O(1) auxiliary space.",
                "impact": "Medium",
                "technique_type": "Space Optimization",
                "code_example": "// Mutate existing pointers or variables in place"
            }
        ]

    return {
        "status": "success",
        "time_complexity": time_comp,
        "time_complexity_best": time_best,
        "time_complexity_worst": time_worst,
        "time_complexity_average": time_avg,
        "space_complexity": space_comp,
        "auxiliary_space": aux_space,
        "complexity_category": category,
        "time_explanation": time_expl,
        "space_explanation": space_expl,
        "operations_formula": ops_formula,
        "benchmarks": benchmarks,
        "alternatives": alts,
        "optimizations": opts
    }


def analyze_code_complexity(
    language: str,
    code: str,
    problem_context: Optional[str] = None,
    api_key_override: str = None
) -> dict:
    """
    Comprehensive Code Complexity & Performance Analyzer.
    Analyzes Time & Space Complexity, generates performance benchmark points for graphing,
    compares alternative solutions, and suggests optimization techniques.
    """
    key = (api_key_override or "").strip() or settings.GEMINI_API_KEY
    if key:
        try:
            model = get_gemini_model(key)
            prompt = f"""You are an expert Computer Science Professor and Algorithms Architect.
Analyze the time complexity, space complexity, alternative solutions, and optimization techniques for this {language.upper()} code.

CODE:
```{language}
{code}
```

Respond ONLY with a valid JSON object matching this schema without markdown fences:
{{
  "status": "success",
  "time_complexity": "O(N)",
  "time_complexity_best": "O(1)",
  "time_complexity_worst": "O(N)",
  "time_complexity_average": "O(N)",
  "space_complexity": "O(1)",
  "auxiliary_space": "O(1)",
  "complexity_category": "Linear",
  "time_explanation": "Detailed explanation of why this time complexity occurs based on loops and operations.",
  "space_explanation": "Detailed explanation of memory usage, stack frames, and auxiliary storage.",
  "operations_formula": "f(N) = N / 2",
  "benchmarks": [
    {{"n": 10, "current_ops": 5.0, "optimal_ops": 3.0, "brute_ops": 100.0}},
    {{"n": 50, "current_ops": 25.0, "optimal_ops": 7.0, "brute_ops": 2500.0}},
    {{"n": 100, "current_ops": 50.0, "optimal_ops": 10.0, "brute_ops": 10000.0}},
    {{"n": 500, "current_ops": 250.0, "optimal_ops": 22.0, "brute_ops": 250000.0}},
    {{"n": 1000, "current_ops": 500.0, "optimal_ops": 31.0, "brute_ops": 1000000.0}},
    {{"n": 10000, "current_ops": 5000.0, "optimal_ops": 100.0, "brute_ops": 1000000.0}}
  ],
  "alternatives": [
    {{
      "name": "Current Approach",
      "approach_type": "current",
      "time_complexity": "O(N)",
      "space_complexity": "O(1)",
      "pros": "Simple to implement",
      "cons": "Redundant loop iterations",
      "code": "// current code snippet",
      "speedup_factor": "1x"
    }},
    {{
      "name": "Optimal Approach",
      "approach_type": "optimal",
      "time_complexity": "O(√N)",
      "space_complexity": "O(1)",
      "pros": "Significantly faster for large inputs",
      "cons": "Requires math property",
      "code": "// optimal code snippet",
      "speedup_factor": "50x faster"
    }}
  ],
  "optimizations": [
    {{
      "title": "Technique Title",
      "description": "Technique description",
      "impact": "High",
      "technique_type": "Mathematical Pruning",
      "code_example": "// example code snippet"
    }}
  ]
}}
"""
            res = model.generate_content(prompt)
            clean = re.sub(r"^```(?:json)?\s*", "", (res.text or "").strip(), flags=re.IGNORECASE)
            clean = re.sub(r"\s*```$", "", clean.strip())
            parsed = json.loads(clean)
            if isinstance(parsed, dict) and "time_complexity" in parsed:
                parsed["status"] = "success"
                return parsed
        except Exception as e:
            logger.warning("Gemini analyze_code_complexity failed: %s, falling back to heuristic engine", e)

    # Heuristic fallback engine
    return heuristic_complexity_analysis(language, code)
