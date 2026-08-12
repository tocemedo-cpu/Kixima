// src/pages/shared/LoginPage.jsx
import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ROLE_HOME } from '../../domain';
import AuthHero from '../../components/AuthHero';
import { Icon } from '../../components/icons';
import { useI18n, LANGS } from '../../i18n';

export default function LoginPage() {
  const { user, login, verify2fa } = useAuth();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // 2FA: quando o login devolve um desafio, mostra-se o passo do código.
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');

  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await login(email, password);
      if (result?.requires2fa) {
        setChallenge(result.challenge);
        return;
      }
      navigate(ROLE_HOME[result.role], { replace: true });
    } catch (err) {
      setError(err.message || 'Não foi possível entrar.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const loggedUser = await verify2fa(challenge, code.trim());
      navigate(ROLE_HOME[loggedUser.role], { replace: true });
    } catch (err) {
      setError(err.message || 'Código incorreto.');
      // Desafio expirado → recomeça do início.
      if (/expirado|inválid/i.test(err.message || '')) {
        setChallenge('');
        setCode('');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <AuthHero />

      <div className="login-panel">
        <div className="login-card">
          {challenge ? (
            <>
              <h2>{t('Verificação em dois passos')}</h2>
              <p>{t('Introduza o código de 6 dígitos da sua app de autenticação.')}</p>
              <form onSubmit={handleVerify}>
                <div className="field">
                  <label htmlFor="totp">{t('Código')}</label>
                  <input
                    id="totp"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="000000"
                  />
                </div>
                {error ? <p className="error-text" style={{ marginBottom: 12 }}>{error}</p> : null}
                <button className="btn btn-accent" type="submit" disabled={submitting || code.trim().length !== 6} style={{ width: '100%' }}>
                  {submitting ? t('A entrar…') : t('Verificar e entrar')}
                </button>
                <p style={{ marginTop: 10, textAlign: 'right' }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setChallenge(''); setCode(''); setError(''); }}>
                    {t('← Voltar ao login')}
                  </button>
                </p>
              </form>
            </>
          ) : (
          <>
          <h2>{t('Entrar')}</h2>
          <p>{t('Aceda com a sua conta KIXIMA.')}</p>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">{t('Email')}</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('voce@empresa.co.ao')} />
            </div>
            <div className="field">
              <label htmlFor="password">{t('Palavra-passe')}</label>
              <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {error ? <p className="error-text" style={{ marginBottom: 12 }}>{error}</p> : null}
            <button className="btn btn-accent" type="submit" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? t('A entrar…') : t('Entrar')}
            </button>
            <p style={{ marginTop: 10, textAlign: 'right' }}>
              <Link to="/recuperar" style={{ color: 'var(--brand-600)', fontWeight: 600, fontSize: 13 }}>{t('Esqueceu a senha?')}</Link>
            </p>
          </form>
          </>
          )}

          <p className="helptext" style={{ marginTop: 16 }}>
            {t('A sua empresa ainda não está na KIXIMA?')}{' '}
            <Link to="/cadastro" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>{t('Registe-a aqui')}</Link>.
          </p>
          {/* Programas KIXIMA — logo abaixo do registo, acessíveis sem conta.
              Duas portas de entrada distintas; cada formulário permite pedir
              também o outro programa. */}
          <div className="login-programs">
            <Link className="login-program" to="/supplier-development">
              <span className="login-program-ico"><Icon name="suppliers" size={16} /></span>
              <span>
                <strong>{t('Supplier Development')}</strong>
                <span>{t('Apoio no processo burocrático para se tornar fornecedor credenciado')}</span>
              </span>
            </Link>
            <Link className="login-program" to="/parcerias">
              <span className="login-program-ico"><Icon name="offshore" size={16} /></span>
              <span>
                <strong>{t('Parceiros internacionais')}</strong>
                <span>{t('Procura de parceiros estrangeiros para tecnologia e capacitação')}</span>
              </span>
            </Link>
            <Link className="login-program" to="/planos">
              <span className="login-program-ico"><Icon name="wallet" size={16} /></span>
              <span>
                <strong>{t('Planos e preços')}</strong>
                <span>{t('Básico e Pro — taxas por transação e acesso por utilizador')}</span>
              </span>
            </Link>
          </div>

          <p className="helptext" style={{ marginTop: 10, fontSize: 11.5 }}>
            <Link to="/termos" style={{ color: 'inherit' }}>{t('Termos de Uso')}</Link>
            {' · '}
            <Link to="/privacidade" style={{ color: 'inherit' }}>{t('Política de Privacidade')}</Link>
          </p>
          <div className="login-langs" role="group" aria-label={t('Idioma')}>
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                className={`login-lang${l.code === lang ? ' on' : ''}`}
                onClick={() => setLang(l.code)}
              >
                {l.flag} {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
