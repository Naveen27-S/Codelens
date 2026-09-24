/**
 * src/services/codeMistakeDiagnostician.ts
 *
 * CodeLens Intelligent Error & Mistake Diagnostician.
 * Analyzes code execution failures, syntax errors, and runtime exceptions.
 * Pinpoints:
 *   1. Exactly what mistake the user made (in plain English)
 *   2. Which line number caused the error (with code snippet and caret pointer ^)
 *   3. What is expected in the code to fix the mistake (with corrected code preview)
 */

export interface CodeMistakeReport {
  hasMistake: boolean;
  language: string;
  lineNumber: number | null;
  columnNumber: number | null;
  offendingLine: string;
  surroundingContext: string;
  mistakeTitle: string;
  mistakeDescription: string;
  expectedInCode: string;
  suggestedFixSnippet?: string;
  terminalOutput: string;
}

/**
 * Main diagnosis function.
 */
export function diagnoseCodeMistake(
  language: string,
  code: string,
  rawError: string,
  stdout: string = ''
): CodeMistakeReport {
  const normLang = (language || 'python').toLowerCase().trim();
  const lines = code.split('\n');
  const errorText = (rawError || '').trim();

  // 1. Extract Line Number and Column Number
  let detectedLine: number | null = null;
  let detectedCol: number | null = null;

  // Patterns for Python, JS, C, C++, Java, etc.
  const linePatterns = [
    // Python: File "<string>", line 4 / File "<exec>", line 12
    /(?:File\s+["'<][^"'>]+["'>],\s+line\s+)(\d+)/i,
    // Python: (detected at line 4)
    /detected at line\s+(\d+)/i,
    // Line 4: / line 4
    /\bline\s+(\d+)\b/i,
    // JS / Monaco: <anonymous>:4:12 or at eval:4:12
    /(?:<anonymous>|eval|at\s+[^:]+):(\d+):(\d+)/i,
    // Compiler: 4:12: error:
    /^(\d+):(\d+):\s*error/im,
    // JSCPP / custom: Line: 4 / Line 4
    /\bLine:\s*(\d+)/i,
  ];

  for (const pattern of linePatterns) {
    const match = errorText.match(pattern);
    if (match) {
      const parsedLine = parseInt(match[1], 10);
      // Ensure line is within bounds of user's code
      if (!isNaN(parsedLine) && parsedLine >= 1 && parsedLine <= lines.length) {
        detectedLine = parsedLine;
        if (match[2]) {
          const parsedCol = parseInt(match[2], 10);
          if (!isNaN(parsedCol) && parsedCol >= 1) {
            detectedCol = parsedCol;
          }
        }
        break;
      }
    }
  }

  // Also check if raw error has caret indicator like "    ^\nSyntaxError: ..."
  if (detectedLine === null) {
    const caretMatch = errorText.match(/\n\s*(\^)\s*\n/);
    if (caretMatch && caretMatch.index) {
      // Find line number near caret
      const preCaret = errorText.slice(0, caretMatch.index);
      const m = preCaret.match(/line\s+(\d+)/i);
      if (m) {
        const num = parseInt(m[1], 10);
        if (num >= 1 && num <= lines.length) detectedLine = num;
      }
    }
  }

  // 2. If line number still not found, run static analysis on source code
  if (detectedLine === null) {
    const staticScan = scanCodeForSyntaxMistakes(normLang, lines);
    if (staticScan.line !== null) {
      detectedLine = staticScan.line;
      if (staticScan.column !== null) detectedCol = staticScan.column;
    } else {
      // Default to line 1 if code is not empty
      detectedLine = lines.length > 0 ? 1 : null;
    }
  }

  // 3. Extract the offending line and surrounding context
  let offendingLine = '';
  if (detectedLine !== null && detectedLine >= 1 && detectedLine <= lines.length) {
    offendingLine = lines[detectedLine - 1];
  }

  // 4. Determine Mistake, Explanation, and Expected Fix
  const analysis = analyzeMistakeDetails(normLang, errorText, lines, detectedLine, offendingLine);

  // 5. Generate surrounding context with line numbers and pointer
  const surroundingContext = buildContextSnippet(lines, detectedLine, detectedCol);

  // 6. Format beautiful, clean Terminal Output
  const terminalOutput = formatTerminalReport({
    language: normLang,
    lineNumber: detectedLine,
    columnNumber: detectedCol,
    offendingLine,
    surroundingContext,
    mistakeTitle: analysis.title,
    mistakeDescription: analysis.description,
    expectedInCode: analysis.expected,
    suggestedFixSnippet: analysis.suggestedFix,
    rawError: errorText,
    stdout,
  });

  return {
    hasMistake: true,
    language: normLang,
    lineNumber: detectedLine,
    columnNumber: detectedCol,
    offendingLine,
    surroundingContext,
    mistakeTitle: analysis.title,
    mistakeDescription: analysis.description,
    expectedInCode: analysis.expected,
    suggestedFixSnippet: analysis.suggestedFix,
    terminalOutput,
  };
}

/**
 * Detailed categorization and explanation generator based on language and error.
 */
function analyzeMistakeDetails(
  language: string,
  errorText: string,
  lines: string[],
  lineNum: number | null,
  lineContent: string
): { title: string; description: string; expected: string; suggestedFix?: string } {
  const line = lineContent.trim();
  const errLower = errorText.toLowerCase();

  // ───────────────────────── PYTHON MISTAKES ─────────────────────────
  if (language === 'python') {
    // 1. Unterminated string literal
    if (errLower.includes('unterminated string literal') || (line.includes('"') && (line.match(/"/g) || []).length % 2 !== 0) || (line.includes("'") && (line.match(/'/g) || []).length % 2 !== 0)) {
      const quoteChar = line.includes('"') ? '"' : "'";
      return {
        title: 'Unterminated String Literal (SyntaxError)',
        description: `A string quotation was opened with ${quoteChar}, but it was never closed before the end of the line.`,
        expected: `Expected a matching closing quote (${quoteChar}) before the end of the line.`,
        suggestedFix: `${lineContent}${quoteChar}`,
      };
    }

    // 2. Expected ':' (Missing colon after if/else/for/while/def/class)
    if (errLower.includes("expected ':'") || errLower.includes("syntaxerror: invalid syntax") && /^(if|elif|else|for|while|def|class|try|except|finally|with)\b/.test(line) && !line.endsWith(':')) {
      return {
        title: "Missing Colon ':' (SyntaxError)",
        description: `In Python, header statements like 'if', 'for', 'while', 'def', and 'class' must end with a colon ':'.`,
        expected: `Expected a colon ':' at the end of the statement.`,
        suggestedFix: `${lineContent}:`,
      };
    }

    // 3. IndentationError: unexpected indent / unindent
    if (errLower.includes('indentationerror') || errLower.includes('unexpected indent')) {
      return {
        title: 'Indentation Mismatch (IndentationError)',
        description: `Python relies on consistent indentation to define code blocks. Line ${lineNum || ''} has inconsistent spacing or tabs.`,
        expected: `Expected this line to be indented consistently (standard is 4 spaces per block level).`,
        suggestedFix: `    ${line}`,
      };
    }

    // 4. Expected an indented block
    if (errLower.includes('expected an indented block')) {
      return {
        title: 'Missing Indented Block (IndentationError)',
        description: `The statement before line ${lineNum || ''} opens a new code block, but no indented code was provided inside it.`,
        expected: `Expected at least one indented line inside the block (or use 'pass' if intentional).`,
        suggestedFix: `    pass`,
      };
    }

    // 5. NameError: name 'XYZ' is not defined
    const nameMatch = errorText.match(/name '([a-zA-Z0-9_]+)' is not defined/i);
    if (nameMatch) {
      const varName = nameMatch[1];
      return {
        title: `Undefined Variable '${varName}' (NameError)`,
        description: `The variable or function '${varName}' was referenced before it was defined or assigned a value.`,
        expected: `Expected '${varName}' to be declared or assigned before using it, or verify there is no typo.`,
        suggestedFix: `${varName} = 0  # Initialize '${varName}' before line ${lineNum || 1}`,
      };
    }

    // 6. ZeroDivisionError
    if (errLower.includes('zerodivisionerror') || errLower.includes('division by zero')) {
      return {
        title: 'Division by Zero (ZeroDivisionError)',
        description: `The program attempted to divide a number by zero or perform modulo by zero.`,
        expected: `Expected the denominator/divisor to be non-zero before performing division.`,
        suggestedFix: `if divisor != 0:\n    result = value / divisor`,
      };
    }

    // 7. TypeError: unsupported operand / cannot concatenate
    if (errLower.includes('typeerror')) {
      return {
        title: 'Type Mismatch Error (TypeError)',
        description: `An operation was attempted on incompatible data types (for example, adding an integer and a string).`,
        expected: `Expected matching or converted types. Use str(...) or int(...) to convert values before combining.`,
        suggestedFix: `print(str(my_var) + " text")`,
      };
    }

    // 8. IndexError: list index out of range
    if (errLower.includes('indexerror') || errLower.includes('index out of range')) {
      return {
        title: 'List Index Out of Bounds (IndexError)',
        description: `The program tried to access a list element at an index that does not exist.`,
        expected: `Expected the index to be between 0 and len(collection) - 1.`,
        suggestedFix: `if index < len(my_list):\n    item = my_list[index]`,
      };
    }

    // 9. Assignment in if condition (e.g. if x = 5:)
    if (/\bif\s+[a-zA-Z0-9_]+\s*=\s*[^=]/.test(line)) {
      const fixed = line.replace(/=/, '==');
      return {
        title: 'Assignment in Condition (SyntaxError)',
        description: `You used a single '=' (assignment) inside an if condition instead of '==' (equality comparison).`,
        expected: `Expected double equals '==' for equality checking.`,
        suggestedFix: fixed,
      };
    }
  }

  // ───────────────────────── C / C++ MISTAKES ─────────────────────────
  if (language === 'c' || language === 'cpp') {
    // 1. Semicolon after #include
    if (/^#include\s+<[^>]+>;/.test(line) || /^#include\s+"[^"]+";/.test(line) || errLower.includes("must not end with a semicolon")) {
      return {
        title: 'Invalid Semicolon on #include Directive',
        description: `Preprocessor directives such as '#include' must not end with a semicolon ';'.`,
        expected: `Expected '#include <...>' without a trailing semicolon.`,
        suggestedFix: line.replace(/;+$/, ''),
      };
    }

    // 2. Missing 'main()' Entry Function
    if (errLower.includes('main') || !lines.some(l => /\bmain\s*\(/.test(l))) {
      return {
        title: "Missing 'main()' Entry Function",
        description: `Every C and C++ program requires an 'int main()' function as the entry point of program execution.`,
        expected: `Expected an 'int main() { ... return 0; }' function definition.`,
        suggestedFix: `int main() {\n    // your code here\n    return 0;\n}`,
      };
    }

    // 3. Undeclared identifier / symbol
    const undeclaredMatch = errorText.match(/(?:undeclared identifier|was not declared|symbol '([a-zA-Z0-9_]+)' is not declared|identifier '([a-zA-Z0-9_]+)' is undefined)/i);
    if (undeclaredMatch) {
      const varName = undeclaredMatch[1] || undeclaredMatch[2] || 'variable';
      return {
        title: `Undeclared Variable '${varName}' (Compilation Error)`,
        description: `Variable '${varName}' is used on line ${lineNum || ''} without being declared with a data type first.`,
        expected: `Expected '${varName}' to be declared with a type (e.g., 'int ${varName};' or 'double ${varName};') before use.`,
        suggestedFix: `int ${varName} = 0;`,
      };
    }

    // 4. Missing Semicolon
    if (
      errLower.includes('expected ;') ||
      errLower.includes("expected ';'") ||
      errLower.includes('missing ;') ||
      (!line.endsWith(';') && !line.endsWith('{') && !line.endsWith('}') && !line.startsWith('#') && line.length > 0)
    ) {
      return {
        title: "Missing Semicolon ';' (Syntax Error)",
        description: `In C and C++, statements must end with a semicolon ';'. Line ${lineNum || ''} is missing a terminating semicolon.`,
        expected: `Expected a ';' at the end of the statement.`,
        suggestedFix: `${line};`,
      };
    }

    // 5. JSCPP parser error: Right-hand side of 'instanceof' is not an object
    if (errLower.includes('instanceof') || errLower.includes('right-hand side of')) {
      return {
        title: "C/C++ Syntax or Structure Error",
        description: `The C compiler encountered an unrecognized token, unsupported syntax, or missing semicolon/brace near line ${lineNum || 1}.`,
        expected: `Ensure all statements end with ';', all braces '{ ... }' are closed, and standard headers use '#include <stdio.h>' or '#include <iostream>'.`,
        suggestedFix: `${line};`,
      };
    }
  }

  // ───────────────────────── JAVA MISTAKES ─────────────────────────
  if (language === 'java') {
    // 1. Missing class declaration
    if (errLower.includes('missing java class') || !lines.some(l => /\bclass\s+[a-zA-Z0-9_]+/.test(l))) {
      return {
        title: 'Missing Java Class Declaration',
        description: `Java is an object-oriented language where all code must be enclosed inside a class (e.g. 'public class Main').`,
        expected: `Expected 'public class Main { public static void main(String[] args) { ... } }'.`,
        suggestedFix: `public class Main {\n    public static void main(String[] args) {\n        ${line}\n    }\n}`,
      };
    }

    // 2. Missing main method
    if (errLower.includes("missing 'main' method") || !lines.some(l => /\bmain\s*\(/.test(l))) {
      return {
        title: "Missing 'main' Method in Java",
        description: `Java programs require an entry point method defined as: 'public static void main(String[] args)'.`,
        expected: `Expected 'public static void main(String[] args)' method inside the class.`,
        suggestedFix: `    public static void main(String[] args) {\n        ${line}\n    }`,
      };
    }

    // 3. Missing Semicolon
    if (
      errLower.includes('expected ;') ||
      errLower.includes("missing ;") ||
      (!line.endsWith(';') && !line.endsWith('{') && !line.endsWith('}') && !line.startsWith('//') && !line.startsWith('import ') && !line.startsWith('package ') && !line.startsWith('public class') && !line.startsWith('class ') && line.length > 0)
    ) {
      return {
        title: "Missing Semicolon ';' (Syntax Error)",
        description: `In Java, every statement must terminate with a semicolon ';'. Line ${lineNum || ''} is missing a semicolon.`,
        expected: `Expected a semicolon ';' at the end of the line.`,
        suggestedFix: `${line};`,
      };
    }
  }

  // ───────────────────────── JAVASCRIPT / TYPESCRIPT ─────────────────────────
  if (language === 'javascript' || language === 'js') {
    if (errLower.includes('is not defined') || errLower.includes('referenceerror')) {
      const refMatch = errorText.match(/([a-zA-Z0-9_]+) is not defined/i);
      const varName = refMatch ? refMatch[1] : 'variable';
      return {
        title: `Undefined Variable '${varName}' (ReferenceError)`,
        description: `'${varName}' was used before being declared with 'let', 'const', or 'var'.`,
        expected: `Expected '${varName}' to be declared before line ${lineNum || 1}.`,
        suggestedFix: `let ${varName} = 0;`,
      };
    }

    if (errLower.includes('unexpected token') || errLower.includes('syntaxerror')) {
      return {
        title: 'Unexpected Token (SyntaxError)',
        description: `JavaScript encountered an invalid or unexpected character or token on line ${lineNum || ''}.`,
        expected: `Check for missing commas, unmatched parentheses, or typos on this line.`,
        suggestedFix: `${line}`,
      };
    }
  }

  // ───────────────────────── SQL MISTAKES ─────────────────────────
  if (language === 'sql') {
    const nearMatch = errorText.match(/near "([^"]+)": syntax error/i);
    if (nearMatch) {
      const token = nearMatch[1];
      return {
        title: `SQL Syntax Error near "${token}"`,
        description: `The SQL parser encountered an unexpected keyword or misspelled clause around "${token}".`,
        expected: `Expected valid SQL syntax (e.g., SELECT, FROM, WHERE, INSERT INTO).`,
        suggestedFix: `SELECT * FROM table_name WHERE condition;`,
      };
    }

    if (errLower.includes('no such table')) {
      return {
        title: 'Table Not Found (SQL Error)',
        description: `The referenced database table does not exist or has not been created yet.`,
        expected: `Expected a 'CREATE TABLE' statement to define the table before querying it.`,
      };
    }
  }

  // ───────────────────────── UNCLOSED DELIMITERS ─────────────────────────
  const unclosed = checkUnclosedDelimiters(lines);
  if (unclosed) {
    return {
      title: `Unmatched Delimiter '${unclosed.char}' (Syntax Error)`,
      description: `An opening '${unclosed.char}' on line ${unclosed.line} was never closed with a matching '${unclosed.matchingChar}'.`,
      expected: `Expected a matching '${unclosed.matchingChar}' to close the block or expression.`,
      suggestedFix: `${lines[unclosed.line - 1]}${unclosed.matchingChar}`,
    };
  }

  // ───────────────────────── GENERIC FALLBACK ─────────────────────────
  const firstErrLine = errorText.split('\n')[0] || 'Unknown Execution Error';
  return {
    title: 'Code Mistake / Execution Error',
    description: `An error occurred while executing line ${lineNum || 'unknown'}: ${firstErrLine}`,
    expected: `Review the syntax, variable declarations, and logic on line ${lineNum || 'indicated above'}.`,
    suggestedFix: lineContent.trim(),
  };
}

/**
 * Scans code lines for common syntax errors if the runner provided no line number.
 */
function scanCodeForSyntaxMistakes(
  language: string,
  lines: string[]
): { line: number | null; column: number | null } {
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('#') || line.startsWith('/*')) {
      continue;
    }

    // Python checks
    if (language === 'python') {
      // Missing colon
      if (/^(if|elif|else|for|while|def|class|try|except|finally|with)\b/.test(line) && !line.endsWith(':')) {
        return { line: i + 1, column: raw.length + 1 };
      }
      // Single '=' in if
      if (/\bif\s+[a-zA-Z0-9_]+\s*=\s*[^=]/.test(line)) {
        return { line: i + 1, column: raw.indexOf('=') + 1 };
      }
      // Unclosed string
      if ((line.match(/"/g) || []).length % 2 !== 0 || (line.match(/'/g) || []).length % 2 !== 0) {
        return { line: i + 1, column: raw.length + 1 };
      }
    }

    // C / C++ / Java checks
    if (language === 'c' || language === 'cpp' || language === 'java') {
      // Missing semicolon
      if (
        !line.endsWith(';') &&
        !line.endsWith('{') &&
        !line.endsWith('}') &&
        !line.startsWith('#') &&
        !line.startsWith('import ') &&
        !line.startsWith('public class') &&
        !line.startsWith('class ') &&
        !line.startsWith('if') &&
        !line.startsWith('for') &&
        !line.startsWith('while')
      ) {
        return { line: i + 1, column: raw.length + 1 };
      }
    }
  }

  // Check unclosed braces/brackets
  const unclosed = checkUnclosedDelimiters(lines);
  if (unclosed) {
    return { line: unclosed.line, column: lines[unclosed.line - 1].length + 1 };
  }

  return { line: null, column: null };
}

/**
 * Checks for unmatched brackets, braces, and parentheses.
 */
function checkUnclosedDelimiters(
  lines: string[]
): { char: string; matchingChar: string; line: number } | null {
  const stack: Array<{ char: string; line: number }> = [];
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const closing: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === "'" && !inDoubleQuote) inSingleQuote = !inSingleQuote;
      if (ch === '"' && !inSingleQuote) inDoubleQuote = !inDoubleQuote;
      if (inSingleQuote || inDoubleQuote) continue;

      if (pairs[ch]) {
        stack.push({ char: ch, line: l + 1 });
      } else if (closing[ch]) {
        if (stack.length === 0 || stack[stack.length - 1].char !== closing[ch]) {
          return { char: ch, matchingChar: closing[ch], line: l + 1 };
        }
        stack.pop();
      }
    }
  }

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    return { char: unclosed.char, matchingChar: pairs[unclosed.char], line: unclosed.line };
  }

  return null;
}

/**
 * Builds a multi-line visual context snippet with line numbers and a caret pointer `^`.
 */
function buildContextSnippet(
  lines: string[],
  targetLine: number | null,
  col: number | null
): string {
  if (targetLine === null || targetLine < 1 || targetLine > lines.length) {
    return '';
  }

  const start = Math.max(1, targetLine - 1);
  const end = Math.min(lines.length, targetLine + 1);
  const result: string[] = [];

  for (let l = start; l <= end; l++) {
    const lineContent = lines[l - 1];
    const isTarget = l === targetLine;
    const prefix = isTarget ? ' > ' : '   ';
    const lineNumStr = String(l).padStart(3, ' ');

    result.push(`${prefix}${lineNumStr} | ${lineContent}`);

    if (isTarget) {
      // Draw caret indicator underneath the line
      const pointerCol = col && col > 0 ? col : Math.max(1, lineContent.trimEnd().length + 1);
      const spaces = ' '.repeat(Math.max(0, pointerCol - 1));
      result.push(`       | ${spaces}^`);
    }
  }

  return result.join('\n');
}

/**
 * Builds the final terminal report string using clear visual box formatting.
 */
function formatTerminalReport(data: {
  language: string;
  lineNumber: number | null;
  columnNumber: number | null;
  offendingLine: string;
  surroundingContext: string;
  mistakeTitle: string;
  mistakeDescription: string;
  expectedInCode: string;
  suggestedFixSnippet?: string;
  rawError: string;
  stdout?: string;
}): string {
  const divider = '─'.repeat(62);
  const stdoutSection = data.stdout && data.stdout.trim().length > 0
    ? `[Program Output Before Error]:\n${data.stdout.trim()}\n\n`
    : '';

  const locationStr = data.lineNumber
    ? `Line ${data.lineNumber}${data.columnNumber ? `, Column ${data.columnNumber}` : ''}`
    : 'Unknown Line';

  let fixSection = '';
  if (data.suggestedFixSnippet) {
    fixSection = `\n🔧 EXPECTED CODE FOR LINE ${data.lineNumber || 1}:\n   ${data.suggestedFixSnippet}\n`;
  }

  return `${stdoutSection}❌ MISTAKE DETECTED IN CODE:
${divider}
📍 WHERE THE MISTAKE IS:
   ${locationStr}

${data.surroundingContext || `   ${data.offendingLine}`}

⚠️ WHAT MISTAKE WAS MADE:
   ${data.mistakeTitle}
   ${data.mistakeDescription}

💡 WHAT IS EXPECTED IN THE CODE:
   ${data.expectedInCode}
${fixSection}${divider}
[Original Error Traceback]:
${data.rawError.trim() || 'Execution terminated with error.'}`;
}
