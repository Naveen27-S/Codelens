import requests
import sys

BASE_URL = "http://localhost:8000/api"

def run_stdin_tests():
    print("==================================================")
    print("STARTING INTERACTIVE STDIN / USER INPUT TESTS")
    print("==================================================")

    # 1. Login test user
    login_res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "test_executor_new_9@example.com",
        "password": "SecurePassword123!"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # TEST 1: Java with Scanner & two integers on separate lines
    print("\nTEST 1: Java Scanner with multiline integers (10\\n20)...")
    java_code = """import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int a = sc.nextInt();
        int b = sc.nextInt();
        System.out.println(a + b);
        sc.close();
    }
}"""
    res1 = requests.post(f"{BASE_URL}/execute", headers=headers, json={
        "language": "java",
        "code": java_code,
        "input": "10\n20",
        "program_name": "Java Addition Scanner"
    })
    print(f"Status code: {res1.status_code}")
    print(f"Response: {res1.json()}")
    assert res1.status_code == 200
    assert res1.json()["status"] == "success"
    assert res1.json()["stdout"].strip() == "30"

    # TEST 2: Java with Scanner and space-separated integers
    print("\nTEST 2: Java Scanner with space-separated integers (15 35)...")
    res2 = requests.post(f"{BASE_URL}/execute", headers=headers, json={
        "language": "java",
        "code": java_code,
        "input": "15 35",
        "program_name": "Java Space Addition"
    })
    print(f"Status code: {res2.status_code}")
    print(f"Response: {res2.json()}")
    assert res2.status_code == 200
    assert res2.json()["status"] == "success"
    assert res2.json()["stdout"].strip() == "50"

    # TEST 3: Java with String / nextLine()
    print("\nTEST 3: Java String nextLine() input...")
    java_str_code = """import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String name = sc.nextLine();
        System.out.println("Hello " + name);
        sc.close();
    }
}"""
    res3 = requests.post(f"{BASE_URL}/execute", headers=headers, json={
        "language": "java",
        "code": java_str_code,
        "input": "Naveen Prasana",
        "program_name": "Java String Greeting"
    })
    print(f"Status code: {res3.status_code}")
    print(f"Response: {res3.json()}")
    assert res3.status_code == 200
    assert res3.json()["status"] == "success"
    assert res3.json()["stdout"].strip() == "Hello Naveen Prasana"

    # TEST 4: Python input() with multiple lines
    print("\nTEST 4: Python multiple line inputs...")
    python_code = """a = int(input())
b = int(input())
c = int(input())
print("SUM:", a + b + c)"""
    res4 = requests.post(f"{BASE_URL}/execute", headers=headers, json={
        "language": "python",
        "code": python_code,
        "input": "100\n200\n300",
        "program_name": "Python 3-number Sum"
    })
    print(f"Status code: {res4.status_code}")
    print(f"Response: {res4.json()}")
    assert res4.status_code == 200
    assert res4.json()["status"] == "success"
    assert "SUM: 600" in res4.json()["stdout"]

    # TEST 5: Insufficient input handling (graceful timeout)
    print("\nTEST 5: Insufficient input handling (Scanner waiting for 2nd int)...")
    res5 = requests.post(f"{BASE_URL}/execute", headers=headers, json={
        "language": "java",
        "code": java_code,
        "input": "10",  # Missing 2nd integer
        "program_name": "Java Insufficient Input"
    })
    print(f"Status code: {res5.status_code}")
    print(f"Response: {res5.json()}")
    assert res5.status_code == 200
    # Should either be timeout or runtime_error (NoSuchElementException)
    assert res5.json()["status"] in ["timeout", "runtime_error"]

    print("\n==================================================")
    print("ALL STDIN TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_stdin_tests()
