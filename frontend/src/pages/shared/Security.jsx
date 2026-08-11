// src/pages/shared/Security.jsx
// Configurações → Segurança. Alteração da própria senha + 2FA (TOTP).
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../../api/client';
import { PageHeader, ErrorBanner, SuccessBanner } from '../../components/Common';

// Secção 2FA: estado → ativação em 2 passos (QR + código) → desativação com código.
function TwoFactorSection() {
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
    setSuccess('Autenticação de dois fatores ATIVADA. A partir de agora o login pede também o código da app.');
    load();
  });
  const disable = () => run(async () => {
    await api.post('/api/auth/2fa/disable', { code: disableCode.trim() });
    setDisableCode('');
    setSuccess('Autenticação de dois fatores desativada.');
    load();
  });

  return (
    <div className="card card-pad" style={{ maxWidth: 420, marginTop: 16 }}>
      <strong style={{ fontSize: 13.5 }}>Autenticação de dois fatores (2FA)</strong>
      <p className="helptext" style={{ margin: '6px 0 12px' }}>
        Além da senha, o login passa a pedir um código de 6 dígitos gerado no seu telemóvel
        (Google Authenticator, Microsoft Authenticator, Authy…). Recomendado sobretudo para
        perfis que aprovam e pagam.
      </p>
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      {!status ? <p className="loading-text">A carregar…</p>
        : status.enabled ? (
          <>
            <p style={{ fontSize: 13 }}>
              ✅ <strong>Ativa</strong> desde {new Date(status.enabledAt).toLocaleDateString('pt-AO')}.
            </p>
            <div className="field" style={{ marginTop: 10 }}>
              <label>Para desativar, confirme o código atual da app</label>
              <input inputMode="numeric" maxLength={6} placeholder="000000" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} />
            </div>
            <button className="btn btn-danger btn-sm" disabled={busy || disableCode.trim().length !== 6} onClick={disable}>
              Desativar 2FA
            </button>
          </>
        ) : !setup ? (
          <button className="btn btn-accent" disabled={busy} onClick={startSetup}>Ativar 2FA</button>
        ) : (
          <>
            <p style={{ fontSize: 13, margin: '0 0 10px' }}>
              1. Abra a app de autenticação e <strong>digitalize o código QR</strong> (ou introduza a chave manualmente).
            </p>
            {qr ? <img src={qr} alt="Código QR do 2FA" style={{ display: 'block', margin: '0 auto 10px', borderRadius: 8 }} /> : null}
            <p className="helptext" style={{ margin: '0 0 12px', wordBreak: 'break-all' }}>
              Chave manual: <span className="mono">{setup.secret}</span>
            </p>
            <div className="field">
              <label>2. Introduza o código de 6 dígitos gerado pela app</label>
              <input inputMode="numeric" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-accent" disabled={busy || code.trim().length !== 6} onClick={confirmEnable}>
                Confirmar e ativar
              </button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => { setSetup(null); setCode(''); }}>
                Cancelar
              </button>
            </div>
          </>
        )}
    </div>
  );
}

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
      <PageHeader title="Segurança" subtitle="Altere a sua senha e proteja a conta com dois fatores." />
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

      <TwoFactorSection />
    </div>
  );
}
