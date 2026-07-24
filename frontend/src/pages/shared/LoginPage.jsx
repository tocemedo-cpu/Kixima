// src/pages/shared/LoginPage.jsx
import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ROLE_HOME } from '../../domain';
import Logo from '../../components/Logo';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const loggedUser = await login(email, password);
      navigate(ROLE_HOME[loggedUser.role], { replace: true });
    } catch (err) {
      setError(err.message || 'Não foi possível entrar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-hero">
        <Logo size={30} mark={72} subtitle light />
        <div>
          <h1 className="login-hero-title">
            O fornecedor recebe em <span className="accent">7 dias</span>. Antes mesmo de entregar.
          </h1>
          <p className="login-hero-body">
            E-market com pagamento garantido para o setor petrolífero e de gás em Angola. Due
            diligence, garantia de pagamento e apólice de seguro — para que o comprador nunca
            precise de confiar às cegas, e o fornecedor nunca precise de esperar 90 dias.
          </p>
          <div className="login-hero-flow">
            {['Cesta', 'PO emitida', 'Aprovação', 'Aceitação', 'Fatura', 'Pagamento ≤ 7 dias', 'Execução', 'Receção'].map((step) => (
              <span key={step} className="login-hero-step">{step}</span>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--navy-100)' }}>Angola / África — setor Oil &amp; Gas</div>
      </div>

      <div className="login-panel">
        <div className="login-card">
          <h2>Entrar</h2>
          <p>Aceda com a sua conta KIXIMA.</p>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.co.ao" />
            </div>
            <div className="field">
              <label htmlFor="password">Palavra-passe</label>
              <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {error ? <p className="error-text" style={{ marginBottom: 12 }}>{error}</p> : null}
            <button className="btn btn-accent" type="submit" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? 'A entrar…' : 'Entrar'}
            </button>
          </form>

          <p className="helptext" style={{ marginTop: 16 }}>
            A sua empresa ainda não está na KIXIMA?{' '}
            <Link to="/cadastro" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>Registe-a aqui</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
