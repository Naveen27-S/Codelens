import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RotateCcw, Save, Sparkles, Terminal, Keyboard, Code, Bug, Wand2, CheckCircle, AlertTriangle, X, ChevronUp, ChevronDown, Trash2, GripHorizontal } from 'lucide-react';
import axios from 'axios';
import { useSettings } from '../context/SettingsContext';
import { recordUserActivity, recordSessionTime } from '../services/dashboardService';
import { SUPPORTED_LANGUAGES, getLanguageConfig, getDefaultStarterCode, getMonacoLanguage } from '../config/languageConfig';
import { getProblemById, type CodingProblem } from '../config/problemConfig';
import { executeCodeClient } from '../services/runners/clientExecutionService';
import { generateClientFlowchart } from '../services/flowchartGenerator';
import type { ExecutionResult } from '../types/execution';
import { VisualizerPanel } from '../components/visualizer/VisualizerPanel';
import { diagnoseCodeMistake } from '../services/codeMistakeDiagnostician';

export interface AIErrorExplanation {
  problem: string;
  explanation: string;
  solution: string;
  corrected_code?: string;
  suggestedFix?: string;
  lineNumber?: number | null;
  offendingLine?: string;
  fullCorrectedCode?: string;
  language?: string;
}

// Helper: build auth headers from JWT stored in localStorage
function authHeaders() {
  const token = localStorage.getItem('codelens_jwt');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export function EditorPage() {
  const { settings, resolvedTheme, updateSetting } = useSettings();
  const location = useLocation();

  const routerState = location.state as {
    code?: string;
    language?: string;
    input?: string;
    programId?: string;
    programTitle?: string;
    problemId?: string;
    problemTitle?: string;
    activeTab?: 'output' | 'input' | 'visualization';
    visualization?: string;
    triggerRun?: boolean;
    triggerVisualize?: boolean;
    triggerAITutor?: boolean;
  } | null;

  const [activeProblem, setActiveProblem] = useState<CodingProblem | null>(() => {
    if (routerState?.problemId) {
      const prob = getProblemById(routerState.problemId);
      if (prob) {
        // Track practice problem open in MongoDB
        recordUserActivity({
          activity_type: 'practice',
          title: `Practiced: ${prob.title}`,
          description: `Opened practice problem "${prob.title}" in the editor.`,
          topic: prob.category || prob.difficulty || 'Practice',
          status: 'completed',
          duration_seconds: 60,
        });
      }
      return prob || null;
    }
    return null;
  });

  const [language, setLanguage] = useState<string>(() => {
    if (routerState?.language) return routerState.language.toLowerCase();
    return (settings.defaultLanguage || 'python').toLowerCase();
  });

  const [codeByLanguage, setCodeByLanguage] = useState<Record<string, string>>(() => {
    const initialLang = (routerState?.language || settings.defaultLanguage || 'python').toLowerCase();
    let initialCode = '';

    if (routerState?.code !== undefined) {
      initialCode = routerState.code;
    } else if (routerState?.problemId) {
      const problem = getProblemById(routerState.problemId);
      initialCode = problem?.starterCode[initialLang] || getDefaultStarterCode(initialLang);
    } else {
      initialCode = getDefaultStarterCode(initialLang);
    }

    return {
      [initialLang]: initialCode,
    };
  });

  const [output, setOutput] = useState('');
  const [errorExplanation, setErrorExplanation] = useState<AIErrorExplanation | null>(null);
  const [stdin, setStdin] = useState(() => routerState?.input || '');
  const [visualization, setVisualization] = useState(() => routerState?.visualization || '');
  const [clientExecutionResult, setClientExecutionResult] = useState<ExecutionResult | null>(null);



  // Resizable console footer height
  const [consoleHeight, setConsoleHeight] = useState(240);
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);
  const consoleResizeRef = useRef<boolean>(false);
  const consoleResizeStartY = useRef<number>(0);
  const consoleResizeStartH = useRef<number>(240);

  const handleConsoleResizeStart = (e: React.MouseEvent) => {
    consoleResizeRef.current = true;
    consoleResizeStartY.current = e.clientY;
    consoleResizeStartH.current = consoleHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      if (!consoleResizeRef.current) return;
      const delta = consoleResizeStartY.current - ev.clientY;
      const newH = Math.max(120, Math.min(520, consoleResizeStartH.current + delta));
      setConsoleHeight(newH);
    };
    const onUp = () => {
      consoleResizeRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const [isRunning, setIsRunning] = useState(false);
  const [isVisualizing, setIsVisualizing] = useState(false);

  // Active practice & platform accessing time tracking
  const sessionStartRef = useRef<number>(Date.now());
  const lastActiveRef = useRef<number>(Date.now());

  // Heartbeat every 60s to record active practice time
  useEffect(() => {
    const handleActivity = () => {
      lastActiveRef.current = Date.now();
    };
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('click', handleActivity);

    const interval = setInterval(() => {
      // Track session time if active within the last 2 minutes
      if (Date.now() - lastActiveRef.current < 120000) {
        const elapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);
        if (elapsed >= 45) {
          recordSessionTime({
            duration_seconds: elapsed,
            language,
            topic: activeProblem?.category || 'Code Editor Practice',
            activity_type: 'practice',
            title: `Practiced ${language.toUpperCase()} in Editor`,
            description: `Active practice session on ${activeProblem?.title || `${language.toUpperCase()} Program`} for ${Math.round(elapsed / 60) || 1}m.`,
          });
          sessionStartRef.current = Date.now();
        }
      }
    }, 60000);

    return () => {
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('click', handleActivity);
      clearInterval(interval);
      // Flush remaining session time on unmount if user spent meaningful time
      const finalElapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);
      if (finalElapsed >= 30) {
        recordSessionTime({
          duration_seconds: finalElapsed,
          language,
          topic: activeProblem?.category || 'Code Editor Practice',
          activity_type: 'practice',
        });
      }
    };
  }, [language, activeProblem]);

  // ─── In-App Notification Toast System ────────────────────────────────────────
  interface InAppToast {
    id: string;
    type: 'success' | 'error' | 'ai' | 'info';
    title: string;
    message: string;
  }
  const [toasts, setToasts] = useState<InAppToast[]>([]);

  const addToast = useCallback((type: 'success' | 'error' | 'ai' | 'info', title: string, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // ─── Resizable split panel state ────────────────────────────────────────────
  const [showViz, setShowViz] = useState(true);
  const [vizWidth, setVizWidth] = useState(480); // px
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = vizWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartX.current - ev.clientX; // dragging left increases vizWidth
      const containerWidth = containerRef.current?.offsetWidth ?? 1200;
      const newWidth = Math.max(280, Math.min(containerWidth - 300, dragStartWidth.current + delta));
      setVizWidth(newWidth);
    };

    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);

  // Highlight line in Monaco editor during step playback
  const highlightLine = (lineNum: number | null) => {
    if (!editorRef.current) return;
    if (lineNum === null || lineNum <= 0) {
      decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
      return;
    }
    decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, [
      {
        range: { startLineNumber: lineNum, startColumn: 1, endLineNumber: lineNum, endColumn: 1000 },
        options: {
          isWholeLine: true,
          className: 'bg-cyan-500/20 border-l-4 border-cyan-400 font-bold',
          glyphMarginClassName: 'text-cyan-400 font-bold',
        },
      },
    ]);
    editorRef.current.revealLineInCenter(lineNum);
  };

  // Highlight mistake/error line in Monaco editor with prominent red accent
  const highlightErrorLine = (lineNum: number | null) => {
    if (!editorRef.current) return;
    if (lineNum === null || lineNum <= 0) {
      decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
      return;
    }
    decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, [
      {
        range: { startLineNumber: lineNum, startColumn: 1, endLineNumber: lineNum, endColumn: 1000 },
        options: {
          isWholeLine: true,
          className: 'bg-rose-500/25 border-l-4 border-rose-500 font-bold',
          glyphMarginClassName: 'text-rose-500 font-bold',
        },
      },
    ]);
    editorRef.current.revealLineInCenter(lineNum);
  };

  const isLegacyPlaceholder = (val?: string) => {
    if (!val) return true;
    const trimmed = val.trim();
    return (
      trimmed === '' ||
      trimmed === '# Write your Python code here' ||
      trimmed === 'public class Main {\n    public static void main(String[] args) {\n        // Write your Java code here\n    }\n}' ||
      trimmed === '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your C++ code here\n    return 0;\n}' ||
      trimmed === '#include <stdio.h>\n\nint main() {\n    // Write your C code here\n    return 0;\n}' ||
      trimmed.includes('Returned value from main():') ||
      trimmed.includes('mainFunction(a, b)') ||
      trimmed.includes('mainFunction(int a, int b)') ||
      (trimmed.includes('def main(a, b):') && trimmed.includes('return a + b'))
    );
  };

  const rawCode = codeByLanguage[language];
  const currentCode = (rawCode !== undefined && !isLegacyPlaceholder(rawCode))
    ? rawCode 
    : (activeProblem?.starterCode[language] || getDefaultStarterCode(language));

  // ── Auto-save feature ──
  // If autoSave & notifyCodeSaved are enabled, code is automatically saved.
  // If the user turns it OFF, code cannot be saved automatically.
  const lastSavedCodeRef = useRef<string>(currentCode);

  useEffect(() => {
    // If autoSave or notifyCodeSaved is OFF, the code cannot be saved automatically!
    if (!settings.autoSave || !settings.notifyCodeSaved) {
      return;
    }

    if (!currentCode || currentCode === lastSavedCodeRef.current) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        lastSavedCodeRef.current = currentCode;
        const langConfig = getLanguageConfig(language);
        const title = activeProblem
          ? `${activeProblem.title} (Auto-Saved)`
          : `${langConfig.label} Auto-Save`;

        await axios.post(`${API_URL}/programs`, {
          name: title,
          language,
          code: currentCode,
          description: `Auto-saved at ${new Date().toLocaleTimeString()}`,
          output: output || '',
          status: 'draft',
        }, { headers: authHeaders() }).catch(() => {});

        if (settings.notifyCodeSaved) {
          addToast('info', 'Code Saved', `Your ${langConfig.label} code was automatically saved.`);
        }
      } catch {
        // silent fallback
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [currentCode, language, settings.autoSave, settings.notifyCodeSaved, activeProblem, output, addToast]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCodeByLanguage((prev) => ({
        ...prev,
        [language]: value,
      }));
    }
  };

  const handleLanguageChange = (newLang: string) => {
    const normalized = newLang.toLowerCase();
    setLanguage(normalized);

    setCodeByLanguage((prev) => {
      if (prev[normalized] !== undefined && !isLegacyPlaceholder(prev[normalized])) {
        return prev;
      }
      const starter = activeProblem?.starterCode[normalized] || getDefaultStarterCode(normalized);
      return {
        ...prev,
        [normalized]: starter,
      };
    });
  };

  const formatLineFixWithIndentation = (offendingLine: string, suggestedFix: string): string => {
    const indent = offendingLine.match(/^(\s*)/)?.[1] || '';
    const trimmedFix = suggestedFix.trim();
    if (/^\s+/.test(suggestedFix)) {
      return suggestedFix;
    }
    return `${indent}${trimmedFix}`;
  };

  const handleApplyFix = (rerunAfterFix: boolean = true) => {
    if (!errorExplanation) return;

    const lineNum = errorExplanation.lineNumber;
    const fixSnippet = errorExplanation.suggestedFix || errorExplanation.corrected_code;
    const fullCode = errorExplanation.fullCorrectedCode;

    let newCode = currentCode;

    if (fullCode && fullCode.trim().length > 0 && fullCode.trim() !== currentCode.trim()) {
      newCode = fullCode;
    } else if (lineNum && lineNum >= 1 && fixSnippet) {
      const lines = currentCode.split('\n');
      if (lineNum <= lines.length) {
        const offending = lines[lineNum - 1];
        const fixedLine = formatLineFixWithIndentation(offending, fixSnippet);
        lines[lineNum - 1] = fixedLine;
        newCode = lines.join('\n');
      }
    }

    if (newCode === currentCode) return;

    // 1. Update code state for current language
    setCodeByLanguage((prev) => ({
      ...prev,
      [language]: newCode,
    }));

    // 2. Update Monaco editor instance directly
    if (editorRef.current) {
      editorRef.current.setValue(newCode);
    }

    // 3. Clear mistake decoration
    highlightErrorLine(null);

    // 4. Update the console output to clearly document the mistake change
    const oldLineStr = errorExplanation.offendingLine || `Line ${lineNum || '?'}`;
    const newLineStr = fixSnippet || 'Corrected code';
    const fixLog = `✨ [AI Auto-Fix Applied]
──────────────────────────────────────────────────────────────
Fixed Mistake on Line ${lineNum || '?'}:
  ❌ Before: ${oldLineStr.trim()}
  ✅ After:  ${newLineStr.trim()}

${rerunAfterFix ? '▶ Running corrected code with Debug & Visualize...' : '✓ Corrected code applied to editor.'}`;

    setOutput(fixLog);
    setErrorExplanation(null);

    // 5. If rerun requested, immediately trigger Debug & Visualize on the corrected code
    if (rerunAfterFix) {
      setTimeout(() => {
        handleVisualizeCode(newCode, language, stdin);
      }, 250);
    }
  };

  // 100% Client-Side Execution Handler
  const handleRunCode = async (overrideCode?: string, overrideLang?: string, overrideInput?: string) => {
    const langToRun = (overrideLang !== undefined ? overrideLang : language).toLowerCase();
    const codeToRun = overrideCode !== undefined ? overrideCode : currentCode;
    const inputToUse = overrideInput !== undefined ? overrideInput : stdin;

    setIsRunning(true);
    if (settings.clearTerminalBeforeRun) {
      setOutput('⚙ Executing in-browser...');
    } else {
      setOutput((prev) => (prev ? `${prev}\n\n⚙ Executing in-browser...` : '⚙ Executing in-browser...'));
    }
    setErrorExplanation(null);

    try {
      // 1. Run 100% Client-Side in Browser (Pyodide Wasm / Worker / JSCPP)
      const clientRes = await executeCodeClient(langToRun, codeToRun, inputToUse);
      setClientExecutionResult(clientRes);

      // Generate visual flowchart automatically for Visualizer Panel
      const chart = generateClientFlowchart(codeToRun, langToRun);
      setVisualization(chart);

      if (clientRes.status === 'success') {
        const memoryStr = clientRes.memoryUsedKb ? ` | Memory: ~${clientRes.memoryUsedKb} KB` : '';
        const runOutput = (clientRes.stdout || 'Execution completed cleanly (no stdout output)') + `\n\n✓ In-Browser Execution Completed\nTime: ${clientRes.executionTimeMs} ms${memoryStr}`;

        setOutput((prev) => {
          if (settings.clearTerminalBeforeRun || !prev || prev === '⚙ Executing in-browser...') {
            return runOutput;
          }
          const cleanPrev = prev.replace(/\n\n⚙ Executing in-browser\.\.\.$/, '');
          return cleanPrev ? `${cleanPrev}\n\n──────────────────────────────────────────────────\n[New Execution]\n${runOutput}` : runOutput;
        });

        setErrorExplanation(null);
        highlightErrorLine(null);

        if (settings.notifyExecutionCompleted) {
          addToast('success', 'Execution Completed', `Your ${langToRun.toUpperCase()} code executed successfully in ${clientRes.executionTimeMs || 5}ms.`);
        }
      } else if (clientRes.status === 'timeout') {
        const timeoutOutput = `⏱ Execution Timed Out (5s limit)\n${clientRes.stderr}`;
        setOutput((prev) => {
          if (settings.clearTerminalBeforeRun || !prev || prev === '⚙ Executing in-browser...') return timeoutOutput;
          const cleanPrev = prev.replace(/\n\n⚙ Executing in-browser\.\.\.$/, '');
          return cleanPrev ? `${cleanPrev}\n\n──────────────────────────────────────────────────\n[New Execution]\n${timeoutOutput}` : timeoutOutput;
        });

        setErrorExplanation({
          problem: 'Execution Timeout',
          explanation: 'The program exceeded the 5-second execution limit. This usually indicates an infinite loop.',
          solution: 'Check your loop termination conditions (e.g. while or for loops).',
          lineNumber: null,
          offendingLine: '',
        });

        if (settings.notifyExecutionErrors) {
          addToast('error', 'Execution Errors', 'Execution timed out. Check your loop termination conditions.');
        }
      } else {
        const mistakeReport = diagnoseCodeMistake(langToRun, codeToRun, clientRes.stderr, clientRes.stdout);
        if (mistakeReport.lineNumber) {
          highlightErrorLine(mistakeReport.lineNumber);
        }
        const errorOut = mistakeReport.terminalOutput;
        setOutput((prev) => {
          if (settings.clearTerminalBeforeRun || !prev || prev === '⚙ Executing in-browser...') return errorOut;
          const cleanPrev = prev.replace(/\n\n⚙ Executing in-browser\.\.\.$/, '');
          return cleanPrev ? `${cleanPrev}\n\n──────────────────────────────────────────────────\n[New Execution]\n${errorOut}` : errorOut;
        });

        if (settings.notifyExecutionErrors) {
          addToast('error', 'Execution Errors', `Runtime error detected in ${langToRun.toUpperCase()} code. View terminal output.`);
        }
        const initialExplanation: AIErrorExplanation = {
          problem: mistakeReport.mistakeTitle,
          explanation: `Line ${mistakeReport.lineNumber || '?'}: ${mistakeReport.mistakeDescription}`,
          solution: mistakeReport.expectedInCode,
          corrected_code: mistakeReport.suggestedFixSnippet,
          suggestedFix: mistakeReport.suggestedFixSnippet,
          lineNumber: mistakeReport.lineNumber,
          offendingLine: mistakeReport.offendingLine,
          language: langToRun,
        };
        setErrorExplanation(initialExplanation);

        // Query backend AI debug endpoint for enhanced Gemini explanation
        axios.post(`${API_URL}/ai/debug`, {
          language: langToRun,
          code: codeToRun,
          error: clientRes.stderr,
        }, { headers: authHeaders() }).then((aiRes) => {
          if (aiRes.data && (aiRes.data.problem || aiRes.data.explanation)) {
            setErrorExplanation((prev) => prev ? ({
              ...prev,
              problem: aiRes.data.problem || prev.problem,
              explanation: aiRes.data.explanation || prev.explanation,
              solution: aiRes.data.solution || prev.solution,
              corrected_code: aiRes.data.corrected_code || prev.corrected_code,
              fullCorrectedCode: aiRes.data.corrected_code,
            }) : null);
          }
        }).catch(() => {});
      }

      // Record code execution to backend MongoDB (activities collection)
      try {
        const langConfig = getLanguageConfig(langToRun);
        const programTitle = activeProblem ? activeProblem.title : `${langConfig.label} Program`;
        // 1. POST to /execute to store in executions + activities
        await axios.post(`${API_URL}/execute`, {
          language: langToRun,
          code: codeToRun,
          input: inputToUse,
          program_name: programTitle,
          program_id: activeProblem?.id || null,
        }, { headers: authHeaders() });
        // 2. Also explicitly record a code_execution activity with realistic practice duration
        const elapsedSec = Math.max(60, Math.round((Date.now() - sessionStartRef.current) / 1000));
        sessionStartRef.current = Date.now();

        await recordUserActivity({
          activity_type: 'code_execution',
          title: `Ran ${langConfig.label} Program`,
          description: `Executed ${langToRun} code (${clientRes.status}).`,
          language: langToRun,
          program_name: programTitle,
          topic: activeProblem?.category || undefined,
          status: clientRes.status === 'success' ? 'completed' : 'error',
          duration_seconds: elapsedSec,
          metadata_json: {
            execution_status: clientRes.status,
            execution_time_ms: clientRes.executionTimeMs,
            program_id: activeProblem?.id || null,
            source_code: codeToRun,
          },
        });
      } catch {
        // Backend optional — UI always works
      }
    } catch (err: any) {
      setOutput(`Client-side execution failed: ${err.message || String(err)}`);
    } finally {
      setIsRunning(false);
    }
  };

  // 100% Client-Side Debug & Visualization Handler
  const handleVisualizeCode = async (overrideCode?: string, overrideLang?: string, overrideInput?: string) => {
    const langToViz = (overrideLang !== undefined ? overrideLang : language).toLowerCase();
    const codeToViz = overrideCode !== undefined ? overrideCode : currentCode;
    const inputToUse = overrideInput !== undefined ? overrideInput : stdin;

    setIsVisualizing(true);
    setVisualization('Generating diagram...');

    try {
      // 1. Run client-side execution to capture step-by-step variables and frames
      const clientRes = await executeCodeClient(langToViz, codeToViz, inputToUse);
      setClientExecutionResult(clientRes);

      if (clientRes.status !== 'success') {
        const mistakeReport = diagnoseCodeMistake(langToViz, codeToViz, clientRes.stderr, clientRes.stdout);
        if (mistakeReport.lineNumber) {
          highlightErrorLine(mistakeReport.lineNumber);
        }
        setOutput(mistakeReport.terminalOutput);
        const initialExplanation: AIErrorExplanation = {
          problem: mistakeReport.mistakeTitle,
          explanation: `Line ${mistakeReport.lineNumber || '?'}: ${mistakeReport.mistakeDescription}`,
          solution: mistakeReport.expectedInCode,
          corrected_code: mistakeReport.suggestedFixSnippet,
          suggestedFix: mistakeReport.suggestedFixSnippet,
          lineNumber: mistakeReport.lineNumber,
          offendingLine: mistakeReport.offendingLine,
          language: langToViz,
        };
        setErrorExplanation(initialExplanation);

        // Query backend AI debug endpoint for enhanced Gemini explanation
        axios.post(`${API_URL}/ai/debug`, {
          language: langToViz,
          code: codeToViz,
          error: clientRes.stderr,
        }, { headers: authHeaders() }).then((aiRes) => {
          if (aiRes.data && (aiRes.data.problem || aiRes.data.explanation)) {
            setErrorExplanation((prev) => prev ? ({
              ...prev,
              problem: aiRes.data.problem || prev.problem,
              explanation: aiRes.data.explanation || prev.explanation,
              solution: aiRes.data.solution || prev.solution,
              corrected_code: aiRes.data.corrected_code || prev.corrected_code,
              fullCorrectedCode: aiRes.data.corrected_code,
            }) : null);
          }
        }).catch(() => {});
      } else {
        highlightErrorLine(null);
        setErrorExplanation(null);
      }

      // 2. Try backend AI flowchart; fallback to 100% client-side flowchart generator
      try {
        const response = await axios.post(
          `${API_URL}/ai/visualize`,
          {
            language: langToViz,
            code: codeToViz,
            problem_id: activeProblem?.id || null,
          },
          { headers: authHeaders() }
        );
        const chartRes = response.data.explanation || '';
        setVisualization(chartRes || generateClientFlowchart(codeToViz, langToViz));
      } catch {
        // 100% client-side fallback flowchart
        setVisualization(generateClientFlowchart(codeToViz, langToViz));
      }

      if (settings.notifyAIExplanationReady) {
        addToast('ai', 'AI Explanation Ready', 'AI Tutor finished generating the execution timeline and flowchart.');
      }

      // Record visualization_completed in MongoDB activities
      const elapsedVizSec = Math.max(60, Math.round((Date.now() - sessionStartRef.current) / 1000));
      sessionStartRef.current = Date.now();

      await recordUserActivity({
        activity_type: 'visualization_completed',
        title: `Visualized ${langToViz.toUpperCase()} Program`,
        description: `Generated step-by-step execution timeline for ${langToViz}.`,
        language: langToViz,
        program_name: activeProblem ? activeProblem.title : `${langToViz.toUpperCase()} Program`,
        topic: activeProblem?.category || undefined,
        status: 'completed',
        duration_seconds: elapsedVizSec,
        metadata_json: {
          source_code: codeToViz,
          program_id: activeProblem?.id || null,
        },
      });
    } catch (error: any) {
      setVisualization(generateClientFlowchart(codeToViz, langToViz));
    } finally {
      setIsVisualizing(false);
    }
  };

  const monacoOptions = useMemo(() => ({
    minimap: { enabled: settings.showMinimap },
    fontSize: settings.editorFontSize,
    fontFamily: `'${settings.editorFontFamily}', 'Fira Code', monospace`,
    lineNumbers: (settings.showLineNumbers ? 'on' : 'off') as 'on' | 'off',
    wordWrap: (settings.wordWrap ? 'on' : 'off') as 'on' | 'off',
    tabSize: settings.tabSize,
    padding: { top: 20 },
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    cursorBlinking: 'smooth' as const,
  }), [settings.showMinimap, settings.editorFontSize, settings.editorFontFamily, settings.showLineNumbers, settings.wordWrap, settings.tabSize]);

  // Dynamically update Monaco when editorFontSize or editorFontFamily changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        fontSize: settings.editorFontSize,
        fontFamily: `'${settings.editorFontFamily}', 'Fira Code', monospace`,
      });
      if (document.fonts) {
        document.fonts.ready.then(() => {
          editorRef.current?.layout();
        });
      }
    }
  }, [settings.editorFontSize, settings.editorFontFamily]);

  // Auto-run or auto-visualize if triggered via navigation from Dashboard
  useEffect(() => {
    if (routerState?.triggerRun) {
      const code = routerState.code || currentCode;
      const lang = routerState.language || language;
      const timer = setTimeout(() => {
        handleRunCode(code, lang);
      }, 350);
      return () => clearTimeout(timer);
    } else if (routerState?.triggerVisualize) {
      const code = routerState.code || currentCode;
      const lang = routerState.language || language;
      const timer = setTimeout(() => {
        handleVisualizeCode(code, lang);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, []);

  const [isSaved, setIsSaved] = useState(false);
  const handleSaveCode = async () => {
    const langConfig = getLanguageConfig(language);
    const codeToSave = currentCode;

    // Ask the user for a meaningful program name
    const defaultName = activeProblem
      ? `${activeProblem.title} — ${langConfig.label}`
      : `${langConfig.label} — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;

    const userInput = window.prompt(
      `💾 Save ${langConfig.label} Program\n\nEnter a name for this program:`,
      defaultName
    );

    // User cancelled the prompt
    if (userInput === null) return;

    const title = userInput.trim() || defaultName;
    const outputText = output || (clientExecutionResult?.stdout ? clientExecutionResult.stdout : '');
    const programStatus = clientExecutionResult?.status || 'completed';
    const programDescription = activeProblem
      ? activeProblem.description
      : `${langConfig.label} program with ${codeToSave.split('\n').length} lines of code.`;

    try {
      // Save program to MongoDB programs collection (works for Python, Java, C, C++)
      await axios.post(`${API_URL}/programs`, {
        name: title,
        language,           // 'python' | 'java' | 'c' | 'cpp'
        code: codeToSave,
        description: programDescription,
        output: outputText,
        status: programStatus,
      }, { headers: authHeaders() });

      // Record program_saved activity in MongoDB activities collection
      const elapsedSaveSec = Math.max(30, Math.round((Date.now() - sessionStartRef.current) / 1000));
      sessionStartRef.current = Date.now();

      await recordUserActivity({
        activity_type: 'program_saved',
        title: `Saved ${langConfig.label} Program`,
        description: `Saved "${title}" to your programs library.`,
        language,
        program_name: title,
        topic: activeProblem?.category || undefined,
        status: programStatus,
        duration_seconds: elapsedSaveSec,
        metadata_json: {
          source_code: codeToSave,
          extension: langConfig.extension,
          output: outputText,
          problem_id: activeProblem?.id || null,
        },
      });
    } catch {
      // fallback: still mark saved locally
    }

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleReset = () => {
    const template = activeProblem?.starterCode[language] || getDefaultStarterCode(language);
    setCodeByLanguage((prev) => ({
      ...prev,
      [language]: template,
    }));
    setOutput('');
    setVisualization('');
    setClientExecutionResult(null);
    highlightLine(null);
  };

  const handleFormatCode = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-900 text-slate-300">
      {/* Editor Top Bar */}
      <div className="h-14 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          {/* Language Selector */}
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-sm text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
          >
            {Object.values(SUPPORTED_LANGUAGES).map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label} ({lang.extension})
              </option>
            ))}
          </select>

          {/* Mode Indicator */}
          {activeProblem ? (
            <div className="flex items-center gap-2 px-2.5 py-1 bg-indigo-950/60 border border-indigo-700/40 rounded-lg text-xs">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-semibold text-indigo-300">{activeProblem.title}</span>
              <button
                onClick={() => setActiveProblem(null)}
                title="Switch to Free Coding Mode"
                className="ml-1 text-slate-400 hover:text-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>
          ) : null}

          {/* Typography quick control */}
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 bg-slate-800/80 border border-slate-700/80 rounded-lg text-xs text-slate-300">
            <span className="text-[11px] font-mono text-slate-400 truncate max-w-[90px]" title={`Current Font: ${settings.editorFontFamily}`}>
              {settings.editorFontFamily.split(' ')[0]}
            </span>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => settings.editorFontSize > 10 && updateSetting('editorFontSize', settings.editorFontSize - 1)}
              disabled={settings.editorFontSize <= 10}
              className="hover:text-white px-1 text-[11px] disabled:opacity-30 cursor-pointer font-bold transition-colors"
              title="Decrease Font Size"
            >
              A−
            </button>
            <span className="font-mono text-[11px] font-semibold" style={{ color: 'var(--accent-color, #818cf8)' }}>
              {settings.editorFontSize}px
            </span>
            <button
              onClick={() => settings.editorFontSize < 28 && updateSetting('editorFontSize', settings.editorFontSize + 1)}
              disabled={settings.editorFontSize >= 28}
              className="hover:text-white px-1 text-[11px] disabled:opacity-30 cursor-pointer font-bold transition-colors"
              title="Increase Font Size"
            >
              A+
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleFormatCode}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors text-xs text-slate-300 border border-slate-700 cursor-pointer"
            title="Format Code"
          >
            <Code className="w-3.5 h-3.5 text-slate-400" /> Format
          </button>
          <button
            onClick={handleSaveCode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-xs cursor-pointer ${
              isSaved
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            {isSaved ? 'Saved!' : 'Save'}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors text-xs text-slate-300 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button
            onClick={() => handleVisualizeCode()}
            disabled={isVisualizing || isRunning}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white rounded-lg transition-colors text-xs font-semibold shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <Bug className="w-3.5 h-3.5" />
            {isVisualizing ? 'Debugging...' : 'Debug & Visualize'}
          </button>
          <button
            onClick={() => handleRunCode()}
            disabled={isRunning || isVisualizing}
            className="flex items-center gap-1.5 px-4 py-1.5 text-white rounded-lg transition-all text-xs font-semibold shadow-md cursor-pointer accent-bg"
            style={{
              backgroundColor: 'var(--accent-color, #06b6d4)',
              boxShadow: '0 2px 12px rgba(var(--accent-color-rgb, 6, 182, 212), 0.35)',
            }}
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            {isRunning ? 'Executing...' : 'Run Code'}
          </button>
          {/* Toggle Visualizer Panel */}
          <button
            onClick={() => setShowViz((v) => !v)}
            title={showViz ? 'Hide Visualizer (full-width editor)' : 'Show Visualizer'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors text-xs text-slate-300 cursor-pointer"
          >
            {showViz ? '◀ Hide Panel' : '▶ Show Panel'}
          </button>
        </div>
      </div>
      {/* Main Resizable Panel Section */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* Left Column: Monaco Editor + LeetCode-Style Console Footer */}
        <div className="flex-1 flex flex-col min-w-0" style={{ minWidth: showViz ? 300 : 0 }}>

          {/* Monaco Editor */}
          <div className="flex-1 relative border-b border-slate-800">
            <Editor
              height="100%"
              language={settings.syntaxHighlighting ? getMonacoLanguage(language) : 'plaintext'}
              theme={resolvedTheme === 'light' ? 'vs' : 'vs-dark'}
              value={currentCode}
              onChange={handleEditorChange}
              onMount={(editor) => {
                editorRef.current = editor;
              }}
              options={monacoOptions}
            />
          </div>

          {/* ── LeetCode-Style Unified Console Footer ── */}
          <div
            className="flex flex-col bg-slate-950 border-t border-slate-800 flex-shrink-0"
            style={{ height: consoleCollapsed ? 38 : consoleHeight }}
          >
            {/* Drag-to-Resize Handle */}
            <div
              onMouseDown={handleConsoleResizeStart}
              className="flex items-center justify-center h-2.5 bg-slate-900/80 hover:bg-indigo-900/30 cursor-row-resize group border-b border-slate-800 transition-colors flex-shrink-0"
              title="Drag to resize console"
            >
              <GripHorizontal className="w-4 h-3 text-slate-600 group-hover:text-indigo-400 transition-colors" />
            </div>

            {/* Console Header Bar */}
            <div className="h-9 flex items-center justify-between px-4 bg-slate-900/90 border-b border-slate-800 flex-shrink-0">
              {/* Left: Label + Execution Status Badge */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-bold tracking-widest text-slate-300 uppercase">Console</span>
                </div>

                {clientExecutionResult && (
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                      clientExecutionResult.status === 'success'
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                        : clientExecutionResult.status === 'timeout'
                        ? 'bg-amber-950/60 text-amber-400 border border-amber-800/50'
                        : 'bg-rose-950/60 text-rose-400 border border-rose-800/50'
                    }`}>
                      {clientExecutionResult.status === 'success' ? '✓ Accepted' : clientExecutionResult.status === 'timeout' ? '⏱ TLE' : '✗ Error'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {clientExecutionResult.executionTimeMs} ms &nbsp;|&nbsp; {clientExecutionResult.memoryUsedKb || 512} KB
                    </span>
                  </div>
                )}
              </div>

              {/* Right: Run / Clear / Collapse */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRunCode(undefined, undefined, stdin)}
                  disabled={isRunning || isVisualizing}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-50"
                  style={{
                    background: 'var(--accent-color, #06b6d4)',
                    boxShadow: '0 1px 8px rgba(6,182,212,0.25)',
                  }}
                  title="Run code with the custom input on the left"
                >
                  <Play className="w-3 h-3 fill-white" />
                  {isRunning ? 'Running...' : 'Run'}
                </button>

                {output && (
                  <button
                    onClick={() => { setOutput(''); setClientExecutionResult(null); setErrorExplanation(null); }}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 transition-colors cursor-pointer"
                    title="Clear console output"
                  >
                    <Trash2 className="w-3 h-3" /> Clear
                  </button>
                )}

                <button
                  onClick={() => setConsoleCollapsed(c => !c)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                  title={consoleCollapsed ? 'Expand console' : 'Collapse console'}
                >
                  {consoleCollapsed
                    ? <ChevronUp className="w-3.5 h-3.5" />
                    : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Console Body: Custom Input (left) | Output (right) */}
            {!consoleCollapsed && (
              <div className="flex flex-1 min-h-0 overflow-hidden">

                {/* ── Custom Input Pane ── */}
                <div className="flex flex-col border-r border-slate-800" style={{ width: '34%', minWidth: 160 }}>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 border-b border-slate-800/60 flex-shrink-0">
                    <Keyboard className="w-3 h-3 text-violet-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Custom Input</span>
                    {stdin.trim().length > 0 && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                    )}
                  </div>
                  <textarea
                    value={stdin}
                    onChange={(e) => setStdin(e.target.value)}
                    placeholder={`Enter stdin here:\ne.g.\n5\nhello world`}
                    spellCheck={false}
                    className="flex-1 w-full bg-transparent text-slate-200 p-3 text-xs focus:outline-none resize-none placeholder-slate-600"
                    style={{
                      fontFamily: `'${settings.editorFontFamily}', 'Fira Code', monospace`,
                      fontSize: `${Math.max(11, settings.editorFontSize - 2)}px`,
                    }}
                  />
                </div>

                {/* ── Console Output Pane ── */}
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 border-b border-slate-800/60 flex-shrink-0">
                    <Terminal className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Output</span>
                  </div>
                  <div
                    className="flex-1 overflow-y-auto p-3"
                    style={{
                      fontFamily: `'${settings.editorFontFamily}', 'Fira Code', monospace`,
                      fontSize: `${Math.max(11, settings.editorFontSize - 2)}px`,
                    }}
                  >
                    {output ? (
                      <pre
                        className="whitespace-pre-wrap leading-relaxed text-slate-200"
                        style={{ lineHeight: 1.6 }}
                        dangerouslySetInnerHTML={{
                          __html: output
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/(✓[^\n]*)/g, '<span style="color:#34d399">$1</span>')
                            .replace(/(⏱[^\n]*|Timed Out[^\n]*)/g, '<span style="color:#fbbf24">$1</span>')
                            .replace(/(✗[^\n]*|Error[^\n]*|Traceback[^\n]*|Exception[^\n]*)/g, '<span style="color:#f87171">$1</span>')
                            .replace(/(\[AI Auto-Fix Applied\][^\n]*)/g, '<span style="color:#a78bfa">$1</span>')
                            .replace(/(⚙[^\n]*)/g, '<span style="color:#94a3b8">$1</span>')
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                        <Terminal className="w-6 h-6 text-slate-700" />
                        <p className="text-slate-500 text-xs">Output will appear here after running your code.</p>
                        <p className="text-slate-600 text-[10px]">Use the <span className="text-slate-400 font-semibold">Custom Input</span> pane on the left to provide stdin.</p>
                      </div>
                    )}

                    {/* AI Error Diagnostician Panel */}
                    {errorExplanation && (
                      <div className="mt-3 p-3 rounded-xl border border-rose-500/30 bg-rose-950/10 text-xs space-y-2.5 relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500" />

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-700/50 uppercase tracking-wider flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-rose-400" /> AI Diagnostician
                            </span>
                            {errorExplanation.lineNumber && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300 font-mono text-[10px] font-bold">
                                Line {errorExplanation.lineNumber}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleApplyFix(false)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/25 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-200 text-[11px] font-medium transition cursor-pointer"
                            >
                              <Wand2 className="w-3 h-3 text-indigo-400" /> Apply Fix
                            </button>
                            <button
                              onClick={() => handleApplyFix(true)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white text-[11px] font-semibold transition cursor-pointer"
                            >
                              <Play className="w-3 h-3 fill-current" /> Fix &amp; Re-run
                            </button>
                          </div>
                        </div>

                        <div>
                          <p className="font-bold text-rose-300">{errorExplanation.problem}</p>
                          <p className="text-slate-300 leading-relaxed font-sans mt-0.5 text-[11px]">{errorExplanation.explanation}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 font-mono text-[10px]">
                          {errorExplanation.offendingLine && (
                            <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-800/40">
                              <span className="text-[9px] uppercase font-bold text-rose-400 block mb-1">❌ Mistake (Line {errorExplanation.lineNumber || '?'}):</span>
                              <code className="text-rose-200 break-all">{errorExplanation.offendingLine.trim()}</code>
                            </div>
                          )}
                          {(errorExplanation.suggestedFix || errorExplanation.corrected_code) && (
                            <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-800/40">
                              <span className="text-[9px] uppercase font-bold text-emerald-400 block mb-1">✅ AI Fix:</span>
                              <code className="text-emerald-200 break-all">{(errorExplanation.suggestedFix || errorExplanation.corrected_code)?.trim()}</code>
                            </div>
                          )}
                        </div>

                        {errorExplanation.solution && (
                          <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 font-sans text-[11px]">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-indigo-400 block mb-0.5">Expected in Code:</span>
                            {errorExplanation.solution}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>




        {/* Drag Handle */}
        {showViz && (
          <div
            onMouseDown={handleDragStart}
            className="w-1.5 flex-shrink-0 bg-slate-800 hover:bg-indigo-500/60 cursor-col-resize transition-colors relative group"
            title="Drag to resize panels"
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-slate-600 group-hover:bg-indigo-400 transition-colors" />
          </div>
        )}

        {/* Right Column: Execution Visualizer Panel */}
        {showViz && (
          <div
            style={{ width: vizWidth, minWidth: 280, maxWidth: 'calc(100% - 300px)' }}
            className="visualizer-panel flex-shrink-0 border-l border-slate-800 bg-slate-950 flex flex-col p-2"
          >
            <VisualizerPanel
              executionResult={clientExecutionResult}
              mermaidChart={visualization}
              onCurrentLineChange={highlightLine}
              language={language}
              code={currentCode}
              errorExplanation={errorExplanation}
              onApplyFix={handleApplyFix}
            />
          </div>
        )}
      </div>

      {/* ── In-App Notifications Toast Stack ── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-xl ${
                toast.type === 'success'
                  ? 'bg-slate-900/95 border-emerald-500/40 text-emerald-300 shadow-emerald-950/20'
                  : toast.type === 'error'
                  ? 'bg-slate-900/95 border-rose-500/40 text-rose-300 shadow-rose-950/20'
                  : toast.type === 'ai'
                  ? 'bg-slate-900/95 border-indigo-500/40 text-indigo-300 shadow-indigo-950/20'
                  : 'bg-slate-900/95 border-amber-500/40 text-amber-300 shadow-amber-950/20'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                {toast.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400" />}
                {toast.type === 'ai' && <Sparkles className="w-4 h-4 text-indigo-400" />}
                {toast.type === 'info' && <Save className="w-4 h-4 text-amber-400" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white">{toast.title}</p>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">{toast.message}</p>
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="text-slate-400 hover:text-white transition-colors p-0.5 shrink-0 cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
