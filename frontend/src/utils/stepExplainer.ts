/**
 * src/utils/stepExplainer.ts
 *
 * Generates natural plain-English explanations for overall code and execution steps.
 * Used for AI Voice Narration and Live Subtitle Captions.
 */

import type { ExecutionStep } from '../types/execution';

export function getCodeOverviewExplanation(
  language: string = 'code',
  totalSteps: number = 0,
  code?: string
): string {
  let lineCountDesc = '';
  if (code) {
    const lines = code.split('\n').filter((l) => l.trim().length > 0);
    lineCountDesc = ` for your ${lines.length}-line ${language.toUpperCase()} program`;
  }

  const stepCountDesc = totalSteps > 0 ? ` with ${totalSteps} execution steps` : '';

  return `Code Operation Overview: Starting voice explanation${lineCountDesc}${stepCountDesc}. Follow the yellow line highlight and visual data structures as each operation is explained out loud.`;
}

function parseLineOperationText(lineCode: string): string {
  const code = lineCode.trim();
  if (!code) return '';

  // Remove single line comments
  const cleanCode = code.replace(/#.*$/, '').replace(/\/\/.*$/, '').replace(/--.*$/, '').trim();

  // Print / Output statement across languages
  if (/^printf\s*\(/.test(cleanCode)) {
    return 'Calling printf to format and output message to console';
  }
  if (/^cout\s*<</.test(cleanCode)) {
    return 'Streaming output to console stream using cout';
  }
  if (/^System\.out\.print(?:ln)?\s*\(/.test(cleanCode)) {
    return 'Outputting text to standard console using System.out.println';
  }
  if (/^(print|console\.log)/.test(cleanCode)) {
    return 'Outputting result to console';
  }

  // Input statements
  if (/^cin\s*>>/.test(cleanCode)) {
    return 'Reading input data from standard input stream using cin';
  }
  if (/^scanf\s*\(/.test(cleanCode)) {
    return 'Reading formatted values from input using scanf';
  }
  if (/Scanner\s+[a-zA-Z0-9_]+\s*=/.test(cleanCode)) {
    return 'Initializing Scanner instance for input parsing';
  }

  // C++ STL Vector operations
  if (/\bvector<[^>]+>\s+([a-zA-Z0-9_]+)/.test(cleanCode)) {
    const vMatch = cleanCode.match(/\bvector<[^>]+>\s+([a-zA-Z0-9_]+)/);
    return `Declaring dynamic STL vector ${vMatch ? vMatch[1] : ''}`;
  }
  if (/\.push_back\s*\(/.test(cleanCode)) {
    const pMatch = cleanCode.match(/([a-zA-Z0-9_]+)\.push_back\(([^)]+)\)/);
    return pMatch ? `Appending element ${pMatch[2].trim()} to vector ${pMatch[1]}` : 'Appending element to vector';
  }

  // Pointer operations
  if (/^[a-zA-Z0-9_]+\s*\*\s*([a-zA-Z0-9_]+)\s*=\s*&([a-zA-Z0-9_]+)/.test(cleanCode)) {
    const ptrMatch = cleanCode.match(/([a-zA-Z0-9_]+)\s*=\s*&([a-zA-Z0-9_]+)/);
    return ptrMatch ? `Pointer declaration: storing address of ${ptrMatch[2]} into pointer ${ptrMatch[1]}` : 'Storing memory address into pointer';
  }
  if (/^\*([a-zA-Z0-9_]+)\s*=\s*(.+)/.test(cleanCode)) {
    const dMatch = cleanCode.match(/^\*([a-zA-Z0-9_]+)\s*=\s*([^;]+)/);
    return dMatch ? `Dereferencing pointer ${dMatch[1]} and modifying pointed value to ${dMatch[2].trim()}` : 'Dereferencing pointer to update memory value';
  }

  // SQL queries
  if (/^SELECT\b/i.test(cleanCode)) {
    return 'Executing SQL SELECT query to retrieve tabular data';
  }
  if (/^CREATE\s+TABLE\b/i.test(cleanCode)) {
    return 'Executing SQL DDL to create new relational database table';
  }
  if (/^INSERT\s+INTO\b/i.test(cleanCode)) {
    return 'Executing SQL INSERT to write records into database table';
  }
  if (/^UPDATE\b/i.test(cleanCode)) {
    return 'Executing SQL UPDATE statement to modify records';
  }
  if (/^DELETE\s+FROM\b/i.test(cleanCode)) {
    return 'Executing SQL DELETE statement to remove records';
  }

  // Preprocessor directives & imports
  if (/^#include\b/.test(cleanCode)) {
    return `Importing standard header ${cleanCode.replace('#include', '').trim()}`;
  }
  if (/^using\s+namespace\b/.test(cleanCode)) {
    return 'Importing standard namespace';
  }
  if (/^import\b/.test(cleanCode)) {
    return 'Importing external package module';
  }

  // Class & Method definition
  if (/public\s+class\s+([a-zA-Z0-9_]+)/.test(cleanCode)) {
    const cMatch = cleanCode.match(/public\s+class\s+([a-zA-Z0-9_]+)/);
    return `Declaring Java class ${cMatch ? cMatch[1] : ''}`;
  }
  if (/main\s*\(/.test(cleanCode)) {
    return 'Entering main program entrypoint function';
  }
  if (/^(def\s+|function\s+|public\s+|static\s+|void\s+)/.test(cleanCode)) {
    const funcMatch = cleanCode.match(/(?:def|function)\s+([a-zA-Z0-9_]+)/);
    const name = funcMatch ? funcMatch[1] : 'function';
    return `Defining function ${name}`;
  }

  // Return statement
  if (/^return\b/.test(cleanCode)) {
    const expr = cleanCode.replace(/^return\s*/, '').replace(/;$/, '');
    return expr ? `Returning value ${expr}` : 'Returning from function';
  }

  // Loop statements
  if (/^for\b/.test(cleanCode)) {
    return 'Loop control: evaluating condition and advancing iteration index';
  }
  if (/^while\b/.test(cleanCode)) {
    return 'Evaluating while loop continuation predicate';
  }

  // Conditional statements
  if (/^if\b/.test(cleanCode)) {
    const cond = cleanCode.replace(/^if\s*/, '').replace(/:\s*$/, '').replace(/\{?\s*$/, '').replace(/\(\s*/, '').replace(/\)\s*$/, '');
    return `Checking conditional branch (${cond})`;
  }
  if (/^elif\b|^else\s*if\b/.test(cleanCode)) {
    return 'Checking alternative conditional branch';
  }
  if (/^else\b/.test(cleanCode)) {
    return 'Executing fallback else branch';
  }

  // Array / Variable assignments
  if (cleanCode.includes('=')) {
    const parts = cleanCode.split('=');
    const varName = parts[0].trim().replace(/(?:int|float|double|char|long|String|var|let|const)\s+/, '');
    const valExpr = parts.slice(1).join('=').trim().replace(/;$/, '');
    return `Assigning ${varName} = ${valExpr}`;
  }

  return `Executing statement: ${cleanCode.replace(/;$/, '')}`;
}

export function getStepExplanation(
  step?: ExecutionStep,
  totalSteps?: number,
  sourceCode?: string
): string {
  // Guard for no step (initial state)
  if (!step) {
    return 'Ready to run or debug step-by-step code visualization.';
  }

  const stepNum = step.stepIndex;
  const total = totalSteps ? ` of ${totalSteps}` : '';

  // High‑level explanations for key operation types
  if (step.operationType === 'ACCUMULATE' && step.accumulatorVariable) {
    const acc = step.accumulatorVariable;
    const added = step.activeVariable ? step.activeVariable.value : (acc.newValue - acc.prevValue);
    return `Step ${stepNum}${total}: Updating accumulator ${acc.name} to ${acc.newValue} (added ${added}).`;
  }

  if (step.operationType === 'LOOP_STEP' && step.activeVariable) {
    const act = step.activeVariable;
    const iterInfo = act.iteration ? `Iteration ${act.iteration}` : '';
    const idxInfo = act.index !== undefined ? `at index ${act.index}` : '';
    return `Step ${stepNum}${total}: ${iterInfo} ${idxInfo} processing ${act.name} = ${act.value}.`;
  }

  if (step.operationType === 'OUTPUT') {
    const out = step.stdout ? step.stdout.trim() : '';
    return `Step ${stepNum}${total}: Output produced${out ? ` – ${out}` : ''}.`;
  }

  if (step.operationType === 'INIT') {
    const varItems = Object.entries(step.variables || {})
      .filter(([k]) => !k.startsWith('_'))
      .map(([k, v]) => `${k} = ${v.value}`);
    return `Step ${stepNum}${total}: Program initialization with ${varItems.join(', ')}.`;
  }

  // Call and return events
  if (step.event === 'call') {
    const funcName = step.callStack && step.callStack.length > 0 ? step.callStack[0].functionName : 'main';
    return `Step ${stepNum}${total}: Calling function ${funcName}.`;
  }

  if (step.event === 'return') {
    const funcName = step.callStack && step.callStack.length > 0 ? step.callStack[0].functionName : 'main';
    return `Step ${stepNum}${total}: Returning from function ${funcName}.`;
  }

  // Fallback: use source line text to generate a concise description without line numbers
  let lineText = '';
  if (sourceCode) {
    const lines = sourceCode.split('\n');
    if (step.line > 0 && step.line <= lines.length) {
      lineText = lines[step.line - 1].trim();
    }
  }
  const operationDesc = lineText ? parseLineOperationText(lineText) : '';
  const description = operationDesc || 'Executing program statement.';
  return `Step ${stepNum}${total}: ${description}`;
}
