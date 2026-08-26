/**
 * DashboardPage.tsx
 *
 * CodeLens AI — Developer Learning Command Center
 * Complete Dashboard with User Practice & Activity Tracking System
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Code2,
  Eye,
  Clock,
  TrendingUp,
  Play,
  History,
  BrainCircuit,
  BookOpen,
  Zap,
  Plus,
  ChevronRight,
  BarChart2,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  Terminal,
  Lightbulb,
  Flame,
  X,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchAllDashboardData,
  type DashboardData,
  type DashboardStats,
  type RecentProgram,
  type RecentVisualization,
  type DayActivity,
  type LanguageProgress,
  type Recommendation,
  type UserActivityItem,
  type StreakData,
} from '../services/dashboardService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPracticeTemplate(topicId: string): { code: string; language: string } {
  const templates: Record<string, { code: string; language: string }> = {
    arrays: {
      language: 'python',
      code: `# Practice Arrays: Reverse an array in place
def reverse_array(arr):
    left = 0
    right = len(arr) - 1
    while left < right:
        arr[left], arr[right] = arr[right], arr[left]
        left += 1
        right -= 1
    return arr

my_list = [1, 2, 3, 4, 5]
print("Original:", my_list)
print("Reversed:", reverse_array(my_list))`
    },
    'linked-lists': {
      language: 'python',
      code: `# Practice Linked Lists: Traverse a singly linked list
class Node:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def print_list(head):
    current = head
    while current:
        print(current.val, end=" -> ")
        current = current.next
    print("None")

# Create a small list: 1 -> 2 -> 3
head = Node(1, Node(2, Node(3)))
print_list(head)`
    },
    stacks: {
      language: 'python',
      code: `# Practice Stacks: Implement a MinStack using helper list
class MinStack:
    def __init__(self):
        self.stack = []
        self.min_stack = []

    def push(self, val: int) -> None:
        self.stack.append(val)
        if not self.min_stack or val <= self.min_stack[-1]:
            self.min_stack.append(val)

    def pop(self) -> None:
        if self.stack.pop() == self.min_stack[-1]:
            self.min_stack.pop()

    def top(self) -> int:
        return self.stack[-1]

    def getMin(self) -> int:
        return self.min_stack[-1]

ms = MinStack()
ms.push(-2)
ms.push(0)
ms.push(-3)
print("Min:", ms.getMin()) # returns -3
ms.pop()
print("Top:", ms.top())    # returns 0
print("Min:", ms.getMin()) # returns -2`
    },
    queues: {
      language: 'python',
      code: `# Practice Queues: Implement Queue using Lists
class Queue:
    def __init__(self):
        self.items = []

    def enqueue(self, item):
        self.items.append(item)

    def dequeue(self):
        if not self.is_empty():
            return self.items.pop(0)

    def is_empty(self):
        return len(self.items) == 0

q = Queue()
q.enqueue("A")
q.enqueue("B")
print("Dequeued:", q.dequeue()) # A
print("Dequeued:", q.dequeue()) # B`
    },
    trees: {
      language: 'java',
      code: `// Practice Trees: Binary Tree Preorder Traversal
class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode(int x) { val = x; }
}

public class BinaryTree {
    public static void preorder(TreeNode root) {
        if (root == null) return;
        System.out.print(root.val + " ");
        preorder(root.left);
        preorder(root.right);
    }

    public static void main(String[] args) {
        TreeNode root = new TreeNode(1);
        root.right = new TreeNode(2);
        root.right.left = new TreeNode(3);
        System.out.print("Preorder Traversal: ");
        preorder(root); // Outputs: 1 2 3
    }
}`
    },
    graphs: {
      language: 'python',
      code: `# Practice Graphs: BFS Traversal on Adjacency List
from collections import deque

def bfs(graph, start):
    visited = set()
    queue = deque([start])
    visited.add(start)
    
    while queue:
        vertex = queue.popleft()
        print(vertex, end=" ")
        for neighbor in graph[vertex]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)

graph = {
    'A': ['B', 'C'],
    'B': ['A', 'D', 'E'],
    'C': ['A', 'F'],
    'D': ['B'],
    'E': ['B', 'F'],
    'F': ['C', 'E']
}
print("BFS starting from vertex A:")
bfs(graph, 'A')`
    },
    sorting: {
      language: 'python',
      code: `# Practice Sorting: Implement Selection Sort
def selection_sort(arr):
    for i in range(len(arr)):
        min_idx = i
        for j in range(i+1, len(arr)):
            if arr[j] < arr[min_idx]:
                min_idx = j
        arr[i], arr[min_idx] = arr[min_idx], arr[i]
    return arr

print("Sorted:", selection_sort([29, 10, 14, 37, 13]))`
    },
    recursion: {
      language: 'python',
      code: `# Practice Recursion: Calculate factorial of a number
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

print("Factorial of 5:", factorial(5))`
    }
  };
  return templates[topicId] || { language: 'python', code: '' };
}

function formatRelativeDate(isoString?: string): string {
  if (!isoString) return 'recently';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;

  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

  if (isToday) return `Today · ${timeStr}`;
  if (isYesterday) return `Yesterday · ${timeStr}`;

  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${timeStr}`;
}

function relativeTime(isoOrLabel: string): string {
  if (!isoOrLabel || !isoOrLabel.includes('T')) return isoOrLabel || 'recently';
  const diffMs = Date.now() - new Date(isoOrLabel).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

function langColor(lang: string): string {
  const map: Record<string, string> = {
    python: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    java: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    javascript: 'text-yellow-300 bg-yellow-300/10 border-yellow-300/20',
    cpp: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    'c++': 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  };
  return map[lang.toLowerCase()] ?? 'text-slate-400 bg-slate-400/10 border-slate-400/20';
}

function difficultyColor(d: Recommendation['difficulty']): string {
  const map = {
    Beginner: 'text-emerald-400 bg-emerald-400/10',
    Intermediate: 'text-amber-400 bg-amber-400/10',
    Advanced: 'text-red-400 bg-red-400/10',
  };
  return map[d];
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.05, ease: 'easeOut' as const },
  }),
};

// ─── 1. Dashboard Header ──────────────────────────────────────────────────────

interface DashboardHeaderProps {
  username: string;
}

function DashboardHeader({ username }: DashboardHeaderProps) {
  const navigate = useNavigate();
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-indigo-500/15 rounded-xl border border-indigo-500/25">
          <LayoutDashboard className="w-5 h-5 text-indigo-400" />
        </div>
        <span className="text-sm font-semibold text-indigo-400 tracking-widest uppercase">
          Dashboard
        </span>
      </div>
      <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
        Welcome back, {username} 👋
      </h1>
      <p className="text-slate-400 text-base max-w-xl">
        Track your coding progress, visualize algorithms, and continue learning with CodeLens AI.
      </p>

      {/* CTA buttons */}
      <div className="flex flex-wrap items-center gap-3 mt-6">
        <button
          id="dashboard-open-editor-btn"
          onClick={() => navigate('/editor')}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-all hover:shadow-[0_0_24px_rgba(99,102,241,0.45)] active:scale-95"
        >
          <Terminal className="w-4 h-4" />
          Open Editor
        </button>
        <button
          id="dashboard-visualize-btn"
          onClick={() => navigate('/editor', { state: { triggerVisualize: true } })}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-sm transition-all hover:shadow-[0_0_24px_rgba(16,185,129,0.35)] active:scale-95"
        >
          <Eye className="w-4 h-4" />
          Start Visualization
        </button>
        <button
          onClick={() => navigate('/dashboard/activity')}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl font-medium text-sm transition-all border border-slate-700/60 active:scale-95"
        >
          <History className="w-4 h-4 text-indigo-400" />
          View Full Activity →
        </button>
      </div>
    </div>
  );
}

// ─── 2. Stats Cards ───────────────────────────────────────────────────────────

interface StatsCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend: number;
  color: string;
  index: number;
}

function StatsCard({ icon, label, value, trend, color, index }: StatsCardProps) {
  const isPositive = trend >= 0;
  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="group relative bg-slate-900/60 border border-slate-800/60 rounded-2xl p-5 hover:border-slate-700/80 hover:bg-slate-900/80 transition-all hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:-translate-y-0.5 cursor-default"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${color}`}>{icon}</div>
        <div
          className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${
            isPositive
              ? 'text-emerald-400 bg-emerald-400/10'
              : 'text-red-400 bg-red-400/10'
          }`}
        >
          <TrendingUp className={`w-3 h-3 ${!isPositive ? 'rotate-180' : ''}`} />
          {Math.abs(trend)}%
        </div>
      </div>
      <p className="text-3xl font-extrabold text-white tracking-tight mb-1">{value}</p>
      <p className="text-sm text-slate-400 font-medium">{label}</p>
      <p className="text-xs text-slate-600 mt-1">this week</p>
    </motion.div>
  );
}

function StatsGrid({ stats }: { stats: DashboardStats }) {
  const cards = [
    {
      icon: <Code2 className="w-4 h-4 text-indigo-400" />,
      label: 'Programs',
      value: stats.totalPrograms,
      trend: stats.programsTrend,
      color: 'bg-indigo-500/15 border border-indigo-500/25',
    },
    {
      icon: <Play className="w-4 h-4 text-violet-400" />,
      label: 'Code Executions',
      value: stats.totalExecutions,
      trend: stats.executionsTrend,
      color: 'bg-violet-500/15 border border-violet-500/25',
    },
    {
      icon: <Eye className="w-4 h-4 text-emerald-400" />,
      label: 'Visualizations',
      value: stats.totalVisualizations,
      trend: stats.visualizationsTrend,
      color: 'bg-emerald-500/15 border border-emerald-500/25',
    },
    {
      icon: <Clock className="w-4 h-4 text-amber-400" />,
      label: 'Learning Time',
      value: stats.learningHours > 0 ? `${stats.learningHours} hrs` : '0 hrs',
      trend: stats.learningTrend,
      color: 'bg-amber-500/15 border border-amber-500/25',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
      {cards.map((c, i) => (
        <StatsCard key={c.label} {...c} index={i} />
      ))}
    </div>
  );
}

// ─── 3. Coding Streak Card ────────────────────────────────────────────────────

function CodingStreakCard({ streak }: { streak: StreakData }) {
  return (
    <motion.div
      variants={cardVariants}
      custom={3}
      initial="hidden"
      animate="visible"
      className="bg-gradient-to-r from-orange-950/40 via-slate-900/70 to-amber-950/30 border border-orange-500/20 rounded-2xl p-6 relative overflow-hidden mb-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(249,115,22,0.3)]">
            <Flame className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-extrabold text-white">
                🔥 {streak.current_streak} Day Coding Streak
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-300 font-semibold border border-orange-500/30">
                Active
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-0.5">{streak.streak_message}</p>
          </div>
        </div>

        <div className="flex items-center gap-6 self-end sm:self-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
          <div className="text-right">
            <span className="text-xs text-slate-500 font-medium block">Current Streak</span>
            <span className="text-lg font-extrabold text-orange-400">{streak.current_streak} days</span>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div className="text-right">
            <span className="text-xs text-slate-500 font-medium block">Longest Streak</span>
            <span className="text-lg font-extrabold text-white">{streak.longest_streak} days</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── 4. Continue Coding ───────────────────────────────────────────────────────

function ContinueCoding({ programs }: { programs: RecentProgram[] }) {
  const navigate = useNavigate();
  return (
    <motion.div
      variants={cardVariants}
      custom={4}
      initial="hidden"
      animate="visible"
      className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Code2 className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-white">Continue Coding</h2>
        </div>
        <button
          onClick={() => navigate('/editor')}
          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
        >
          Open Editor →
        </button>
      </div>

      {programs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="p-3 bg-slate-800/60 rounded-xl mb-3">
            <Code2 className="w-7 h-7 text-slate-600" />
          </div>
          <p className="text-slate-400 text-sm font-medium mb-1">No recent programs</p>
          <p className="text-slate-600 text-xs mb-4">Start writing code to see your history here</p>
          <button
            onClick={() => navigate('/editor')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all"
          >
            <Terminal className="w-4 h-4" />
            Open Editor
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {programs.map((prog) => (
            <button
              key={prog.id}
              id={`continue-program-${prog.id}`}
              onClick={() => navigate('/editor', { state: { code: prog.sourceCode, language: prog.language } })}
              className="group w-full flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-slate-800/70 border border-transparent hover:border-slate-700/50 transition-all text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-slate-800/80 rounded-lg shrink-0">
                  <Code2 className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-200 group-hover:text-white truncate transition-colors">
                    {prog.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded border font-medium capitalize ${langColor(
                        prog.language
                      )}`}
                    >
                      {prog.language}
                    </span>
                    <span className="text-xs text-slate-600">
                      {relativeTime(prog.lastEdited)}
                    </span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── 5. Recent Visualizations ─────────────────────────────────────────────────

function RecentVisualizations({ visualizations }: { visualizations: RecentVisualization[] }) {
  const navigate = useNavigate();

  const statusIcon = (s: RecentVisualization['status']) => {
    if (s === 'completed') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    if (s === 'failed') return <XCircle className="w-4 h-4 text-red-400" />;
    return <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />;
  };

  return (
    <motion.div
      variants={cardVariants}
      custom={5}
      initial="hidden"
      animate="visible"
      className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-bold text-white">Recent Visualizations</h2>
        </div>
      </div>

      {visualizations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="p-3 bg-slate-800/60 rounded-xl mb-3">
            <Eye className="w-7 h-7 text-slate-600" />
          </div>
          <p className="text-slate-400 text-sm font-medium mb-1">No visualizations yet</p>
          <p className="text-slate-600 text-xs mb-4">
            Create your first visualization and start understanding code visually.
          </p>
          <button
            onClick={() => navigate('/editor', { state: { triggerVisualize: true } })}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all"
          >
            <Eye className="w-4 h-4" />
            Start Visualizing
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {visualizations.map((viz) => (
            <div
              key={viz.id}
              className="group flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-slate-800/70 border border-transparent hover:border-slate-700/50 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                {statusIcon(viz.status)}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-200 group-hover:text-white truncate">
                    {viz.programName}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded border font-medium capitalize ${langColor(
                        viz.language
                      )}`}
                    >
                      {viz.language}
                    </span>
                    <span className="text-xs text-slate-600">{viz.steps} steps</span>
                    <span className="text-xs text-slate-600">{relativeTime(viz.timestamp)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => navigate('/editor', { state: { code: viz.sourceCode, language: viz.language, activeTab: 'visualization', visualization: viz.mermaidExplanation } })}
                className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 font-medium transition-colors shrink-0 ml-2"
              >
                View
              </button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── 6. Recent Activity Timeline ──────────────────────────────────────────────

function RecentActivityTimeline({
  activities,
  onSelect,
}: {
  activities: UserActivityItem[];
  onSelect: (act: UserActivityItem) => void;
}) {
  const navigate = useNavigate();

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'code_execution':
      case 'execution':
        return <Play className="w-3.5 h-3.5 text-violet-400" />;
      case 'visualization_started':
      case 'visualization_completed':
      case 'visualization':
        return <Eye className="w-3.5 h-3.5 text-emerald-400" />;
      case 'ai_tutor':
      case 'ai_explanation':
        return <BrainCircuit className="w-3.5 h-3.5 text-indigo-400" />;
      case 'practice':
      case 'practice_completed':
        return <BookOpen className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <motion.div
      variants={cardVariants}
      custom={6}
      initial="hidden"
      animate="visible"
      className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-white">Recent Activity</h2>
        </div>
        <button
          onClick={() => navigate('/dashboard/activity')}
          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
        >
          View All History →
        </button>
      </div>

      {activities.length === 0 ? (
        <div className="py-8 text-center text-slate-500 text-sm">
          No recent activity recorded yet. Start coding to build your activity log!
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
          {activities.slice(0, 5).map((act) => (
            <div
              key={act.id}
              onClick={() => onSelect(act)}
              className="group relative flex items-start justify-between gap-3 p-2 -ml-2 rounded-xl hover:bg-slate-800/50 transition-all cursor-pointer"
            >
              {/* Timeline marker */}
              <div className="absolute -left-6 top-3 w-3.5 h-3.5 rounded-full bg-slate-900 border-2 border-indigo-500 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              </div>

              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-mono text-slate-500 block">
                  ● {formatRelativeDate(act.started_at)}
                </span>
                <p className="text-sm font-bold text-slate-200 group-hover:text-white truncate transition-colors">
                  {act.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {act.language && (
                    <span className="text-[11px] text-slate-400 font-medium capitalize">
                      {act.language}
                    </span>
                  )}
                  {act.metadata_json?.steps && (
                    <span className="text-[11px] text-slate-500">
                      · {act.metadata_json.steps} steps
                    </span>
                  )}
                  {act.topic && (
                    <span className="text-[11px] text-slate-500">· {act.topic}</span>
                  )}
                </div>
              </div>

              <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 shrink-0">
                {getActivityIcon(act.activity_type)}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── 7. Learning Progress ─────────────────────────────────────────────────────

function LearningProgress({ progress }: { progress: LanguageProgress[] }) {
  return (
    <motion.div
      variants={cardVariants}
      custom={7}
      initial="hidden"
      animate="visible"
      className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6"
    >
      <div className="flex items-center gap-2 mb-5">
        <BookOpen className="w-5 h-5 text-violet-400" />
        <h2 className="text-base font-bold text-white">Learning Progress</h2>
      </div>

      {progress.every((p) => p.percentage === 0) ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <p className="text-slate-500 text-sm">
            Start coding to build your learning insights.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {progress.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-slate-300">{item.label}</span>
                <span className="text-sm font-bold text-white">{item.percentage}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.percentage}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                  className={`h-full rounded-full ${item.color}`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── 8. Coding Activity Chart ─────────────────────────────────────────────────

function CodingActivity({ activity }: { activity: DayActivity[] }) {
  const maxVal = Math.max(
    1,
    ...activity.map((d) => d.executions + d.visualizations + d.aiExplanations)
  );
  const totalThisWeek = activity.reduce(
    (acc, d) => acc + d.executions + d.visualizations + d.aiExplanations,
    0
  );

  return (
    <motion.div
      variants={cardVariants}
      custom={8}
      initial="hidden"
      animate="visible"
      className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-white">Coding Activity</h2>
        </div>
        <span className="text-xs text-slate-500">Last 7 days</span>
      </div>

      <div className="flex items-center gap-4 mb-5">
        <span className="text-2xl font-extrabold text-white">{totalThisWeek}</span>
        <span className="text-sm text-slate-500">total activity this week</span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-5">
        {[
          { color: 'bg-indigo-500', label: 'Executions' },
          { color: 'bg-violet-500', label: 'Visualizations' },
          { color: 'bg-emerald-500', label: 'AI Explains' },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${l.color}`} />
            <span className="text-xs text-slate-500">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-2 h-28">
        {activity.map((day) => {
          const total = day.executions + day.visualizations + day.aiExplanations;
          const heightPct = (total / maxVal) * 100;
          const exPct   = total > 0 ? (day.executions / total) * heightPct : 0;
          const vizPct  = total > 0 ? (day.visualizations / total) * heightPct : 0;
          const aiPct   = total > 0 ? (day.aiExplanations / total) * heightPct : 0;

          return (
            <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
              {/* stacked bar */}
              <div className="w-full flex flex-col-reverse items-stretch rounded-t-md overflow-hidden" style={{ height: '88px' }}>
                {total === 0 ? (
                  <div className="w-full bg-slate-800/60 rounded-md" style={{ height: '4px' }} />
                ) : (
                  <>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${exPct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
                      className="w-full bg-indigo-500/80"
                    />
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${vizPct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: 0.25 }}
                      className="w-full bg-violet-500/80"
                    />
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${aiPct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
                      className="w-full bg-emerald-500/80"
                    />
                  </>
                )}
              </div>
              <span className="text-xs text-slate-600 font-medium">{day.day}</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── 9. AI Learning Insight ───────────────────────────────────────────────────

function AILearningInsight({ insight }: { insight: string }) {
  const navigate = useNavigate();
  return (
    <motion.div
      variants={cardVariants}
      custom={9}
      initial="hidden"
      animate="visible"
      className="bg-gradient-to-br from-indigo-950/60 via-slate-900/70 to-violet-950/50 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center gap-2 mb-4 relative">
        <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
          <Sparkles className="w-4 h-4 text-indigo-400" />
        </div>
        <span className="text-sm font-bold text-indigo-300">AI Learning Insight</span>
      </div>

      <p className="text-slate-300 text-sm leading-relaxed mb-5 relative">{insight}</p>

      <button
        id="dashboard-ask-ai-btn"
        onClick={() => navigate('/editor', { state: { triggerAITutor: true } })}
        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] active:scale-95 relative"
      >
        <BrainCircuit className="w-4 h-4" />
        Ask AI Tutor
      </button>
    </motion.div>
  );
}

// ─── 10. Recommended Practice ─────────────────────────────────────────────────

function RecommendedPractice({ recommendations }: { recommendations: Recommendation[] }) {
  const navigate = useNavigate();
  return (
    <motion.div
      variants={cardVariants}
      custom={10}
      initial="hidden"
      animate="visible"
    >
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-5 h-5 text-amber-400" />
        <h2 className="text-base font-bold text-white">Recommended Practice</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {recommendations.map((rec, i) => (
          <motion.div
            key={rec.id}
            custom={11 + i}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="group bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4 hover:border-slate-600/70 hover:bg-slate-900/80 transition-all hover:shadow-[0_4px_24px_rgba(0,0,0,0.35)] hover:-translate-y-0.5 flex flex-col"
          >
            <div className="text-2xl mb-3">{rec.icon}</div>
            <p className="text-sm font-bold text-white mb-1">{rec.topic}</p>
            <span
              className={`text-xs px-2 py-0.5 rounded-md font-medium w-fit mb-2 ${difficultyColor(
                rec.difficulty
              )}`}
            >
              {rec.difficulty}
            </span>
            <p className="text-xs text-slate-600 mb-4 flex-1">
              {rec.problems} practice problems
            </p>
            <button
              id={`practice-${rec.id}`}
              onClick={() => {
                const template = getPracticeTemplate(rec.id);
                navigate('/editor', { state: { code: template.code, language: template.language, triggerVisualize: true } });
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors group-hover:gap-2.5"
            >
              Visualize
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── 11. Quick Actions ────────────────────────────────────────────────────────

function QuickActions() {
  const navigate = useNavigate();

  const handleQuickAction = (id: string) => {
    switch (id) {
      case 'qa-new-program':
        navigate('/editor', { state: { code: '', language: 'python' } });
        break;
      case 'qa-run-code':
        navigate('/editor', { state: { triggerRun: true } });
        break;
      case 'qa-visualize':
        navigate('/editor', { state: { triggerVisualize: true } });
        break;
      case 'qa-ai-tutor':
        navigate('/editor', { state: { triggerAITutor: true } });
        break;
      case 'qa-view-history':
        navigate('/dashboard/activity');
        break;
      default:
        navigate('/editor');
    }
  };

  const actions = [
    { id: 'qa-new-program',  icon: <Plus className="w-4 h-4" />,         label: 'New Program',   color: 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 border-indigo-500/20 hover:border-indigo-500/40' },
    { id: 'qa-run-code',     icon: <Play className="w-4 h-4" />,         label: 'Run Code',      color: 'bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 hover:text-violet-300 border-violet-500/20 hover:border-violet-500/40' },
    { id: 'qa-visualize',    icon: <Eye className="w-4 h-4" />,          label: 'Visualize Code',color: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border-emerald-500/20 hover:border-emerald-500/40' },
    { id: 'qa-ai-tutor',     icon: <BrainCircuit className="w-4 h-4" />, label: 'Ask AI Tutor',  color: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border-amber-500/20 hover:border-amber-500/40' },
    { id: 'qa-view-history', icon: <History className="w-4 h-4" />,      label: 'View History',  color: 'bg-slate-700/40 hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 border-slate-700/50 hover:border-slate-600/60' },
  ];

  return (
    <motion.div
      variants={cardVariants}
      custom={18}
      initial="hidden"
      animate="visible"
      className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6"
    >
      <div className="flex items-center gap-2 mb-5">
        <Zap className="w-5 h-5 text-amber-400" />
        <h2 className="text-base font-bold text-white">Quick Actions</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.id}
            id={a.id}
            onClick={() => handleQuickAction(a.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${a.color}`}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Activity Detail Modal ────────────────────────────────────────────────────

function ActivityModal({
  activity,
  onClose,
}: {
  activity: UserActivityItem;
  onClose: () => void;
}) {
  const navigate = useNavigate();
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
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden text-left"
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white">{activity.title}</h3>
            <span className="text-xs text-slate-400 capitalize">
              {activity.activity_type.replace('_', ' ')}
            </span>
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
              <span className="text-slate-200 font-semibold block">{activity.topic || 'General Practice'}</span>
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
              <span className="text-slate-300 font-mono">
                {new Date(activity.started_at).toLocaleString()}
              </span>
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

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-slate-900/40 border border-slate-800/40 rounded-2xl animate-pulse ${className}`} />
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="space-y-3">
        <div className="h-4 w-24 bg-slate-800 rounded animate-pulse" />
        <div className="h-8 w-72 bg-slate-800 rounded animate-pulse" />
        <div className="h-4 w-96 bg-slate-800 rounded animate-pulse" />
        <div className="flex gap-3 mt-4">
          <div className="h-10 w-32 bg-slate-800 rounded-xl animate-pulse" />
          <div className="h-10 w-36 bg-slate-800 rounded-xl animate-pulse" />
        </div>
      </div>
      <SkeletonCard className="h-24" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} className="h-32" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard className="h-64" />
        <SkeletonCard className="h-64" />
      </div>
    </div>
  );
}

// ─── Dashboard Page (root export) ────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<UserActivityItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAllDashboardData();
      setData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const username = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Developer';

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-slate-950 text-white">
      {/* Subtle background gradients */}
      <div className="fixed top-0 left-64 right-0 h-full pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-indigo-600/8 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[10%] w-[35%] h-[35%] rounded-full bg-violet-600/8 blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-8">
        {loading || !data ? (
          <DashboardSkeleton />
        ) : (
          <div className="space-y-8">
            {/* 1. Header */}
            <DashboardHeader username={username} />

            {/* 2. Coding Streak */}
            <CodingStreakCard streak={data.streak} />

            {/* 3. Stats */}
            <StatsGrid stats={data.stats} />

            {/* 4 & 5. Continue Coding + Recent Visualizations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ContinueCoding programs={data.recentPrograms} />
              <RecentVisualizations visualizations={data.recentVisualizations} />
            </div>

            {/* 6. Recent Activity Timeline */}
            <RecentActivityTimeline
              activities={data.recentActivities}
              onSelect={(act) => setSelectedActivity(act)}
            />

            {/* 7, 8, 9. Progress + Activity + AI Insight */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <LearningProgress progress={data.progress} />
              <CodingActivity activity={data.activity} />
              <AILearningInsight insight={data.aiInsight} />
            </div>

            {/* 10. Recommended Practice */}
            <RecommendedPractice recommendations={data.recommendations} />

            {/* 11. Quick Actions */}
            <QuickActions />
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
