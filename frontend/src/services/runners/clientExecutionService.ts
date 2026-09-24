/**
 * src/services/runners/clientExecutionService.ts
 *
 * Unified Client-Side Execution Controller.
 * Enforces 5-second timeout guard to prevent infinite loops from freezing the browser UI.
 * Dispatches code execution requests to Python (Pyodide), JS/TS, C/C++ (JSCPP), and SQL (sql.js).
 */

import type { ExecutionResult } from '../../types/execution';
import { runPythonClient } from './pythonRunner';
import { runJSClient } from './jsRunner';
import { runJavaClient } from './javaRunner';
import { runCppClient } from './cppRunner';
import { runSqlClient } from './sqlRunner';

const TIMEOUT_MS = 5000;

export async function executeCodeClient(
  language: string,
  code: string,
  inputData: string = ''
): Promise<ExecutionResult> {
  const normLang = language.toLowerCase().trim();

  // Create timeout Promise to kill hanging execution after 5 seconds
  const timeoutPromise = new Promise<ExecutionResult>((_, reject) => {
    setTimeout(() => {
      reject(new Error('Execution Timed Out (5s limit exceeded). Possible infinite loop in code.'));
    }, TIMEOUT_MS);
  });

  const executionTask = (async (): Promise<ExecutionResult> => {
    switch (normLang) {
      case 'python':
        return await runPythonClient(code, inputData);
      case 'javascript':
      case 'js':
        return await runJSClient(code, inputData);
      case 'java':
        return await runJavaClient(code, inputData);
      case 'c':
      case 'cpp':
      case 'c++':
        return await runCppClient(code, inputData);
      case 'sql':
        return await runSqlClient(code, inputData);
      default:
        return await runPythonClient(code, inputData);
    }
  })();

  try {
    return await Promise.race([executionTask, timeoutPromise]);
  } catch (err: any) {
    return {
      status: 'timeout',
      stdout: '',
      stderr: err.message || 'Execution Error / Timeout',
      executionTimeMs: TIMEOUT_MS,
      steps: [],
    };
  }
}
