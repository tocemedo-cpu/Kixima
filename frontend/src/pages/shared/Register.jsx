// src/pages/shared/Register.jsx
// Cadastro público de empresa (onboarding). Cria a empresa (PENDENTE) + a conta
// do Company Admin (com senha, para entrar após a aprovação) e envia os
// documentos de credenciamento exigidos por tipo de empresa (secção 4.1).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import AuthHero from '../../components/AuthHero';
import { useI18n } from '../../i18n';

const EMPTY_FORM = {
  type: 'CLIENTE',
  employees: '',
  annualRevenueUsd: '',
  name: '',
  taxId: '',
  contactEmail: '',
  contactPhone: '',
  address: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
  // Apólice de seguro Fornecedor→KIXIMA (só fornecedoras).
  insurer: '',
  policyNumber: '',
  coverageAmount: '',
  policyCurrency: 'AOA',
  policyValidFrom: '',
  policyValidUntil: '',
};

// Documentos obrigatórios por tipo (tem de espelhar o backend).
const REQUIRED_DOCS = {
  CLIENTE: [
    { type: 'CERTIDAO_COMERCIAL', label: 'Certidão Comercial' },
    { type: 'ALVARA_COMERCIAL', label: 'Alvará Comercial' },
  ],
  FORNECEDOR: [
    { type: 'ALVARA_COMERCIAL', label: 'Alvará Comercial' },
    { type: 'LICENCA_ANPG', label: 'Licença da ANPG' },
    { type: 'CERTIDAO_COMERCIAL', label: 'Certidão Comercial' },
  ],
};

export default function Register() {
  const { t } = useI18n();
  const [form, setForm] = useState(EMPTY_FORM);
  const [docs, setDocs] = useState({}); // { [type]: File }
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const requiredDocs = REQUIRED_DOCS[form.type] || [];

  const isSupplier = form.type === 'FORNECEDOR';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Validar documentos obrigatórios antes de submeter.
    const missing = requiredDocs.filter((d) => !docs[d.type]);
    if (missing.length) {
      setError(t('Anexe os documentos: {docs}.', { docs: missing.map((d) => t(d.label)).join(', ') }));
      return;
    }
    if (isSupplier && !docs.APOLICE_SEGURO) {
      setError(t('Anexe o documento da apólice de seguro (Fornecedor→KIXIMA).'));
      return;
    }

    if (!termsAccepted) {
      setError(t('É necessário aceitar os Termos de Uso e a Política de Privacidade.'));
      return;
    }

    const fd = new FormData();
    const companyFields = ['type', 'name', 'taxId', 'contactEmail', 'contactPhone', 'address', 'adminName', 'adminEmail', 'adminPassword', 'employees', 'annualRevenueUsd'];
    companyFields.forEach((k) => fd.append(k, form[k]));
    fd.append('termsAccepted', 'true');
    requiredDocs.forEach((d) => docs[d.type] && fd.append(d.type, docs[d.type]));

    // Campos da apólice só para fornecedoras (evita quebrar a validação do cliente).
    if (isSupplier) {
      ['insurer', 'policyNumber', 'coverageAmount', 'policyCurrency', 'policyValidFrom', 'policyValidUntil'].forEach((k) => fd.append(k, form[k]));
      fd.append('APOLICE_SEGURO', docs.APOLICE_SEGURO);
    }

    setSubmitting(true);
    try {
      const company = await api.postForm('/api/companies/register', fd);
      setDone(company);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <AuthHero />

      <div className="login-panel">
        <div className="login-card" style={{ maxWidth: 440 }}>
          {done ? (
            <div>
              <h2>{t('Cadastro submetido')}</h2>
              <p>
                {t('O cadastro de')} <strong>{done.name}</strong> {t('foi recebido e está')}{' '}
                <strong>{t('pendente de aprovação (due diligence)')}</strong>. {t('Assim que a KIXIMA aprovar, poderá entrar com o email e a senha que definiu para o administrador.')}
              </p>
              <Link className="btn btn-ghost" to="/login" style={{ marginTop: 18, display: 'inline-flex' }}>
                {t('Voltar ao login')}
              </Link>
            </div>
          ) : (
            <>
              <h2>{t('Cadastro de empresa')}</h2>
              <p>{t('Onboarding na KIXIMA — dados, conta de administrador e documentos.')}</p>
              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label>{t('Tipo de empresa')}</label>
                  <select value={form.type} onChange={(e) => update('type', e.target.value)}>
                    <option value="CLIENTE">{t('Cliente (operadora)')}</option>
                    <option value="FORNECEDOR">{t('Fornecedora')}</option>
                  </select>
                </div>
                <div className="field">
                  <label>{t('Nome da empresa')}</label>
                  <input required value={form.name} onChange={(e) => update('name', e.target.value)} />
                </div>
                <div className="field">
                  <label>{t('NIF')}</label>
                  <input required value={form.taxId} onChange={(e) => update('taxId', e.target.value)} />
                </div>
                <div className="field">
                  <label>{t('Email de contacto da empresa')}</label>
                  <input type="email" required value={form.contactEmail} onChange={(e) => update('contactEmail', e.target.value)} />
                </div>
                <div className="grid-cols grid-2">
                  <div className="field">
                    <label>{t('Telefone (opcional)')}</label>
                    <input value={form.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>{t('Morada (opcional)')}</label>
                    <input value={form.address} onChange={(e) => update('address', e.target.value)} />
                  </div>
                </div>

                <div className="reg-section">{t('Conta de administrador')}</div>
                <div className="field">
                  <label>{t('Nome do administrador')}</label>
                  <input required value={form.adminName} onChange={(e) => update('adminName', e.target.value)} />
                </div>
                <div className="grid-cols grid-2">
                  <div className="field">
                    <label>{t('Email (login)')}</label>
                    <input type="email" required value={form.adminEmail} onChange={(e) => update('adminEmail', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>{t('Senha (mín. 12)')}</label>
                    <input type="password" required minLength={12} value={form.adminPassword} onChange={(e) => update('adminPassword', e.target.value)} />
                  </div>
                </div>

                <div className="reg-section">{t('Documentos de credenciamento')}</div>
                {requiredDocs.map((d) => (
                  <div className="field" key={d.type}>
                    <label>{t(d.label)} <span style={{ color: 'var(--brand-600)' }}>*</span></label>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(e) => setDocs((prev) => ({ ...prev, [d.type]: e.target.files[0] || undefined }))}
                    />
                    {docs[d.type] ? <small className="helptext">✓ {docs[d.type].name}</small> : null}
                  </div>
                ))}
                <small className="helptext">{t('PDF ou imagem, até 10 MB cada.')}</small>

                {isSupplier ? (
                  <>
                    <div className="reg-section">{t('Apólice de seguro (Fornecedor → KIXIMA)')}</div>
                    <p className="helptext" style={{ marginTop: -6, marginBottom: 10 }}>
                      {t('Obrigatória no credenciamento de fornecedoras — garante a cobertura das transações realizadas na plataforma.')}
                    </p>
                    <div className="grid-cols grid-2">
                      <div className="field">
                        <label>{t('Seguradora')} <span style={{ color: 'var(--brand-600)' }}>*</span></label>
                        <input required value={form.insurer} onChange={(e) => update('insurer', e.target.value)} />
                      </div>
                      <div className="field">
                        <label>{t('Nº da apólice')} <span style={{ color: 'var(--brand-600)' }}>*</span></label>
                        <input required value={form.policyNumber} onChange={(e) => update('policyNumber', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid-cols grid-2">
                      <div className="field">
                        <label>{t('Cobertura')} <span style={{ color: 'var(--brand-600)' }}>*</span></label>
                        <input type="number" min="0" step="any" required value={form.coverageAmount} onChange={(e) => update('coverageAmount', e.target.value)} />
                      </div>
                      <div className="field">
                        <label>{t('Moeda')}</label>
                        <select value={form.policyCurrency} onChange={(e) => update('policyCurrency', e.target.value)}>
                          <option value="AOA">AOA</option>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid-cols grid-2">
                      <div className="field">
                        <label>{t('Válida de')} <span style={{ color: 'var(--brand-600)' }}>*</span></label>
                        <input type="date" required value={form.policyValidFrom} onChange={(e) => update('policyValidFrom', e.target.value)} />
                      </div>
                      <div className="field">
                        <label>{t('Válida até')} <span style={{ color: 'var(--brand-600)' }}>*</span></label>
                        <input type="date" required value={form.policyValidUntil} onChange={(e) => update('policyValidUntil', e.target.value)} />
                      </div>
                    </div>
                    <div className="field">
                      <label>{t('Documento da apólice')} <span style={{ color: 'var(--brand-600)' }}>*</span></label>
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) => setDocs((prev) => ({ ...prev, APOLICE_SEGURO: e.target.files[0] || undefined }))}
                      />
                      {docs.APOLICE_SEGURO ? <small className="helptext">✓ {docs.APOLICE_SEGURO.name}</small> : null}
                    </div>
                  </>
                ) : null}

                {/* Dimensão da empresa — decide o plano (grandes empresas: PRO). */}
                <div className="grid-cols grid-2">
                  <div className="field">
                    <label>{t('Nº de trabalhadores')}</label>
                    <input type="number" min="0" value={form.employees} onChange={(e) => update('employees', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>{t('Volume de negócios anual (USD)')}</label>
                    <input type="number" min="0" step="1000" value={form.annualRevenueUsd} onChange={(e) => update('annualRevenueUsd', e.target.value)} />
                  </div>
                </div>
                <p className="helptext" style={{ marginTop: -4 }}>
                  {t('Serve para classificar a dimensão da empresa e o plano aplicável. Empresas de grande dimensão subscrevem o plano PRO.')}{' '}
                  <a href="/planos" target="_blank" rel="noreferrer" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>{t('Ver planos')}</a>
                </p>

                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 14, fontSize: 12.5, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    required
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    {t('Li e aceito, em nome da empresa, os')}{' '}
                    <a href="/termos" target="_blank" rel="noreferrer" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>{t('Termos de Uso')}</a>{' '}
                    {t('e a')}{' '}
                    <a href="/privacidade" target="_blank" rel="noreferrer" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>{t('Política de Privacidade')}</a>.
                  </span>
                </label>

                {error ? <p className="error-text" style={{ margin: '12px 0' }}>{error}</p> : null}
                <button className="btn btn-accent" type="submit" disabled={submitting || !termsAccepted} style={{ width: '100%', marginTop: 14 }}>
                  {submitting ? t('A submeter…') : t('Submeter cadastro')}
                </button>
              </form>
              <p className="helptext" style={{ marginTop: 16 }}>
                {t('Já tem uma conta?')} <Link to="/login" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>{t('Entrar')}</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
