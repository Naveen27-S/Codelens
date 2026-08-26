import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuit } from 'lucide-react';

interface DemoStep1TypingProps {
  isPlaying: boolean;
  onComplete?: () => void;
}

const DEMO_CODE = `numbers = [10, 20, 30, 40, 50]

total = 0

for number in numbers:
    total += number

print(total)`;

type TokenType = 'keyword' | 'builtin' | 'number' | 'string' | 'comment' | 'operator' | 'plain';

interface Token {
  text: string;
  type: TokenType;
}

const KEYWORDS = new Set(['for', 'in', 'if', 'else', 'elif', 'return', 'def', 'class', 'import', 'from', 'while', 'not', 'and', 'or', 'True', 'False', 'None', 'lambda', 'pass', 'break', 'continue', 'try', 'except', 'finally', 'with', 'as', 'yield', 'global', 'del']);
const BUILTINS = new Set(['print', 'len', 'range', 'int', 'str', 'list', 'dict', 'tuple', 'set', 'type', 'isinstance', 'hasattr', 'sum', 'min', 'max', 'zip', 'map', 'filter', 'enumerate', 'open', 'input']);

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < line.length) {
    // Comment
    if (line[i] === '#') {
      tokens.push({ text: line.slice(i), type: 'comment' });
      break;
    }
    // String
    if (line[i] === '"' || line[i] === "'") {
      const quote = line[i];
      let j = i + 1;
      while (j < line.length && line[j] !== quote) j++;
      tokens.push({ text: line.slice(i, j + 1), type: 'string' });
      i = j + 1;
      continue;
    }
    // Number
    if (/[0-9]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[0-9.]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'number' });
      i = j;
      continue;
    }
    // Word (keyword / builtin / plain)
    if (/[a-zA-Z_]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) j++;
      const word = line.slice(i, j);
      const type: TokenType = KEYWORDS.has(word) ? 'keyword' : BUILTINS.has(word) ? 'builtin' : 'plain';
      tokens.push({ text: word, type });
      i = j;
      continue;
    }
    // Operator chars
    if (/[+\-*/%=<>!&|^~\[\]{}(),:.]/.test(line[i])) {
      tokens.push({ text: line[i], type: 'operator' });
      i++;
      continue;
    }
    // Whitespace and anything else
    tokens.push({ text: line[i], type: 'plain' });
    i++;
  }
  return tokens;
}

const tokenColor: Record<TokenType, string> = {
  keyword: 'text-pink-400',
  builtin: 'text-blue-400',
  number: 'text-orange-400',
  string: 'text-green-400',
  comment: 'text-slate-500 italic',
  operator: 'text-slate-300',
  plain: 'text-slate-200',
};

function SyntaxLine({ text }: { text: string }) {
  const tokens = tokenizeLine(text);
  return (
    <>
      {tokens.map((tok, i) => (
        <span key={i} className={tokenColor[tok.type]}>
          {tok.text}
        </span>
      ))}
    </>
  );
}

export function DemoStep1Typing({ isPlaying, onComplete }: DemoStep1TypingProps) {
  const [displayedChars, setDisplayedChars] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cursorRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // Cursor blink
  useEffect(() => {
    cursorRef.current = setInterval(() => setShowCursor(v => !v), 530);
    return () => { if (cursorRef.current) clearInterval(cursorRef.current); };
  }, []);

  // Typing effect
  useEffect(() => {
    const chars = DEMO_CODE.length;
    if (displayedChars >= chars) {
      onComplete?.();
      return;
    }
    intervalRef.current = setInterval(() => {
      if (!isPlayingRef.current) return;
      setDisplayedChars(prev => {
        if (prev >= chars) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, 55);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const typed = DEMO_CODE.slice(0, displayedChars);
  const lines = typed.split('\n');

  return (
    <div className="flex h-full gap-0">
      {/* Code editor panel */}
      <div className="flex-1 flex flex-col bg-slate-950 rounded-xl overflow-hidden border border-slate-800/60 m-6 mr-3">
        {/* Editor titlebar */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900/80 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="ml-3 text-xs text-slate-500 font-mono">demo.py</span>
          </div>
          <AnimatePresence>
            {displayedChars < DEMO_CODE.length && isPlaying && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full"
              >
                <motion.span
                  animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block"
                />
                <BrainCircuit className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs text-indigo-300 font-medium">AI is analyzing your code…</span>
              </motion.div>
            )}
            {displayedChars >= DEMO_CODE.length && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                <span className="text-xs text-emerald-300 font-medium">Code ready for analysis</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Editor body */}
        <div className="flex-1 overflow-auto p-5 font-mono text-sm leading-7">
          {lines.map((line, lineIdx) => {
            const isLastLine = lineIdx === lines.length - 1;
            const lineNum = lineIdx + 1;
            return (
              <div key={lineIdx} className="flex gap-4 group">
                <span className="text-slate-600 select-none w-5 text-right shrink-0">{lineNum}</span>
                <span className="flex-1">
                  <SyntaxLine text={line} />
                  {isLastLine && displayedChars < DEMO_CODE.length && (
                    <span
                      className="inline-block w-0.5 h-[1.1em] bg-slate-300 align-middle ml-px"
                      style={{ opacity: showCursor ? 1 : 0, transition: 'opacity 0.1s' }}
                    />
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right info panel */}
      <div className="w-72 flex flex-col gap-4 m-6 ml-3">
        <div className="p-4 bg-slate-900/60 border border-slate-800/60 rounded-xl backdrop-blur-sm">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">About This Code</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            A simple Python program that sums a list of numbers using a loop. Watch the AI type it out character by character as it prepares to analyze the logic.
          </p>
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800/60 rounded-xl backdrop-blur-sm">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Progress</h3>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
              style={{ width: `${(displayedChars / DEMO_CODE.length) * 100}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
          <p className="text-xs text-slate-600 mt-2">{Math.round((displayedChars / DEMO_CODE.length) * 100)}% typed</p>
        </div>
        <div className="flex-1 p-4 bg-slate-900/60 border border-slate-800/60 rounded-xl backdrop-blur-sm">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Code Elements</h3>
          <div className="space-y-2 text-xs">
            {[
              { color: 'bg-pink-400', label: 'Keywords', ex: 'for, in' },
              { color: 'bg-blue-400', label: 'Built-ins', ex: 'print' },
              { color: 'bg-orange-400', label: 'Numbers', ex: '10, 20…' },
              { color: 'bg-slate-200', label: 'Variables', ex: 'numbers, total' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${item.color} shrink-0`} />
                <span className="text-slate-400">{item.label}</span>
                <span className="text-slate-600 ml-auto font-mono">{item.ex}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
