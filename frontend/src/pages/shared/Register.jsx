// src/pages/shared/Register.jsx
// Cadastro público de empresa (primeiro passo do onboarding). A due diligence
// e a criação do primeiro utilizador da empresa são feitas pela equipa KIXIMA
// depois deste registo — ver kixima-especificacao-funcional.md, secção 4.1.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import Logo from '../../components/Logo';

const EMPTY_FORM = { name: '', taxId: '', type: 'CLIENTE', contactEmail: '', contactPhone: '', address: '' };

export default function Register() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const company = await api.post('/api/companies/register', form);
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
        <Logo size={26} subtitle light />
        <div>
          <h1 className="login-hero-title">Due diligence uma vez. Confiança em cada transação.</h1>
          <p className="login-hero-body">
            Registe a sua empresa como Cliente (operadora/prestadora) ou Fornecedora. A equipa
            KIXIMA faz a verificação e entra em contacto para ativar o acesso.
          </p>
        </div>
        <div style={{ fontSize: 12, color: 'var(--navy-100)' }}>Angola / África — setor Oil &amp; Gas</div>
      </div>

      <div className="login-panel">
        <div className="login-card">
          {done ? (
            <div>
              <h2>Cadastro submetido</h2>
              <p>
                O cadastro de <strong>{done.name}</strong> foi recebido e está{' '}
                <strong>pendente de due diligence</strong>. A KIXIMA entrará em contacto por{' '}
                {done.contactEmail} assim que for aprovado — se a empresa for fornecedora, será também
                pedida a apólice Fornecedor→KIXIMA nessa altura.
              </p>
              <Link className="btn btn-ghost" to="/login" style={{ marginTop: 18, display: 'inline-flex' }}>
                Voltar ao login
              </Link>
            </div>
          ) : (
            <>
              <h2>Cadastro de empresa</h2>
              <p>Primeiro passo do onboarding na KIXIMA.</p>
              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label>Tipo de empresa</label>
                  <select value={form.type} onChange={(e) => update('type', e.target.value)}>
                    <option value="CLIENTE">Cliente (operadora/prestadora)</option>
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
                  <label>Email de contacto</label>
                  <input type="email" required value={form.contactEmail} onChange={(e) => update('contactEmail', e.target.value)} />
                </div>
                <div className="field">
                  <label>Telefone (opcional)</label>
                  <input value={form.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} />
                </div>
                <div className="field">
                  <label>Morada (opcional)</label>
                  <input value={form.address} onChange={(e) => update('address', e.target.value)} />
                </div>
                {error ? <p className="error-text" style={{ marginBottom: 12 }}>{error}</p> : null}
                <button className="btn btn-accent" type="submit" disabled={submitting} style={{ width: '100%' }}>
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
