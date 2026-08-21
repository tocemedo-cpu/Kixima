// src/components/AppLayout.jsx
// Shell do mockup: navbar full-width no topo, menu escuro numerado à esquerda,
// conteúdo à direita. Aplicado a todas as personas.
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABELS } from '../domain';
import { SIDEBAR_MENUS, filtrarPorAreas } from '../data/sidebar';
import { api } from '../api/client';
import NotificationPanel from './NotificationPanel';
import SubscriptionBanner from './SubscriptionBanner';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useCart } from '../pages/comprador/CartContext';
import { useRealtime } from '../realtime/RealtimeContext';
import { Icon } from './icons';
import { useI18n } from '../i18n';

export default function AppLayout() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [porLer, setPorLer] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const { count: cartCount } = useCart();
  const { socket } = useRealtime();
  // Três contadores SEPARADOS do sino de notificações genérico — "Suporte: X
  // mensagens", "Chat Comercial: X mensagens", "Alertas de Segurança: X" não
  // se misturam entre si nem com o resto (ver a regra explícita do pedido).
  const [suporteNaoLidas, setSuporteNaoLidas] = useState(0);
  const [comercialNaoLidas, setComercialNaoLidas] = useState(0);
  const [alertasAbertos, setAlertasAbertos] = useState(0);
  const [subscricao, setSubscricao] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // A resposta passou a trazer envelope: itens desta página + total + porLer.
    // O contador do sino usa `porLer`, que conta TODAS as por ler e não só as
    // desta página — senão o número mudava ao paginar.
    api.get('/api/notifications').then((data) => {
      if (!cancelled) { setNotifications(data.itens || []); setPorLer(data.porLer || 0); }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [location.pathname]);

  // Uma vez por sessão (não a cada navegação, ao contrário do sino de
  // notificações acima): o AppLayout não desmonta ao trocar de rota — só o
  // Outlet lá dentro — por isso isto já não repete em cada clique. Repetir a
  // cada navegação chegou a esgotar o limite geral da API numa sessão com
  // muitas trocas de página seguidas (visto na suite E2E): três pedidos extra
  // por navegação, antes só havia um (as notificações).
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    api.get('/api/support/unread-count').then((d) => { if (!cancelled) setSuporteNaoLidas(d.count || 0); }).catch(() => {});
    api.get('/api/conversations/unread-count').then((d) => { if (!cancelled) setComercialNaoLidas(d.count || 0); }).catch(() => {});
    // O aviso de subscrição a vencer tem de se ver em QUALQUER página, não só
    // para quem visita /empresa/assinatura por iniciativa própria — é a
    // mesma razão de existir do aviso de 2FA acima. Só para quem pode fazer
    // alguma coisa com isto (a rota devolve 403 para o resto).
    if (['COMPANY_ADMIN', 'FINANCEIRO'].includes(user.role)) {
      api.get('/api/assinatura').then((d) => { if (!cancelled) setSubscricao(d); }).catch(() => {});
    }
    // Só quem gere Suporte tem alertas para ver — a rota devolve 403 para o
    // resto, e o contador fica calado (0) sem mostrar erro nenhum.
    if (user.role === 'ADMIN_SISTEMA') {
      api.get('/api/conversations/admin/alerts', { status: 'ABERTO' }).then((d) => { if (!cancelled) setAlertasAbertos(Array.isArray(d) ? d.length : 0); }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [user?.id]);

  // Em vez de voltar a pedir por HTTP a cada navegação, os contadores sobem
  // ao vivo pelo mesmo evento que o sino de notificações já recebe — reutiliza
  // a ligação Socket.IO, sem pedido extra nenhum. Só SOBE: descer é sempre que
  // a própria conversa é aberta e marcada como lida (ver SuporteChat/
  // ChatComercial), que é a mesma regra que já vale para o sino genérico.
  useEffect(() => {
    if (!socket) return undefined;
    function onNotification(n) {
      if (n.type === 'SUPORTE_MENSAGEM') setSuporteNaoLidas((c) => c + 1);
      else if (n.type === 'CHAT_COMERCIAL_MENSAGEM') setComercialNaoLidas((c) => c + 1);
      else if (n.type === 'ALERTA_SEGURANCA') setAlertasAbertos((c) => c + 1);
    }
    socket.on('notification:new', onNotification);
    return () => socket.off('notification:new', onNotification);
  }, [socket]);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  if (!user) return null;

  // O Financeiro de uma empresa FORNECEDORA vê o menu do lado de quem recebe
  // (confirmar receção do valor, Taxa KIXIMA) em vez das faturas a pagar.
  const menuKey = user.role === 'FINANCEIRO' && user.companyType === 'FORNECEDOR'
    ? 'FINANCEIRO_FORNECEDOR'
    : user.role;
  // Um assessor do Admin do Sistema restrito a certas áreas não vê no menu o
  // que o servidor lhe recusaria de qualquer forma (ver filtrarPorAreas em
  // data/sidebar.js). Para o Super Admin (adminAreas vazio) é uma cópia
  // idêntica ao array original.
  const items = filtrarPorAreas(SIDEBAR_MENUS[menuKey] || [], user.adminAreas);
  // Contado pelo servidor sobre TODAS as notificações, e não sobre as desta
  // página: um sino que diz "3" e ao paginar passa a dizer "1" parece uma
  // avaria. Ao marcar como lida desconta-se aqui, para o número reagir já.
  const unread = porLer;

  return (
    <div className={`app-shell${menuOpen ? ' menu-open' : ''}`}>
      {/* PRIMEIRO elemento focável da página, e tem de ser mesmo o primeiro: a
          ordem de tabulação segue a ordem do DOM, por isso um salto colocado
          depois da barra superior só se alcança já tendo passado por ela — que
          é precisamente o que ele existe para evitar. Sem isto, quem navega por
          teclado percorre os doze itens da barra lateral em CADA página antes
          de chegar ao que veio ver. Só aparece quando recebe o foco. */}
      <a href="#conteudo" className="skip-link">{t('Saltar para o conteúdo')}</a>

      <Navbar
        user={user}
        roleLabel={ROLE_LABELS[user.role]}
        cartCount={cartCount}
        unread={unread}
        onMenuToggle={() => setMenuOpen((v) => !v)}
        onBell={() => setNotifOpen((v) => !v)}
        onLogout={logout}
      />

      <Sidebar
        items={items} cartCount={cartCount}
        badges={{ suporte: suporteNaoLidas, chatComercial: comercialNaoLidas, alertas: alertasAbertos }}
        onLogout={logout} onNavigate={() => setMenuOpen(false)}
      />
      <div className="sb-scrim" onClick={() => setMenuOpen(false)} />

      <main className="content" id="conteudo" tabIndex={-1}>
        {notifOpen ? (
          <NotificationPanel
            notifications={notifications}
            onClose={() => setNotifOpen(false)}
            onRead={(id) => {
              setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
              setPorLer((n) => Math.max(0, n - 1));
            }}
          />
        ) : null}

        {/* A 2FA é obrigatória para quem aprova ordens e credencia empresas. O
            aviso aparece enquanto não estiver ativa — depois do prazo, a conta
            fica limitada a esta configuração, por isso vale a pena não esperar. */}
        {user?.mfaPendente ? <AvisoMfa prazo={user.mfaPrazo} t={t} /> : null}

        {/* Suprimido na própria página de Subscrição — lá o mesmo aviso já
            aparece junto ao "Plano atual", com a escada de planos logo a
            seguir; repeti-lo aqui seria a mesma frase duas vezes na mesma
            página. */}
        {location.pathname !== '/empresa/assinatura' ? <SubscriptionBanner data={subscricao} /> : null}

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
