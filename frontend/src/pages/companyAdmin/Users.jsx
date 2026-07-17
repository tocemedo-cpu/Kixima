// src/pages/companyAdmin/Users.jsx
import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { PageHeader, ErrorBanner, SuccessBanner } from '../../components/Common';
import { ROLE_LABELS } from '../../domain';

const ASSIGNABLE_ROLES = ['COMPRADOR', 'COMPANY_ADMIN', 'FINANCEIRO'];

export default function Users() {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'COMPRADOR' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await api.post('/api/companies/users', { ...form, companyId: user.companyId });
      setSuccess(`Utilizador ${form.name} criado com o perfil ${ROLE_LABELS[form.role]}.`);
      setForm({ name: '', email: '', password: '', role: 'COMPRADOR' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Utilizadores & Perfis" subtitle="Crie e atribua perfis aos utilizadores da sua empresa." />

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <div className="card card-pad" style={{ maxWidth: 460 }}>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nome completo</label>
            <input required value={form.name} onChange={(e) => update('name', e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} />
          </div>
          <div className="field">
            <label>Palavra-passe temporária</label>
            <input type="password" required minLength={8} value={form.password} onChange={(e) => update('password', e.target.value)} />
          </div>
          <div className="field">
            <label>Perfil</label>
            <select value={form.role} onChange={(e) => update('role', e.target.value)}>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-accent" disabled={submitting} type="submit">
            {submitting ? 'A criar…' : 'Criar utilizador'}
          </button>
        </form>
      </div>
    </div>
  );
}
