import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AccentColor = 'indigo' | 'violet' | 'blue' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'orange';
export type AnimationIntensity = 'none' | 'subtle' | 'full';
export type UITransitionSpeed = 'instant' | 'fast' | 'normal' | 'relaxed';

export interface AppSettings {
  // Appearance
  theme: 'dark' | 'light';
  accentColor: AccentColor;
  editorFontSize: number;
  editorFontFamily: string;
  animationsEnabled: boolean;
  animationIntensity: AnimationIntensity;
  uiTransitionSpeed: UITransitionSpeed;
  reducedMotion: boolean;

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

// ─── Accent color palette map ─────────────────────────────────────────────────
export const ACCENT_COLORS: Record<AccentColor, { name: string; hex: string; rgb: string; hoverHex: string }> = {
  indigo:  { name: 'Indigo',  hex: '#6366f1', rgb: '99,102,241',  hoverHex: '#818cf8' },
  violet:  { name: 'Violet',  hex: '#8b5cf6', rgb: '139,92,246',  hoverHex: '#a78bfa' },
  blue:    { name: 'Blue',    hex: '#3b82f6', rgb: '59,130,246',  hoverHex: '#60a5fa' },
  cyan:    { name: 'Cyan',    hex: '#06b6d4', rgb: '6,182,212',   hoverHex: '#22d3ee' },
  emerald: { name: 'Emerald', hex: '#10b981', rgb: '16,185,129',  hoverHex: '#34d399' },
  amber:   { name: 'Amber',   hex: '#f59e0b', rgb: '245,158,11',  hoverHex: '#fbbf24' },
  rose:    { name: 'Rose',    hex: '#f43f5e', rgb: '244,63,94',   hoverHex: '#fb7185' },
  orange:  { name: 'Orange',  hex: '#f97316', rgb: '249,115,22',  hoverHex: '#fb923c' },
};

// ─── Transition speed map ─────────────────────────────────────────────────────
export const TRANSITION_SPEEDS: Record<UITransitionSpeed, { label: string; ms: number }> = {
  instant: { label: 'Instant', ms: 0 },
  fast:    { label: 'Fast',    ms: 100 },
  normal:  { label: 'Normal',  ms: 200 },
  relaxed: { label: 'Relaxed', ms: 350 },
};

export const DEFAULT_SETTINGS: AppSettings = {
  // Appearance
  theme: 'dark',
  accentColor: 'indigo',
  editorFontSize: 14,
  editorFontFamily: 'JetBrains Mono',
  animationsEnabled: true,
  animationIntensity: 'full',
  uiTransitionSpeed: 'normal',
  reducedMotion: false,

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
  resolvedTheme: 'dark' | 'light';
  currentAccent: { name: string; hex: string; rgb: string; hoverHex: string };
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
        const parsed = JSON.parse(stored);
        // Migrate legacy 'system' theme to 'dark'
        if (parsed.theme === 'system') parsed.theme = 'dark';
        // Merge stored over defaults so new keys always have a value
        return { ...DEFAULT_SETTINGS, ...parsed };
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

  const resolvedTheme = useMemo(() => {
    return settings.theme === 'light' ? 'light' : 'dark';
  }, [settings.theme]);

  // Apply data-theme attribute + accent CSS custom properties
  useEffect(() => {
    const root = document.documentElement;

    // Theme class
    root.classList.remove('dark', 'light');
    root.classList.add(resolvedTheme);
    root.setAttribute('data-theme', resolvedTheme);

    // Accent color
    const accent = ACCENT_COLORS[settings.accentColor] ?? ACCENT_COLORS.indigo;
    root.style.setProperty('--accent-color', accent.hex);
    root.style.setProperty('--accent-color-rgb', accent.rgb);
    root.style.setProperty('--accent-hover', accent.hoverHex);

    // Editor font (available globally via var)
    root.style.setProperty('--editor-font-family', `'${settings.editorFontFamily}', 'Fira Code', monospace`);
    root.style.setProperty('--editor-font-size', `${settings.editorFontSize}px`);

    // Animation / transition speed
    const speed = TRANSITION_SPEEDS[settings.uiTransitionSpeed] ?? TRANSITION_SPEEDS.normal;
    root.style.setProperty('--ui-transition-speed', `${speed.ms}ms`);

    if (settings.reducedMotion || !settings.animationsEnabled || settings.animationIntensity === 'none') {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }

    if (settings.animationIntensity === 'subtle') {
      root.classList.add('subtle-motion');
    } else {
      root.classList.remove('subtle-motion');
    }
  }, [resolvedTheme, settings.accentColor, settings.editorFontFamily, settings.editorFontSize, settings.uiTransitionSpeed, settings.animationsEnabled, settings.animationIntensity, settings.reducedMotion]);

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

  const currentAccent = ACCENT_COLORS[settings.accentColor] ?? ACCENT_COLORS.indigo;

  return (
    <SettingsContext.Provider value={{ settings, resolvedTheme, currentAccent, updateSetting, resetSettings }}>
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
