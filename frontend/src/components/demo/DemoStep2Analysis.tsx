import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuit, List, Hash, RefreshCw, CheckCircle2 } from 'lucide-react';

interface DemoStep2AnalysisProps {
  isPlaying: boolean;
}

const DEMO_CODE_LINES = [
  { num: 1, tokens: [{ text: 'numbers', type: 'plain' }, { text: ' = ', type: 'op' }, { text: '[', type: 'op' }, { text: '10', type: 'num' }, { text: ', ', type: 'op' }, { text: '20', type: 'num' }, { text: ', ', type: 'op' }, { text: '30', type: 'num' }, { text: ', ', type: 'op' }, { text: '40', type: 'num' }, { text: ', ', type: 'op' }, { text: '50', type: 'num' }, { text: ']', type: 'op' }] },
  { num: 2, tokens: [] },
  { num: 3, tokens: [{ text: 'total', type: 'plain' }, { text: ' = ', type: 'op' }, { text: '0', type: 'num' }] },
  { num: 4, tokens: [] },
  { num: 5, tokens: [{ text: 'for', type: 'kw' }, { text: ' number ', type: 'plain' }, { text: 'in', type: 'kw' }, { text: ' numbers:', type: 'plain' }] },
  { num: 6, tokens: [{ text: '    total', type: 'plain' }, { text: ' += ', type: 'op' }, { text: 'number', type: 'plain' }] },
  { num: 7, tokens: [] },
  { num: 8, tokens: [{ text: 'print', type: 'builtin' }, { text: '(total)', type: 'plain' }] },
];

const tokenCls: Record<string, string> = {
  kw: 'text-pink-400', builtin: 'text-blue-400', num: 'text-orange-400',
  op: 'text-slate-300', plain: 'text-slate-200',
};

const INSIGHTS = [
  {
    icon: <List className="w-4 h-4" />,
    color: 'indigo',
    title: 'List Detected',
    text: 'I detected a list of numbers: [10, 20, 30, 40, 50]. It contains 5 integer elements.',
    delay: 0.2,
    highlight: 0,
  },
  {
    icon: <Hash className="w-4 h-4" />,
    color: 'violet',
    title: 'Accumulator Variable',
    text: 'The variable `total` stores the accumulated value. It starts at 0 and grows each iteration.',
    delay: 1.0,
    highlight: 2,
  },
  {
    icon: <RefreshCw className="w-4 h-4" />,
    color: 'amber',
    title: 'Loop Structure',
    text: 'The `for` loop processes each number in the list one by one, running exactly 5 iterations.',
    delay: 1.8,
    highlight: 4,
  },
  {
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: 'emerald',
    title: 'Predicted Output',
    text: 'The final result will be 150. (10 + 20 + 30 + 40 + 50 = 150)',
    delay: 2.6,
    highlight: 7,
  },
];

const insightBorder: Record<string, string> = {
  indigo: 'border-l-indigo-500 bg-indigo-500/5',
  violet: 'border-l-violet-500 bg-violet-500/5',
  amber: 'border-l-amber-500 bg-amber-500/5',
  emerald: 'border-l-emerald-500 bg-emerald-500/5',
};

const insightText: Record<string, string> = {
  indigo: 'text-indigo-400', violet: 'text-violet-400', amber: 'text-amber-400', emerald: 'text-emerald-400',
};

export function DemoStep2Analysis({ isPlaying }: DemoStep2AnalysisProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);

  useEffect(() => {
    if (!isPlaying) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    INSIGHTS.forEach((ins, idx) => {
      timers.push(
        setTimeout(() => {
          setVisibleCount(idx + 1);
          setHighlightedLine(ins.highlight);
        }, ins.delay * 1000)
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [isPlaying]);

  return (
    <div className="flex h-full gap-0">
      {/* Code editor - static */}
      <div className="flex-1 flex flex-col bg-slate-950 rounded-xl overflow-hidden border border-slate-800/60 m-6 mr-3">
        <div className="flex items-center gap-2 px-5 py-3 bg-slate-900/80 border-b border-slate-800">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
          <span className="ml-3 text-xs text-slate-500 font-mono">demo.py</span>
        </div>
        <div className="flex-1 overflow-auto p-5 font-mono text-sm leading-7">
          {DEMO_CODE_LINES.map((line) => {
            const isHighlighted = highlightedLine === line.num - 1;
            return (
              <motion.div
                key={line.num}
                animate={{
                  backgroundColor: isHighlighted ? 'rgba(99,102,241,0.12)' : 'rgba(0,0,0,0)',
                }}
                transition={{ duration: 0.3 }}
                className="flex gap-4 group rounded-md px-1"
              >
                <span className={`select-none w-5 text-right shrink-0 transition-colors ${isHighlighted ? 'text-indigo-400' : 'text-slate-600'}`}>
                  {line.num}
                </span>
                <span className="flex-1">
                  {line.tokens.map((tok, i) => (
                    <span key={i} className={tokenCls[tok.type] ?? 'text-slate-200'}>{tok.text}</span>
                  ))}
                </span>
                {isHighlighted && (
                  <motion.span
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-indigo-400 text-xs flex items-center"
                  >
                    ◀ analyzing
                  </motion.span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* AI Analysis Panel */}
      <div className="w-80 flex flex-col m-6 ml-3 gap-3">
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/60 border border-slate-800/60 rounded-xl">
          <BrainCircuit className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-indigo-300">AI Analysis</span>
          <motion.span
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="ml-auto w-2 h-2 rounded-full bg-indigo-400"
          />
        </div>

        <div className="flex-1 space-y-3 overflow-auto">
          <AnimatePresence>
            {INSIGHTS.slice(0, visibleCount).map((ins, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: 30, y: 10 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`p-4 rounded-xl border-l-4 ${insightBorder[ins.color]} border border-slate-800/40`}
              >
                <div className={`flex items-center gap-2 mb-1.5 ${insightText[ins.color]}`}>
                  {ins.icon}
                  <span className="text-xs font-semibold">{ins.title}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{ins.text}</p>
              </motion.div>
            ))}
          </AnimatePresence>
          {visibleCount === 0 && (
            <div className="text-center text-slate-600 text-sm mt-8">Preparing analysis…</div>
          )}
        </div>
      </div>
    </div>
  );
}
