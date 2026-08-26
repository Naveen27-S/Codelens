import { motion } from 'framer-motion';
import { BrainCircuit, ArrowRight, Code2, Zap, Eye } from 'lucide-react';

export function DemoStep0Welcome() {
  const flowItems = [
    { icon: <Code2 className="w-5 h-5" />, label: 'Write Code', color: 'indigo' },
    { icon: <BrainCircuit className="w-5 h-5" />, label: 'AI Understands', color: 'violet' },
    { icon: <Zap className="w-5 h-5" />, label: 'AI Explains', color: 'purple' },
    { icon: <Eye className="w-5 h-5" />, label: 'Watch Execution', color: 'emerald' },
  ];

  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300',
    violet: 'bg-violet-500/20 border-violet-500/40 text-violet-300',
    purple: 'bg-purple-500/20 border-purple-500/40 text-purple-300',
    emerald: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
  };

  return (
    <div className="relative flex flex-col items-center justify-center h-full overflow-hidden px-8 text-center">
      {/* Background orbs */}
      <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] rounded-full bg-indigo-600/25 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] rounded-full bg-violet-600/25 blur-[100px] pointer-events-none" />
      <div className="absolute top-[30%] right-[5%] w-[25%] h-[25%] rounded-full bg-emerald-600/15 blur-[80px] pointer-events-none" />

      {/* Badge */}
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-sm font-medium mb-8"
      >
        <motion.span
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-2 h-2 rounded-full bg-indigo-400 inline-block"
        />
        Interactive AI Demo
      </motion.div>

      {/* Main headline */}
      <motion.h2
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
        className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight"
      >
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
          See How AI-Powered
        </span>
        <br />
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400">
          Code Visualization Works
        </span>
      </motion.h2>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
        className="text-lg md:text-xl text-slate-400 max-w-2xl mb-14 leading-relaxed"
      >
        Write code → AI understands it → AI explains it → Watch the execution visually.
      </motion.p>

      {/* Flow items */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.45, ease: 'easeOut' }}
        className="flex flex-wrap items-center justify-center gap-3"
      >
        {flowItems.map((item, i) => (
          <div key={item.label} className="flex items-center gap-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.5 + i * 0.12 }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border backdrop-blur-sm ${colorMap[item.color]}`}
            >
              {item.icon}
              <span className="text-sm font-semibold whitespace-nowrap">{item.label}</span>
            </motion.div>
            {i < flowItems.length - 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 + i * 0.12 }}
              >
                <ArrowRight className="w-5 h-5 text-slate-600" />
              </motion.div>
            )}
          </div>
        ))}
      </motion.div>

      {/* Auto-start hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="mt-14 text-slate-500 text-sm"
      >
        Demo is starting automatically…
      </motion.p>
    </div>
  );
}
