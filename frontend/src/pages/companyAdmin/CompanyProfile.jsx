// src/pages/companyAdmin/CompanyProfile.jsx
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner } from '../../components/Common';
import Badge from '../../components/Badge';
import { COMPANY_STATUS, POLICY_STATUS, formatDate, formatMoney } from '../../domain';
import { useI18n } from '../../i18n';

export default function CompanyProfile() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [company, setCompany] = useState(null);
  const [policies, setPolicies] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get(`/api/companies/${user.companyId}`),
      api.get(`/api/policies/company/${user.companyId}`),
    ])
      .then(([c, p]) => {
        setCompany(c);
        setPolicies(p);
      })
      .catch((e) => setError(e.message));
  }, [user.companyId]);

  if (error) return <ErrorBanner message={error} />;
  if (!company || !policies) return <Loading />;

  const clientPolicy = policies.kiximaToClient?.[0];

  return (
    <div>
      <PageHeader title="Perfil da Empresa" subtitle="Dados, contactos e apólice KIXIMA→Cliente." />

      <div className="grid-cols grid-2" style={{ alignItems: 'start' }}>
        <div className="card card-pad">
          <strong style={{ fontSize: 13.5 }}>{t('Dados da empresa')}</strong>
          <div style={{ marginTop: 14, display: 'grid', gap: 10, fontSize: 13.5 }}>
            <Row label={t('Nome')}>{company.name}</Row>
            <Row label={t('NIF')}>{company.taxId}</Row>
            <Row label={t('Tipo')}>{company.type === 'CLIENTE' ? t('Cliente') : t('Fornecedor')}</Row>
            <Row label={t('Estado do cadastro')}><Badge tone={COMPANY_STATUS[company.status]?.tone}>{COMPANY_STATUS[company.status]?.label}</Badge></Row>
            <Row label={t('Contacto')}>{company.contactEmail}</Row>
            {company.contactPhone ? <Row label={t('Telefone')}>{company.contactPhone}</Row> : null}
          </div>
        </div>

        <div className="card card-pad">
          <strong style={{ fontSize: 13.5 }}>{t('Apólice KIXIMA→Cliente')}</strong>
          {clientPolicy ? (
            <div style={{ marginTop: 14, display: 'grid', gap: 10, fontSize: 13.5 }}>
              <Row label={t('Nº da apólice')}><span className="mono">{clientPolicy.policyNumber}</span></Row>
              <Row label={t('Seguradora')}>{clientPolicy.insurer}</Row>
              <Row label={t('Cobertura')}>{formatMoney(clientPolicy.coverageAmount, clientPolicy.currency)}</Row>
              <Row label={t('Validade')}>{formatDate(clientPolicy.validFrom)} — {formatDate(clientPolicy.validUntil)}</Row>
              <Row label={t('Estado')}><Badge tone={POLICY_STATUS[clientPolicy.status]?.tone}>{POLICY_STATUS[clientPolicy.status]?.label}</Badge></Row>
            </div>
          ) : (
            <p className="helptext" style={{ marginTop: 12 }}>
              {t('Ainda não há apólice KIXIMA→Cliente emitida. Isto é feito pelo Admin do Sistema KIXIMA após a aprovação do cadastro.')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: 'var(--ink-400)' }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}
