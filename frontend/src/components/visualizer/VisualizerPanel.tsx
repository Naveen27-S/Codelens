/**
 * src/components/visualizer/VisualizerPanel.tsx
 *
 * Main Right Panel hosting Data Structure Visualizer, Variable Inspector,
 * Call Stack, Mermaid Flowchart, and Playback Controls.
 */

import React, { useState, useEffect } from 'react';
import type { ExecutionResult } from '../../types/execution';
import { VideoFlowVisualizer } from './VideoFlowVisualizer';
import { VisualizerErrorBoundary } from './VisualizerErrorBoundary';
import { VariableInspector } from './VariableInspector';
import { PlaybackControls } from './PlaybackControls';
import { MermaidViewer } from '../MermaidViewer';
import { Variable, Network, Activity, Play, AlertTriangle, Sparkles, ArrowRight } from 'lucide-react';
import { voiceNarrator } from '../../services/voiceNarrator';
import { getStepExplanation, getCodeOverviewExplanation } from '../../utils/stepExplainer';
import { useSettings } from '../../context/SettingsContext';

interface Props {
  executionResult?: ExecutionResult | null;
  mermaidChart?: string;
  onCurrentLineChange?: (line: number | null) => void;
  language?: string;
  code?: string;
  errorExplanation?: {
    problem: string;
    explanation: string;
    solution: string;
    corrected_code?: string;
    suggestedFix?: string;
    lineNumber?: number | null;
    offendingLine?: string;
  } | null;
  onApplyFix?: (rerun?: boolean) => void;
}

export const VisualizerPanel: React.FC<Props> = ({
  executionResult,
  mermaidChart = '',
  onCurrentLineChange,
  language = 'python',
  code = '',
  errorExplanation,
  onApplyFix,
}) => {
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<'structures' | 'variables' | 'flowchart'>('structures');
  const [currentStepIndex, setCurrentStepIndex] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = React.useRef(false);
  const [speed, setSpeed] = useState(500);
  const [isMuted, setIsMuted] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState('');

  const steps = executionResult?.steps || [];
  const totalSteps = steps.length;
  const currentStep = steps[currentStepIndex - 1];

  const getExplanationForStep = (stepObj?: (typeof steps)[0], total?: number) => {
    if (!settings.aiTutorEnabled) {
      return stepObj ? `Step ${stepObj.stepIndex} of ${total || totalSteps} (AI Tutor paused)` : '';
    }
    return getStepExplanation(stepObj, total || totalSteps, code, settings.explanationLevel);
  };

  // Keep isPlayingRef in sync with isPlaying state
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (!isPlaying) {
      voiceNarrator.stop();
    }
  }, [isPlaying]);

  // Initialize subtitle and line highlighting when steps change
  useEffect(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    voiceNarrator.stop();

    if (steps.length > 0) {
      setCurrentStepIndex(1);
      const step = steps[0];
      if (onCurrentLineChange) {
        onCurrentLineChange(step.line);
      }
      const overview = getCodeOverviewExplanation(language, steps.length, code);
      setCurrentSubtitle(overview);
    } else {
      setCurrentSubtitle('');
      if (onCurrentLineChange) {
        onCurrentLineChange(null);
      }
    }
  }, [executionResult]);

  const handleStepChange = (idx: number, speakAudio: boolean = true) => {
    setCurrentStepIndex(idx);
    const step = steps[idx - 1];
    if (step) {
      if (onCurrentLineChange) {
        onCurrentLineChange(step.line);
      }
      const explanation = getExplanationForStep(step, totalSteps);
      setCurrentSubtitle(explanation);
      if (speakAudio && !isMuted && settings.aiTutorEnabled) {
        voiceNarrator.speak(explanation, speed);
      }
    }
  };

  const handlePlayPause = () => {
    if (!isPlaying) {
      isPlayingRef.current = true;
      if (currentStepIndex >= totalSteps) {
        setCurrentStepIndex(1);
      }
      setIsPlaying(true);
    } else {
      isPlayingRef.current = false;
      setIsPlaying(false);
      voiceNarrator.stop();
    }
  };

  const handleStop = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    voiceNarrator.stop();
    setCurrentStepIndex(1);
    const step1 = steps[0];
    if (step1) {
      if (onCurrentLineChange) onCurrentLineChange(step1.line);
      const explanation = getExplanationForStep(step1, totalSteps);
      setCurrentSubtitle(explanation);
    } else {
      if (onCurrentLineChange) onCurrentLineChange(null);
      setCurrentSubtitle('');
    }
  };

  const handleForward = () => {
    if (currentStepIndex >= totalSteps) return;
    isPlayingRef.current = false;
    setIsPlaying(false);
    voiceNarrator.stop();
    const nextIdx = currentStepIndex + 1;
    setCurrentStepIndex(nextIdx);
    const step = steps[nextIdx - 1];
    if (step) {
      if (onCurrentLineChange) onCurrentLineChange(step.line);
      const explanation = getExplanationForStep(step, totalSteps);
      setCurrentSubtitle(explanation);
      if (!isMuted && settings.aiTutorEnabled) {
        voiceNarrator.speak(explanation, speed);
      }
    }
  };

  const handleBackward = () => {
    if (currentStepIndex <= 1) return;
    isPlayingRef.current = false;
    setIsPlaying(false);
    voiceNarrator.stop();
    const prevIdx = currentStepIndex - 1;
    setCurrentStepIndex(prevIdx);
    const step = steps[prevIdx - 1];
    if (step) {
      if (onCurrentLineChange) onCurrentLineChange(step.line);
      const explanation = getExplanationForStep(step, totalSteps);
      setCurrentSubtitle(explanation);
      if (!isMuted && settings.aiTutorEnabled) {
        voiceNarrator.speak(explanation, speed);
      }
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    voiceNarrator.setMuted(nextMuted);
    if (nextMuted) {
      voiceNarrator.stop();
    }
  };

  // Playback timer & voice-driven sequence loop
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (isPlaying && totalSteps > 0) {
      if (currentStepIndex > totalSteps) {
        isPlayingRef.current = false;
        setIsPlaying(false);
        voiceNarrator.stop();
        return;
      }

      const step = steps[currentStepIndex - 1];
      if (step) {
        if (onCurrentLineChange) {
          onCurrentLineChange(step.line);
        }
        const explanation = getExplanationForStep(step, totalSteps);
        setCurrentSubtitle(explanation);

        if (!isMuted && settings.aiTutorEnabled) {
          // Voice-driven: Wait for full audio narration to complete before stepping forward
          voiceNarrator.speak(explanation, speed, () => {
            if (!isPlayingRef.current) return;
            if (currentStepIndex >= totalSteps) {
              isPlayingRef.current = false;
              setIsPlaying(false);
              voiceNarrator.stop();
            } else {
              timer = setTimeout(() => {
                if (!isPlayingRef.current) return;
                setCurrentStepIndex((prev) => prev + 1);
              }, 250);
            }
          });
        } else {
          // Timer-driven (Voice OFF or AI Tutor OFF): advance step based on speed selector
          if (currentStepIndex >= totalSteps) {
            isPlayingRef.current = false;
            setIsPlaying(false);
          } else {
            timer = setTimeout(() => {
              if (!isPlayingRef.current) return;
              setCurrentStepIndex((prev) => prev + 1);
            }, speed);
          }
        }
      }
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isPlaying, currentStepIndex, totalSteps, steps, isMuted, speed, code, onCurrentLineChange]);

  const [isLogOpen, setIsLogOpen] = useState(false);

  // Derive execution log entries up to the current step
  const executionLog = React.useMemo(() => {
    return steps.slice(0, currentStepIndex).map((s) => s.logEntry).filter(Boolean);
  }, [steps, currentStepIndex]);

  const isCompleted = totalSteps > 0 && currentStepIndex >= totalSteps;

  const handleReplay = () => {
    handleStop();
    setTimeout(() => {
      handlePlayPause();
    }, 100);
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* ─── Header & Navigation Tabs ──────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/90 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Execution Visualizer
          </span>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('structures')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition cursor-pointer ${
              activeTab === 'structures'
                ? 'bg-purple-600 text-white font-medium shadow-sm shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Play className="w-3 h-3 fill-current" /> Video Visualizer
          </button>

          <button
            onClick={() => setActiveTab('variables')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition cursor-pointer ${
              activeTab === 'variables'
                ? 'bg-purple-600 text-white font-medium shadow-sm shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Variable className="w-3.5 h-3.5" /> Variables &amp; Stack
          </button>

          <button
            onClick={() => setActiveTab('flowchart')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition cursor-pointer ${
              activeTab === 'flowchart'
                ? 'bg-purple-600 text-white font-medium shadow-sm shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Network className="w-3.5 h-3.5" /> Flowchart
          </button>
        </div>
      </div>

      {/* ─── Active View Body ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
        {/* ── Video Execution Visualizer Viewport ─── */}
        {activeTab === 'structures' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ minHeight: 0 }}>
            {/* Main Video Flow Visualizer Stage */}
            <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
              {executionResult && executionResult.status !== 'success' && errorExplanation ? (
                <div className="h-full flex flex-col items-center justify-center p-6 select-none relative overflow-y-auto">
                  {/* Background glow orb */}
                  <div className="w-64 h-64 rounded-full bg-rose-600/10 blur-[90px] absolute pointer-events-none" />

                  <div className="relative z-10 max-w-sm w-full flex flex-col items-center text-left">
                    <div className="w-14 h-14 rounded-2xl bg-rose-950/90 border border-rose-500/40 flex items-center justify-center mb-3 shadow-xl shadow-rose-950/60">
                      <AlertTriangle className="w-7 h-7 text-rose-400" />
                    </div>

                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-2 py-0.5 rounded-full bg-rose-950 border border-rose-700/60 text-rose-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-rose-400" /> AI Debugger
                      </span>
                      {errorExplanation.lineNumber && (
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300 font-mono text-[10px] font-bold">
                          Line {errorExplanation.lineNumber}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-slate-100 mb-1.5 text-center leading-snug">
                      {errorExplanation.problem}
                    </h3>

                    <p className="text-xs text-slate-300 mb-3.5 leading-relaxed font-sans bg-slate-900/90 p-3 rounded-xl border border-slate-800 w-full text-center">
                      {errorExplanation.explanation}
                    </p>

                    {/* Diff Preview */}
                    <div className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 mb-3.5 font-mono text-xs space-y-2">
                      {errorExplanation.offendingLine && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-rose-400 block mb-0.5">
                            ❌ Mistake (Line {errorExplanation.lineNumber || '?'}):
                          </span>
                          <div className="p-2 rounded bg-rose-950/40 border border-rose-900/50 text-rose-200 overflow-x-auto truncate">
                            <code>{errorExplanation.offendingLine.trim()}</code>
                          </div>
                        </div>
                      )}

                      {(errorExplanation.suggestedFix || errorExplanation.corrected_code) && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">
                            ✅ Suggested Fix:
                          </span>
                          <div className="p-2 rounded bg-emerald-950/40 border border-emerald-900/50 text-emerald-200 overflow-x-auto truncate">
                            <code>{(errorExplanation.suggestedFix || errorExplanation.corrected_code)?.trim()}</code>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Apply Fix Button */}
                    {onApplyFix && (
                      <button
                        onClick={() => onApplyFix(true)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-900/40 transition-all cursor-pointer group"
                      >
                        <Sparkles className="w-4 h-4 text-emerald-200 group-hover:rotate-12 transition-transform" />
                        <span>Apply AI Fix &amp; Visualize</span>
                        <ArrowRight className="w-4 h-4 text-emerald-200 group-hover:translate-x-1 transition-transform" />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <VisualizerErrorBoundary>
                  <VideoFlowVisualizer
                    currentStep={currentStep}
                    totalSteps={totalSteps}
                    currentStepIndex={currentStepIndex}
                    sourceCode={code}
                    language={language}
                    sqlResults={executionResult?.sqlResults}
                    currentSubtitle={currentSubtitle}
                    isPlaying={isPlaying}
                    isMuted={isMuted}
                    speed={speed}
                    onToggleMute={handleToggleMute}
                    onReplayAudio={() => voiceNarrator.speak(currentSubtitle, speed)}
                  />
                </VisualizerErrorBoundary>
              )}

              {/* Execution Log Toggle Overlay Button */}
              {totalSteps > 0 && (
                <button
                  onClick={() => setIsLogOpen((prev) => !prev)}
                  className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-sans transition cursor-pointer backdrop-blur-md shadow-lg"
                  title="Toggle Execution Log"
                >
                  <span>Execution Log</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-purple-950 border border-purple-700/60 text-purple-300 text-[10px] font-mono">
                    {executionLog.length}
                  </span>
                </button>
              )}
            </div>

            {/* Collapsible Execution Log Drawer */}
            {isLogOpen && totalSteps > 0 && (
              <div className="h-44 max-h-44 overflow-y-auto bg-slate-950/95 border-t border-slate-800 p-2.5 text-xs font-mono shrink-0 transition-all">
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800 text-[11px] text-slate-400">
                  <span className="font-bold uppercase tracking-wider text-purple-300">
                    Execution Log ({executionLog.length} steps recorded)
                  </span>
                  <button
                    onClick={() => setIsLogOpen(false)}
                    className="text-slate-500 hover:text-slate-300 cursor-pointer text-[10px]"
                  >
                    Close ✕
                  </button>
                </div>
                <div className="space-y-1">
                  {executionLog.map((entry, idx) => {
                    if (!entry) return null;
                    const isCur = entry.step === currentStepIndex;
                    return (
                      <div
                        key={idx}
                        onClick={() => handleStepChange(entry.step, false)}
                        className={`flex items-start justify-between p-1.5 rounded cursor-pointer transition ${
                          isCur
                            ? 'bg-purple-950/80 border border-purple-600/70 text-purple-200'
                            : 'hover:bg-slate-900/80 text-slate-400 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 font-mono">#{entry.step}</span>
                          <span className="text-[10px] font-bold text-slate-300 uppercase">
                            {entry.operation}
                          </span>
                          <span className="text-slate-200">{entry.description}</span>
                        </div>
                        {entry.expression && (
                          <span className="text-[10px] text-emerald-400 font-semibold shrink-0 ml-2">
                            {entry.expression}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Final Results Summary Card (Shown upon completion) */}
            {isCompleted && (
              <div className="mx-2.5 my-2 p-3 rounded-xl bg-gradient-to-r from-purple-950/90 to-slate-900/90 border border-purple-700/60 shadow-xl shrink-0 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-500/60 flex items-center justify-center text-emerald-300 font-bold text-sm">
                    ✓
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-100">
                      Execution Complete!
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Output: <span className="text-emerald-400 font-bold">{executionResult?.stdout?.trim() || 'Done'}</span>
                      <span className="mx-2">•</span>
                      {totalSteps} steps in {executionResult?.executionTimeMs || 0}ms
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReplay}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition cursor-pointer"
                  >
                    Replay
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Variables & Stack ─── */}
        {activeTab === 'variables' && (
          <div className="h-full overflow-y-auto p-4">
            <VariableInspector currentStep={currentStep} />
          </div>
        )}

        {/* ── Flowchart ─── */}
        {activeTab === 'flowchart' && (
          <div className="w-full h-full min-h-[400px] overflow-auto p-2">
            <MermaidViewer chart={mermaidChart} />
          </div>
        )}
      </div>

      {/* ─── Bottom Playback Toolbar ────────────────────────────────────── */}
      {totalSteps > 0 && (
        <div className="shrink-0">
          <PlaybackControls
            currentStepIndex={currentStepIndex}
            totalSteps={totalSteps}
            isPlaying={isPlaying}
            speed={speed}
            isMuted={isMuted}
            onBackward={handleBackward}
            onPlayPauseToggle={handlePlayPause}
            onStop={handleStop}
            onForward={handleForward}
            onStepChange={handleStepChange}
            onSpeedChange={setSpeed}
            onToggleMute={handleToggleMute}
          />
        </div>
      )}
    </div>
  );
};
