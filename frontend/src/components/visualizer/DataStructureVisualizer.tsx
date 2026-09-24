/**
 * src/components/visualizer/DataStructureVisualizer.tsx
 *
 * Interactive Data Structure Renderer for Arrays (1D), Matrices (2D),
 * Linked Lists/Trees, and SQL Tabular Results.
 */

import React from 'react';
import type { ExecutionStep, SqlQueryResult } from '../../types/execution';
import { Database, Layers, GitFork } from 'lucide-react';

interface Props {
  currentStep?: ExecutionStep;
  sqlResults?: SqlQueryResult[];
}

export const DataStructureVisualizer: React.FC<Props> = ({ currentStep, sqlResults }) => {
  const arrays1D = currentStep?.dataStructures?.arrays1D || [];
  const matrices2D = currentStep?.dataStructures?.matrices2D || [];

  const hasData = arrays1D.length > 0 || matrices2D.length > 0 || (sqlResults && sqlResults.length > 0);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800">
        <Layers className="w-10 h-10 mb-3 text-cyan-400 opacity-60 animate-pulse" />
        <p className="font-medium text-slate-300">No Data Structures Detected in Current Step</p>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          Run or debug Python, Java, C, or C++ code with arrays or matrices to see dynamic visual structures here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 bg-slate-900 rounded-xl border border-slate-800 overflow-y-auto max-h-[600px]">
      {/* ─── 1D Array Visualizer ────────────────────────────────────────────── */}
      {arrays1D.map((arr, arrIdx) => (
        <div key={`arr-${arrIdx}`} className="bg-slate-950/80 p-4 rounded-lg border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              1D Array: <code className="text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded font-mono text-xs">{arr.name}</code>
            </span>
            <span className="text-xs text-slate-500 font-mono">Length: {arr.values.length}</span>
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-start overflow-x-auto py-2">
            {arr.values.map((val, idx) => {
              const isHighlighted = arr.highlightIndices?.includes(idx);
              return (
                <div
                  key={idx}
                  className={`flex flex-col items-center justify-center min-w-[50px] h-[55px] px-3 py-1 rounded-lg border transition-all transform hover:scale-105 ${
                    isHighlighted
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-500/20 ring-2 ring-cyan-400/50'
                      : 'bg-slate-900 border-slate-700 text-slate-200'
                  }`}
                >
                  <span className="text-xs text-slate-400 font-mono mb-0.5">[{idx}]</span>
                  <span className="text-sm font-bold font-mono text-cyan-300">
                    {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* ─── 2D Matrix Visualizer ────────────────────────────────────────────── */}
      {matrices2D.map((mat, matIdx) => (
        <div key={`mat-${matIdx}`} className="bg-slate-950/80 p-4 rounded-lg border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
              <GitFork className="w-4 h-4 text-emerald-400" />
              2D Matrix Grid: <code className="text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded font-mono text-xs">{mat.name}</code>
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {mat.grid.length} × {mat.grid[0]?.length || 0}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="border-collapse mx-auto">
              <tbody>
                {mat.grid.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className="w-12 h-12 border border-slate-700 text-center font-mono text-sm bg-slate-900 text-emerald-300 font-semibold p-1 hover:bg-slate-800"
                      >
                        {typeof cell === 'object' ? JSON.stringify(cell) : String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* ─── SQL Results Dynamic Table Visualizer ──────────────────────────── */}
      {sqlResults && sqlResults.length > 0 && (
        <div className="flex flex-col gap-4">
          {sqlResults.map((sqlRes, sIdx) => (
            <div key={`sql-${sIdx}`} className="bg-slate-950/80 p-4 rounded-lg border border-slate-800 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-purple-400 flex items-center gap-2">
                  <Database className="w-4 h-4 text-purple-400" />
                  SQL Query Result Table #{sIdx + 1}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {sqlRes.values.length} {sqlRes.values.length === 1 ? 'row' : 'rows'}
                </span>
              </div>

              <div className="overflow-x-auto max-h-[300px]">
                <table className="w-full text-left border-collapse font-mono text-xs">
                  <thead>
                    <tr className="bg-purple-950/40 border-b border-purple-800/50 text-purple-200">
                      {sqlRes.columns.map((col, colIdx) => (
                        <th key={colIdx} className="px-3 py-2 font-semibold">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sqlRes.values.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="border-b border-slate-800/60 hover:bg-purple-950/20 transition-colors"
                      >
                        {row.map((val, cIdx) => (
                          <td key={cIdx} className="px-3 py-2 text-slate-300">
                            {val === null ? <span className="text-slate-600 italic">null</span> : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
