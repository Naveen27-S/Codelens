/**
 * src/components/visualizer/VideoFlowVisualizer.tsx
 *
 * Interactive Video Visualizer Stage for Editor Page.
 * Directly modeled after the Homepage Demo Video (DemoStep3Execution):
 * - Synchronized data flow: Collections -> Condition/Operation -> Mutated Variables -> Output
 * - Clear logic and conditional evaluation badges (TRUE / FALSE / Branch Taken)
 * - Loop progress indicator and active index pointers
 * - AI Tutor live commentary with speech narration
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDown,
  BrainCircuit,
  CheckCircle2,
  GitBranch,
  Layers,
  Sparkles,
  Terminal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { ExecutionStep, SqlQueryResult } from '../../types/execution';

interface Props {
  currentStep?: ExecutionStep;
  totalSteps: number;
  currentStepIndex: number;
  sourceCode?: string;
  language?: string;
  sqlResults?: SqlQueryResult[];
  currentSubtitle?: string;
  isPlaying?: boolean;
  isMuted?: boolean;
  speed?: number;
  onToggleMute?: () => void;
  onReplayAudio?: () => void;
}

export const VideoFlowVisualizer: React.FC<Props> = ({
  currentStep,
  totalSteps,
  currentStepIndex,
  sourceCode = '',
  sqlResults,
  currentSubtitle = '',
  isPlaying = false,
  isMuted = false,
  speed = 500,
  onToggleMute,
  onReplayAudio,
}) => {
  // Extract line text from source code
  const currentLineText = useMemo(() => {
    if (!sourceCode || !currentStep || currentStep.line <= 0) return '';
    const lines = sourceCode.split('\n');
    return lines[currentStep.line - 1]?.trim() || '';
  }, [sourceCode, currentStep]);

  // Analyze if current line is a conditional or loop statement
  const conditionAnalysis = useMemo(() => {
    if (!currentLineText) return null;
    const clean = currentLineText.replace(/#.*$/, '').replace(/\/\/.*$/, '').trim();

    // IF statement
    if (/^if\b/i.test(clean)) {
      const expr = clean.replace(/^if\s*/i, '').replace(/:\s*$/, '').replace(/\{?\s*$/, '');
      return {
        type: 'IF',
        expression: expr,
        label: 'Condition Check',
        isCondition: true,
      };
    }
    // ELIF / ELSE IF
    if (/^(elif|else\s+if)\b/i.test(clean)) {
      const expr = clean.replace(/^(elif|else\s+if)\s*/i, '').replace(/:\s*$/, '').replace(/\{?\s*$/, '');
      return {
        type: 'ELIF',
        expression: expr,
        label: 'Alternative Condition Check',
        isCondition: true,
      };
    }
    // ELSE
    if (/^else\b/i.test(clean)) {
      return {
        type: 'ELSE',
        expression: 'All prior conditions were False',
        label: 'Fallback Branch',
        isCondition: true,
      };
    }
    // FOR loop
    if (/^for\b/i.test(clean)) {
      const expr = clean.replace(/^for\s*/i, '').replace(/:\s*$/, '').replace(/\{?\s*$/, '');
      return {
        type: 'FOR',
        expression: expr,
        label: 'Loop Header',
        isLoop: true,
      };
    }
    // WHILE loop
    if (/^while\b/i.test(clean)) {
      const expr = clean.replace(/^while\s*/i, '').replace(/:\s*$/, '').replace(/\{?\s*$/, '');
      return {
        type: 'WHILE',
        expression: expr,
        label: 'While Loop Condition',
        isLoop: true,
      };
    }
    return null;
  }, [currentLineText]);

  // Extract 1D arrays and 2D matrices from current step
  const arrays1D = currentStep?.dataStructures?.arrays1D || [];
  const matrices2D = currentStep?.dataStructures?.matrices2D || [];

  // Extract active scope variables (excluding internal private ones)
  const scopeVars = useMemo(() => {
    if (!currentStep?.variables) return [];
    return Object.entries(currentStep.variables)
      .filter(([k, v]) => {
        const s = String(v?.value ?? '');
        return (
          !s.includes('<function') &&
          !s.includes('<module') &&
          !s.includes('<class') &&
          !s.includes('at 0x') &&
          !k.startsWith('_')
        );
      })
      .map(([name, val]) => ({
        name,
        value: val.value,
        type: val.type,
        isChanged: val.isChanged,
        previousValue: val.previousValue,
      }));
  }, [currentStep]);

  // ─── 1. Awaiting Execution State (When no steps have run yet) ─────────────────
  if (totalSteps === 0 || !currentStep) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none relative overflow-hidden">
        {/* Background glow orb */}
        <div className="w-64 h-64 rounded-full bg-purple-600/10 blur-[90px] absolute pointer-events-none" />

        <div className="relative z-10 max-w-sm flex flex-col items-center">
          <motion.div
            animate={{ scale: [1, 1.08, 1], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600/30 to-indigo-600/30 border border-purple-500/40 flex items-center justify-center mb-4 shadow-xl shadow-purple-600/20"
          >
            <Sparkles className="w-8 h-8 text-purple-400" />
          </motion.div>

          <h3 className="text-base font-bold text-slate-100 mb-1.5 tracking-tight">
            Video Execution Visualizer
          </h3>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Click <strong className="text-emerald-400 font-semibold">Run Code</strong> or{' '}
            <strong className="text-purple-400 font-semibold">Debug</strong> in the top toolbar to watch your code execute step-by-step with real-time logic and variable animations.
          </p>

          {/* Interactive Feature Highlights */}
          <div className="w-full grid grid-cols-2 gap-2 text-left text-[11px] font-mono">
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <span className="text-slate-300">Live Memory Flow</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-slate-300">Condition Tracking</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-slate-300">Loop Iterations</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="text-slate-300">AI Tutor Narration</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active loop info or active variable index
  const activeIndex = currentStep.activeVariable?.index ?? currentStep.loopInfo?.activeIndex;
  const iterationNum = currentStep.loopInfo?.iteration ?? currentStep.activeVariable?.iteration;

  return (
    <div className="h-full flex flex-col overflow-y-auto p-4 gap-4 select-none">
      {/* ─── 1. TOP PIPELINE STATUS BAR ─────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-mono shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
            Line {currentStep.line}
          </span>
          <span className="px-2 py-0.5 rounded bg-purple-950/90 border border-purple-700/60 text-purple-300 text-[11px] font-bold">
            {currentStep.operationType || 'EXECUTE'}
          </span>
          {iterationNum !== undefined && (
            <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-700/60 text-amber-300 text-[11px] font-medium flex items-center gap-1">
              <span>Iter #{iterationNum}</span>
              {currentStep.loopInfo?.totalIterations && (
                <span className="text-amber-400/80">/ {currentStep.loopInfo.totalIterations}</span>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 font-mono">
            Step {currentStepIndex}/{totalSteps}
          </span>
          <span
            className={`w-2 h-2 rounded-full ${
              isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
            }`}
          />
        </div>
      </div>

      {/* ─── 2. ACTIVE CODE STATEMENT PREVIEW ────────────────────────────────── */}
      {currentLineText && (
        <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-xs flex items-center gap-3 shrink-0">
          <span className="text-purple-400 font-bold select-none">▶</span>
          <span className="text-slate-200 truncate flex-1">{currentLineText}</span>
          {conditionAnalysis && (
            <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/50">
              {conditionAnalysis.type}
            </span>
          )}
        </div>
      )}

      {/* ─── 3. CENTER FLOW VISUALIZATION STAGE ─────────────────────────────── */}
      <div className="flex flex-col items-center justify-center gap-3 py-2 flex-1 min-h-0">
        {/* A. 1D Array Visualizer (if active array exists) */}
        {arrays1D.length > 0 && (
          <div className="w-full flex flex-col items-center gap-1.5">
            {arrays1D.map((arr, aIdx) => (
              <div key={aIdx} className="w-full flex flex-col items-center">
                <div className="flex items-center gap-2 mb-1 text-[11px] font-mono text-slate-400">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-purple-300 font-bold">{arr.name}</span>
                  <span className="text-slate-500">[{arr.values.length} items]</span>
                </div>

                <div className="flex gap-2 flex-wrap justify-center max-w-full overflow-x-auto py-1.5 px-2">
                  {arr.values.map((val, idx) => {
                    const isSelected = activeIndex === idx || arr.highlightIndices?.includes(idx);
                    return (
                      <motion.div
                        key={idx}
                        animate={{
                          scale: isSelected ? 1.18 : 1,
                          backgroundColor: isSelected
                            ? 'rgba(147, 51, 234, 0.35)'
                            : 'rgba(15, 23, 42, 0.9)',
                          borderColor: isSelected
                            ? 'rgb(168, 85, 247)'
                            : 'rgb(51, 65, 85)',
                        }}
                        transition={{ duration: 0.25 }}
                        className={`min-w-[44px] h-[48px] px-2 flex flex-col items-center justify-center rounded-xl border font-mono shadow-md ${
                          isSelected
                            ? 'shadow-purple-600/30 ring-2 ring-purple-500/40 text-white'
                            : 'text-slate-300'
                        }`}
                      >
                        <span className="text-[9px] text-slate-500">[{idx}]</span>
                        <span className="text-xs font-bold truncate max-w-[60px]">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}

            <ArrowDown className="w-4 h-4 text-slate-600 my-0.5 animate-bounce" />
          </div>
        )}

        {/* 2D Matrix Visualizer (if active matrix exists) */}
        {matrices2D.length > 0 && (
          <div className="w-full flex flex-col items-center gap-1.5">
            {matrices2D.map((mat, mIdx) => (
              <div key={mIdx} className="w-full flex flex-col items-center">
                <div className="text-[11px] font-mono text-emerald-400 font-semibold mb-1">
                  Matrix: {mat.name} [{mat.grid.length}×{mat.grid[0]?.length || 0}]
                </div>
                <div className="overflow-x-auto max-w-full">
                  <table className="border-collapse">
                    <tbody>
                      {mat.grid.map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="w-9 h-9 border border-slate-700 text-center font-mono text-xs bg-slate-900 text-emerald-300 font-semibold p-1"
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
            <ArrowDown className="w-4 h-4 text-slate-600 my-0.5" />
          </div>
        )}

        {/* SQL Tabular Results (if any) */}
        {sqlResults && sqlResults.length > 0 && (
          <div className="w-full flex flex-col items-center gap-1.5 my-1">
            {sqlResults.map((sqlRes, sIdx) => (
              <div key={sIdx} className="w-full flex flex-col items-center">
                <div className="text-[11px] font-mono text-purple-400 font-semibold mb-1">
                  SQL Result #{sIdx + 1} ({sqlRes.values.length} rows)
                </div>
                <div className="overflow-x-auto max-w-full">
                  <table className="border-collapse text-xs font-mono">
                    <thead>
                      <tr className="bg-purple-950/40 border-b border-purple-800 text-purple-200">
                        {sqlRes.columns.map((c, ci) => (
                          <th key={ci} className="px-2 py-1">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sqlRes.values.map((row, ri) => (
                        <tr key={ri} className="border-b border-slate-800 text-slate-300">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-2 py-1">{String(cell)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            <ArrowDown className="w-4 h-4 text-slate-600 my-0.5" />
          </div>
        )}

        {/* B. Condition & Branch Logic Evaluator Badge */}
        {conditionAnalysis && (
          <div className="w-full max-w-md flex flex-col items-center gap-1">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-indigo-500/40 shadow-lg shadow-indigo-950 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-indigo-400" />
                <div>
                  <div className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">
                    {conditionAnalysis.label}
                  </div>
                  <div className="text-xs font-mono text-white font-semibold">
                    {conditionAnalysis.expression}
                  </div>
                </div>
              </div>

              {/* Status flag */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-600/50 text-emerald-300 text-[11px] font-bold font-mono">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>TRUE (Branch Taken)</span>
              </div>
            </motion.div>

            <ArrowDown className="w-4 h-4 text-slate-600 my-0.5" />
          </div>
        )}

        {/* C. Variable Memory Pods (Active variable & Accumulator) */}
        <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-md">
          {/* Active Variable (Current item in loop or current target) */}
          {currentStep.activeVariable && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-purple-400 font-mono font-bold uppercase tracking-wider">
                {currentStep.activeVariable.name}
              </span>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`act-${currentStep.activeVariable.value}-${currentStepIndex}`}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="min-w-[80px] h-[48px] px-3 flex items-center justify-center bg-purple-950/60 border border-purple-600/70 rounded-xl font-mono text-sm font-bold text-purple-200 shadow-md shadow-purple-950"
                >
                  {String(currentStep.activeVariable.value)}
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* Accumulator / Math Result Pod */}
          {currentStep.accumulatorVariable && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-emerald-400 font-mono font-bold uppercase tracking-wider">
                {currentStep.accumulatorVariable.name}
              </span>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`acc-${currentStep.accumulatorVariable.newValue}-${currentStepIndex}`}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="min-w-[80px] h-[48px] px-3 flex items-center justify-center bg-emerald-950/60 border border-emerald-500/70 rounded-xl font-mono text-sm font-bold text-emerald-200 shadow-md shadow-emerald-950"
                >
                  {String(currentStep.accumulatorVariable.newValue)}
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* General scope variables when no dedicated accumulator is present */}
          {!currentStep.activeVariable &&
            !currentStep.accumulatorVariable &&
            scopeVars.slice(0, 4).map((v) => (
              <div key={v.name} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-slate-400 font-mono font-medium">
                  {v.name}
                </span>
                <div
                  className={`min-w-[70px] h-[44px] px-3 flex items-center justify-center rounded-xl font-mono text-xs font-bold border ${
                    v.isChanged
                      ? 'bg-cyan-950/60 border-cyan-500/70 text-cyan-200 shadow-sm shadow-cyan-950'
                      : 'bg-slate-900 border-slate-800 text-slate-200'
                  }`}
                >
                  {String(v.value)}
                </div>
              </div>
            ))}
        </div>

        {/* D. Math Equation / Assignment Expression Breakdown */}
        {currentStep.accumulatorVariable?.expression && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-emerald-300 font-semibold"
          >
            {currentStep.accumulatorVariable.name} = {currentStep.accumulatorVariable.expression}
          </motion.div>
        )}

        {/* E. Standard Output Produced */}
        {currentStep.stdout && (
          <div className="w-full max-w-md mt-1 flex flex-col items-center">
            <ArrowDown className="w-4 h-4 text-slate-600 mb-1" />
            <div className="w-full px-4 py-2 rounded-xl bg-emerald-950/50 border border-emerald-600/60 flex items-center justify-between text-xs font-mono">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5" /> Output
              </span>
              <span className="text-emerald-200 font-bold">{currentStep.stdout.trim()}</span>
            </div>
          </div>
        )}
      </div>

      {/* ─── 4. AI TUTOR COMMENTARY SUBTITLE CARD ──────────────────────────── */}
      {currentSubtitle && (
        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs shrink-0 flex items-start justify-between gap-3 shadow-lg">
          <div className="flex items-start gap-2.5 flex-1">
            <div className="w-7 h-7 rounded-lg bg-indigo-950/90 border border-indigo-700/60 flex items-center justify-center shrink-0 mt-0.5 text-indigo-300">
              <BrainCircuit className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold tracking-wider uppercase text-indigo-300">
                  AI Tutor Live Commentary
                </span>
                {isPlaying && !isMuted && (
                  <span className="text-[9px] text-emerald-400 font-mono animate-pulse flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Speaking
                  </span>
                )}
              </div>
              <p className="font-mono text-[11px] text-slate-200 leading-relaxed">
                {currentSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onToggleMute && (
              <button
                onClick={onToggleMute}
                className="p-1.5 rounded-lg hover:bg-slate-800 border border-slate-700/80 text-slate-400 hover:text-white transition cursor-pointer"
                title={isMuted ? 'Unmute Voice Narration' : 'Mute Voice Narration'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-indigo-400" />}
              </button>
            )}
            {onReplayAudio && (
              <button
                onClick={onReplayAudio}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-indigo-900/40 border border-slate-700 text-indigo-300 hover:text-white text-[10px] transition cursor-pointer"
                title={`Replay Voice Audio (${speed}ms delay)`}
              >
                Replay Audio
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
