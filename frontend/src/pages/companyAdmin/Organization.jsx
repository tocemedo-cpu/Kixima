// src/pages/companyAdmin/Organization.jsx
// Perfil da Empresa / Organização — dados da empresa, contactos e resumo
// (utilizadores, contratos, documentos, certificações). É a MESMA página para
// o Company Admin e para o Fornecedor. Ligado a /api/company-admin/organizacao.
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { Crumbs, PageHead, Pill } from '../../components/BuyerUI';
import { Icon } from '../../components/icons';
import { formatDate } from '../../domain';
import { useI18n } from '../../i18n';

// Dados bancários da empresa fornecedora — aparecem na secção "Dados para
// pagamento" das faturas geradas pela plataforma.
function BankDetailsPanel({ companyId }) {
  const [bank, setBank] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }

  useEffect(() => {
    api.get(`/api/companies/${companyId}/bank-details`)
      .then((b) => setBank({ bankName: b.bankName || '', iban: b.iban || '', swift: b.swift || '' }))
      .catch(() => setBank(null));
  }, [companyId]);

  if (!bank) return null;
  const update = (k, v) => setBank((b) => ({ ...b, [k]: v }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api.put(`/api/companies/${companyId}/bank-details`, bank);
      setMsg({ ok: true, text: 'Dados bancários guardados — passam a aparecer nas faturas.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bz-panel" style={{ marginTop: 18 }}>
      <h3>Dados bancários (para pagamento)</h3>
      <p className="bz-sub2" style={{ margin: '4px 0 12px' }}>
        Aparecem na secção <em>Dados bancários do fornecedor</em> das faturas — preencha para que o cliente saiba para onde pagar.
      </p>
      <form onSubmit={save}>
        <div className="field">
          <label>Banco</label>
          <input value={bank.bankName} onChange={(e) => update('bankName', e.target.value)} placeholder="Ex.: Banco de Fomento Angola (BFA)" />
        </div>
        <div className="grid-cols grid-2">
          <div className="field">
            <label>IBAN</label>
            <input value={bank.iban} onChange={(e) => update('iban', e.target.value)} placeholder="AO06 0000 0000 0000 0000 0000 0" />
          </div>
          <div className="field">
            <label>SWIFT / BIC</label>
            <input value={bank.swift} onChange={(e) => update('swift', e.target.value)} placeholder="Ex.: BFMXAOLU" />
          </div>
        </div>
        {msg ? <p className={msg.ok ? 'helptext' : 'error-text'} style={{ margin: '8px 0' }}>{msg.text}</p> : null}
        <button className="btn btn-accent" disabled={saving} type="submit">
          {saving ? 'A guardar…' : 'Guardar dados bancários'}
        </button>
      </form>
    </div>
  );
}

export default function Organization() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/api/company-admin/organizacao').then(setD).catch((e) => setError(e.message)); }, []);

  if (error) return <div className="empty-state"><h3>{t('Não foi possível carregar')}</h3><p>{error}</p></div>;
  if (!d) return <div className="bz-empty">A carregar…</div>;
  const c = d.company;
  const typeLabel = c.type === 'FORNECEDOR' ? 'Prestadora de Serviços' : 'Empresa Cliente';

  return (
    <div>
      <Crumbs trail={['Perfil da Empresa']} />
      <PageHead title="Perfil da Empresa" subtitle="Dados da empresa, contactos e documentos." />

      <div className="bz-layout">
        <div className="bz-panel">
          <h3>{t('Dados Gerais')}</h3>
          <table className="bz-table">
            <tbody>
              {[
                ['Nome da Empresa', c.name], ['Tipo de Atuação', typeLabel], ['NIF', c.taxId],
                ['Telefone', c.contactPhone || '—'], ['E-mail Corporativo', c.contactEmail],
                ['Endereço', c.address || '—'], ['Localização', [c.city, c.province, c.country].filter(Boolean).join(', ') || 'Angola'],
                ['Data de Registo', formatDate(c.createdAt)],
              ].map(([k, v]) => (
                <tr key={k}><td className="bz-muted" style={{ width: 200 }}>{k}</td><td><strong>{v}</strong></td></tr>
              ))}
              <tr><td className="bz-muted">Estado</td><td><Pill tone={c.status === 'APROVADA' ? 'success' : 'pending'}>{c.status === 'APROVADA' ? 'Ativa' : c.status}</Pill> {c.verified ? <Pill tone="success">Verificada</Pill> : null}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="bz-side">
          <div className="bz-panel">
            <h3>{t('Informações de Contacto')}</h3>
            <div className="pf-info"><Icon name="policy" size={15} /> <span>{c.contactEmail}</span></div>
            <div className="pf-info"><Icon name="building" size={15} /> <span>{c.contactPhone || '—'}</span></div>
            <div className="pf-info"><Icon name="offshore" size={15} /> <span>{c.address || [c.city, c.country].filter(Boolean).join(', ') || 'Angola'}</span></div>
          </div>
        </div>
      </div>

      <h3 className="pf-h2">{t('Resumo da Organização')}</h3>
      <div className="hs-quick">
        {[
          { icon: 'users', t: d.summary.users, s: 'Usuários' },
          { icon: 'contract', t: d.summary.contracts, s: 'Contratos' },
          { icon: 'reception', t: d.summary.documents, s: 'Documentos' },
          { icon: 'certification', t: d.summary.certifications, s: 'Certificações/Apólices' },
        ].map((x) => (
          <div className="hs-quickcard" key={x.s}>
            <span className="hs-quick-ico"><Icon name={x.icon} size={18} /></span>
            <div><strong style={{ fontSize: 20 }}>{x.t}</strong><span className="bz-sub2">{x.s}</span></div>
          </div>
        ))}
      </div>

      {/* Empresas fornecedoras: dados bancários que alimentam as faturas. */}
      {c.type === 'FORNECEDOR' ? <BankDetailsPanel companyId={user.companyId} /> : null}
    </div>
  );
}
