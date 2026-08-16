// src/pages/adminSistema/AuditTrail.jsx
// Trilho de auditoria financeira — registo imutável (append-only) de quem
// aprovou, pagou, confirmou ou alterou dados sensíveis. Ligado a
// /api/admin/audit-logs (paginado, filtrável por ação e pesquisa).
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead, Pill, Toolbar, EmptyRow, Pagination } from '../../components/BuyerUI';
import { formatDateTime } from '../../domain';
import { useI18n } from '../../i18n';

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

/**
 * Detalhe do registo, e agora também o IP.
 *
 * O IP tinha coluna própria. Medido a 1280px: esta tabela era a ÚNICA da
 * aplicação que não cabia — 130px escondidos atrás de scroll horizontal, e a
 * 1024px eram 384px. Todas as outras cabem, e por isso nenhuma outra foi
 * mexida: acrescentar "mostrar mais" a quinze tabelas que já cabem seria
 * complexidade para um problema que não existe.
 *
 * O IP é metadado forense — interessa quando já se está a investigar uma
 * linha concreta, não a percorrer a lista. É exatamente a mesma natureza do
 * que já vive neste campo, por isso junta-se aqui em vez de se inventar um
 * mecanismo de expansão. Nenhuma informação sai do ecrã.
 */
function DetailCell({ detail, ip }) {
  const { t } = useI18n();
  const comIp = (partes) => (ip ? [...partes, `IP: ${ip}`] : partes);
  if (!detail || typeof detail !== 'object') {
    const so = comIp([]);
    return so.length ? <span className="bz-muted">{so.join(' · ')}</span> : <span className="bz-muted">—</span>;
  }
  const parts = Object.entries(detail)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${t(DETAIL_LABEL[k] || k)}: ${v === true ? t('sim') : v === false ? t('não') : v}`);
  const todas = comIp(parts);
  if (!todas.length) return <span className="bz-muted">—</span>;
  return <span className="bz-muted">{todas.join(' · ')}</span>;
}

export default function AuditTrail() {
  const { t } = useI18n();
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
            aria-label={t('Filtrar por ação')}
          >
            <option value="">{t('Todas as ações')}</option>
            {(data?.actions || []).map((a) => (
              <option key={a.action} value={a.action}>
                {t(ACTION_LABEL[a.action] || a.action)} ({a.count})
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
                  <th>{t('Data')}</th><th>{t('Ação')}</th><th>{t('Referência')}</th><th>{t('Ator')}</th><th>{t('Perfil')}</th><th>{t('Detalhe')}</th>
                </tr>
              </thead>
              <tbody>
                {!data ? <tr><td colSpan={6}><EmptyRow>A carregar…</EmptyRow></td></tr>
                  : items.length === 0 ? <tr><td colSpan={6}><EmptyRow>Ainda não há registos de auditoria. São criados automaticamente nas aprovações, pagamentos e alterações sensíveis.</EmptyRow></td></tr>
                  : items.map((l) => (
                    <tr key={l.id}>
                      <td className="bz-muted">{formatDateTime(l.createdAt)}</td>
                      <td><Pill tone={ACTION_TONE[l.action] || 'neutral'}>{ACTION_LABEL[l.action] || l.action}</Pill></td>
                      <td className="mono">{l.entityRef || '—'}</td>
                      <td><strong>{l.actorName || '—'}</strong></td>
                      <td className="bz-muted">{l.actorRole ? t(ROLE_LABEL[l.actorRole] || l.actorRole) : '—'}</td>
                      <td><DetailCell detail={l.detail} ip={l.ip} /></td>
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
