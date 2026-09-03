import requests
import json
import time
import sys
from pymongo import MongoClient

BASE_URL = "http://localhost:8000/api"

def run_tests():
    print("==================================================")
    print("STARTING E2E CODE EXECUTION ENGINE TESTS")
    print("==================================================")

    # 1. Register / Login test user
    email = "test_executor_new_9@example.com"
    password = "SecurePassword123!"
    full_name = "Test Executor"

    print("Step 1: Authenticating/Registering test user...")
    token = None
    try:
        # Try register (fails if email already exists, which is fine)
        reg_res = requests.post(f"{BASE_URL}/auth/register", json={
            "full_name": full_name,
            "email": email,
            "password": password
        })
        
        # Log in to fetch access token
        login_res = requests.post(f"{BASE_URL}/auth/login", json={
            "email": email,
            "password": password
        })
        if login_res.status_code == 200:
            print("Successfully logged in user.")
            token = login_res.json()["access_token"]
        else:
            print(f"Auth login failed: {login_res.text}")
            sys.exit(1)
    except Exception as e:
        print(f"Auth request failed: {e}")
        sys.exit(1)

    headers = {"Authorization": f"Bearer {token}"}

    # Setup MongoDB client for verification later
    client = MongoClient("mongodb://localhost:27017")
    db = client["codelens_db"]

    # TEST 1: Python simple execution
    print("\nTEST 1: Python simple execution...")
    res = requests.post(f"{BASE_URL}/execute", headers=headers, json={
        "language": "python",
        "code": "print('Hello CodeLens')",
        "input": ""
    })
    print(f"Status code: {res.status_code}")
    print(f"Response: {res.json()}")
    assert res.json()["status"] == "success"
    assert "Hello CodeLens" in res.json()["stdout"]

    # TEST 2: Python variables
    print("\nTEST 2: Python simple arithmetic...")
    res = requests.post(f"{BASE_URL}/execute", headers=headers, json={
        "language": "python",
        "code": "a = 10\nb = 20\nprint(a + b)",
        "input": ""
    })
    print(f"Status code: {res.status_code}")
    print(f"Response: {res.json()}")
    assert res.json()["status"] == "success"
    assert "30" in res.json()["stdout"]

    # TEST 3: Python runtime error
    print("\nTEST 3: Python runtime error...")
    res = requests.post(f"{BASE_URL}/execute", headers=headers, json={
        "language": "python",
        "code": "print(x)",
        "input": ""
    })
    print(f"Status code: {res.status_code}")
    print(f"Response: {res.json()}")
    assert res.json()["status"] == "runtime_error"
    assert "NameError" in res.json()["stderr"]

    # TEST 4: Python timeout
    print("\nTEST 4: Python execution timeout...")
    res = requests.post(f"{BASE_URL}/execute", headers=headers, json={
        "language": "python",
        "code": "import time\nwhile True:\n    pass",
        "input": ""
    })
    print(f"Status code: {res.status_code}")
    print(f"Response: {res.json()}")
    assert res.json()["status"] == "timeout"
    assert "timed out" in res.json()["stderr"]

    # TEST 5: Java successful execution
    print("\nTEST 5: Java execution...")
    java_code = """
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java");
    }
}
"""
    res = requests.post(f"{BASE_URL}/execute", headers=headers, json={
        "language": "java",
        "code": java_code,
        "input": ""
    })
    print(f"Status code: {res.status_code}")
    print(f"Response: {res.json()}")
    assert res.json()["status"] == "success"
    assert "Hello from Java" in res.json()["stdout"]

    # TEST 6: Java compilation error
    print("\nTEST 6: Java compilation error...")
    java_bad_code = """
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java") // missing semicolon
    }
}
"""
    res = requests.post(f"{BASE_URL}/execute", headers=headers, json={
        "language": "java",
        "code": java_bad_code,
        "input": ""
    })
    print(f"Status code: {res.status_code}")
    print(f"Response: {res.json()}")
    assert res.json()["status"] == "compilation_error"
    assert "error" in res.json()["stderr"]

    # TEST 7 & 8: C compile error (fallback since gcc is missing)
    print("\nTEST 7 & 8: C execution (gcc missing fallback)...")
    res = requests.post(f"{BASE_URL}/execute", headers=headers, json={
        "language": "c",
        "code": '#include <stdio.h>\nint main() { printf("Hello C"); return 0; }',
        "input": ""
    })
    print(f"Status code: {res.status_code}")
    print(f"Response: {res.json()}")
    # Since gcc is missing, it must return a compilation_error with friendly message
    assert res.json()["status"] == "compilation_error"
    assert "gcc" in res.json()["stderr"]

    # TEST 9 & 10: C++ compile error (fallback since g++ is missing)
    print("\nTEST 9 & 10: C++ execution (g++ missing fallback)...")
    res = requests.post(f"{BASE_URL}/execute", headers=headers, json={
        "language": "cpp",
        "code": '#include <iostream>\nint main() { std::cout << "Hello C++"; return 0; }',
        "input": ""
    })
    print(f"Status code: {res.status_code}")
    print(f"Response: {res.json()}")
    assert res.json()["status"] == "compilation_error"
    assert "g++" in res.json()["stderr"]

    # TEST 11: Stdin input support
    print("\nTEST 11: Stdin input support...")
    res = requests.post(f"{BASE_URL}/execute", headers=headers, json={
        "language": "python",
        "code": "name = input()\nprint('Hello', name)",
        "input": "Naveen"
    })
    print(f"Status code: {res.status_code}")
    print(f"Response: {res.json()}")
    assert res.json()["status"] == "success"
    assert "Hello Naveen" in res.json()["stdout"]

    # TEST 12: Unauthenticated request
    print("\nTEST 12: Unauthenticated request...")
    res = requests.post(f"{BASE_URL}/execute", json={
        "language": "python",
        "code": "print('fail')",
        "input": ""
    })
    print(f"Status code: {res.status_code}")
    print(f"Response (expecting 401): {res.text}")
    assert res.status_code == 401

    # TEST 13: Verify execution record appears in MongoDB
    print("\nTEST 13: Verifying MongoDB executions collection...")
    # Fetch execution from MongoDB
    exec_doc = db.executions.find_one({"language": "python", "input": "Naveen"})
    print(f"Found document: {exec_doc}")
    assert exec_doc is not None
    assert exec_doc["status"] == "success"
    assert "Naveen" in exec_doc["stdout"]

    # TEST 14: Verify activity record appears in MongoDB
    print("\nTEST 14: Verifying MongoDB activities collection...")
    act_doc = db.activities.find_one({"language": "python", "activity_type": "code_execution"})
    print(f"Found activity log: {act_doc}")
    assert act_doc is not None
    assert act_doc["status"] in ["completed", "error"]

    # TEST 15: Verify another user cannot access execution history
    print("\nTEST 15: Cross-user permission boundaries...")
    # Create another user session
    email_other = "other_user_9@example.com"
    reg_other = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Other User",
        "email": email_other,
        "password": password
    })
    
    login_other = requests.post(f"{BASE_URL}/auth/login", json={
        "email": email_other,
        "password": password
    })
    token_other = login_other.json()["access_token"]

    headers_other = {"Authorization": f"Bearer {token_other}"}
    
    # Try fetching the first user's execution details using the second user's credentials
    exec_id = exec_doc["execution_id"]
    res_other = requests.get(f"{BASE_URL}/executions/{exec_id}", headers=headers_other)
    print(f"Status code (expecting 403): {res_other.status_code}")
    print(f"Response: {res_other.text}")
    assert res_other.status_code == 403

    # TEST 16: Verify paginated GET /api/executions
    print("\nTEST 16: Paginated execution history & stats...")
    res_list = requests.get(f"{BASE_URL}/executions?page=1&limit=5", headers=headers)
    print(f"Status code: {res_list.status_code}")
    list_json = res_list.json()
    print(f"Response stats: {list_json.get('stats')}, items count: {len(list_json.get('items', []))}")
    assert res_list.status_code == 200
    assert "items" in list_json
    assert "stats" in list_json
    assert list_json["stats"]["total"] >= 1
    assert list_json["stats"]["successful"] >= 1
    assert len(list_json["items"]) <= 5
    # Verify newest first sorting
    if len(list_json["items"]) >= 2:
        assert list_json["items"][0]["created_at"] >= list_json["items"][1]["created_at"]

    # TEST 17: Verify GET /api/executions/{execution_id}
    print("\nTEST 17: Fetch execution detail...")
    res_detail = requests.get(f"{BASE_URL}/executions/{exec_id}", headers=headers)
    print(f"Status code: {res_detail.status_code}")
    detail_json = res_detail.json()
    assert res_detail.status_code == 200
    assert detail_json["execution_id"] == exec_id
    assert detail_json["language"] == "python"
    assert detail_json["input"] == "Naveen"

    # TEST 18: Verify DELETE /api/executions/{execution_id}
    print("\nTEST 18: Delete execution record...")
    # Attempt delete with other user (should be 403)
    res_del_forbidden = requests.delete(f"{BASE_URL}/executions/{exec_id}", headers=headers_other)
    assert res_del_forbidden.status_code == 403

    # Delete with owner
    res_del = requests.delete(f"{BASE_URL}/executions/{exec_id}", headers=headers)
    print(f"Status code: {res_del.status_code}")
    assert res_del.status_code == 200
    # Confirm it's gone
    res_gone = requests.get(f"{BASE_URL}/executions/{exec_id}", headers=headers)
    assert res_gone.status_code == 404

    print("\n==================================================")
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()

