// src/components/AppLayout.jsx
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABELS } from '../domain';
import { NAV_CONFIG } from '../navConfig';
import { api } from '../api/client';
import NotificationPanel from './NotificationPanel';
import Logo from './Logo';
import { Icon } from './icons';
import { useCart } from '../pages/comprador/CartContext';

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const { count: cartCount } = useCart();

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
  const badgeValue = (item) => (item.badge === 'cart' && cartCount > 0 ? cartCount : null);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo size={20} subtitle light />
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <Icon name={item.icon} size={18} className="sidebar-ico" />
              <span>{item.label}</span>
              {badgeValue(item) ? <span className="nav-count">{badgeValue(item)}</span> : null}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-secondary">
          <NavLink to="/perfil" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <Icon name="profile" size={18} className="sidebar-ico" />
            <span>Perfil pessoal</span>
          </NavLink>
          <NavLink to="/ajuda" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <Icon name="help" size={18} className="sidebar-ico" />
            <span>Ajuda &amp; Suporte</span>
          </NavLink>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-avatar">{initials(user.name)}</span>
            <span className="sidebar-user-meta">
              <strong>{user.name}</strong>
              <span>{ROLE_LABELS[user.role]}</span>
            </span>
          </div>
          <button className="sidebar-logout" onClick={logout}>Terminar sessão</button>
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
