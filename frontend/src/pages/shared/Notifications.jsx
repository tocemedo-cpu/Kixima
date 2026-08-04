// src/pages/shared/Notifications.jsx
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner } from '../../components/Common';
import { formatDateTime } from '../../domain';
import { useI18n } from '../../i18n';

export default function Notifications() {
  const { t } = useI18n();
  const [notifications, setNotifications] = useState(null);
  const [error, setError] = useState('');

  function load() {
    api.get('/api/notifications').then(setNotifications).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function markRead(id) {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    } catch {
      // silencioso
    }
  }

  if (error) return <ErrorBanner message={error} />;
  if (!notifications) return <Loading />;

  return (
    <div>
      <PageHeader title="Notificações" subtitle="Alertas de POs, faturas, pagamentos e apólices." />

      {notifications.length === 0 ? (
        <div className="empty-state">
          <h3>{t('Sem notificações por agora')}</h3>
          <p>Assim que houver algo relevante para si, aparece aqui.</p>
        </div>
      ) : (
        <div className="card">
          {notifications.map((n, i) => (
            <div
              key={n.id}
              onClick={() => !n.readAt && markRead(n.id)}
              style={{
                padding: '16px 20px',
                borderBottom: i === notifications.length - 1 ? 'none' : '1px solid var(--paper-100)',
                background: n.readAt ? '#fff' : 'var(--paper-050)',
                cursor: n.readAt ? 'default' : 'pointer',
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
          ))}
        </div>
      )}
    </div>
  );
}
