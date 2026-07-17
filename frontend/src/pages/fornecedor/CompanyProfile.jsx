// src/pages/fornecedor/CompanyProfile.jsx
// Perfil da Empresa do Fornecedor. Também serve de Cadastro/Onboarding:
// enquanto a empresa não estiver aprovada, mostra o formulário de submissão
// da apólice Fornecedor→KIXIMA — condição para ser credenciado (secção 4.1).
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner, SuccessBanner } from '../../components/Common';
import Badge from '../../components/Badge';
import { COMPANY_STATUS, POLICY_STATUS, formatDate, formatMoney } from '../../domain';

const EMPTY_FORM = { policyNumber: '', insurer: '', coverageAmount: '', currency: 'AOA', validFrom: '', validUntil: '' };

export default function SupplierCompanyProfile() {
  const { user } = useAuth();
  const [company, setCompany] = useState(null);
  const [policies, setPolicies] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    Promise.all([
      api.get(`/api/companies/${user.companyId}`),
      api.get(`/api/policies/company/${user.companyId}`),
    ])
      .then(([c, p]) => {
        setCompany(c);
        setPolicies(p);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, [user.companyId]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await api.post('/api/policies/supplier-to-kixima', {
        ...form,
        coverageAmount: Number(form.coverageAmount),
      });
      setSuccess('Apólice submetida. A KIXIMA vai rever o seu cadastro.');
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !company) return <ErrorBanner message={error} />;
  if (!company || !policies) return <Loading />;

  const supplierPolicy = policies.supplierToKixima?.[0];
  const isPending = company.status === 'PENDENTE' || company.status === 'REJEITADA';

  return (
    <div>
      <PageHeader title="Perfil da Empresa" subtitle="Dados, documentos e estado do due diligence." />

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <div className="grid-cols grid-2" style={{ alignItems: 'start' }}>
        <div className="card card-pad">
          <strong style={{ fontSize: 13.5 }}>Dados da empresa</strong>
          <div style={{ marginTop: 14, display: 'grid', gap: 10, fontSize: 13.5 }}>
            <Row label="Nome">{company.name}</Row>
            <Row label="NIF">{company.taxId}</Row>
            <Row label="Contacto">{company.contactEmail}</Row>
            <Row label="Estado do cadastro">
              <Badge tone={COMPANY_STATUS[company.status]?.tone}>{COMPANY_STATUS[company.status]?.label}</Badge>
            </Row>
          </div>
        </div>

        <div className="card card-pad">
          <strong style={{ fontSize: 13.5 }}>Apólice Fornecedor→KIXIMA</strong>
          {supplierPolicy ? (
            <div style={{ marginTop: 14, display: 'grid', gap: 10, fontSize: 13.5 }}>
              <Row label="Nº da apólice"><span className="mono">{supplierPolicy.policyNumber}</span></Row>
              <Row label="Seguradora">{supplierPolicy.insurer}</Row>
              <Row label="Cobertura">{formatMoney(supplierPolicy.coverageAmount, supplierPolicy.currency)}</Row>
              <Row label="Validade">{formatDate(supplierPolicy.validFrom)} — {formatDate(supplierPolicy.validUntil)}</Row>
              <Row label="Estado"><Badge tone={POLICY_STATUS[supplierPolicy.status]?.tone}>{POLICY_STATUS[supplierPolicy.status]?.label}</Badge></Row>
            </div>
          ) : (
            <p className="helptext" style={{ marginTop: 12 }}>
              Ainda não submeteu a apólice Fornecedor→KIXIMA. É condição para ser credenciado e
              poder receber ordens de compra.
            </p>
          )}
        </div>
      </div>

      {isPending && !supplierPolicy && (
        <div className="card card-pad" style={{ marginTop: 16, maxWidth: 480 }}>
          <strong style={{ fontSize: 13.5 }}>Cadastro / Onboarding — submeter apólice</strong>
          <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
            <div className="field">
              <label>Nº da apólice</label>
              <input required value={form.policyNumber} onChange={(e) => update('policyNumber', e.target.value)} />
            </div>
            <div className="field">
              <label>Seguradora</label>
              <input required value={form.insurer} onChange={(e) => update('insurer', e.target.value)} />
            </div>
            <div className="grid-cols grid-2">
              <div className="field">
                <label>Cobertura (AOA)</label>
                <input required type="number" min="0" step="0.01" value={form.coverageAmount} onChange={(e) => update('coverageAmount', e.target.value)} />
              </div>
              <div className="field">
                <label>Válida até</label>
                <input required type="date" value={form.validUntil} onChange={(e) => update('validUntil', e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Válida a partir de</label>
              <input required type="date" value={form.validFrom} onChange={(e) => update('validFrom', e.target.value)} />
            </div>
            <button className="btn btn-accent" disabled={submitting} type="submit">
              {submitting ? 'A submeter…' : 'Submeter apólice'}
            </button>
          </form>
        </div>
      )}
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
