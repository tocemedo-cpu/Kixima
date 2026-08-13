// src/pages/shared/Security.jsx
// Configurações → Segurança. Alteração da própria senha + 2FA (TOTP).
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../../api/client';
import { PageHeader, ErrorBanner, SuccessBanner } from '../../components/Common';
import { useI18n } from '../../i18n';

// Secção 2FA: estado → ativação em 2 passos (QR + código) → desativação com código.
function TwoFactorSection() {
  const { t } = useI18n();
  const [status, setStatus] = useState(null); // { enabled, enabledAt }
  const [setup, setSetup] = useState(null);   // { secret, otpauthUrl }
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/api/auth/2fa/status').then(setStatus).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (setup?.otpauthUrl) {
      QRCode.toDataURL(setup.otpauthUrl, { width: 180, margin: 1 }).then(setQr).catch(() => setQr(''));
    } else {
      setQr('');
    }
  }, [setup]);

  async function run(fn) {
    setBusy(true); setError(''); setSuccess('');
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  const startSetup = () => run(async () => setSetup(await api.post('/api/auth/2fa/setup')));
  const confirmEnable = () => run(async () => {
    await api.post('/api/auth/2fa/enable', { code: code.trim() });
    setSetup(null); setCode('');
    setSuccess(t('Autenticação de dois fatores ATIVADA. A partir de agora o login pede também o código da app.'));
    load();
  });
  const disable = () => run(async () => {
    await api.post('/api/auth/2fa/disable', { code: disableCode.trim() });
    setDisableCode('');
    setSuccess(t('Autenticação de dois fatores desativada.'));
    load();
  });

  return (
    <div className="card card-pad" style={{ maxWidth: 420, marginTop: 16 }}>
      <strong style={{ fontSize: 13.5 }}>{t('Autenticação de dois fatores (2FA)')}</strong>
      <p className="helptext" style={{ margin: '6px 0 12px' }}>
        {t('Além da senha, o login passa a pedir um código de 6 dígitos gerado no seu telemóvel (Google Authenticator, Microsoft Authenticator, Authy…). Recomendado sobretudo para perfis que aprovam e pagam.')}
      </p>
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      {!status ? <p className="loading-text">{t('A carregar…')}</p>
        : status.enabled ? (
          <>
            <p style={{ fontSize: 13 }}>
              ✅ <strong>{t('Ativa')}</strong> {t('desde')} {new Date(status.enabledAt).toLocaleDateString('pt-AO')}.
            </p>
            <div className="field" style={{ marginTop: 10 }}>
              <label>{t('Para desativar, confirme o código atual da app')}</label>
              <input inputMode="numeric" maxLength={6} placeholder="000000" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} />
            </div>
            <button className="btn btn-danger btn-sm" disabled={busy || disableCode.trim().length !== 6} onClick={disable}>
              {t('Desativar 2FA')}
            </button>
          </>
        ) : !setup ? (
          <button className="btn btn-accent" disabled={busy} onClick={startSetup}>{t('Ativar 2FA')}</button>
        ) : (
          <>
            <p style={{ fontSize: 13, margin: '0 0 10px' }}>
              {t('1. Abra a app de autenticação e')} <strong>{t('digitalize o código QR')}</strong> {t('(ou introduza a chave manualmente).')}
            </p>
            {qr ? <img src={qr} alt={t('Código QR do 2FA')} style={{ display: 'block', margin: '0 auto 10px', borderRadius: 8 }} /> : null}
            <p className="helptext" style={{ margin: '0 0 12px', wordBreak: 'break-all' }}>
              {t('Chave manual:')} <span className="mono">{setup.secret}</span>
            </p>
            <div className="field">
              <label>{t('2. Introduza o código de 6 dígitos gerado pela app')}</label>
              <input inputMode="numeric" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-accent" disabled={busy || code.trim().length !== 6} onClick={confirmEnable}>
                {t('Confirmar e ativar')}
              </button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => { setSetup(null); setCode(''); }}>
                {t('Cancelar')}
              </button>
            </div>
          </>
        )}
    </div>
  );
}

export default function Security() {
  const { t } = useI18n();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.newPassword.length < 10) return setError(t('A nova senha deve ter pelo menos 10 caracteres.'));
    if (form.newPassword !== form.confirm) return setError(t('A confirmação não coincide com a nova senha.'));
    setSaving(true);
    try {
      await api.patch('/api/auth/password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setSuccess(t('Senha alterada com sucesso.'));
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Segurança" subtitle="Altere a sua senha e proteja a conta com dois fatores." />
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />
      <div className="card card-pad" style={{ maxWidth: 420 }}>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>{t('Senha atual')}</label>
            <input type="password" required value={form.currentPassword} onChange={(e) => update('currentPassword', e.target.value)} />
          </div>
          <div className="field">
            <label>{t('Nova senha (mín. 10)')}</label>
            <input type="password" required minLength={10} value={form.newPassword} onChange={(e) => update('newPassword', e.target.value)} />
          </div>
          <div className="field">
            <label>{t('Confirmar nova senha')}</label>
            <input type="password" required minLength={10} value={form.confirm} onChange={(e) => update('confirm', e.target.value)} />
          </div>
          <button className="btn btn-accent" type="submit" disabled={saving}>{saving ? t('A guardar…') : t('Alterar senha')}</button>
        </form>
      </div>

      <TwoFactorSection />
      <DadosPessoaisSection />
    </div>
  );
}

// Direitos do titular dos dados (Lei 22/11 de Proteção de Dados Pessoais):
// aceder aos seus dados e pedir a eliminação. Vive na página de Segurança
// porque é aqui que a pessoa gere a sua própria conta.
function DadosPessoaisSection() {
  const { t } = useI18n();
  const [aExportar, setAExportar] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [feito, setFeito] = useState(null);

  async function exportar() {
    setAExportar(true); setErro('');
    try {
      const doc = await api.get('/api/users/me/dados-pessoais');
      // Descarrega como ficheiro, para a pessoa ficar mesmo com uma cópia.
      const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'kixima-os-meus-dados.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setErro(e.message); } finally { setAExportar(false); }
  }

  async function anonimizar(e) {
    e.preventDefault();
    setErro('');
    try {
      setFeito(await api.post('/api/users/me/anonimizar', { password: senha }));
    } catch (err) { setErro(err.message); }
  }

  if (feito) {
    return (
      <div className="card card-pad" style={{ maxWidth: 420, marginTop: 16 }}>
        <strong style={{ fontSize: 13.5 }}>{t('Dados eliminados')}</strong>
        <p className="helptext" style={{ margin: '6px 0 0' }}>
          {t('Os seus dados pessoais foram removidos e a conta foi fechada. O histórico de ordens e pagamentos foi preservado sem o identificar, por obrigação legal de conservação contabilística.')}
        </p>
      </div>
    );
  }

  return (
    <div className="card card-pad" style={{ maxWidth: 420, marginTop: 16 }}>
      <strong style={{ fontSize: 13.5 }}>{t('Os meus dados pessoais')}</strong>
      <p className="helptext" style={{ margin: '6px 0 0' }}>
        {t('Tem o direito de aceder aos dados que a KIXIMA guarda sobre si e de pedir a sua eliminação.')}
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button className="btn btn-ghost" onClick={exportar} disabled={aExportar}>
          {aExportar ? t('A preparar…') : t('Descarregar os meus dados')}
        </button>
        {!confirmar ? (
          <button className="btn btn-danger" onClick={() => setConfirmar(true)}>{t('Eliminar os meus dados')}</button>
        ) : null}
      </div>

      {confirmar ? (
        <form onSubmit={anonimizar} style={{ marginTop: 14 }}>
          <p className="helptext" style={{ margin: '0 0 10px' }}>
            <strong>{t('Isto não tem volta.')}</strong>{' '}
            {t('O seu nome, email e foto são apagados e a conta é fechada. As ordens, faturas e pagamentos em que participou continuam a existir, mas deixam de o identificar — a lei fiscal obriga a conservá-los.')}
          </p>
          <div className="field">
            <label>{t('Confirme a sua senha atual')}</label>
            <input type="password" required value={senha} onChange={(ev) => setSenha(ev.target.value)} />
          </div>
          {erro ? <p className="error-text">{erro}</p> : null}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-danger" type="submit">{t('Eliminar definitivamente')}</button>
            <button className="btn btn-ghost" type="button" onClick={() => { setConfirmar(false); setSenha(''); setErro(''); }}>
              {t('Cancelar')}
            </button>
          </div>
        </form>
      ) : erro ? <p className="error-text" style={{ marginTop: 10 }}>{erro}</p> : null}
    </div>
  );
}
