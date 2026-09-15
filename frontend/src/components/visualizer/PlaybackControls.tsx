/**
 * src/components/visualizer/PlaybackControls.tsx
 *
 * CodeLens AI Voice Playback Controls.
 * Features:
 * - Segmented execution timeline with discrete clickable steps
 * - Play / Pause / Stop / Backward / Forward
 * - Voice narration speed (0.5x, 1.0x, 2.0x) and Mute toggle
 * - Step scrubber with live synchronized captions
 */

import React, { useMemo } from 'react';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface Props {
  currentStepIndex: number;
  totalSteps: number;
  isPlaying: boolean;
  speed: number;
  isMuted: boolean;
  onBackward: () => void;
  onPlayPauseToggle: () => void;
  onStop: () => void;
  onForward: () => void;
  onStepChange: (index: number) => void;
  onSpeedChange: (speed: number) => void;
  onToggleMute: () => void;
}

export const PlaybackControls: React.FC<Props> = ({
  currentStepIndex,
  totalSteps,
  isPlaying,
  speed,
  isMuted,
  onBackward,
  onPlayPauseToggle,
  onStop,
  onForward,
  onStepChange,
  onSpeedChange,
  onToggleMute,
}) => {
  // Generate segments for the segmented timeline (up to 40 visible segments or dense bar)
  const segments = useMemo(() => {
    if (totalSteps <= 0) return [];
    const count = Math.min(totalSteps, 40);
    return Array.from({ length: count }, (_, i) => {
      const stepForSegment = Math.round(((i + 1) / count) * totalSteps);
      const isPassed = stepForSegment <= currentStepIndex;
      const isCurrent = Math.abs(stepForSegment - currentStepIndex) <= Math.ceil(totalSteps / count / 2);
      return {
        idx: i,
        targetStep: stepForSegment,
        isPassed,
        isCurrent,
      };
    });
  }, [totalSteps, currentStepIndex]);

  if (totalSteps <= 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2.5 p-2.5 bg-slate-950/95 border-t border-slate-800 backdrop-blur-md">
      {/* ─── Segmented Playback Timeline ──────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            <span className="font-semibold text-purple-300">Step {currentStepIndex}</span>
            <span className="text-slate-500">of {totalSteps}</span>
          </span>
          <span className="text-slate-500 text-[10px]">
            {Math.round((currentStepIndex / totalSteps) * 100)}% Complete
          </span>
        </div>

        {/* Clickable segmented track */}
        <div className="flex items-center gap-1 w-full h-3 py-0.5 px-0.5 bg-slate-900/90 rounded-md border border-slate-800 overflow-hidden">
          {segments.map((seg) => (
            <button
              key={seg.idx}
              onClick={() => onStepChange(seg.targetStep)}
              title={`Jump to Step ${seg.targetStep}`}
              className={`flex-1 h-full rounded-sm transition-all duration-150 cursor-pointer ${
                seg.isCurrent
                  ? 'bg-purple-400 shadow-sm shadow-purple-500 scale-y-125 z-10 animate-pulse'
                  : seg.isPassed
                  ? 'bg-purple-600/80 hover:bg-purple-500'
                  : 'bg-slate-800 hover:bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* ─── Action Controls Strip ────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {/* Previous / Backward Button */}
          <button
            onClick={onBackward}
            disabled={currentStepIndex <= 1}
            className="flex items-center justify-center p-1.5 px-2 rounded-lg bg-slate-900 hover:bg-purple-950/80 text-slate-300 hover:text-purple-200 border border-slate-800 hover:border-purple-700/50 disabled:opacity-35 disabled:hover:bg-slate-900 disabled:hover:text-slate-400 transition cursor-pointer text-xs"
            title="Previous Step (Backward)"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          {/* Play / Pause Toggle Button */}
          <button
            onClick={onPlayPauseToggle}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-white font-semibold transition shadow-md text-xs cursor-pointer ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/30'
            }`}
            title={isPlaying ? 'Pause Playback' : 'Start Playback with AI Voice'}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-white" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Play</span>
              </>
            )}
          </button>

          {/* Stop / Reset Button */}
          <button
            onClick={onStop}
            className="flex items-center justify-center p-1.5 px-2 rounded-lg bg-slate-900 hover:bg-rose-950/80 text-slate-300 hover:text-rose-200 border border-slate-800 hover:border-rose-800/50 transition cursor-pointer text-xs"
            title="Stop and Reset to Step 1"
          >
            <Square className="w-3 h-3 fill-rose-400 text-rose-400" />
          </button>

          {/* Next / Forward Button */}
          <button
            onClick={onForward}
            disabled={currentStepIndex >= totalSteps}
            className="flex items-center justify-center p-1.5 px-2 rounded-lg bg-slate-900 hover:bg-purple-950/80 text-slate-300 hover:text-purple-200 border border-slate-800 hover:border-purple-700/50 disabled:opacity-35 disabled:hover:bg-slate-900 disabled:hover:text-slate-400 transition cursor-pointer text-xs"
            title="Next Step (Forward)"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed and Voice Options */}
        <div className="flex items-center gap-2">
          {/* Speed Selector */}
          <select
            value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-1.5 py-1 text-[11px] font-mono outline-none focus:border-purple-400 cursor-pointer"
            title="Playback Speed"
          >
            <option value={1000}>0.5x</option>
            <option value={500}>1.0x</option>
            <option value={250}>2.0x</option>
          </select>

          {/* Voice Mute Toggle */}
          <button
            onClick={onToggleMute}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium transition cursor-pointer ${
              isMuted
                ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                : 'bg-purple-950/70 border-purple-600/50 text-purple-200 shadow-sm shadow-purple-950'
            }`}
            title={isMuted ? 'Unmute AI Voice Narration' : 'Mute AI Voice Narration'}
          >
            {isMuted ? (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px]">Muted</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
                <span className="text-[10px]">Voice ON</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

