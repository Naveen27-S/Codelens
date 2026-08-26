import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Search,
  Calendar,
  Filter,
  Play,
  Eye,
  BrainCircuit,
  BookOpen,
  Code2,
  Clock,
  CheckCircle2,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Terminal,
} from 'lucide-react';
import {
  fetchFullActivities,
  type UserActivityItem,
  type ActivityListResult,
} from '../services/dashboardService';

// ─── Format Date/Time helper ──────────────────────────────────────────────────

function formatTimestamp(isoString?: string): { relative: string; full: string } {
  if (!isoString) return { relative: 'Recently', full: 'Unknown date' };
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return { relative: isoString, full: isoString };

  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  const fullStr = d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  if (isToday) {
    return { relative: `Today · ${timeStr}`, full: fullStr };
  }
  if (isYesterday) {
    return { relative: `Yesterday · ${timeStr}`, full: fullStr };
  }

  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return { relative: `${dateStr} · ${timeStr}`, full: fullStr };
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'code_execution':
    case 'execution':
      return <Play className="w-4 h-4 text-violet-400" />;
    case 'visualization_started':
    case 'visualization_completed':
    case 'visualization':
      return <Eye className="w-4 h-4 text-emerald-400" />;
    case 'ai_tutor':
    case 'ai_explanation':
      return <BrainCircuit className="w-4 h-4 text-indigo-400" />;
    case 'practice':
    case 'practice_completed':
      return <BookOpen className="w-4 h-4 text-amber-400" />;
    case 'program_saved':
    case 'program_opened':
      return <Code2 className="w-4 h-4 text-cyan-400" />;
    default:
      return <Sparkles className="w-4 h-4 text-slate-400" />;
  }
}

function getActivityColor(type: string) {
  switch (type) {
    case 'code_execution':
    case 'execution':
      return 'bg-violet-500/15 border-violet-500/30 text-violet-400';
    case 'visualization_started':
    case 'visualization_completed':
    case 'visualization':
      return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400';
    case 'ai_tutor':
    case 'ai_explanation':
      return 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400';
    case 'practice':
    case 'practice_completed':
      return 'bg-amber-500/15 border-amber-500/30 text-amber-400';
    case 'program_saved':
    case 'program_opened':
      return 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400';
    default:
      return 'bg-slate-800/60 border-slate-700/60 text-slate-400';
  }
}

// ─── Modal Details Component ──────────────────────────────────────────────────

function ActivityModal({
  activity,
  onClose,
}: {
  activity: UserActivityItem;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const time = formatTimestamp(activity.started_at);
  const meta = activity.metadata_json || {};

  const handleOpenAction = () => {
    onClose();
    if (activity.activity_type.includes('visualization')) {
      navigate('/editor', {
        state: {
          code: meta.source_code,
          language: activity.language || 'python',
          activeTab: 'visualization',
          visualization: meta.mermaid_explanation,
        },
      });
    } else {
      navigate('/editor', {
        state: {
          code: meta.source_code,
          language: activity.language || 'python',
        },
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${getActivityColor(activity.activity_type)}`}>
              {getActivityIcon(activity.activity_type)}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">{activity.title}</h3>
              <span className="text-xs text-slate-400 capitalize">
                {activity.activity_type.replace('_', ' ')}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3.5 mb-6 text-sm">
          {activity.description && (
            <p className="text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
              {activity.description}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
              <span className="text-xs text-slate-500 font-medium block">Program</span>
              <span className="text-slate-200 font-semibold truncate block">
                {activity.program_name || 'N/A'}
              </span>
            </div>
            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
              <span className="text-xs text-slate-500 font-medium block">Language</span>
              <span className="text-slate-200 font-semibold capitalize block">
                {activity.language || 'Python'}
              </span>
            </div>
            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
              <span className="text-xs text-slate-500 font-medium block">Topic</span>
              <span className="text-slate-200 font-semibold block">{activity.topic || 'General Coding'}</span>
            </div>
            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
              <span className="text-xs text-slate-500 font-medium block">Status</span>
              <span className="text-emerald-400 font-semibold capitalize flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {activity.status || 'Completed'}
              </span>
            </div>
          </div>

          <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/50 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">Exact Date & Time:</span>
              <span className="text-slate-300 font-mono">{time.full}</span>
            </div>
            {activity.duration_seconds !== undefined && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Duration:</span>
                <span className="text-slate-300 font-mono">
                  {activity.duration_seconds >= 60
                    ? `${Math.round(activity.duration_seconds / 60)} min`
                    : `${Math.round(activity.duration_seconds)} sec`}
                </span>
              </div>
            )}
            {meta.steps && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Execution Steps:</span>
                <span className="text-emerald-400 font-mono">{meta.steps} steps</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleOpenAction}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]"
          >
            <ExternalLink className="w-4 h-4" />
            Open in Editor
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Activity History Page ───────────────────────────────────────────────

export function ActivityHistoryPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<ActivityListResult | null>(null);
  const [loading, setLoading] = useState(true);

  const [activityType, setActivityType] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  const [selectedActivity, setSelectedActivity] = useState<UserActivityItem | null>(null);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchFullActivities({
        activity_type: activityType,
        date_range: dateRange,
        search,
        page,
        limit: 10,
      });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [activityType, dateRange, search, page]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const typeTabs = [
    { id: 'all', label: 'All Activities' },
    { id: 'code_execution', label: 'Executions' },
    { id: 'visualization', label: 'Visualizations' },
    { id: 'ai_tutor', label: 'AI Tutor' },
    { id: 'practice', label: 'Practice' },
    { id: 'programs', label: 'Programs' },
  ];

  const dateOptions = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: 'this_week', label: 'This Week' },
    { id: 'this_month', label: 'This Month' },
  ];

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-slate-950 text-white">
      {/* Background ambient lighting */}
      <div className="fixed top-0 left-64 right-0 h-full pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-indigo-600/8 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[10%] w-[35%] h-[35%] rounded-full bg-violet-600/8 blur-[100px]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-8">
        {/* Header with back navigation */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-indigo-400 transition-colors mb-2 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back to Dashboard
            </button>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Learning & Activity History
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Search, filter, and review all your coding sessions, visualizer runs, and practice milestones.
            </p>
          </div>

          <button
            onClick={() => navigate('/editor')}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] w-fit"
          >
            <Terminal className="w-4 h-4" />
            Open Editor
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 mb-6 space-y-4 shadow-xl">
          {/* Top Row: Type Tabs & Date Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Category tabs */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-slate-950/60 rounded-xl border border-slate-800/60">
              {typeTabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setActivityType(t.id);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activityType === t.id
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Date filter dropdown/buttons */}
            <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800/60">
              <Calendar className="w-3.5 h-3.5 text-slate-500 ml-2" />
              {dateOptions.map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    setDateRange(d.id);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    dateRange === d.id
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Row: Search Box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by algorithm name, language, topic, or description..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/80 transition-all"
            />
          </div>
        </div>

        {/* Results List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-20 bg-slate-900/40 border border-slate-800/40 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800/50 rounded-2xl p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center mx-auto mb-3 text-slate-500">
              <Filter className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">No activities found</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mb-5">
              Try adjusting your search query or selecting a different category or date filter.
            </p>
            <button
              onClick={() => {
                setActivityType('all');
                setDateRange('all');
                setSearch('');
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {data.items.map((act) => {
              const time = formatTimestamp(act.started_at);
              return (
                <motion.div
                  key={act.id}
                  layout
                  onClick={() => setSelectedActivity(act)}
                  className="group flex items-center justify-between p-4 bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800/60 hover:border-indigo-500/40 rounded-2xl transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`p-2.5 rounded-xl border shrink-0 ${getActivityColor(act.activity_type)}`}>
                      {getActivityIcon(act.activity_type)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-200 group-hover:text-white truncate">
                          {act.title}
                        </h4>
                        {act.topic && (
                          <span className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-medium">
                            {act.topic}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {act.description || act.program_name || 'CodeLens Practice Activity'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 ml-4 text-right">
                    <div className="hidden sm:flex flex-col items-end">
                      <span className="text-xs font-semibold text-slate-300 font-mono">
                        {time.relative}
                      </span>
                      {act.duration_seconds !== undefined && (
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {act.duration_seconds >= 60
                            ? `${Math.round(act.duration_seconds / 60)}m`
                            : `${Math.round(act.duration_seconds)}s`}
                        </span>
                      )}
                    </div>
                    <span className="text-xs px-3 py-1.5 rounded-xl bg-slate-800/80 group-hover:bg-indigo-600 text-slate-300 group-hover:text-white font-medium transition-colors">
                      Details →
                    </span>
                  </div>
                </motion.div>
              );
            })}

            {/* Pagination Controls */}
            {data.pages > 1 && (
              <div className="flex items-center justify-between pt-4 px-2 text-sm text-slate-400">
                <span>
                  Showing {Math.min(data.total, (page - 1) * 10 + 1)} -{' '}
                  {Math.min(data.total, page * 10)} of {data.total} activities
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 border border-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-xs font-semibold hover:bg-slate-800 text-slate-300 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <span className="text-xs font-semibold text-slate-300 px-2">
                    Page {page} of {data.pages}
                  </span>
                  <button
                    disabled={page >= data.pages}
                    onClick={() => setPage((p) => p + 1)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 border border-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-xs font-semibold hover:bg-slate-800 text-slate-300 transition-colors"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Activity Details Modal */}
      <AnimatePresence>
        {selectedActivity && (
          <ActivityModal
            activity={selectedActivity}
            onClose={() => setSelectedActivity(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
