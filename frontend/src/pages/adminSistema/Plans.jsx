// src/pages/adminSistema/Plans.jsx
// Admin do Sistema → Planos e Subscrições. Confirma/corrige a dimensão declarada
// por cada empresa no cadastro, define o plano (BÁSICO/PRO) e o preço por
// utilizador/mês (teto 100 USD), e mostra o custo mensal de acesso resultante.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { formatUsd } from '../../domain';
import { Crumbs, PageHead, KpiRow, Pill, Toolbar, EmptyRow } from '../../components/BuyerUI';
import { useI18n } from '../../i18n';

const SIZES = ['MICRO', 'PEQUENA', 'MEDIA', 'GRANDE'];
const SIZE_LABEL = { MICRO: 'Micro', PEQUENA: 'Pequena', MEDIA: 'Média', GRANDE: 'Grande' };
const PLAN_TONE = { PRO: 'success', BASICO: 'info' };


export default function AdminPlans() {
  const { t } = useI18n();
  const [companies, setCompanies] = useState(null);
  const [subs, setSubs] = useState({});   // companyId -> subscrição
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ size: 'PEQUENA', plan: 'BASICO', seatPriceUsd: 100, planNotes: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    api.get('/api/companies')
      .then(async (list) => {
        setCompanies(list);
        // Carrega a subscrição de cada empresa (custo mensal = utilizadores × preço).
        const entries = await Promise.all(list.map(async (c) => {
          try { return [c.id, await api.get(`/api/companies/${c.id}/subscription`)]; }
          catch { return [c.id, null]; }
        }));
        setSubs(Object.fromEntries(entries));
      })
      .catch((e) => setError(e.message));
  }
  useEffect(load, []);

  function startEdit(c) {
    setEditing(c.id);
    setForm({
      size: c.size || 'PEQUENA',
      plan: c.plan || 'BASICO',
      seatPriceUsd: Number(c.seatPriceUsd ?? 100),
      planNotes: c.planNotes || '',
    });
    setError('');
  }

  async function save(companyId) {
    setSaving(true); setError('');
    try {
      await api.put(`/api/companies/${companyId}/plan`, {
        size: form.size, plan: form.plan,
        seatPriceUsd: Number(form.seatPriceUsd),
        planNotes: form.planNotes,
      });
      setEditing(null);
      load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  let rows = companies || [];
  if (q) {
    const s = q.toLowerCase();
    rows = rows.filter((c) => (c.name || '').toLowerCase().includes(s) || (c.taxId || '').toLowerCase().includes(s));
  }

  const totalMensal = Object.values(subs).reduce((sum, s) => sum + (s?.monthly?.amountUsd || 0), 0);
  const pro = rows.filter((c) => c.plan === 'PRO').length;
  const grandes = rows.filter((c) => c.size === 'GRANDE').length;

  return (
    <div>
      <Crumbs trail={['Configurações e Suporte', 'Planos e Subscrições']} />
      <PageHead
        title="Planos e Subscrições"
        subtitle="Dimensão da empresa (critério MPME), plano contratado e taxa de acesso por utilizador. Empresas de grande dimensão têm de subscrever o plano PRO."
        actions={
          /* O plano mexe-se em dois sítios: à mão aqui (correções, casos
             especiais) e pela via paga, na fila das cobranças. Quem abre esta
             página à procura de um pagamento por confirmar tem de ter por onde
             ir — senão altera o plano à mão e a cobrança fica pendurada. */
          <Link className="btn btn-ghost" to="/sistema/cobrancas">{t('Cobranças de subscrição')}</Link>
        }
      />

      <KpiRow cards={[
        { icon: 'building', tone: 'info', label: 'Empresas', value: rows.length, sub: 'Credenciadas' },
        { icon: 'offshore', tone: 'success', label: 'No plano PRO', value: pro, sub: 'Com integração ERP' },
        { icon: 'users', tone: 'pending', label: 'Grandes empresas', value: grandes, sub: 'Exigem PRO' },
        { icon: 'wallet', tone: 'success', label: 'Acesso mensal', value: formatUsd(totalMensal), sub: 'Total faturável/mês' },
      ]} />

      <Toolbar placeholder="Pesquisar por empresa ou NIF…" q={q} onQ={setQ} />

      {error ? <div className="banner banner-error" style={{ marginBottom: 12 }}>{error}</div> : null}

      <div className="bz-card bz-tablewrap">
        <table className="bz-table">
          <thead>
            <tr>
              <th>{t('Empresa')}</th><th>{t('Dimensão')}</th><th>{t('Trabalhadores')}</th>
              <th>{t('Plano')}</th><th>{t('Preço/utilizador')}</th><th>{t('Utilizadores')}</th>
              <th>{t('Custo mensal')}</th><th></th>
            </tr>
          </thead>
          <tbody>
            {!companies ? <tr><td colSpan={8}><EmptyRow>A carregar…</EmptyRow></td></tr>
              : rows.length === 0 ? <tr><td colSpan={8}><EmptyRow>Nenhuma empresa encontrada</EmptyRow></td></tr>
              : rows.map((c) => {
                const sub = subs[c.id];
                const isEditing = editing === c.id;
                return (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong><span className="bz-sub2 mono">{c.taxId}</span></td>
                    <td>
                      {isEditing ? (
                        <select className="input" aria-label={t('Dimensão da empresa')} value={form.size} onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}>
                          {SIZES.map((s) => <option key={s} value={s}>{t(SIZE_LABEL[s])}</option>)}
                        </select>
                      ) : <Pill tone={c.size === 'GRANDE' ? 'pending' : 'neutral'}>{SIZE_LABEL[c.size] || c.size}</Pill>}
                    </td>
                    <td className="bz-muted">{c.employees ?? '—'}</td>
                    <td>
                      {isEditing ? (
                        <select className="input" value={form.plan} onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}>
                          <option value="BASICO">{t('Básico')}</option>
                          <option value="PRO">PRO</option>
                        </select>
                      ) : <Pill tone={PLAN_TONE[c.plan] || 'neutral'}>{c.plan === 'PRO' ? 'PRO' : t('Básico')}</Pill>}
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="input" type="number" min="0" max="100" step="1"
                          value={form.seatPriceUsd}
                          onChange={(e) => setForm((f) => ({ ...f, seatPriceUsd: e.target.value }))} />
                      ) : formatUsd(c.seatPriceUsd)}
                    </td>
                    <td className="bz-muted">{sub?.activeUsers ?? '—'}</td>
                    <td><strong>{sub ? formatUsd(sub.monthly.amountUsd) : '—'}</strong></td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-accent btn-sm" disabled={saving} onClick={() => save(c.id)}>
                            {saving ? t('A guardar…') : t('Guardar')}
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>{t('Cancelar')}</button>
                        </div>
                      ) : (
                        <button className="btn btn-ghost btn-sm" onClick={() => startEdit(c)}>{t('Editar')}</button>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
