import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Terminal, Code2, Zap, BrainCircuit, PlayCircle, LogIn, LogOut, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DashboardLayout } from './components/DashboardLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ActivityHistoryPage } from './pages/ActivityHistoryPage';
import { EditorPage } from './pages/EditorPage';
import { SettingsPage } from './pages/SettingsPage';
import { DemoModal } from './components/demo/DemoModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RegisterPage } from './pages/RegisterPage';
import { SignInPage } from './pages/SignInPage';

// ─── Auth-aware CTA button ────────────────────────────────────────────────────
// Navigates to /editor if authenticated, /register if not.
function AuthCTA({ className, children }: { className: string; children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const handleClick = () => navigate(isAuthenticated ? '/editor' : '/register');
  return (
    <button onClick={handleClick} disabled={loading} className={className}>
      {children}
    </button>
  );
}

// ─── Landing Page Navbar (auth-aware) ────────────────────────────────────────
function LandingNavbar({ onWatchDemo }: { onWatchDemo: () => void }) {
  const { isAuthenticated, user, logout, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return null;

  if (isAuthenticated) {
    return (
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
            <Code2 className="w-6 h-6 text-indigo-400" />
          </div>
          <span className="text-xl font-bold tracking-tight">CodeLens AI</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/editor')}
            className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            <Terminal className="w-4 h-4" />
            Open Editor
          </button>
          <button
            onClick={onWatchDemo}
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Demo
          </button>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 border border-slate-700/60 rounded-xl text-sm text-slate-300">
            <User className="w-4 h-4 text-indigo-400" />
            <span className="font-medium text-white">{user?.full_name}</span>
          </div>
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </nav>
    );
  }

  return (
    <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
          <Code2 className="w-6 h-6 text-indigo-400" />
        </div>
        <span className="text-xl font-bold tracking-tight">CodeLens AI</span>
      </div>
      <div className="flex items-center gap-6">
        <Link to="/features" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Features</Link>
        <Link to="/pricing" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Pricing</Link>
        <div className="h-4 w-px bg-slate-800" />
        <Link to="/signin" className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">
          <LogIn className="w-4 h-4" />
          Sign In
        </Link>
        <AuthCTA className="px-5 py-2.5 bg-white text-black font-semibold rounded-full text-sm hover:bg-slate-200 transition-transform active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
          Start Coding
        </AuthCTA>
      </div>
    </nav>
  );
}

// ─── Landing Page ─────────────────────────────────────────────────────────────
function LandingPage() {
  const [showDemo, setShowDemo] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-indigo-500/30 overflow-hidden relative">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/20 blur-[120px] pointer-events-none" />

      <LandingNavbar onWatchDemo={() => setShowDemo(true)} />

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 text-center max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium mb-8"
        >
          <Zap className="w-4 h-4" />
          <span>V1.0 is now live</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-slate-400"
        >
          Understand Code <br/> Like Never Before.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="text-lg md:text-xl text-slate-400 max-w-2xl mb-12 leading-relaxed"
        >
          Step-by-step execution, real-time memory visualization, and an AI tutor that explains every line. The ultimate platform to master programming.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          <AuthCTA className="flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-semibold transition-all hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] active:scale-95">
            <Terminal className="w-5 h-5" />
            Open Editor
          </AuthCTA>
          <button
            onClick={() => setShowDemo(true)}
            className="flex items-center gap-2 px-8 py-4 bg-slate-800/50 hover:bg-slate-800 text-white rounded-full font-semibold border border-slate-700/50 backdrop-blur-md transition-all active:scale-95 hover:shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:border-violet-500/40"
          >
            <PlayCircle className="w-5 h-5 text-violet-400" />
            Watch Demo
          </button>
        </motion.div>

        {/* Decorative mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
          className="mt-20 w-full rounded-2xl border border-slate-800/60 bg-slate-900/50 backdrop-blur-xl p-4 shadow-2xl relative"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent opacity-50 rounded-2xl pointer-events-none" />
          <div className="flex items-center gap-2 mb-4 px-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <div className="font-mono text-sm text-left text-slate-300 p-6 bg-slate-950/80 rounded-xl border border-slate-800/50">
            <div className="flex gap-4"><span className="text-slate-600">1</span><span className="text-pink-400">def</span> <span className="text-blue-400">fibonacci</span>(n):</div>
            <div className="flex gap-4"><span className="text-slate-600">2</span>    <span className="text-pink-400">if</span> n &lt;= <span className="text-orange-400">1</span>:</div>
            <div className="flex gap-4"><span className="text-slate-600">3</span>        <span className="text-pink-400">return</span> n</div>
            <div className="flex gap-4"><span className="text-slate-600">4</span>    <span className="text-pink-400">return</span> fibonacci(n-<span className="text-orange-400">1</span>) + fibonacci(n-<span className="text-orange-400">2</span>)</div>
          </div>

          {/* Mock floating AI tooltip */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -right-8 top-1/2 p-4 bg-slate-800/90 backdrop-blur-xl border border-indigo-500/30 rounded-2xl shadow-xl w-64 text-left"
          >
            <div className="flex items-center gap-2 mb-2">
              <BrainCircuit className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold text-indigo-300">AI Tutor</span>
            </div>
            <p className="text-xs text-slate-300">This is a recursive function. It calls itself to calculate the Fibonacci sequence. Warning: Time complexity is O(2^n).</p>
          </motion.div>
        </motion.div>
      </main>

      {/* Demo Modal */}
      {showDemo && <DemoModal onClose={() => setShowDemo(false)} />}
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <Router>
      <AuthProvider>
        <SettingsProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/signin" element={<SignInPage />} />
            {/* Legacy /login → /signin redirect */}
            <Route path="/login" element={<SignInPage />} />

            {/* Protected routes */}
            <Route element={<DashboardLayout />}>
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/activity"
                element={
                  <ProtectedRoute>
                    <ActivityHistoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/editor"
                element={
                  <ProtectedRoute>
                    <EditorPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Routes>
        </SettingsProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
