/**
 * Central language configuration for CodeLens AI Editor.
 * Extensible for adding new languages (e.g., JavaScript, Go, Rust).
 */

export interface LanguageConfig {
  id: string;
  label: string;
  monacoLanguage: string;
  extension: string;
  starterCode: string;
}

export const SUPPORTED_LANGUAGES: Record<string, LanguageConfig> = {
  python: {
    id: 'python',
    label: 'Python (Pyodide Wasm)',
    monacoLanguage: 'python',
    extension: '.py',
    starterCode: `def main(a, b):
    # Main function taking input arguments and returning a value
    return a + b

if __name__ == "__main__":
    # Take input arguments from STDIN (or use defaults if no input provided)
    try:
        raw_input_data = input().strip()
        if raw_input_data:
            tokens = [int(x) if x.lstrip('-').isdigit() else x for x in raw_input_data.split()]
            a = tokens[0] if len(tokens) > 0 else 10
            b = tokens[1] if len(tokens) > 1 else 20
        else:
            a, b = 10, 20
    except Exception:
        a, b = 10, 20

    # Call main function with input arguments
    result = main(a, b)

    # Print the returned value from the main function
    print("Returned value from main():", result)
`,
  },
  java: {
    id: 'java',
    label: 'Java (Client-Side Engine)',
    monacoLanguage: 'java',
    extension: '.java',
    starterCode: `import java.util.Scanner;

public class Main {
    // Main function taking input arguments and returning a value
    public static int mainFunction(int a, int b) {
        return a + b;
    }

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int a = 10;
        int b = 20;

        // Take input arguments if provided via STDIN
        if (scanner.hasNextInt()) {
            a = scanner.nextInt();
            if (scanner.hasNextInt()) {
                b = scanner.nextInt();
            }
        }

        // Call main function with input arguments
        int result = mainFunction(a, b);

        // Print the returned value from the main function
        System.out.println("Returned value from main(): " + result);
    }
}
`,
  },
  cpp: {
    id: 'cpp',
    label: 'C++ (JSCPP Wasm Interpreter)',
    monacoLanguage: 'cpp',
    extension: '.cpp',
    starterCode: `#include <iostream>
using namespace std;

// Main function taking input arguments and returning a value
int mainFunction(int a, int b) {
    return a + b;
}

int main() {
    int a = 10;
    int b = 20;

    // Take input arguments from STDIN if available
    if (cin >> a >> b) {
        // Input arguments successfully read
    }

    // Call main function with input arguments
    int result = mainFunction(a, b);

    // Print the returned value from the main function
    cout << "Returned value from main(): " << result << endl;

    return 0;
}
`,
  },
  c: {
    id: 'c',
    label: 'C (JSCPP Wasm Interpreter)',
    monacoLanguage: 'c',
    extension: '.c',
    starterCode: `#include <stdio.h>

// Main function taking input arguments and returning a value
int mainFunction(int a, int b) {
    return a + b;
}

int main() {
    int a = 10;
    int b = 20;

    // Take input arguments from STDIN if available
    if (scanf("%d %d", &a, &b) != 2) {
        a = 10;
        b = 20;
    }

    // Call main function with input arguments
    int result = mainFunction(a, b);

    // Print the returned value from the main function
    printf("Returned value from main(): %d\\n", result);

    return 0;
}
`,
  },
  sql: {
    id: 'sql',
    label: 'SQL / MySQL (Relational DB)',
    monacoLanguage: 'sql',
    extension: '.sql',
    starterCode: `-- CodeLens AI Relational Database Sandbox
-- Run DDL (CREATE TABLE) and DML (INSERT, SELECT) with MySQL/SQLite syntax

CREATE TABLE employees (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(50) NOT NULL,
    salary DECIMAL(10, 2) NOT NULL,
    hire_date DATE
);

INSERT INTO employees (name, department, salary, hire_date) VALUES
('Alex Rivera', 'Engineering', 95000.00, '2023-01-15'),
('Sarah Chen', 'Design', 88000.00, '2023-03-22'),
('Michael Scott', 'Management', 75000.00, '2022-09-01'),
('Dwight Schrute', 'Sales', 72000.00, '2022-11-10'),
('Jim Halpert', 'Sales', 68000.00, '2023-02-01');

-- Query: Average salary by department
SELECT 
    department, 
    COUNT(*) as num_employees, 
    ROUND(AVG(salary), 2) as avg_salary
FROM employees
GROUP BY department
ORDER BY avg_salary DESC;
`,
  },
};

export const DEFAULT_LANGUAGE = 'python';

export function getLanguageConfig(lang: string): LanguageConfig {
  const normalized = lang ? lang.toLowerCase().trim() : DEFAULT_LANGUAGE;
  return SUPPORTED_LANGUAGES[normalized] || SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE];
}

export function getDefaultStarterCode(lang: string): string {
  return getLanguageConfig(lang).starterCode;
}

export function getMonacoLanguage(lang: string): string {
  return getLanguageConfig(lang).monacoLanguage;
}
