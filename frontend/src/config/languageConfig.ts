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
    starterCode: `# Write your Python code here
`,
  },
  java: {
    id: 'java',
    label: 'Java (Client-Side Engine)',
    monacoLanguage: 'java',
    extension: '.java',
    starterCode: `public class Main {
    public static void main(String[] args) {
        // Write your Java code here
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

int main() {
    // Write your C++ code here
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

int main() {
    // Write your C code here
    return 0;
}
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
