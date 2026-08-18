// src/pages/shared/AcceptAdminInvite.jsx
// Página pública de aceitação do convite de Assessor (ADMIN_SISTEMA). O Super
// Admin decide o nome, o email e as áreas ao criar o convite — o assessor só
// define a senha. As áreas aparecem aqui só para CONFIRMAR o que foi
// atribuído; não há forma de as alterar neste ecrã, nem no pedido que ele
// envia (o servidor ignora-as mesmo que alguém tente enviá-las à mão).
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import Logo from '../../components/Logo';
import { ADMIN_AREA_LABELS } from '../../domain';
import { useI18n } from '../../i18n';

export default function AcceptAdminInvite() {
  const { t } = useI18n();
  const { token } = useParams();
  const [invite, setInvite] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get(`/api/admin/invite/${token}`)
      .then(setInvite)
      .catch((e) => setLoadError(e.message));
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      // Só senha + aceite dos termos — mesmo que houvesse um campo de áreas
      // aqui, o servidor despe-o do pedido antes de o ler.
      await api.post(`/api/admin/invite/${token}/accept`, { password, termsAccepted: true });
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
          <h1 className="login-hero-title">{t('Acesso administrativo à KIXIMA.')}</h1>
          <p className="login-hero-body">
            {t('Foi convidado a ser Admin do Sistema. Defina a sua senha para ativar a conta.')}
          </p>
        </div>
        <div style={{ fontSize: 12, color: 'var(--navy-100)' }}>{t('Angola / África — setor Oil & Gas')}</div>
      </div>

      <div className="login-panel">
        <div className="login-card" style={{ maxWidth: 420 }}>
          {loadError ? (
            <div>
              <h2>{t('Convite inválido')}</h2>
              <p>{loadError} {t('Peça um novo convite a quem lhe deu acesso ao sistema.')}</p>
              <Link className="btn btn-ghost" to="/login" style={{ marginTop: 18, display: 'inline-flex' }}>
                {t('Ir para o login')}
              </Link>
            </div>
          ) : done ? (
            <div>
              <h2>{t('Conta ativada')}</h2>
              <p>
                {t('A sua conta de Admin do Sistema está ativa. Já pode entrar com o email e a senha que definiu.')}
              </p>
              <Link className="btn btn-accent" to="/login" style={{ marginTop: 18, display: 'inline-flex' }}>
                {t('Ir para o login')}
              </Link>
            </div>
          ) : !invite ? (
            <p className="loading-text">{t('A carregar convite…')}</p>
          ) : (
            <>
              <h2>{t('Ativar a minha conta')}</h2>
              <p>
                {t('Convite para')} <strong>{invite.name}</strong> ({invite.email}) — <strong>{t('Admin do Sistema KIXIMA')}</strong>.
              </p>
              <div className="chip-row" style={{ marginBottom: 18 }}>
                {invite.adminAreas.map((area) => (
                  <span key={area} className="chip" style={{ cursor: 'default' }}>
                    {t(ADMIN_AREA_LABELS[area] || area)}
                  </span>
                ))}
              </div>
              <p className="helptext" style={{ marginTop: -10, marginBottom: 16 }}>
                {t('As áreas foram definidas por quem o convidou e não podem ser alteradas aqui.')}
              </p>
              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label>{t('Senha (mín. 12)')}</label>
                  <input type="password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} />
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
                    {t('Li e aceito os')}{' '}
                    <a href="/termos" target="_blank" rel="noreferrer" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>{t('Termos de Uso')}</a>{' '}
                    {t('e a')}{' '}
                    <a href="/privacidade" target="_blank" rel="noreferrer" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>{t('Política de Privacidade')}</a>.
                  </span>
                </label>
                {error ? <p className="error-text" style={{ margin: '12px 0' }}>{error}</p> : null}
                <button className="btn btn-accent" type="submit" disabled={submitting || !termsAccepted} style={{ width: '100%', marginTop: 8 }}>
                  {submitting ? t('A ativar…') : t('Ativar conta')}
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
