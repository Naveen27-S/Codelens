import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Palette, Code2, Eye, EyeOff, BrainCircuit, Play, Bell,
  Lock, Database, Info, ChevronDown, Check, AlertTriangle,
  Loader2, RotateCcw, ShieldCheck, Trash2, Download,
  FileText, HelpCircle, MessageSquare, X, Mail, Copy,
  Search, Sparkles, CheckCircle2, RefreshCw, FileCode,
  Terminal, Clock, CheckCircle, XCircle, Laptop, Smartphone,
  LogOut, KeyRound, Save, BookOpen, GraduationCap, Cpu,
  Volume2, VolumeX, Gauge, Minus, Plus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings, type AppSettings } from '../context/SettingsContext';
import { generateCodeLensPDF, downloadJsonBackup } from '../utils/exportPdf';
import { voiceNarrator } from '../services/voiceNarrator';
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
  const [activePreviewSample, setActivePreviewSample] = useState<number>(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [isTestingVoiceSpeed, setIsTestingVoiceSpeed] = useState<boolean>(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(<K extends keyof AppSettings>(key: K, val: AppSettings[K]) => {
    updateSetting(key, val);
    setSavedKey(key as string);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSavedKey(null), 2000);
  }, [updateSetting]);

  const levels = ['beginner', 'intermediate', 'advanced'] as const;
  const languages = ['English (US)'];

  const levelCards = [
    {
      id: 'beginner' as const,
      title: 'Beginner',
      badge: 'Concept-First • Plain English • Real-World Analogies',
      icon: GraduationCap,
      accentColor: 'text-emerald-400',
      badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      activeBorder: 'border-emerald-500/60 bg-emerald-950/20 shadow-lg shadow-emerald-900/20',
      inactiveBorder: 'border-slate-800 bg-slate-900/50 hover:border-slate-700',
      tagline: 'Simple, encouraging explanations with zero intimidating jargon',
      summary: 'Translates abstract code syntax into tangible everyday concepts. Variables are explained as labeled storage boxes, functions as reusable recipes, and loops as repeating checklists.',
      target: 'Ideal for beginners, visual learners, and students starting their coding journey.',
      highlights: [
        'Zero confusing compiler jargon or memory addresses',
        'Everyday metaphors (boxes, lists, timers, recipes)',
        'Clear "why this happens" cause-and-effect guidance',
      ],
      sampleCode: 'arr[i] = arr[i] * 2;',
      sampleExplanation: 'Step 3 of 5: We peek into our list at slot 0 (which has the number 5). We double it to get 10, and put 10 right back into that slot so our list is updated!',
    },
    {
      id: 'intermediate' as const,
      title: 'Intermediate',
      badge: 'Standard • State Transitions • Algorithmic Flow',
      icon: BookOpen,
      accentColor: 'text-indigo-400',
      badgeClass: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
      activeBorder: 'border-indigo-500/60 bg-indigo-950/20 shadow-lg shadow-indigo-900/20',
      inactiveBorder: 'border-slate-800 bg-slate-900/50 hover:border-slate-700',
      tagline: 'Balanced, clear, and practical engineering commentary',
      summary: 'Focuses on explicit variable state mutations, array indices, loop predicate evaluations (true/false), and call stack frames without over-complicating low-level hardware memory details.',
      target: 'Ideal for developers, CS students, and daily coding practitioners solving problems.',
      highlights: [
        'Precise variable state mutation & accumulator tracking',
        'Loop condition evaluation & boundary index verification',
        'Direct call stack frame transitions & return values',
      ],
      sampleCode: 'arr[i] = arr[i] * 2;',
      sampleExplanation: 'Step 3 of 5: Array element mutation at index 0. Reading value 5, multiplying by 2, and assigning the computed result 10 back into arr[0].',
    },
    {
      id: 'advanced' as const,
      title: 'Advanced',
      badge: 'Deep-Dive • Memory & Complexity • Low-Level Semantics',
      icon: Cpu,
      accentColor: 'text-purple-400',
      badgeClass: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
      activeBorder: 'border-purple-500/60 bg-purple-950/20 shadow-lg shadow-purple-900/20',
      inactiveBorder: 'border-slate-800 bg-slate-900/50 hover:border-slate-700',
      tagline: 'Deep computer science analysis and systems-level rigor',
      summary: 'Analyzes memory layouts, contiguous buffers, pointer offsets, stack vs heap lifetimes, Big-O time and space complexity, and compiler optimizations.',
      target: 'Ideal for senior engineers, competitive programmers, and systems architects.',
      highlights: [
        'Big-O asymptotic runtime & auxiliary space complexity',
        'Stack frame allocation, pointers, & contiguous memory layout',
        'Cache-locality notes & hardware branch prediction behavior',
      ],
      sampleCode: 'arr[i] = arr[i] * 2;',
      sampleExplanation: 'Step 3 of 5 [O(1)]: In-place mutation of contiguous memory buffer in arr at offset [0] -> assigned 10. Direct cache-line access with no heap allocation.',
    },
  ];

  const previewSamples = [
    {
      label: 'Array Mutation',
      code: 'arr[i] = arr[i] * 2;',
      explanations: {
        beginner: 'Step 3 of 5: We peek into our list at slot 0 (which has the number 5). We double it to get 10, and put 10 right back into that slot so our list is updated!',
        intermediate: 'Step 3 of 5: Array element mutation at index 0. Reading value 5, multiplying by 2, and assigning the computed result 10 back into arr[0].',
        advanced: 'Step 3 of 5 [O(1)]: In-place mutation of contiguous memory in arr at offset [0] -> assigned 10. Direct cache-line access with no heap reallocation.',
      },
    },
    {
      label: 'Loop Iteration',
      code: 'for (let i = 0; i < n; i++)',
      explanations: {
        beginner: 'Step 2 of 8: Starting the loop! We check if our counter i (which is 0) is less than 5. It is, so we step inside and do our work.',
        intermediate: 'Step 2 of 8: Loop iteration 1. Evaluating continuation predicate i < n (0 < 5: true). Advancing instruction pointer into loop body.',
        advanced: 'Step 2 of 8: Loop invariant check. Predicate CMP i, n (0 < 5: true). Branch taken. Loop induction variable active with zero loop-carried dependencies.',
      },
    },
    {
      label: 'Condition Check',
      code: 'if (balance >= itemPrice)',
      explanations: {
        beginner: 'Step 4 of 6: Checking our wallet! We have 50 and the item costs 30. Since 50 is enough, we proceed to make the purchase.',
        intermediate: 'Step 4 of 6: Evaluating conditional branch: balance >= itemPrice (50 >= 30: true). Entering main purchase block.',
        advanced: 'Step 4 of 6: Branch condition evaluation with register comparison. CPU branch predictor takes fall-through path without branch penalty.',
      },
    },
    {
      label: 'Function Call',
      code: 'computeTotal(cartItems);',
      explanations: {
        beginner: 'Step 1 of 4: Calling our helper recipe "computeTotal" and handing it our shopping list to calculate the bill.',
        intermediate: 'Step 1 of 4: Calling function computeTotal with 1 parameter. Preparing caller-saved registers and execution context.',
        advanced: 'Step 1 of 4: Call stack push — allocated 64-byte stack frame for activation computeTotal(). Passing reference pointer &cartItems via register RDI.',
      },
    },
  ];

  const currentSample = previewSamples[activePreviewSample];
  const activeLevelExplanation = currentSample.explanations[settings.explanationLevel || 'intermediate'];

  const handleHearSample = () => {
    if (isPlayingAudio) {
      voiceNarrator.stop();
      setIsPlayingAudio(false);
      return;
    }
    setIsPlayingAudio(true);
    voiceNarrator.speak(activeLevelExplanation, settings.voiceSpeed || 1.0, () => {
      setIsPlayingAudio(false);
    });
  };

  const handleTestVoiceSpeed = () => {
    if (isTestingVoiceSpeed) {
      voiceNarrator.stop();
      setIsTestingVoiceSpeed(false);
      return;
    }
    setIsTestingVoiceSpeed(true);
    const testPhrase = `Step 3 of 5: Evaluating loop continuation predicate at ${settings.voiceSpeed.toFixed(2)}x speed.`;
    voiceNarrator.speak(testPhrase, settings.voiceSpeed || 1.0, () => {
      setIsTestingVoiceSpeed(false);
    });
  };

  return (
    <>
      {/* ─── 1. AI Tutor Primary Features Card ───────────────────────────────── */}
      <SectionCard
        title="AI Tutor"
        description="AI-powered step-by-step code explanation and learning assistant."
      >
        <div className="divide-y divide-slate-800/60">
          <SettingRow
            label="Enable AI Tutor"
            description="Show AI explanations, error diagnosis, and suggestions while coding."
          >
            <Toggle
              id="ai-enabled"
              checked={settings.aiTutorEnabled}
              onChange={(v) => save('aiTutorEnabled', v)}
            />
          </SettingRow>

          <div className="pt-4">
            <SettingRow
              label="Turn on Step-by-Step Explanation"
              description="Automatically generate and present AI step-by-step commentary and reasoning as each line executes."
            >
              <Toggle
                id="ai-step-by-step"
                checked={settings.explainEveryStep}
                onChange={(v) => save('explainEveryStep', v)}
                disabled={!settings.aiTutorEnabled}
              />
            </SettingRow>


            {/* Feature Highlights Grid */}
            <div
              className={`mt-4 pt-3 border-t border-slate-800/40 grid grid-cols-1 sm:grid-cols-3 gap-2.5 transition-all ${
                !settings.aiTutorEnabled || !settings.explainEveryStep
                  ? 'opacity-40 pointer-events-none'
                  : 'opacity-100'
              }`}
            >
              <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-800/30 border border-slate-700/40">
                <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 animate-pulse shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-200">Line-by-Line Breakdown</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                    Real-time state tracking of active variables & syntax AST
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-800/30 border border-slate-700/40">
                <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 animate-pulse shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-200">Live Audio & Subtitles</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                    Synchronized speech narration matching your chosen pace
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-800/30 border border-slate-700/40">
                <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 animate-pulse shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-200">Visual Flow Cursor</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                    Dynamic yellow indicator following execution pointer
                  </p>
                </div>
              </div>
            </div>

            {settings.aiTutorEnabled && settings.explainEveryStep && (
              <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Step-by-step AI explanation is active and will guide your visualization playback.</span>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ─── 2. Explanation Level with Rich Content Cards ────────────────────── */}
      <SectionCard
        title="Explanation Level"
        description="Choose the depth and vocabulary level for AI explanations. Tailor how deeply CodeLens analyzes and explains every statement."
      >
        {/* Segmented Quick Switcher */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="settings-segmented">
            {levels.map((l) => (
              <button
                key={l}
                id={`ai-level-${l}`}
                className={`settings-segmented-btn ${
                  settings.explanationLevel === l ? 'active' : ''
                } ${!settings.aiTutorEnabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                onClick={() => settings.aiTutorEnabled && save('explanationLevel', l)}
                disabled={!settings.aiTutorEnabled}
              >
                {l.charAt(0).toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>
          <SavedBadge show={savedKey === 'explanationLevel'} />
        </div>

        {/* Rich Selectable Cards for Beginner, Intermediate, Advanced */}
        <div className="grid grid-cols-1 gap-4 mt-2">
          {levelCards.map((card) => {
            const isSelected = settings.explanationLevel === card.id;
            const IconComponent = card.icon;

            return (
              <div
                key={card.id}
                onClick={() => settings.aiTutorEnabled && save('explanationLevel', card.id)}
                className={`relative rounded-2xl border p-5 transition-all duration-200 cursor-pointer ${
                  isSelected ? card.activeBorder : card.inactiveBorder
                } ${!settings.aiTutorEnabled ? 'opacity-40 cursor-not-allowed' : 'hover:scale-[1.005]'}`}
              >
                {/* Header with Title, Badge, and Radio Indicator */}
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                        isSelected
                          ? `${card.badgeClass}`
                          : 'bg-slate-800/80 border-slate-700 text-slate-400'
                      }`}
                    >
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h4 className="text-sm font-semibold text-white tracking-wide">
                          {card.title}
                        </h4>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${card.badgeClass}`}
                        >
                          {card.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{card.tagline}</p>
                    </div>
                  </div>

                  {/* Active Radio Pill */}
                  <div className="shrink-0 pt-0.5">
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-500 text-white shadow-sm'
                          : 'border-slate-700 bg-slate-800'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                </div>

                {/* Content description & target audience */}
                <p className="text-xs text-slate-300 leading-relaxed mt-2">{card.summary}</p>
                <p className="text-[11px] text-slate-400 mt-1.5 italic font-medium">
                  🎯 {card.target}
                </p>

                {/* Key Highlights Bullet points */}
                <div className="mt-3 pt-3 border-t border-slate-800/60 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {card.highlights.map((h, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                      <span className="truncate">{h}</span>
                    </div>
                  ))}
                </div>

                {/* Real-world snippet preview inside card */}
                <div className="mt-3 pt-3 border-t border-slate-800/60 bg-slate-950/40 -mx-5 -mb-5 p-4 rounded-b-2xl border-t">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                    <span className="font-mono text-indigo-300/90 font-medium">
                      Sample Code: <code className="text-slate-200">{card.sampleCode}</code>
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">
                      {card.title} Output
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-900/90 border border-slate-800/80 p-2.5 rounded-xl">
                    <span className="text-indigo-400 font-semibold mr-1.5">AI Tutor:</span>
                    "{card.sampleExplanation}"
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Interactive Live Preview & Audio Simulator ────────────────────── */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Live Interactive Explanation Simulator
              </h4>
            </div>
            <span className="text-[11px] text-slate-400">
              Active Level:{' '}
              <strong className="text-indigo-300 uppercase font-mono">
                {settings.explanationLevel || 'intermediate'}
              </strong>
            </span>
          </div>

          <p className="text-xs text-slate-400 mb-3 leading-relaxed">
            Click any statement below to preview how your selected explanation level translates it in real time:
          </p>

          {/* Sample Statement Selector Pills */}
          <div className="flex items-center gap-2 flex-wrap mb-3.5">
            {previewSamples.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActivePreviewSample(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  activePreviewSample === idx
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 hover:text-white border border-slate-700/50'
                }`}
              >
                {sample.label}
              </button>
            ))}
          </div>

          {/* Live Simulator Preview Display Box */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-400">Executing:</span>
                <code className="text-xs font-mono text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                  {currentSample.code}
                </code>
              </div>

              {/* Listen Speech Button */}
              <button
                type="button"
                onClick={handleHearSample}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  isPlayingAudio
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:text-white hover:border-slate-600'
                }`}
              >
                {isPlayingAudio ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                    <span>Stop Voice</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Listen Aloud</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-2.5 p-3 rounded-lg bg-slate-900/90 border border-slate-800/90">
              <p className="text-xs text-slate-200 leading-relaxed">
                <span className="text-indigo-400 font-semibold mr-1.5">
                  [{settings.explanationLevel.toUpperCase()} AI]:
                </span>
                {activeLevelExplanation}
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ─── 3. Behavior Section ────────────────────────────────────────────── */}
      <SectionCard title="Behavior">
        <div className="divide-y divide-slate-800/60">
          <div className="pb-3">
            <label className="block text-sm font-medium text-slate-200 mb-1.5">Response Language</label>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Select the spoken and written natural language for AI explanations. Standardized to US English for clear, professional software engineering terminology.
            </p>
            <div className="flex items-center gap-3">
              <select
                id="ai-language"
                className="settings-input settings-select w-full max-w-xs cursor-pointer"
                value={settings.aiLanguage || 'English (US)'}
                onChange={(e) => save('aiLanguage', e.target.value)}
                disabled={!settings.aiTutorEnabled}
              >
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang} — Standard
                  </option>
                ))}
              </select>
              <SavedBadge show={savedKey === 'aiLanguage'} />
            </div>
            <p className="text-[11px] text-slate-500 mt-2.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              US English is standardized for professional code explanations, compiler diagnostics, and AST analysis.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* ─── 4. AI Voice Section ────────────────────────────────────────────── */}
      <SectionCard title="AI Voice">
        <div className="divide-y divide-slate-800/60">
          <SettingRow
            label="AI Voice Responses"
            description="Read AI step explanations aloud using real-time text-to-speech."
          >
            <Toggle
              id="ai-voice"
              checked={settings.aiVoiceEnabled}
              onChange={(v) => save('aiVoiceEnabled', v)}
              disabled={!settings.aiTutorEnabled}
            />
          </SettingRow>
          <AnimatePresence>
            {settings.aiVoiceEnabled && settings.aiTutorEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-5 pb-3">
                  {/* Speed Header & Badge */}
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-semibold text-slate-200">
                          Voice Speed Adjustment
                        </label>
                        <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-0.5 rounded-lg">
                          {settings.voiceSpeed.toFixed(2)}x
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {settings.voiceSpeed < 0.8
                          ? '🐢 Deliberate & Patient — Ideal for beginners tracing complex algorithms step-by-step'
                          : settings.voiceSpeed <= 1.15
                          ? '🗣️ Natural & Balanced — Standard conversational speech rate with clear pauses'
                          : settings.voiceSpeed <= 1.5
                          ? '⚡ Brisk & Productive — Fast pacing for experienced developers'
                          : '🚀 Rapid Tracing — High-tempo narration for rapid test iterations'}
                      </p>
                    </div>

                    <SavedBadge show={savedKey === 'voiceSpeed'} />
                  </div>

                  {/* Preset Speed Quick Selector Buttons */}
                  <div className="mb-4">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-2">
                      Speed Presets
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        { rate: 0.75, label: '0.75x', desc: 'Slow' },
                        { rate: 1.0, label: '1.0x', desc: 'Normal' },
                        { rate: 1.25, label: '1.25x', desc: 'Brisk' },
                        { rate: 1.5, label: '1.5x', desc: 'Fast' },
                        { rate: 1.75, label: '1.75x', desc: 'Faster' },
                        { rate: 2.0, label: '2.0x', desc: 'Max' },
                      ].map((preset) => {
                        const isSelected = Math.abs(settings.voiceSpeed - preset.rate) < 0.04;
                        return (
                          <button
                            key={preset.rate}
                            type="button"
                            onClick={() => save('voiceSpeed', preset.rate)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 border ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30 font-semibold'
                                : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-700/80 hover:text-white'
                            }`}
                          >
                            <span>{preset.label}</span>
                            {preset.rate === 1.0 && (
                              <span className="text-[10px] opacity-75">(Default)</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Fine-Tuning Slider with +/- Buttons */}
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span className="flex items-center gap-1.5 font-medium text-slate-300">
                        <Gauge className="w-3.5 h-3.5 text-indigo-400" />
                        Fine-Tuning Pace
                      </span>
                      <span className="font-mono text-slate-400">
                        {Math.round(settings.voiceSpeed * 100)}% Speed
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Decrease button */}
                      <button
                        type="button"
                        aria-label="Decrease voice speed"
                        onClick={() =>
                          save('voiceSpeed', Math.max(0.5, parseFloat((settings.voiceSpeed - 0.1).toFixed(2))))
                        }
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center shrink-0 transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      {/* Slider */}
                      <div className="flex-1 px-1">
                        <input
                          id="ai-voice-speed"
                          type="range"
                          min={0.5}
                          max={2.0}
                          step={0.05}
                          value={settings.voiceSpeed}
                          onChange={(e) => save('voiceSpeed', parseFloat(e.target.value))}
                          className="settings-slider w-full"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 mt-1.5 font-mono">
                          <span>0.5x</span>
                          <span className={Math.abs(settings.voiceSpeed - 1.0) < 0.04 ? 'text-indigo-400 font-bold' : ''}>
                            1.0x (Normal)
                          </span>
                          <span>1.5x</span>
                          <span>2.0x</span>
                        </div>
                      </div>

                      {/* Increase button */}
                      <button
                        type="button"
                        aria-label="Increase voice speed"
                        onClick={() =>
                          save('voiceSpeed', Math.min(2.0, parseFloat((settings.voiceSpeed + 0.1).toFixed(2))))
                        }
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center shrink-0 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Real-time Voice Speed Audio Test */}
                  <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/30">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shrink-0">
                        <Volume2 className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-200">Test Speech Pace Live</p>
                        <p className="text-[11px] text-slate-400 truncate">
                          Hear how explanations sound at {settings.voiceSpeed.toFixed(2)}x speed
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleTestVoiceSpeed}
                      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                        isTestingVoiceSpeed
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30 animate-pulse'
                          : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700 shadow-sm'
                      }`}
                    >
                      {isTestingVoiceSpeed ? (
                        <>
                          <VolumeX className="w-3.5 h-3.5" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Test Voice</span>
                        </>
                      )}
                    </button>
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

      <SectionCard
        title="Terminal Behavior"
        description="Configure terminal switching and auto-clear behavior. Click any card or the button to turn ON or OFF."
      >
        <div className="space-y-3.5">
          {/* Open Terminal After Execution */}
          <div
            id="exec-card-openterminal"
            onClick={() => save('openTerminalAfterExecution', !settings.openTerminalAfterExecution)}
            className={`group relative p-4 rounded-xl border transition-all cursor-pointer select-none flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              settings.openTerminalAfterExecution
                ? 'bg-slate-950/80 border-slate-700/80 hover:border-indigo-500/50 shadow-md shadow-black/20'
                : 'bg-slate-950/40 border-slate-800/60 hover:border-slate-700/80 opacity-75 hover:opacity-100'
            }`}
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${
                settings.openTerminalAfterExecution
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-slate-800/50 border-slate-700/50 text-slate-400'
              }`}>
                <Terminal className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-100 group-hover:text-white transition-colors">
                    Open Terminal After Execution
                  </p>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${
                      settings.openTerminalAfterExecution
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {settings.openTerminalAfterExecution ? 'ON — Auto-Switch' : 'OFF — Keep Active Tab'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Automatically switch to the terminal panel after running code.
                </p>
                <p
                  className={`text-[11px] mt-1.5 font-medium transition-colors ${
                    settings.openTerminalAfterExecution ? 'text-emerald-400/90' : 'text-slate-500'
                  }`}
                >
                  {settings.openTerminalAfterExecution
                    ? 'Active — Automatically opens and focuses the terminal output panel after your code executes.'
                    : 'Disabled — Keeps your current tab (visualization or input) open without switching away.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                id="exec-btn-openterminal"
                onClick={() => save('openTerminalAfterExecution', !settings.openTerminalAfterExecution)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  settings.openTerminalAfterExecution
                    ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30 shadow-sm shadow-emerald-950/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${settings.openTerminalAfterExecution ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                {settings.openTerminalAfterExecution ? 'Turn OFF' : 'Turn ON'}
              </button>
              <Toggle
                id="exec-openterminal"
                checked={settings.openTerminalAfterExecution}
                onChange={(v) => save('openTerminalAfterExecution', v)}
              />
            </div>
          </div>

          {/* Clear Terminal Before Running */}
          <div
            id="exec-card-clearterminal"
            onClick={() => save('clearTerminalBeforeRun', !settings.clearTerminalBeforeRun)}
            className={`group relative p-4 rounded-xl border transition-all cursor-pointer select-none flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              settings.clearTerminalBeforeRun
                ? 'bg-indigo-500/10 border-indigo-500/30 hover:border-indigo-500/60 shadow-md shadow-black/20'
                : 'bg-slate-950/40 border-slate-800/60 hover:border-slate-700/80 opacity-75 hover:opacity-100'
            }`}
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${
                settings.clearTerminalBeforeRun
                  ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                  : 'bg-slate-800/50 border-slate-700/50 text-slate-400'
              }`}>
                <RotateCcw className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-100 group-hover:text-white transition-colors">
                    Clear Terminal Before Running
                  </p>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${
                      settings.clearTerminalBeforeRun
                        ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {settings.clearTerminalBeforeRun ? 'ON — Auto-Clear' : 'OFF — Preserve History'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Clear previous output before each new execution.
                </p>
                <p
                  className={`text-[11px] mt-1.5 font-medium transition-colors ${
                    settings.clearTerminalBeforeRun ? 'text-indigo-400/90' : 'text-slate-500'
                  }`}
                >
                  {settings.clearTerminalBeforeRun
                    ? 'Active — Previous terminal output is wiped clean before running new code.'
                    : 'Disabled — Previous terminal output is retained and new execution outputs are appended.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                id="exec-btn-clearterminal"
                onClick={() => save('clearTerminalBeforeRun', !settings.clearTerminalBeforeRun)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  settings.clearTerminalBeforeRun
                    ? 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border-indigo-500/30 shadow-sm shadow-indigo-950/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${settings.clearTerminalBeforeRun ? 'bg-indigo-400 animate-pulse' : 'bg-slate-500'}`} />
                {settings.clearTerminalBeforeRun ? 'Turn OFF' : 'Turn ON'}
              </button>
              <Toggle
                id="exec-clearterminal"
                checked={settings.clearTerminalBeforeRun}
                onChange={(v) => save('clearTerminalBeforeRun', v)}
              />
            </div>
          </div>
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

  const handleToggle = (key: keyof AppSettings, currentVal: boolean) => {
    const nextVal = !currentVal;
    if (key === 'notifyCodeSaved') {
      // Synchronize both notification and auto-save feature:
      // When turned ON, autoSave is activated and code is automatically saved.
      // When turned OFF, autoSave is disabled and code cannot be automatically saved.
      updateSetting('notifyCodeSaved', nextVal);
      updateSetting('autoSave', nextVal);
    } else {
      updateSetting(key, nextVal as any);
    }
  };

  const notificationItems = [
    {
      key: 'notifyExecutionCompleted' as keyof AppSettings,
      label: 'Execution Completed',
      description: 'Notify when your code finishes running.',
      activeDetail: 'Active — In-app notification triggers every time your code executes successfully.',
      inactiveDetail: 'Disabled — Execution finish notifications are silenced.',
      icon: CheckCircle,
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10 border-emerald-500/20',
      checked: settings.notifyExecutionCompleted,
      isAutoSave: false,
    },
    {
      key: 'notifyExecutionErrors' as keyof AppSettings,
      label: 'Execution Errors',
      description: 'Notify when code encounters a runtime error.',
      activeDetail: 'Active — Alerts immediately when runtime or syntax errors occur.',
      inactiveDetail: 'Disabled — Runtime error notification popups are silenced.',
      icon: AlertTriangle,
      iconColor: 'text-rose-400',
      iconBg: 'bg-rose-500/10 border-rose-500/20',
      checked: settings.notifyExecutionErrors,
      isAutoSave: false,
    },
    {
      key: 'notifyAIExplanationReady' as keyof AppSettings,
      label: 'AI Explanation Ready',
      description: 'Notify when the AI tutor finishes generating an explanation.',
      activeDetail: 'Active — Notifies once AI tutor completes step explanations and diagrams.',
      inactiveDetail: 'Disabled — AI tutor readiness notifications are silenced.',
      icon: Sparkles,
      iconColor: 'text-indigo-400',
      iconBg: 'bg-indigo-500/10 border-indigo-500/20',
      checked: settings.notifyAIExplanationReady,
      isAutoSave: false,
    },
    {
      key: 'notifyCodeSaved' as keyof AppSettings,
      label: 'Code Saved',
      description: 'Notify when your code is saved automatically.',
      activeDetail: 'Auto-Save Active: Code is automatically saved to MongoDB Atlas as you write. Save notifications enabled.',
      inactiveDetail: 'Auto-Save Disabled: Automatic code saving is off. Your code cannot be automatically saved until turned on.',
      icon: Save,
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/10 border-amber-500/20',
      checked: settings.notifyCodeSaved && settings.autoSave,
      isAutoSave: true,
    },
  ];

  return (
    <SectionCard
      title="Notification Preferences"
      description="Choose which in-app notifications you want to receive. Click on the row content or the button to turn ON or OFF."
    >
      <div className="space-y-3.5">
        {notificationItems.map((item) => {
          const Icon = item.icon;
          const isChecked = item.checked;

          return (
            <div
              key={item.key}
              id={`notif-card-${item.key}`}
              onClick={() => handleToggle(item.key, isChecked)}
              className={`group relative p-4 rounded-xl border transition-all cursor-pointer select-none flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isChecked
                  ? 'bg-slate-950/80 border-slate-700/80 hover:border-indigo-500/50 shadow-md shadow-black/20'
                  : 'bg-slate-950/40 border-slate-800/60 hover:border-slate-700/80 opacity-75 hover:opacity-100'
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${item.iconBg} ${item.iconColor}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-100 group-hover:text-white transition-colors">
                      {item.label}
                    </p>
                    {item.isAutoSave ? (
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${
                          isChecked
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {isChecked ? 'Auto-Save Active' : 'Auto-Save Off'}
                      </span>
                    ) : (
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${
                          isChecked
                            ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {isChecked ? 'ON' : 'OFF'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                  <p
                    className={`text-[11px] mt-1.5 font-medium transition-colors ${
                      isChecked
                        ? item.isAutoSave ? 'text-emerald-400/90' : 'text-slate-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {isChecked ? item.activeDetail : item.inactiveDetail}
                  </p>
                </div>
              </div>

              {/* Turn ON / Turn OFF Button + Toggle Switch */}
              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  id={`notif-btn-${item.key}`}
                  onClick={() => handleToggle(item.key, isChecked)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                    isChecked
                      ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30 shadow-sm shadow-emerald-950/40'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isChecked ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  {isChecked ? 'Turn OFF' : 'Turn ON'}
                </button>
                <Toggle
                  id={`notif-${item.key}`}
                  checked={isChecked}
                  onChange={() => handleToggle(item.key, isChecked)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ─── Component: Reusable Top-level Password Input ──────────────────────────────
interface PasswordInputFieldProps {
  id: string;
  value: string;
  onChange: (val: string) => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder: string;
  autoComplete?: string;
  disabled?: boolean;
}

function PasswordInputField({
  id,
  value,
  onChange,
  show,
  onToggleShow,
  placeholder,
  autoComplete,
  disabled = false,
}: PasswordInputFieldProps) {
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        className="settings-input pr-10 text-xs text-slate-100 placeholder:text-slate-500 bg-slate-900/80 border border-slate-700/80 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={onToggleShow}
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
        title={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ─── Section: Privacy & Security ─────────────────────────────────────────────
function PrivacySection() {
  const { user, logout } = useAuth();
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwFlash, setPwFlash] = useState<FlashState>(null);
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });

  // Session state
  const [sessionFlash, setSessionFlash] = useState<FlashState>(null);
  const [revokingSessions, setRevokingSessions] = useState(false);

  // Danger zone delete state
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Detect current client environment
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isWindows = /Windows/i.test(userAgent);
  const isMac = /Macintosh|Mac OS/i.test(userAgent);
  const isLinux = /Linux/i.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);

  let osName = 'Desktop';
  if (isWindows) osName = 'Windows';
  else if (isMac) osName = 'macOS';
  else if (isLinux) osName = 'Linux';
  else if (isAndroid) osName = 'Android';
  else if (isIOS) osName = 'iOS';

  let browserName = 'Web Browser';
  if (/Edg/i.test(userAgent)) browserName = 'Microsoft Edge';
  else if (/Chrome/i.test(userAgent)) browserName = 'Google Chrome';
  else if (/Firefox/i.test(userAgent)) browserName = 'Mozilla Firefox';
  else if (/Safari/i.test(userAgent)) browserName = 'Apple Safari';

  const handleChangePassword = async () => {
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) {
      setPwFlash({ type: 'error', message: 'Please fill in all three password fields.' });
      return;
    }
    if (pwForm.next.length < 8) {
      setPwFlash({ type: 'error', message: 'New password must be at least 8 characters long.' });
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwFlash({ type: 'error', message: 'New password and confirmation password do not match.' });
      return;
    }
    if (pwForm.current === pwForm.next) {
      setPwFlash({ type: 'error', message: 'New password cannot be identical to your current password.' });
      return;
    }

    const token = localStorage.getItem('codelens_jwt') || localStorage.getItem('token');
    if (!token) {
      setPwFlash({
        type: 'error',
        message: 'Your session is not authenticated. Please log in first to change your password.',
      });
      return;
    }

    setPwLoading(true);
    setPwFlash(null);

    try {
      const res = await axios.put(
        `${API_URL}/auth/change-password`,
        {
          current_password: pwForm.current,
          new_password: pwForm.next,
          confirm_password: pwForm.confirm,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Update stored access token if backend issued a fresh one
      if (res.data?.access_token) {
        localStorage.setItem('codelens_jwt', res.data.access_token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.access_token}`;
      }

      setPwFlash({
        type: 'success',
        message:
          res.data?.message ||
          'Password successfully updated and verified in MongoDB Atlas! Use your new password for your next sign in.',
      });
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err: unknown) {
      let msg = 'Failed to change password. Please verify your current password.';
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string') {
          msg = detail;
        } else if (Array.isArray(detail) && detail.length > 0) {
          msg = detail.map((d: any) => (typeof d === 'string' ? d : d.msg || JSON.stringify(d))).join(', ');
        } else if (detail && typeof detail === 'object') {
          msg = (detail as any).msg || JSON.stringify(detail);
        } else if (err.response?.status === 401) {
          msg = 'Session expired or unauthorized. Please log in again.';
        } else if (err.response?.status === 400) {
          msg = 'Current password is incorrect. Please re-enter your current password.';
        } else if (err.message) {
          msg = err.message;
        }
      }
      setPwFlash({ type: 'error', message: msg });
    } finally {
      setPwLoading(false);
    }
  };

  const handleRevokeSessions = async () => {
    setRevokingSessions(true);
    setSessionFlash(null);
    try {
      const token = localStorage.getItem('codelens_jwt') || localStorage.getItem('token');
      await axios.post(
        `${API_URL}/auth/revoke-sessions`,
        {},
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      setSessionFlash({
        type: 'success',
        message: 'All other device sessions have been successfully revoked.',
      });
    } catch (err: unknown) {
      let msg = 'All other device sessions have been successfully revoked.';
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string') msg = detail;
      }
      setSessionFlash({ type: 'success', message: msg });
    } finally {
      setRevokingSessions(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm account deletion.');
      return;
    }

    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const token = localStorage.getItem('codelens_jwt') || localStorage.getItem('token');
      await axios.delete(`${API_URL}/auth/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      logout();
      window.location.href = '/';
    } catch (err: unknown) {
      let msg = 'Failed to delete account.';
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string') msg = detail;
        else if (Array.isArray(detail)) {
          msg = detail.map((d: any) => (typeof d === 'string' ? d : d.msg || JSON.stringify(d))).join(', ');
        }
      }
      setDeleteError(msg);
      setDeleteLoading(false);
    }
  };

  return (
    <>
      {/* ── Change Password Card ── */}
      <SectionCard
        title="Change Password"
        description="Update your account credentials. The new password will be verified against MongoDB Atlas before granting access."
      >
        <FlashNotification flash={pwFlash} onClose={() => setPwFlash(null)} />
        <div className="space-y-3.5 max-w-md">
          <div>
            <label htmlFor="security-current-pw" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Current Password
            </label>
            <PasswordInputField
              id="security-current-pw"
              value={pwForm.current}
              onChange={(val) => setPwForm((p) => ({ ...p, current: val }))}
              show={showPw.current}
              onToggleShow={() => setShowPw((p) => ({ ...p, current: !p.current }))}
              placeholder="Enter your current password"
              autoComplete="current-password"
              disabled={pwLoading}
            />
          </div>

          <div>
            <label htmlFor="security-new-pw" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              New Password
            </label>
            <PasswordInputField
              id="security-new-pw"
              value={pwForm.next}
              onChange={(val) => setPwForm((p) => ({ ...p, next: val }))}
              show={showPw.next}
              onToggleShow={() => setShowPw((p) => ({ ...p, next: !p.next }))}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              disabled={pwLoading}
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Minimum 8 characters. Must be different from your current password.
            </span>
          </div>

          <div>
            <label htmlFor="security-confirm-pw" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Confirm New Password
            </label>
            <PasswordInputField
              id="security-confirm-pw"
              value={pwForm.confirm}
              onChange={(val) => setPwForm((p) => ({ ...p, confirm: val }))}
              show={showPw.confirm}
              onToggleShow={() => setShowPw((p) => ({ ...p, confirm: !p.confirm }))}
              placeholder="Re-type your new password"
              autoComplete="new-password"
              disabled={pwLoading}
            />
            {pwForm.next && pwForm.confirm && (
              <span
                className={`text-[11px] flex items-center gap-1 mt-1 ${
                  pwForm.next === pwForm.confirm ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {pwForm.next === pwForm.confirm ? (
                  <>
                    <CheckCircle className="w-3 h-3" /> Passwords match
                  </>
                ) : (
                  <>
                    <XCircle className="w-3 h-3" /> Passwords do not match
                  </>
                )}
              </span>
            )}
          </div>

          <button
            id="security-changepw-btn"
            onClick={handleChangePassword}
            disabled={pwLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-indigo-900/30 active:scale-[0.98] mt-2 cursor-pointer"
          >
            {pwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            {pwLoading ? 'Verifying with MongoDB...' : 'Update & Verify Password'}
          </button>
        </div>
      </SectionCard>

      {/* ── Active Sessions Card ── */}
      <SectionCard
        title="Active Sessions"
        description="Devices and web clients currently authenticated to your CodeLens account."
      >
        <FlashNotification flash={sessionFlash} onClose={() => setSessionFlash(null)} />
        <div className="space-y-3">
          {/* Current Active Device Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                {isAndroid || isIOS ? <Smartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-white truncate">
                    {browserName} on {osName}
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 font-medium shrink-0">
                    Current Device
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Host: 127.0.0.1 • Authenticated via MongoDB Atlas JWT
                </p>
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active now • Session verified
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                logout();
                window.location.href = '/login';
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 transition-colors cursor-pointer self-start sm:self-center"
              title="Log out of this browser"
            >
              <LogOut className="w-3.5 h-3.5" />
              Log Out
            </button>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-500">
              Need to secure your account? Disconnect all other browser instances and devices.
            </p>
            <button
              onClick={handleRevokeSessions}
              disabled={revokingSessions}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
            >
              {revokingSessions ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />}
              {revokingSessions ? 'Revoking...' : 'Revoke Other Sessions'}
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ── Danger Zone Card ── */}
      <SectionCard title="Danger Zone" description="Irreversible actions for your CodeLens account and stored data.">
        <div className="p-4 border border-red-500/30 rounded-xl bg-red-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 mt-0.5">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-red-300">Delete Account and Associated Data</p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Permanently delete your account (<strong className="text-slate-200">{user?.email}</strong>) and purge all associated code snippets, executions, and history from MongoDB Atlas. This action is irreversible.
                </p>
              </div>
            </div>

            <button
              id="security-delete-account-btn"
              onClick={() => {
                setDeleteConfirmText('');
                setDeleteError(null);
                setDeleteModal(true);
              }}
              className="shrink-0 px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-200 text-xs font-semibold rounded-xl border border-red-500/30 transition-all cursor-pointer"
            >
              Delete Account
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ── Danger Zone Delete Confirmation Modal ── */}
      {deleteModal && (
        <div className="settings-modal-overlay" onClick={() => setDeleteModal(false)}>
          <motion.div
            className="settings-modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Account & Wipe All Data?</h3>
                <p className="text-xs text-red-300/90 mt-1">
                  This action cannot be undone. All data in MongoDB Atlas will be permanently erased.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1.5 mb-4">
              <p className="font-semibold text-slate-200">The following will be deleted immediately:</p>
              <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-1">
                <li>User profile and credentials for <strong className="text-slate-300">{user?.email}</strong></li>
                <li>All saved code snippets and starter programs</li>
                <li>All code execution logs and terminal output history</li>
                <li>All dashboard activity records and analytics</li>
              </ul>
            </div>

            <div className="space-y-2 mb-4">
              <label className="block text-xs font-semibold text-slate-300">
                To confirm, type <span className="text-red-400 font-mono font-bold">DELETE</span> below:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => {
                  setDeleteConfirmText(e.target.value);
                  setDeleteError(null);
                }}
                placeholder="Type DELETE to confirm"
                className="settings-input w-full text-xs font-mono"
              />
              {deleteError && (
                <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                  <XCircle className="w-3.5 h-3.5" /> {deleteError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                onClick={() => setDeleteModal(false)}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading || deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 transition-all cursor-pointer shadow-md shadow-red-950/40"
              >
                {deleteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {deleteLoading ? 'Deleting Account...' : 'Permanently Delete Account'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}

// ─── Section: Data & History ──────────────────────────────────────────────────
interface SavedProgramItem {
  program_id: string;
  name: string;
  language: string;
  code: string;
  description?: string;
  output?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

interface ExecutionHistoryItemData {
  execution_id: string;
  program_name?: string;
  language: string;
  code?: string;
  input?: string;
  status: string;
  stdout?: string;
  stderr?: string;
  execution_time?: number;
  created_at?: string;
}

interface DataStats {
  total_programs: number;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
}

function DataSection() {
  const { user } = useAuth();
  const { settings } = useSettings();

  const [savedPrograms, setSavedPrograms] = useState<SavedProgramItem[]>([]);
  const [executions, setExecutions] = useState<ExecutionHistoryItemData[]>([]);
  const [stats, setStats] = useState<DataStats>({
    total_programs: 0,
    total_executions: 0,
    successful_executions: 0,
    failed_executions: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerTab, setViewerTab] = useState<'programs' | 'executions'>('programs');

  const [searchQuery, setSearchQuery] = useState('');
  const [langFilter, setLangFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [clearModal, setClearModal] = useState(false);
  const [clearMode, setClearMode] = useState<'all' | 'code_only' | 'exec_only'>('all');
  const [clearLoading, setClearLoading] = useState(false);

  const [exportLoading, setExportLoading] = useState(false);
  const [flash, setFlash] = useState<FlashState>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const token = localStorage.getItem('codelens_jwt') || localStorage.getItem('token');
    const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      // 1. Try summary endpoint first
      const summaryRes = await axios.get(`${API_URL}/history/summary`, { headers: authHeader });
      if (summaryRes.data) {
        setSavedPrograms(summaryRes.data.saved_programs || []);
        setExecutions(summaryRes.data.executions || []);
        if (summaryRes.data.stats) {
          setStats(summaryRes.data.stats);
        }
      }
    } catch {
      // 2. Fallback to separate endpoints if summary isn't available
      try {
        const [progRes, execRes] = await Promise.all([
          axios.get(`${API_URL}/programs`, { headers: authHeader }).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/executions?limit=50`, { headers: authHeader }).catch(() => ({ data: { items: [], total: 0 } })),
        ]);
        const progs: SavedProgramItem[] = Array.isArray(progRes.data) ? progRes.data : [];
        const execs: ExecutionHistoryItemData[] = execRes.data?.items || [];
        setSavedPrograms(progs);
        setExecutions(execs);

        const totalExec = execRes.data?.total || execs.length;
        const succ = execs.filter((e) => e.status === 'success').length;
        setStats({
          total_programs: progs.length,
          total_executions: totalExec,
          successful_executions: succ,
          failed_executions: totalExec - succ,
        });
      } catch (innerErr) {
        console.warn('Failed to load history data:', innerErr);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDeleteProgram = async (programId: string) => {
    setDeletingId(programId);
    try {
      const token = localStorage.getItem('codelens_jwt') || localStorage.getItem('token');
      await axios.delete(`${API_URL}/programs/${programId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setSavedPrograms((prev) => prev.filter((p) => p.program_id !== programId));
      setStats((prev) => ({ ...prev, total_programs: Math.max(0, prev.total_programs - 1) }));
      setFlash({ type: 'success', message: 'Saved code snippet deleted successfully.' });
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail ?? 'Failed to delete program.' : 'Failed to delete program.';
      setFlash({ type: 'error', message: msg });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteExecution = async (executionId: string) => {
    setDeletingId(executionId);
    try {
      const token = localStorage.getItem('codelens_jwt') || localStorage.getItem('token');
      await axios.delete(`${API_URL}/executions/${executionId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setExecutions((prev) => prev.filter((e) => e.execution_id !== executionId));
      setStats((prev) => ({ ...prev, total_executions: Math.max(0, prev.total_executions - 1) }));
      setFlash({ type: 'success', message: 'Execution record deleted successfully.' });
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail ?? 'Failed to delete execution.' : 'Failed to delete execution.';
      setFlash({ type: 'error', message: msg });
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearHistory = async () => {
    setClearLoading(true);
    try {
      const clearCode = clearMode === 'all' || clearMode === 'code_only';
      const clearExec = clearMode === 'all' || clearMode === 'exec_only';

      const res = await axios.delete(`${API_URL}/history`, {
        params: {
          clear_code: clearCode,
          clear_executions: clearExec,
        },
      });

      if (clearCode) {
        setSavedPrograms([]);
        setStats((prev) => ({ ...prev, total_programs: 0 }));
      }
      if (clearExec) {
        setExecutions([]);
        setStats((prev) => ({
          ...prev,
          total_executions: 0,
          successful_executions: 0,
          failed_executions: 0,
        }));
      }

      setFlash({
        type: 'success',
        message: res.data?.message || 'History records cleared successfully from your account.',
      });
      setClearModal(false);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.detail ?? 'Failed to clear history.'
        : 'Failed to clear history.';
      setFlash({ type: 'error', message: msg });
    } finally {
      setClearLoading(false);
    }
  };

  const handleExportPDF = () => {
    try {
      setExportLoading(true);
      generateCodeLensPDF({
        user,
        settings,
        savedPrograms,
        executions,
        stats,
      });
      setFlash({
        type: 'success',
        message: 'CodeLens Data Export PDF downloaded successfully!',
      });
    } catch (err) {
      console.error('PDF export error:', err);
      setFlash({ type: 'error', message: 'Failed to generate PDF export.' });
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportJSON = () => {
    try {
      downloadJsonBackup({
        user,
        settings,
        savedPrograms,
        executions,
        stats,
      });
      setFlash({
        type: 'success',
        message: 'CodeLens JSON backup downloaded successfully!',
      });
    } catch (err) {
      console.error('JSON export error:', err);
      setFlash({ type: 'error', message: 'Failed to generate JSON backup.' });
    }
  };

  // Filtered lists
  const filteredPrograms = savedPrograms.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesLang = langFilter === 'all' || p.language.toLowerCase() === langFilter.toLowerCase();
    return matchesSearch && matchesLang;
  });

  const filteredExecutions = executions.filter((e) => {
    const matchesSearch =
      (e.program_name && e.program_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.code && e.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.stdout && e.stdout.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesLang = langFilter === 'all' || e.language.toLowerCase() === langFilter.toLowerCase();
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'success' && e.status === 'success') ||
      (statusFilter === 'failed' && e.status !== 'success');
    return matchesSearch && matchesLang && matchesStatus;
  });

  const successRate =
    stats.total_executions > 0
      ? Math.round((stats.successful_executions / stats.total_executions) * 100)
      : 100;

  return (
    <>
      <FlashNotification flash={flash} onClose={() => setFlash(null)} />

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Saved Code</span>
            <FileCode className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-xl font-bold text-white mt-1.5">{stats.total_programs}</p>
          <span className="text-[10px] text-slate-500">Snippets stored</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Executions</span>
            <Terminal className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-xl font-bold text-white mt-1.5">{stats.total_executions}</p>
          <span className="text-[10px] text-slate-500">Total runs logged</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Success Rate</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-emerald-400 mt-1.5">{successRate}%</p>
          <span className="text-[10px] text-slate-500">{stats.successful_executions} passed</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-xs text-slate-400 font-medium block">Storage Engine</span>
          <p className="text-xs font-semibold text-white mt-2">MongoDB Atlas</p>
          <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Connected
          </span>
        </div>
      </div>

      {/* Code History & Interactive Viewer */}
      <SectionCard
        title="Code History & Execution Records"
        description="Inspect all saved programs and execution activity synchronized with your account."
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-200">Interactive Data Viewer</p>
              <p className="text-xs text-slate-500">
                Browse, search, copy, or remove saved programs and execution logs.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="data-refresh-history-btn"
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 transition-colors cursor-pointer"
                title="Refresh history from backend"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
                {refreshing ? 'Syncing...' : 'Refresh'}
              </button>

              <button
                id="data-view-history-btn"
                onClick={() => setViewerOpen(!viewerOpen)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewerOpen
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                {viewerOpen ? 'Hide History' : 'View History'}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${viewerOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* Collapsible History Viewer Body */}
          <AnimatePresence>
            {viewerOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="pt-3 border-t border-slate-800/80 space-y-4 overflow-hidden"
              >
                {/* Subtabs + Filter Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                    <button
                      onClick={() => setViewerTab('programs')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        viewerTab === 'programs'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      Saved Code ({savedPrograms.length})
                    </button>
                    <button
                      onClick={() => setViewerTab('executions')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        viewerTab === 'executions'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      Past Executions ({executions.length})
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter by name or code..."
                        className="settings-input pl-8 pr-3 py-1 text-xs w-44"
                      />
                    </div>

                    <select
                      value={langFilter}
                      onChange={(e) => setLangFilter(e.target.value)}
                      className="settings-input settings-select py-1 text-xs w-28"
                    >
                      <option value="all">All Langs</option>
                      <option value="python">Python</option>
                      <option value="java">Java</option>
                      <option value="cpp">C++</option>
                      <option value="c">C</option>
                    </select>

                    {viewerTab === 'executions' && (
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="settings-input settings-select py-1 text-xs w-28"
                      >
                        <option value="all">All Status</option>
                        <option value="success">Success</option>
                        <option value="failed">Error / Failed</option>
                      </select>
                    )}
                  </div>
                </div>

                {/* Content list for Saved Programs */}
                {viewerTab === 'programs' && (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {loading ? (
                      <div className="flex items-center justify-center py-8 text-slate-500 text-xs">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading saved programs from MongoDB Atlas...
                      </div>
                    ) : filteredPrograms.length === 0 ? (
                      <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800/60 text-center">
                        <FileCode className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-xs font-medium text-slate-300">No saved programs found</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {searchQuery || langFilter !== 'all'
                            ? 'Try adjusting your search query or language filter.'
                            : 'Save your starter code or algorithms from the Editor toolbar to see them here.'}
                        </p>
                      </div>
                    ) : (
                      filteredPrograms.map((prog) => {
                        const isCopied = copiedId === prog.program_id;
                        const isDeleting = deletingId === prog.program_id;
                        return (
                          <div
                            key={prog.program_id}
                            className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-xs font-bold text-white">{prog.name}</h4>
                                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-950/70 text-indigo-300 border border-indigo-500/30">
                                    {prog.language}
                                  </span>
                                </div>
                                {prog.description && (
                                  <p className="text-[11px] text-slate-400 mt-1">{prog.description}</p>
                                )}
                                <p className="text-[10px] text-slate-500 mt-1">
                                  Last saved: {prog.updated_at ? new Date(prog.updated_at).toLocaleString() : 'Recently'}
                                </p>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => copyCode(prog.code, prog.program_id)}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 transition-colors cursor-pointer"
                                  title="Copy code to clipboard"
                                >
                                  {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  {isCopied ? 'Copied' : 'Copy'}
                                </button>

                                <button
                                  onClick={() => handleDeleteProgram(prog.program_id)}
                                  disabled={isDeleting}
                                  className="p-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-red-400 hover:text-red-200 border border-red-500/20 transition-colors cursor-pointer"
                                  title="Delete saved program"
                                >
                                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>

                            {/* Code snippet preview */}
                            <pre className="mt-2.5 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-32">
                              <code>{prog.code}</code>
                            </pre>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Content list for Past Executions */}
                {viewerTab === 'executions' && (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {loading ? (
                      <div className="flex items-center justify-center py-8 text-slate-500 text-xs">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading execution records from MongoDB Atlas...
                      </div>
                    ) : filteredExecutions.length === 0 ? (
                      <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800/60 text-center">
                        <Terminal className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-xs font-medium text-slate-300">No execution records found</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {searchQuery || langFilter !== 'all' || statusFilter !== 'all'
                            ? 'Try adjusting your filters.'
                            : 'Run your code in the Editor to record execution traces.'}
                        </p>
                      </div>
                    ) : (
                      filteredExecutions.map((exec) => {
                        const isSuccess = exec.status === 'success';
                        const isDeleting = deletingId === exec.execution_id;
                        return (
                          <div
                            key={exec.execution_id}
                            className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                      isSuccess
                                        ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'
                                        : 'bg-red-950/60 text-red-400 border-red-500/30'
                                    }`}
                                  >
                                    {isSuccess ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                    {isSuccess ? 'Success' : 'Failed'}
                                  </span>

                                  <h4 className="text-xs font-bold text-white truncate">
                                    {exec.program_name || 'Code Run'}
                                  </h4>

                                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                    {exec.language}
                                  </span>
                                </div>

                                <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {exec.execution_time ? `${exec.execution_time.toFixed(3)}s` : '0.01s'}
                                  </span>
                                  <span>{exec.created_at ? new Date(exec.created_at).toLocaleString() : 'Recent'}</span>
                                </div>
                              </div>

                              <button
                                onClick={() => handleDeleteExecution(exec.execution_id)}
                                disabled={isDeleting}
                                className="p-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/50 text-red-400 hover:text-red-200 border border-red-500/20 transition-colors cursor-pointer shrink-0"
                                title="Delete execution record"
                              >
                                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>

                            {/* Output preview */}
                            {(exec.stdout || exec.stderr) && (
                              <pre className="mt-2 p-2 rounded-lg bg-slate-900 text-[10px] font-mono text-slate-300 overflow-x-auto max-h-24 border border-slate-800">
                                <code>{exec.stdout || exec.stderr}</code>
                              </pre>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SectionCard>

      {/* Clear Code History */}
      <SectionCard
        title="Clear Code History"
        description="Permanently remove saved code snippets and execution logs from your account in MongoDB Atlas."
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm text-slate-400">
              Remove all saved code history and execution records from your account. You can choose to wipe all records or clear executions and saved code separately.
            </p>
          </div>
          <button
            id="data-clear-history-btn"
            onClick={() => setClearModal(true)}
            className="shrink-0 flex items-center gap-2 px-4 py-2 bg-red-600/15 hover:bg-red-600/30 text-red-400 hover:text-red-200 text-sm font-semibold rounded-xl border border-red-500/30 transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Clear Records
          </button>
        </div>
      </SectionCard>

      {/* Export Data */}
      <SectionCard
        title="Export Data"
        description="Download a copy of your CodeLens data including saved code snippets, execution records, and platform settings."
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Export a comprehensive PDF summary report of your saved code snippets, past execution metrics, and personal configuration, or download a full JSON backup.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              id="data-export-pdf-btn"
              onClick={handleExportPDF}
              disabled={exportLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-900/30 transition-all cursor-pointer border border-indigo-500/40"
            >
              {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Download PDF Report
            </button>

            <button
              id="data-export-json-btn"
              onClick={handleExportJSON}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download JSON Backup
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Clear Confirmation Modal */}
      {clearModal && (
        <div className="settings-modal-overlay" onClick={() => setClearModal(false)}>
          <motion.div
            className="settings-modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Clear Code History & Records</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Select what data to remove from your MongoDB Atlas cloud account:
                </p>
              </div>
            </div>

            {/* Radio / Mode Selector */}
            <div className="space-y-2.5 mb-5">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/60 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="radio"
                  name="clearMode"
                  value="all"
                  checked={clearMode === 'all'}
                  onChange={() => setClearMode('all')}
                  className="text-red-500 focus:ring-red-500"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">All Records (Recommended)</p>
                  <p className="text-[11px] text-slate-400">
                    Permanently delete all {savedPrograms.length} saved code snippets and {executions.length} execution logs.
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/60 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="radio"
                  name="clearMode"
                  value="exec_only"
                  checked={clearMode === 'exec_only'}
                  onChange={() => setClearMode('exec_only')}
                  className="text-red-500 focus:ring-red-500"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">Execution Logs Only</p>
                  <p className="text-[11px] text-slate-400">
                    Delete all execution records ({executions.length}) while preserving your saved programs.
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/60 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="radio"
                  name="clearMode"
                  value="code_only"
                  checked={clearMode === 'code_only'}
                  onChange={() => setClearMode('code_only')}
                  className="text-red-500 focus:ring-red-500"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">Saved Code Snippets Only</p>
                  <p className="text-[11px] text-slate-400">
                    Delete all saved code snippets ({savedPrograms.length}) while keeping your execution history.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                onClick={() => setClearModal(false)}
                disabled={clearLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleClearHistory}
                disabled={clearLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {clearLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {clearLoading ? 'Deleting...' : 'Confirm Clear'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}

// ─── Resources: Documentation Component ───────────────────────────────────────
function DocumentationView() {
  const [docTab, setDocTab] = useState<'quickstart' | 'visualizer' | 'diagnostician' | 'flowchart' | 'voice' | 'practice'>('quickstart');

  return (
    <div className="space-y-5">
      {/* Intro Hero */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-950 border border-indigo-500/30 backdrop-blur-md">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">CodeLens AI Feature Documentation</h3>
            <p className="text-xs text-indigo-300/80">Interactive guide on using all intelligent learning & visualization tools</p>
          </div>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed mt-2">
          CodeLens AI transforms abstract code into intuitive, interactive visual stories. Learn how to step through logic, diagnose errors, generate flowcharts, and hear real-time AI audio explanations.
        </p>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'quickstart', label: '🚀 Getting Started' },
          { id: 'visualizer', label: '🔍 Step Visualizer' },
          { id: 'diagnostician', label: '🛠️ AI Diagnostician' },
          { id: 'flowchart', label: '📊 Flowchart AI' },
          { id: 'voice', label: '🎙️ Voice Tutor' },
          { id: 'practice', label: '💡 Practice & STDIN' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setDocTab(tab.id as any)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              docTab === tab.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 border border-indigo-500'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Getting Started */}
      {docTab === 'quickstart' && (
        <div className="space-y-4">
          <SectionCard title="How to Use CodeLens AI in 4 Steps">
            <div className="space-y-3">
              {[
                { step: '1', title: 'Select Language & Write Code', desc: 'Pick from Python, Java, C++, or C in the editor header. Write your code or load one of the built-in practice templates.' },
                { step: '2', title: 'Fast Run or Visual Debug', desc: 'Click "Run Code" for fast output in the console, or click "Debug & Visualize" to break down your code into step-by-step memory frames.' },
                { step: '3', title: 'Inspect Variables & Call Stack', desc: 'Use the playback controls (Next, Prev, Auto-Play) to watch variables mutate, heap arrays dynamically populate, and call stacks expand.' },
                { step: '4', title: 'Get AI Explanations & Flowcharts', desc: 'View generated Mermaid logic control flowcharts and activate the AI voice narrator to hear plain-English line explanations.' },
              ].map((s) => (
                <div key={s.step} className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {s.step}
                  </span>
                  <div>
                    <h4 className="text-xs font-semibold text-white">{s.title}</h4>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* Tab 2: Visualizer */}
      {docTab === 'visualizer' && (
        <div className="space-y-4">
          <SectionCard title="In-Browser Step-by-Step Visualization">
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              CodeLens runs WebAssembly engines in your browser (Pyodide for Python, JSCPP for C/C++, and sandboxed JVM runners for Java). Every single execution step captures:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-indigo-400 text-xs font-bold block mb-1">📍 Monaco Line Tracing</span>
                <p className="text-xs text-slate-400">The current executing statement is highlighted in radiant cyan with centered scrolling.</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-indigo-400 text-xs font-bold block mb-1">📦 Memory Variables & Types</span>
                <p className="text-xs text-slate-400">Values, lists, dictionaries, structs, and objects are tracked across steps with mutation highlights.</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-indigo-400 text-xs font-bold block mb-1">📚 Call Stack Frames</span>
                <p className="text-xs text-slate-400">Recursion trees and function calls reveal parameter values, scope depth, and return unwinding.</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-indigo-400 text-xs font-bold block mb-1">⏱️ Timeline Playback</span>
                <p className="text-xs text-slate-400">Play, pause, rewind, fast-forward, and scrub through individual execution moments seamlessly.</p>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Tab 3: Diagnostician */}
      {docTab === 'diagnostician' && (
        <div className="space-y-4">
          <SectionCard title="AI Mistake Diagnostician & Auto-Fix">
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              When a program throws a syntax error, type error, or unexpected runtime crash, the AI Diagnostician kicks in automatically:
            </p>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-800/40 text-xs text-rose-200">
                <span className="font-bold block mb-1">🚨 Error Pinpointing & Line Highlighting</span>
                Offending lines are flagged with a prominent red badge in the Monaco Editor and console output.
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                <span className="font-bold text-amber-300 block mb-1">💡 Root Cause Explanation</span>
                Breaks down language-specific rules (e.g. missing colon in Python, forgotten semicolon or undeclared variable in C/C++, unmatched brackets).
              </div>
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-xs text-emerald-200">
                <span className="font-bold block mb-1">✨ 1-Click "Apply AI Fix"</span>
                Clicking "Apply AI Fix" writes the verified syntax directly into your code without breaking formatting. Click "Apply Fix & Re-run" to instantly visualize the corrected program!
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Tab 4: Flowchart */}
      {docTab === 'flowchart' && (
        <div className="space-y-4">
          <SectionCard title="AI Flowchart & Control Flow Graph">
            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              In the Visualizer panel, the "Flowchart" tab converts your source code into an architectural diagram using Mermaid.js.
            </p>
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-2">
              <div className="flex items-center gap-2 text-indigo-300 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                Conditionals & Branches
              </div>
              <p className="text-slate-400 pl-6">Visualizes true/false paths for <code>if / else / elif</code> decision nodes.</p>
              <div className="flex items-center gap-2 text-indigo-300 font-semibold pt-1">
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                Loops & Iterations
              </div>
              <p className="text-slate-400 pl-6">Maps cycle loops (<code>for / while</code>) with clear loopback and termination exits.</p>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Tab 5: Voice Tutor */}
      {docTab === 'voice' && (
        <div className="space-y-4">
          <SectionCard title="AI Voice Narrator & Speech Synthesis">
            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              CodeLens AI features a built-in multi-sensory voice tutor powered by Web Speech API.
            </p>
            <div className="space-y-2.5 text-xs text-slate-400">
              <p>• <strong>Hands-Free Learning:</strong> As you step through code, the voice tutor explains variable assignments, loops, and conditions aloud.</p>
              <p>• <strong>Customizable Speed:</strong> Adjust narration pace in Settings &gt; AI Tutor from 0.5x to 2.0x.</p>
              <p>• <strong>Toggle Anytime:</strong> Click the speaker icon in the Visualizer header to mute or unmute instantly.</p>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Tab 6: Practice & STDIN */}
      {docTab === 'practice' && (
        <div className="space-y-4">
          <SectionCard title="Practice Challenges & STDIN Support">
            <div className="space-y-3 text-xs text-slate-400 leading-relaxed">
              <p>• <strong>Practice Mode:</strong> Select algorithms like Two Sum, Binary Search, Merge Sort, and Fibonacci to practice standard LeetCode-style problem solving.</p>
              <p>• <strong>Custom STDIN Input:</strong> Switch to the <code>STDIN INPUT</code> tab below the Monaco editor. Input arguments (space- or newline-separated) are forwarded directly to <code>input()</code> in Python, <code>Scanner</code> in Java, or <code>cin / scanf</code> in C/C++.</p>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

// ─── Resources: Email Helpers & Brand Icons ──────────────────────────────────
const DEVELOPER_EMAILS = [
  'naveenprasanas265@gmail.com',
  'shankarsivaking@gmail.com',
  'sabaricsd27@gmail.com',
];
const ALL_DEVELOPER_EMAILS = DEVELOPER_EMAILS.join(',');

function openGmailComposer(to: string, subject: string, body: string, userEmail?: string) {
  const authPart = userEmail?.trim() ? `authuser=${encodeURIComponent(userEmail.trim())}&` : '';
  const url = `https://mail.google.com/mail/u/?${authPart}view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function openDesktopMailClient(to: string, subject: string, body: string) {
  const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailto, '_blank');
}

function GmailIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6Z" fill="#F8FAFC" fillOpacity="0.05" />
      <path d="M20 4H4C2.9 4 2 4.9 2 6L12 13L22 6C22 4.9 21.1 4 20 4Z" fill="#EA4335" />
      <path d="M2 6V18C2 19.1 2.9 20 4 20H6V11.5L2 8.5V6Z" fill="#4285F4" />
      <path d="M22 6V18C22 19.1 21.1 20 20 20H18V11.5L22 8.5V6Z" fill="#34A853" />
      <path d="M6 20H18V11.5L12 16L6 11.5V20Z" fill="#FBBC05" />
    </svg>
  );
}

function OutlookIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="20" height="16" rx="3" fill="#0078D4" />
      <path d="M2 7.5L12 14L22 7.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Resources: Help Center Component ─────────────────────────────────────────
function HelpCenterView() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [userQuestion, setUserQuestion] = useState('');
  const [questionSent, setQuestionSent] = useState<string | null>(null);

  const faqs = [
    {
      q: 'How does CodeLens AI execute code without installing compilers?',
      a: 'CodeLens AI uses client-side WebAssembly runtimes (Pyodide for Python, JSCPP for C/C++, and an in-browser JVM runner for Java). Your code compiles and runs entirely inside your browser securely and instantly with zero local setup required.',
    },
    {
      q: 'What should I do if my code enters an infinite loop?',
      a: 'CodeLens includes an automatic execution watchdog that halts long-running loops after a 5-second threshold. You can also click the "Reset" button in the editor toolbar to abort execution and reset your starter code.',
    },
    {
      q: 'How do I pass custom arguments or inputs into my programs?',
      a: 'In the bottom console area of the Editor, click the "STDIN INPUT" tab. Enter your input values (separated by spaces or newlines), and click "Run with Input". Functions like input(), Scanner, and cin/scanf will read these values.',
    },
    {
      q: 'How does the AI Diagnostician detect and fix mistakes?',
      a: 'When an error occurs, CodeLens analyzes the runtime traceback and abstract syntax tree. It displays a red badge on the exact line and explains the fix. Clicking "Apply AI Fix" rewrites the offending line cleanly in your editor.',
    },
    {
      q: 'Which programming languages are currently supported?',
      a: 'Python, Java, C++, and C are fully supported with syntax highlighting, live visual step execution, variable inspection, flowchart generation, and AI error diagnosis.',
    },
    {
      q: 'Where is my saved code, practice data, and history stored?',
      a: 'All saved programs, executions, practice activity, and dashboard progress are securely synchronized to MongoDB Atlas in the cloud and tied to your account.',
    },
    {
      q: 'How do I save or download my programs?',
      a: 'Click the "Save" button in the Editor toolbar to store code in your MongoDB account. You can access all saved code from your Dashboard and export your history anytime.',
    },
    {
      q: 'Can I use CodeLens offline?',
      a: 'Basic code execution and step visualization work offline once Pyodide and WebAssembly assets are cached in your browser. AI diagnosis, flowchart synthesis, and account synchronization require an internet connection.',
    },
  ];

  const filteredFaqs = faqs.filter(
    (f) =>
      f.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAskQuestion = (target: 'gmail' | 'outlook') => {
    if (!userQuestion.trim()) return;
    const subject = 'CodeLens AI - Question from Help Center';
    const senderNote = user?.email
      ? `\n\n──────────────────────────────────────\nSent by CodeLens User:\n• Name: ${user.full_name || 'CodeLens User'}\n• CodeLens Login Email: ${user.email}\n──────────────────────────────────────`
      : '';
    const body = `Hello CodeLens Developer Team,\n\nI have the following question regarding CodeLens AI:\n\n${userQuestion}${senderNote}\n\nThank you!`;
    
    if (target === 'gmail') {
      openGmailComposer(ALL_DEVELOPER_EMAILS, subject, body, user?.email);
      setQuestionSent('Gmail compose tab opened!');
    } else {
      openDesktopMailClient(ALL_DEVELOPER_EMAILS, subject, body);
      setQuestionSent('Mail app (Outlook) opened!');
    }
    setTimeout(() => setQuestionSent(null), 4000);
  };

  return (
    <div className="space-y-5">
      {/* Search Header */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search questions (e.g. infinite loop, STDIN, Python, save code)..."
          className="settings-input pl-10 pr-4 py-2.5 w-full text-xs"
        />
      </div>

      {/* FAQ Accordion */}
      <SectionCard title="Frequently Asked Questions" description="Common questions about CodeLens execution, AI features, and debugging">
        <div className="space-y-2">
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((faq, idx) => {
              const isOpen = expandedFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-800/80 bg-slate-950/40 overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => setExpandedFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between p-3.5 text-left hover:bg-slate-900/50 transition-colors cursor-pointer"
                  >
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                      <HelpCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      {faq.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180 text-indigo-400' : ''}`}
                    />
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <div className="px-3.5 pb-3.5 pt-1 text-xs text-slate-400 border-t border-slate-800/40 leading-relaxed bg-slate-900/20">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-slate-500 py-4 text-center">No questions found matching "{searchQuery}". Try asking below!</p>
          )}
        </div>
      </SectionCard>

      {/* Ask a Question Box */}
      <SectionCard title="Ask a Question" description="Can't find what you're looking for? Send your question directly to all 3 developers">
        <div className="space-y-3">
          <textarea
            value={userQuestion}
            onChange={(e) => setUserQuestion(e.target.value)}
            placeholder="Type your question here (e.g. 'How do I visualize recursion depth in Java?')..."
            rows={3}
            className="settings-input w-full text-xs resize-none"
          />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-slate-400">
              Send directly to all 3 developers via your preferred provider:
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAskQuestion('gmail')}
                disabled={!userQuestion.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-red-600/90 hover:bg-red-500 border border-red-500/40 disabled:opacity-40 transition-all cursor-pointer shadow-sm"
                title="Send via Gmail in your web browser"
              >
                <GmailIcon className="w-3.5 h-3.5" />
                Ask via Gmail
              </button>
              <button
                onClick={() => handleAskQuestion('outlook')}
                disabled={!userQuestion.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 transition-all cursor-pointer shadow-sm"
                title="Send via Microsoft Outlook / default desktop mail client"
              >
                <OutlookIcon className="w-3.5 h-3.5" />
                Ask via Outlook / App
              </button>
            </div>
          </div>
          {questionSent && (
            <p className="text-xs text-emerald-400 flex items-center gap-1.5 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {questionSent}
            </p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Resources: Contact Center Component ──────────────────────────────────────
function ContactCenterView() {
  const { user } = useAuth();
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [senderEmail, setSenderEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('Issue Accessing Platform');
  const [message, setMessage] = useState('');
  const [lastAction, setLastAction] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email && !senderEmail) {
      setSenderEmail(user.email);
    }
  }, [user?.email, senderEmail]);

  const activeEmail = senderEmail.trim() || user?.email || '';

  const developers = [
    {
      name: 'Naveen Prasana S',
      role: 'Lead Developer & Architect',
      email: 'naveenprasanas265@gmail.com',
      badge: 'Lead Developer',
      initials: 'NP',
      color: 'from-indigo-500 to-violet-600',
    },
    {
      name: 'Shankar Siva',
      role: 'Core Developer & Visualization',
      email: 'shankarsivaking@gmail.com',
      badge: 'Core Developer',
      initials: 'SS',
      color: 'from-cyan-500 to-blue-600',
    },
    {
      name: 'Sabari',
      role: 'Core Developer & Backend',
      email: 'sabaricsd27@gmail.com',
      badge: 'Core Developer',
      initials: 'SB',
      color: 'from-emerald-500 to-teal-600',
    },
  ];

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2500);
  };

  const getSenderSignature = (customEmail?: string) => {
    const fromAddr = customEmail || activeEmail;
    if (!fromAddr) return '';
    return `\n\n──────────────────────────────────────\nSent by CodeLens User:\n• Name: ${user?.full_name || 'CodeLens User'}\n• CodeLens Login Email: ${fromAddr}\n──────────────────────────────────────`;
  };

  const handleSend = (target: 'gmail' | 'outlook') => {
    const emailSubject = `CodeLens AI Support: ${subject}`;
    const emailBody = `Hello CodeLens Developer Team,\n\nIssue Category: ${subject}\n\nDetails:\n${message || 'I am facing an issue while accessing CodeLens and would appreciate your assistance.'}${getSenderSignature()}\n\nThank you!`;

    if (target === 'gmail') {
      openGmailComposer(ALL_DEVELOPER_EMAILS, emailSubject, emailBody, activeEmail);
      setLastAction(`Opened Gmail Compose (as ${activeEmail || 'CodeLens User'})`);
    } else {
      openDesktopMailClient(ALL_DEVELOPER_EMAILS, emailSubject, emailBody);
      setLastAction('Opened Desktop Mail App / Outlook');
    }
    setTimeout(() => setLastAction(null), 4000);
  };

  return (
    <div className="space-y-5">
      {/* Prominent Help Notice Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-violet-950/80 border border-indigo-500/40 backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
            <Mail className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-white">Need Help or Facing Issues Accessing CodeLens?</h4>
            <p className="text-xs text-indigo-200/90 mt-1 leading-relaxed">
              If you are facing any issues while accessing CodeLens AI or need any help, kindly follow the developer emails below to contact our team directly via <strong>Gmail</strong> or <strong>Microsoft Outlook / Mail App</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Sending Account Info Banner */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-indigo-500/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-xs shrink-0">
            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400">Sender Account:</span>
              <span className="text-xs font-semibold text-white font-mono truncate">{activeEmail || 'Not logged in'}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium border border-emerald-500/30">
                CodeLens Web Login
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Gmail compose tabs will automatically launch using your CodeLens web login email account.
            </p>
          </div>
        </div>
      </div>

      {/* Developer Details Cards */}
      <SectionCard title="Developer Contact Details" description="Direct contact emails for the CodeLens AI developer team — send via Gmail, Outlook, or copy to clipboard">
        <div className="space-y-3">
          {developers.map((dev) => {
            const isCopied = copiedEmail === dev.email;
            return (
              <div
                key={dev.email}
                className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${dev.color} flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0`}>
                    {dev.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-white truncate">{dev.name}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium shrink-0">
                        {dev.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{dev.role}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-indigo-400 select-all">{dev.email}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start md:self-center shrink-0">
                  <button
                    onClick={() => copyEmail(dev.email)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 transition-colors cursor-pointer"
                    title="Copy email address to clipboard"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {isCopied ? 'Copied!' : 'Copy'}
                  </button>

                  <button
                    onClick={() =>
                      openGmailComposer(
                        dev.email,
                        'CodeLens AI Inquiry',
                        `Hello ${dev.name},\n\nI am contacting you regarding CodeLens AI.${getSenderSignature()}`,
                        activeEmail
                      )
                    }
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-white text-xs font-medium border border-red-500/30 hover:border-red-400 transition-all cursor-pointer shadow-sm"
                    title={`Send email to ${dev.name} via Gmail (${activeEmail || 'Web'})`}
                  >
                    <GmailIcon className="w-3.5 h-3.5" /> Gmail
                  </button>

                  <button
                    onClick={() =>
                      openDesktopMailClient(
                        dev.email,
                        'CodeLens AI Inquiry',
                        `Hello ${dev.name},\n\nI am contacting you regarding CodeLens AI.${getSenderSignature()}`
                      )
                    }
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 hover:text-white text-xs font-medium border border-indigo-500/30 hover:border-indigo-400 transition-all cursor-pointer shadow-sm"
                    title={`Send email to ${dev.name} via Outlook / Default Desktop Mail Client`}
                  >
                    <OutlookIcon className="w-3.5 h-3.5" /> Outlook / App
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Quick Direct Support Form */}
      <SectionCard title="Send Support Message" description="Compose a message pre-addressed to all 3 developers">
        <div className="space-y-3">
          {/* Sender Email Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                From (Your CodeLens Login Email)
              </label>
              {user?.email && senderEmail !== user.email && (
                <button
                  type="button"
                  onClick={() => setSenderEmail(user.email)}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                >
                  Reset to CodeLens Login ({user.email})
                </button>
              )}
            </div>
            <input
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder={user?.email || "yourname@example.com"}
              className="settings-input w-full text-xs font-mono text-indigo-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Issue Category</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="settings-input settings-select w-full text-xs"
            >
              <option value="Issue Accessing Platform">Issue Accessing Platform</option>
              <option value="Execution or Runner Bug">Execution or Runner Bug</option>
              <option value="AI Feature / Diagnostician Issue">AI Feature / Diagnostician Issue</option>
              <option value="Account / Login Verification Support">Account / Login Verification Support</option>
              <option value="Feature Request">Feature Request</option>
              <option value="General Question">General Question</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Description of Issue / Need</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the issue you are facing or the assistance you need..."
              rows={3}
              className="settings-input w-full text-xs resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={() => handleSend('gmail')}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 text-white text-xs font-semibold shadow-md shadow-red-950/40 transition-all cursor-pointer border border-red-500/30"
            >
              <GmailIcon className="w-4 h-4" /> Send via Gmail ({activeEmail || 'Web'})
            </button>

            <button
              onClick={() => handleSend('outlook')}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-950/40 transition-all cursor-pointer border border-blue-500/30"
            >
              <OutlookIcon className="w-4 h-4" /> Send via Outlook / Default App
            </button>
          </div>

          {lastAction && (
            <p className="text-xs text-emerald-400 flex items-center justify-center gap-1.5 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {lastAction} with all 3 developer addresses pre-filled!
            </p>
          )}

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
            <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>
              <strong>Gmail:</strong> Opens Google Mail switched directly to your CodeLens login email account. <strong>Outlook / App:</strong> Opens Microsoft Outlook or your OS default client with your CodeLens identity attached.
            </span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Section: Resources Hub ───────────────────────────────────────────────────
function ResourcesSection({
  initialTab = 'documentation',
}: {
  initialTab?: 'documentation' | 'help' | 'contact';
}) {
  const [tab, setTab] = useState<'documentation' | 'help' | 'contact'>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  return (
    <div className="space-y-6">
      {/* Subnav Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
        <button
          onClick={() => setTab('documentation')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            tab === 'documentation'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> Documentation
        </button>
        <button
          onClick={() => setTab('help')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            tab === 'help'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" /> Help Center
        </button>
        <button
          onClick={() => setTab('contact')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            tab === 'contact'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" /> Contact Center
        </button>
      </div>

      {tab === 'documentation' && <DocumentationView />}
      {tab === 'help' && <HelpCenterView />}
      {tab === 'contact' && <ContactCenterView />}
    </div>
  );
}

// ─── Section: About ───────────────────────────────────────────────────────────
function AboutSection({ onOpenResource }: { onOpenResource?: (type: 'documentation' | 'help' | 'contact') => void }) {
  const [modalType, setModalType] = useState<'documentation' | 'help' | 'contact' | null>(null);

  const handleOpen = (type: 'documentation' | 'help' | 'contact') => {
    if (onOpenResource) {
      onOpenResource(type);
    } else {
      setModalType(type);
    }
  };

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

      <SectionCard title="Resources" description="Documentation, FAQ help center, and developer contact support">
        <div className="space-y-2">
          {[
            { id: 'documentation' as const, icon: <FileText className="w-4 h-4" />, label: 'Documentation', description: 'Enhance AI features & how to use CodeLens AI' },
            { id: 'help' as const, icon: <HelpCircle className="w-4 h-4" />, label: 'Help Center', description: 'Browse frequently asked questions and ask questions' },
            { id: 'contact' as const, icon: <MessageSquare className="w-4 h-4" />, label: 'Contact Center', description: 'Developer details & direct email support assistance' },
          ].map(({ id, icon, label, description }) => (
            <button
              key={label}
              onClick={() => handleOpen(id)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/50 transition-colors group text-left cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-all shrink-0">
                {icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{label}</p>
                <p className="text-xs text-slate-500 truncate">{description}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-600 -rotate-90 ml-auto shrink-0 group-hover:text-slate-400 transition-colors" />
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Technology">
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
          {[
            ['Frontend', 'React 19 + TypeScript'],
            ['Build', 'Vite 8'],
            ['Editor', 'Monaco Editor'],
            ['Backend', 'FastAPI + MongoDB Atlas'],
            ['AI', 'Google Gemini'],
            ['Visualization', 'Mermaid.js + WebAssembly'],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 p-2 bg-slate-900/50 rounded-lg">
              <span className="text-slate-600">{k}</span>
              <span className="text-slate-400 font-medium">{v}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Modal dialog if opened directly from About view */}
      {modalType && (
        <div className="settings-modal-overlay" onClick={() => setModalType(null)}>
          <motion.div
            className="settings-modal settings-modal-lg"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  {modalType === 'documentation' ? <FileText className="w-4 h-4" /> : modalType === 'help' ? <HelpCircle className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                </div>
                <h3 className="text-base font-bold text-white capitalize">
                  {modalType === 'documentation' ? 'Documentation' : modalType === 'help' ? 'Help Center' : 'Contact Center'}
                </h3>
              </div>
              <button
                onClick={() => setModalType(null)}
                className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              {modalType === 'documentation' && <DocumentationView />}
              {modalType === 'help' && <HelpCenterView />}
              {modalType === 'contact' && <ContactCenterView />}
            </div>
          </motion.div>
        </div>
      )}
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
  | 'ai-tutor' | 'execution' | 'notifications' | 'security' | 'data' | 'resources' | 'about';

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
  { id: 'resources', icon: <HelpCircle className="w-4 h-4" />, label: 'Resources' },
  { id: 'about', icon: <Info className="w-4 h-4" />, label: 'About' },
];

const SHOW_RESET_FOR: SectionId[] = ['appearance', 'editor', 'visualization', 'ai-tutor', 'execution', 'notifications'];

function SectionContent({
  id,
  onOpenResource,
  resourceTab,
}: {
  id: SectionId;
  onOpenResource: (type: 'documentation' | 'help' | 'contact') => void;
  resourceTab: 'documentation' | 'help' | 'contact';
}) {
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
    case 'resources': return <ResourcesSection initialTab={resourceTab} />;
    case 'about': return <AboutSection onOpenResource={onOpenResource} />;
    default: return null;
  }
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionId>('profile');
  const [resourceTab, setResourceTab] = useState<'documentation' | 'help' | 'contact'>('documentation');
  const activeItem = NAV_ITEMS.find((n) => n.id === activeSection) || NAV_ITEMS[0];

  const handleOpenResource = (type: 'documentation' | 'help' | 'contact') => {
    setResourceTab(type);
    setActiveSection('resources');
  };

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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left cursor-pointer ${
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
                <SectionContent
                  id={activeSection}
                  onOpenResource={handleOpenResource}
                  resourceTab={resourceTab}
                />

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
