import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Play, Pause, RotateCcw, ChevronLeft, ChevronRight,
  Maximize2, Minimize2, Sparkles,
} from 'lucide-react';
import { DemoStep0Welcome } from './DemoStep0Welcome';
import { DemoStep1Typing } from './DemoStep1Typing';
import { DemoStep2Analysis } from './DemoStep2Analysis';
import { DemoStep3Execution } from './DemoStep3Execution';
import { DemoStep4Summary } from './DemoStep4Summary';

export interface DemoPlayerProps {
  onClose?: () => void;
  isModal?: boolean;
  initialStep?: number;
}

const STEPS = [
  { id: 0, label: 'Welcome',      duration: 3500  },
  { id: 1, label: 'AI Typing',    duration: 10000 },
  { id: 2, label: 'AI Analysis',  duration: 6000  },
  { id: 3, label: 'Execution',    duration: 14000 },
  { id: 4, label: 'Summary',      duration: Infinity },
];

const STEP_COLORS = [
  'from-indigo-500 to-violet-500',
  'from-violet-500 to-purple-500',
  'from-purple-500 to-pink-500',
  'from-pink-500 to-rose-500',
  'from-emerald-500 to-teal-500',
];

const STEP_TITLES = [
  'Welcome',
  'Step 1 — AI Typing',
  'Step 2 — AI Analysis',
  'Step 3 — Execution Visualization',
  'Step 4 — Results & Summary',
];

export function DemoPlayer({ onClose, isModal = false, initialStep = 0 }: DemoPlayerProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stepKey, setStepKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goToStep = useCallback((step: number) => {
    if (step < 0 || step >= STEPS.length) return;
    setCurrentStep(step);
    setStepKey(k => k + 1);
  }, []);

  // Auto-advance between steps
  useEffect(() => {
    if (!isPlaying) return;
    const dur = STEPS[currentStep].duration;
    if (dur === Infinity) return;
    autoAdvanceRef.current = setTimeout(() => {
      setCurrentStep(s => {
        const next = s + 1;
        if (next < STEPS.length) {
          setStepKey(k => k + 1);
          return next;
        }
        return s;
      });
    }, dur);
    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, [currentStep, isPlaying, stepKey]);

  const handleReplay = () => {
    setCurrentStep(0);
    setIsPlaying(true);
    setStepKey(k => k + 1);
  };

  const handleNext = () => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    goToStep(currentStep + 1);
  };

  const handlePrev = () => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    goToStep(currentStep - 1);
  };

  const toggleFullscreen = () => {
    const target = containerRef.current || document.documentElement;
    if (!document.fullscreenElement) {
      target.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard navigation when active
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isModal && e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === ' ' && (isModal || document.activeElement === containerRef.current)) {
        e.preventDefault();
        setIsPlaying(p => !p);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentStep, isModal, onClose]);

  const playerCore = (
    <div
      ref={containerRef}
      tabIndex={0}
      className={`relative w-full bg-slate-950 border border-slate-700/60 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col focus:outline-none ${
        isFullscreen ? 'h-screen rounded-none' : 'h-[620px] md:h-[680px]'
      }`}
    >
      {/* ─── Top window bar ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-slate-900/90 border-b border-slate-800 shrink-0 backdrop-blur-xl select-none">
        {/* Left: Window dots & Step indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 mr-1">
            <button
              onClick={() => onClose?.()}
              disabled={!isModal}
              className={`w-3 h-3 rounded-full bg-red-500/80 ${isModal ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
              title={isModal ? 'Close' : undefined}
            />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <button
              onClick={toggleFullscreen}
              className="w-3 h-3 rounded-full bg-green-500/80 hover:opacity-80 cursor-pointer"
              title="Toggle Fullscreen"
            />
          </div>

          <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${STEP_COLORS[currentStep]} animate-pulse hidden sm:block`} />
          
          <AnimatePresence mode="wait">
            <motion.span
              key={currentStep}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="text-xs sm:text-sm font-semibold text-white truncate"
            >
              {STEP_TITLES[currentStep]}
            </motion.span>
          </AnimatePresence>

          <span className="text-[11px] text-slate-500 hidden md:inline font-mono">
            ({currentStep + 1}/{STEPS.length})
          </span>
        </div>

        {/* Center: Step Selector Navigation Pills */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((s) => {
            const isActive = s.id === currentStep;
            return (
              <button
                key={s.id}
                onClick={() => goToStep(s.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/50 shadow-sm'
                    : s.id < currentStep
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    : 'text-slate-600 hover:text-slate-400'
                }`}
                title={`Go to ${s.label}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    isActive ? 'bg-indigo-400 scale-125' : 'bg-slate-600'
                  }`}
                />
                <span className="hidden lg:inline">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Window Controls */}
        <div className="flex items-center gap-1.5">
          {!isModal && (
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[10px] font-semibold uppercase tracking-wider mr-1">
              <Sparkles className="w-3 h-3" /> Live Demo
            </div>
          )}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          {isModal && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Close demo (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ─── Active Step Stage ────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={`step-${currentStep}-${stepKey}`}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="absolute inset-0"
          >
            {currentStep === 0 && <DemoStep0Welcome />}
            {currentStep === 1 && (
              <DemoStep1Typing
                isPlaying={isPlaying}
                onComplete={() => {
                  if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
                  setTimeout(() => { setCurrentStep(2); setStepKey(k => k + 1); }, 1200);
                }}
              />
            )}
            {currentStep === 2 && <DemoStep2Analysis isPlaying={isPlaying} />}
            {currentStep === 3 && <DemoStep3Execution isPlaying={isPlaying} />}
            {currentStep === 4 && <DemoStep4Summary onReplay={handleReplay} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ─── Bottom Timeline & Controls Bar ───────────────────────── */}
      <div className="shrink-0 px-4 sm:px-5 py-2.5 bg-slate-950/90 border-t border-slate-800 backdrop-blur-xl select-none">
        {/* Multi-segment step progress bar */}
        <div className="flex gap-1.5 mb-2.5">
          {STEPS.map((s) => (
            <div
              key={s.id}
              onClick={() => goToStep(s.id)}
              className="flex-1 h-1.5 bg-slate-800 hover:bg-slate-700 rounded-full overflow-hidden cursor-pointer transition-colors"
              title={`Click to jump to ${s.label}`}
            >
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${STEP_COLORS[s.id]}`}
                initial={{ width: '0%' }}
                animate={{
                  width:
                    s.id < currentStep
                      ? '100%'
                      : s.id === currentStep
                      ? '100%'
                      : '0%',
                }}
                transition={{
                  duration:
                    s.id === currentStep && s.duration !== Infinity && isPlaying
                      ? s.duration / 1000
                      : 0.3,
                  ease: 'linear',
                }}
              />
            </div>
          ))}
        </div>

        {/* Playback action controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleReplay}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Replay from start"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Previous step (←)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsPlaying(p => !p)}
              className="flex items-center gap-1.5 px-3.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors text-xs font-semibold cursor-pointer shadow-md shadow-indigo-600/30"
              title="Play / Pause (Space)"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>
            <button
              onClick={handleNext}
              disabled={currentStep === STEPS.length - 1}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Next step (→)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="hidden md:inline font-mono text-[11px]">
              Step <strong className="text-slate-300">{currentStep + 1}</strong> of {STEPS.length}
            </span>
            <span className="hidden sm:inline text-slate-600">•</span>
            <span className="hidden sm:inline text-slate-500 text-[11px]">
              Click any step pill above or use ←/→ keys
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <AnimatePresence>
        <motion.div
          key="demo-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={(e) => e.target === e.currentTarget && onClose?.()}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 25 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 25 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full max-w-6xl"
          >
            {playerCore}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return playerCore;
}
