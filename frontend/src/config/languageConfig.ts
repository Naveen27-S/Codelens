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
    starterCode: '# Write your Python code here\n',
  },
  java: {
    id: 'java',
    label: 'Java',
    monacoLanguage: 'java',
    extension: '.java',
    starterCode: `public class Main {
    public static void main(String[] args) {

    }
}
`,
  },
  c: {
    id: 'c',
    label: 'C',
    monacoLanguage: 'c',
    extension: '.c',
    starterCode: `#include <stdio.h>

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
