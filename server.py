"""
server.py
----------
Flask server exposing two endpoints:
  POST /run-code    → Runs code, returns AI error diagnosis if it fails
  POST /apply-fix   → Replaces the editor code with AI fix and re-runs
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from ai_error_engine import analyze_and_fix

app = Flask(__name__)
CORS(app)   # Allow requests from your frontend


@app.route("/run-code", methods=["POST"])
def run_code():
    """
    Accepts:  { "code": "...", "language": "python" }
    Returns:  Full diagnosis JSON from ai_error_engine.analyze_and_fix()
    """
    body = request.get_json(force=True)
    code = body.get("code", "").strip()
    language = body.get("language", "python").strip()

    if not code:
        return jsonify({"error": "No code provided"}), 400

    result = analyze_and_fix(code, language)
    return jsonify(result)


@app.route("/apply-fix", methods=["POST"])
def apply_fix():
    """
    Accepts:  { "fixed_code": "...", "language": "python" }
    Re-runs the fixed code to confirm it works and returns the result.
    """
    body = request.get_json(force=True)
    fixed_code = body.get("fixed_code", "").strip()
    language = body.get("language", "python").strip()

    if not fixed_code:
        return jsonify({"error": "No fixed code provided"}), 400

    # Re-run the fixed code to verify it truly passes
    result = analyze_and_fix(fixed_code, language)
    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
