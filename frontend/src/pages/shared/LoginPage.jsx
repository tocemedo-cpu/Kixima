// src/pages/shared/LoginPage.jsx
import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ROLE_HOME } from '../../domain';
import AuthHero from '../../components/AuthHero';
import { useI18n } from '../../i18n';

export default function LoginPage() {
  const { user, login } = useAuth();
  const { t } = useI18n();
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
      <AuthHero />

      <div className="login-panel">
        <div className="login-card">
          <h2>{t('Entrar')}</h2>
          <p>{t('Aceda com a sua conta KIXIMA.')}</p>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">{t('Email')}</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.co.ao" />
            </div>
            <div className="field">
              <label htmlFor="password">{t('Palavra-passe')}</label>
              <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {error ? <p className="error-text" style={{ marginBottom: 12 }}>{error}</p> : null}
            <button className="btn btn-accent" type="submit" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? t('A entrar…') : t('Entrar')}
            </button>
          </form>

          <p className="helptext" style={{ marginTop: 16 }}>
            {t('A sua empresa ainda não está na KIXIMA?')}{' '}
            <Link to="/cadastro" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>{t('Registe-a aqui')}</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
