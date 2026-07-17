// src/components/AppLayout.jsx
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABELS } from '../domain';
import { NAV_CONFIG } from '../navConfig';
import { api } from '../api/client';
import NotificationPanel from './NotificationPanel';
import Logo from './Logo';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/notifications')
      .then((data) => {
        if (!cancelled) setNotifications(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (!user) return null;

  const navItems = NAV_CONFIG[user.role] || [];
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo size={20} subtitle />
        </div>
        <div className="sidebar-persona">
          <strong>{user.name}</strong>
          {ROLE_LABELS[user.role]}
          {user.companyName ? <div style={{ marginTop: 4, opacity: 0.8 }}>{user.companyName}</div> : null}
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <NavLink to="/perfil" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} style={{ fontSize: 12.5 }}>
            Perfil pessoal
          </NavLink>
          <NavLink to="/ajuda" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`} style={{ fontSize: 12.5 }}>
            Ajuda & Suporte
          </NavLink>
        </div>

        <div className="sidebar-footer">
          Pagamento garantido em 7 dias.
          <button className="sidebar-logout" onClick={logout}>
            Terminar sessão
          </button>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-title">{ROLE_LABELS[user.role]}</div>
          <div className="topbar-actions">
            <button className="bell-button" onClick={() => setNotifOpen((v) => !v)} aria-label="Notificações">
              🔔
              {unread > 0 ? <span className="bell-dot" /> : null}
            </button>
          </div>
        </header>
        {notifOpen ? (
          <NotificationPanel
            notifications={notifications}
            onClose={() => setNotifOpen(false)}
            onRead={(id) =>
              setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)))
            }
          />
        ) : null}
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
