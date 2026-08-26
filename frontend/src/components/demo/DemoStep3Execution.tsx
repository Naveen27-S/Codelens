import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuit, ArrowDown } from 'lucide-react';

interface DemoStep3ExecutionProps {
  isPlaying: boolean;
}

const ITERATIONS = [
  { iter: 1, number: 10,  totalBefore: 0,   totalAfter: 10  },
  { iter: 2, number: 20,  totalBefore: 10,  totalAfter: 30  },
  { iter: 3, number: 30,  totalBefore: 30,  totalAfter: 60  },
  { iter: 4, number: 40,  totalBefore: 60,  totalAfter: 100 },
  { iter: 5, number: 50,  totalBefore: 100, totalAfter: 150 },
];

const AI_EXPLANATIONS = [
  "Starting iteration 1. `number` takes the value 10 from the list. Adding it to `total` (0 + 10 = 10).",
  "Iteration 2. `number` is now 20. `total` grows from 10 to 30.",
  "Iteration 3. `number` is 30. `total` accumulates to 60.",
  "Iteration 4. `number` is 40. `total` is now 100.",
  "Final iteration! `number` is 50. `total` reaches 150. Loop ends and print(150) is called.",
];

const CODE_LINES = [
  { num: 1, text: 'numbers = [10, 20, 30, 40, 50]', highlight: false },
  { num: 2, text: '', highlight: false },
  { num: 3, text: 'total = 0', highlight: false },
  { num: 4, text: '', highlight: false },
  { num: 5, text: 'for number in numbers:', highlight: true },
  { num: 6, text: '    total += number', highlight: true },
  { num: 7, text: '', highlight: false },
  { num: 8, text: 'print(total)', highlight: false },
];

const NUMBERS = [10, 20, 30, 40, 50];

export function DemoStep3Execution({ isPlaying }: DemoStep3ExecutionProps) {
  const [currentIter, setCurrentIter] = useState(-1);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  useEffect(() => {
    let step = 0;
    const steps = [
      () => { setActiveLine(4); },            // highlight for loop line
      () => { setCurrentIter(0); setActiveLine(5); },
      () => { setActiveLine(4); },
      () => { setCurrentIter(1); setActiveLine(5); },
      () => { setActiveLine(4); },
      () => { setCurrentIter(2); setActiveLine(5); },
      () => { setActiveLine(4); },
      () => { setCurrentIter(3); setActiveLine(5); },
      () => { setActiveLine(4); },
      () => { setCurrentIter(4); setActiveLine(5); },
      () => { setActiveLine(7); setShowOutput(true); },
    ];

    const tick = () => {
      if (!isPlayingRef.current) {
        timer = setTimeout(tick, 200);
        return;
      }
      if (step < steps.length) {
        steps[step]();
        step++;
        timer = setTimeout(tick, step % 2 === 0 ? 800 : 1400);
      }
    };
    let timer = setTimeout(tick, 600);
    return () => clearTimeout(timer);
  }, []);

  const iter = currentIter >= 0 ? ITERATIONS[currentIter] : null;

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      {/* Code panel */}
      <div className="w-[38%] flex flex-col bg-slate-950 rounded-xl overflow-hidden border border-slate-800/60 m-5 mr-2">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/80 border-b border-slate-800">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          <span className="ml-2 text-xs text-slate-500 font-mono">demo.py</span>
        </div>
        <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-7">
          {CODE_LINES.map((line) => {
            const isActive = activeLine === line.num - 1;
            return (
              <motion.div
                key={line.num}
                animate={{ backgroundColor: isActive ? 'rgba(99,102,241,0.15)' : 'rgba(0,0,0,0)' }}
                transition={{ duration: 0.25 }}
                className="flex gap-3 rounded-md px-1"
              >
                <span className={`select-none w-4 text-right shrink-0 transition-colors ${isActive ? 'text-indigo-400 font-bold' : 'text-slate-600'}`}>
                  {line.num}
                </span>
                <span className={`flex-1 ${isActive ? 'text-white' : line.highlight ? 'text-emerald-300' : 'text-slate-400'}`}>
                  {line.text}
                </span>
                {isActive && (
                  <motion.span
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="text-indigo-400 text-[10px] flex items-center"
                  >
                    ▶
                  </motion.span>
                )}
              </motion.div>
            );
          })}
        </div>
        {/* AI Explanation box */}
        <div className="border-t border-slate-800 p-3 bg-slate-900/50 min-h-[90px]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <BrainCircuit className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wider">AI Tutor</span>
          </div>
          <AnimatePresence mode="wait">
            {iter && (
              <motion.p
                key={currentIter}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35 }}
                className="text-[11px] text-slate-400 leading-relaxed"
              >
                {AI_EXPLANATIONS[currentIter]}
              </motion.p>
            )}
            {!iter && (
              <motion.p
                key="waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[11px] text-slate-600"
              >
                Waiting for execution to begin…
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Center: flow visualization */}
      <div className="w-[28%] flex flex-col items-center justify-center gap-2 py-6">
        {/* Numbers array */}
        <div className="text-xs text-slate-500 font-semibold mb-1 tracking-wider uppercase">numbers</div>
        <div className="flex gap-1.5 flex-wrap justify-center">
          {NUMBERS.map((n, i) => (
            <motion.div
              key={n}
              animate={{
                scale: iter && i === currentIter ? 1.25 : 1,
                backgroundColor: iter && i < iter.iter ? 'rgba(99,102,241,0.3)' : iter && i === currentIter ? 'rgba(99,102,241,0.5)' : 'rgba(30,41,59,1)',
                borderColor: iter && i === currentIter ? 'rgb(99,102,241)' : 'rgb(51,65,85)',
              }}
              transition={{ duration: 0.3 }}
              className="w-10 h-10 flex items-center justify-center rounded-lg border font-mono text-sm font-bold text-white"
            >
              {n}
            </motion.div>
          ))}
        </div>

        <ArrowDown className="w-5 h-5 text-slate-600 my-1" />

        {/* Loop indicator */}
        <motion.div
          animate={{
            borderColor: activeLine === 4 ? 'rgb(99,102,241)' : 'rgb(51,65,85)',
            backgroundColor: activeLine === 4 ? 'rgba(99,102,241,0.1)' : 'rgba(15,23,42,1)',
          }}
          className="px-4 py-2 border rounded-lg text-xs font-mono text-slate-300"
        >
          for loop
          {iter && <span className="ml-2 text-indigo-400">#{iter.iter}/5</span>}
        </motion.div>

        <ArrowDown className="w-5 h-5 text-slate-600 my-1" />

        {/* Variable boxes */}
        <div className="flex gap-3">
          {/* number var */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] text-slate-500 font-mono">number</span>
            <AnimatePresence mode="wait">
              <motion.div
                key={`num-${iter?.number ?? 'x'}`}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="w-14 h-10 flex items-center justify-center bg-violet-500/20 border border-violet-500/50 rounded-lg font-mono text-sm font-bold text-violet-300"
              >
                {iter ? iter.number : '?'}
              </motion.div>
            </AnimatePresence>
          </div>
          {/* total var */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] text-slate-500 font-mono">total</span>
            <AnimatePresence mode="wait">
              <motion.div
                key={`total-${iter?.totalAfter ?? 0}`}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="w-14 h-10 flex items-center justify-center bg-emerald-500/20 border border-emerald-500/50 rounded-lg font-mono text-sm font-bold text-emerald-300"
              >
                {iter ? iter.totalAfter : 0}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <ArrowDown className="w-5 h-5 text-slate-600 my-1" />

        {/* Output */}
        <AnimatePresence>
          {showOutput && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="px-5 py-2.5 bg-emerald-500/20 border border-emerald-500/50 rounded-xl"
            >
              <div className="text-[10px] text-emerald-500 font-semibold mb-0.5">OUTPUT</div>
              <div className="text-xl font-bold font-mono text-emerald-300">150</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right: iteration history */}
      <div className="w-[34%] flex flex-col m-5 ml-2 gap-2">
        <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider px-1">Execution Log</div>
        <div className="flex-1 space-y-2 overflow-auto">
          <AnimatePresence>
            {ITERATIONS.slice(0, Math.max(0, currentIter + 1)).map((it) => (
              <motion.div
                key={it.iter}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35 }}
                className={`p-3 rounded-xl border backdrop-blur-sm ${
                  it.iter === (iter?.iter ?? 0)
                    ? 'bg-indigo-500/10 border-indigo-500/40'
                    : 'bg-slate-900/50 border-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${it.iter === (iter?.iter ?? 0) ? 'text-indigo-400' : 'text-slate-500'}`}>
                    Iteration {it.iter}
                  </span>
                  <span className="text-[10px] text-slate-600 font-mono">+{it.number}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                  <div className="text-center">
                    <div className="text-slate-600">number</div>
                    <div className="text-violet-400 font-bold">{it.number}</div>
                  </div>
                  <div className="text-center text-slate-600 flex items-center justify-center">→</div>
                  <div className="text-center">
                    <div className="text-slate-600">total</div>
                    <div className="text-emerald-400 font-bold">{it.totalAfter}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {currentIter < 0 && (
            <div className="text-center text-slate-600 text-xs mt-6">Waiting for loop to start…</div>
          )}
        </div>
        {/* Terminal snippet */}
        <AnimatePresence>
          {showOutput && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono"
            >
              <div className="text-[10px] text-slate-600 mb-1.5">$ python demo.py</div>
              <div className="text-emerald-400 text-sm font-bold">150</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
