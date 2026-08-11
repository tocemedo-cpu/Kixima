// src/pages/adminSistema/ErpIntegrations.jsx
// Configuração ERP por empresa — APENAS o Administrador do Sistema KIXIMA.
// Lista as empresas aprovadas, permite escolher o ERP, preencher o formulário
// dinâmico, guardar (credenciais cifradas), testar a ligação e ver o histórico.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner, SuccessBanner } from '../../components/Common';
import Badge from '../../components/Badge';
import { Icon } from '../../components/icons';
import { formatDateTime } from '../../domain';
import { useI18n } from '../../i18n';

const ERP_LABELS = {
  MANUAL: 'Sem ERP (Manual)',
  PRIMAVERA: 'Primavera',
  SAP_S4HANA: 'SAP S/4HANA',
  ORACLE_ERP_CLOUD: 'Oracle ERP Cloud',
  SAP_ARIBA: 'SAP Ariba',
};

export default function ErpIntegrations() {
  const { t } = useI18n();
  const [companies, setCompanies] = useState(null);
  const [selected, setSelected] = useState(null); // company id
  const [cfg, setCfg] = useState(null); // resposta de /erp-config
  const [erp, setErp] = useState('MANUAL');
  const [form, setForm] = useState({});
  const [audits, setAudits] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.get('/api/companies', { status: 'APROVADA' }).then(setCompanies).catch((e) => setError(e.message));
  }, []);

  async function open(companyId) {
    setSelected(companyId);
    setError(''); setSuccess(''); setCfg(null); setAudits([]);
    try {
      const data = await api.get(`/api/companies/${companyId}/erp-config`);
      setCfg(data);
      setErp(data.erp);
      setForm(data.config || {});
      api.get(`/api/companies/${companyId}/erp-config/audits`).then(setAudits).catch(() => {});
    } catch (e) { setError(e.message); }
  }

  function onErpChange(next) {
    setErp(next);
    // reinicia o formulário com os campos do ERP escolhido
    const fields = (cfg?.fields?.[next]) || [];
    const base = {};
    fields.forEach((f) => { base[f.key] = next === cfg?.erp ? (cfg?.config?.[f.key] || '') : ''; });
    setForm(base);
  }

  async function save() {
    setBusy(true); setError(''); setSuccess('');
    try {
      const data = await api.put(`/api/companies/${selected}/erp-config`, { erp, config: form });
      setCfg(data); setErp(data.erp); setForm(data.config || {});
      setSuccess(erp === 'MANUAL'
        ? t('Empresa definida como Sem ERP (Manual).')
        : data.integrationSynced
          ? t('Configuração {erp} guardada e sincronizada.', { erp: ERP_LABELS[erp] })
          : t('Configuração {erp} guardada.', { erp: ERP_LABELS[erp] }));
      api.get(`/api/companies/${selected}/erp-config/audits`).then(setAudits).catch(() => {});
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function test() {
    setBusy(true); setError(''); setSuccess('');
    try {
      const r = await api.post(`/api/companies/${selected}/erp-config/test`);
      setCfg((c) => ({ ...c, lastTest: { at: r.at, ok: r.ok, message: r.message } }));
      setSuccess(r.ok ? t('Ligação OK: {msg}', { msg: r.message }) : t('Falha: {msg}', { msg: r.message }));
      api.get(`/api/companies/${selected}/erp-config/audits`).then(setAudits).catch(() => {});
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  const fields = (cfg?.fields?.[erp]) || [];
  const list = companies || [];

  return (
    <div>
      <PageHeader title="Integrações ERP" subtitle="Configure o ERP de cada empresa aprovada (Primavera, SAP S/4HANA, Oracle ERP Cloud, SAP Ariba). Apenas o Administrador do Sistema." />
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <div className="grid-cols grid-2" style={{ alignItems: 'start', gap: 18 }}>
        {/* Empresas aprovadas */}
        <div className="card card-pad">
          <div className="reg-section" style={{ marginTop: 0 }}>{t('Empresas aprovadas')}</div>
          {!companies ? <Loading /> : list.length === 0 ? (
            <p className="helptext">{t('Nenhuma empresa aprovada.')}</p>
          ) : (
            <ul className="pc-cats" style={{ maxHeight: 520 }}>
              {list.map((c) => (
                <li key={c.id} className={selected === c.id ? 'on' : ''} onClick={() => open(c.id)} style={{ cursor: 'pointer' }}>
                  <span>{c.name}</span>
                  <span className="pc-c">{c.type === 'FORNECEDOR' ? t('Fornecedor') : t('Cliente')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Configuração */}
        <div className="card card-pad">
          {!selected ? (
            <p className="helptext">{t('Selecione uma empresa à esquerda para configurar o ERP.')}</p>
          ) : !cfg ? <Loading /> : (
            <>
              <div className="reg-section" style={{ marginTop: 0 }}>
                {cfg.company.name} — {t('ERP atual')}: <Badge tone={cfg.erp === 'MANUAL' ? 'neutral' : 'success'}>{ERP_LABELS[cfg.erp]}</Badge>
              </div>

              <div className="field">
                <label>{t('Sistema ERP')}</label>
                <select value={erp} onChange={(e) => onErpChange(e.target.value)}>
                  {(cfg.systems || []).map((s) => <option key={s} value={s}>{t(ERP_LABELS[s] || s)}</option>)}
                </select>
              </div>

              {erp === 'MANUAL' ? (
                <p className="helptext">{t('Sem integração ERP — a empresa continua a usar o Kixima normalmente.')}</p>
              ) : (
                <div className="grid-cols grid-2">
                  {fields.map((f) => (
                    <div className="field" key={f.key}>
                      <label>{f.label} {f.required ? <span className="req">*</span> : null}</label>
                      <input
                        type={f.secret ? 'password' : 'text'}
                        value={form[f.key] || ''}
                        placeholder={f.secret ? '••••••' : ''}
                        onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              )}

              {cfg.lastTest ? (
                <div className="helptext" style={{ marginTop: 4 }}>
                  {t('Último teste')}: {cfg.lastTest.at ? formatDateTime(cfg.lastTest.at) : '—'}{' '}
                  {cfg.lastTest.ok == null ? '' : cfg.lastTest.ok
                    ? <Badge tone="success">OK</Badge>
                    : <Badge tone="danger">Falhou</Badge>}
                  {cfg.lastTest.message ? ` · ${cfg.lastTest.message}` : ''}
                </div>
              ) : null}

              <div className="prod-form-footer" style={{ marginTop: 12 }}>
                <button className="btn btn-ghost" type="button" disabled={busy || erp === 'MANUAL'} onClick={test}>
                  <Icon name="offshore" size={14} /> {t('Testar Conexão')}
                </button>
                <button className="btn btn-accent" type="button" disabled={busy} onClick={save}>
                  {busy ? t('A guardar…') : t('Guardar')}
                </button>
              </div>

              {audits.length > 0 ? (
                <>
                  <div className="reg-section">{t('Histórico de auditoria')}</div>
                  <table className="bz-table">
                    <thead><tr><th>{t('Quando')}</th><th>{t('Ação')}</th><th>ERP</th><th>{t('Por')}</th><th>{t('Resultado')}</th></tr></thead>
                    <tbody>
                      {audits.map((a) => (
                        <tr key={a.id}>
                          <td className="bz-muted">{formatDateTime(a.createdAt)}</td>
                          <td>{a.action}</td>
                          <td>{a.toErp ? t(ERP_LABELS[a.toErp] || a.toErp) : '—'}</td>
                          <td>{a.actorName || '—'}</td>
                          <td className="bz-muted">{a.result || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
