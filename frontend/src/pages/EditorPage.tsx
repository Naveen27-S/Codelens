import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { Play, RotateCcw, Save, Eye } from 'lucide-react';
import axios from 'axios';
import { MermaidViewer } from '../components/MermaidViewer';
import { useSettings } from '../context/SettingsContext';
import { recordUserActivity } from '../services/dashboardService';

export function EditorPage() {
  const { settings } = useSettings();
  const location = useLocation();

  const routerState = location.state as {
    code?: string;
    language?: string;
    activeTab?: 'output' | 'visualization';
    visualization?: string;
    triggerRun?: boolean;
    triggerVisualize?: boolean;
    triggerAITutor?: boolean;
  } | null;

  const [code, setCode] = useState(() => {
    return routerState?.code !== undefined ? routerState.code : `def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(fibonacci(10))`;
  });
  
  const [language, setLanguage] = useState(() => {
    return routerState?.language !== undefined ? routerState.language : (settings.defaultLanguage || 'python');
  });

  const [output, setOutput] = useState('');
  const [visualization, setVisualization] = useState(() => {
    return routerState?.visualization || '';
  });

  const [activeTab, setActiveTab] = useState<'output' | 'visualization'>(() => {
    return routerState?.activeTab || 'output';
  });

  const [isRunning, setIsRunning] = useState(false);
  const [isVisualizing, setIsVisualizing] = useState(false);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) setCode(value);
  };

  const handleRunCode = async (overrideCode?: string, overrideLang?: string) => {
    const codeToRun = overrideCode !== undefined ? overrideCode : code;
    const langToRun = overrideLang !== undefined ? overrideLang : language;
    setIsRunning(true);
    if (settings.clearTerminalBeforeRun) setOutput('');
    setActiveTab('output');
    setOutput('Executing...');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const response = await axios.post(`${apiUrl}/execute`, {
        language: langToRun,
        code: codeToRun
      });
      setOutput(response.data.output || 'No output');
      if (settings.openTerminalAfterExecution) setActiveTab('output');

      // Record activity automatically
      recordUserActivity({
        activity_type: 'code_execution',
        title: `Ran ${langToRun.toUpperCase()} Code`,
        description: `Executed ${langToRun} script in Monaco Editor.`,
        language: langToRun,
        program_name: `${langToRun.toUpperCase()} Program`,
        status: 'completed',
        metadata_json: { source_code: codeToRun },
      });
    } catch (error: any) {
      setOutput(error.response?.data?.detail || error.message || 'Execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  const handleVisualizeCode = async (overrideCode?: string, overrideLang?: string) => {
    const codeToViz = overrideCode !== undefined ? overrideCode : code;
    const langToViz = overrideLang !== undefined ? overrideLang : language;
    setIsVisualizing(true);
    setActiveTab('visualization');
    setVisualization('Generating diagram...');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const response = await axios.post(`${apiUrl}/ai/visualize`, {
        language: langToViz,
        code: codeToViz
      }, { withCredentials: true });
      const explanation = response.data.explanation || '';
      setVisualization(explanation);

      // Record visualization activity automatically
      recordUserActivity({
        activity_type: 'visualization_completed',
        title: `Visualized ${langToViz.toUpperCase()} Algorithm`,
        description: `Generated execution flowchart and call stack for ${langToViz} program.`,
        language: langToViz,
        program_name: `${langToViz.toUpperCase()} Algorithm`,
        status: 'completed',
        duration_seconds: 45,
        metadata_json: { source_code: codeToViz, mermaid_explanation: explanation, steps: 18 },
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

      let currentCode = code;
      let currentLang = language;

      if (routerState) {
        if (routerState.code !== undefined) {
          setCode(routerState.code);
          currentCode = routerState.code;
        }
        if (routerState.language !== undefined) {
          setLanguage(routerState.language);
          currentLang = routerState.language;
        }
        if (routerState.visualization !== undefined) {
          setVisualization(routerState.visualization);
        }
        if (routerState.activeTab !== undefined) {
          setActiveTab(routerState.activeTab);
        }

        if (routerState.triggerRun) {
          handleRunCode(currentCode, currentLang);
        } else if (routerState.triggerVisualize) {
          handleVisualizeCode(currentCode, currentLang);
        } else if (routerState.triggerAITutor) {
          handleVisualizeCode(currentCode, currentLang);
        }
      }
    }
  }, [location.key, routerState]);

  // Derive Monaco options from settings — all update live when user changes Settings
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
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      await axios.post(`${apiUrl}/history`, {
        title: `${language.toUpperCase()} Program`,
        language,
        source_code: code,
      });
    } catch {
      // fallback
    }
    recordUserActivity({
      activity_type: 'program_saved',
      title: `Saved ${language.toUpperCase()} Program`,
      description: `Saved ${language} snippet in workspace.`,
      language,
      program_name: `${language.toUpperCase()} Program`,
      status: 'completed',
      metadata_json: { source_code: code },
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-900 text-slate-300">
      {/* Editor Top Bar */}
      <div className="h-14 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <select 
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
          </select>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveCode}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm ${
              isSaved ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Save className="w-4 h-4" />
            {isSaved ? 'Saved!' : 'Save'}
          </button>
          <button 
            onClick={() => {
              setCode('');
              setOutput('');
              setVisualization('');
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors text-sm text-slate-300"
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
            language={settings.syntaxHighlighting ? language : 'plaintext'}
            theme="vs-dark"
            value={code}
            onChange={handleEditorChange}
            options={monacoOptions}
          />
        </div>

        {/* Output/Visualization Panel */}
        <div className="w-[450px] border-l border-slate-800 bg-slate-950 flex flex-col">
          <div className="h-10 border-b border-slate-800 flex items-center bg-slate-900">
            <button
              onClick={() => setActiveTab('output')}
              className={`flex-1 h-full text-sm font-semibold tracking-wider transition-colors ${
                activeTab === 'output' ? 'bg-slate-800 text-indigo-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              TERMINAL
            </button>
            <button
              onClick={() => setActiveTab('visualization')}
              className={`flex-1 h-full text-sm font-semibold tracking-wider transition-colors border-l border-slate-800 ${
                activeTab === 'visualization' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              VISUALIZER
            </button>
          </div>
          <div className="flex-1 overflow-auto bg-slate-900">
            {activeTab === 'output' ? (
              <div className="p-4 font-mono text-sm text-slate-300">
                <pre className="whitespace-pre-wrap">{output}</pre>
              </div>
            ) : (
              <MermaidViewer chart={visualization} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
