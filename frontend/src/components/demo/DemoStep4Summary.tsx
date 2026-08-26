import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, RotateCcw, ArrowRight, Terminal, Hash, RefreshCw, BrainCircuit } from 'lucide-react';
import { Link } from 'react-router-dom';

interface DemoStep4SummaryProps {
  onReplay: () => void;
}

const STATS = [
  { icon: <CheckCircle2 className="w-5 h-5" />, label: 'Execution Status', value: 'Completed ✓', color: 'emerald' },
  { icon: <Terminal className="w-5 h-5" />, label: 'Final Output', value: '150', color: 'indigo' },
  { icon: <RefreshCw className="w-5 h-5" />, label: 'Iterations Run', value: '5', color: 'violet' },
  { icon: <Hash className="w-5 h-5" />, label: 'Variables Tracked', value: '2', color: 'amber' },
  { icon: <BrainCircuit className="w-5 h-5" />, label: 'AI Insights Generated', value: '4', color: 'pink' },
];

const statColor: Record<string, { card: string; icon: string; value: string }> = {
  emerald: { card: 'bg-emerald-500/10 border-emerald-500/30', icon: 'text-emerald-400', value: 'text-emerald-300' },
  indigo:  { card: 'bg-indigo-500/10 border-indigo-500/30',  icon: 'text-indigo-400',  value: 'text-indigo-300'  },
  violet:  { card: 'bg-violet-500/10 border-violet-500/30',  icon: 'text-violet-400',  value: 'text-violet-300'  },
  amber:   { card: 'bg-amber-500/10 border-amber-500/30',    icon: 'text-amber-400',   value: 'text-amber-300'   },
  pink:    { card: 'bg-pink-500/10 border-pink-500/30',      icon: 'text-pink-400',    value: 'text-pink-300'    },
};

// Pure-CSS confetti particles using Framer Motion
function Particle({ i }: { i: number }) {
  const colors = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
  const color = colors[i % colors.length];
  const x = (Math.random() - 0.5) * 600;
  const y = -(Math.random() * 500 + 200);
  const rotate = Math.random() * 720 - 360;
  const size = Math.random() * 8 + 4;
  return (
    <motion.div
      className="absolute rounded-sm"
      style={{
        left: '50%',
        top: '40%',
        width: size,
        height: size * (Math.random() > 0.5 ? 2 : 1),
        backgroundColor: color,
        originX: '50%',
        originY: '50%',
      }}
      initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
      animate={{ x, y, opacity: 0, rotate, scale: 0 }}
      transition={{ duration: 1.6 + Math.random() * 0.8, delay: Math.random() * 0.5, ease: 'easeOut' }}
    />
  );
}

export function DemoStep4Summary({ onReplay }: DemoStep4SummaryProps) {
  const [showStats, setShowStats] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [particles] = useState(() => Array.from({ length: 40 }, (_, i) => i));
  const [showParticles, setShowParticles] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShowParticles(true), 200);
    const t2 = setTimeout(() => setShowStats(true), 700);
    const t3 = setTimeout(() => setShowActions(true), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center h-full overflow-hidden px-8 text-center">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="absolute top-[-20%] left-[10%] w-[40%] h-[40%] rounded-full bg-emerald-600/15 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-600/15 blur-[100px] pointer-events-none" />

      {/* Confetti */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <AnimatePresence>
          {showParticles && particles.map((i) => <Particle key={i} i={i} />)}
        </AnimatePresence>
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Success checkmark */}
        <motion.div
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/60 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(16,185,129,0.3)]"
        >
          <CheckCircle2 className="w-10 h-10 text-emerald-400" strokeWidth={1.5} />
        </motion.div>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="text-3xl md:text-5xl font-extrabold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400"
        >
          Code Successfully Visualized!
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-slate-400 text-base mb-10"
        >
          The AI walked through every step — from code to explanation to execution.
        </motion.p>

        {/* Stats grid */}
        <AnimatePresence>
          {showStats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10 w-full max-w-3xl"
            >
              {STATS.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.85, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                  className={`p-4 rounded-xl border backdrop-blur-sm ${statColor[stat.color].card}`}
                >
                  <div className={`flex justify-center mb-2 ${statColor[stat.color].icon}`}>{stat.icon}</div>
                  <div className={`text-lg font-bold font-mono ${statColor[stat.color].value}`}>{stat.value}</div>
                  <div className="text-[10px] text-slate-500 mt-1 leading-tight">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 items-center"
            >
              <Link
                to="/editor"
                className="flex items-center gap-2 px-7 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-semibold transition-all hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] active:scale-95"
              >
                Try It Yourself
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={onReplay}
                className="flex items-center gap-2 px-7 py-3.5 bg-slate-800/60 hover:bg-slate-800 text-white rounded-full font-semibold border border-slate-700/50 backdrop-blur-md transition-all active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                Replay Demo
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
