// src/pages/companyAdmin/Settings.jsx
// Configurações — preferências da empresa, persistidas em /api/company-admin/settings.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead } from '../../components/BuyerUI';
import { Icon } from '../../components/icons';
import { useI18n } from '../../i18n';

const TOGGLES = [
  { key: 'aprovacaoObrigatoria', t: 'Modo de Aprovação Obrigatória', d: 'Exigir aprovação para POs antes do envio.' },
  { key: 'assinaturaDigital', t: 'Assinatura Digital Obrigatória', d: 'Exigir assinatura digital em contratos e documentos.' },
  { key: 'historicoAlteracoes', t: 'Histórico de Alterações', d: 'Registar todas as alterações realizadas nos dados.' },
  { key: 'backupAutomatico', t: 'Backup Automático', d: 'Realizar backup automático dos dados diariamente.' },
  { key: 'lembretesPrazos', t: 'Lembretes de Prazos', d: 'Receber lembretes automáticos sobre vencimentos e prazos.' },
  { key: 'valoresSemImpostos', t: 'Exibir Valores sem Impostos', d: 'Mostrar valores sem impostos nas listagens e relatórios.' },
];

export default function Settings() {
  const { t } = useI18n();
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { api.get('/api/company-admin/settings').then(setS).catch((e) => setError(e.message)); }, []);

  function toggle(key) { setS((v) => ({ ...v, [key]: !v[key] })); }
  async function save() {
    setBusy(true); setError('');
    try { const saved = await api.put('/api/company-admin/settings', s); setS(saved); setToast(t('Configurações guardadas.')); setTimeout(() => setToast(''), 3000); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  if (error) return <div className="empty-state"><h3>{t('Não foi possível carregar')}</h3><p>{error}</p></div>;
  if (!s) return <div className="bz-empty">{t('A carregar…')}</div>;

  return (
    <div>
      {toast ? <div className="svc-toast">{toast}</div> : null}
      <Crumbs trail={['Configurações']} />
      <PageHead title="Configurações" subtitle="Personalize e configure a plataforma de acordo com as necessidades da sua empresa."
        actions={<button className="btn btn-accent" onClick={save} disabled={busy}>{busy ? t('A guardar…') : t('Salvar Alterações')}</button>} />

      <h3 className="pf-h2">{t('Preferências do Sistema')}</h3>
      <div className="set-grid">
        {TOGGLES.map((x) => (
          <div className="set-row" key={x.key}>
            <div className="set-ico"><Icon name="settings" size={16} /></div>
            <div className="set-body"><strong>{t(x.t)}</strong><span className="bz-sub2">{t(x.d)}</span></div>
            <button className={`set-switch${s[x.key] ? ' on' : ''}`} onClick={() => toggle(x.key)} aria-pressed={s[x.key]}><span /></button>
          </div>
        ))}
      </div>
      <p className="bz-sub" style={{ marginTop: 14 }}><Icon name="shield" size={13} /> {t('Dica: faça backup das suas configurações antes de realizar alterações importantes.')}</p>
    </div>
  );
}
