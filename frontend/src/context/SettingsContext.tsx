import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppSettings {
  // Appearance
  theme: 'dark' | 'light' | 'system';
  editorFontSize: number;
  editorFontFamily: string;
  animationsEnabled: boolean;

  // Code Editor
  autoSave: boolean;
  wordWrap: boolean;
  showLineNumbers: boolean;
  showMinimap: boolean;
  tabSize: 2 | 4 | 8;
  syntaxHighlighting: boolean;
  formatOnSave: boolean;

  // Visualization
  animationSpeed: 'slow' | 'normal' | 'fast';
  autoPlayVisualization: boolean;
  trackVariables: boolean;
  memoryVisualization: boolean;
  callStackVisualization: boolean;
  stepByStepMode: boolean;

  // AI Tutor
  aiTutorEnabled: boolean;
  explanationLevel: 'beginner' | 'intermediate' | 'advanced';
  explainEveryStep: boolean;
  aiLanguage: string;
  aiVoiceEnabled: boolean;
  voiceSpeed: number;

  // Execution
  defaultLanguage: string;
  openTerminalAfterExecution: boolean;
  clearTerminalBeforeRun: boolean;
  executionTimeout: 5 | 10 | 15 | 30;

  // Notifications
  notifyExecutionCompleted: boolean;
  notifyExecutionErrors: boolean;
  notifyAIExplanationReady: boolean;
  notifyCodeSaved: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  // Appearance
  theme: 'dark',
  editorFontSize: 14,
  editorFontFamily: 'JetBrains Mono',
  animationsEnabled: true,

  // Code Editor
  autoSave: true,
  wordWrap: false,
  showLineNumbers: true,
  showMinimap: false,
  tabSize: 4,
  syntaxHighlighting: true,
  formatOnSave: false,

  // Visualization
  animationSpeed: 'normal',
  autoPlayVisualization: false,
  trackVariables: true,
  memoryVisualization: true,
  callStackVisualization: true,
  stepByStepMode: false,

  // AI Tutor
  aiTutorEnabled: true,
  explanationLevel: 'intermediate',
  explainEveryStep: false,
  aiLanguage: 'English',
  aiVoiceEnabled: false,
  voiceSpeed: 1.0,

  // Execution
  defaultLanguage: 'python',
  openTerminalAfterExecution: true,
  clearTerminalBeforeRun: false,
  executionTimeout: 10,

  // Notifications
  notifyExecutionCompleted: true,
  notifyExecutionErrors: true,
  notifyAIExplanationReady: true,
  notifyCodeSaved: true,
};

const SETTINGS_KEY = 'codelens_settings';

// ─── Context ──────────────────────────────────────────────────────────────────

interface SettingsContextValue {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        // Merge stored over defaults so new keys always have a value
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // corrupted storage — fall back to defaults
    }
    return DEFAULT_SETTINGS;
  });

  // Persist every change
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
