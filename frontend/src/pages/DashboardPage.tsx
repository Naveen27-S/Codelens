/**
 * DashboardPage.tsx
 *
 * Professional coding-practice dashboard for CodeLens AI.
 * Inspired by LeetCode / CodeChef analytics, with CodeLens dark identity.
 *
 * Data flows:
 *  - All stats from dashboardService.ts (real backend + smart fallbacks)
 *  - User identity from AuthContext (never duplicated)
 *  - "Continue →" loads code into EditorPage via router state
 *  - "Solve" loads a practice problem into EditorPage
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Code2, Flame, Eye, BookOpen, BrainCircuit,
  TrendingUp, Clock, Play, ChevronRight, Zap,
  ArrowUpRight, RefreshCw, Calendar, BarChart3, Target,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchAllDashboardData,
  type DashboardData,
  type DayActivity,
  type RecentProgram,
  type RecentVisualization,
  type LanguageProgress,
  type Recommendation,
  type UserActivityItem,
} from '../services/dashboardService';
import axios from 'axios';
import './DashboardPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d === 1) return 'yesterday';
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function langClass(lang: string): string {
  const l = lang?.toLowerCase() ?? '';
  if (l === 'python') return 'lang-python';
  if (l === 'java') return 'lang-java';
  if (l === 'cpp' || l === 'c++') return 'lang-cpp';
  if (l === 'c') return 'lang-c';
  if (l === 'javascript' || l === 'js') return 'lang-javascript';
  return 'lang-python';
}

function langShort(lang: string): string {
  const l = lang?.toLowerCase() ?? '';
  if (l === 'python') return 'PY';
  if (l === 'java') return 'JV';
  if (l === 'cpp' || l === 'c++') return 'C++';
  if (l === 'c') return 'C';
  if (l === 'javascript' || l === 'js') return 'JS';
  return l.slice(0, 3).toUpperCase();
}

function activityTypeColor(type: string): { bg: string; color: string } {
  switch (type) {
    case 'code_execution':
    case 'execution':
      return { bg: 'rgba(99,102,241,0.12)', color: '#818cf8' };
    case 'visualization_completed':
    case 'visualization':
      return { bg: 'rgba(52,211,153,0.12)', color: '#34d399' };
    case 'ai_tutor':
    case 'ai_explanation':
      return { bg: 'rgba(168,85,247,0.12)', color: '#c084fc' };
    case 'program_saved':
      return { bg: 'rgba(251,146,60,0.12)', color: '#fb923c' };
    case 'practice':
      return { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24' };
    default:
      return { bg: 'rgba(71,85,105,0.2)', color: '#64748b' };
  }
}

function activityTypeIcon(type: string) {
  const { bg, color } = activityTypeColor(type);
  const iconStyle = { color };
  const wrapStyle = { background: bg, borderRadius: '9px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
  switch (type) {
    case 'code_execution':
    case 'execution':
      return <div style={wrapStyle}><Play style={iconStyle} size={14} /></div>;
    case 'visualization_completed':
    case 'visualization':
      return <div style={wrapStyle}><Eye style={iconStyle} size={14} /></div>;
    case 'ai_tutor':
    case 'ai_explanation':
      return <div style={wrapStyle}><BrainCircuit style={iconStyle} size={14} /></div>;
    case 'program_saved':
      return <div style={wrapStyle}><Code2 style={iconStyle} size={14} /></div>;
    case 'practice':
      return <div style={wrapStyle}><BookOpen style={iconStyle} size={14} /></div>;
    default:
      return <div style={wrapStyle}><Zap style={iconStyle} size={14} /></div>;
  }
}

// ─── Circular Progress Ring ───────────────────────────────────────────────────

function CircularRing({
  value, total, size = 110, stroke = 'url(#ring-grad)',
  label, sublabel,
}: {
  value: number; total: number; size?: number; stroke?: string;
  label?: string; sublabel?: string;
}) {
  const r = (size - 20) / 2;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  const offset = circ * (1 - pct);

  return (
    <div className="progress-ring-container" style={{ width: size, height: size }}>
      <svg className="progress-ring-svg" width={size} height={size}>
        <defs>
          <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient id="ring-easy" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <linearGradient id="ring-medium" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id="ring-hard" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        <circle className="progress-ring-track" cx={size / 2} cy={size / 2} r={r} />
        <circle
          className="progress-ring-fill"
          cx={size / 2} cy={size / 2} r={r}
          stroke={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      {(label !== undefined || sublabel !== undefined) && (
        <div className="progress-ring-label">
          {label !== undefined && <span className="ring-val">{label}</span>}
          {sublabel !== undefined && <span className="ring-sub">{sublabel}</span>}
        </div>
      )}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, trend, accentColor = '#6366f1',
}: {
  icon: React.ReactNode; label: string; value: string | number; trend?: number;
  accentColor?: string;
}) {
  const trendUp = trend !== undefined && trend > 0;
  return (
    <div
      className="stat-card"
      style={{
        '--stat-accent': `linear-gradient(90deg, ${accentColor}88, ${accentColor})`,
        '--stat-icon-bg': `${accentColor}18`,
        '--stat-icon-border': `${accentColor}30`,
        '--stat-icon-color': accentColor,
      } as React.CSSProperties}
    >
      <div className="stat-card-header">
        <div className="stat-card-icon">{icon}</div>
        {trend !== undefined && (
          <span className={`stat-card-trend ${trendUp ? 'up' : 'neutral'}`}>
            {trendUp && <ArrowUpRight size={11} />}
            {trend > 0 ? `+${trend}%` : trend === 0 ? '—' : `${trend}%`}
          </span>
        )}
      </div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  );
}

// ─── Program Progress Card (circular ring + diff bars) ────────────────────────

function ProgramProgressCard({ stats }: { stats: DashboardData['stats'] }) {
  const total = stats.totalPrograms;

  return (
    <div className="dash-card">
      <div className="dash-card-title">
        <BookOpen size={14} />
        Programs Practiced
      </div>
      <div className="prog-progress-body">
        <CircularRing
          value={total}
          total={Math.max(total, 50)}
          size={120}
          label={String(total)}
          sublabel="programs"
        />
        <div className="prog-progress-rings">
          {[
            { label: 'Executions', val: stats.totalExecutions, color: '#6366f1', max: Math.max(stats.totalExecutions, 20) },
            { label: 'Visualized', val: stats.totalVisualizations, color: '#34d399', max: Math.max(stats.totalVisualizations, 20) },
            { label: 'Learning h', val: Math.round(stats.learningHours), color: '#f59e0b', max: Math.max(Math.round(stats.learningHours), 10) },
          ].map(({ label, val, color, max }) => (
            <div key={label} className="prog-diff-row">
              <div className="prog-diff-label">
                <div className="prog-diff-dot" style={{ background: color }} />
                {label}
              </div>
              <div className="prog-diff-bar-wrap">
                <div
                  className="prog-diff-bar"
                  style={{ width: `${Math.min(100, (val / max) * 100)}%`, background: color }}
                />
              </div>
              <div className="prog-diff-count">{val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Streak Card ──────────────────────────────────────────────────────────────

function StreakCard({ streak }: { streak: DashboardData['streak'] }) {
  const lastDate = streak.last_active_date
    ? new Date(streak.last_active_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—';

  return (
    <div className="dash-card">
      <div className="dash-card-title">
        <Flame size={14} />
        Coding Streak
      </div>
      <div className="streak-body">
        <div className="streak-flame-row">
          <span className="streak-flame-icon">🔥</span>
          <div>
            <div className="streak-days-val">{streak.current_streak}</div>
            <div className="streak-days-unit">day streak</div>
          </div>
        </div>

        <div className="streak-stats-row">
          <div className="streak-stat">
            <div className="streak-stat-label">Current</div>
            <div className="streak-stat-val">{streak.current_streak} {streak.current_streak === 1 ? 'day' : 'days'}</div>
          </div>
          <div className="streak-stat">
            <div className="streak-stat-label">Longest</div>
            <div className="streak-stat-val">{streak.longest_streak} {streak.longest_streak === 1 ? 'day' : 'days'}</div>
          </div>
          <div className="streak-stat">
            <div className="streak-stat-label">Last Active</div>
            <div className="streak-stat-val" style={{ fontSize: '14px' }}>{lastDate}</div>
          </div>
          <div className="streak-stat">
            <div className="streak-stat-label">All-Time Best</div>
            <div className="streak-stat-val">{streak.longest_streak}d</div>
          </div>
        </div>

        {streak.streak_message && (
          <div className="streak-message">{streak.streak_message}</div>
        )}
      </div>
    </div>
  );
}

// ─── Activity Calendar (Heatmap) ──────────────────────────────────────────────

interface CalendarDay { date: string; count: number; }

function ActivityCalendar() {
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [maxCount, setMaxCount] = useState(1);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; count: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get<{ days: CalendarDay[]; max_count: number }>(
          `${API_URL}/dashboard/activity/calendar?days=180`
        );
        setCalendarData(res.data.days);
        setMaxCount(Math.max(res.data.max_count, 1));
      } catch {
        // Generate 180-day empty calendar as fallback
        const days: CalendarDay[] = [];
        for (let i = 180; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          days.push({ date: d.toISOString().slice(0, 10), count: 0 });
        }
        setCalendarData(days);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const getLevel = (count: number): number => {
    if (count === 0) return 0;
    const ratio = count / maxCount;
    if (ratio < 0.25) return 1;
    if (ratio < 0.5) return 2;
    if (ratio < 0.75) return 3;
    return 4;
  };

  // Group days into weeks (columns of 7)
  const weeks: CalendarDay[][] = [];
  if (calendarData.length > 0) {
    // Pad start so first day aligns to week
    const firstDOW = new Date(calendarData[0].date).getDay(); // 0=Sun
    const padded: (CalendarDay | null)[] = [
      ...Array(firstDOW).fill(null),
      ...calendarData,
    ];
    for (let i = 0; i < padded.length; i += 7) {
      weeks.push(padded.slice(i, i + 7).filter(Boolean) as CalendarDay[]);
    }
  }

  // Month labels
  const monthLabels: { label: string; weekIdx: number }[] = [];
  weeks.forEach((week, wi) => {
    if (week.length === 0) return;
    const d = new Date(week[0].date);
    if (wi === 0 || new Date(weeks[wi - 1]?.[0]?.date ?? '').getMonth() !== d.getMonth()) {
      monthLabels.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), weekIdx: wi });
    }
  });

  const dayLabels = ['Sun', '', 'Tue', '', 'Thu', '', 'Sat'];

  if (loading) {
    return (
      <div className="dash-card">
        <div className="dash-card-title"><Calendar size={14} />Coding Activity</div>
        <div className="dash-skeleton" style={{ height: '120px' }} />
      </div>
    );
  }

  return (
    <div className="dash-card">
      <div className="dash-card-title" style={{ justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={14} />
          Coding Activity
        </span>
        <span style={{ fontSize: '11px', color: '#334155', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
          Last 6 months
        </span>
      </div>

      <div className="calendar-grid-wrap">
        {/* Month labels */}
        <div className="calendar-months-row" style={{ paddingLeft: '28px' }}>
          {monthLabels.map(({ label, weekIdx }) => (
            <div
              key={`${label}-${weekIdx}`}
              className="calendar-month-label"
              style={{ width: `${(weeks.slice(weekIdx, weekIdx + 5).length || 1) * 15}px`, flexShrink: 0 }}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="calendar-body">
          {/* Day-of-week labels */}
          <div className="calendar-day-labels">
            {dayLabels.map((d, i) => (
              <div key={i} className="calendar-day-label">{d}</div>
            ))}
          </div>

          {/* Weeks */}
          <div className="calendar-weeks">
            {weeks.map((week, wi) => (
              <div key={wi} className="calendar-week-col">
                {Array(7).fill(null).map((_, di) => {
                  const day = week[di] ?? null;
                  if (!day) return <div key={di} className="calendar-cell cal-level-0" style={{ visibility: 'hidden' }} />;
                  const level = getLevel(day.count);
                  return (
                    <div
                      key={di}
                      className={`calendar-cell cal-level-${level}`}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({ x: rect.left + 6, y: rect.top - 52, date: day.date, count: day.count });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="calendar-legend">
        <span className="calendar-legend-label">Less</span>
        <div className="calendar-legend-cells">
          {[0, 1, 2, 3, 4].map((l) => (
            <div key={l} className={`calendar-legend-cell cal-level-${l}`} />
          ))}
        </div>
        <span className="calendar-legend-label">More</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="calendar-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="calendar-tooltip-date">
            {new Date(tooltip.date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <div style={{ color: '#64748b' }}>
            {tooltip.count === 0 ? 'No activity' : `${tooltip.count} activit${tooltip.count === 1 ? 'y' : 'ies'}`}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Weekly Activity Chart ────────────────────────────────────────────────────

function WeeklyActivityChart({ activity }: { activity: DayActivity[] }) {
  const maxTotal = Math.max(...activity.map((d) => d.executions + d.visualizations + d.aiExplanations), 1);
  const todayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];

  const weekStats = activity.reduce(
    (acc, d) => {
      acc.executions += d.executions;
      acc.visualizations += d.visualizations;
      acc.aiSessions += d.aiExplanations;
      acc.total += d.executions + d.visualizations + d.aiExplanations;
      return acc;
    },
    { executions: 0, visualizations: 0, aiSessions: 0, total: 0 }
  );

  return (
    <div className="dash-card">
      <div className="dash-card-title"><BarChart3 size={14} />Weekly Activity</div>
      <div className="activity-chart-body">
        <div className="activity-chart-bars">
          {activity.map((d) => {
            const total = d.executions + d.visualizations + d.aiExplanations;
            const heightPct = total === 0 ? 0 : Math.max(4, (total / maxTotal) * 100);
            const isToday = d.day === todayName;
            return (
              <div key={d.day} className="activity-bar-col">
                <div className="activity-bar-track">
                  <div
                    className={`activity-bar-fill${isToday ? ' today' : ''}`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <div className="activity-bar-day" style={{ color: isToday ? '#818cf8' : undefined }}>{d.day}</div>
                {total > 0 && <div className="activity-bar-count">{total}</div>}
              </div>
            );
          })}
        </div>

        <div className="activity-week-stats">
          {[
            { val: weekStats.executions, label: 'Executions' },
            { val: weekStats.visualizations, label: 'Visualizations' },
            { val: weekStats.aiSessions, label: 'AI Sessions' },
            { val: weekStats.total, label: 'Total Events' },
          ].map(({ val, label }) => (
            <div key={label} className="activity-week-stat">
              <div className="activity-week-stat-val">{val}</div>
              <div className="activity-week-stat-label">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Continue Coding Card ─────────────────────────────────────────────────────

function ContinueCodingCard({ programs, onContinue }: { programs: RecentProgram[]; onContinue: (p: RecentProgram) => void }) {
  if (programs.length === 0) {
    return (
      <div className="dash-card">
        <div className="dash-card-title"><Code2 size={14} />Continue Coding</div>
        <div className="dash-empty-state">
          <div className="dash-empty-icon">💻</div>
          <div className="dash-empty-text">No saved programs yet.</div>
          <div className="dash-empty-sub">Write and save code in the editor to continue here.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-card">
      <div className="dash-card-title" style={{ justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Code2 size={14} />Continue Coding</span>
      </div>
      <div className="continue-list">
        {programs.slice(0, 4).map((p) => (
          <div key={String(p.id)} className="continue-item" onClick={() => onContinue(p)}>
            <div className={`continue-lang-badge ${langClass(p.language)}`}>
              {langShort(p.language)}
            </div>
            <div className="continue-info">
              <div className="continue-title">{p.title}</div>
              <div className="continue-meta">{p.language.toUpperCase()} · {relativeTime(p.lastEdited)}</div>
            </div>
            <button className="continue-btn" onClick={(e) => { e.stopPropagation(); onContinue(p); }}>
              Continue <ChevronRight size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Learning Progress Card ───────────────────────────────────────────────────

function LearningProgressCard({ progress }: { progress: LanguageProgress[] }) {
  const colorMap: Record<string, string> = {
    'bg-indigo-500': '#6366f1',
    'bg-violet-500': '#8b5cf6',
    'bg-emerald-500': '#10b981',
    'bg-amber-500': '#f59e0b',
    'bg-blue-500': '#3b82f6',
    'bg-rose-500': '#f43f5e',
  };

  return (
    <div className="dash-card">
      <div className="dash-card-title"><TrendingUp size={14} />Learning Progress</div>
      {progress.length === 0 ? (
        <div className="dash-empty-state">
          <div className="dash-empty-icon">📈</div>
          <div className="dash-empty-text">No learning data yet.</div>
          <div className="dash-empty-sub">Start coding to build your progress.</div>
        </div>
      ) : (
        <div className="learning-progress-list">
          {progress.map((p) => {
            const color = colorMap[p.color] ?? '#6366f1';
            return (
              <div key={p.label} className="learning-progress-item">
                <div className="learning-progress-header">
                  <span className="learning-progress-label">{p.label}</span>
                  <span className="learning-progress-pct">{p.percentage}%</span>
                </div>
                <div className="learning-progress-bar-wrap">
                  <div
                    className="learning-progress-bar"
                    style={{ width: `${p.percentage}%`, background: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Recommendations Card ─────────────────────────────────────────────────────

function RecommendationsCard({ recs, onSolve }: { recs: Recommendation[]; onSolve: (r: Recommendation) => void }) {
  return (
    <div className="dash-card">
      <div className="dash-card-title"><Target size={14} />Recommended Practice</div>
      <div className="recommendations-grid">
        {recs.slice(0, 6).map((r) => (
          <div key={r.id} className="recommendation-card">
            <div className="rec-top">
              <span className="rec-icon">{r.icon}</span>
              <span className={`rec-difficulty ${r.difficulty}`}>{r.difficulty}</span>
            </div>
            <div className="rec-topic">{r.topic}</div>
            <div className="rec-problems">{r.problems} problems</div>
            <button className="rec-solve-btn" onClick={() => onSolve(r)}>Solve →</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AI Insight Card ──────────────────────────────────────────────────────────

function AIInsightCard({ insight, onNavigate }: { insight: string; onNavigate: (path: string) => void }) {
  return (
    <div className="dash-card">
      <div className="dash-card-title"><BrainCircuit size={14} />AI Learning Insight</div>
      <div className="ai-insight-body">
        <span className="ai-insight-badge">
          <Zap size={10} /> AI Tutor
        </span>
        <p className="ai-insight-text">{insight}</p>
        <div className="ai-insight-actions">
          <button className="dash-btn-primary" style={{ fontSize: '12px', padding: '7px 14px' }}
            onClick={() => onNavigate('/editor')}>
            <Play size={12} /> Start Practicing
          </button>
          <button className="dash-btn-secondary" style={{ fontSize: '12px', padding: '7px 14px' }}
            onClick={() => onNavigate('/editor')}>
            <BrainCircuit size={12} /> Ask AI Tutor
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Learning Time Card ───────────────────────────────────────────────────────

function LearningTimeCard({ learningTime }: { learningTime: DashboardData['learningTime'] }) {
  return (
    <div className="dash-card">
      <div className="dash-card-title"><Clock size={14} />Practice Time</div>
      <div className="learning-time-grid">
        {[
          { period: 'Today', val: learningTime.today_formatted },
          { period: 'This Week', val: learningTime.week_formatted },
          { period: 'This Month', val: learningTime.month_formatted },
          { period: 'All Time', val: learningTime.month_formatted }, // proxy
        ].map(({ period, val }) => (
          <div key={period} className="learning-time-item">
            <div className="learning-time-period">{period}</div>
            <div className="learning-time-val">{val === '0m' ? '—' : val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recent Visualizations Card ───────────────────────────────────────────────

function RecentVisualizationsCard({
  visualizations,
  onView,
}: {
  visualizations: RecentVisualization[];
  onView: (v: RecentVisualization) => void;
}) {
  if (visualizations.length === 0) {
    return (
      <div className="dash-card">
        <div className="dash-card-title"><Eye size={14} />Recent Visualizations</div>
        <div className="dash-empty-state">
          <div className="dash-empty-icon">🔭</div>
          <div className="dash-empty-text">No visualizations yet.</div>
          <div className="dash-empty-sub">Click "Visualize" in the editor to generate a diagram.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-card">
      <div className="dash-card-title" style={{ justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Eye size={14} />Recent Visualizations</span>
      </div>
      <div className="viz-list">
        {visualizations.slice(0, 4).map((v) => (
          <div key={String(v.id)} className="viz-item" onClick={() => onView(v)}>
            <div className="viz-icon-wrap">
              <Eye size={15} style={{ color: '#34d399' }} />
            </div>
            <div className="viz-info">
              <div className="viz-name">{v.programName}</div>
              <div className="viz-meta">
                <span>{v.language.toUpperCase()}</span>
                {v.steps > 0 && <span>· {v.steps} steps</span>}
                <span>· {relativeTime(v.timestamp)}</span>
              </div>
            </div>
            <button className="viz-view-btn" onClick={(e) => { e.stopPropagation(); onView(v); }}>
              View
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recent Activities Card ───────────────────────────────────────────────────

function RecentActivitiesCard({ activities }: { activities: UserActivityItem[] }) {
  if (activities.length === 0) {
    return (
      <div className="dash-card">
        <div className="dash-card-title"><Zap size={14} />Recent Activity</div>
        <div className="dash-empty-state">
          <div className="dash-empty-icon">🌱</div>
          <div className="dash-empty-text">Start your coding journey.</div>
          <div className="dash-empty-sub">Your activity will appear here as you practice.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-card">
      <div className="dash-card-title"><Zap size={14} />Recent Activity</div>
      <div className="activity-timeline">
        {activities.slice(0, 6).map((a) => (
          <div key={String(a.id)} className="activity-timeline-item">
            {activityTypeIcon(a.activity_type)}
            <div className="activity-timeline-content">
              <div className="activity-timeline-title">
                {a.title}
                {a.language && (
                  <span
                    className="activity-tag"
                    style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}
                  >
                    {a.language.toUpperCase()}
                  </span>
                )}
              </div>
              {a.description && (
                <div className="activity-timeline-desc">{a.description}</div>
              )}
              <div className="activity-timeline-time">{relativeTime(a.started_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const d = await fetchAllDashboardData();
      setData(d);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Navigate to editor with a saved program loaded
  const handleContinue = useCallback((p: RecentProgram) => {
    navigate('/editor', {
      state: {
        code: p.sourceCode,
        language: p.language.toLowerCase(),
        programId: String(p.id),
        programTitle: p.title,
      },
    });
  }, [navigate]);

  // Navigate to editor with visualization loaded
  const handleViewViz = useCallback((v: RecentVisualization) => {
    navigate('/editor', {
      state: {
        code: v.sourceCode,
        language: v.language.toLowerCase(),
        visualization: v.mermaidExplanation,
        activeTab: 'visualization' as const,
      },
    });
  }, [navigate]);

  // Navigate to editor for a practice topic
  const handleSolveRec = useCallback((r: Recommendation) => {
    // Map topic names to existing practice problems
    const topicToProblem: Record<string, string> = {
      'Arrays': 'reverse-array',
      'Binary Search': 'binary-search',
      'Recursion': 'fibonacci',
    };
    const problemId = topicToProblem[r.topic];
    if (problemId) {
      navigate('/editor', { state: { problemId } });
    } else {
      navigate('/editor');
    }
  }, [navigate]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const userName = user?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Coder';

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-container">
          <div className="dash-header">
            <div className="dash-skeleton" style={{ width: '240px', height: '32px', marginBottom: '8px' }} />
            <div className="dash-skeleton" style={{ width: '380px', height: '16px' }} />
          </div>
          <div className="stat-cards-grid">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="dash-skeleton" style={{ height: '110px' }} />
            ))}
          </div>
          <div className="dash-two-col">
            <div className="dash-skeleton" style={{ height: '220px' }} />
            <div className="dash-skeleton" style={{ height: '220px' }} />
          </div>
          <div className="dash-skeleton" style={{ height: '180px' }} />
          <div className="dash-two-col">
            <div className="dash-skeleton" style={{ height: '260px' }} />
            <div className="dash-skeleton" style={{ height: '260px' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { stats, recentPrograms, recentVisualizations, activity, progress, recommendations, aiInsight, streak, recentActivities, learningTime } = data;

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="dash-header">
          <h1>{greeting}, {userName} 👋</h1>
          <p className="dash-header-sub">
            Track your coding progress, maintain your streak, and keep improving with CodeLens AI.
          </p>
          <div className="dash-header-actions">
            <button className="dash-btn-primary" onClick={() => navigate('/editor')}>
              <Play size={14} /> Start Coding
            </button>
            <button className="dash-btn-secondary" onClick={() => navigate('/editor', { state: { problemId: 'two-sum' } })}>
              <BookOpen size={14} /> Practice Problems
            </button>
            <button
              className="dash-btn-secondary"
              onClick={() => loadData(true)}
              disabled={refreshing}
              title="Refresh dashboard"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* ── Stat Cards ─────────────────────────────────────────────────── */}
        <div className="stat-cards-grid">
          <StatCard
            icon={<Code2 size={16} />}
            label="Programs Saved"
            value={stats.totalPrograms}
            trend={stats.programsTrend}
            accentColor="#6366f1"
          />
          <StatCard
            icon={<Play size={16} />}
            label="Code Runs"
            value={stats.totalExecutions}
            trend={stats.executionsTrend}
            accentColor="#8b5cf6"
          />
          <StatCard
            icon={<Eye size={16} />}
            label="Visualizations"
            value={stats.totalVisualizations}
            trend={stats.visualizationsTrend}
            accentColor="#34d399"
          />
          <StatCard
            icon={<Flame size={16} />}
            label="Day Streak"
            value={streak.current_streak}
            accentColor="#f59e0b"
          />
          <StatCard
            icon={<Clock size={16} />}
            label="Learning Time"
            value={`${stats.learningHours}h`}
            trend={stats.learningTrend}
            accentColor="#06b6d4"
          />
          <StatCard
            icon={<BrainCircuit size={16} />}
            label="AI Sessions"
            value={recentActivities.filter((a) => a.activity_type === 'ai_tutor').length}
            accentColor="#c084fc"
          />
        </div>

        {/* ── Program Progress + Streak ───────────────────────────────────── */}
        <div className="dash-two-col">
          <ProgramProgressCard stats={stats} />
          <StreakCard streak={streak} />
        </div>

        {/* ── Activity Calendar ───────────────────────────────────────────── */}
        <ActivityCalendar />

        {/* ── Weekly Chart + Continue Coding ─────────────────────────────── */}
        <div className="dash-two-col">
          <WeeklyActivityChart activity={activity} />
          <ContinueCodingCard programs={recentPrograms} onContinue={handleContinue} />
        </div>

        {/* ── Learning Progress + Recommendations ────────────────────────── */}
        <div className="dash-two-col">
          <LearningProgressCard progress={progress} />
          <RecommendationsCard recs={recommendations} onSolve={handleSolveRec} />
        </div>

        {/* ── AI Insight + Learning Time ──────────────────────────────────── */}
        <div className="dash-two-col">
          <AIInsightCard insight={aiInsight} onNavigate={navigate} />
          <LearningTimeCard learningTime={learningTime} />
        </div>

        {/* ── Recent Visualizations + Recent Activity ─────────────────────── */}
        <div className="dash-two-col">
          <RecentVisualizationsCard visualizations={recentVisualizations} onView={handleViewViz} />
          <RecentActivitiesCard activities={recentActivities} />
        </div>

      </div>
    </div>
  );
}
