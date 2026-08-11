// src/pages/shared/AcceptInvite.jsx
// Página pública de aceitação de convite. O Company Admin partilha um link
// (/convite/:token); o convidado preenche o próprio cadastro. A conta fica
// pendente até o Company Admin aceitar.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import Logo from '../../components/Logo';

// Rótulo do perfil no contexto da empresa (Vendedor = FORNECEDOR).
function roleLabel(role, companyType) {
  if (role === 'FORNECEDOR') return 'Vendedor';
  if (role === 'COMPRADOR') return 'Comprador';
  if (role === 'FINANCEIRO') return 'Financeiro';
  return role;
}

export default function AcceptInvite() {
  const { token } = useParams();
  const [invite, setInvite] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get(`/api/companies/invite/${token}`)
      .then((inv) => {
        setInvite(inv);
        // Convite novo já traz nome/email definidos pelo admin — pré-preenche.
        setForm((f) => ({ ...f, name: inv.name || f.name, email: inv.email || f.email }));
      })
      .catch((e) => setLoadError(e.message));
  }, [token]);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post(`/api/companies/invite/${token}/accept`, { ...form, termsAccepted: true });
      setDone(true);
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
          <h1 className="login-hero-title">Junte-se à equipa da sua empresa na KIXIMA.</h1>
          <p className="login-hero-body">
            Foi convidado para criar a sua conta. Preencha os seus dados; o administrador da
            empresa confirma o acesso e poderá entrar de seguida.
          </p>
        </div>
        <div style={{ fontSize: 12, color: 'var(--navy-100)' }}>Angola / África — setor Oil &amp; Gas</div>
      </div>

      <div className="login-panel">
        <div className="login-card" style={{ maxWidth: 420 }}>
          {loadError ? (
            <div>
              <h2>Convite inválido</h2>
              <p>{loadError} Peça um novo link ao administrador da sua empresa.</p>
              <Link className="btn btn-ghost" to="/login" style={{ marginTop: 18, display: 'inline-flex' }}>
                Ir para o login
              </Link>
            </div>
          ) : done ? (
            <div>
              <h2>Cadastro submetido</h2>
              <p>
                A sua conta foi criada e está <strong>pendente de aprovação</strong> pelo administrador
                da empresa. Assim que for aceite, poderá entrar com o email e a senha que definiu.
              </p>
              <Link className="btn btn-ghost" to="/login" style={{ marginTop: 18, display: 'inline-flex' }}>
                Ir para o login
              </Link>
            </div>
          ) : !invite ? (
            <p className="loading-text">A carregar convite…</p>
          ) : (
            <>
              <h2>Criar a minha conta</h2>
              <p>
                Convite para <strong>{invite.companyName}</strong> — perfil{' '}
                <strong>{roleLabel(invite.role, invite.companyType)}</strong>.
              </p>
              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label>Nome completo</label>
                  <input required value={form.name} onChange={(e) => update('name', e.target.value)} readOnly={!!invite.email} />
                </div>
                <div className="field">
                  <label>Email (login)</label>
                  <input type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} readOnly={!!invite.email} />
                </div>
                <div className="field">
                  <label>Senha (mín. 8)</label>
                  <input type="password" required minLength={8} value={form.password} onChange={(e) => update('password', e.target.value)} />
                </div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, fontSize: 12.5, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    required
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    Li e aceito os{' '}
                    <a href="/termos" target="_blank" rel="noreferrer" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>Termos de Uso</a>{' '}
                    e a{' '}
                    <a href="/privacidade" target="_blank" rel="noreferrer" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>Política de Privacidade</a>.
                  </span>
                </label>
                {error ? <p className="error-text" style={{ margin: '12px 0' }}>{error}</p> : null}
                <button className="btn btn-accent" type="submit" disabled={submitting || !termsAccepted} style={{ width: '100%', marginTop: 8 }}>
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
