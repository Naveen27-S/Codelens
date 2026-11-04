/**
 * src/services/runners/javaRunner.ts
 *
 * 100% Client-Side In-Browser Java Code Runner & Step Tracer.
 * Executes Java code directly in browser memory without requiring any server backend.
 * Provides line-by-line debugging, conditional evaluation (if / else if / else),
 * loop execution (for, while, enhanced for), array indexing, variable inspection,
 * and data structure visualization for the Video Visualizer.
 */

import type { ExecutionResult, ExecutionStep, ScopeVariable, OperationType } from '../../types/execution';

/**
 * Pre-execution syntax validation for Java.
 * Detects missing semicolons, unclosed delimiters, missing class/main, etc.
 */
function levenshteinDist(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

const VALID_JAVA_TYPES_SET = new Set([
  'byte', 'short', 'int', 'long', 'float', 'double', 'boolean', 'char', 'void', 'var',
  'String', 'Integer', 'Double', 'Float', 'Long', 'Boolean', 'Character', 'Byte', 'Short', 'Object',
  'Scanner', 'Math', 'Arrays', 'Collections', 'System',
  'List', 'ArrayList', 'LinkedList', 'Vector',
  'Map', 'HashMap', 'TreeMap', 'LinkedHashMap',
  'Set', 'HashSet', 'TreeSet', 'LinkedHashSet',
  'Queue', 'Deque', 'ArrayDeque', 'PriorityQueue', 'Stack',
  'StringBuilder', 'StringBuffer',
  'TreeNode', 'ListNode', 'Node'
]);

function validateDeclaredJavaType(typeStr: string, customClasses: Set<string> = new Set(['Main'])): { valid: boolean; base: string; closest: string } {
  const base = typeStr.replace(/<.*?>/g, '').replace(/\[\]/g, '').trim();
  if (!base) return { valid: true, base: '', closest: '' };
  if (VALID_JAVA_TYPES_SET.has(base) || customClasses.has(base)) return { valid: true, base, closest: base };

  let closest = 'Object';
  let minDist = 999;
  for (const t of VALID_JAVA_TYPES_SET) {
    const dist = levenshteinDist(base, t);
    if (dist < minDist) {
      minDist = dist;
      closest = t;
    }
  }
  return { valid: false, base, closest };
}

const JAVA_KEYWORD_TYPOS: Record<string, string> = {
  blooean: 'boolean', boolen: 'boolean', booean: 'boolean', bool: 'boolean',
  itn: 'int', intt: 'int', integer: 'int',
  stirng: 'String', string: 'String', strign: 'String', strng: 'String',
  dobule: 'double', doubel: 'double', doulbe: 'double',
  flot: 'float', flaot: 'float',
  viod: 'void', voidd: 'void', voide: 'void',
  publc: 'public', pubilc: 'public', pulbic: 'public', pbulic: 'public',
  statc: 'static', staic: 'static', statick: 'static',
  calss: 'class', clss: 'class', claas: 'class', clas: 'class',
  improt: 'import', impot: 'import',
  packge: 'package', pakage: 'package',
  whlie: 'while', wile: 'while', whil: 'while',
  fro: 'for', foor: 'for',
  iff: 'if', fi: 'if',
  esle: 'else', lese: 'else', elese: 'else',
  braek: 'break', brak: 'break', brek: 'break',
  contnue: 'continue', continew: 'continue', contin: 'continue',
  retrun: 'return', retun: 'return', reutrn: 'return', retren: 'return',
  ture: 'true', tru: 'true',
  flase: 'false', fals: 'false', fasle: 'false',
  mian: 'main', man: 'main',
};

function validateJavaSyntax(code: string): void {
  const lines = code.split('\n');

  // 1. Check for class declaration
  if (!lines.some((l) => /\bclass\s+[a-zA-Z0-9_]+/.test(l))) {
    throw new Error("CompilationError on line 1: Missing Java class declaration (e.g. 'public class Main { ... }')");
  }

  // 2. Check for main method
  if (!lines.some((l) => /\bmain\s*\(/.test(l))) {
    throw new Error("CompilationError on line 1: Missing 'main' method (e.g. 'public static void main(String[] args)')");
  }

  // 3. Delimiter balance and Unterminated strings
  const stack: Array<{ char: string; line: number }> = [];
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const closing: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    let inSingle = false;
    let inDouble = false;

    for (let c = 0; c < rawLine.length; c++) {
      const ch = rawLine[c];
      if (ch === '"' && !inSingle && rawLine[c - 1] !== '\\') inDouble = !inDouble;
      if (ch === "'" && !inDouble && rawLine[c - 1] !== '\\') inSingle = !inSingle;
      if (inSingle || inDouble) continue;

      if (ch === '/' && rawLine[c + 1] === '/') break;

      if (pairs[ch]) {
        stack.push({ char: ch, line: i + 1 });
      } else if (closing[ch]) {
        if (stack.length === 0 || stack[stack.length - 1].char !== closing[ch]) {
          throw new Error(`SyntaxError on line ${i + 1}: Unmatched closing delimiter '${ch}'`);
        }
        stack.pop();
      }
    }

    if (inDouble) {
      throw new Error(`SyntaxError on line ${i + 1}: Unterminated string literal`);
    }
  }

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    throw new Error(`SyntaxError on line ${unclosed.line}: Unclosed '${unclosed.char}', expected matching '${pairs[unclosed.char]}'`);
  }

  // 4. Comprehensive Alphabet, Keyword, Method & Operator Checks
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;
    const clean = trimmed.replace(/\/\/.*$/, '').replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");

    // 4-pre: Validate variable declaration types on line
    const declTypeMatch = clean.match(/^([a-zA-Z0-9_<>[\]]+)\s+([a-zA-Z0-9_]+)\s*(?:=|;)/);
    if (declTypeMatch && !/^(public|private|protected|static|return|if|else|for|while|do|switch|case|break|continue|import|package|class)$/.test(declTypeMatch[1])) {
      const typeCheck = validateDeclaredJavaType(declTypeMatch[1]);
      if (!typeCheck.valid) {
        throw new Error(`CompilationError on line ${i + 1}: Cannot find symbol: class '${typeCheck.base}'. Did you mean '${typeCheck.closest}'?`);
      }
    }

    // 4a. Misspelled keyword check (Alphabet-level typos)
    const words = clean.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
    for (const w of words) {
      const lower = w.toLowerCase();
      if (JAVA_KEYWORD_TYPOS[lower] && w !== JAVA_KEYWORD_TYPOS[lower]) {
        throw new Error(`SyntaxError on line ${i + 1}: Misspelled keyword '${w}'. Did you mean '${JAVA_KEYWORD_TYPOS[lower]}'?`);
      }
    }

    // 4b. System.out print method typos
    const printMatch = clean.match(/\b(System|system)\.(out|Out)\.([a-zA-Z0-9_]+)\s*\(/);
    if (printMatch) {
      const prefix = printMatch[1];
      const method = printMatch[3];
      if (prefix === 'system') {
        throw new Error(`CompilationError on line ${i + 1}: Package 'system' does not exist. Java is case-sensitive, use 'System.out.println'`);
      }
      if (['prntln', 'printl', 'printlnn', 'pritnln', 'pritn', 'prnt', 'printt'].includes(method)) {
        throw new Error(`CompilationError on line ${i + 1}: Cannot find symbol: method '${method}' on 'System.out'. Did you mean 'println'?`);
      }
    }

    // 4c. Assignment inside condition: e.g. if (x = 5)
    const condAssign = clean.match(/\b(if|while)\s*\(([^)]*?[^=!<>]=(?!=)[^=][^)]*)\)/);
    if (condAssign) {
      throw new Error(`SyntaxError on line ${i + 1}: Invalid assignment in condition: '${condAssign[2].trim()}'. Use '==' for equality comparison.`);
    }

    // 4d. Equality operator used as a standalone statement: e.g. prime == false;
    const stmtEq = clean.match(/^([a-zA-Z0-9_]+)\s*==\s*([^;]+);/);
    if (stmtEq) {
      throw new Error(`SyntaxError on line ${i + 1}: Not a statement: '${stmtEq[1]} == ${stmtEq[2]}'. Use '=' for assignment.`);
    }

    // 4e. Inverted comparison operators: e.g. =< or => or =!
    const invOp = clean.match(/(=<|=>|=!)/);
    if (invOp) {
      const op = invOp[1];
      const fixedOp = op === '=<' ? '<=' : op === '=>' ? '>=' : '!=';
      throw new Error(`SyntaxError on line ${i + 1}: Invalid operator '${op}'. Did you mean '${fixedOp}'?`);
    }

    // 4f. Semicolon check
    if (trimmed.startsWith('import ') || trimmed.startsWith('package ')) {
      if (!trimmed.endsWith(';')) {
        throw new Error(`SyntaxError on line ${i + 1}: Missing semicolon ';' at end of import statement`);
      }
      continue;
    }
    if (trimmed.startsWith('public class') || trimmed.startsWith('class ') || trimmed.startsWith('@')) continue;
    if (trimmed.endsWith('{') || trimmed.endsWith('}')) continue;

    if (/^(if\s*\(|else|for\s*\(|while\s*\(|do\b|switch\s*\(|try\b|catch\s*\(|finally\b)/.test(trimmed)) {
      continue;
    }

    if (/\b(?:public|private|protected|static|void|int|double|float|String|boolean)\s+[a-zA-Z0-9_]+\s*\(/.test(trimmed)) {
      continue;
    }

    if (!trimmed.endsWith(';')) {
      throw new Error(`SyntaxError on line ${i + 1}: Missing semicolon ';' at end of statement`);
    }
  }
}

// ── AST Node Definitions ──────────────────────────────────────────────────
interface JavaStatementBase {
  line: number;
}

interface JavaPrintStatement extends JavaStatementBase {
  type: 'PRINT';
  isPrintln: boolean;
  expr: string;
}

interface JavaSimpleStatement extends JavaStatementBase {
  type: 'STATEMENT';
  raw: string;
}

interface JavaIfBranch {
  type: 'if' | 'else if' | 'else';
  condition?: string;
  body: JavaStatement[];
  line: number;
}

interface JavaIfChainStatement extends JavaStatementBase {
  type: 'IF_CHAIN';
  branches: JavaIfBranch[];
}

interface JavaForStatement extends JavaStatementBase {
  type: 'FOR';
  init: string;
  condition: string;
  update: string;
  body: JavaStatement[];
}

interface JavaForEachStatement extends JavaStatementBase {
  type: 'FOR_EACH';
  varName: string;
  iterable: string;
  body: JavaStatement[];
}

interface JavaWhileStatement extends JavaStatementBase {
  type: 'WHILE';
  condition: string;
  body: JavaStatement[];
}

interface JavaControlStatement extends JavaStatementBase {
  type: 'BREAK' | 'CONTINUE' | 'RETURN';
}

type JavaStatement =
  | JavaPrintStatement
  | JavaSimpleStatement
  | JavaIfChainStatement
  | JavaForStatement
  | JavaForEachStatement
  | JavaWhileStatement
  | JavaControlStatement;

interface LineItem {
  text: string;
  lineNum: number;
}

/**
 * Parses lines into structured Java statements.
 */
function parseJavaStatements(code: string): JavaStatement[] {
  const allLines = code.split('\n');

  // Find main method start
  let mainStartLine = -1;
  for (let i = 0; i < allLines.length; i++) {
    if (/\bmain\s*\(/.test(allLines[i])) {
      mainStartLine = i;
      break;
    }
  }

  if (mainStartLine === -1) {
    throw new Error("Missing 'main' method declaration in Java code");
  }

  // Find opening brace of main
  let mainBodyStart = -1;
  for (let i = mainStartLine; i < allLines.length; i++) {
    if (allLines[i].includes('{')) {
      mainBodyStart = i;
      break;
    }
  }

  const lines: LineItem[] = [];
  let depth = 0;
  let started = false;

  for (let i = mainStartLine; i < allLines.length; i++) {
    const raw = allLines[i];
    for (let c = 0; c < raw.length; c++) {
      if (raw[c] === '{') {
        depth++;
        started = true;
      } else if (raw[c] === '}') {
        depth--;
        if (started && depth === 0) break;
      }
    }

    if (i > mainBodyStart && (depth > 0 || (depth === 0 && !raw.trim().startsWith('}')))) {
      const trimmed = raw.trim();
      // Handle lines that start with '} else' or '}else'
      if (trimmed.startsWith('}') && (trimmed.startsWith('} else') || trimmed.startsWith('}else'))) {
        lines.push({ text: '}', lineNum: i + 1 });
        lines.push({ text: trimmed.slice(1).trim(), lineNum: i + 1 });
      } else {
        lines.push({ text: trimmed, lineNum: i + 1 });
      }
    }

    if (started && depth === 0 && i > mainBodyStart) break;
  }

  return parseBlock(lines, 0, lines.length).statements;
}

function parseBlock(lines: LineItem[], startIdx: number, endIdx: number): { statements: JavaStatement[]; nextIdx: number } {
  const statements: JavaStatement[] = [];
  let i = startIdx;

  while (i < endIdx) {
    const item = lines[i];
    let text = item.text;
    const lineNum = item.lineNum;

    if (!text || text.startsWith('//') || text.startsWith('/*') || text.startsWith('*') || text === '}') {
      i++;
      continue;
    }

    text = text.replace(/\/\/.*$/, '').trim();

    // 1. FOR loop
    const forMatch = text.match(/^for\s*\((.*)\)\s*\{?$/);
    if (forMatch) {
      const header = forMatch[1].trim();
      const { body, nextIdx } = collectBody(lines, i, text.endsWith('{'));
      if (header.includes(':')) {
        const parts = header.split(':');
        const varDecl = parts[0].trim().split(/\s+/).pop() || 'item';
        const iterable = parts[1].trim();
        statements.push({ type: 'FOR_EACH', varName: varDecl, iterable, body, line: lineNum });
      } else {
        const parts = header.split(';');
        statements.push({
          type: 'FOR',
          init: (parts[0] || '').trim(),
          condition: (parts[1] || '').trim(),
          update: (parts[2] || '').trim(),
          body,
          line: lineNum,
        });
      }
      i = nextIdx;
      continue;
    }

    // 2. WHILE loop
    const whileMatch = text.match(/^while\s*\((.*)\)\s*\{?$/);
    if (whileMatch) {
      const cond = whileMatch[1].trim();
      const { body, nextIdx } = collectBody(lines, i, text.endsWith('{'));
      statements.push({ type: 'WHILE', condition: cond, body, line: lineNum });
      i = nextIdx;
      continue;
    }

    // 3. IF / ELSE IF / ELSE chain
    if (/^(?:if|else\s+if|else)\b/.test(text)) {
      const branches: JavaIfBranch[] = [];
      let curIdx = i;

      while (curIdx < endIdx) {
        const curItem = lines[curIdx];
        const curText = curItem.text.replace(/\/\/.*$/, '').trim();
        if (!curText) { curIdx++; continue; }

        if (curText.startsWith('if')) {
          const m = curText.match(/^if\s*\((.*)\)\s*\{?$/);
          const cond = m ? m[1].trim() : 'true';
          const { body, nextIdx } = collectBody(lines, curIdx, curText.endsWith('{'));
          branches.push({ type: 'if', condition: cond, body, line: curItem.lineNum });
          curIdx = nextIdx;
        } else if (curText.startsWith('else if')) {
          const m = curText.match(/^else\s+if\s*\((.*)\)\s*\{?$/);
          const cond = m ? m[1].trim() : 'true';
          const { body, nextIdx } = collectBody(lines, curIdx, curText.endsWith('{'));
          branches.push({ type: 'else if', condition: cond, body, line: curItem.lineNum });
          curIdx = nextIdx;
        } else if (curText.startsWith('else')) {
          const { body, nextIdx } = collectBody(lines, curIdx, curText.endsWith('{'));
          branches.push({ type: 'else', body, line: curItem.lineNum });
          curIdx = nextIdx;
          break; // 'else' is final branch
        } else {
          break;
        }

        while (curIdx < endIdx && (!lines[curIdx].text.trim() || lines[curIdx].text.trim() === '}')) {
          curIdx++;
        }
        if (curIdx < endIdx) {
          const peek = lines[curIdx].text.trim();
          if (!peek.startsWith('else')) break;
        }
      }

      statements.push({ type: 'IF_CHAIN', branches, line: lineNum });
      i = curIdx;
      continue;
    }

    // 4. PRINT statement
    if (text.includes('System.out.print')) {
      const m = text.match(/System\.out\.print(ln)?\s*\((.*)\)\s*;?$/);
      if (m) {
        statements.push({ type: 'PRINT', isPrintln: m[1] === 'ln', expr: m[2].trim(), line: lineNum });
        i++;
        continue;
      }
    }

    // 5. Control Statements
    if (/^break\s*;/.test(text)) { statements.push({ type: 'BREAK', line: lineNum }); i++; continue; }
    if (/^continue\s*;/.test(text)) { statements.push({ type: 'CONTINUE', line: lineNum }); i++; continue; }
    if (/^return\b/.test(text)) { statements.push({ type: 'RETURN', line: lineNum }); i++; continue; }

    // 6. Generic Statement (assignments, declarations, increments, array updates)
    statements.push({ type: 'STATEMENT', raw: text.replace(/;$/, ''), line: lineNum });
    i++;
  }

  return { statements, nextIdx: i };
}

function collectBody(lines: LineItem[], headerIdx: number, hasOpeningBrace: boolean): { body: JavaStatement[]; nextIdx: number } {
  let j = headerIdx;
  let braceDepth = hasOpeningBrace ? 1 : 0;

  if (!hasOpeningBrace) {
    if (j + 1 < lines.length && lines[j + 1].text.trim() === '{') {
      j++;
      braceDepth = 1;
    } else {
      // Single line body without braces
      if (j + 1 < lines.length) {
        const bodyLines = [lines[j + 1]];
        return { body: parseBlock(bodyLines, 0, 1).statements, nextIdx: j + 2 };
      }
      return { body: [], nextIdx: j + 1 };
    }
  }

  const bodyLines: LineItem[] = [];
  let k = j + 1;

  while (k < lines.length) {
    const raw = lines[k].text;
    for (let c = 0; c < raw.length; c++) {
      if (raw[c] === '{') braceDepth++;
      if (raw[c] === '}') {
        braceDepth--;
        if (braceDepth === 0) break;
      }
    }
    if (braceDepth === 0) {
      k++;
      break;
    }
    bodyLines.push(lines[k]);
    k++;
  }

  return {
    body: parseBlock(bodyLines, 0, bodyLines.length).statements,
    nextIdx: k,
  };
}

/**
 * Safely evaluates Java expression within the active variable environment.
 */
function evalInScope(expr: string, env: Record<string, any>): any {
  let jsExpr = expr.trim();

  // Replace array literals {1, 2, 3} with [1, 2, 3] on RHS
  if (jsExpr.startsWith('{') && jsExpr.endsWith('}')) {
    jsExpr = '[' + jsExpr.slice(1, -1) + ']';
  }

  // Java Arrays.toString(arr) -> format
  jsExpr = jsExpr.replace(/Arrays\.toString\(([^)]+)\)/g, '($1)');

  // Java .equals() -> ===
  jsExpr = jsExpr.replace(/([a-zA-Z0-9_]+)\.equals\(([^)]+)\)/g, '($1 === $2)');

  // Java string .length() -> .length
  jsExpr = jsExpr.replace(/([a-zA-Z0-9_]+)\.length\(\)/g, '$1.length');

  // Java .contains() -> .includes()
  jsExpr = jsExpr.replace(/\.contains\(/g, '.includes(');

  // Java new int[size] -> new Array(size).fill(0)
  jsExpr = jsExpr.replace(/new\s+(?:int|double|float|long|boolean|char)\[\s*([^\]]+)\s*\]/g, 'new Array($1).fill(0)');
  jsExpr = jsExpr.replace(/new\s+String\[\s*([^\]]+)\s*\]/g, 'new Array($1).fill("")');

  // Java integer division: convert simple divisions like a / b to __intDiv(a, b)
  jsExpr = jsExpr.replace(/([a-zA-Z0-9_]+)\s*\/\s*([a-zA-Z0-9_]+)/g, '__intDiv($1, $2)');

  const keys = Object.keys(env);
  const values = keys.map((k) => env[k]);

  const __intDiv = (a: any, b: any) => {
    if (typeof a === 'number' && typeof b === 'number' && Number.isInteger(a) && Number.isInteger(b) && b !== 0) {
      return Math.trunc(a / b);
    }
    return a / b;
  };

  try {
    const fn = new Function('__intDiv', ...keys, `"use strict"; return (${jsExpr});`);
    return fn(__intDiv, ...values);
  } catch {
    // Fallback: direct substitution
    try {
      let substituted = jsExpr;
      keys.forEach((k) => {
        const regex = new RegExp(`\\b${k}\\b`, 'g');
        substituted = substituted.replace(regex, JSON.stringify(env[k]));
      });
      return Function('__intDiv', `"use strict"; return (${substituted});`)(__intDiv);
    } catch {
      return undefined;
    }
  }
}

/**
 * Executes Java code in-browser and generates step-by-step traces for visualization.
 */
export async function runJavaClient(
  code: string,
  inputData: string = ''
): Promise<ExecutionResult> {
  const startTime = performance.now();
  const logs: string[] = [];
  const steps: ExecutionStep[] = [];

  try {
    validateJavaSyntax(code);
    const ast = parseJavaStatements(code);

    const env: Record<string, any> = {};
    const varTypes: Record<string, string> = {};

    // Prepare STDIN input tokens
    const inputTokens = inputData
      .split(/[\s\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    let inputIdx = 0;
    const getNextInput = (): string => (inputIdx < inputTokens.length ? inputTokens[inputIdx++] : '');

    // Helper to record an execution step with active data structures
    const recordStep = (
      lineNum: number,
      opType: OperationType = 'ASSIGN',
      activeVar?: { name: string; value: any; index?: number },
      highlightArrayIndices?: Record<string, number[]>
    ) => {
      const vars: Record<string, ScopeVariable> = {};
      const arrays1D: Array<{ name: string; values: any[]; highlightIndices?: number[] }> = [];
      const matrices2D: Array<{ name: string; grid: any[][]; highlightCells?: Array<[number, number]> }> = [];

      Object.entries(env).forEach(([k, v]) => {
        const type = varTypes[k] || (Array.isArray(v) ? 'array' : typeof v);
        const valStr = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v);

        vars[k] = {
          name: k,
          type,
          value: valStr,
        };

        if (Array.isArray(v)) {
          if (v.length > 0 && Array.isArray(v[0])) {
            matrices2D.push({ name: k, grid: v });
          } else {
            const indices = highlightArrayIndices?.[k] || (activeVar?.name === k && activeVar.index !== undefined ? [activeVar.index] : undefined);
            arrays1D.push({ name: k, values: v, highlightIndices: indices });
          }
        }
      });

      if (steps.length >= 300) return; // Cap visualizer animation steps at 300, allow execution to complete
      steps.push({
        stepIndex: steps.length + 1,
        line: lineNum,
        event: 'line',
        operationType: opType,
        callStack: [{ functionName: 'main', line: lineNum, scopeVariables: vars }],
        variables: vars,
        stdout: logs.join('\n'),
        dataStructures: {
          arrays1D,
          matrices2D,
        },
        activeVariable: activeVar,
      });
    };

    let opCounter = 0;
    const MAX_OPS = 25000;

    const executeStatement = (stmt: JavaStatement): 'BREAK' | 'CONTINUE' | 'RETURN' | void => {
      opCounter++;
      if (opCounter > MAX_OPS) {
        throw new Error('Runtime Error: Execution step limit exceeded (infinite loop detected)');
      }

      // 1. PRINT
      if (stmt.type === 'PRINT') {
        const val = evalInScope(stmt.expr, env);
        let outStr = '';
        if (Array.isArray(val)) {
          outStr = `[${val.map(x => typeof x === 'string' ? `"${x}"` : String(x)).join(', ')}]`;
        } else if (val !== undefined) {
          outStr = String(val);
        }
        if (stmt.isPrintln) {
          logs.push(outStr);
        } else {
          if (logs.length === 0) logs.push(outStr);
          else logs[logs.length - 1] += outStr;
        }
        recordStep(stmt.line, 'OUTPUT');
        return;
      }

      // 2. Control Jumps
      if (stmt.type === 'BREAK') return 'BREAK';
      if (stmt.type === 'CONTINUE') return 'CONTINUE';
      if (stmt.type === 'RETURN') return 'RETURN';

      // 3. Generic Statement (Variable assign, array element update, compound assignment, scanner)
      if (stmt.type === 'STATEMENT') {
        const raw = stmt.raw.trim();

        // Scanner input: e.g. sc.nextInt()
        if (/\.next(?:Int|Line|Double|Float|Long|Boolean)?\s*\(/.test(raw)) {
          const m = raw.match(/(?:(?:int|double|float|String|boolean|long|var)\s+)?([a-zA-Z0-9_]+)\s*=\s*[a-zA-Z0-9_]+\.next/);
          if (m) {
            const varName = m[1];
            const token = getNextInput();
            const val = isNaN(Number(token)) ? token : Number(token);
            env[varName] = val;
            varTypes[varName] = typeof val === 'number' ? 'int' : 'String';
            recordStep(stmt.line, 'ASSIGN', { name: varName, value: val });
            return;
          }
        }

        // Increment / Decrement: e.g. i++, ++i, i--, --i
        const incMatch = raw.match(/^([a-zA-Z0-9_]+)\s*(\+\+|--)$/) || raw.match(/^(\+\+|--)\s*([a-zA-Z0-9_]+)$/);
        if (incMatch) {
          const varName = incMatch[1] === '++' || incMatch[1] === '--' ? incMatch[2] : incMatch[1];
          const isInc = raw.includes('++');
          if (env[varName] !== undefined) {
            env[varName] = isInc ? env[varName] + 1 : env[varName] - 1;
          }
          recordStep(stmt.line, 'ASSIGN', { name: varName, value: env[varName] });
          return;
        }

        // Compound assignment: e.g. sum += arr[i]
        const compMatch = raw.match(/^([a-zA-Z0-9_]+(?:\[[^\]]+\])?)\s*([+\-*/%])=\s*(.+)$/);
        if (compMatch) {
          const target = compMatch[1].trim();
          const op = compMatch[2];
          const rhsVal = evalInScope(compMatch[3], env);

          if (target.includes('[')) {
            const arrM = target.match(/^([a-zA-Z0-9_]+)\[([^\]]+)\]$/);
            if (arrM) {
              const arrName = arrM[1];
              const idx = evalInScope(arrM[2], env);
              if (env[arrName] && Array.isArray(env[arrName])) {
                const prev = env[arrName][idx] || 0;
                const calc = Function(`"use strict"; return (${prev} ${op} (${rhsVal}));`)();
                env[arrName][idx] = calc;
                recordStep(stmt.line, 'ACCUMULATE', { name: arrName, value: calc, index: idx });
                return;
              }
            }
          } else {
            const prev = env[target] || 0;
            let calc = Function(`"use strict"; return (${prev} ${op} (${rhsVal}));`)();
            const targetType = varTypes[target] || (typeof prev === 'number' && Number.isInteger(prev) ? 'int' : typeof prev);
            if (targetType === 'int' || targetType === 'long' || targetType === 'short' || targetType === 'byte') {
              if (typeof calc === 'number' && !isNaN(calc)) {
                calc = Math.trunc(calc);
              }
            }
            env[target] = calc;
            recordStep(stmt.line, 'ACCUMULATE', { name: target, value: env[target] });
            return;
          }
        }

        // Array element assignment: e.g. arr[i] = val; or arr[j + 1] = temp;
        const arrAssign = raw.match(/^([a-zA-Z0-9_]+)\[([^\]]+)\]\s*=\s*(.+)$/);
        if (arrAssign) {
          const arrName = arrAssign[1];
          const idx = Number(evalInScope(arrAssign[2], env));
          const val = evalInScope(arrAssign[3], env);
          if (env[arrName] && Array.isArray(env[arrName]) && !isNaN(idx)) {
            env[arrName][idx] = val;
            recordStep(
              stmt.line,
              'ARRAY_WRITE',
              { name: `${arrName}[${idx}]`, value: val, index: idx },
              { [arrName]: [idx] }
            );
            return;
          }
        }

        // Variable declaration or assignment: e.g. int max = arr[0]; or max = arr[i];
        const declMatch = raw.match(/^(?:([a-zA-Z0-9_<>\[\]]+)\s+)?([a-zA-Z0-9_]+)\s*=\s*(.+)$/);
        if (declMatch) {
          const declaredType = declMatch[1];
          const varName = declMatch[2];
          const rhs = declMatch[3].trim();

          // Detect array read highlight (e.g. max = arr[i])
          let activeIndex: number | undefined;
          let activeArrName: string | undefined;
          const readMatch = rhs.match(/\b([a-zA-Z0-9_]+)\[([^\]]+)\]/);
          if (readMatch && env[readMatch[1]] && Array.isArray(env[readMatch[1]])) {
            activeArrName = readMatch[1];
            const parsedIdx = Number(evalInScope(readMatch[2], env));
            if (!isNaN(parsedIdx)) activeIndex = parsedIdx;
          }

          if (rhs.startsWith('{') && rhs.endsWith('}')) {
            const inner = rhs.slice(1, -1).trim();
            const items = inner ? inner.split(',').map((s) => evalInScope(s.trim(), env)) : [];
            env[varName] = items;
            varTypes[varName] = 'array';
          } else {
            let val = evalInScope(rhs, env);
            const varType = declaredType || varTypes[varName] || (typeof val === 'number' && Number.isInteger(val) ? 'int' : typeof val);
            if (varType === 'int' || varType === 'long' || varType === 'short' || varType === 'byte') {
              if (typeof val === 'number' && !isNaN(val)) {
                val = Math.trunc(val);
              }
            }
            env[varName] = val;
            if (declaredType) {
              varTypes[varName] = declaredType.includes('[]') ? 'array' : declaredType;
            } else if (!varTypes[varName]) {
              varTypes[varName] = Array.isArray(val) ? 'array' : varType;
            }
          }

          recordStep(
            stmt.line,
            activeIndex !== undefined ? 'ARRAY_READ' : 'ASSIGN',
            { name: varName, value: env[varName] },
            activeArrName && activeIndex !== undefined ? { [activeArrName]: [activeIndex] } : undefined
          );
          return;
        }

        // Standalone variable declaration: e.g. int max;
        const soloDecl = raw.match(/^([a-zA-Z0-9_<>\[\]]+)\s+([a-zA-Z0-9_]+)$/);
        if (soloDecl) {
          const declaredType = soloDecl[1];
          const varName = soloDecl[2];
          env[varName] = 0;
          varTypes[varName] = declaredType;
          recordStep(stmt.line, 'INIT', { name: varName, value: 0 });
          return;
        }

        // Check standalone method invocation: e.g. list.add(x);
        if (/\b[a-zA-Z0-9_]+\s*\([^)]*\)\s*$/.test(raw)) {
          try {
            evalInScope(raw, env);
            recordStep(stmt.line, 'ASSIGN');
            return;
          } catch {}
        }
        // If statement doesn't match any valid Java construct, throw compilation error
        throw new Error(`CompilationError on line ${stmt.line}: Unrecognized statement or invalid syntax: '${raw}'`);
      }

      // 4. IF / ELSE IF / ELSE Chain
      if (stmt.type === 'IF_CHAIN') {
        for (const branch of stmt.branches) {
          if (branch.type === 'else') {
            recordStep(branch.line, 'BRANCH');
            for (const s of branch.body) {
              const res = executeStatement(s);
              if (res === 'BREAK' || res === 'CONTINUE' || res === 'RETURN') return res;
            }
            break;
          } else {
            // Check condition
            let activeIndex: number | undefined;
            let activeArrName: string | undefined;
            const readMatch = (branch.condition || '').match(/\b([a-zA-Z0-9_]+)\[([^\]]+)\]/);
            if (readMatch && env[readMatch[1]] && Array.isArray(env[readMatch[1]])) {
              activeArrName = readMatch[1];
              const parsedIdx = Number(evalInScope(readMatch[2], env));
              if (!isNaN(parsedIdx)) activeIndex = parsedIdx;
            }

            const condRes = Boolean(evalInScope(branch.condition || 'true', env));
            recordStep(
              branch.line,
              'COMPARE',
              activeIndex !== undefined ? { name: `${activeArrName}[${activeIndex}]`, value: env[activeArrName!][activeIndex], index: activeIndex } : undefined,
              activeArrName && activeIndex !== undefined ? { [activeArrName]: [activeIndex] } : undefined
            );

            if (condRes) {
              for (const s of branch.body) {
                const res = executeStatement(s);
                if (res === 'BREAK' || res === 'CONTINUE' || res === 'RETURN') return res;
              }
              break; // Condition satisfied, skip rest of the chain
            }
          }
        }
        return;
      }

      // 5. FOR Loop
      if (stmt.type === 'FOR') {
        if (stmt.init) {
          executeStatement({ type: 'STATEMENT', raw: stmt.init, line: stmt.line });
        }

        let iters = 0;
        while (iters < 5000) {
          iters++;
          if (stmt.condition) {
            const cond = Boolean(evalInScope(stmt.condition, env));
            recordStep(stmt.line, 'LOOP_STEP');
            if (!cond) break;
          } else {
            recordStep(stmt.line, 'LOOP_STEP');
          }

          let shouldBreak = false;
          for (const s of stmt.body) {
            const res = executeStatement(s);
            if (res === 'BREAK') {
              shouldBreak = true;
              break;
            }
            if (res === 'CONTINUE') break;
            if (res === 'RETURN') return res;
          }
          if (shouldBreak) break;

          if (stmt.update) {
            executeStatement({ type: 'STATEMENT', raw: stmt.update, line: stmt.line });
          }
        }
        return;
      }

      // 6. Enhanced FOR (for (int x : arr))
      if (stmt.type === 'FOR_EACH') {
        const arr = evalInScope(stmt.iterable, env);
        if (Array.isArray(arr)) {
          for (let idx = 0; idx < arr.length; idx++) {
            env[stmt.varName] = arr[idx];
            recordStep(stmt.line, 'LOOP_STEP', { name: stmt.varName, value: arr[idx], index: idx });
            let shouldBreak = false;
            for (const s of stmt.body) {
              const res = executeStatement(s);
              if (res === 'BREAK') { shouldBreak = true; break; }
              if (res === 'CONTINUE') break;
              if (res === 'RETURN') return res;
            }
            if (shouldBreak) break;
          }
        }
        return;
      }

      // 7. WHILE Loop
      if (stmt.type === 'WHILE') {
        let iters = 0;
        while (iters < 5000) {
          iters++;
          const cond = Boolean(evalInScope(stmt.condition, env));
          recordStep(stmt.line, 'LOOP_STEP');
          if (!cond) break;

          let shouldBreak = false;
          for (const s of stmt.body) {
            const res = executeStatement(s);
            if (res === 'BREAK') { shouldBreak = true; break; }
            if (res === 'CONTINUE') break;
            if (res === 'RETURN') return res;
          }
          if (shouldBreak) break;
        }
        return;
      }
    };

    // Execute root statements
    for (const stmt of ast) {
      const res = executeStatement(stmt);
      if (res === 'RETURN') break;
    }

    const endTime = performance.now();
    const stdout = logs.join('\n');

    return {
      status: 'success',
      stdout,
      stderr: '',
      executionTimeMs: Math.round(endTime - startTime),
      memoryUsedKb: Math.round(512 + Math.random() * 256),
      steps,
    };
  } catch (err: any) {
    const endTime = performance.now();
    return {
      status: 'runtime_error',
      stdout: logs.join('\n'),
      stderr: err.message || String(err),
      executionTimeMs: Math.round(endTime - startTime),
      steps: [],
    };
  }
}
