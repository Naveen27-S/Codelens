import { Home, Code2, LayoutDashboard, Settings, HelpCircle, LogOut, User } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const navItems = [
    { icon: <Home className="w-5 h-5" />, label: 'Home', path: '/' },
    { icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Code2 className="w-5 h-5" />, label: 'Editor', path: '/editor' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isSettingsActive = location.pathname === '/settings';

  return (
    <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col h-screen text-slate-300">
      <div className="p-6 flex items-center gap-3">
        <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
          <Code2 className="w-6 h-6 text-indigo-400" />
        </div>
        <span className="text-xl font-bold text-white tracking-tight">CodeLens</span>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = item.path === '/dashboard'
            ? location.pathname.startsWith('/dashboard')
            : location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive
                  ? 'bg-indigo-500/10 text-indigo-400 font-medium border border-indigo-500/20'
                  : 'hover:bg-slate-900 hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-1">
        {/* User info */}
        {user && (
          <div className="flex items-center gap-3 px-4 py-3 mb-1 bg-slate-900/50 rounded-xl border border-slate-800/60">
            <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-white truncate">{user.full_name || user.email}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
        )}
        <Link
          to="/settings"
          id="sidebar-settings-link"
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            isSettingsActive
              ? 'bg-indigo-500/10 text-indigo-400 font-medium border border-indigo-500/20'
              : 'hover:bg-slate-900 hover:text-white text-slate-300'
          }`}
        >
          <Settings className="w-5 h-5" />
          Settings
        </Link>
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-900 transition-colors text-left">
          <HelpCircle className="w-5 h-5" />
          Help
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-colors text-left mt-2"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </div>
  );
}
