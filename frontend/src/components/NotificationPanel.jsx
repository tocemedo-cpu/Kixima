// src/components/NotificationPanel.jsx
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { formatDateTime } from '../domain';
import { useI18n } from '../i18n';

export default function NotificationPanel({ notifications, onClose, onRead }) {
  const { t } = useI18n();
  async function markRead(id) {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      onRead(id);
    } catch {
      // silencioso — não é crítico
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 64,
        right: 28,
        width: 360,
        maxHeight: '70vh',
        overflowY: 'auto',
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        zIndex: 20,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
        <strong style={{ fontSize: 13.5 }}>{t('Notificações')}</strong>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('Fechar')}</button>
      </div>
      {notifications.length === 0 ? (
        <div className="empty-state">
          <p>{t('Sem notificações por agora.')}</p>
        </div>
      ) : (
        notifications.map((n) => (
          <div
            key={n.id}
            onClick={() => !n.readAt && markRead(n.id)}
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--paper-100)',
              background: n.readAt ? '#fff' : 'var(--paper-050)',
              cursor: n.readAt ? 'default' : 'pointer',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy-900)' }}>{n.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginTop: 2 }}>{n.message}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 4 }}>{formatDateTime(n.createdAt)}</div>
          </div>
        ))
      )}
      <Link
        to="/notificacoes"
        onClick={onClose}
        style={{ display: 'block', textAlign: 'center', padding: '10px', fontSize: 12.5, fontWeight: 600, color: 'var(--brand-600)', borderTop: '1px solid var(--line)' }}
      >
        {t('Ver todas as notificações')}
      </Link>
    </div>
  );
}
