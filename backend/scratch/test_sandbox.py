"""
Quick smoke test for the LocalSandbox.
Run from the backend/ directory:
    python scratch/test_sandbox.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.sandbox_service import LocalSandbox

sandbox = LocalSandbox()

print("=" * 60)
print("TEST 1 — Python: Hello world")
r = sandbox.execute("python", 'print("Hello CodeLens")', "", 5.0)
print("status:", r.status)
print("stdout:", repr(r.stdout))
print("stderr:", repr(r.stderr))
print()

print("=" * 60)
print("TEST 2 — Python: stdin (10 + 20)")
r = sandbox.execute("python", "a = int(input())\nb = int(input())\nprint(a + b)\n", "10\n20", 5.0)
print("status:", r.status)
print("stdout:", repr(r.stdout))
print("stderr:", repr(r.stderr))
print()

print("=" * 60)
print("TEST 3 — Python: runtime error")
r = sandbox.execute("python", "print(x)\n", "", 5.0)
print("status:", r.status)
print("stdout:", repr(r.stdout))
print("stderr:", repr(r.stderr))
print()

print("=" * 60)
print("TEST 4 — Java: stdin (10 + 20)")
java_code = """import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int a = sc.nextInt();
        int b = sc.nextInt();
        System.out.println(a + b);
    }
}
"""
r = sandbox.execute("java", java_code, "10\n20", 15.0)
print("status:", r.status)
print("stdout:", repr(r.stdout))
print("stderr:", repr(r.stderr))
print()

print("=" * 60)
print("TEST 5 — Java: compilation error")
java_bad = """public class Main {
    public static void main(String[] args) {
        System.out.println(x);
    }
}
"""
r = sandbox.execute("java", java_bad, "", 15.0)
print("status:", r.status)
print("stderr:", repr(r.stderr))
print()

print("=" * 60)
print("TEST 6 — Python: timeout")
r = sandbox.execute("python", "while True: pass\n", "", 3.0)
print("status:", r.status)
print("stderr:", repr(r.stderr))
print()

print("=" * 60)
print("TEST 7 — Unsupported language")
r = sandbox.execute("brainfuck", "+++", "", 5.0)
print("status:", r.status)
print("stderr:", repr(r.stderr))
