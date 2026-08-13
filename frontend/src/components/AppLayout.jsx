// src/components/AppLayout.jsx
// Shell do mockup: navbar full-width no topo, menu escuro numerado à esquerda,
// conteúdo à direita. Aplicado a todas as personas.
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABELS } from '../domain';
import { SIDEBAR_MENUS } from '../data/sidebar';
import { api } from '../api/client';
import NotificationPanel from './NotificationPanel';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useCart } from '../pages/comprador/CartContext';
import { Icon } from './icons';
import { useI18n } from '../i18n';

export default function AppLayout() {
  const { t } = useI18n();
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

        {/* A 2FA é obrigatória para quem aprova ordens e credencia empresas. O
            aviso aparece enquanto não estiver ativa — depois do prazo, a conta
            fica limitada a esta configuração, por isso vale a pena não esperar. */}
        {user?.mfaPendente ? <AvisoMfa prazo={user.mfaPrazo} t={t} /> : null}

        <Outlet />
      </main>
    </div>
  );
}

// Aviso da 2FA por ativar.
//
// Antes dizia só "ative" — um pedido sem data é um pedido que se adia, e foi o
// que aconteceu: oito contas com poder continuaram sem 2FA. Agora diz quantos
// dias faltam e o que acontece quando acabarem, e fica vermelho na última
// semana. A consequência é o que move isto, não a recomendação.
function AvisoMfa({ prazo, t }) {
  const dias = prazo
    ? Math.ceil((new Date(prazo).getTime() - Date.now()) / 86400000)
    : null;
  const urgente = dias !== null && dias <= 7;

  return (
    <div className={`banner ${urgente ? 'banner-danger' : 'banner-warn'} mfa-aviso`}>
      <Icon name="shield" size={16} />
      <span>
        <strong>{t('Ative a verificação em dois passos')}</strong>
        {' — '}
        {dias === null
          ? t('o seu perfil aprova operações com dinheiro, por isso a senha deixou de bastar.')
          : dias > 0
            ? `${dias === 1 ? t('falta 1 dia') : t('faltam {n} dias', { n: dias })}. ${t('Depois disso, a sua conta só dá acesso a este ecrã de ativação.')}`
            : t('o prazo terminou: a sua conta só dá acesso ao ecrã de ativação até isto ficar feito.')}
        {' '}
        <Link to="/seguranca">{t('Ativar agora')}</Link>
      </span>
    </div>
  );
}
