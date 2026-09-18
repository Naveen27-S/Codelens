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

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Code2, Flame, Eye, BrainCircuit,
  TrendingUp, Clock, Play, ChevronRight, ChevronLeft, Zap,
  ArrowUpRight, RefreshCw, Calendar, BarChart3, Trophy, CheckCircle2,
  Search, Filter, FileCode, X, Plus, Copy, Check, Trash2,
  Bug, Terminal, Sparkles, Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchAllDashboardData,
  fetchSavedPrograms,
  saveProgramDirectly,
  updateSavedProgram,
  runDashboardProgram,
  deleteSavedProgram,
  recordUserActivity,
  type DashboardData,
  type DayActivity,
  type RecentProgram,
  type LanguageProgress,
  type SavedProgram,
  type StreakData,
} from '../services/dashboardService';
import { recordDashboardEvent } from '../services/dashboardHistoryService';
import axios from 'axios';
import './DashboardPage.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

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

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, trend, accentColor = '#6366f1', onClick,
}: {
  icon: React.ReactNode; label: string; value: string | number; trend?: number;
  accentColor?: string; onClick?: () => void;
}) {
  const trendUp = trend !== undefined && trend > 0;
  return (
    <div
      className={`stat-card ${onClick ? 'stat-card-clickable' : ''}`}
      onClick={onClick}
      style={{
        '--stat-accent': `linear-gradient(90deg, ${accentColor}88, ${accentColor})`,
        '--stat-icon-bg': `${accentColor}18`,
        '--stat-icon-border': `${accentColor}30`,
        '--stat-icon-color': accentColor,
        cursor: onClick ? 'pointer' : undefined,
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

// ─── Coding Activity & Streak Calendar ────────────────────────────────────────

interface CalendarDay { date: string; count: number; }

function ActivityCalendar({ streak }: { streak: StreakData }) {
  const navigate = useNavigate();
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [maxCount, setMaxCount] = useState(1);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; count: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'heatmap'>('calendar');
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('codelens_jwt');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get<{ days: CalendarDay[]; max_count: number }>(
          `${API_URL}/dashboard/activity/calendar?days=365`,
          { headers }
        );
        setCalendarData(res.data.days);
        setMaxCount(Math.max(res.data.max_count, 1));
      } catch {
        const days: CalendarDay[] = [];
        for (let i = 365; i >= 0; i--) {
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

  const dateCountMap = useMemo(() => {
    const map = new Map<string, number>();
    calendarData.forEach(d => map.set(d.date, d.count));
    return map;
  }, [calendarData]);

  const activeDaysCount = useMemo(() => {
    return calendarData.filter(d => d.count > 0).length;
  }, [calendarData]);

  const totalActivitiesCount = useMemo(() => {
    return calendarData.reduce((acc, d) => acc + d.count, 0);
  }, [calendarData]);

  // Track active streak dates so they can be highlighted on the calendar
  const streakDatesSet = useMemo(() => {
    const set = new Set<string>();
    const current = streak?.current_streak || 0;
    if (current <= 0) return set;

    const baseDate = streak?.last_active_date ? new Date(streak.last_active_date) : new Date();
    for (let i = 0; i < current; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      set.add(d.toISOString().slice(0, 10));
    }
    return set;
  }, [streak]);

  // Streak milestone progress calculation
  const nextMilestone = useMemo(() => {
    const milestones = [3, 7, 14, 30, 50, 100, 365];
    const current = streak?.current_streak || 0;
    for (const m of milestones) {
      if (current < m) return m;
    }
    return 365;
  }, [streak?.current_streak]);

  const milestoneProgress = Math.min(
    100,
    Math.round(((streak?.current_streak || 0) / nextMilestone) * 100)
  );

  const getLevel = (count: number): number => {
    if (count === 0) return 0;
    const ratio = count / maxCount;
    if (ratio < 0.25) return 1;
    if (ratio < 0.5) return 2;
    if (ratio < 0.75) return 3;
    return 4;
  };

  // Month Calendar Cells
  const monthCells = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: {
      date: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      count: number;
      isStreak: boolean;
    }[] = [];

    const todayStr = new Date().toISOString().slice(0, 10);

    // Prev month filler
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dNum);
      const dateStr = prevDate.toISOString().slice(0, 10);
      cells.push({
        date: dateStr,
        dayNum: dNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        count: dateCountMap.get(dateStr) || 0,
        isStreak: streakDatesSet.has(dateStr),
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dateStr = dateObj.toISOString().slice(0, 10);
      cells.push({
        date: dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        count: dateCountMap.get(dateStr) || 0,
        isStreak: streakDatesSet.has(dateStr),
      });
    }

    // Next month filler
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      const dateStr = nextDate.toISOString().slice(0, 10);
      cells.push({
        date: dateStr,
        dayNum: i,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        count: dateCountMap.get(dateStr) || 0,
        isStreak: streakDatesSet.has(dateStr),
      });
    }

    return cells;
  }, [viewDate, dateCountMap, streakDatesSet]);

  // Heatmap: group days into weeks (columns of 7)
  const heatmapWeeks = useMemo(() => {
    const weeks: CalendarDay[][] = [];
    if (calendarData.length === 0) return weeks;
    const firstDOW = new Date(calendarData[0].date).getDay();
    const padded: (CalendarDay | null)[] = [
      ...Array(firstDOW).fill(null),
      ...calendarData,
    ];
    for (let i = 0; i < padded.length; i += 7) {
      weeks.push(padded.slice(i, i + 7).filter(Boolean) as CalendarDay[]);
    }
    return weeks;
  }, [calendarData]);

  const heatmapMonthLabels = useMemo(() => {
    const labels: { label: string; weekIdx: number }[] = [];
    heatmapWeeks.forEach((week, wi) => {
      if (week.length === 0) return;
      const d = new Date(week[0].date);
      if (wi === 0 || new Date(heatmapWeeks[wi - 1]?.[0]?.date ?? '').getMonth() !== d.getMonth()) {
        labels.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), weekIdx: wi });
      }
    });
    return labels;
  }, [heatmapWeeks]);

  const dayLabels = ['Sun', '', 'Tue', '', 'Thu', '', 'Sat'];

  const handlePrevMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };
  const handleToday = () => {
    const now = new Date();
    setViewDate(now);
    setSelectedDate(now.toISOString().slice(0, 10));
  };

  const selectedCount = dateCountMap.get(selectedDate) || 0;
  const isSelectedStreak = streakDatesSet.has(selectedDate);
  const isSelectedToday = selectedDate === new Date().toISOString().slice(0, 10);

  if (loading) {
    return (
      <div className="dash-card">
        <div className="dash-card-title"><Calendar size={14} />Coding Activity & Streak</div>
        <div className="dash-skeleton" style={{ height: '180px' }} />
      </div>
    );
  }

  return (
    <div className="dash-card activity-calendar-card">
      {/* ── Top Header with Title & View Switcher ── */}
      <div className="dash-card-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Calendar size={16} style={{ color: '#818cf8' }} />
            Coding Activity & Streak Tracker
          </span>
          {streak?.current_streak > 0 ? (
            <span className="cal-streak-pill-active">
              <Flame size={12} className="flame-flicker" />
              {streak.current_streak} Day Streak
            </span>
          ) : (
            <span className="cal-streak-pill-idle">
              <Zap size={11} />
              Start Streak Today
            </span>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="activity-view-tabs">
          <button
            type="button"
            className={`activity-tab-btn ${viewMode === 'calendar' ? 'active' : ''}`}
            onClick={() => setViewMode('calendar')}
          >
            <Calendar size={12} />
            Month Calendar
          </button>
          <button
            type="button"
            className={`activity-tab-btn ${viewMode === 'heatmap' ? 'active' : ''}`}
            onClick={() => setViewMode('heatmap')}
          >
            <BarChart3 size={12} />
            Contribution Heatmap
          </button>
        </div>
      </div>

      {/* ── Mode 1: Small Calendar & Streak Tracker ── */}
      {viewMode === 'calendar' && (
        <div className="small-cal-container">
          {/* Left: Small Calendar Widget */}
          <div className="small-cal-widget">
            <div className="small-cal-nav">
              <div className="small-cal-nav-btns">
                <button type="button" className="small-cal-arrow-btn" onClick={handlePrevMonth} title="Previous Month">
                  <ChevronLeft size={14} />
                </button>
                <span className="small-cal-month-title">
                  {viewDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
                <button type="button" className="small-cal-arrow-btn" onClick={handleNextMonth} title="Next Month">
                  <ChevronRight size={14} />
                </button>
              </div>
              <button type="button" className="small-cal-today-badge-btn" onClick={handleToday}>
                Today
              </button>
            </div>

            {/* Day of week initials */}
            <div className="small-cal-dow">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <span key={i} className="small-cal-dow-item">{d}</span>
              ))}
            </div>

            {/* Small Calendar Grid */}
            <div className="small-cal-grid">
              {monthCells.map((cell, idx) => {
                const level = getLevel(cell.count);
                const isSelected = selectedDate === cell.date;
                return (
                  <button
                    key={`${cell.date}-${idx}`}
                    type="button"
                    className={`small-cal-cell ${cell.isCurrentMonth ? '' : 'muted'} ${cell.isToday ? 'today' : ''} ${cell.isStreak ? 'streak' : ''} ${isSelected ? 'selected' : ''} cal-lvl-${level}`}
                    onClick={() => setSelectedDate(cell.date)}
                    title={`${cell.date}: ${cell.count} activities${cell.isStreak ? ' (Streak Day 🔥)' : ''}`}
                  >
                    <span className="small-cal-day-num">{cell.dayNum}</span>
                    {cell.isStreak ? (
                      <span className="small-cal-dot streak-dot" />
                    ) : cell.count > 0 ? (
                      <span className="small-cal-dot active-dot" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Streak Metrics & Day Detail Inspector */}
          <div className="small-cal-sidebar">
            {/* Streak Metrics Cards */}
            <div className="small-cal-stats-row">
              <div className="small-cal-stat-card">
                <div className="small-stat-icon fire">
                  <Flame size={15} />
                </div>
                <div>
                  <div className="small-stat-val">
                    {streak?.current_streak || 0} <span className="small-stat-unit">d</span>
                  </div>
                  <div className="small-stat-label">Current Streak</div>
                </div>
              </div>

              <div className="small-cal-stat-card">
                <div className="small-stat-icon trophy">
                  <Trophy size={15} />
                </div>
                <div>
                  <div className="small-stat-val">
                    {streak?.longest_streak || 0} <span className="small-stat-unit">d</span>
                  </div>
                  <div className="small-stat-label">Best Record</div>
                </div>
              </div>

              <div className="small-cal-stat-card">
                <div className="small-stat-icon check">
                  <CheckCircle2 size={15} />
                </div>
                <div>
                  <div className="small-stat-val">
                    {activeDaysCount} <span className="small-stat-unit">d</span>
                  </div>
                  <div className="small-stat-label">Active Days ({totalActivitiesCount} Ev)</div>
                </div>
              </div>
            </div>

            {/* Streak Milestone Progress */}
            <div className="small-cal-milestone">
              <div className="small-milestone-head">
                <span>Next Milestone: <strong>{nextMilestone}-Day Streak</strong></span>
                <span className="small-milestone-pct">{milestoneProgress}%</span>
              </div>
              <div className="small-milestone-track">
                <div className="small-milestone-fill" style={{ width: `${milestoneProgress}%` }} />
              </div>
              <div className="small-milestone-msg">
                {streak?.streak_message || (streak?.current_streak > 0 ? '🔥 Streak active! Keep coding daily to maintain it.' : '⚡ Complete a code run today to ignite your streak!')}
              </div>
            </div>

            {/* Selected Day Info */}
            <div className="small-cal-day-detail">
              <div className="small-day-detail-info">
                <div className="small-day-detail-date">
                  📅 {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  {isSelectedToday && <span className="inspector-pill-today">Today</span>}
                  {isSelectedStreak && <span className="inspector-pill-streak">🔥 Streak Day</span>}
                </div>
                <div className="small-day-detail-count">
                  {selectedCount > 0 ? (
                    <span>Recorded <strong style={{ color: '#818cf8' }}>{selectedCount}</strong> coding {selectedCount === 1 ? 'activity' : 'activities'}</span>
                  ) : (
                    <span style={{ color: '#64748b' }}>No activities recorded on this date</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="dash-btn-primary"
                style={{ fontSize: '11.5px', padding: '5px 12px', borderRadius: '7px' }}
                onClick={() => navigate('/editor')}
              >
                <Play size={11} /> Open Editor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mode 2: Contribution Heatmap View ── */}
      {viewMode === 'heatmap' && (
        <div className="cal-heatmap-view">
          <div className="calendar-grid-wrap">
            {/* Month labels */}
            <div className="calendar-months-row" style={{ paddingLeft: '28px' }}>
              {heatmapMonthLabels.map(({ label, weekIdx }) => (
                <div
                  key={`${label}-${weekIdx}`}
                  className="calendar-month-label"
                  style={{ width: `${(heatmapWeeks.slice(weekIdx, weekIdx + 5).length || 1) * 15}px`, flexShrink: 0 }}
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
                {heatmapWeeks.map((week, wi) => (
                  <div key={wi} className="calendar-week-col">
                    {Array(7).fill(null).map((_, di) => {
                      const day = week[di] ?? null;
                      if (!day) return <div key={di} className="calendar-cell cal-level-0" style={{ visibility: 'hidden' }} />;
                      const level = getLevel(day.count);
                      const isSelected = selectedDate === day.date;
                      return (
                        <div
                          key={di}
                          className={`calendar-cell cal-level-${level} ${isSelected ? 'cell-selected' : ''}`}
                          onClick={() => setSelectedDate(day.date)}
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

          {/* Day Inspector for Heatmap View */}
          {selectedDate && (
            <div className="cal-day-inspector" style={{ marginTop: '12px' }}>
              <div className="cal-inspector-left">
                <div className="cal-inspector-date">
                  📅 {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  {isSelectedToday && <span className="inspector-pill-today">Today</span>}
                  {isSelectedStreak && <span className="inspector-pill-streak">🔥 Streak Day</span>}
                </div>
                <div className="cal-inspector-summary">
                  {selectedCount > 0 ? (
                    <span>
                      Recorded <strong style={{ color: '#818cf8' }}>{selectedCount}</strong> coding {selectedCount === 1 ? 'activity' : 'activities'} on this date.
                    </span>
                  ) : (
                    <span style={{ color: '#64748b' }}>
                      No coding activities recorded on this date.
                    </span>
                  )}
                </div>
              </div>
              <div className="cal-inspector-actions">
                <button
                  type="button"
                  className="dash-btn-primary"
                  style={{ fontSize: '12px', padding: '6px 14px' }}
                  onClick={() => navigate('/editor')}
                >
                  <Play size={12} /> Practice in Editor
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="calendar-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="calendar-tooltip-date">
            {new Date(tooltip.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
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

// ─── Saved Programs History Card ──────────────────────────────────────────────

const LANGUAGES = [
  { id: 'all',        label: 'All' },
  { id: 'python',     label: 'Python' },
  { id: 'java',       label: 'Java' },
  { id: 'c',          label: 'C' },
  { id: 'cpp',        label: 'C++' },
  { id: 'javascript', label: 'JS' },
  { id: 'typescript', label: 'TS' },
];

interface StarterMeta {
  name: string;
  description: string;
  code: string;
  expectedOutput: string;
}

const STARTER_METADATA_BY_LANG: Record<string, StarterMeta> = {
  c: {
    name: 'C Sum & Math Program',
    description: 'Computes arithmetic summation and formats output to standard console in C.',
    code: `// C Program
#include <stdio.h>

int main() {
    int a = 15, b = 25;
    int sum = a + b;
    printf("C Program Output:\\n");
    printf("Sum of %d + %d = %d\\n", a, b, sum);
    return 0;
}
`,
    expectedOutput: `C Program Output:\nSum of 15 + 25 = 40`,
  },
  cpp: {
    name: 'C++ Vector Sort Algorithm',
    description: 'Sorts a dynamic sequence using C++ STL std::vector and std::sort.',
    code: `// C++ Program
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    vector<int> nums = {64, 25, 12, 22, 11};
    cout << "Original: ";
    for (int n : nums) cout << n << " ";
    cout << "\\n";
    
    sort(nums.begin(), nums.end());
    cout << "Sorted in C++: ";
    for (int n : nums) cout << n << " ";
    cout << "\\n";
    return 0;
}
`,
    expectedOutput: `Original: 64 25 12 22 11 \nSorted in C++: 11 12 22 25 64 `,
  },
  java: {
    name: 'Java Array Sorter & Display',
    description: 'Sorts an integer array and outputs formatted elements using java.util.Arrays.',
    code: `// Java Program
import java.util.Arrays;

public class Main {
    public static void main(String[] args) {
        int[] arr = {42, 17, 89, 3, 26};
        System.out.println("Executing Java Program...");
        Arrays.sort(arr);
        System.out.println("Sorted Array in Java: " + Arrays.toString(arr));
    }
}
`,
    expectedOutput: `Executing Java Program...\nSorted Array in Java: [3, 17, 26, 42, 89]`,
  },
  python: {
    name: 'Python QuickSort Algorithm',
    description: 'Demonstrates recursive quicksort in Python to partition and sort numbers.',
    code: `# Python Program
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)

numbers = [38, 27, 43, 3, 9, 82, 10]
print("Original list:", numbers)
sorted_numbers = quicksort(numbers)
print("Sorted in Python:", sorted_numbers)
`,
    expectedOutput: `Original list: [38, 27, 43, 3, 9, 82, 10]\nSorted in Python: [3, 9, 10, 27, 38, 43, 82]`,
  },
};

const STARTER_CODE_BY_LANG: Record<string, string> = {
  python: STARTER_METADATA_BY_LANG.python.code,
  java: STARTER_METADATA_BY_LANG.java.code,
  c: STARTER_METADATA_BY_LANG.c.code,
  cpp: STARTER_METADATA_BY_LANG.cpp.code,
};

function SavedProgramsHistoryCard({
  onOpenInEditor,
  onProgramSaved,
}: {
  onOpenInEditor: (p: SavedProgram, triggerRun?: boolean, triggerVisualize?: boolean) => void;
  onProgramSaved?: () => void;
}) {
  const [programs, setPrograms] = useState<SavedProgram[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [langFilter, setLangFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Modal states
  const [selectedProgram, setSelectedProgram] = useState<SavedProgram | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // New program form state
  const [newLang, setNewLang] = useState('python');
  const [newName, setNewName] = useState(STARTER_METADATA_BY_LANG.python.name);
  const [newDesc, setNewDesc] = useState(STARTER_METADATA_BY_LANG.python.description);
  const [newCode, setNewCode] = useState(STARTER_METADATA_BY_LANG.python.code);
  const [newOutput, setNewOutput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingRun, setIsTestingRun] = useState(false);
  const [testRunMessage, setTestRunMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  // Re-run in Details Modal state
  const [isRunningModalCode, setIsRunningModalCode] = useState(false);
  const [modalRunNotice, setModalRunNotice] = useState<string | null>(null);

  const load = useCallback(async (p = 1, s = search, l = langFilter) => {
    setLoading(true);
    try {
      const res = await fetchSavedPrograms({ page: p, limit: 10, language: l, search: s });
      setPrograms(res.items);
      setTotal(res.total);
      setPages(res.pages);
      setPage(res.page);
    } finally {
      setLoading(false);
    }
  }, [search, langFilter]);

  useEffect(() => { load(1, '', 'all'); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(1, search, langFilter);
  };

  const handleLang = (l: string) => {
    setLangFilter(l);
    load(1, search, l);
  };

  const handleNewLangChange = (lang: string) => {
    setNewLang(lang);
    setSaveError('');
    setTestRunMessage('');
    const meta = STARTER_METADATA_BY_LANG[lang];
    if (meta) {
      setNewCode(meta.code);
      const isDefaultName = !newName.trim() || Object.values(STARTER_METADATA_BY_LANG).some(m => m.name === newName);
      if (isDefaultName) {
        setNewName(meta.name);
      }
      const isDefaultDesc = !newDesc.trim() || Object.values(STARTER_METADATA_BY_LANG).some(m => m.description === newDesc);
      if (isDefaultDesc) {
        setNewDesc(meta.description);
      }
      setNewOutput('');
    } else {
      setNewCode(STARTER_CODE_BY_LANG[lang] || '');
    }
  };

  const handleTestRunInSaveModal = async () => {
    if (!newCode.trim()) {
      setSaveError('Please enter code before running');
      return;
    }
    setIsTestingRun(true);
    setSaveError('');
    setTestRunMessage('Running code live...');
    try {
      const res = await runDashboardProgram(newLang, newCode);
      const out = (res.stdout ? res.stdout.trim() : '') + (res.stderr ? (res.stdout ? '\n' : '') + '[Error]: ' + res.stderr.trim() : '');
      const finalOut = out || (res.success ? 'Program executed successfully with no stdout output.' : 'Program finished with no output.');
      setNewOutput(finalOut);
      setTestRunMessage(res.success ? `✓ Executed in ${res.timeMs}ms — Output captured below!` : `Executed with issues (${res.timeMs}ms)`);
    } catch (err: any) {
      setNewOutput('Execution error: ' + (err.message || 'Unknown error'));
      setTestRunMessage('Execution failed');
    } finally {
      setIsTestingRun(false);
    }
  };

  const handleRerunInModal = async () => {
    if (!selectedProgram) return;
    setIsRunningModalCode(true);
    setModalRunNotice('Running program...');
    try {
      const res = await runDashboardProgram(selectedProgram.language, selectedProgram.code);
      const out = (res.stdout ? res.stdout.trim() : '') + (res.stderr ? (res.stdout ? '\n' : '') + '[Error]: ' + res.stderr.trim() : '');
      const finalOut = out || (res.success ? 'Program executed successfully with no stdout output.' : 'Program finished with no output.');
      const updatedStatus = res.success ? 'completed' : 'error';

      // Save updated output to MongoDB
      await updateSavedProgram(selectedProgram.program_id, {
        output: finalOut,
        status: updatedStatus,
      });

      // Update state in modal
      const updatedProg: SavedProgram = {
        ...selectedProgram,
        output: finalOut,
        status: updatedStatus,
      };
      setSelectedProgram(updatedProg);

      // Update list in parent card
      setPrograms(prev => prev.map(p => p.program_id === selectedProgram.program_id ? updatedProg : p));
      setModalRunNotice(`✓ Executed in ${res.timeMs}ms & updated in MongoDB!`);
      setTimeout(() => setModalRunNotice(null), 4000);
      onProgramSaved?.();
    } catch (err: any) {
      setModalRunNotice('Execution error: ' + (err.message || 'Failed'));
    } finally {
      setIsRunningModalCode(false);
    }
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setSaveError('Please enter a program name');
      return;
    }
    if (!newCode.trim()) {
      setSaveError('Please enter code for the program');
      return;
    }

    setIsSaving(true);
    setSaveError('');
    try {
      const langNorm = newLang.toLowerCase();
      const saved = await saveProgramDirectly({
        name: newName.trim(),
        language: langNorm,
        code: newCode,
        description: newDesc.trim() || `Custom ${newLang.toUpperCase()} program saved in CodeLens.`,
        output: newOutput.trim(),
        status: 'completed',
      });

      // Record activity
      await recordUserActivity({
        activity_type: 'program_saved',
        title: `Saved ${newLang.toUpperCase()} Program`,
        description: newDesc.trim() || `Saved "${newName.trim()}" to your program library.`,
        language: langNorm,
        program_name: newName.trim(),
        status: 'completed',
        duration_seconds: 1,
        metadata_json: {
          program_id: saved.program_id,
          source_code: newCode,
          output: newOutput.trim(),
          description: newDesc.trim(),
        },
      });

      // Reset form and reload
      const nextMeta = STARTER_METADATA_BY_LANG[newLang] || STARTER_METADATA_BY_LANG.python;
      setNewName(nextMeta.name);
      setNewDesc(nextMeta.description);
      setNewOutput('');
      setNewCode(nextMeta.code);
      setTestRunMessage('');
      setIsSaveModalOpen(false);
      await load(1, search, langFilter);
      onProgramSaved?.();
    } catch (err: any) {
      setSaveError(err.response?.data?.detail || 'Failed to save program to MongoDB. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (programId: string) => {
    if (!window.confirm('Are you sure you want to delete this program from MongoDB?')) return;
    const ok = await deleteSavedProgram(programId);
    if (ok) {
      if (selectedProgram?.program_id === programId) {
        setSelectedProgram(null);
      }
      await load(page, search, langFilter);
      onProgramSaved?.();
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const langColor: Record<string, string> = {
    python:     '#3b82f6',   // blue
    javascript: '#f59e0b',   // amber
    typescript: '#06b6d4',   // cyan
    java:       '#f97316',   // orange
    c:          '#10b981',   // emerald
    cpp:        '#8b5cf6',   // violet
  };

  return (
    <div id="saved-programs-section" className="dash-card sp-history-card">
      {/* Header */}
      <div className="dash-card-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileCode size={15} style={{ color: '#818cf8' }} />
          Saved Programs History
          {total > 0 && <span className="sp-total-badge">{total}</span>}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="sp-btn-save-new"
            onClick={() => {
              setSaveError('');
              setIsSaveModalOpen(true);
            }}
          >
            <Plus size={13} /> Save New Program
          </button>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="sp-controls">
        <form className="sp-search-form" onSubmit={handleSearch}>
          <Search size={13} className="sp-search-icon" />
          <input
            className="sp-search-input"
            placeholder="Search saved C, C++, Java, Python programs…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="sp-clear-btn" onClick={() => { setSearch(''); load(1, '', langFilter); }}>
              <X size={12} />
            </button>
          )}
        </form>
        <div className="sp-lang-filters">
          <Filter size={12} style={{ color: '#64748b', flexShrink: 0 }} />
          {LANGUAGES.map(lang => (
            <button
              key={lang.id}
              className={`sp-lang-pill ${langFilter === lang.id ? 'active' : ''}`}
              style={langFilter === lang.id ? { borderColor: langColor[lang.id] || '#6366f1', color: langColor[lang.id] || '#6366f1', background: `${langColor[lang.id] || '#6366f1'}18` } : {}}
              onClick={() => handleLang(lang.id)}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* Program List */}
      {loading ? (
        <div className="sp-loading">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="dash-skeleton" style={{ height: 64, borderRadius: 10 }} />
          ))}
        </div>
      ) : programs.length === 0 ? (
        <div className="dash-empty-state">
          <div className="dash-empty-icon">📂</div>
          <div className="dash-empty-text">No saved programs found.</div>
          <div className="dash-empty-sub">
            {search || langFilter !== 'all'
              ? 'Try a different filter or search term.'
              : 'Save a program in C, C++, Java, or Python and it will appear here with full code and history.'}
          </div>
          <button
            className="sp-btn-save-new"
            style={{ marginTop: 12 }}
            onClick={() => setIsSaveModalOpen(true)}
          >
            <Plus size={13} /> Save Your First Program
          </button>
        </div>
      ) : (
        <div className="sp-list">
          {programs.map(p => {
            const isExpanded = expanded === p.program_id;
            const normLang = p.language.toLowerCase();
            const color = langColor[normLang] || '#6366f1';
            const previewLines = p.code.split('\n').slice(0, 6).join('\n');

            return (
              <div key={p.program_id} className={`sp-item ${isExpanded ? 'expanded' : ''}`}>
                {/* Row: Click opens the full details modal */}
                <div className="sp-item-row" onClick={() => setSelectedProgram(p)}>
                  <div className="sp-lang-dot" style={{ background: color }} />
                  <div className="sp-item-info">
                    <div className="sp-item-name-row">
                      <span className="sp-item-name">{p.name}</span>
                      <span className="sp-badge-lang" style={{ color, borderColor: `${color}40`, background: `${color}15` }}>
                        {p.language.toUpperCase()}
                      </span>
                      {p.output && (
                        <span className="sp-badge-has-output" title="Has execution output recorded">
                          ✓ Output Saved
                        </span>
                      )}
                    </div>
                    <div className="sp-item-meta">
                      <span>{p.line_count} lines</span>
                      <span>·</span>
                      <span>{relativeTime(p.updated_at || p.created_at)}</span>
                      {p.description && (
                        <>
                          <span>·</span>
                          <span className="sp-desc-snippet">{p.description}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="sp-item-actions">
                    <button
                      className="sp-details-btn"
                      title="View code, output, and details"
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedProgram(p);
                      }}
                    >
                      <Eye size={12} /> Details
                    </button>
                    <button
                      className="sp-open-btn"
                      title="Open & Run in Editor"
                      onClick={e => {
                        e.stopPropagation();
                        onOpenInEditor(p);
                      }}
                    >
                      <Play size={11} /> Open
                    </button>
                    <button
                      className="sp-quick-expand-btn"
                      title={isExpanded ? 'Collapse preview' : 'Quick preview'}
                      onClick={e => {
                        e.stopPropagation();
                        setExpanded(isExpanded ? null : p.program_id);
                      }}
                    >
                      <ChevronRight size={14} className={`sp-chevron ${isExpanded ? 'rotated' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Inline Preview */}
                {isExpanded && (
                  <div className="sp-code-preview">
                    <pre className="sp-code-block"><code>{previewLines}{p.code.split('\n').length > 6 ? '\n…' : ''}</code></pre>
                    <div className="sp-code-footer">
                      <span className="text-xs text-slate-400">
                        Saved: {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="sp-details-btn" onClick={() => setSelectedProgram(p)}>
                          <Eye size={11} /> Full Program Details
                        </button>
                        <button className="sp-open-btn" onClick={() => onOpenInEditor(p)}>
                          <Play size={11} /> Open in Editor
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="sp-pagination">
          <button className="sp-page-btn" disabled={page <= 1} onClick={() => load(page - 1)}>← Prev</button>
          <span className="sp-page-info">Page {page} of {pages} ({total} programs)</span>
          <button className="sp-page-btn" disabled={page >= pages} onClick={() => load(page + 1)}>Next →</button>
        </div>
      )}

      {/* ─── Program Details Modal (What program is saved & done) ───────────────── */}
      {selectedProgram && (
        <div className="sp-modal-backdrop" onClick={() => setSelectedProgram(null)}>
          <div className="sp-modal-card" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sp-modal-header">
              <div className="sp-modal-title-area">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    className="sp-badge-lang"
                    style={{
                      color: langColor[selectedProgram.language.toLowerCase()] || '#6366f1',
                      borderColor: `${langColor[selectedProgram.language.toLowerCase()] || '#6366f1'}50`,
                      background: `${langColor[selectedProgram.language.toLowerCase()] || '#6366f1'}20`,
                      fontSize: 12,
                      padding: '2px 8px',
                    }}
                  >
                    {selectedProgram.language.toUpperCase()}
                  </span>
                  <h3 className="sp-modal-title">{selectedProgram.name}</h3>
                </div>
                <div className="sp-modal-subtitle">
                  <span>{selectedProgram.line_count} lines of code</span>
                  <span>·</span>
                  <span>Saved on {new Date(selectedProgram.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  <span>·</span>
                  <span style={{ color: selectedProgram.status === 'error' ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                    Status: {selectedProgram.status === 'error' ? 'Execution Error' : 'Completed'}
                  </span>
                </div>
              </div>
              <button className="sp-modal-close-btn" onClick={() => setSelectedProgram(null)} title="Close">
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="sp-modal-body">
              {/* Section 1: What This Program Can Do (Description) */}
              <div className="sp-modal-section">
                <div className="sp-modal-section-title">
                  <Sparkles size={14} style={{ color: '#f59e0b' }} />
                  What This Program Can Do (Capabilities & Description)
                </div>
                <div className="sp-modal-desc-box">
                  {selectedProgram.description || `This is a saved ${selectedProgram.language.toUpperCase()} program designed for algorithmic and computational tasks.`}
                </div>
              </div>

              {/* Section 2: What This Program Has Done (Execution Output) */}
              <div className="sp-modal-section">
                <div className="sp-modal-section-title" style={{ justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Terminal size={14} style={{ color: '#10b981' }} />
                    What The Program Has Done (Execution Output)
                  </span>
                  <button
                    type="button"
                    className="sp-modal-run-btn"
                    onClick={handleRerunInModal}
                    disabled={isRunningModalCode}
                    title="Run code live and persist fresh output to MongoDB"
                  >
                    {isRunningModalCode ? (
                      <>
                        <Loader2 size={12} className="sp-spin" /> Running...
                      </>
                    ) : (
                      <>
                        <Play size={11} fill="currentColor" /> Re-run & Update Output
                      </>
                    )}
                  </button>
                </div>

                {modalRunNotice && (
                  <div className={`sp-modal-notice ${modalRunNotice.includes('error') || modalRunNotice.includes('Failed') ? 'notice-err' : 'notice-ok'}`}>
                    {modalRunNotice}
                  </div>
                )}

                <div className="sp-terminal-window">
                  <div className="sp-terminal-topbar">
                    <div className="sp-terminal-dots">
                      <span className="dot dot-red" />
                      <span className="dot dot-yellow" />
                      <span className="dot dot-green" />
                    </div>
                    <span className="sp-terminal-title">{selectedProgram.language.toUpperCase()} Output Terminal</span>
                    <span className={`sp-terminal-badge ${selectedProgram.status === 'error' ? 'badge-err' : 'badge-ok'}`}>
                      {selectedProgram.status === 'error' ? 'Error' : 'Completed'}
                    </span>
                  </div>
                  {selectedProgram.output ? (
                    <pre className="sp-modal-terminal-box">
                      <code>{selectedProgram.output}</code>
                    </pre>
                  ) : (
                    <div className="sp-modal-no-output">
                      <span>No execution output saved yet. Click <strong>"Re-run & Update Output"</strong> above to execute this {selectedProgram.language.toUpperCase()} code live and save results to the backend!</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Saved Source Code */}
              <div className="sp-modal-section">
                <div className="sp-modal-section-title" style={{ justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileCode size={14} style={{ color: '#818cf8' }} />
                    What Program Is Saved (Source Code - {selectedProgram.language.toUpperCase()})
                  </span>
                  <button
                    type="button"
                    className="sp-copy-btn"
                    onClick={() => handleCopyCode(selectedProgram.code)}
                  >
                    {copied ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                    {copied ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
                <div className="sp-modal-code-container">
                  <pre className="sp-modal-code-block">
                    <code>{selectedProgram.code}</code>
                  </pre>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="sp-modal-footer">
              <button
                type="button"
                className="sp-btn-danger"
                onClick={() => handleDelete(selectedProgram.program_id)}
                title="Delete this program"
              >
                <Trash2 size={13} /> Delete
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="sp-btn-secondary"
                  onClick={() => {
                    onOpenInEditor(selectedProgram, false, true);
                  }}
                  title="Visualize this code"
                >
                  <Bug size={13} /> Visualize
                </button>
                <button
                  type="button"
                  className="sp-btn-primary"
                  onClick={() => {
                    onOpenInEditor(selectedProgram, true, false);
                  }}
                  title="Open & execute this code in the Editor"
                >
                  <Play size={13} fill="currentColor" /> Open in Editor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Save New Program Modal (C, C++, Java, Python) ────────────────────── */}
      {isSaveModalOpen && (
        <div className="sp-modal-backdrop" onClick={() => setIsSaveModalOpen(false)}>
          <div className="sp-modal-card sp-modal-card-form" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="sp-modal-header">
              <div>
                <h3 className="sp-modal-title">💾 Save Program to MongoDB</h3>
                <p className="sp-modal-subtitle">
                  Save a program in C, C++, Java, or Python with its description and execution output.
                </p>
              </div>
              <button className="sp-modal-close-btn" onClick={() => setIsSaveModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveSubmit} className="sp-form-body">
              {saveError && (
                <div className="sp-form-error">
                  {saveError}
                </div>
              )}

              {/* Language selection tabs: C, C++, Java, Python */}
              <div className="sp-form-group">
                <label className="sp-form-label">Select Programming Language:</label>
                <div className="sp-lang-select-tabs">
                  {[
                    { id: 'python', label: 'Python (.py)', color: '#3b82f6' },
                    { id: 'c',      label: 'C (.c)',         color: '#10b981' },
                    { id: 'cpp',    label: 'C++ (.cpp)',     color: '#8b5cf6' },
                    { id: 'java',   label: 'Java (.java)',   color: '#f97316' },
                  ].map(tab => (
                    <button
                      type="button"
                      key={tab.id}
                      className={`sp-lang-tab ${newLang === tab.id ? 'active' : ''}`}
                      style={newLang === tab.id ? { borderColor: tab.color, color: tab.color, background: `${tab.color}18` } : {}}
                      onClick={() => handleNewLangChange(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Program Name */}
              <div className="sp-form-group">
                <label className="sp-form-label">Program Name / Title *</label>
                <input
                  type="text"
                  className="sp-form-input"
                  placeholder={`e.g. Binary Search in ${newLang.toUpperCase()}`}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                />
              </div>

              {/* Program Description: What the program can do */}
              <div className="sp-form-group">
                <label className="sp-form-label">What This Program Can Do (Description / Purpose)</label>
                <input
                  type="text"
                  className="sp-form-input"
                  placeholder="e.g. Sorts an array of numbers and prints them in ascending order"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                />
              </div>

              {/* Source Code: What program is saved */}
              <div className="sp-form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="sp-form-label">What Program Is Saved (Source Code - {newLang.toUpperCase()}) *</label>
                  <button
                    type="button"
                    className="sp-form-reset-btn"
                    onClick={() => {
                      const meta = STARTER_METADATA_BY_LANG[newLang];
                      if (meta) setNewCode(meta.code);
                    }}
                  >
                    Reset Starter Code
                  </button>
                </div>
                <textarea
                  className="sp-form-textarea sp-code-font"
                  rows={8}
                  value={newCode}
                  onChange={e => setNewCode(e.target.value)}
                  placeholder="Paste or write your code here..."
                  required
                />
              </div>

              {/* Output: What program has done (with Test Run button) */}
              <div className="sp-form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="sp-form-label">
                    Execution Output / Result (What The Program Has Done)
                  </label>
                  <button
                    type="button"
                    className="sp-test-run-btn"
                    onClick={handleTestRunInSaveModal}
                    disabled={isTestingRun}
                    title="Execute this code now and capture output"
                  >
                    {isTestingRun ? (
                      <>
                        <Loader2 size={11} className="sp-spin" /> Running...
                      </>
                    ) : (
                      <>
                        <Play size={11} fill="currentColor" /> ⚡ Test Run & Capture Output
                      </>
                    )}
                  </button>
                </div>
                {testRunMessage && (
                  <div className={`sp-test-run-notice ${testRunMessage.includes('issues') || testRunMessage.includes('failed') ? 'notice-err' : 'notice-ok'}`}>
                    {testRunMessage}
                  </div>
                )}
                <textarea
                  className="sp-form-textarea sp-code-font sp-terminal-style"
                  rows={4}
                  value={newOutput}
                  onChange={e => setNewOutput(e.target.value)}
                  placeholder={`Click "⚡ Test Run & Capture Output" above to run this ${newLang.toUpperCase()} code live and auto-fill the output, or enter manual output.`}
                />
              </div>

              {/* Submit Buttons */}
              <div className="sp-form-footer">
                <button
                  type="button"
                  className="sp-btn-secondary"
                  onClick={() => setIsSaveModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sp-btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={13} className="sp-spin" /> Saving to MongoDB…
                    </>
                  ) : (
                    `Save ${newLang.toUpperCase()} Program to Backend`
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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

  useEffect(() => {
    loadData();
    // Record dashboard open in MongoDB dashboard_history
    recordDashboardEvent({
      event_type: 'dashboard_open',
      title: 'Opened Dashboard',
      description: 'User visited the main dashboard page.',
    });
  }, [loadData]);

  // Navigate to editor with a saved program loaded (from SavedProgramsHistory)
  const handleOpenSavedProgram = useCallback((p: SavedProgram, triggerRun = false, triggerVisualize = false) => {
    navigate('/editor', {
      state: {
        code: p.code,
        language: p.language.toLowerCase(),
        programTitle: p.name,
        triggerRun,
        triggerVisualize,
      },
    });
  }, [navigate]);

  // Navigate to editor with a saved program loaded
  const handleContinue = useCallback((p: RecentProgram) => {
    // Record program open in MongoDB dashboard_history
    recordDashboardEvent({
      event_type: 'program_open',
      title: `Opened program: ${p.title}`,
      description: `Continued editing ${p.language} program from the dashboard.`,
      metadata: { program_id: String(p.id), language: p.language, title: p.title },
    });
    navigate('/editor', {
      state: {
        code: p.sourceCode,
        language: p.language.toLowerCase(),
        programId: String(p.id),
        programTitle: p.title,
      },
    });
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
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="dash-skeleton" style={{ height: '110px' }} />
            ))}
          </div>
          <div className="dash-skeleton" style={{ height: '180px' }} />
          <div className="dash-two-col">
            <div className="dash-skeleton" style={{ height: '240px' }} />
            <div className="dash-skeleton" style={{ height: '240px' }} />
          </div>
          <div className="dash-two-col">
            <div className="dash-skeleton" style={{ height: '220px' }} />
            <div className="dash-skeleton" style={{ height: '220px' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { stats, recentPrograms, activity, progress, aiInsight, streak, learningTime } = data;

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="dash-header">
          <div>
            <div className="dash-greeting-badge">
              <span className="dash-pulse-dot" />
              <span>Personal Workspace</span>
            </div>
            <h1>{greeting}, {userName}! 👋</h1>
            <p>Track your coding analytics, review saved programs, and continue your learning streak.</p>
          </div>
          <div className="dash-header-actions">
            <button className="dash-btn-primary" onClick={() => navigate('/editor')}>
              <Play size={14} /> Open Editor
            </button>
            <button
              className="dash-btn-secondary"
              onClick={() => loadData(true)}
              disabled={refreshing}
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* ── Stat Cards (Programs Saved, Day Streak, Learning Time) ──── */}
        <div className="stat-cards-grid">
          {/* 1. Programs Saved */}
          <StatCard
            icon={<Code2 size={16} />}
            label="Programs Saved"
            value={stats.totalPrograms}
            trend={stats.programsTrend}
            accentColor="#6366f1"
            onClick={() => {
              const el = document.getElementById('saved-programs-section');
              el?.scrollIntoView({ behavior: 'smooth' });
              el?.classList.add('sp-highlight-pulse');
              setTimeout(() => el?.classList.remove('sp-highlight-pulse'), 1500);
            }}
          />
          {/* 2. Day Streak */}
          <StatCard
            icon={<Flame size={16} />}
            label="Day Streak"
            value={`${streak.current_streak}d`}
            accentColor="#f59e0b"
          />
          {/* 3. Learning Time */}
          <StatCard
            icon={<Clock size={16} />}
            label="Learning Time"
            value={`${stats.learningHours}h`}
            trend={stats.learningTrend}
            accentColor="#06b6d4"
          />
        </div>

        {/* ── Coding Activity & Streak Calendar ───────────────────────────── */}
        <ActivityCalendar streak={streak} />

        {/* ── Weekly Chart + Continue Coding ─────────────────────────────── */}
        <div className="dash-two-col">
          <WeeklyActivityChart activity={activity} />
          <ContinueCodingCard programs={recentPrograms} onContinue={handleContinue} />
        </div>

        {/* ── Learning Progress + Learning Time ──────────────────────────── */}
        <div className="dash-two-col">
          <LearningProgressCard progress={progress} />
          <LearningTimeCard learningTime={learningTime} />
        </div>

        {/* ── AI Learning Insight ────────────────────────────────────────── */}
        <AIInsightCard insight={aiInsight} onNavigate={navigate} />

        {/* ── Saved Programs History (full-width) ────────────────────────── */}
        <SavedProgramsHistoryCard
          onOpenInEditor={handleOpenSavedProgram}
          onProgramSaved={() => loadData(false)}
        />

      </div>
    </div>
  );
}
