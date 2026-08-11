// src/components/AppLayout.jsx
// Shell do mockup: navbar full-width no topo, menu escuro numerado à esquerda,
// conteúdo à direita. Aplicado a todas as personas.
import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABELS } from '../domain';
import { SIDEBAR_MENUS } from '../data/sidebar';
import { api } from '../api/client';
import NotificationPanel from './NotificationPanel';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useCart } from '../pages/comprador/CartContext';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const { count: cartCount } = useCart();

  useEffect(() => {
    let cancelled = false;
    api.get('/api/notifications').then((data) => { if (!cancelled) setNotifications(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [location.pathname]);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  if (!user) return null;

  // O Financeiro de uma empresa FORNECEDORA vê o menu do lado de quem recebe
  // (confirmar receção do valor, Taxa KIXIMA) em vez das faturas a pagar.
  const menuKey = user.role === 'FINANCEIRO' && user.companyType === 'FORNECEDOR'
    ? 'FINANCEIRO_FORNECEDOR'
    : user.role;
  const items = SIDEBAR_MENUS[menuKey] || [];
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className={`app-shell${menuOpen ? ' menu-open' : ''}`}>
      <Navbar
        user={user}
        roleLabel={ROLE_LABELS[user.role]}
        cartCount={cartCount}
        unread={unread}
        onMenuToggle={() => setMenuOpen((v) => !v)}
        onBell={() => setNotifOpen((v) => !v)}
        onLogout={logout}
      />

      <Sidebar items={items} cartCount={cartCount} onLogout={logout} onNavigate={() => setMenuOpen(false)} />
      <div className="sb-scrim" onClick={() => setMenuOpen(false)} />

      <main className="content">
        {notifOpen ? (
          <NotificationPanel
            notifications={notifications}
            onClose={() => setNotifOpen(false)}
            onRead={(id) => setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)))}
          />
        ) : null}
        <Outlet />
      </main>
    </div>
  );
}
