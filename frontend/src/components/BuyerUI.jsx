// src/components/BuyerUI.jsx
// Peças de apresentação partilhadas pelas telas (breadcrumb, KPIs, tabs, pills
// de estado, toolbar, paginação). Todas traduzem automaticamente as strings que
// recebem (título, subtítulo, labels, tabs, estados, etc.) via i18n, por isso
// quase todo o conteúdo estrutural muda de idioma sem alterar cada página.
import { Link } from 'react-router-dom';
import { Icon } from './icons';
import { useI18n } from '../i18n';

// Traduz apenas quando o valor é uma string (deixa números/nós React intactos).
function useT() {
  const { t } = useI18n();
  return (v) => (typeof v === 'string' ? t(v) : v);
}

/**
 * Migalhas de navegação.
 *
 * Cada item do rasto pode ser uma string (só texto, como sempre foi) ou
 * `{ label, to }`. Com `to`, o ancestral passa a navegar de verdade.
 *
 * Antes eram TODOS texto: uma linha "Home › Catálogo › Produtos" que parece um
 * caminho navegável e não navega em lado nenhum. Quem clica e não acontece nada
 * não conclui "isto não é um link" — conclui que a aplicação está partida, e
 * volta a clicar. O último item continua sem ligação de propósito: já se está
 * nele, e um link para a página atual só serve para recarregar.
 */
export function Crumbs({ trail = [] }) {
  const tr = useT();
  return (
    <nav className="bz-crumbs" aria-label={tr('Caminho')}>
      {trail.map((item, i) => {
        const texto = typeof item === 'string' ? item : item.label;
        const destino = typeof item === 'string' ? null : item.to;
        const ultimo = i === trail.length - 1;
        return (
          <span key={i}>
            {i > 0 ? <span className="bz-crumb-sep" aria-hidden="true">›</span> : null}
            {ultimo
              ? <strong aria-current="page">{tr(texto)}</strong>
              : (destino ? <Link className="bz-crumb-link" to={destino}>{tr(texto)}</Link> : tr(texto))}
          </span>
        );
      })}
    </nav>
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
      {cards.map((c, i) => {
        const corpo = (
          <>
            <div className={`bz-kpi-ico ${c.tone || 'info'}`}><Icon name={c.icon} size={20} /></div>
            <div className="bz-kpi-body">
              <span className="bz-kpi-label">{tr(c.label)}</span>
              <strong className="bz-kpi-value">{tr(c.value)}</strong>
              <span className="bz-kpi-sub">{tr(c.sub)}</span>
            </div>
          </>
        );
        // Sem `to`, sai exatamente o mesmo <div> de sempre — mesmas classes,
        // mesma estrutura. Só os KPIs que representam uma PENDÊNCIA ganham
        // ligação: um número informativo ("Volume de negócios") que parecesse
        // clicável e não levasse a lado nenhum seria pior do que não o ser.
        if (!c.to) return <div className="bz-kpi" key={i}>{corpo}</div>;
        return <Link className="bz-kpi bz-kpi-link" to={c.to} key={i}>{corpo}</Link>;
      })}
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

// [1,2,3,…,N] com reticências, centrado na página atual.
function pageNumbers(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out = [1];
  const s = Math.max(2, cur - 1);
  const e = Math.min(total - 1, cur + 1);
  if (s > 2) out.push('…');
  for (let i = s; i <= e; i++) out.push(i);
  if (e < total - 1) out.push('…');
  out.push(total);
  return out;
}

// Paginação reutilizável (server-side): recebe page/pages/total e um onPage.
// Não renderiza nada se só houver uma página (mostra só a contagem, se dada).
export function Pagination({ page, pages, total, onPage, unit = 'registos' }) {
  const { t, locale } = useI18n();
  if (!pages || pages <= 1) {
    return total != null && total > 0
      ? <div className="bz-pagcount">{total.toLocaleString(locale)} {t(unit)}</div>
      : null;
  }
  return (
    <div className="bz-pag">
      <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>← {t('Anterior')}</button>
      {pageNumbers(page, pages).map((n, i) => (n === '…'
        ? <span key={`e${i}`} className="bz-pag-ell">…</span>
        : <button key={n} className={`bz-pagn${n === page ? ' on' : ''}`} onClick={() => onPage(n)}>{n}</button>))}
      <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>{t('Próximo')} →</button>
      {total != null ? <span className="bz-pagcount">{total.toLocaleString(locale)} {t(unit)}</span> : null}
    </div>
  );
}
