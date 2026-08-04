// src/components/BuyerUI.jsx
// Peças de apresentação partilhadas pelas telas (breadcrumb, KPIs, tabs, pills
// de estado, toolbar, paginação). Todas traduzem automaticamente as strings que
// recebem (título, subtítulo, labels, tabs, estados, etc.) via i18n, por isso
// quase todo o conteúdo estrutural muda de idioma sem alterar cada página.
import { Icon } from './icons';
import { useI18n } from '../i18n';

// Traduz apenas quando o valor é uma string (deixa números/nós React intactos).
function useT() {
  const { t } = useI18n();
  return (v) => (typeof v === 'string' ? t(v) : v);
}

export function Crumbs({ trail = [] }) {
  const tr = useT();
  return (
    <div className="bz-crumbs">
      {trail.map((t, i) => (
        <span key={i}>
          {i > 0 ? <span className="bz-crumb-sep">›</span> : null}
          {i === trail.length - 1 ? <strong>{tr(t)}</strong> : tr(t)}
        </span>
      ))}
    </div>
  );
}

export function PageHead({ title, subtitle, actions }) {
  const tr = useT();
  return (
    <div className="bz-head">
      <div>
        <h1 className="bz-title">{tr(title)}</h1>
        {subtitle ? <p className="bz-sub">{tr(subtitle)}</p> : null}
      </div>
      {actions ? <div className="bz-head-actions">{actions}</div> : null}
    </div>
  );
}

export function KpiRow({ cards = [] }) {
  const tr = useT();
  return (
    <div className="bz-kpis">
      {cards.map((c, i) => (
        <div className="bz-kpi" key={i}>
          <div className={`bz-kpi-ico ${c.tone || 'info'}`}><Icon name={c.icon} size={20} /></div>
          <div className="bz-kpi-body">
            <span className="bz-kpi-label">{tr(c.label)}</span>
            <strong className="bz-kpi-value">{tr(c.value)}</strong>
            <span className="bz-kpi-sub">{tr(c.sub)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Tabs({ tabs = [], value, onChange }) {
  const tr = useT();
  return (
    <div className="bz-tabs">
      {tabs.map((t) => (
        <button key={t.key} className={`bz-tab${value === t.key ? ' on' : ''}`} onClick={() => onChange(t.key)}>
          {tr(t.label)}{t.count != null ? <span className="bz-tab-count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

const TONES = {
  success: 'bz-pill-success', pending: 'bz-pill-pending', info: 'bz-pill-info',
  danger: 'bz-pill-danger', neutral: 'bz-pill-neutral',
};
export function Pill({ tone = 'neutral', children }) {
  const tr = useT();
  return <span className={`bz-pill ${TONES[tone] || TONES.neutral}`}>{tr(children)}</span>;
}

export function Toolbar({ placeholder = 'Pesquisar…', q, onQ, right }) {
  const { t } = useI18n();
  return (
    <div className="bz-toolbar">
      <div className="bz-search">
        <Icon name="search" size={16} />
        <input value={q} onChange={(e) => onQ(e.target.value)} placeholder={t(placeholder)} />
      </div>
      <div className="bz-toolbar-right">
        {right}
        <button className="btn btn-ghost btn-sm"><Icon name="report" size={14} /> {t('Filtros')}</button>
      </div>
    </div>
  );
}

export function SupplierCell({ supplier }) {
  const initials = (supplier?.name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
  return (
    <div className="bz-supplier">
      <span className="bz-supplier-logo">{supplier?.logoUrl ? <img src={supplier.logoUrl} alt="" /> : initials}</span>
      <div>
        <strong>{supplier?.name || '—'}</strong>
        {supplier?.city ? <span className="bz-supplier-loc">{supplier.city}, {supplier.country || 'Angola'}</span> : null}
      </div>
    </div>
  );
}

export function EmptyRow({ children = 'Sem registos.' }) {
  const tr = useT();
  return <div className="bz-empty">{tr(children)}</div>;
}
