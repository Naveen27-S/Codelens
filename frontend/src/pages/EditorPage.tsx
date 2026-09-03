import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { Play, RotateCcw, Save, Eye, Sparkles, Terminal, Keyboard } from 'lucide-react';
import axios from 'axios';
import { MermaidViewer } from '../components/MermaidViewer';
import { useSettings } from '../context/SettingsContext';
import { recordUserActivity } from '../services/dashboardService';
import { SUPPORTED_LANGUAGES, getLanguageConfig, getDefaultStarterCode, getMonacoLanguage } from '../config/languageConfig';
import { getProblemById, type CodingProblem } from '../config/problemConfig';

export function EditorPage() {
  const { settings } = useSettings();
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

  // Active coding problem (Mode B: Practice Problem) if provided
  const [activeProblem, setActiveProblem] = useState<CodingProblem | null>(() => {
    if (routerState?.problemId) {
      return getProblemById(routerState.problemId) || null;
    }
    return null;
  });

  const [language, setLanguage] = useState<string>(() => {
    if (routerState?.language) return routerState.language.toLowerCase();
    return (settings.defaultLanguage || 'python').toLowerCase();
  });

  // Per-language code buffer to preserve user edits during session
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
  const [stdin, setStdin] = useState(() => {
    return routerState?.input || '';
  });
  const [visualization, setVisualization] = useState(() => {
    return routerState?.visualization || '';
  });

  const [activeTab, setActiveTab] = useState<'output' | 'input' | 'visualization'>(() => {
    return routerState?.activeTab || 'output';
  });

  const [isRunning, setIsRunning] = useState(false);
  const [isVisualizing, setIsVisualizing] = useState(false);

  // Active code for the currently selected language
  const currentCode = codeByLanguage[language] !== undefined 
    ? codeByLanguage[language] 
    : (activeProblem?.starterCode[language] || getDefaultStarterCode(language));

  // Smart input detection in user code
  const hasInputDetection = (() => {
    const code = currentCode;
    return (
      code.includes('Scanner') ||
      code.includes('BufferedReader') ||
      code.includes('input(') ||
      code.includes('scanf(') ||
      code.includes('cin >>') ||
      code.includes('cin>>')
    );
  })();

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

    // If new language has not been initialized in session, populate with template
    setCodeByLanguage((prev) => {
      if (prev[normalized] !== undefined) {
        return prev;
      }
      const starter = activeProblem?.starterCode[normalized] || getDefaultStarterCode(normalized);
      return {
        ...prev,
        [normalized]: starter,
      };
    });
  };

  const handleRunCode = async (overrideCode?: string, overrideLang?: string) => {
    const langToRun = (overrideLang !== undefined ? overrideLang : language).toLowerCase();
    const codeToRun = overrideCode !== undefined 
      ? overrideCode 
      : (codeByLanguage[langToRun] || getDefaultStarterCode(langToRun));

    setIsRunning(true);
    if (settings.clearTerminalBeforeRun) setOutput('');
    setActiveTab('output');
    setOutput('Running...');

    const slowWarnTimer = setTimeout(() => {
      setOutput((prev) => (prev === 'Running...' ? 'Execution is taking longer than expected...' : prev));
    }, 7000);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const langConfig = getLanguageConfig(langToRun);
      const programTitle = activeProblem ? activeProblem.title : `${langConfig.label} Program`;

      const response = await axios.post(`${apiUrl}/execute`, {
        language: langToRun,
        code: codeToRun,
        input: stdin,
        program_name: programTitle,
        program_id: activeProblem?.id || null,
      }, { withCredentials: true });

      const { status, stdout, stderr, execution_time } = response.data;

      let displayOutput = '';
      if (status === 'success') {
        displayOutput = (stdout || 'No output') + `\n\nExecution completed\nTime: ${execution_time}s`;
      } else if (status === 'compilation_error') {
        displayOutput = `Compilation Error:\n${stderr || 'Unknown compiler error'}`;
      } else if (status === 'runtime_error') {
        displayOutput = `${stdout || ''}\nRuntime Error:\n${stderr || 'Unknown runtime error'}`;
      } else if (status === 'timeout') {
        displayOutput = `Execution Timed Out\n${stderr || 'Execution timed out.'}`;
      } else {
        displayOutput = `Execution Error:\n${stderr || 'An unknown error occurred during execution'}`;
      }

      setOutput(displayOutput);
      if (settings.openTerminalAfterExecution) setActiveTab('output');
    } catch (error: any) {
      clearTimeout(slowWarnTimer);
      if (error.response && error.response.status === 401) {
        setOutput('Unable to execute: Unauthenticated request. 401 Unauthorized.');
      } else {
        setOutput(error.response?.data?.detail || error.message || 'Unable to connect to CodeLens execution server.');
      }
    } finally {
      clearTimeout(slowWarnTimer);
      setIsRunning(false);
    }
  };

  const handleVisualizeCode = async (overrideCode?: string, overrideLang?: string) => {
    const langToViz = (overrideLang !== undefined ? overrideLang : language).toLowerCase();
    const codeToViz = overrideCode !== undefined 
      ? overrideCode 
      : (codeByLanguage[langToViz] || getDefaultStarterCode(langToViz));

    setIsVisualizing(true);
    setActiveTab('visualization');
    setVisualization('Generating diagram...');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const response = await axios.post(
        `${apiUrl}/ai/visualize`,
        {
          language: langToViz,
          code: codeToViz,
          problem_id: activeProblem?.id || null,
        },
        { withCredentials: true }
      );
      const explanation = response.data.explanation || '';
      setVisualization(explanation);

      recordUserActivity({
        activity_type: 'visualization_completed',
        title: `Visualized ${langToViz.toUpperCase()} Algorithm`,
        description: `Generated execution flowchart and call stack for ${langToViz} program.`,
        language: langToViz,
        program_name: activeProblem ? activeProblem.title : `${langToViz.toUpperCase()} Algorithm`,
        status: 'completed',
        duration_seconds: 45,
        metadata_json: { source_code: codeToViz, mermaid_explanation: explanation, problem_id: activeProblem?.id },
      });
    } catch (error: any) {
      setVisualization(`Error generating diagram: ${error.message}`);
    } finally {
      setIsVisualizing(false);
    }
  };

  const lastStateKeyRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (location.key !== lastStateKeyRef.current) {
      lastStateKeyRef.current = location.key;

      if (routerState) {
        let currentProblem: CodingProblem | null = null;
        if (routerState.problemId) {
          currentProblem = getProblemById(routerState.problemId) || null;
          setActiveProblem(currentProblem);
        }

        const initialLang = (routerState.language || language).toLowerCase();
        setLanguage(initialLang);

        let codeToSet = '';
        if (routerState.code !== undefined) {
          codeToSet = routerState.code;
        } else if (currentProblem) {
          codeToSet = currentProblem.starterCode[initialLang] || getDefaultStarterCode(initialLang);
        } else {
          codeToSet = getDefaultStarterCode(initialLang);
        }

        setCodeByLanguage((prev) => ({
          ...prev,
          [initialLang]: codeToSet,
        }));

        if (routerState.input !== undefined) {
          setStdin(routerState.input);
        }
        if (routerState.visualization !== undefined) {
          setVisualization(routerState.visualization);
        }
        if (routerState.activeTab !== undefined) {
          setActiveTab(routerState.activeTab);
        }

        if (routerState.triggerRun) {
          handleRunCode(codeToSet, initialLang);
        } else if (routerState.triggerVisualize || routerState.triggerAITutor) {
          handleVisualizeCode(codeToSet, initialLang);
        }
      }
    }
  }, [location.key, routerState]);

  // Derive Monaco options from settings
  const monacoOptions = {
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
  };

  const [isSaved, setIsSaved] = useState(false);
  const handleSaveCode = async () => {
    const langConfig = getLanguageConfig(language);
    const codeToSave = currentCode;
    const title = activeProblem ? `${activeProblem.title} (${langConfig.label})` : `${langConfig.label} Program`;

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      await axios.post(`${apiUrl}/programs`, {
        name: title,
        language,
        extension: langConfig.extension,
        code: codeToSave,
      });
    } catch {
      // fallback
    }

    recordUserActivity({
      activity_type: 'program_saved',
      title: `Saved ${langConfig.label} Program`,
      description: `Saved ${langConfig.label} snippet in workspace.`,
      language,
      program_name: title,
      status: 'completed',
      metadata_json: { source_code: codeToSave, extension: langConfig.extension },
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleReset = () => {
    // Reset ONLY the currently active language's template
    const template = activeProblem?.starterCode[language] || getDefaultStarterCode(language);
    setCodeByLanguage((prev) => ({
      ...prev,
      [language]: template,
    }));
    setOutput('');
    setVisualization('');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-900 text-slate-300">
      {/* Editor Top Bar */}
      <div className="h-14 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          {/* Language Selector with extensions */}
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

          {/* Mode Indicator: Practice Problem Mode vs Free Coding */}
          {activeProblem ? (
            <div className="flex items-center gap-2 px-2.5 py-1 bg-indigo-950/60 border border-indigo-700/40 rounded-lg text-xs">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-semibold text-indigo-300">{activeProblem.title}</span>
              {activeProblem.difficulty && (
                <span className="text-[10px] px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded font-medium">
                  {activeProblem.difficulty}
                </span>
              )}
              <button
                onClick={() => setActiveProblem(null)}
                title="Switch to Free Coding Mode"
                className="ml-1 text-slate-400 hover:text-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>
          ) : (
            <span className="hidden md:inline-block text-xs text-slate-500 font-medium tracking-wide uppercase">
              Free Coding Mode
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveCode}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm ${
              isSaved
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Save className="w-4 h-4" />
            {isSaved ? 'Saved!' : 'Save'}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors text-sm text-slate-300"
            title={`Reset ${getLanguageConfig(language).label} code to starter template`}
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={() => handleVisualizeCode()}
            disabled={isVisualizing || isRunning}
            className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Eye className="w-4 h-4" />
            {isVisualizing ? 'Visualizing...' : 'Visualize'}
          </button>
          <button
            onClick={() => handleRunCode()}
            disabled={isRunning || isVisualizing}
            className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Play className="w-4 h-4" />
            {isRunning ? 'Running...' : 'Run Code'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Monaco Editor Container */}
        <div className="flex-1 relative">
          <Editor
            height="100%"
            language={settings.syntaxHighlighting ? getMonacoLanguage(language) : 'plaintext'}
            theme="vs-dark"
            value={currentCode}
            onChange={handleEditorChange}
            options={monacoOptions}
          />
        </div>

        {/* Output / Input / Visualization Panel */}
        <div className="w-[450px] border-l border-slate-800 bg-slate-950 flex flex-col">
          {/* Tabs: TERMINAL | INPUT | VISUALIZER */}
          <div className="h-10 border-b border-slate-800 flex items-center bg-slate-900">
            <button
              onClick={() => setActiveTab('output')}
              className={`flex-1 h-full text-xs font-semibold tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'output' ? 'bg-slate-800 text-indigo-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              TERMINAL
            </button>
            <button
              onClick={() => setActiveTab('input')}
              className={`flex-1 h-full text-xs font-semibold tracking-wider transition-colors border-l border-slate-800 flex items-center justify-center gap-1.5 ${
                activeTab === 'input' ? 'bg-slate-800 text-violet-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              INPUT
              {stdin.trim().length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('visualization')}
              className={`flex-1 h-full text-xs font-semibold tracking-wider transition-colors border-l border-slate-800 flex items-center justify-center gap-1.5 ${
                activeTab === 'visualization' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              VISUALIZER
            </button>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
            {activeTab === 'output' && (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex-1 p-4 font-mono text-sm text-slate-300 overflow-auto border-b border-slate-800/80">
                  <pre className="whitespace-pre-wrap">{output || 'Click "Run Code" to execute your program.'}</pre>
                </div>
                
                {/* Collapsible/Compact Stdin Footer in Terminal */}
                <div className="border-t border-slate-800 bg-slate-950 p-3.5 flex flex-col shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Stdin Input
                      </span>
                      {hasInputDetection && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded font-medium">
                          Scanner/input() detected
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveTab('input')}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                      >
                        Expand Input Tab →
                      </button>
                      {stdin && (
                        <button
                          onClick={() => setStdin('')}
                          className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    value={stdin}
                    onChange={(e) => setStdin(e.target.value)}
                    placeholder="Enter raw input here (e.g. 10 and 20 on separate lines)..."
                    className="h-20 w-full bg-slate-900 border border-slate-800 text-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none font-mono"
                  />
                </div>
              </div>
            )}

            {activeTab === 'input' && (
              <div className="flex-1 flex flex-col p-4 bg-slate-900 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Keyboard className="w-4 h-4 text-violet-400" />
                      Program Input (stdin)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Enter values exactly as your program expects (space or newline separated):
                    </p>
                  </div>
                  {stdin && (
                    <button
                      onClick={() => setStdin('')}
                      className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {hasInputDetection && (
                  <div className="mb-3 p-2.5 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-xs text-indigo-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>Input calls detected in your code (e.g. Scanner, input(), scanf, cin).</span>
                  </div>
                )}

                <div className="flex-1 flex flex-col min-h-[220px]">
                  <textarea
                    value={stdin}
                    onChange={(e) => setStdin(e.target.value)}
                    placeholder={`Enter raw stdin values here...\n\nExample:\n10\n20\n\nor\n\n10 20`}
                    className="flex-1 w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl p-3.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none font-mono leading-relaxed"
                  />
                </div>

                <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-800">
                  <span className="text-[11px] text-slate-500">
                    Passed to standard input during execution
                  </span>
                  <button
                    onClick={() => handleRunCode()}
                    disabled={isRunning || isVisualizing}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white rounded-xl transition-all text-xs font-bold shadow-[0_0_20px_rgba(99,102,241,0.3)]"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {isRunning ? 'Running...' : 'Run with Input'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'visualization' && (
              <div className="flex-1 overflow-auto">
                <MermaidViewer chart={visualization} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
