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

  // Array element updates: e.g. arr[i] = val or arr[j + 1] = temp
  const arrElemMatch = cleanCode.match(/^([a-zA-Z0-9_]+)\s*\[([^\]]+)\]\s*=\s*(.+)$/);
  if (arrElemMatch) {
    const rawName = arrElemMatch[1];
    const name = rawName.toLowerCase() === 'arr' ? 'array' : rawName;
    const idx = arrElemMatch[2].trim();
    const val = arrElemMatch[3].trim().replace(/;$/, '');
    return `Updating array ${name} at index ${idx} to ${val}`;
  }

  // Array / Variable assignments
  if (cleanCode.includes('=')) {
    const parts = cleanCode.split('=');
    const varName = parts[0].trim().replace(/(?:int|float|double|char|long|String|var|let|const)\s+/, '');
    const valExpr = parts.slice(1).join('=').trim().replace(/;$/, '');
    const isArray =
      /\[\s*\]/.test(parts[0]) ||
      /^\s*\[.*\]\s*$/.test(valExpr) ||
      /^\s*\{.*\}\s*$/.test(valExpr) ||
      /new\s+(?:Array|\w+\[)/.test(valExpr);
    const cleanVar = varName.replace(/\[\s*\]/g, '').trim();
    const displayName = cleanVar.toLowerCase() === 'arr' ? 'array' : cleanVar;
    if (isArray) {
      return `Initializing array ${displayName} with ${valExpr}`;
    }
    return `Assigning ${displayName} = ${valExpr}`;
  }

  return `Executing statement: ${cleanCode.replace(/;$/, '')}`;
}

export function getStepExplanation(
  step?: ExecutionStep,
  totalSteps?: number,
  sourceCode?: string,
  explanationLevel: 'beginner' | 'intermediate' | 'advanced' = 'intermediate'
): string {
  // Guard for no step (initial state)
  if (!step) {
    if (explanationLevel === 'beginner') {
      return 'Ready! Press play or next step to watch and learn how your code works.';
    }
    if (explanationLevel === 'advanced') {
      return 'Debugger idle. Ready for instruction-level tracing and memory state inspection.';
    }
    return 'Ready to run or debug step-by-step code visualization.';
  }

  const stepNum = step.stepIndex;
  const total = totalSteps ? ` of ${totalSteps}` : '';

  // High‑level explanations for key operation types
  if (step.operationType === 'ACCUMULATE' && step.accumulatorVariable) {
    const acc = step.accumulatorVariable;
    const added = step.activeVariable ? step.activeVariable.value : (acc.newValue - acc.prevValue);
    const accName = acc.name.toLowerCase() === 'arr' ? 'array' : acc.name;
    if (explanationLevel === 'beginner') {
      return `Step ${stepNum}${total}: We add ${added} into our running total "${accName}", so it now holds ${acc.newValue} (like dropping coins into a savings jar).`;
    }
    if (explanationLevel === 'advanced') {
      return `Step ${stepNum}${total} [O(1)]: Accumulator register update on "${accName}". Previous state: ${acc.prevValue} -> New state: ${acc.newValue} (delta: +${added}).`;
    }
    return `Step ${stepNum}${total}: Updating accumulator ${accName} to ${acc.newValue} (added ${added}).`;
  }

  if (step.operationType === 'LOOP_STEP' && step.activeVariable) {
    const act = step.activeVariable;
    const iterInfo = act.iteration ? `Iteration ${act.iteration}` : '';
    const idxInfo = act.index !== undefined ? `at index ${act.index}` : '';
    const actName = act.name.replace(/\barr\b/gi, 'array');
    if (explanationLevel === 'beginner') {
      return `Step ${stepNum}${total}: Repeating the loop! We look at item ${act.value} at position ${act.index ?? 0} and do our step.`;
    }
    if (explanationLevel === 'advanced') {
      return `Step ${stepNum}${total}: Loop invariant verified. ${iterInfo} evaluating sequence element "${actName}" = ${act.value}${idxInfo ? ` at buffer offset [${act.index}]` : ''}.`;
    }
    return `Step ${stepNum}${total}: ${iterInfo} ${idxInfo} processing ${actName} = ${act.value}.`;
  }

  if (step.operationType === 'ARRAY_WRITE' && step.activeVariable) {
    const act = step.activeVariable;
    const actName = act.name.replace(/\barr\b/gi, 'array');
    const idxInfo = act.index !== undefined ? ` at index ${act.index}` : '';
    if (explanationLevel === 'beginner') {
      return `Step ${stepNum}${total}: Updating our list "${actName}". We put the new value ${act.value} into slot ${act.index ?? 0}.`;
    }
    if (explanationLevel === 'advanced') {
      return `Step ${stepNum}${total} [O(1)]: In-place mutation of contiguous memory in "${actName}" at offset [${act.index ?? 0}] -> assigned ${act.value}.`;
    }
    return `Step ${stepNum}${total}: Updating array ${actName}${idxInfo} to ${act.value}.`;
  }

  if (step.operationType === 'ARRAY_READ' && step.activeVariable) {
    const act = step.activeVariable;
    const actName = act.name.replace(/\barr\b/gi, 'array');
    const idxInfo = act.index !== undefined ? ` at index ${act.index}` : '';
    if (explanationLevel === 'beginner') {
      return `Step ${stepNum}${total}: Peeking into our list "${actName}". Slot ${act.index ?? 0} contains value ${act.value}.`;
    }
    if (explanationLevel === 'advanced') {
      return `Step ${stepNum}${total} [O(1)]: Direct indexed dereference of "${actName}" at index [${act.index ?? 0}] yielding value ${act.value}.`;
    }
    return `Step ${stepNum}${total}: Reading from array ${actName}${idxInfo} value ${act.value}.`;
  }

  if (step.operationType === 'OUTPUT') {
    const out = step.stdout ? step.stdout.trim() : '';
    if (explanationLevel === 'beginner') {
      return `Step ${stepNum}${total}: Printing to the screen: ${out ? `"${out}"` : '(empty line)'}.`;
    }
    if (explanationLevel === 'advanced') {
      return `Step ${stepNum}${total}: Stdout stream flush write operation${out ? `: "${out}"` : ''}.`;
    }
    return `Step ${stepNum}${total}: Output produced${out ? ` – ${out}` : ''}.`;
  }

  if (step.operationType === 'INIT') {
    const varItems = Object.entries(step.variables || {})
      .filter(([k]) => !k.startsWith('_'))
      .map(([k, v]) => {
        const displayKey = k.toLowerCase() === 'arr' ? 'array' : k;
        return `${displayKey} = ${v.value}`;
      });
    if (explanationLevel === 'beginner') {
      return `Step ${stepNum}${total}: Getting things ready! Creating our starting variables: ${varItems.join(', ')}.`;
    }
    if (explanationLevel === 'advanced') {
      return `Step ${stepNum}${total}: Environment activation record and lexical binding initialized with { ${varItems.join(', ')} }.`;
    }
    return `Step ${stepNum}${total}: Program initialization with ${varItems.join(', ')}.`;
  }

  // Call and return events
  if (step.event === 'call') {
    const funcName = step.callStack && step.callStack.length > 0 ? step.callStack[0].functionName : 'main';
    if (explanationLevel === 'beginner') {
      return `Step ${stepNum}${total}: Calling helper function "${funcName}" to run its recipe.`;
    }
    if (explanationLevel === 'advanced') {
      return `Step ${stepNum}${total}: Call stack push — allocated new stack frame for activation "${funcName}()".`;
    }
    return `Step ${stepNum}${total}: Calling function ${funcName}.`;
  }

  if (step.event === 'return') {
    const funcName = step.callStack && step.callStack.length > 0 ? step.callStack[0].functionName : 'main';
    if (explanationLevel === 'beginner') {
      return `Step ${stepNum}${total}: Finished "${funcName}" and jumping back to continue the main code.`;
    }
    if (explanationLevel === 'advanced') {
      return `Step ${stepNum}${total}: Call stack pop — deallocating stack frame for "${funcName}()" and returning control.`;
    }
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
  if (explanationLevel === 'beginner') {
    return `Step ${stepNum}${total}: ${description.replace('Executing statement:', 'Doing this action:').replace('evaluating while loop continuation predicate', 'checking if while loop should keep going').replace('evaluating condition and advancing iteration index', 'checking loop counter and moving forward')}`;
  }
  if (explanationLevel === 'advanced') {
    return `Step ${stepNum}${total}: [PC line ${step.line}] ${description}`;
  }
  return `Step ${stepNum}${total}: ${description}`;
}
