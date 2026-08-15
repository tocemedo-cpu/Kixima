// src/pages/shared/Security.jsx
// Configurações → Segurança. Alteração da própria senha + 2FA (TOTP).
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../../api/client';
import { PageHeader, ErrorBanner, SuccessBanner , Field } from '../../components/Common';
import { useI18n } from '../../i18n';

// Secção da verificação em dois passos.
//
// Dois métodos, e o por omissão é o EMAIL: o código de 6 dígitos chega à caixa
// de correio da pessoa, sem instalar nada. A app de autenticação continua
// disponível, escondida atrás de "prefiro usar uma app" — é mais segura (o
// código nasce no telemóvel, sem rede), mas obriga a instalar e configurar uma
// aplicação, e na prática isso faz com que a 2FA não seja ativada de todo. Um
// segundo fator que ninguém usa protege zero contas.
function TwoFactorSection() {
  const { t } = useI18n();
  const [status, setStatus] = useState(null); // { enabled, metodo, emailIndisponivel, email }
  const [etapa, setEtapa] = useState('');     // '' | 'EMAIL' | 'TOTP'
  const [setup, setSetup] = useState(null);   // { secret, otpauthUrl }
  const [envio, setEnvio] = useState(null);   // { enviadoPara, validadeMinutos }
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

  const comecarEmail = () => run(async () => {
    setEnvio(await api.post('/api/auth/2fa/email/enviar'));
    setEtapa('EMAIL');
  });
  const reenviarEmail = () => run(async () => {
    setEnvio(await api.post('/api/auth/2fa/email/enviar'));
    setSuccess(t('Enviámos outro código.'));
  });
  const comecarApp = () => run(async () => {
    setSetup(await api.post('/api/auth/2fa/setup'));
    setEtapa('TOTP');
  });
  const cancelar = () => { setEtapa(''); setSetup(null); setEnvio(null); setCode(''); setError(''); };

  const confirmar = () => run(async () => {
    const r = await api.post('/api/auth/2fa/enable', { code: code.trim() });
    cancelar();
    setSuccess(r.metodo === 'EMAIL'
      ? t('Verificação em dois passos ATIVADA. A partir de agora, ao entrar, enviamos-lhe um código por email.')
      : t('Verificação em dois passos ATIVADA. A partir de agora o login pede também o código da app.'));
    load();
  });
  const pedirCodigoParaDesativar = () => run(async () => {
    const r = await api.post('/api/auth/2fa/email/reenviar');
    setSuccess(t('Enviámos um código para') + ' ' + r.enviadoPara + '.');
  });
  const disable = () => run(async () => {
    await api.post('/api/auth/2fa/disable', { code: disableCode.trim() });
    setDisableCode('');
    setSuccess(t('Verificação em dois passos desativada.'));
    load();
  });

  return (
    <div className="card card-pad" style={{ maxWidth: 420, marginTop: 16 }}>
      <strong style={{ fontSize: 13.5 }}>{t('Verificação em dois passos')}</strong>
      <p className="helptext" style={{ margin: '6px 0 12px' }}>
        {t('Além da senha, entrar passa a pedir um código de 6 dígitos. Assim, quem descobrir a sua senha não entra na mesma. Recomendado sobretudo para perfis que aprovam e pagam.')}
      </p>
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      {!status ? <p className="loading-text">{t('A carregar…')}</p>
        : status.enabled ? (
          <>
            <p style={{ fontSize: 13 }}>
              ✅ <strong>{t('Ativa')}</strong> {t('desde')} {new Date(status.enabledAt).toLocaleDateString('pt-AO')}
              {' — '}
              {status.metodo === 'EMAIL' ? t('por email') : t('por app de autenticação')}.
            </p>
            <Field label={t('Para desativar, confirme um código atual')} style={{ marginTop: 10 }}>
              {(id) => (<>
                <input id={id} inputMode="numeric" maxLength={6} placeholder="000000" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} />
              </>)}
            </Field>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {status.metodo === 'EMAIL' ? (
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={pedirCodigoParaDesativar}>
                  {t('Enviar-me um código')}
                </button>
              ) : null}
              <button className="btn btn-danger btn-sm" disabled={busy || disableCode.trim().length !== 6} onClick={disable}>
                {t('Desativar')}
              </button>
            </div>
          </>
        ) : !etapa ? (
          <>
            {/* O aviso tem de vir ANTES do botão: ativar por email num servidor
                sem email configurado trancaria a pessoa fora da conta. */}
            {status.emailIndisponivel ? (
              <p className="error-text" style={{ fontSize: 12.5, margin: '0 0 10px' }}>{status.emailIndisponivel}</p>
            ) : (
              <p className="helptext" style={{ margin: '0 0 10px' }}>
                {t('O código será enviado para')} <strong>{status.email}</strong>.
              </p>
            )}
            <button className="btn btn-accent" disabled={busy || Boolean(status.emailIndisponivel)} onClick={comecarEmail}>
              {t('Ativar com código por email')}
            </button>
            <p className="helptext" style={{ margin: '10px 0 0' }}>
              <button
                type="button"
                onClick={comecarApp}
                disabled={busy}
                style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'var(--brand-600)', font: 'inherit', textDecoration: 'underline' }}
              >
                {t('Prefiro usar uma app de autenticação')}
              </button>{' '}
              {t('— mais seguro, mas obriga a instalar uma aplicação no telemóvel.')}
            </p>
          </>
        ) : etapa === 'EMAIL' ? (
          <>
            <p style={{ fontSize: 13, margin: '0 0 10px' }}>
              {t('Enviámos um código de 6 dígitos para')} <strong>{envio?.enviadoPara}</strong>.{' '}
              {t('É válido durante')} {envio?.validadeMinutos} {t('minutos. Confirme também a pasta de spam.')}
            </p>
            <Field label={t('Código recebido por email')}>
              {(id) => (<>
                <input id={id} inputMode="numeric" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} />
              </>)}
            </Field>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-accent" disabled={busy || code.trim().length !== 6} onClick={confirmar}>
                {t('Confirmar e ativar')}
              </button>
              <button className="btn btn-ghost" disabled={busy} onClick={reenviarEmail}>{t('Enviar outro')}</button>
              <button className="btn btn-ghost" disabled={busy} onClick={cancelar}>{t('Cancelar')}</button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, margin: '0 0 6px' }}>
              <strong>{t('1. Instale uma app de autenticação')}</strong>{' '}
              {t('— Google Authenticator, Microsoft Authenticator ou Authy, gratuitas na Play Store e na App Store. Se já tiver uma, avance.')}
            </p>
            <p style={{ fontSize: 13, margin: '0 0 10px' }}>
              <strong>{t('2. Abra a app e digitalize o código QR')}</strong>{' '}
              {t('(ou use a chave manual). A app cria uma entrada KIXIMA e começa logo a mostrar um código de 6 dígitos.')}
            </p>
            {qr ? <img src={qr} alt={t('Código QR do 2FA')} style={{ display: 'block', margin: '0 auto 10px', borderRadius: 8 }} /> : null}
            <p className="helptext" style={{ margin: '0 0 12px', wordBreak: 'break-all' }}>
              {t('Chave manual:')} <span className="mono">{setup?.secret}</span>
            </p>
            <Field label={t('3. Introduza o código de 6 dígitos que a app está a mostrar')}>
              {(id) => (<>
                <input id={id} inputMode="numeric" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} />
              </>)}
            </Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-accent" disabled={busy || code.trim().length !== 6} onClick={confirmar}>
                {t('Confirmar e ativar')}
              </button>
              <button className="btn btn-ghost" disabled={busy} onClick={cancelar}>{t('Cancelar')}</button>
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
          <Field label={t('Senha atual')}>
            {(id) => (<>
              <input id={id} type="password" required value={form.currentPassword} onChange={(e) => update('currentPassword', e.target.value)} />
            </>)}
          </Field>
          <Field label={t('Nova senha (mín. 10)')}>
            {(id) => (<>
              <input id={id} type="password" required minLength={10} value={form.newPassword} onChange={(e) => update('newPassword', e.target.value)} />
            </>)}
          </Field>
          <Field label={t('Confirmar nova senha')}>
            {(id) => (<>
              <input id={id} type="password" required minLength={10} value={form.confirm} onChange={(e) => update('confirm', e.target.value)} />
            </>)}
          </Field>
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
          <Field label={t('Confirme a sua senha atual')}>
            {(id) => (<>
              <input id={id} type="password" required value={senha} onChange={(ev) => setSenha(ev.target.value)} />
            </>)}
          </Field>
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
