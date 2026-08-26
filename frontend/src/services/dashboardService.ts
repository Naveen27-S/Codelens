/**
 * dashboardService.ts
 *
 * Service layer for the CodeLens AI Dashboard & User Activity History.
 * Connects to FastAPI backend /api/dashboard/* endpoints with robust fallback
 * data for smooth previews and demo capability.
 */

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalPrograms: number;
  totalExecutions: number;
  totalVisualizations: number;
  learningHours: number;
  programsTrend: number;   // % change this week
  executionsTrend: number;
  visualizationsTrend: number;
  learningTrend: number;
}

export interface RecentProgram {
  id: number | string;
  title: string;
  language: string;
  lastEdited: string;        // ISO string or relative label
  sourceCode?: string;
}

export interface RecentVisualization {
  id: number | string;
  programName: string;
  language: string;
  steps: number;
  status: 'completed' | 'failed' | 'in-progress';
  timestamp: string;
  sourceCode?: string;
  mermaidExplanation?: string;
}

export interface DayActivity {
  day: string;           // e.g. "Mon"
  executions: number;
  visualizations: number;
  aiExplanations: number;
}

export interface LanguageProgress {
  label: string;
  percentage: number;
  color: string;         // tailwind bg class, e.g. "bg-indigo-500"
}

export interface Recommendation {
  id: string;
  topic: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  problems: number;
  icon: string;          // emoji icon
}

export interface UserActivityItem {
  id: number | string;
  user_id?: number;
  activity_type: string; // code_execution | visualization_started | visualization_completed | ai_tutor | practice | program_saved | editor_open
  title: string;
  description?: string;
  program_name?: string;
  language?: string;
  topic?: string;
  status?: string;
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
  metadata_json?: Record<string, any>;
  created_at?: string;
}

export interface StreakData {
  current_streak: number;
  longest_streak: number;
  last_active_date?: string | null;
  streak_message: string;
}

export interface LearningTimeData {
  today_seconds: number;
  week_seconds: number;
  month_seconds: number;
  today_formatted: string;
  week_formatted: string;
  month_formatted: string;
}

export interface ActivityFilterOptions {
  activity_type?: string;
  date_range?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ActivityListResult {
  items: UserActivityItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recentPrograms: RecentProgram[];
  recentVisualizations: RecentVisualization[];
  activity: DayActivity[];
  progress: LanguageProgress[];
  recommendations: Recommendation[];
  aiInsight: string;
  streak: StreakData;
  recentActivities: UserActivityItem[];
  learningTime: LearningTimeData;
}

// ─── Default/mock fallback data ───────────────────────────────────────────────

const DEFAULT_STATS: DashboardStats = {
  totalPrograms: 42,
  totalExecutions: 128,
  totalVisualizations: 86,
  learningHours: 12.5,
  programsTrend: 12,
  executionsTrend: 18,
  visualizationsTrend: 24,
  learningTrend: 8,
};

const DEFAULT_STREAK: StreakData = {
  current_streak: 7,
  longest_streak: 14,
  last_active_date: new Date().toISOString(),
  streak_message: "You've practiced CodeLens for 7 consecutive days. Keep going!",
};

const DEFAULT_LEARNING_TIME: LearningTimeData = {
  today_seconds: 5100, // 1h 25m
  week_seconds: 31320, // 8h 42m
  month_seconds: 87480, // 24h 18m
  today_formatted: "1h 25m",
  week_formatted: "8h 42m",
  month_formatted: "24h 18m",
};

const DEFAULT_PROGRAMS: RecentProgram[] = [
  {
    id: 'mock-fib',
    title: 'Fibonacci Algorithm',
    language: 'python',
    lastEdited: new Date(Date.now() - 20 * 60000).toISOString(),
    sourceCode: `def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(fibonacci(10))`
  },
  {
    id: 'mock-bst',
    title: 'Binary Search Tree',
    language: 'java',
    lastEdited: new Date(Date.now() - 24 * 3600000).toISOString(),
    sourceCode: `public class BinarySearchTree {
    static class Node {
        int key;
        Node left, right;
        public Node(int item) {
            key = item;
            left = right = null;
        }
    }

    Node root;

    void insert(int key) {
        root = insertRec(root, key);
    }

    Node insertRec(Node root, int key) {
        if (root == null) {
            root = new Node(key);
            return root;
        }
        if (key < root.key)
            root.left = insertRec(root.left, key);
        else if (key > root.key)
            root.right = insertRec(root.right, key);
        return root;
    }

    public static void main(String[] args) {
        BinarySearchTree tree = new BinarySearchTree();
        tree.insert(50);
        tree.insert(30);
        tree.insert(20);
        tree.insert(40);
        tree.insert(70);
    }
}`
  },
  {
    id: 'mock-bubble',
    title: 'Bubble Sort',
    language: 'python',
    lastEdited: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
    sourceCode: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n-i-1):
            if arr[j] > arr[j+1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]
    return arr

print(bubble_sort([64, 34, 25, 12, 22, 11, 90]))`
  }
];

const DEFAULT_VISUALIZATIONS: RecentVisualization[] = [
  {
    id: 'viz-fib',
    programName: 'Fibonacci',
    language: 'python',
    steps: 24,
    status: 'completed',
    timestamp: new Date(Date.now() - 20 * 60000).toISOString(),
    sourceCode: `def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(fibonacci(10))`,
    mermaidExplanation: `graph TD
    A[fibonacci 5] --> B[fibonacci 4]
    A --> C[fibonacci 3]
    B --> D[fibonacci 3]
    B --> E[fibonacci 2]
    C --> F[fibonacci 2]
    C --> G[fibonacci 1]
`
  },
  {
    id: 'viz-bs',
    programName: 'Binary Search',
    language: 'java',
    steps: 8,
    status: 'completed',
    timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
    sourceCode: `public class BinarySearch {
    public static int search(int[] arr, int target) {
        int low = 0, high = arr.length - 1;
        while (low <= high) {
            int mid = low + (high - low) / 2;
            if (arr[mid] == target) return mid;
            if (arr[mid] < target) low = mid + 1;
            else high = mid - 1;
        }
        return -1;
    }

    public static void main(String[] args) {
        int[] arr = {2, 3, 4, 10, 40};
        System.out.println(search(arr, 10));
    }
}`,
    mermaidExplanation: `graph TD
    Start --> Check{low <= high}
    Check -- Yes --> Mid[mid = low + high-low / 2]
    Mid --> Equal{arr mid == target}
    Equal -- Yes --> Return[return mid]
    Equal -- No --> Less{arr mid < target}
    Less -- Yes --> Right[low = mid + 1]
    Less -- No --> Left[high = mid - 1]
`
  },
  {
    id: 'viz-bubble',
    programName: 'Bubble Sort',
    language: 'python',
    steps: 36,
    status: 'completed',
    timestamp: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
    sourceCode: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n-i-1):
            if arr[j] > arr[j+1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]
    return arr

print(bubble_sort([64, 34, 25, 12, 22, 11, 90]))`,
    mermaidExplanation: `graph TD
    Start --> LoopI[i = 0 to n]
    LoopI --> LoopJ[j = 0 to n-i-1]
    LoopJ --> Compare{arr j > arr j+1}
    Compare -- Yes --> Swap[Swap arr j and arr j+1]
    Compare -- No --> Next
`
  }
];

const DEFAULT_ACTIVITY: DayActivity[] = [
  { day: 'Mon', executions: 4, visualizations: 2, aiExplanations: 1 },
  { day: 'Tue', executions: 6, visualizations: 3, aiExplanations: 2 },
  { day: 'Wed', executions: 2, visualizations: 1, aiExplanations: 1 },
  { day: 'Thu', executions: 5, visualizations: 3, aiExplanations: 1 },
  { day: 'Fri', executions: 7, visualizations: 3, aiExplanations: 2 },
  { day: 'Sat', executions: 3, visualizations: 2, aiExplanations: 1 },
  { day: 'Sun', executions: 1, visualizations: 1, aiExplanations: 1 },
];

const DEFAULT_PROGRESS: LanguageProgress[] = [
  { label: 'Python',          percentage: 78, color: 'bg-indigo-500' },
  { label: 'Java',            percentage: 62, color: 'bg-violet-500' },
  { label: 'Data Structures', percentage: 54, color: 'bg-emerald-500' },
  { label: 'Algorithms',      percentage: 42, color: 'bg-amber-500' },
];

const DEFAULT_RECOMMENDATIONS: Recommendation[] = [
  { id: 'arrays',       topic: 'Arrays',        difficulty: 'Beginner',     problems: 12, icon: '📦' },
  { id: 'linked-lists', topic: 'Linked Lists',  difficulty: 'Beginner',     problems: 8,  icon: '🔗' },
  { id: 'stacks',       topic: 'Stacks',        difficulty: 'Beginner',     problems: 6,  icon: '📚' },
  { id: 'queues',       topic: 'Queues',        difficulty: 'Intermediate', problems: 6,  icon: '🚦' },
  { id: 'trees',        topic: 'Trees',         difficulty: 'Intermediate', problems: 10, icon: '🌲' },
  { id: 'graphs',       topic: 'Graphs',        difficulty: 'Advanced',     problems: 9,  icon: '🕸️' },
  { id: 'sorting',      topic: 'Sorting',       difficulty: 'Intermediate', problems: 7,  icon: '🔢' },
  { id: 'recursion',    topic: 'Recursion',     difficulty: 'Intermediate', problems: 8,  icon: '🔄' },
];

const DEFAULT_RECENT_ACTIVITIES: UserActivityItem[] = [
  {
    id: 101,
    activity_type: 'visualization_completed',
    title: 'Visualized Fibonacci Algorithm',
    description: 'Generated call stack and recursion tree with 24 execution steps.',
    program_name: 'Fibonacci Algorithm',
    language: 'python',
    topic: 'Recursion',
    status: 'completed',
    started_at: new Date(Date.now() - 18 * 60000).toISOString(),
    duration_seconds: 120,
    metadata_json: { steps: 24, complexity: 'O(2^n)' },
  },
  {
    id: 102,
    activity_type: 'code_execution',
    title: 'Ran Binary Search',
    description: 'Executed algorithm across test array with low/high midpoint pointers.',
    program_name: 'Binary Search',
    language: 'java',
    topic: 'Binary Search',
    status: 'completed',
    started_at: new Date(Date.now() - 35 * 60000).toISOString(),
    duration_seconds: 15,
  },
  {
    id: 103,
    activity_type: 'ai_tutor',
    title: 'AI Tutor Explanation',
    description: 'Explained recursion stack frames and base case evaluation.',
    program_name: 'Recursion Masterclass',
    language: 'python',
    topic: 'Recursion',
    status: 'completed',
    started_at: new Date(Date.now() - 62 * 60000).toISOString(),
    duration_seconds: 480,
  },
  {
    id: 104,
    activity_type: 'practice',
    title: 'Practiced Binary Trees',
    description: 'Completed Preorder and Inorder tree traversal problems.',
    program_name: 'BinaryTree.java',
    language: 'java',
    topic: 'Trees',
    status: 'completed',
    started_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    duration_seconds: 1200,
    metadata_json: { problems_completed: 5 },
  },
  {
    id: 105,
    activity_type: 'program_saved',
    title: 'Created new program',
    description: 'Bubble Sort implementation with swap optimization flag.',
    program_name: 'Bubble Sort',
    language: 'python',
    topic: 'Sorting',
    status: 'completed',
    started_at: new Date(Date.now() - 25 * 3600000).toISOString(),
    duration_seconds: 300,
  },
];

const DEFAULT_AI_INSIGHT =
  "You've practiced recursion several times this week. Try visualizing recursive call stacks to strengthen your understanding.";

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Record an automatic user activity event.
 */
export async function recordUserActivity(activity: {
  activity_type: string;
  title: string;
  description?: string;
  program_name?: string;
  language?: string;
  topic?: string;
  status?: string;
  started_at?: string;
  completed_at?: string;
  duration_seconds?: number;
  metadata_json?: Record<string, any>;
}): Promise<UserActivityItem | null> {
  try {
    const res = await axios.post<UserActivityItem>(`${API_URL}/dashboard/activity`, activity);
    return res.data;
  } catch (err) {
    console.warn('Could not persist activity to backend:', err);
    return null;
  }
}

/**
 * Fetch chronological recent activities for the timeline.
 */
export async function fetchRecentActivities(limit: number = 10): Promise<UserActivityItem[]> {
  try {
    const res = await axios.get<UserActivityItem[]>(`${API_URL}/dashboard/activity/recent?limit=${limit}`);
    if (res.data && res.data.length > 0) return res.data;
    return DEFAULT_RECENT_ACTIVITIES;
  } catch {
    return DEFAULT_RECENT_ACTIVITIES;
  }
}

/**
 * Fetch full paginated user activities with filters.
 */
export async function fetchFullActivities(options: ActivityFilterOptions = {}): Promise<ActivityListResult> {
  const { activity_type, date_range, search, page = 1, limit = 10 } = options;
  const params = new URLSearchParams();
  if (activity_type && activity_type !== 'all') params.append('activity_type', activity_type);
  if (date_range && date_range !== 'all') params.append('date_range', date_range);
  if (search) params.append('search', search);
  params.append('page', String(page));
  params.append('limit', String(limit));

  try {
    const res = await axios.get<ActivityListResult>(`${API_URL}/dashboard/activity?${params.toString()}`);
    return res.data;
  } catch {
    // Return mock paginated list
    let filtered = [...DEFAULT_RECENT_ACTIVITIES];
    if (activity_type && activity_type !== 'all') {
      filtered = filtered.filter((a) => a.activity_type.includes(activity_type));
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.program_name?.toLowerCase().includes(q) ||
          a.topic?.toLowerCase().includes(q)
      );
    }
    return {
      items: filtered,
      total: filtered.length,
      page,
      limit,
      pages: Math.max(1, Math.ceil(filtered.length / limit)),
    };
  }
}

/**
 * Fetch user's consecutive coding streak.
 */
export async function fetchUserStreak(): Promise<StreakData> {
  try {
    const res = await axios.get<StreakData>(`${API_URL}/dashboard/streak`);
    return res.data;
  } catch {
    return DEFAULT_STREAK;
  }
}

/**
 * Fetch learning time analytics.
 */
export async function fetchLearningTime(): Promise<LearningTimeData> {
  try {
    const res = await axios.get<LearningTimeData>(`${API_URL}/dashboard/learning-time`);
    return res.data;
  } catch {
    return DEFAULT_LEARNING_TIME;
  }
}

/**
 * Fetch aggregated statistics.
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  try {
    const res = await axios.get<DashboardStats>(`${API_URL}/dashboard/stats`);
    return res.data;
  } catch {
    return DEFAULT_STATS;
  }
}

/**
 * Fetch recent programs.
 */
export async function fetchRecentPrograms(): Promise<RecentProgram[]> {
  try {
    const res = await axios.get<RecentProgram[]>(`${API_URL}/dashboard/recent-programs`);
    if (res.data && res.data.length > 0) return res.data;
    return DEFAULT_PROGRAMS;
  } catch {
    return DEFAULT_PROGRAMS;
  }
}

/**
 * Fetch recent visualizations.
 */
export async function fetchRecentVisualizations(): Promise<RecentVisualization[]> {
  try {
    const res = await axios.get<RecentVisualization[]>(`${API_URL}/dashboard/visualizations`);
    if (res.data && res.data.length > 0) return res.data;
    return DEFAULT_VISUALIZATIONS;
  } catch {
    return DEFAULT_VISUALIZATIONS;
  }
}

/**
 * Fetch 7-day coding activity.
 */
export async function fetchCodingActivity(): Promise<DayActivity[]> {
  try {
    const res = await axios.get<{ days: DayActivity[] }>(`${API_URL}/dashboard/activity/daily`);
    if (res.data && res.data.days && res.data.days.length > 0) return res.data.days;
    return DEFAULT_ACTIVITY;
  } catch {
    return DEFAULT_ACTIVITY;
  }
}

/**
 * Fetch learning progress percentages.
 */
export async function fetchLearningProgress(): Promise<LanguageProgress[]> {
  try {
    const res = await axios.get<LanguageProgress[]>(`${API_URL}/dashboard/progress`);
    if (res.data && res.data.length > 0) return res.data;
    return DEFAULT_PROGRESS;
  } catch {
    return DEFAULT_PROGRESS;
  }
}

/**
 * Fetch recommended topics.
 */
export async function fetchRecommendations(): Promise<Recommendation[]> {
  try {
    const res = await axios.get<Recommendation[]>(`${API_URL}/dashboard/recommendations`);
    if (res.data && res.data.length > 0) return res.data;
    return DEFAULT_RECOMMENDATIONS;
  } catch {
    return DEFAULT_RECOMMENDATIONS;
  }
}

/**
 * Fetch AI learning insight.
 */
export async function fetchAIInsight(): Promise<string> {
  return DEFAULT_AI_INSIGHT;
}

/**
 * Load all dashboard data in parallel.
 */
export async function fetchAllDashboardData(): Promise<DashboardData> {
  const [
    stats,
    recentPrograms,
    recentVisualizations,
    activity,
    progress,
    recommendations,
    aiInsight,
    streak,
    recentActivities,
    learningTime,
  ] = await Promise.all([
    fetchDashboardStats(),
    fetchRecentPrograms(),
    fetchRecentVisualizations(),
    fetchCodingActivity(),
    fetchLearningProgress(),
    fetchRecommendations(),
    fetchAIInsight(),
    fetchUserStreak(),
    fetchRecentActivities(10),
    fetchLearningTime(),
  ]);

  return {
    stats,
    recentPrograms,
    recentVisualizations,
    activity,
    progress,
    recommendations,
    aiInsight,
    streak,
    recentActivities,
    learningTime,
  };
}
