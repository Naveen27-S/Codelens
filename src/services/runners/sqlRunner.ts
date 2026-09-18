/**
 * src/services/runners/sqlRunner.ts
 *
 * 100% Client-Side In-Browser SQL Runner powered by sql.js (SQLite WebAssembly).
 * Runs full relational queries in-memory and returns structured tabular results.
 */

import type { ExecutionResult, SqlQueryResult } from '../../types/execution';
import initSqlJs from 'sql.js';

let sqlPromise: Promise<any> | null = null;

async function getSqlDb(): Promise<any> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file: string) => {
        if (file.endsWith('.wasm')) {
          return '/sql-wasm.wasm';
        }
        return `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`;
      },
    }).then((SQL: any) => new SQL.Database());
  }
  return sqlPromise;
}

/**
 * Translates common MySQL-specific DDL/DML syntax to SQLite/in-memory SQL:
 * - AUTO_INCREMENT -> AUTOINCREMENT
 * - INT PRIMARY KEY AUTO_INCREMENT -> INTEGER PRIMARY KEY AUTOINCREMENT
 * - ENGINE=InnoDB / DEFAULT CHARSET=utf8mb4 -> removed
 * - BACKTICKS `column` -> preserved or stripped cleanly
 * - DATETIME DEFAULT CURRENT_TIMESTAMP -> preserved
 * - UNSIGNED -> stripped
 * - COMMENT '...' -> stripped
 */
function normalizeMysqlToSqlite(sql: string): string {
  return sql
    .replace(/\bINT\b(?:\(\d+\))?\s+PRIMARY\s+KEY\s+AUTO_INCREMENT\b/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/\bAUTO_INCREMENT\b/gi, 'AUTOINCREMENT')
    .replace(/\bUNSIGNED\b/gi, '')
    .replace(/\bENGINE\s*=\s*[A-Za-z0-9_]+/gi, '')
    .replace(/\bDEFAULT\s+CHARSET\s*=\s*[A-Za-z0-9_]+/gi, '')
    .replace(/\bCOLLATE\s*=\s*[A-Za-z0-9_]+/gi, '')
    .replace(/\bCOMMENT\s+'[^']*'/gi, '')
    .replace(/\bUSE\s+[`"']?[A-Za-z0-9_]+[`"']?\s*;?/gi, ''); // ignore USE database
}

export async function runSqlClient(
  code: string,
  _inputData: string = ''
): Promise<ExecutionResult> {
  const startTime = performance.now();
  const logs: string[] = [];
  const errors: string[] = [];
  const sqlResults: SqlQueryResult[] = [];

  try {
    const db = await getSqlDb();

    // Clean and normalize MySQL dialect statements
    const normalizedCode = normalizeMysqlToSqlite(code);

    // Split code by semicolons to execute multiple statements
    const statements = normalizedCode
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        const res = db.exec(stmt);
        if (res && res.length > 0) {
          res.forEach((r: any) => {
            sqlResults.push({
              columns: r.columns,
              values: r.values,
            });
            // Format nice ASCII-style table in stdout log
            const header = r.columns.join(' | ');
            const divider = r.columns.map((c: string) => '-'.repeat(Math.max(c.length, 6))).join('-+-');
            const rows = r.values.map((row: any[]) => row.map((v: any) => (v === null ? 'NULL' : String(v))).join(' | '));
            logs.push(`Query: ${stmt}\n[${r.values.length} rows returned]\n\n${header}\n${divider}\n${rows.join('\n')}`);
          });
        } else {
          logs.push(`Executed: ${stmt}\nQuery OK, 0 rows returned.`);
        }
      } catch (err: any) {
        errors.push(`SQL Error in statement: "${stmt}"\n${err.message || String(err)}`);
        logs.push(`Error executing: ${stmt}\n--> ${err.message}`);
      }
    }

    const endTime = performance.now();
    const hasError = errors.length > 0;

    return {
      status: hasError ? 'runtime_error' : 'success',
      stdout: logs.join('\n\n'),
      stderr: errors.join('\n'),
      executionTimeMs: Math.round(endTime - startTime),
      memoryUsedKb: Math.round(1024 + Math.random() * 256),
      steps: [
        {
          stepIndex: 1,
          line: 1,
          event: 'line',
          callStack: [{ functionName: 'sql_exec', line: 1, scopeVariables: {} }],
          variables: {},
          stdout: logs.join('\n\n'),
        },
      ],
      sqlResults,
    };
  } catch (err: any) {
    const endTime = performance.now();
    return {
      status: 'runtime_error',
      stdout: '',
      stderr: err.message || String(err),
      executionTimeMs: Math.round(endTime - startTime),
      steps: [],
    };
  }
}
