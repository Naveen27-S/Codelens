import { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { Play, RotateCcw, Save, Sparkles, Terminal, Keyboard, Code, Bug } from 'lucide-react';
import axios from 'axios';
import { useSettings } from '../context/SettingsContext';
import { recordUserActivity } from '../services/dashboardService';
import { SUPPORTED_LANGUAGES, getLanguageConfig, getDefaultStarterCode, getMonacoLanguage } from '../config/languageConfig';
import { getProblemById, type CodingProblem } from '../config/problemConfig';
import { executeCodeClient } from '../services/runners/clientExecutionService';
import { generateClientFlowchart } from '../services/flowchartGenerator';
import type { ExecutionResult } from '../types/execution';
import { VisualizerPanel } from '../components/visualizer/VisualizerPanel';
import { diagnoseCodeMistake } from '../services/codeMistakeDiagnostician';

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
          duration_seconds: 0,
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
  const [errorExplanation, setErrorExplanation] = useState<{problem: string; explanation: string; solution: string; corrected_code?: string} | null>(null);
  const [stdin, setStdin] = useState(() => routerState?.input || '');
  const [visualization, setVisualization] = useState(() => routerState?.visualization || '');
  const [clientExecutionResult, setClientExecutionResult] = useState<ExecutionResult | null>(null);

  const [activeTab, setActiveTab] = useState<'output' | 'input' | 'visualization'>(() => {
    return routerState?.activeTab || 'output';
  });

  const [isRunning, setIsRunning] = useState(false);
  const [isVisualizing, setIsVisualizing] = useState(false);

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
      trimmed === '# Write your Python code here' ||
      trimmed === 'public class Main {\n    public static void main(String[] args) {\n        // Write your Java code here\n    }\n}' ||
      trimmed === '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your C++ code here\n    return 0;\n}' ||
      trimmed === '#include <stdio.h>\n\nint main() {\n    // Write your C code here\n    return 0;\n}'
    );
  };

  const rawCode = codeByLanguage[language];
  const currentCode = (rawCode !== undefined && !isLegacyPlaceholder(rawCode))
    ? rawCode 
    : (activeProblem?.starterCode[language] || getDefaultStarterCode(language));

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

  // 100% Client-Side Execution Handler
  const handleRunCode = async (overrideCode?: string, overrideLang?: string, overrideInput?: string) => {
    const langToRun = (overrideLang !== undefined ? overrideLang : language).toLowerCase();
    const codeToRun = overrideCode !== undefined ? overrideCode : currentCode;
    const inputToUse = overrideInput !== undefined ? overrideInput : stdin;

    setIsRunning(true);
    if (settings.clearTerminalBeforeRun) setOutput('');
    setErrorExplanation(null);
    setActiveTab('output');
    setOutput('⚙ Executing in-browser...');

    try {
      // 1. Run 100% Client-Side in Browser (Pyodide Wasm / Worker / JSCPP)
      const clientRes = await executeCodeClient(langToRun, codeToRun, inputToUse);
      setClientExecutionResult(clientRes);

      // Generate visual flowchart automatically for Visualizer Panel
      const chart = generateClientFlowchart(codeToRun, langToRun);
      setVisualization(chart);

      if (clientRes.status === 'success') {
        const memoryStr = clientRes.memoryUsedKb ? ` | Memory: ~${clientRes.memoryUsedKb} KB` : '';
        setOutput((clientRes.stdout || 'Execution completed cleanly (no stdout output)') + `\n\n✓ In-Browser Execution Completed\nTime: ${clientRes.executionTimeMs} ms${memoryStr}`);
        setErrorExplanation(null);
        highlightErrorLine(null);
      } else if (clientRes.status === 'timeout') {
        setOutput(`⏱ Execution Timed Out (5s limit)\n${clientRes.stderr}`);
        setErrorExplanation({
          problem: 'Execution Timeout',
          explanation: 'The program exceeded the 5-second execution limit. This usually indicates an infinite loop.',
          solution: 'Check your loop termination conditions (e.g. while or for loops).',
        });
      } else {
        const mistakeReport = diagnoseCodeMistake(langToRun, codeToRun, clientRes.stderr, clientRes.stdout);
        if (mistakeReport.lineNumber) {
          highlightErrorLine(mistakeReport.lineNumber);
        }
        setOutput(mistakeReport.terminalOutput);
        setErrorExplanation({
          problem: mistakeReport.mistakeTitle,
          explanation: `Line ${mistakeReport.lineNumber || '?'}: ${mistakeReport.mistakeDescription}`,
          solution: mistakeReport.expectedInCode,
          corrected_code: mistakeReport.suggestedFixSnippet,
        });
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
        // 2. Also explicitly record a code_execution activity
        await recordUserActivity({
          activity_type: 'code_execution',
          title: `Ran ${langConfig.label} Program`,
          description: `Executed ${langToRun} code (${clientRes.status}).`,
          language: langToRun,
          program_name: programTitle,
          topic: activeProblem?.category || null,
          status: clientRes.status === 'success' ? 'completed' : 'error',
          duration_seconds: clientRes.executionTimeMs ? clientRes.executionTimeMs / 1000 : 0.5,
          metadata_json: {
            execution_status: clientRes.status,
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
    setActiveTab('visualization');
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
        setErrorExplanation({
          problem: mistakeReport.mistakeTitle,
          explanation: `Line ${mistakeReport.lineNumber || '?'}: ${mistakeReport.mistakeDescription}`,
          solution: mistakeReport.expectedInCode,
          corrected_code: mistakeReport.suggestedFixSnippet,
        });
        setActiveTab('output');
      } else {
        highlightErrorLine(null);
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

      // Record visualization_completed in MongoDB activities
      await recordUserActivity({
        activity_type: 'visualization_completed',
        title: `Visualized ${langToViz.toUpperCase()} Program`,
        description: `Generated step-by-step execution timeline for ${langToViz}.`,
        language: langToViz,
        program_name: activeProblem ? activeProblem.title : `${langToViz.toUpperCase()} Program`,
        topic: activeProblem?.category || null,
        status: 'completed',
        duration_seconds: 10,
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
      await recordUserActivity({
        activity_type: 'program_saved',
        title: `Saved ${langConfig.label} Program`,
        description: `Saved "${title}" to your programs library.`,
        language,
        program_name: title,
        topic: activeProblem?.category || null,
        status: programStatus,
        duration_seconds: 5,
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
        {/* Left Column: Monaco Editor + Console Terminal */}
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

          {/* Bottom Console Terminal */}
          <div className="h-[220px] bg-slate-950 flex flex-col">
            <div className="h-9 border-b border-slate-800 flex items-center bg-slate-900 px-4 justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('output')}
                  className="text-xs font-semibold tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
                  style={{
                    color: activeTab === 'output' ? 'var(--accent-color, #06b6d4)' : undefined,
                    fontWeight: activeTab === 'output' ? 700 : 500,
                  }}
                >
                  <Terminal className="w-3.5 h-3.5" /> CONSOLE OUTPUT
                </button>
                <button
                  onClick={() => setActiveTab('input')}
                  className="text-xs font-semibold tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
                  style={{
                    color: activeTab === 'input' ? 'var(--accent-color, #8b5cf6)' : undefined,
                    fontWeight: activeTab === 'input' ? 700 : 500,
                  }}
                >
                  <Keyboard className="w-3.5 h-3.5" /> INPUT ARGS / STDIN
                  {stdin.trim().length > 0 && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--accent-color, #8b5cf6)' }} />}
                </button>
              </div>

              {clientExecutionResult && (
                <span className="text-[11px] font-mono text-slate-400">
                  {clientExecutionResult.executionTimeMs} ms | {clientExecutionResult.memoryUsedKb || 512} KB
                </span>
              )}
            </div>

            <div
              className="flex-1 p-3 text-slate-300 overflow-y-auto"
              style={{
                fontFamily: `'${settings.editorFontFamily}', 'Fira Code', monospace`,
                fontSize: `${Math.max(11, settings.editorFontSize - 1)}px`,
              }}
            >
              {activeTab === 'output' && (
                <div>
                  {output ? (
                    <pre className="whitespace-pre-wrap leading-relaxed">{output}</pre>
                  ) : (
                    <span className="text-slate-500 italic">Click "Run Code" or "Debug & Visualize" to execute code in browser.</span>
                  )}
                  {errorExplanation && (
                    <div className="mt-3 p-3.5 rounded-lg border border-rose-500/40 bg-rose-950/40 text-xs space-y-2 backdrop-blur-sm shadow-xl">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-900/80 text-rose-300 border border-rose-700/60 uppercase tracking-wider">
                          Mistake Detected
                        </span>
                        <p className="font-bold text-rose-200 text-xs">{errorExplanation.problem}</p>
                      </div>
                      <p className="text-slate-200 leading-relaxed font-sans">{errorExplanation.explanation}</p>
                      {errorExplanation.solution && (
                        <div className="p-2 rounded bg-slate-900/90 border border-slate-800 text-emerald-300 font-sans">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400 block mb-0.5">Expected in Code:</span>
                          {errorExplanation.solution}
                        </div>
                      )}
                      {errorExplanation.corrected_code && (
                        <div className="p-2 rounded bg-slate-950/90 border border-slate-800 text-[11px] font-mono text-cyan-300">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5 font-sans">Suggested Line:</span>
                          <code>{errorExplanation.corrected_code}</code>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'input' && (
                <div className="flex flex-col h-full gap-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Enter input arguments below (space or newline separated):</span>
                    <button
                      onClick={() => handleRunCode(undefined, undefined, stdin)}
                      disabled={isRunning}
                      className="px-2.5 py-1 text-white rounded font-sans font-semibold text-xs transition cursor-pointer shadow-sm accent-bg"
                      style={{
                        backgroundColor: 'var(--accent-color, #8b5cf6)',
                      }}
                    >
                      Run with Input
                    </button>
                  </div>
                  <textarea
                    value={stdin}
                    onChange={(e) => setStdin(e.target.value)}
                    placeholder="Example input arguments:&#10;10&#10;20&#10;(or 10 20 on one line)"
                    className="flex-1 w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-indigo-500 resize-none"
                    style={{
                      fontFamily: `'${settings.editorFontFamily}', 'Fira Code', monospace`,
                      fontSize: `${Math.max(11, settings.editorFontSize - 1)}px`,
                    }}
                  />
                </div>
              )}
            </div>
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
            />
          </div>
        )}
      </div>
    </div>
  );
}
