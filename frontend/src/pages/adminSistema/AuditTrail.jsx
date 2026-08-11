// src/pages/adminSistema/AuditTrail.jsx
// Trilho de auditoria financeira — registo imutável (append-only) de quem
// aprovou, pagou, confirmou ou alterou dados sensíveis. Ligado a
// /api/admin/audit-logs (paginado, filtrável por ação e pesquisa).
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead, Pill, Toolbar, EmptyRow, Pagination } from '../../components/BuyerUI';
import { formatDateTime } from '../../domain';

const ACTION_LABEL = {
  PO_APROVADA: 'PO aprovada',
  PO_REJEITADA: 'PO rejeitada',
  PO_ACEITE: 'PO aceite pelo fornecedor',
  RECECAO_MERCADORIA: 'Receção de mercadoria',
  PAGAMENTO_EXECUTADO: 'Pagamento executado',
  RECECAO_VALOR_CONFIRMADA: 'Receção do valor confirmada',
  TAXA_COBRADA: 'Taxa KIXIMA cobrada',
  EMPRESA_DECIDIDA: 'Empresa aprovada/rejeitada',
  DADOS_BANCARIOS_ALTERADOS: 'Dados bancários alterados',
  UTILIZADOR_BLOQUEADO: 'Utilizador bloqueado',
  UTILIZADOR_DESBLOQUEADO: 'Utilizador desbloqueado',
};

const ACTION_TONE = {
  PAGAMENTO_EXECUTADO: 'success',
  RECECAO_VALOR_CONFIRMADA: 'success',
  PO_APROVADA: 'info',
  PO_ACEITE: 'info',
  PO_REJEITADA: 'danger',
  UTILIZADOR_BLOQUEADO: 'danger',
  DADOS_BANCARIOS_ALTERADOS: 'pending',
};

const ROLE_LABEL = {
  COMPRADOR: 'Comprador', COMPANY_ADMIN: 'Company Admin', FORNECEDOR: 'Fornecedor',
  FINANCEIRO: 'Financeiro', ADMIN_SISTEMA: 'Admin do Sistema',
};

// Nome legível para as chaves do detalhe (JSON) de cada registo.
const DETAIL_LABEL = {
  valor: 'Valor', moeda: 'Moeda', fatura: 'Fatura', comprovativo: 'Comprovativo',
  motivo: 'Motivo', conforme: 'Conforme', notas: 'Notas', decisao: 'Decisão',
  banco: 'Banco', iban: 'IBAN', swift: 'SWIFT', papel: 'Perfil',
};

function DetailCell({ detail }) {
  if (!detail || typeof detail !== 'object') return <span className="bz-muted">—</span>;
  const parts = Object.entries(detail)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${DETAIL_LABEL[k] || k}: ${v === true ? 'sim' : v === false ? 'não' : v}`);
  if (!parts.length) return <span className="bz-muted">—</span>;
  return <span className="bz-muted">{parts.join(' · ')}</span>;
}

export default function AuditTrail() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Pequeno debounce: a pesquisa é server-side.
    const t = setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (action) params.set('action', action);
      if (q) params.set('q', q);
      api.get(`/api/admin/audit-logs?${params}`).then(setData).catch((e) => setError(e.message));
    }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [page, action, q]);

  const items = data?.items || [];

  return (
    <div>
      <Crumbs trail={['Configurações e Suporte', 'Auditoria']} />
      <PageHead
        title="Trilho de auditoria"
        subtitle="Registo imutável (append-only) das operações financeiras e sensíveis: quem aprovou, pagou, confirmou ou alterou — com data, perfil e IP. Os registos nunca são editados nem apagados."
      />

      <Toolbar
        placeholder="Pesquisar por referência (PO-…, PAY-…) ou nome do ator…"
        q={q}
        onQ={(v) => { setQ(v); setPage(1); }}
        right={(
          <select
            className="input"
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            aria-label="Filtrar por ação"
          >
            <option value="">Todas as ações</option>
            {(data?.actions || []).map((a) => (
              <option key={a.action} value={a.action}>
                {ACTION_LABEL[a.action] || a.action} ({a.count})
              </option>
            ))}
          </select>
        )}
      />

      {error ? <div className="empty-state"><p>{error}</p></div> : (
        <>
          <div className="bz-card bz-tablewrap">
            <table className="bz-table">
              <thead>
                <tr>
                  <th>Data</th><th>Ação</th><th>Referência</th><th>Ator</th><th>Perfil</th><th>IP</th><th>Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {!data ? <tr><td colSpan={7}><EmptyRow>A carregar…</EmptyRow></td></tr>
                  : items.length === 0 ? <tr><td colSpan={7}><EmptyRow>Ainda não há registos de auditoria. São criados automaticamente nas aprovações, pagamentos e alterações sensíveis.</EmptyRow></td></tr>
                  : items.map((l) => (
                    <tr key={l.id}>
                      <td className="bz-muted">{formatDateTime(l.createdAt)}</td>
                      <td><Pill tone={ACTION_TONE[l.action] || 'neutral'}>{ACTION_LABEL[l.action] || l.action}</Pill></td>
                      <td className="mono">{l.entityRef || '—'}</td>
                      <td><strong>{l.actorName || '—'}</strong></td>
                      <td className="bz-muted">{ROLE_LABEL[l.actorRole] || l.actorRole || '—'}</td>
                      <td className="mono bz-muted">{l.ip || '—'}</td>
                      <td><DetailCell detail={l.detail} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {data ? <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} /> : null}
        </>
      )}
    </div>
  );
}
