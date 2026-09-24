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
    label: 'Python',
    monacoLanguage: 'python',
    extension: '.py',
<<<<<<< Updated upstream
    starterCode: '# Write your Python code here\n',
=======
    starterCode: `# Write your Python code here
`,
>>>>>>> Stashed changes
  },
  java: {
    id: 'java',
    label: 'Java',
    monacoLanguage: 'java',
    extension: '.java',
    starterCode: `public class Main {
    public static void main(String[] args) {
<<<<<<< Updated upstream

=======
        // Write your Java code here
>>>>>>> Stashed changes
    }
}
`,
  },
<<<<<<< Updated upstream
=======
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
>>>>>>> Stashed changes
  c: {
    id: 'c',
    label: 'C',
    monacoLanguage: 'c',
    extension: '.c',
    starterCode: `#include <stdio.h>

<<<<<<< Updated upstream
int main() {

    return 0;
}
`,
  },
  cpp: {
    id: 'cpp',
    label: 'C++',
    monacoLanguage: 'cpp',
    extension: '.cpp',
    starterCode: `#include <iostream>
using namespace std;

int main() {

=======
int main() {
    // Write your C code here
>>>>>>> Stashed changes
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
