// src/pages/adminSistema/DueDiligence.jsx
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner, SuccessBanner } from '../../components/Common';
import Badge from '../../components/Badge';
import { Icon } from '../../components/icons';
import { COMPANY_STATUS, POLICY_STATUS, formatDate, formatMoney } from '../../domain';
import { useI18n } from '../../i18n';

const DOC_LABELS = {
  CERTIDAO_COMERCIAL: 'Certidão Comercial',
  ALVARA_COMERCIAL: 'Alvará Comercial',
  LICENCA_ANPG: 'Licença da ANPG',
};

export default function DueDiligence() {
  const { t } = useI18n();
  const [companies, setCompanies] = useState(null);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  function load() {
    api.get('/api/companies', { status: 'PENDENTE' }).then(setCompanies).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  if (error && !companies) return <ErrorBanner message={error} />;
  if (!companies) return <Loading />;

  return (
    <div>
      <PageHeader title="Cadastro de Empresas (Due Diligence)" subtitle="Reveja e aprove ou rejeite o cadastro de compradores e fornecedores." />

      {companies.length === 0 ? (
        <div className="empty-state">
          <h3>{t('Nenhum cadastro pendente')}</h3>
          <p>Novos registos de empresa aparecem aqui para revisão.</p>
        </div>
      ) : (
        companies.map((company) => (
          <CompanyReviewCard
            key={company.id}
            company={company}
            expanded={expandedId === company.id}
            onToggle={() => setExpandedId(expandedId === company.id ? null : company.id)}
            onDecided={load}
          />
        ))
      )}
    </div>
  );
}

function CompanyReviewCard({ company, expanded, onToggle, onDecided }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (expanded && !detail) {
      api.get(`/api/companies/${company.id}`).then(setDetail).catch((e) => setError(e.message));
    }
  }, [expanded, detail, company.id]);

  async function decide(approve) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api.patch(`/api/companies/${company.id}/decision`, { approve });
      setSuccess(approve ? 'Empresa aprovada.' : 'Cadastro rejeitado.');
      onDecided();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const supplierPolicy = detail?.supplierPolicies?.[0];
  const canApprove = company.type === 'CLIENTE' || Boolean(supplierPolicy);

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div
        className="card-pad row-link"
        onClick={onToggle}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div>
          <strong>{company.name}</strong>
          <div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginTop: 2 }}>
            {company.type === 'CLIENTE' ? 'Cliente' : 'Fornecedor'} · NIF {company.taxId} · {company.contactEmail}
          </div>
        </div>
        <Badge tone={COMPANY_STATUS[company.status]?.tone}>{COMPANY_STATUS[company.status]?.label}</Badge>
      </div>

      {expanded && (
        <div className="card-pad" style={{ borderTop: '1px solid var(--line)' }}>
          <ErrorBanner message={error} />
          <SuccessBanner message={success} />

          {!detail ? (
            <Loading />
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <strong style={{ fontSize: 13 }}>Documentos de credenciamento</strong>
                {detail.documents?.length ? (
                  <div className="doc-list">
                    {detail.documents.map((doc) => (
                      <a key={doc.id} className="doc-item" href={doc.fileUrl} target="_blank" rel="noreferrer">
                        <Icon name="invoice" size={16} className="doc-ic" />
                        {DOC_LABELS[doc.type] || doc.type}
                        <span className="doc-name">{doc.originalName}</span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="helptext" style={{ marginTop: 6 }}>Nenhum documento anexado no cadastro.</p>
                )}
              </div>

              {company.type === 'FORNECEDOR' && (
                <div style={{ marginBottom: 16 }}>
                  <strong style={{ fontSize: 13 }}>Apólice Fornecedor→KIXIMA</strong>
                  {supplierPolicy ? (
                    <div style={{ marginTop: 8, fontSize: 13, display: 'grid', gap: 4 }}>
                      <span>Nº <span className="mono">{supplierPolicy.policyNumber}</span> — {supplierPolicy.insurer}</span>
                      <span>Cobertura: {formatMoney(supplierPolicy.coverageAmount, supplierPolicy.currency)}</span>
                      <span>Válida: {formatDate(supplierPolicy.validFrom)} — {formatDate(supplierPolicy.validUntil)}</span>
                      {supplierPolicy.documentUrl ? (
                        <a className="doc-item" href={supplierPolicy.documentUrl} target="_blank" rel="noreferrer" style={{ marginTop: 4 }}>
                          <Icon name="invoice" size={16} className="doc-ic" />
                          Documento da apólice
                        </a>
                      ) : null}
                      <span><Badge tone={POLICY_STATUS[supplierPolicy.status]?.tone}>{POLICY_STATUS[supplierPolicy.status]?.label}</Badge></span>
                    </div>
                  ) : (
                    <p className="helptext" style={{ marginTop: 6 }}>
                      Ainda não submetida. Não é possível aprovar o fornecedor sem esta apólice.
                    </p>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-accent" disabled={busy || !canApprove} onClick={() => decide(true)}>
                  Aprovar empresa
                </button>
                <button className="btn btn-danger" disabled={busy} onClick={() => decide(false)}>
                  Rejeitar cadastro
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
