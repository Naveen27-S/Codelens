import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Palette, Code2, Eye, BrainCircuit, Play, Bell,
  Lock, Database, Info, ChevronDown, Check, AlertTriangle,
  Loader2, RotateCcw, Shield, Trash2, Download,
  FileText, HelpCircle, MessageSquare, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings, type AppSettings } from '../context/SettingsContext';
import axios from 'axios';
import './SettingsPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// ─── Shared primitives ────────────────────────────────────────────────────────

interface ToggleProps {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}
function Toggle({ id, checked, onChange, disabled }: ToggleProps) {
  return (
    <label className="settings-toggle" aria-label={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="settings-toggle-track" />
    </label>
  );
}

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}
function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="settings-row">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

interface SectionCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}
function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6 backdrop-blur-xl mb-5">
      {(title || description) && (
        <div className="mb-5">
          {title && <h3 className="text-base font-semibold text-white">{title}</h3>}
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

// Success/error notification flash
type FlashState = { type: 'success' | 'error'; message: string } | null;

function FlashNotification({ flash, onClose }: { flash: FlashState; onClose: () => void }) {
  return (
    <AnimatePresence>
      {flash && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium mb-5 ${
            flash.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border border-red-500/30 text-red-300'
          }`}
        >
          {flash.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span className="flex-1">{flash.message}</span>
          <button onClick={onClose} className="opacity-60 hover:opacity-100 transition-opacity">
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Instant-save feedback (small inline)
function SavedBadge({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium ml-3"
        >
          <Check className="w-3 h-3" /> Saved
        </motion.span>
      )}
    </AnimatePresence>
  );
}

// Confirmation modal
interface ConfirmModalProps {
  title: string;
  description: string;
  confirmLabel: string;
  confirmClass?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
function ConfirmModal({ title, description, confirmLabel, confirmClass, loading, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="settings-modal-overlay" onClick={onCancel}>
      <motion.div
        className="settings-modal"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h4 className="text-base font-semibold text-white">{title}</h4>
            <p className="text-sm text-slate-400 mt-1">{description}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium text-white flex items-center gap-2 transition-all ${confirmClass ?? 'bg-red-600 hover:bg-red-500'}`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Section: Profile ─────────────────────────────────────────────────────────
function ProfileSection() {
  const { user, updateUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<FlashState>(null);

  // keep fields in sync if user object refreshes
  useEffect(() => {
    setFullName(user?.full_name ?? '');
    setEmail(user?.email ?? '');
  }, [user?.full_name, user?.email]);

  const handleSave = async () => {
    setLoading(true);
    setFlash(null);
    try {
      await updateUser({ full_name: fullName.trim(), email: email.trim().toLowerCase() });
      setFlash({ type: 'success', message: 'Profile updated successfully.' });
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.detail ?? 'Failed to update profile.'
        : 'Failed to update profile.';
      setFlash({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const initials = (user?.full_name ?? user?.email ?? 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <FlashNotification flash={flash} onClose={() => setFlash(null)} />

      <SectionCard title="Profile Picture">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xl font-bold text-white border border-indigo-500/30 shrink-0">
            {initials}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{user?.full_name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
            <p className="text-xs text-slate-600 mt-2">Avatar generated from your initials.</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Personal Information">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Full Name</label>
            <input
              id="profile-fullname"
              type="text"
              className="settings-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
            <input
              id="profile-email"
              type="email"
              className="settings-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
            />
          </div>
          <button
            id="profile-save-btn"
            onClick={handleSave}
            disabled={loading || (!fullName.trim() && !email.trim())}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] active:scale-[0.98] mt-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Account Information">
        <div className="space-y-3 text-sm text-slate-400">
          <div className="flex justify-between items-center py-1">
            <span>Member since</span>
            <span className="text-slate-300 font-medium">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : '—'}
            </span>
          </div>
          <div className="flex justify-between items-center py-1 border-t border-slate-800">
            <span>Account ID</span>
            <span className="text-slate-300 font-mono text-xs">#{user?.id}</span>
          </div>
        </div>
      </SectionCard>
    </>
  );
}

// ─── Section: Appearance ──────────────────────────────────────────────────────
function AppearanceSection() {
  const { settings, updateSetting } = useSettings();
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(<K extends keyof AppSettings>(key: K, val: AppSettings[K]) => {
    updateSetting(key, val);
    setSavedKey(key as string);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSavedKey(null), 2000);
  }, [updateSetting]);

  const fontOptions = ['JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'Source Code Pro'];

  return (
    <>
      <SectionCard title="Theme">
        <div className="space-y-2">
          {(['dark', 'light', 'system'] as const).map((t) => (
            <label
              key={t}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                settings.theme === t
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                  : 'border-transparent hover:bg-slate-800/50 text-slate-300'
              }`}
            >
              <input
                type="radio"
                name="theme"
                value={t}
                checked={settings.theme === t}
                onChange={() => save('theme', t)}
                className="accent-indigo-500"
              />
              <span className="text-sm font-medium capitalize">{t === 'system' ? 'System default' : t === 'dark' ? '🌙 Dark' : '☀️ Light'}</span>
              {settings.theme === t && <Check className="w-4 h-4 ml-auto" />}
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-600 mt-3">Light/System themes are prepared for future theming support. CodeLens defaults to dark mode.</p>
      </SectionCard>

      <SectionCard title="Typography">
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-slate-200">Editor Font Size</label>
              <span className="text-sm font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg">{settings.editorFontSize}px</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 shrink-0">12px</span>
              <input
                id="appearance-fontsize-slider"
                type="range"
                min={12}
                max={24}
                step={1}
                value={settings.editorFontSize}
                onChange={(e) => save('editorFontSize', parseInt(e.target.value))}
                className="settings-slider flex-1"
              />
              <span className="text-xs text-slate-500 shrink-0">24px</span>
            </div>
            <SavedBadge show={savedKey === 'editorFontSize'} />
          </div>

          <div className="border-t border-slate-800 pt-4">
            <label className="block text-sm font-medium text-slate-200 mb-2">Font Family</label>
            <select
              id="appearance-fontfamily"
              className="settings-input settings-select"
              value={settings.editorFontFamily}
              onChange={(e) => save('editorFontFamily', e.target.value)}
            >
              {fontOptions.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <SavedBadge show={savedKey === 'editorFontFamily'} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Interface">
        <SettingRow label="Interface Animations" description="Enable smooth transitions and micro-animations.">
          <Toggle id="appearance-animations" checked={settings.animationsEnabled} onChange={(v) => save('animationsEnabled', v)} />
        </SettingRow>
      </SectionCard>
    </>
  );
}

// ─── Section: Code Editor ─────────────────────────────────────────────────────
function CodeEditorSection() {
  const { settings, updateSetting } = useSettings();
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(<K extends keyof AppSettings>(key: K, val: AppSettings[K]) => {
    updateSetting(key, val);
    setSavedKey(key as string);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSavedKey(null), 2000);
  }, [updateSetting]);

  return (
    <>
      <SectionCard title="Editing Behavior">
        <div className="divide-y divide-slate-800/60">
          <SettingRow label="Auto Save" description="Automatically save code changes as you type.">
            <Toggle id="editor-autosave" checked={settings.autoSave} onChange={(v) => save('autoSave', v)} />
          </SettingRow>
          <SettingRow label="Word Wrap" description="Wrap long lines within the visible editor area.">
            <Toggle id="editor-wordwrap" checked={settings.wordWrap} onChange={(v) => save('wordWrap', v)} />
          </SettingRow>
          <SettingRow label="Format Code on Save" description="Auto-format code using the language formatter.">
            <Toggle id="editor-formatsave" checked={settings.formatOnSave} onChange={(v) => save('formatOnSave', v)} />
          </SettingRow>
        </div>
      </SectionCard>

      <SectionCard title="Display">
        <div className="divide-y divide-slate-800/60">
          <SettingRow label="Show Line Numbers" description="Display line numbers in the editor gutter.">
            <Toggle id="editor-linenumbers" checked={settings.showLineNumbers} onChange={(v) => save('showLineNumbers', v)} />
          </SettingRow>
          <SettingRow label="Show Minimap" description="Show a miniature code overview on the right side.">
            <Toggle id="editor-minimap" checked={settings.showMinimap} onChange={(v) => save('showMinimap', v)} />
          </SettingRow>
          <SettingRow label="Syntax Highlighting" description="Color-code tokens based on language grammar.">
            <Toggle id="editor-syntax" checked={settings.syntaxHighlighting} onChange={(v) => save('syntaxHighlighting', v)} />
          </SettingRow>
        </div>
      </SectionCard>

      <SectionCard title="Indentation">
        <SettingRow label="Tab Size" description="Number of spaces per indentation level.">
          <select
            id="editor-tabsize"
            className="settings-input settings-select w-24"
            value={settings.tabSize}
            onChange={(e) => save('tabSize', parseInt(e.target.value) as AppSettings['tabSize'])}
          >
            <option value={2}>2</option>
            <option value={4}>4</option>
            <option value={8}>8</option>
          </select>
        </SettingRow>
        <SavedBadge show={savedKey === 'tabSize'} />
      </SectionCard>
    </>
  );
}

// ─── Section: Visualization ───────────────────────────────────────────────────
function VisualizationSection() {
  const { settings, updateSetting } = useSettings();
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(<K extends keyof AppSettings>(key: K, val: AppSettings[K]) => {
    updateSetting(key, val);
    setSavedKey(key as string);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSavedKey(null), 2000);
  }, [updateSetting]);

  const speeds = ['slow', 'normal', 'fast'] as const;

  return (
    <>
      <SectionCard title="Animation Speed" description="Controls how fast execution steps are animated in the visualizer.">
        <div className="flex items-center gap-3">
          <div className="settings-segmented">
            {speeds.map((s) => (
              <button
                key={s}
                id={`viz-speed-${s}`}
                className={`settings-segmented-btn ${settings.animationSpeed === s ? 'active' : ''}`}
                onClick={() => save('animationSpeed', s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <SavedBadge show={savedKey === 'animationSpeed'} />
        </div>
      </SectionCard>

      <SectionCard title="Playback">
        <div className="divide-y divide-slate-800/60">
          <SettingRow label="Auto Play Visualization" description="Automatically start the visualization after code runs.">
            <Toggle id="viz-autoplay" checked={settings.autoPlayVisualization} onChange={(v) => save('autoPlayVisualization', v)} />
          </SettingRow>
          <SettingRow label="Step-by-Step Execution" description="Pause after each execution step for manual control.">
            <Toggle id="viz-stepbystep" checked={settings.stepByStepMode} onChange={(v) => save('stepByStepMode', v)} />
          </SettingRow>
        </div>
      </SectionCard>

      <SectionCard title="Visualization Components">
        <div className="divide-y divide-slate-800/60">
          <SettingRow label="Track Variables" description="Show variable values as they change during execution.">
            <Toggle id="viz-variables" checked={settings.trackVariables} onChange={(v) => save('trackVariables', v)} />
          </SettingRow>
          <SettingRow label="Memory Visualization" description="Visualize object and variable memory allocation.">
            <Toggle id="viz-memory" checked={settings.memoryVisualization} onChange={(v) => save('memoryVisualization', v)} />
          </SettingRow>
          <SettingRow label="Call Stack Visualization" description="Show function calls and returns on the call stack.">
            <Toggle id="viz-callstack" checked={settings.callStackVisualization} onChange={(v) => save('callStackVisualization', v)} />
          </SettingRow>
        </div>
      </SectionCard>
    </>
  );
}

// ─── Section: AI Tutor ────────────────────────────────────────────────────────
function AITutorSection() {
  const { settings, updateSetting } = useSettings();
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(<K extends keyof AppSettings>(key: K, val: AppSettings[K]) => {
    updateSetting(key, val);
    setSavedKey(key as string);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSavedKey(null), 2000);
  }, [updateSetting]);

  const levels = ['beginner', 'intermediate', 'advanced'] as const;
  const languages = ['English', 'Tamil', 'Hindi', 'Telugu', 'Malayalam', 'Kannada', 'Bengali', 'Marathi', 'Gujarati', 'Punjabi'];

  return (
    <>
      <SectionCard title="AI Tutor" description="AI-powered step-by-step code explanation and learning assistant.">
        <SettingRow label="Enable AI Tutor" description="Show AI explanations and suggestions while coding.">
          <Toggle id="ai-enabled" checked={settings.aiTutorEnabled} onChange={(v) => save('aiTutorEnabled', v)} />
        </SettingRow>
      </SectionCard>

      <SectionCard
        title="Explanation Level"
        description="Choose the depth and vocabulary level for AI explanations."
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="settings-segmented">
            {levels.map((l) => (
              <button
                key={l}
                id={`ai-level-${l}`}
                className={`settings-segmented-btn ${settings.explanationLevel === l ? 'active' : ''} ${!settings.aiTutorEnabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                onClick={() => settings.aiTutorEnabled && save('explanationLevel', l)}
                disabled={!settings.aiTutorEnabled}
              >
                {l.charAt(0).toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>
          <SavedBadge show={savedKey === 'explanationLevel'} />
        </div>
      </SectionCard>

      <SectionCard title="Behavior">
        <div className="divide-y divide-slate-800/60">
          <SettingRow label="Explain Every Execution Step" description="Automatically generate an AI explanation for each step during visualization.">
            <Toggle id="ai-everystep" checked={settings.explainEveryStep} onChange={(v) => save('explainEveryStep', v)} disabled={!settings.aiTutorEnabled} />
          </SettingRow>
          <div className="pt-4 pb-2">
            <label className="block text-sm font-medium text-slate-200 mb-2">Response Language</label>
            <select
              id="ai-language"
              className="settings-input settings-select w-full max-w-xs"
              value={settings.aiLanguage}
              onChange={(e) => save('aiLanguage', e.target.value)}
              disabled={!settings.aiTutorEnabled}
            >
              {languages.map((lang) => <option key={lang} value={lang}>{lang}</option>)}
            </select>
            <SavedBadge show={savedKey === 'aiLanguage'} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="AI Voice">
        <div className="divide-y divide-slate-800/60">
          <SettingRow label="AI Voice Responses" description="Read AI explanations aloud using text-to-speech.">
            <Toggle id="ai-voice" checked={settings.aiVoiceEnabled} onChange={(v) => save('aiVoiceEnabled', v)} disabled={!settings.aiTutorEnabled} />
          </SettingRow>
          <AnimatePresence>
            {settings.aiVoiceEnabled && settings.aiTutorEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-4 pb-2">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-slate-200">Voice Speed</label>
                    <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg">{settings.voiceSpeed.toFixed(1)}x</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 shrink-0">Slow</span>
                    <input
                      id="ai-voice-speed"
                      type="range"
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      value={settings.voiceSpeed}
                      onChange={(e) => save('voiceSpeed', parseFloat(e.target.value))}
                      className="settings-slider flex-1"
                    />
                    <span className="text-xs text-slate-500 shrink-0">Fast</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SectionCard>
    </>
  );
}

// ─── Section: Execution ───────────────────────────────────────────────────────
function ExecutionSection() {
  const { settings, updateSetting } = useSettings();
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(<K extends keyof AppSettings>(key: K, val: AppSettings[K]) => {
    updateSetting(key, val);
    setSavedKey(key as string);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSavedKey(null), 2000);
  }, [updateSetting]);

  const languages = [
    { value: 'python', label: 'Python' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'java', label: 'Java' },
    { value: 'cpp', label: 'C++' },
  ];

  const timeouts = [5, 10, 15, 30] as const;

  return (
    <>
      <SectionCard title="Default Language" description="The programming language selected when you open the editor.">
        <div>
          <select
            id="exec-defaultlang"
            className="settings-input settings-select w-full max-w-xs"
            value={settings.defaultLanguage}
            onChange={(e) => save('defaultLanguage', e.target.value)}
          >
            {languages.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <SavedBadge show={savedKey === 'defaultLanguage'} />
        </div>
      </SectionCard>

      <SectionCard title="Terminal Behavior">
        <div className="divide-y divide-slate-800/60">
          <SettingRow label="Open Terminal After Execution" description="Automatically switch to the terminal panel after running code.">
            <Toggle id="exec-openterminal" checked={settings.openTerminalAfterExecution} onChange={(v) => save('openTerminalAfterExecution', v)} />
          </SettingRow>
          <SettingRow label="Clear Terminal Before Running" description="Clear previous output before each new execution.">
            <Toggle id="exec-clearterminal" checked={settings.clearTerminalBeforeRun} onChange={(v) => save('clearTerminalBeforeRun', v)} />
          </SettingRow>
        </div>
      </SectionCard>

      <SectionCard title="Execution Timeout" description="Maximum time allowed for code execution before it is stopped.">
        <div>
          <select
            id="exec-timeout"
            className="settings-input settings-select w-full max-w-xs"
            value={settings.executionTimeout}
            onChange={(e) => save('executionTimeout', parseInt(e.target.value) as AppSettings['executionTimeout'])}
          >
            {timeouts.map((t) => <option key={t} value={t}>{t} seconds</option>)}
          </select>
          <SavedBadge show={savedKey === 'executionTimeout'} />
          <p className="text-xs text-slate-600 mt-2">Backend security limits may override this setting.</p>
        </div>
      </SectionCard>
    </>
  );
}

// ─── Section: Notifications ───────────────────────────────────────────────────
function NotificationsSection() {
  const { settings, updateSetting } = useSettings();

  const rows: { key: keyof AppSettings; label: string; description: string }[] = [
    { key: 'notifyExecutionCompleted', label: 'Execution Completed', description: 'Notify when your code finishes running.' },
    { key: 'notifyExecutionErrors', label: 'Execution Errors', description: 'Notify when code encounters a runtime error.' },
    { key: 'notifyAIExplanationReady', label: 'AI Explanation Ready', description: 'Notify when the AI tutor finishes generating an explanation.' },
    { key: 'notifyCodeSaved', label: 'Code Saved', description: 'Notify when your code is saved automatically.' },
  ];

  return (
    <SectionCard title="Notification Preferences" description="Choose which in-app notifications you want to receive.">
      <div className="divide-y divide-slate-800/60">
        {rows.map(({ key, label, description }) => (
          <SettingRow key={key} label={label} description={description}>
            <Toggle
              id={`notif-${key}`}
              checked={settings[key] as boolean}
              onChange={(v) => updateSetting(key, v as AppSettings[typeof key])}
            />
          </SettingRow>
        ))}
      </div>
    </SectionCard>
  );
}

// ─── Section: Privacy & Security ─────────────────────────────────────────────
function PrivacySection() {
  const { logout } = useAuth();
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwFlash, setPwFlash] = useState<FlashState>(null);
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });

  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) {
      setPwFlash({ type: 'error', message: 'Please fill in all password fields.' });
      return;
    }
    if (pwForm.next.length < 8) {
      setPwFlash({ type: 'error', message: 'New password must be at least 8 characters.' });
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwFlash({ type: 'error', message: 'New passwords do not match.' });
      return;
    }
    setPwLoading(true);
    setPwFlash(null);
    try {
      await axios.put(`${API_URL}/auth/change-password`, {
        current_password: pwForm.current,
        new_password: pwForm.next,
      });
      setPwFlash({ type: 'success', message: 'Password changed successfully.' });
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.detail ?? 'Failed to change password.'
        : 'Failed to change password.';
      setPwFlash({ type: 'error', message: msg });
    } finally {
      setPwLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      await axios.delete(`${API_URL}/auth/me`);
      logout();
      window.location.href = '/';
    } catch {
      setDeleteLoading(false);
      setDeleteModal(false);
    }
  };

  const PwInput = ({ field, placeholder }: { field: 'current' | 'next' | 'confirm'; placeholder: string }) => (
    <div className="relative">
      <input
        id={`security-pw-${field}`}
        type={showPw[field] ? 'text' : 'password'}
        className="settings-input pr-10"
        placeholder={placeholder}
        value={pwForm[field]}
        onChange={(e) => setPwForm((p) => ({ ...p, [field]: e.target.value }))}
      />
      <button
        type="button"
        onClick={() => setShowPw((p) => ({ ...p, [field]: !p[field] }))}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
      >
        <Eye className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <>
      <SectionCard title="Change Password">
        <FlashNotification flash={pwFlash} onClose={() => setPwFlash(null)} />
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Current Password</label>
            <PwInput field="current" placeholder="Enter current password" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">New Password</label>
            <PwInput field="next" placeholder="At least 8 characters" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Confirm New Password</label>
            <PwInput field="confirm" placeholder="Repeat new password" />
          </div>
          <button
            id="security-changepw-btn"
            onClick={handleChangePassword}
            disabled={pwLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all active:scale-[0.98] mt-1"
          >
            {pwLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            <Lock className="w-4 h-4" />
            Change Password
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Active Sessions">
        <div className="flex items-start gap-3 p-3 bg-slate-800/40 rounded-xl border border-slate-700/40 mb-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Current Device</p>
            <p className="text-xs text-slate-500 mt-0.5">This browser • Active now</p>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>
        </div>
        <button
          disabled
          className="text-sm px-4 py-2 rounded-xl border border-slate-700 text-slate-500 cursor-not-allowed flex items-center gap-2"
        >
          <Shield className="w-4 h-4" />
          Logout Other Devices
          <span className="text-xs text-slate-600 ml-1">(Coming soon)</span>
        </button>
      </SectionCard>

      <SectionCard title="Danger Zone">
        <div className="p-4 border border-red-500/20 rounded-xl bg-red-500/5">
          <div className="flex items-start gap-3">
            <Trash2 className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-300">Delete Account</p>
              <p className="text-xs text-slate-500 mt-1">Permanently delete your CodeLens account and all associated data. This action cannot be undone.</p>
            </div>
            <button
              id="security-delete-account-btn"
              onClick={() => setDeleteModal(true)}
              className="shrink-0 px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-sm font-semibold rounded-xl border border-red-500/30 transition-all"
            >
              Delete
            </button>
          </div>
        </div>
      </SectionCard>

      {deleteModal && (
        <ConfirmModal
          title="Delete your account?"
          description="This will permanently delete your CodeLens account, all saved code, and execution history. This action cannot be undone."
          confirmLabel="Delete Account"
          loading={deleteLoading}
          onConfirm={handleDeleteAccount}
          onCancel={() => setDeleteModal(false)}
        />
      )}
    </>
  );
}

// ─── Section: Data & History ──────────────────────────────────────────────────
function DataSection() {
  const [clearModal, setClearModal] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [flash, setFlash] = useState<FlashState>(null);

  const handleClearHistory = async () => {
    setClearLoading(true);
    try {
      await axios.delete(`${API_URL}/history`);
      setFlash({ type: 'success', message: 'Code history cleared successfully.' });
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.detail ?? 'Failed to clear history.'
        : 'Failed to clear history.';
      setFlash({ type: 'error', message: msg });
    } finally {
      setClearLoading(false);
      setClearModal(false);
    }
  };

  return (
    <>
      <FlashNotification flash={flash} onClose={() => setFlash(null)} />

      <SectionCard title="Code History" description="Manage your saved code snippets and execution history.">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">View all saved code and past executions.</p>
          </div>
          <button
            id="data-view-history-btn"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 text-sm font-medium rounded-xl border border-indigo-500/20 transition-all"
            onClick={() => setFlash({ type: 'error', message: 'History viewer coming soon.' })}
          >
            <FileText className="w-4 h-4" />
            View History
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Clear Code History">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <p className="text-sm text-slate-400">Remove all saved code history and execution records from your account.</p>
          </div>
          <button
            id="data-clear-history-btn"
            onClick={() => setClearModal(true)}
            className="shrink-0 flex items-center gap-2 px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 text-sm font-medium rounded-xl border border-red-500/20 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Export Data">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <p className="text-sm text-slate-400">Download a copy of your CodeLens data including saved code and settings.</p>
          </div>
          <button
            id="data-export-btn"
            disabled
            className="shrink-0 flex items-center gap-2 px-4 py-2 bg-slate-800/50 text-slate-500 text-sm font-medium rounded-xl border border-slate-700/40 cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export
            <span className="text-xs text-slate-600">(Soon)</span>
          </button>
        </div>
      </SectionCard>

      {clearModal && (
        <ConfirmModal
          title="Clear code history?"
          description="This will permanently delete all your saved code snippets and execution history from your account."
          confirmLabel="Clear History"
          confirmClass="bg-red-600 hover:bg-red-500"
          loading={clearLoading}
          onConfirm={handleClearHistory}
          onCancel={() => setClearModal(false)}
        />
      )}
    </>
  );
}

// ─── Section: About ───────────────────────────────────────────────────────────
function AboutSection() {
  return (
    <>
      <SectionCard title="">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-600/20 border border-indigo-500/30 flex items-center justify-center">
            <Code2 className="w-7 h-7 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">CodeLens AI</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">v1.0.0</span>
              <span className="text-xs text-slate-500">Stable</span>
            </div>
          </div>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">
          AI-powered code visualization and learning platform. Step-by-step execution, real-time memory visualization, and an AI tutor that explains every line.
        </p>
      </SectionCard>

      <SectionCard title="Resources">
        <div className="space-y-2">
          {[
            { icon: <FileText className="w-4 h-4" />, label: 'Documentation', description: 'Learn how to use CodeLens AI', href: '/' },
            { icon: <HelpCircle className="w-4 h-4" />, label: 'Help Center', description: 'Browse frequently asked questions', href: '/' },
            { icon: <MessageSquare className="w-4 h-4" />, label: 'Contact Support', description: 'Get help from our team', href: '/' },
          ].map(({ icon, label, description, href }) => (
            <a
              key={label}
              href={href}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/50 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-all">
                {icon}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{label}</p>
                <p className="text-xs text-slate-500">{description}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-600 -rotate-90 ml-auto" />
            </a>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Technology">
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
          {[
            ['Frontend', 'React 19 + TypeScript'],
            ['Build', 'Vite 8'],
            ['Editor', 'Monaco Editor'],
            ['Backend', 'FastAPI + SQLite'],
            ['AI', 'Google Gemini'],
            ['Visualization', 'Mermaid.js'],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 p-2 bg-slate-900/50 rounded-lg">
              <span className="text-slate-600">{k}</span>
              <span className="text-slate-400 font-medium">{v}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}

// ─── Reset Preferences Helper ─────────────────────────────────────────────────
function ResetPreferencesButton() {
  const { resetSettings } = useSettings();
  const [modal, setModal] = useState(false);

  return (
    <>
      <div className="mt-4 pt-4 border-t border-slate-800/60">
        <button
          id="settings-reset-prefs-btn"
          onClick={() => setModal(true)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset Preferences to Defaults
        </button>
      </div>
      {modal && (
        <ConfirmModal
          title="Reset all preferences?"
          description="This will reset all CodeLens preferences (appearance, editor, visualization, AI, execution, notifications) to their defaults. Your account, saved code, and passwords will not be affected."
          confirmLabel="Reset Preferences"
          confirmClass="bg-indigo-600 hover:bg-indigo-500"
          onConfirm={() => { resetSettings(); setModal(false); }}
          onCancel={() => setModal(false)}
        />
      )}
    </>
  );
}

// ─── Settings nav config ──────────────────────────────────────────────────────
type SectionId =
  | 'profile' | 'appearance' | 'editor' | 'visualization'
  | 'ai-tutor' | 'execution' | 'notifications' | 'security' | 'data' | 'about';

interface NavItem {
  id: SectionId;
  icon: React.ReactNode;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'profile', icon: <User className="w-4 h-4" />, label: 'Profile' },
  { id: 'appearance', icon: <Palette className="w-4 h-4" />, label: 'Appearance' },
  { id: 'editor', icon: <Code2 className="w-4 h-4" />, label: 'Code Editor' },
  { id: 'visualization', icon: <Eye className="w-4 h-4" />, label: 'Visualization' },
  { id: 'ai-tutor', icon: <BrainCircuit className="w-4 h-4" />, label: 'AI Tutor' },
  { id: 'execution', icon: <Play className="w-4 h-4" />, label: 'Execution' },
  { id: 'notifications', icon: <Bell className="w-4 h-4" />, label: 'Notifications' },
  { id: 'security', icon: <Lock className="w-4 h-4" />, label: 'Privacy & Security' },
  { id: 'data', icon: <Database className="w-4 h-4" />, label: 'Data & History' },
  { id: 'about', icon: <Info className="w-4 h-4" />, label: 'About' },
];

const SHOW_RESET_FOR: SectionId[] = ['appearance', 'editor', 'visualization', 'ai-tutor', 'execution', 'notifications'];

function SectionContent({ id }: { id: SectionId }) {
  switch (id) {
    case 'profile': return <ProfileSection />;
    case 'appearance': return <AppearanceSection />;
    case 'editor': return <CodeEditorSection />;
    case 'visualization': return <VisualizationSection />;
    case 'ai-tutor': return <AITutorSection />;
    case 'execution': return <ExecutionSection />;
    case 'notifications': return <NotificationsSection />;
    case 'security': return <PrivacySection />;
    case 'data': return <DataSection />;
    case 'about': return <AboutSection />;
    default: return null;
  }
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionId>('profile');
  const activeItem = NAV_ITEMS.find((n) => n.id === activeSection)!;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-900 text-slate-300">
      {/* Top header */}
      <div className="h-14 border-b border-slate-800 bg-slate-950 flex items-center px-6 shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-white">Settings</h1>
          <p className="text-xs text-slate-500">Manage your CodeLens preferences</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden settings-layout">
        {/* ── Left nav (desktop) ─────────────────────────────────────────────── */}
        <div className="settings-left-nav w-56 border-r border-slate-800 bg-slate-950 flex flex-col overflow-y-auto shrink-0">
          <nav className="p-3 space-y-0.5 settings-left-nav-desktop">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  id={`settings-nav-${item.id}`}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left ${
                    isActive
                      ? 'bg-indigo-500/10 text-indigo-400 font-medium border border-indigo-500/20'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* ── Mobile dropdown nav ──────────────────────────────────────────── */}
          <div className="p-3 settings-left-nav-mobile">
            <select
              className="settings-input settings-select w-full"
              value={activeSection}
              onChange={(e) => setActiveSection(e.target.value as SectionId)}
            >
              {NAV_ITEMS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Right content panel ───────────────────────────────────────────── */}
        <div className="settings-right-panel flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-8">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-7">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                {activeItem.icon}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{activeItem.label}</h2>
              </div>
            </div>

            {/* Animated section content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <SectionContent id={activeSection} />

                {/* Reset button for preference sections */}
                {SHOW_RESET_FOR.includes(activeSection) && <ResetPreferencesButton />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
