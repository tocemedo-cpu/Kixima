// src/components/AvatarUploader.jsx
// Foto de perfil com duas origens: carregar um ficheiro ou capturar pela
// câmera (getUserMedia). Envia a imagem para POST /api/users/me/avatar.
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { Icon } from './icons';
import { useI18n } from '../i18n';

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
}

export default function AvatarUploader({ name, avatarUrl, onChange, size = 96 }) {
  const { t } = useI18n();
  const [menu, setMenu] = useState(false);
  const [cam, setCam] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  async function uploadBlob(fileOrBlob, filename = 'avatar.jpg') {
    setBusy(true); setError('');
    try {
      const file = fileOrBlob instanceof File ? fileOrBlob : new File([fileOrBlob], filename, { type: fileOrBlob.type || 'image/jpeg' });
      const user = await api.upload('/api/users/me/avatar', file, 'image');
      onChange?.(user.avatarUrl);
    } catch (e) { setError(e.message); } finally { setBusy(false); setMenu(false); }
  }

  function onPick(e) {
    const f = e.target.files?.[0];
    if (f) uploadBlob(f, f.name);
    e.target.value = '';
  }

  async function openCamera() {
    setMenu(false); setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      setCam(true);
    } catch {
      setError(t('Não foi possível aceder à câmera. Verifique as permissões do browser.'));
    }
  }

  useEffect(() => {
    if (cam && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cam]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCam(false);
  }

  function capture() {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement('canvas');
    const s = Math.min(v.videoWidth, v.videoHeight);
    canvas.width = s; canvas.height = s;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(v, (v.videoWidth - s) / 2, (v.videoHeight - s) / 2, s, s, 0, 0, s, s);
    canvas.toBlob((blob) => { if (blob) uploadBlob(blob, 'camera.jpg'); stopCamera(); }, 'image/jpeg', 0.9);
  }

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  return (
    <div className="av-wrap">
      <div className="av-photo" style={{ width: size, height: size }}>
        {avatarUrl ? <img src={avatarUrl} alt={name} /> : <span className="av-initials">{initials(name)}</span>}
        <button className="av-edit" onClick={() => setMenu((m) => !m)} title={t('Alterar foto')} disabled={busy}>
          <Icon name={busy ? 'policy' : 'certification'} size={14} />
        </button>
        {menu && (
          <div className="av-menu">
            <button onClick={() => fileRef.current?.click()}><Icon name="report" size={14} /> {t('Carregar imagem')}</button>
            <button onClick={openCamera}><Icon name="chart" size={14} /> {t('Usar câmera')}</button>
            {avatarUrl ? <button onClick={async () => { setBusy(true); try { const u = await api.del('/api/users/me/avatar'); onChange?.(u.avatarUrl); } finally { setBusy(false); setMenu(false); } }}><Icon name="approvals" size={14} /> {t('Remover')}</button> : null}
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
      {error ? <p className="av-error">{error}</p> : null}

      {cam && (
        <div className="av-modal" onClick={stopCamera}>
          <div className="av-cam" onClick={(e) => e.stopPropagation()}>
            <video ref={videoRef} playsInline muted />
            <div className="av-cam-actions">
              <button className="btn btn-ghost" onClick={stopCamera}>{t('Cancelar')}</button>
              <button className="btn btn-accent" onClick={capture} disabled={busy}>{busy ? t('A enviar…') : t('Capturar foto')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
