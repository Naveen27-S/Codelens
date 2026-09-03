import { useNavigate, useLocation, Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  Code2, Home, LayoutDashboard, Terminal,
  Settings, HelpCircle, LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './AppLayout.css';

// ─── Sidebar nav config ────────────────────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  path: string;
  /** exact match for active detection */
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: <Home className="w-4 h-4" />,
    path: '/',
    exact: true,
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="w-4 h-4" />,
    path: '/dashboard',
  },
  {
    id: 'editor',
    label: 'Editor',
    icon: <Terminal className="w-4 h-4" />,
    path: '/editor',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings className="w-4 h-4" />,
    path: '/settings',
  },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const initials = (user?.full_name ?? user?.email ?? 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const isActive = (item: NavItem) => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <aside className="app-sidebar">
      {/* Brand */}
      <Link to="/" className="sidebar-brand" title="CodeLens AI">
        <div className="sidebar-brand-icon">
          <Code2 className="w-4 h-4 text-indigo-400" />
        </div>
        <span className="sidebar-brand-text">
          Code<span>Lens</span> AI
        </span>
      </Link>

      {/* Primary nav */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <button
              key={item.id}
              id={`sidebar-nav-${item.id}`}
              data-label={item.label}
              onClick={() => navigate(item.path)}
              className={`sidebar-nav-item${active ? ' active' : ''}`}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              title={item.label}
            >
              {item.icon}
              <span className="sidebar-nav-label">{item.label}</span>
            </button>
          );
        })}

        {/* Spacer before footer items on mobile (pushes to bottom on flex column) */}
        <div style={{ flex: 1 }} className="sidebar-spacer" />
      </nav>

      <div className="sidebar-divider" />

      {/* Footer */}
      <div className="sidebar-footer">
        {/* Help */}
        <button
          id="sidebar-nav-help"
          data-label="Help"
          className="sidebar-nav-item"
          aria-label="Help"
          title="Help"
          onClick={() => navigate('/')}
        >
          <HelpCircle className="w-4 h-4" />
          <span className="sidebar-nav-label">Help</span>
        </button>

        {/* User profile chip → navigates to settings */}
        {user && (
          <button
            id="sidebar-user-chip"
            className="sidebar-user-chip w-full"
            onClick={() => navigate('/settings')}
            title={user.full_name}
            aria-label="Open settings"
          >
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.full_name}</div>
              <div className="sidebar-user-email">{user.email}</div>
            </div>
          </button>
        )}

        {/* Logout */}
        <button
          id="sidebar-nav-logout"
          data-label="Logout"
          className="sidebar-logout-btn"
          aria-label="Logout"
          title="Logout"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" />
          <span className="sidebar-nav-label">Logout</span>
        </button>
      </div>
    </aside>
  );
}

// ─── AppLayout ────────────────────────────────────────────────────────────────

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * Shared layout for all authenticated pages.
 * Renders the left sidebar + main content area.
 */
export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        {children}
      </main>
    </div>
  );
}
