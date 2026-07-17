// src/components/Common.jsx

export function StatCard({ label, value, sub }) {
  return (
    <div className="card stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub ? <div className="stat-sub">{sub}</div> : null}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Loading({ label = 'A carregar…' }) {
  return <div className="loading-text">{label}</div>;
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return <div className="banner banner-error">{message}</div>;
}

export function SuccessBanner({ message }) {
  if (!message) return null;
  return <div className="banner banner-success">{message}</div>;
}
