// src/pages/shared/PasswordReset.jsx
// Recuperação de senha ("Esqueci a senha"). Duas fases na mesma página:
//   /recuperar          — pede o email e envia o link (resposta sempre genérica,
//                         nunca revela se a conta existe).
//   /recuperar/:token   — o link do email abre aqui; o utilizador define a nova
//                         senha (token de uso único, válido 1 hora).
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import AuthHero from '../../components/AuthHero';

export default function PasswordReset() {
  const { token } = useParams();
  return (
    <div className="login-screen">
      <AuthHero />
      <div className="login-panel">
        <div className="login-card">
          {token ? <NewPasswordForm token={token} /> : <RequestForm />}
        </div>
      </div>
    </div>
  );
}

// Fase 1 — pedir o link por email.
function RequestForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/api/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.message || 'Não foi possível enviar o pedido.');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <>
        <h2>Verifique o seu email</h2>
        <p>
          Se <strong>{email}</strong> existir na plataforma, enviámos um link para redefinir a
          senha. O link é válido por 1 hora.
        </p>
        <p className="helptext" style={{ marginTop: 12 }}>
          Não recebeu? Verifique o spam ou <button type="button" className="pf-link" onClick={() => setSent(false)}>tente novamente</button>.
        </p>
        <p className="helptext" style={{ marginTop: 16 }}>
          <Link to="/login" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>← Voltar ao login</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h2>Recuperar senha</h2>
      <p>Indique o email da sua conta e enviamos-lhe um link para definir uma nova senha.</p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.co.ao" />
        </div>
        {error ? <p className="error-text" style={{ marginBottom: 12 }}>{error}</p> : null}
        <button className="btn btn-accent" type="submit" disabled={submitting} style={{ width: '100%' }}>
          {submitting ? 'A enviar…' : 'Enviar link de recuperação'}
        </button>
      </form>
      <p className="helptext" style={{ marginTop: 16 }}>
        <Link to="/login" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>← Voltar ao login</Link>
      </p>
    </>
  );
}

// Fase 2 — definir a nova senha com o token do email.
function NewPasswordForm({ token }) {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    setSubmitting(true);
    try {
      await api.post('/api/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      setError(err.message || 'Não foi possível redefinir a senha.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <>
        <h2>Senha redefinida ✓</h2>
        <p>A sua nova senha já está ativa. Vamos levá-lo ao login…</p>
        <p className="helptext" style={{ marginTop: 16 }}>
          <Link to="/login" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>Ir para o login agora</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h2>Definir nova senha</h2>
      <p>Escolha a nova senha da sua conta KIXIMA (mínimo 8 caracteres).</p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="password">Nova senha</label>
          <input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirmar nova senha</label>
          <input id="confirm" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
        </div>
        {error ? (
          <p className="error-text" style={{ marginBottom: 12 }}>
            {error}{/expirado|utilizado|inválido/i.test(error) ? <> — <Link to="/recuperar" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>pedir novo link</Link></> : null}
          </p>
        ) : null}
        <button className="btn btn-accent" type="submit" disabled={submitting} style={{ width: '100%' }}>
          {submitting ? 'A guardar…' : 'Redefinir senha'}
        </button>
      </form>
    </>
  );
}
