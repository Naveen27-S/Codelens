/**
 * src/components/visualizer/VariableInspector.tsx
 *
 * Scope Variable Inspector & Call Stack Frame Timeline Component.
 */

import React from 'react';
import type { ExecutionStep } from '../../types/execution';
import { Variable, Layers, Code } from 'lucide-react';

interface Props {
  currentStep?: ExecutionStep;
}

export const VariableInspector: React.FC<Props> = ({ currentStep }) => {
  const variables = currentStep?.variables || {};
  const callStack = currentStep?.callStack || [];
  const varEntries = Object.entries(variables);

  return (
    <div className="flex flex-col gap-4 p-4 bg-slate-900 rounded-xl border border-slate-800 overflow-y-auto max-h-[500px]">
      {/* ─── Call Stack Panel ────────────────────────────────────────────── */}
      <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 shadow-sm">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          Call Stack Frames
        </h4>
        {callStack.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No active stack frames</p>
        ) : (
          <div className="flex flex-col gap-1">
            {callStack.map((frame, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900 rounded border border-slate-800/80 text-xs font-mono"
              >
                <span className="text-cyan-300 font-medium flex items-center gap-1.5">
                  <Code className="w-3 h-3 text-cyan-400" />
                  {frame.functionName}()
                </span>
                <span className="text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded text-[10px]">
                  Line {frame.line}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Variable Inspector Panel ────────────────────────────────────── */}
      <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 shadow-sm">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
          <Variable className="w-3.5 h-3.5 text-emerald-400" />
          Scope Variables ({varEntries.length})
        </h4>

        {varEntries.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No local or global variables in current scope</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60">
                  <th className="py-1.5 px-2">Variable</th>
                  <th className="py-1.5 px-2">Type</th>
                  <th className="py-1.5 px-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {varEntries.map(([name, item]) => (
                  <tr key={name} className="border-b border-slate-800/40 hover:bg-slate-900/40">
                    <td className="py-1.5 px-2 font-semibold text-emerald-300">{name}</td>
                    <td className="py-1.5 px-2 text-slate-400 text-[11px]">{item.type}</td>
                    <td className="py-1.5 px-2 text-amber-200 break-all max-w-[200px]">
                      {item.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
