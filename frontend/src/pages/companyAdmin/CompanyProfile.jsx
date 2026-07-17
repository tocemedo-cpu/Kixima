// src/pages/companyAdmin/CompanyProfile.jsx
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner } from '../../components/Common';
import Badge from '../../components/Badge';
import { COMPANY_STATUS, POLICY_STATUS, formatDate, formatMoney } from '../../domain';

export default function CompanyProfile() {
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
          <strong style={{ fontSize: 13.5 }}>Dados da empresa</strong>
          <div style={{ marginTop: 14, display: 'grid', gap: 10, fontSize: 13.5 }}>
            <Row label="Nome">{company.name}</Row>
            <Row label="NIF">{company.taxId}</Row>
            <Row label="Tipo">{company.type === 'CLIENTE' ? 'Cliente' : 'Fornecedor'}</Row>
            <Row label="Estado do cadastro"><Badge tone={COMPANY_STATUS[company.status]?.tone}>{COMPANY_STATUS[company.status]?.label}</Badge></Row>
            <Row label="Contacto">{company.contactEmail}</Row>
            {company.contactPhone ? <Row label="Telefone">{company.contactPhone}</Row> : null}
          </div>
        </div>

        <div className="card card-pad">
          <strong style={{ fontSize: 13.5 }}>Apólice KIXIMA→Cliente</strong>
          {clientPolicy ? (
            <div style={{ marginTop: 14, display: 'grid', gap: 10, fontSize: 13.5 }}>
              <Row label="Nº da apólice"><span className="mono">{clientPolicy.policyNumber}</span></Row>
              <Row label="Seguradora">{clientPolicy.insurer}</Row>
              <Row label="Cobertura">{formatMoney(clientPolicy.coverageAmount, clientPolicy.currency)}</Row>
              <Row label="Validade">{formatDate(clientPolicy.validFrom)} — {formatDate(clientPolicy.validUntil)}</Row>
              <Row label="Estado"><Badge tone={POLICY_STATUS[clientPolicy.status]?.tone}>{POLICY_STATUS[clientPolicy.status]?.label}</Badge></Row>
            </div>
          ) : (
            <p className="helptext" style={{ marginTop: 12 }}>
              Ainda não há apólice KIXIMA→Cliente emitida. Isto é feito pelo Admin do Sistema KIXIMA
              após a aprovação do cadastro.
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
