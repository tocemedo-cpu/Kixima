// src/pages/shared/Notifications.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner } from '../../components/Common';
import { formatDateTime, resolverDestinoNotificacao } from '../../domain';
import { useAuth } from '../../auth/AuthContext';
import { useI18n } from '../../i18n';

export default function Notifications() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(null);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);

  function load() {
    api.get('/api/notifications', { limit: 100 })
      .then((r) => { setNotifications(r.itens || []); setTotal(r.total || 0); })
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  // Marca como lida (se ainda não estava) e navega para o recurso
  // relacionado, quando há um destino conhecido e seguro para o papel de
  // quem clicou — ver resolverDestinoNotificacao em domain.js.
  async function abrir(n) {
    if (!n.readAt) {
      try {
        await api.patch(`/api/notifications/${n.id}/read`);
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      } catch {
        // silencioso
      }
    }
    const destino = resolverDestinoNotificacao(n, user);
    if (destino) navigate(destino);
  }

  if (error) return <ErrorBanner message={error} />;
  if (!notifications) return <Loading />;

  return (
    <div>
      <PageHeader title="Notificações" subtitle="Alertas de POs, faturas, pagamentos e apólices." />

      {notifications.length === 0 ? (
        <div className="empty-state">
          <h3>{t('Sem notificações por agora')}</h3>
          <p>{t('Assim que houver algo relevante para si, aparece aqui.')}</p>
        </div>
      ) : (
        <div className="card">
          {notifications.map((n, i) => {
            const clicavel = !n.readAt || !!resolverDestinoNotificacao(n, user);
            return (
            <div
              key={n.id}
              onClick={() => clicavel && abrir(n)}
              style={{
                padding: '16px 20px',
                borderBottom: i === notifications.length - 1 ? 'none' : '1px solid var(--paper-100)',
                background: n.readAt ? '#fff' : 'var(--paper-050)',
                cursor: clicavel ? 'pointer' : 'default',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy-900)' }}>{n.title}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-600)', marginTop: 3 }}>{n.message}</div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-400)', whiteSpace: 'nowrap' }}>{formatDateTime(n.createdAt)}</div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
