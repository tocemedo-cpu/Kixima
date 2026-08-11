// src/components/Common.jsx
// Peças básicas partilhadas. Traduzem automaticamente as strings recebidas
// (título, subtítulo, labels) via i18n — números e nós React passam intactos.
import { useI18n } from '../i18n';

function useT() {
  const { t } = useI18n();
  return (v) => (typeof v === 'string' ? t(v) : v);
}

export function StatCard({ label, value, sub }) {
  const tr = useT();
  return (
    <div className="card stat-card">
      <div className="stat-label">{tr(label)}</div>
      <div className="stat-value">{tr(value)}</div>
      {sub ? <div className="stat-sub">{tr(sub)}</div> : null}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  const tr = useT();
  return (
    <div className="page-header">
      <div>
        <h1>{tr(title)}</h1>
        {subtitle ? <p>{tr(subtitle)}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Loading({ label = 'A carregar…' }) {
  const tr = useT();
  return <div className="loading-text">{tr(label)}</div>;
}

// As mensagens dos banners vêm muitas vezes do servidor (já em PT); as fixas
// das páginas passam por t() no ponto de chamada, as dinâmicas ficam como estão.
export function ErrorBanner({ message }) {
  const tr = useT();
  if (!message) return null;
  return <div className="banner banner-error">{tr(message)}</div>;
}

export function SuccessBanner({ message }) {
  const tr = useT();
  if (!message) return null;
  return <div className="banner banner-success">{tr(message)}</div>;
}
