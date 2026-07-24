// src/pages/shared/Register.jsx
// Cadastro público de empresa (onboarding). Cria a empresa (PENDENTE) + a conta
// do Company Admin (com senha, para entrar após a aprovação) e envia os
// documentos de credenciamento exigidos por tipo de empresa (secção 4.1).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import Logo from '../../components/Logo';

const EMPTY_FORM = {
  type: 'CLIENTE',
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
  const [form, setForm] = useState(EMPTY_FORM);
  const [docs, setDocs] = useState({}); // { [type]: File }
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const requiredDocs = REQUIRED_DOCS[form.type] || [];

  const isSupplier = form.type === 'FORNECEDOR';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Validar documentos obrigatórios antes de submeter.
    const missing = requiredDocs.filter((d) => !docs[d.type]);
    if (missing.length) {
      setError(`Anexe os documentos: ${missing.map((d) => d.label).join(', ')}.`);
      return;
    }
    if (isSupplier && !docs.APOLICE_SEGURO) {
      setError('Anexe o documento da apólice de seguro (Fornecedor→KIXIMA).');
      return;
    }

    const fd = new FormData();
    const companyFields = ['type', 'name', 'taxId', 'contactEmail', 'contactPhone', 'address', 'adminName', 'adminEmail', 'adminPassword'];
    companyFields.forEach((k) => fd.append(k, form[k]));
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
      <div className="login-hero">
        <Logo size={30} mark={72} subtitle light />
        <div>
          <h1 className="login-hero-title">Due diligence uma vez. Confiança em cada transação.</h1>
          <p className="login-hero-body">
            Registe a sua empresa como Cliente (operadora) ou Fornecedora, crie a conta de
            administrador e anexe os documentos de credenciamento. A equipa KIXIMA verifica e
            aprova o acesso.
          </p>
        </div>
        <div style={{ fontSize: 12, color: 'var(--navy-100)' }}>Angola / África — setor Oil &amp; Gas</div>
      </div>

      <div className="login-panel">
        <div className="login-card" style={{ maxWidth: 440 }}>
          {done ? (
            <div>
              <h2>Cadastro submetido</h2>
              <p>
                O cadastro de <strong>{done.name}</strong> foi recebido e está{' '}
                <strong>pendente de aprovação (due diligence)</strong>. Assim que a KIXIMA aprovar,
                poderá entrar com o email e a senha que definiu para o administrador.
              </p>
              <Link className="btn btn-ghost" to="/login" style={{ marginTop: 18, display: 'inline-flex' }}>
                Voltar ao login
              </Link>
            </div>
          ) : (
            <>
              <h2>Cadastro de empresa</h2>
              <p>Onboarding na KIXIMA — dados, conta de administrador e documentos.</p>
              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label>Tipo de empresa</label>
                  <select value={form.type} onChange={(e) => update('type', e.target.value)}>
                    <option value="CLIENTE">Cliente (operadora)</option>
                    <option value="FORNECEDOR">Fornecedora</option>
                  </select>
                </div>
                <div className="field">
                  <label>Nome da empresa</label>
                  <input required value={form.name} onChange={(e) => update('name', e.target.value)} />
                </div>
                <div className="field">
                  <label>NIF</label>
                  <input required value={form.taxId} onChange={(e) => update('taxId', e.target.value)} />
                </div>
                <div className="field">
                  <label>Email de contacto da empresa</label>
                  <input type="email" required value={form.contactEmail} onChange={(e) => update('contactEmail', e.target.value)} />
                </div>
                <div className="grid-cols grid-2">
                  <div className="field">
                    <label>Telefone (opcional)</label>
                    <input value={form.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Morada (opcional)</label>
                    <input value={form.address} onChange={(e) => update('address', e.target.value)} />
                  </div>
                </div>

                <div className="reg-section">Conta de administrador</div>
                <div className="field">
                  <label>Nome do administrador</label>
                  <input required value={form.adminName} onChange={(e) => update('adminName', e.target.value)} />
                </div>
                <div className="grid-cols grid-2">
                  <div className="field">
                    <label>Email (login)</label>
                    <input type="email" required value={form.adminEmail} onChange={(e) => update('adminEmail', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Senha (mín. 8)</label>
                    <input type="password" required minLength={8} value={form.adminPassword} onChange={(e) => update('adminPassword', e.target.value)} />
                  </div>
                </div>

                <div className="reg-section">Documentos de credenciamento</div>
                {requiredDocs.map((d) => (
                  <div className="field" key={d.type}>
                    <label>{d.label} <span style={{ color: 'var(--brand-600)' }}>*</span></label>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(e) => setDocs((prev) => ({ ...prev, [d.type]: e.target.files[0] || undefined }))}
                    />
                    {docs[d.type] ? <small className="helptext">✓ {docs[d.type].name}</small> : null}
                  </div>
                ))}
                <small className="helptext">PDF ou imagem, até 10 MB cada.</small>

                {isSupplier ? (
                  <>
                    <div className="reg-section">Apólice de seguro (Fornecedor → KIXIMA)</div>
                    <p className="helptext" style={{ marginTop: -6, marginBottom: 10 }}>
                      Obrigatória no credenciamento de fornecedoras — garante a cobertura das
                      transações realizadas na plataforma.
                    </p>
                    <div className="grid-cols grid-2">
                      <div className="field">
                        <label>Seguradora <span style={{ color: 'var(--brand-600)' }}>*</span></label>
                        <input required value={form.insurer} onChange={(e) => update('insurer', e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Nº da apólice <span style={{ color: 'var(--brand-600)' }}>*</span></label>
                        <input required value={form.policyNumber} onChange={(e) => update('policyNumber', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid-cols grid-2">
                      <div className="field">
                        <label>Cobertura <span style={{ color: 'var(--brand-600)' }}>*</span></label>
                        <input type="number" min="0" step="any" required value={form.coverageAmount} onChange={(e) => update('coverageAmount', e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Moeda</label>
                        <select value={form.policyCurrency} onChange={(e) => update('policyCurrency', e.target.value)}>
                          <option value="AOA">AOA</option>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid-cols grid-2">
                      <div className="field">
                        <label>Válida de <span style={{ color: 'var(--brand-600)' }}>*</span></label>
                        <input type="date" required value={form.policyValidFrom} onChange={(e) => update('policyValidFrom', e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Válida até <span style={{ color: 'var(--brand-600)' }}>*</span></label>
                        <input type="date" required value={form.policyValidUntil} onChange={(e) => update('policyValidUntil', e.target.value)} />
                      </div>
                    </div>
                    <div className="field">
                      <label>Documento da apólice <span style={{ color: 'var(--brand-600)' }}>*</span></label>
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) => setDocs((prev) => ({ ...prev, APOLICE_SEGURO: e.target.files[0] || undefined }))}
                      />
                      {docs.APOLICE_SEGURO ? <small className="helptext">✓ {docs.APOLICE_SEGURO.name}</small> : null}
                    </div>
                  </>
                ) : null}

                {error ? <p className="error-text" style={{ margin: '12px 0' }}>{error}</p> : null}
                <button className="btn btn-accent" type="submit" disabled={submitting} style={{ width: '100%', marginTop: 14 }}>
                  {submitting ? 'A submeter…' : 'Submeter cadastro'}
                </button>
              </form>
              <p className="helptext" style={{ marginTop: 16 }}>
                Já tem uma conta? <Link to="/login" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>Entrar</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
