// src/pages/adminSistema/Companies.jsx
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner } from '../../components/Common';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import { COMPANY_STATUS, formatDate } from '../../domain';
import { useI18n } from '../../i18n';

export default function Companies() {
  const { t } = useI18n();
  const [companies, setCompanies] = useState(null);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api
      .get('/api/companies', { type: typeFilter || undefined, status: statusFilter || undefined })
      .then(setCompanies)
      .catch((e) => setError(e.message));
  }, [typeFilter, statusFilter]);

  return (
    <div>
      <PageHeader title="Empresas" subtitle="Lista de empresas credenciadas, estado e tipo." />
      <ErrorBanner message={error} />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div className="field" style={{ maxWidth: 200 }}>
          <select aria-label={t('Filtrar por tipo')} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">{t('Todos os tipos')}</option>
            <option value="CLIENTE">{t('Cliente')}</option>
            <option value="FORNECEDOR">{t('Fornecedor')}</option>
          </select>
        </div>
        <div className="field" style={{ maxWidth: 220 }}>
          <select aria-label={t('Filtrar por estado')} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t('Todos os estados')}</option>
            {Object.entries(COMPANY_STATUS).map(([key, val]) => (
              <option key={key} value={key}>{t(val.label)}</option>
            ))}
          </select>
        </div>
      </div>

      {!companies ? (
        <Loading />
      ) : (
        <div className="card">
          <DataTable
            rows={companies}
            rowKey="id"
            onRowClick={(row) => setExpanded(expanded === row.id ? null : row.id)}
            emptyTitle="Nenhuma empresa encontrada"
            emptyBody="Ajuste os filtros ou aguarde novos cadastros."
            columns={[
              { key: 'name', header: 'Empresa', render: (r) => <strong>{r.name}</strong> },
              { key: 'type', header: 'Tipo', render: (r) => (r.type === 'CLIENTE' ? t('Cliente') : t('Fornecedor')) },
              { key: 'taxId', header: 'NIF', render: (r) => <span className="mono">{r.taxId}</span> },
              { key: 'status', header: 'Estado', render: (r) => <Badge tone={COMPANY_STATUS[r.status]?.tone}>{COMPANY_STATUS[r.status]?.label}</Badge> },
              { key: 'createdAt', header: 'Cadastrada em', render: (r) => formatDate(r.createdAt) },
            ]}
          />
        </div>
      )}

      {expanded && <CompanyDetail id={expanded} />}
    </div>
  );
}

function CompanyDetail({ id }) {
  const { t } = useI18n();
  const [company, setCompany] = useState(null);

  useEffect(() => {
    api.get(`/api/companies/${id}`).then(setCompany).catch(() => {});
  }, [id]);

  if (!company) return null;

  return (
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <strong style={{ fontSize: 13.5 }}>{company.name}</strong>
      <div style={{ marginTop: 12, display: 'grid', gap: 8, fontSize: 13 }}>
        <span>{t('Contacto')}: {company.contactEmail} {company.contactPhone ? `· ${company.contactPhone}` : ''}</span>
        {company.address ? <span>{t('Morada')}: {company.address}</span> : null}
        <span>{t('Apólices Fornecedor→KIXIMA')}: {company.supplierPolicies?.length || 0}</span>
        <span>{t('Apólices KIXIMA→Cliente')}: {company.clientPolicies?.length || 0}</span>
      </div>
    </div>
  );
}
