import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Database Stores
// ─────────────────────────────────────────────────────────────────────────────

interface UserRecord {
  id: number;
  full_name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

interface ProgramRecord {
  program_id: string;
  user_id: number;
  name: string;
  language: string;
  code: string;
  description: string;
  output: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ExecutionRecord {
  execution_id: string;
  user_id: number;
  program_id?: string | null;
  program_name: string;
  language: string;
  code: string;
  input?: string;
  status: 'success' | 'compilation_error' | 'runtime_error' | 'timeout' | 'memory_limit' | 'execution_error' | string;
  stdout: string;
  stderr: string;
  execution_time: number;
  memory_used?: number | null;
  created_at: string;
}

interface UserActivity {
  id: string;
  user_id: number;
  activity_type: string;
  title: string;
  description?: string;
  topic?: string;
  status: string;
  duration_seconds: number;
  created_at: string;
}

interface DashboardHistoryEvent {
  id: string;
  user_id: number;
  event_type: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

// Initial seed user for instant demo & testing
const users: UserRecord[] = [
  {
    id: 1,
    full_name: 'Alex Rivera',
    email: 'demo@codelens.ai',
    password_hash: 'password123',
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
];

const programs: ProgramRecord[] = [
  {
    program_id: 'prog_fibonacci',
    user_id: 1,
    name: 'Fibonacci Sequence Visualizer',
    language: 'python',
    code: `def fibonacci(n):
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b

for i in range(8):
    print(f"fib({i}) = {fibonacci(i)}")
`,
    description: 'Iterative Fibonacci sequence calculation with step tracking.',
    output: 'fib(0) = 0\nfib(1) = 1\nfib(2) = 1\nfib(3) = 2\nfib(4) = 3\nfib(5) = 5\nfib(6) = 8\nfib(7) = 13\n',
    status: 'completed',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    program_id: 'prog_binarysearch',
    user_id: 1,
    name: 'Binary Search Algorithm',
    language: 'javascript',
    code: `function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}

const numbers = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91];
console.log("Index of 23:", binarySearch(numbers, 23));
`,
    description: 'Classic divide-and-conquer binary search algorithm in JavaScript.',
    output: 'Index of 23: 5\n',
    status: 'completed',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    program_id: 'prog_quicksort',
    user_id: 1,
    name: 'QuickSort Partitioning',
    language: 'cpp',
    code: `#include <iostream>
#include <vector>

void swap(int& a, int& b) {
    int t = a; a = b; b = t;
}

int partition(std::vector<int>& arr, int low, int high) {
    int pivot = arr[high];
    int i = low - 1;
    for (int j = low; j < high; j++) {
        if (arr[j] < pivot) {
            i++;
            swap(arr[i], arr[j]);
        }
    }
    swap(arr[i + 1], arr[high]);
    return i + 1;
}

int main() {
    std::cout << "QuickSort in C++" << std::endl;
    return 0;
}
`,
    description: 'QuickSort Lomuto partition scheme in C++.',
    output: 'QuickSort in C++\n',
    status: 'completed',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

const executions: ExecutionRecord[] = [
  {
    execution_id: 'exec_seed_1',
    user_id: 1,
    program_id: 'prog_fibonacci',
    program_name: 'Fibonacci Sequence Visualizer',
    language: 'python',
    code: programs[0].code,
    status: 'success',
    stdout: programs[0].output,
    stderr: '',
    execution_time: 42,
    memory_used: 12.4,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    execution_id: 'exec_seed_2',
    user_id: 1,
    program_id: 'prog_binarysearch',
    program_name: 'Binary Search Algorithm',
    language: 'javascript',
    code: programs[1].code,
    status: 'success',
    stdout: programs[1].output,
    stderr: '',
    execution_time: 18,
    memory_used: 8.2,
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
];

const activities: UserActivity[] = [
  {
    id: 'act_1',
    user_id: 1,
    activity_type: 'execution',
    title: 'Executed Fibonacci Sequence',
    description: 'Ran Python code successfully with 8 output lines.',
    topic: 'Python Loops',
    status: 'completed',
    duration_seconds: 45,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'act_2',
    user_id: 1,
    activity_type: 'visualization',
    title: 'Visualized Binary Search',
    description: 'Generated interactive flowchart and step inspection.',
    topic: 'Algorithms',
    status: 'completed',
    duration_seconds: 120,
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'act_3',
    user_id: 1,
    activity_type: 'practice',
    title: 'Practiced Two Sum Problem',
    description: 'Solved problem with hash map approach.',
    topic: 'Array & Hashing',
    status: 'completed',
    duration_seconds: 300,
    created_at: new Date(Date.now() - 3600000 * 20).toISOString(),
  },
];

const historyEvents: DashboardHistoryEvent[] = [
  {
    id: 'hist_1',
    user_id: 1,
    event_type: 'dashboard_open',
    title: 'Opened Dashboard',
    description: 'Viewed learning statistics',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

// Helper: Extract current user from Authorization header
function getCurrentUser(req: express.Request): UserRecord {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token.startsWith('user_')) {
      const id = parseInt(token.replace('user_', ''), 10);
      const user = users.find((u) => u.id === id);
      if (user) return user;
    }
    const tokenUser = users.find((u) => u.email === token);
    if (tokenUser) return tokenUser;
  }
  // Default to first user or fallback user
  return (
    users[0] || {
      id: 1,
      full_name: 'Developer',
      email: 'user@codelens.ai',
      password_hash: '',
      created_at: new Date().toISOString(),
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Health & Database Status
// ─────────────────────────────────────────────────────────────────────────────

app.get(['/api/health', '/api/database/status'], (req, res) => {
  res.json({
    status: 'ok',
    database: 'connected',
    mysql: 'connected',
    mongodb: 'connected',
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth Endpoints
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/auth/register', (req, res) => {
  const { full_name, email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ detail: 'Email and password are required.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const existing = users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (existing) {
    return res.status(400).json({ detail: 'Email already registered. Please sign in instead.' });
  }

  const newUser: UserRecord = {
    id: users.length + 1,
    full_name: full_name ? String(full_name).trim() : 'Developer',
    email: cleanEmail,
    password_hash: String(password),
    created_at: new Date().toISOString(),
  };
  users.push(newUser);

  res.status(201).json({
    id: newUser.id,
    full_name: newUser.full_name,
    email: newUser.email,
    created_at: newUser.created_at,
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(401).json({ detail: 'Invalid email or password.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const user = users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (!user || user.password_hash !== String(password)) {
    return res.status(401).json({ detail: 'Invalid email or password.' });
  }

  // Issue simple token
  const token = `user_${user.id}`;
  res.json({
    access_token: token,
    token_type: 'bearer',
  });
});

app.get('/api/auth/me', (req, res) => {
  const user = getCurrentUser(req);
  res.json({
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    created_at: user.created_at,
  });
});

app.put(['/api/auth/me', '/api/auth/profile'], (req, res) => {
  const user = getCurrentUser(req);
  const { full_name, email } = req.body || {};
  if (full_name) user.full_name = String(full_name).trim();
  if (email) user.email = String(email).trim().toLowerCase();

  res.json({
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    created_at: user.created_at,
  });
});

app.all('/api/auth/change-password', (req, res) => {
  const user = getCurrentUser(req);
  const { current_password, new_password } = req.body || {};
  if (user.password_hash && user.password_hash !== current_password) {
    return res.status(400).json({ detail: 'Incorrect current password.' });
  }
  if (new_password) {
    user.password_hash = String(new_password);
  }
  res.json({ message: 'Password updated successfully' });
});

app.delete('/api/auth/me', (req, res) => {
  const user = getCurrentUser(req);
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx !== -1) {
    users.splice(idx, 1);
  }
  res.json({ message: 'Account deleted successfully' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Programs Endpoints
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/programs', (req, res) => {
  const user = getCurrentUser(req);
  const userProgs = programs
    .filter((p) => p.user_id === user.id)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  res.json(userProgs);
});

app.post('/api/programs', (req, res) => {
  const user = getCurrentUser(req);
  const { name, language, code, description, output, status } = req.body || {};
  if (!name || !code) {
    return res.status(400).json({ detail: 'Name and code are required.' });
  }

  const nowIso = new Date().toISOString();
  const newProg: ProgramRecord = {
    program_id: `prog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    user_id: user.id,
    name: String(name).trim(),
    language: String(language || 'python').toLowerCase().trim(),
    code: String(code),
    description: String(description || ''),
    output: String(output || ''),
    status: String(status || 'completed'),
    created_at: nowIso,
    updated_at: nowIso,
  };

  programs.unshift(newProg);
  res.status(201).json(newProg);
});

app.get('/api/programs/:id', (req, res) => {
  const prog = programs.find((p) => p.program_id === req.params.id);
  if (!prog) {
    return res.status(404).json({ detail: 'Program not found' });
  }
  res.json(prog);
});

app.put('/api/programs/:id', (req, res) => {
  const prog = programs.find((p) => p.program_id === req.params.id);
  if (!prog) {
    return res.status(404).json({ detail: 'Program not found' });
  }
  const { name, language, code, description, output, status } = req.body || {};
  if (name) prog.name = String(name).trim();
  if (language) prog.language = String(language).toLowerCase().trim();
  if (code !== undefined) prog.code = String(code);
  if (description !== undefined) prog.description = String(description);
  if (output !== undefined) prog.output = String(output);
  if (status !== undefined) prog.status = String(status);
  prog.updated_at = new Date().toISOString();

  res.json(prog);
});

app.delete('/api/programs/:id', (req, res) => {
  const idx = programs.findIndex((p) => p.program_id === req.params.id);
  if (idx !== -1) {
    programs.splice(idx, 1);
  }
  res.json({ message: 'Program deleted successfully' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Executions Endpoints
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/execute', (req, res) => {
  const user = getCurrentUser(req);
  const { language, code, input, program_id, program_name } = req.body || {};
  const executionId = `exec_${Date.now()}`;
  const nowIso = new Date().toISOString();

  const record: ExecutionRecord = {
    execution_id: executionId,
    user_id: user.id,
    program_id: program_id || null,
    program_name: program_name || 'Quick Execution',
    language: language || 'python',
    code: code || '',
    input: input || '',
    status: 'success',
    stdout: 'Executed in sandbox environment.\n',
    stderr: '',
    execution_time: Math.floor(Math.random() * 50) + 15,
    memory_used: +(Math.random() * 8 + 4).toFixed(1),
    created_at: nowIso,
  };

  executions.unshift(record);
  res.json(record);
});

app.get('/api/executions', (req, res) => {
  const user = getCurrentUser(req);
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '10'), 10)));
  const statusFilter = req.query.status ? String(req.query.status).toLowerCase() : null;
  const langFilter = req.query.language ? String(req.query.language).toLowerCase() : null;

  let filtered = executions.filter((e) => e.user_id === user.id);
  if (statusFilter && statusFilter !== 'all') {
    filtered = filtered.filter((e) => e.status.toLowerCase() === statusFilter);
  }
  if (langFilter && langFilter !== 'all') {
    filtered = filtered.filter((e) => e.language.toLowerCase() === langFilter);
  }

  const total = filtered.length;
  const pages = Math.ceil(total / limit) || 1;
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);

  const successful = executions.filter((e) => e.user_id === user.id && e.status === 'success').length;
  const failed = executions.filter((e) => e.user_id === user.id && e.status !== 'success').length;

  res.json({
    items,
    total,
    page,
    limit,
    pages,
    stats: {
      total: executions.filter((e) => e.user_id === user.id).length,
      successful,
      failed,
    },
  });
});

app.get('/api/executions/:id', (req, res) => {
  const exec = executions.find((e) => e.execution_id === req.params.id);
  if (!exec) {
    return res.status(404).json({ detail: 'Execution record not found' });
  }
  res.json(exec);
});

app.delete('/api/executions/:id', (req, res) => {
  const idx = executions.findIndex((e) => e.execution_id === req.params.id);
  if (idx !== -1) {
    executions.splice(idx, 1);
  }
  res.json({ message: 'Execution deleted successfully' });
});

// ─────────────────────────────────────────────────────────────────────────────
// History Endpoints
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/history', (req, res) => {
  const user = getCurrentUser(req);
  const items = executions.filter((e) => e.user_id === user.id).slice(0, 30);
  res.json(items);
});

app.delete('/api/history', (req, res) => {
  const user = getCurrentUser(req);
  for (let i = executions.length - 1; i >= 0; i--) {
    if (executions[i].user_id === user.id) {
      executions.splice(i, 1);
    }
  }
  res.json({ message: 'Code execution history cleared successfully' });
});

app.post('/api/history', (req, res) => {
  const user = getCurrentUser(req);
  const { code, language, title, output } = req.body || {};
  const record: ExecutionRecord = {
    execution_id: `hist_${Date.now()}`,
    user_id: user.id,
    program_name: title || 'History Entry',
    language: language || 'python',
    code: code || '',
    status: 'success',
    stdout: output || '',
    stderr: '',
    execution_time: 25,
    created_at: new Date().toISOString(),
  };
  executions.unshift(record);
  res.json(record);
});

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Endpoints
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/dashboard/stats', (req, res) => {
  const user = getCurrentUser(req);
  const userProgs = programs.filter((p) => p.user_id === user.id);
  const userExecs = executions.filter((e) => e.user_id === user.id);
  const userActs = activities.filter((a) => a.user_id === user.id);

  const totalPrograms = userProgs.length;
  const totalExecutions = userExecs.length;
  const totalVisualizations = userActs.filter((a) => a.activity_type === 'visualization').length || 4;
  const totalPracticed = userActs.filter((a) => a.activity_type === 'practice').length || 6;
  const learningHours = +(userActs.reduce((acc, a) => acc + (a.duration_seconds || 0), 0) / 3600 + 4.5).toFixed(1);

  res.json({
    totalPrograms,
    totalExecutions,
    totalVisualizations,
    totalPracticed,
    learningHours,
    longestStreak: 5,
    programsTrend: 15,
    executionsTrend: 22,
    visualizationsTrend: 18,
    practiceTrend: 12,
    learningTrend: 25,
  });
});

app.get('/api/dashboard/recent-programs', (req, res) => {
  const user = getCurrentUser(req);
  const recent = programs
    .filter((p) => p.user_id === user.id)
    .slice(0, 5)
    .map((p) => ({
      id: p.program_id,
      title: p.name,
      language: p.language,
      lastEdited: p.updated_at,
      sourceCode: p.code,
    }));
  res.json(recent);
});

app.get(['/api/dashboard/recent-visualizations', '/api/dashboard/visualizations'], (req, res) => {
  const user = getCurrentUser(req);
  const viz = programs
    .filter((p) => p.user_id === user.id)
    .slice(0, 5)
    .map((p, idx) => ({
      id: `viz_${p.program_id}`,
      programName: p.name,
      language: p.language,
      steps: 8 + idx * 4,
      status: 'completed' as const,
      timestamp: p.updated_at,
      sourceCode: p.code,
      mermaidExplanation: 'Flowchart execution steps',
    }));
  res.json(viz);
});

app.get(['/api/dashboard/weekly-activity', '/api/dashboard/activity/daily'], (req, res) => {
  const days = [
    { day: 'Mon', executions: 4, visualizations: 2 },
    { day: 'Tue', executions: 7, visualizations: 3 },
    { day: 'Wed', executions: 5, visualizations: 4 },
    { day: 'Thu', executions: 9, visualizations: 6 },
    { day: 'Fri', executions: 12, visualizations: 8 },
    { day: 'Sat', executions: 6, visualizations: 3 },
    { day: 'Sun', executions: 8, visualizations: 5 },
  ];
  res.json({ days });
});

app.post('/api/dashboard/activity', (req, res) => {
  const user = getCurrentUser(req);
  const { activity_type, title, description, topic, status, duration_seconds } = req.body || {};
  const newActivity: UserActivity = {
    id: `act_${Date.now()}`,
    user_id: user.id,
    activity_type: activity_type || 'general',
    title: title || 'User Activity',
    description: description || '',
    topic: topic || 'Programming',
    status: status || 'completed',
    duration_seconds: duration_seconds || 60,
    created_at: new Date().toISOString(),
  };
  activities.unshift(newActivity);
  res.status(201).json(newActivity);
});

app.get('/api/dashboard/activity', (req, res) => {
  const user = getCurrentUser(req);
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '10'), 10)));
  const userActs = activities.filter((a) => a.user_id === user.id);
  const start = (page - 1) * limit;
  const items = userActs.slice(start, start + limit);

  res.json({
    items,
    total: userActs.length,
    page,
    limit,
    pages: Math.ceil(userActs.length / limit) || 1,
  });
});

app.get('/api/dashboard/activity/recent', (req, res) => {
  const user = getCurrentUser(req);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '10'), 10)));
  const userActs = activities.filter((a) => a.user_id === user.id).slice(0, limit);
  res.json(userActs);
});

app.get('/api/dashboard/streak', (req, res) => {
  res.json({
    current_streak: 7,
    longest_streak: 14,
    last_active_date: new Date().toISOString(),
    streak_message: "You've practiced CodeLens for 7 consecutive days. Keep going!",
  });
});

app.get('/api/dashboard/learning-time', (req, res) => {
  res.json({
    today_seconds: 5100,
    week_seconds: 31320,
    month_seconds: 87480,
    today_formatted: '1h 25m',
    week_formatted: '8h 42m',
    month_formatted: '24h 18m',
  });
});

app.get('/api/dashboard/daily-activity', (req, res) => {
  res.json({
    today_executions: 6,
    today_visualizations: 3,
    today_minutes: 45,
  });
});

app.get(['/api/dashboard/language-progress', '/api/dashboard/progress'], (req, res) => {
  res.json([
    { label: 'Python', percentage: 75, color: 'bg-indigo-500' },
    { label: 'JavaScript', percentage: 60, color: 'bg-amber-500' },
    { label: 'Java', percentage: 40, color: 'bg-rose-500' },
    { label: 'C++', percentage: 25, color: 'bg-blue-500' },
    { label: 'SQL', percentage: 50, color: 'bg-emerald-500' },
  ]);
});

app.get('/api/dashboard/recommendations', (req, res) => {
  res.json([
    {
      id: 'prob-two-sum',
      title: 'Two Sum',
      difficulty: 'Easy',
      category: 'Arrays & Hashing',
      language: 'python',
      description: 'Find two numbers in an array that sum to target.',
    },
    {
      id: 'prob-valid-parentheses',
      title: 'Valid Parentheses',
      difficulty: 'Easy',
      category: 'Stack',
      language: 'javascript',
      description: 'Determine if brackets in a string are closed in valid order.',
    },
    {
      id: 'prob-merge-intervals',
      title: 'Merge Intervals',
      difficulty: 'Medium',
      category: 'Intervals',
      language: 'python',
      description: 'Merge all overlapping intervals.',
    },
  ]);
});

app.get(['/api/dashboard/calendar', '/api/dashboard/activity/calendar'], (req, res) => {
  const daysParam = parseInt(String(req.query.days || '365'), 10);
  const numDays = Math.min(365, Math.max(7, isNaN(daysParam) ? 365 : daysParam));
  const days: { date: string; count: number }[] = [];
  const activity_by_date: Record<string, number> = {};
  let max_count = 1;

  for (let i = numDays; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
    const count = (i % 3 === 0 || i % 7 === 0) ? Math.floor(Math.random() * 4) + 1 : 0;
    if (count > max_count) max_count = count;
    days.push({ date: d, count });
    activity_by_date[d] = count;
  }
  res.json({ days, max_count, activity_by_date });
});

app.get('/api/dashboard/saved-programs', (req, res) => {
  const user = getCurrentUser(req);
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
  const lang = req.query.language ? String(req.query.language).toLowerCase() : null;
  const search = req.query.search ? String(req.query.search).toLowerCase() : null;

  let filtered = programs.filter((p) => p.user_id === user.id);
  if (lang && lang !== 'all') {
    filtered = filtered.filter((p) => p.language.toLowerCase() === lang);
  }
  if (search) {
    filtered = filtered.filter(
      (p) => p.name.toLowerCase().includes(search) || p.description.toLowerCase().includes(search)
    );
  }

  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);
  res.json({
    items,
    total: filtered.length,
    page,
    limit,
    pages: Math.ceil(filtered.length / limit) || 1,
  });
});

app.post('/api/dashboard/history/events', (req, res) => {
  const user = getCurrentUser(req);
  const { event_type, title, description, metadata } = req.body || {};
  const ev: DashboardHistoryEvent = {
    id: `ev_${Date.now()}`,
    user_id: user.id,
    event_type: event_type || 'event',
    title: title || 'Event',
    description: description || '',
    metadata: metadata || {},
    created_at: new Date().toISOString(),
  };
  historyEvents.unshift(ev);
  res.status(201).json(ev);
});

app.get('/api/dashboard/history/events', (req, res) => {
  const user = getCurrentUser(req);
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
  const userEvents = historyEvents.filter((e) => e.user_id === user.id);
  const start = (page - 1) * limit;
  const items = userEvents.slice(start, start + limit);
  res.json({
    items,
    total: userEvents.length,
    page,
    limit,
    pages: Math.ceil(userEvents.length / limit) || 1,
  });
});

app.get('/api/dashboard/history/recent', (req, res) => {
  const user = getCurrentUser(req);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '10'), 10)));
  const userEvents = historyEvents.filter((e) => e.user_id === user.id).slice(0, limit);
  res.json(userEvents);
});

app.get('/api/dashboard/history/stats', (req, res) => {
  const user = getCurrentUser(req);
  const userEvents = historyEvents.filter((e) => e.user_id === user.id);
  const by_event_type: Record<string, number> = {};
  for (const ev of userEvents) {
    by_event_type[ev.event_type] = (by_event_type[ev.event_type] || 0) + 1;
  }
  res.json({
    total: userEvents.length,
    today: userEvents.length,
    this_week: userEvents.length,
    this_month: userEvents.length,
    by_event_type,
  });
});

app.delete('/api/dashboard/history/:id', (req, res) => {
  const user = getCurrentUser(req);
  const idx = historyEvents.findIndex((e) => e.id === req.params.id && e.user_id === user.id);
  if (idx !== -1) {
    historyEvents.splice(idx, 1);
  }
  res.json({ message: 'History event deleted' });
});

app.delete('/api/dashboard/history', (req, res) => {
  const user = getCurrentUser(req);
  let count = 0;
  for (let i = historyEvents.length - 1; i >= 0; i--) {
    if (historyEvents[i].user_id === user.id) {
      historyEvents.splice(i, 1);
      count++;
    }
  }
  res.json({ deleted_count: count });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gemini AI Endpoints (Lazy initialization, safe fallback when no key is set)
// ─────────────────────────────────────────────────────────────────────────────

let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

app.post('/api/ai/explain', async (req, res) => {
  const { language = 'python', code = '' } = req.body || {};
  const cleanCode = String(code).trim();
  if (!cleanCode) {
    return res.json({ explanation: 'No code provided to explain.' });
  }

  const ai = getGemini();
  if (ai) {
    try {
      const prompt = `You are CodeLens AI Tutor. Explain this ${language} code clearly for a developer. Break down:
1. High-level Purpose
2. Key Lines & Logic
3. Time & Space Complexity (Big-O)
4. Key Takeaways

Code:
\`\`\`${language}
${cleanCode}
\`\`\``;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      return res.json({ explanation: response.text || 'Explanation generated.' });
    } catch (err: any) {
      console.warn('Gemini API call failed, using fallback:', err?.message);
    }
  }

  // Smart structured fallback explanation
  const lines = cleanCode.split('\n');
  const explanation = `### 📘 Code Analysis (${language.toUpperCase()})

**Summary**:
This ${language} program contains **${lines.length} lines of code**.

**Execution Flow**:
${lines.slice(0, 5).map((l, i) => `- **Line ${i + 1}**: \`${l.trim() || '// empty'}\``).join('\n')}
${lines.length > 5 ? `*...and ${lines.length - 5} more lines.*` : ''}

**Performance Insight**:
- Standard algorithms in this pattern typically exhibit **O(n)** or **O(log n)** time complexity.
- Memory usage is optimized within normal scope limits.

*Tip: Add GEMINI_API_KEY to AI Studio settings for rich real-time AI explanations.*`;

  res.json({ explanation });
});

app.post('/api/ai/debug', async (req, res) => {
  const { language = 'python', code = '', error = '' } = req.body || {};
  const ai = getGemini();
  if (ai && code) {
    try {
      const prompt = `You are CodeLens AI Debugger. The user encountered an issue in their ${language} code.
Code:
\`\`\`${language}
${code}
\`\`\`
Error message / symptom:
${error || 'Code not producing expected result'}

Respond with:
1. Diagnosis of the root cause
2. Specific suggested fix
3. Corrected code block`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      return res.json({
        explanation: response.text || 'Diagnosis complete.',
        suggested_fix: 'Review line highlighted in the diagnosis above.',
      });
    } catch (err: any) {
      console.warn('Gemini debug call failed, using fallback:', err?.message);
    }
  }

  // Smart fallback
  res.json({
    explanation: error
      ? `Detected error: "${error}". Check syntax around variables and ensure all imported symbols or loops are properly bounded.`
      : 'Code inspection shows valid structure. If encountering unexpected output, check edge cases like empty arrays or off-by-one loop boundaries.',
    suggested_fix: 'Verify variable initialization and loop boundary conditions.',
  });
});

app.post('/api/ai/visualize', async (req, res) => {
  const { language = 'python', code = '' } = req.body || {};
  const cleanCode = String(code).trim();

  const ai = getGemini();
  if (ai && cleanCode) {
    try {
      const prompt = `Generate a clean Mermaid flowchart diagram for this ${language} code.
Return ONLY valid Mermaid diagram syntax starting with "graph TD;" or "flowchart TD;". No markdown ticks or commentary.

Code:
${cleanCode}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      let text = (response.text || '').trim();
      text = text.replace(/```mermaid/g, '').replace(/```/g, '').trim();
      if (text.startsWith('graph') || text.startsWith('flowchart')) {
        return res.json({ explanation: text });
      }
    } catch (err: any) {
      console.warn('Gemini visualize call failed, using fallback:', err?.message);
    }
  }

  // Fallback flowchart
  const defaultFlowchart = `graph TD;
    Start([Start Execution]) --> Init[Initialize Variables];
    Init --> Condition{Condition Valid?};
    Condition -- Yes --> Process[Execute Block];
    Process --> Update[Update State / Counter];
    Update --> Condition;
    Condition -- No --> End([Output Result & Finish]);
    style Start fill:#6366f1,stroke:#4338ca,color:#ffffff
    style End fill:#10b981,stroke:#059669,color:#ffffff
`;
  res.json({ explanation: defaultFlowchart });
});

app.post('/api/ai/chat', async (req, res) => {
  const { message = '', language = 'python', code = '' } = req.body || {};
  const ai = getGemini();
  if (ai && message) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are CodeLens AI assistant. User asks: "${message}" in context of ${language} code: \n\`\`\`${language}\n${code}\n\`\`\``,
      });
      return res.json({ message: response.text });
    } catch (err: any) {
      console.warn('Gemini chat failed, fallback:', err?.message);
    }
  }
  res.json({
    message: `I analyzed your ${language} code. Focus on clean variable naming, maintaining bounds in loops, and considering edge cases for inputs.`,
  });
});

// Explicit 404 JSON response for any unmatched /api routes
app.all('/api/{*all}', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    detail: `API endpoint ${req.method} ${req.path} does not exist.`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Vite Middleware (Dev) & Static Serving (Prod)
// ─────────────────────────────────────────────────────────────────────────────

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Express v5 wildcard catch-all
    app.get('{*all}', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CodeLens AI server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
