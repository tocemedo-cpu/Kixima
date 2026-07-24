// src/pages/shared/Security.jsx
// Configurações → Segurança. Alteração da própria senha.
import { useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, ErrorBanner, SuccessBanner } from '../../components/Common';

export default function Security() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.newPassword.length < 8) return setError('A nova senha deve ter pelo menos 8 caracteres.');
    if (form.newPassword !== form.confirm) return setError('A confirmação não coincide com a nova senha.');
    setSaving(true);
    try {
      await api.patch('/api/auth/password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setSuccess('Senha alterada com sucesso.');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Segurança" subtitle="Altere a sua senha de acesso." />
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />
      <div className="card card-pad" style={{ maxWidth: 420 }}>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Senha atual</label>
            <input type="password" required value={form.currentPassword} onChange={(e) => update('currentPassword', e.target.value)} />
          </div>
          <div className="field">
            <label>Nova senha (mín. 8)</label>
            <input type="password" required minLength={8} value={form.newPassword} onChange={(e) => update('newPassword', e.target.value)} />
          </div>
          <div className="field">
            <label>Confirmar nova senha</label>
            <input type="password" required minLength={8} value={form.confirm} onChange={(e) => update('confirm', e.target.value)} />
          </div>
          <button className="btn btn-accent" type="submit" disabled={saving}>{saving ? 'A guardar…' : 'Alterar senha'}</button>
        </form>
      </div>
    </div>
  );
}
