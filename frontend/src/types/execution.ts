/**
 * src/types/execution.ts
 *
 * Type definitions for Client-Side Multi-Language Execution & Visualization.
 */

export type SupportedLanguage = 'python' | 'java' | 'c' | 'cpp';

export interface ScopeVariable {
  name: string;
  value: any;
  type: string;
  previousValue?: any;
  isChanged?: boolean;
}

export interface CallFrame {
  functionName: string;
  line: number;
  args?: Record<string, any>;
  scopeVariables: Record<string, ScopeVariable>;
}

export type OperationType =
  | 'INIT'
  | 'ARRAY_READ'
  | 'ARRAY_WRITE'
  | 'ACCUMULATE'
  | 'ASSIGN'
  | 'COMPARE'
  | 'SWAP'
  | 'LOOP_STEP'
  | 'BRANCH'
  | 'OUTPUT'
  | 'CALL'
  | 'RETURN';

export interface ActiveVariableInfo {
  name: string;
  value: any;
  index?: number;
  iteration?: number;
}

export interface AccumulatorInfo {
  name: string;
  prevValue: any;
  newValue: any;
  expression?: string;
}

export interface LoopInfo {
  indexVar?: string;
  iteration: number;
  totalIterations?: number;
  activeIndex?: number;
}

export interface ExecutionLogEntry {
  step: number;
  line: number;
  iteration?: number;
  operation: string;
  selectedValue?: any;
  prevTotal?: any;
  newTotal?: any;
  expression?: string;
  description: string;
}

export interface ExecutionStep {
  stepIndex: number;
  line: number;
  event: 'line' | 'call' | 'return' | 'exception';
  callStack: CallFrame[];
  variables: Record<string, ScopeVariable>;
  stdout: string;
  operationType?: OperationType;
  operationExpression?: string;
  activeVariable?: ActiveVariableInfo;
  accumulatorVariable?: AccumulatorInfo;
  loopInfo?: LoopInfo;
  logEntry?: ExecutionLogEntry;
  dataStructures?: {
    arrays1D?: Array<{ name: string; values: any[]; highlightIndices?: number[] }>;
    matrices2D?: Array<{ name: string; grid: any[][]; highlightCells?: Array<[number, number]> }>;
    linkedLists?: Array<{ name: string; nodes: Array<{ value: any; next: number | null }>; head: number | null }>;
  };
}

export interface SqlQueryResult {
  columns: string[];
  values: any[][];
  rowsAffected?: number;
}

export interface ExecutionResult {
  status: 'success' | 'runtime_error' | 'compilation_error' | 'timeout';
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  memoryUsedKb?: number;
  steps: ExecutionStep[];
  sqlResults?: SqlQueryResult[];
  errorDetails?: string;
}
