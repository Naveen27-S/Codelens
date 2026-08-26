import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Play, Pause, RotateCcw, ChevronLeft, ChevronRight,
  Maximize2, Minimize2,
} from 'lucide-react';
import { DemoStep0Welcome } from './DemoStep0Welcome';
import { DemoStep1Typing } from './DemoStep1Typing';
import { DemoStep2Analysis } from './DemoStep2Analysis';
import { DemoStep3Execution } from './DemoStep3Execution';
import { DemoStep4Summary } from './DemoStep4Summary';

interface DemoModalProps {
  onClose: () => void;
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

export function DemoModal({ onClose }: DemoModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stepKey, setStepKey] = useState(0); // force re-mount on replay
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goToStep = useCallback((step: number) => {
    if (step < 0 || step >= STEPS.length) return;
    setCurrentStep(step);
    setStepKey(k => k + 1);
  }, []);

  // Auto-advance
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
    return () => { if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current); };
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
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === ' ') { e.preventDefault(); setIsPlaying(p => !p); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentStep]);

  const stepTitles = [
    'Welcome', 'Step 1 — AI Typing', 'Step 2 — AI Analysis',
    'Step 3 — Execution Visualization', 'Step 4 — Results',
  ];

  return (
    <AnimatePresence>
      <motion.div
        key="demo-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 30 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative w-full max-w-6xl bg-slate-900 border border-slate-700/60 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
          style={{ height: 'min(90vh, 720px)' }}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-3 bg-slate-950/90 border-b border-slate-800 shrink-0 backdrop-blur-xl">
            {/* Left: step label */}
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${STEP_COLORS[currentStep]} animate-pulse`} />
              <AnimatePresence mode="wait">
                <motion.span
                  key={currentStep}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm font-semibold text-white"
                >
                  {stepTitles[currentStep]}
                </motion.span>
              </AnimatePresence>
              <span className="text-xs text-slate-600 hidden sm:inline">
                ({currentStep + 1}/{STEPS.length})
              </span>
            </div>

            {/* Center: step pills */}
            <div className="hidden md:flex items-center gap-1.5">
              {STEPS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => goToStep(s.id)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    s.id === currentStep
                      ? `w-8 bg-gradient-to-r ${STEP_COLORS[s.id]}`
                      : s.id < currentStep
                      ? 'w-4 bg-slate-500'
                      : 'w-4 bg-slate-700'
                  }`}
                  title={s.label}
                />
              ))}
            </div>

            {/* Right: controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Toggle fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Close demo (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Step content */}
          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={`step-${currentStep}-${stepKey}`}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.35, ease: 'easeInOut' }}
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

          {/* Bottom controls bar */}
          <div className="shrink-0 px-5 py-3 bg-slate-950/80 border-t border-slate-800 backdrop-blur-xl">
            {/* Progress bar */}
            <div className="flex gap-1 mb-3">
              {STEPS.map((s) => (
                <div key={s.id} className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full bg-gradient-to-r ${STEP_COLORS[s.id]}`}
                    initial={{ width: '0%' }}
                    animate={{
                      width: s.id < currentStep ? '100%' : s.id === currentStep ? (s.duration === Infinity ? '100%' : '100%') : '0%',
                    }}
                    transition={{
                      duration: s.id === currentStep && s.duration !== Infinity && isPlaying
                        ? s.duration / 1000
                        : 0.4,
                      ease: 'linear',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Playback buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReplay}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  title="Replay from start"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={handlePrev}
                  disabled={currentStep === 0}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Previous step (←)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsPlaying(p => !p)}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors text-sm font-medium"
                  title="Play / Pause (Space)"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span className="hidden sm:inline">{isPlaying ? 'Pause' : 'Play'}</span>
                </button>
                <button
                  onClick={handleNext}
                  disabled={currentStep === STEPS.length - 1}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Next step (→)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="hidden sm:inline">Keyboard: ←/→ navigate · Space pause · Esc close</span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
