import google.generativeai as genai
from ..core.config import settings

def get_gemini_model():
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set")
    genai.configure(api_key=settings.GEMINI_API_KEY)
    # Use gemini-2.5-flash as default, or whatever is preferred
    return genai.GenerativeModel('gemini-2.5-flash')

def explain_code(language: str, code: str) -> str:
    try:
        model = get_gemini_model()
        prompt = f"""
        Explain the following {language} code. 
        Focus on:
        - what the code does
        - important logic
        - functions and variables
        - time complexity where appropriate
        - space complexity where appropriate
        
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
