// src/components/AppLayout.jsx
import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABELS } from '../domain';
import { SIDEBAR_MENUS } from '../data/sidebar';
import { api } from '../api/client';
import NotificationPanel from './NotificationPanel';
import Sidebar from './Sidebar';
import { useCart } from '../pages/comprador/CartContext';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false); // drawer mobile
  const { count: cartCount } = useCart();

  useEffect(() => {
    let cancelled = false;
    api.get('/api/notifications').then((data) => { if (!cancelled) setNotifications(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [location.pathname]);

  // Fecha o drawer mobile ao mudar de rota.
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  if (!user) return null;

  const items = SIDEBAR_MENUS[user.role] || [];
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className={`app-shell${menuOpen ? ' menu-open' : ''}`}>
      <Sidebar
        items={items}
        user={user}
        roleLabel={ROLE_LABELS[user.role]}
        cartCount={cartCount}
        onLogout={logout}
        onNavigate={() => setMenuOpen(false)}
      />
      {/* Fundo escuro clicável quando o drawer mobile está aberto. */}
      <div className="sb-scrim" onClick={() => setMenuOpen(false)} />

      <div className="main-column">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Abrir menu">☰</button>
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
