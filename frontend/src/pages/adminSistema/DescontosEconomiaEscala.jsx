// src/pages/adminSistema/DescontosEconomiaEscala.jsx
// Admin do Sistema → gestão dos patamares de desconto por economia de escala
// (Category Management, plano PRO). CONFIGURÁVEL EM RUNTIME de propósito —
// os valores do pedido original (100k/2,5% · 500k/5% · 1M/10%) são só o seed
// inicial da migração, não uma constante no código.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { formatUsd } from '../../domain';
import { Crumbs, PageHead, KpiRow, EmptyRow } from '../../components/BuyerUI';
import { SuccessBanner, ErrorBanner, Field } from '../../components/Common';
import { useI18n } from '../../i18n';

const VAZIO = { minVolumeUsd: '', discountPercent: '' };

export default function DescontosEconomiaEscala() {
  const { t } = useI18n();
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [sucesso, setSucesso] = useState('');
  const [novo, setNovo] = useState(VAZIO);
  const [criando, setCriando] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [busy, setBusy] = useState(false);

  function load() {
    api.get('/api/category-management/admin/thresholds')
      .then((r) => setLista(r.sort((a, b) => Number(a.minVolumeUsd) - Number(b.minVolumeUsd))))
      .catch(setError);
  }
  useEffect(load, []);

  function avisar(msg) {
    setSucesso(msg);
    setTimeout(() => setSucesso(''), 3500);
  }

  async function criar(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.post('/api/category-management/admin/thresholds', {
        minVolumeUsd: Number(novo.minVolumeUsd),
        discountPercent: Number(novo.discountPercent),
      });
      setNovo(VAZIO); setCriando(false);
      avisar(t('Patamar criado.'));
      load();
    } catch (e2) { setError(e2); } finally { setBusy(false); }
  }

  function startEdit(tItem) {
    setEditing(tItem.id);
    setForm({ minVolumeUsd: String(Number(tItem.minVolumeUsd)), discountPercent: String(Number(tItem.discountPercent)) });
    setError(null);
  }

  async function guardar(id) {
    setBusy(true); setError(null);
    try {
      await api.put(`/api/category-management/admin/thresholds/${id}`, {
        minVolumeUsd: Number(form.minVolumeUsd),
        discountPercent: Number(form.discountPercent),
      });
      setEditing(null);
      avisar(t('Patamar atualizado.'));
      load();
    } catch (e) { setError(e); } finally { setBusy(false); }
  }

  async function alternarAtivo(tItem) {
    setBusy(true); setError(null);
    try {
      await api.put(`/api/category-management/admin/thresholds/${tItem.id}`, { ativo: !tItem.ativo });
      load();
    } catch (e) { setError(e); } finally { setBusy(false); }
  }

  async function remover(tItem) {
    const ok = window.confirm(t('Remover este patamar de desconto? Deixará de se aplicar a partir de agora.'));
    if (!ok) return;
    setBusy(true); setError(null);
    try {
      await api.del(`/api/category-management/admin/thresholds/${tItem.id}`);
      avisar(t('Patamar removido.'));
      load();
    } catch (e) { setError(e); } finally { setBusy(false); }
  }

  const ativos = (lista || []).filter((tItem) => tItem.ativo).length;

  return (
    <div>
      <Crumbs trail={[{ label: 'Configurações e Suporte', to: '/sistema' }, 'Economia de Escala']} />
      <PageHead
        title="Descontos por Economia de Escala"
        subtitle="Patamares de desconto aplicados ao volume comprado por empresas PRO — configuráveis aqui, sem precisar de deploy."
        actions={
          <button className="btn btn-accent" onClick={() => { setCriando((v) => !v); setError(null); }}>
            {t('+ Novo patamar')}
          </button>
        }
      />

      <KpiRow cards={[
        { icon: 'tag', tone: 'success', label: 'Patamares ativos', value: ativos, sub: 'Aplicados agora' },
        { icon: 'chart', tone: 'info', label: 'Patamares no total', value: (lista || []).length, sub: 'Ativos e inativos' },
      ]} />

      <SuccessBanner message={sucesso} />
      <ErrorBanner error={error} />

      {criando ? (
        <form className="bz-card" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }} onSubmit={criar}>
          <Field label="Volume mínimo (USD)" obrigatorio>
            {(id) => (
              <input id={id} className="input" type="number" min="1" step="1" required
                value={novo.minVolumeUsd}
                onChange={(e) => setNovo((f) => ({ ...f, minVolumeUsd: e.target.value }))} />
            )}
          </Field>
          <Field label="Desconto (%)" obrigatorio>
            {(id) => (
              <input id={id} className="input" type="number" min="0.1" max="100" step="0.1" required
                value={novo.discountPercent}
                onChange={(e) => setNovo((f) => ({ ...f, discountPercent: e.target.value }))} />
            )}
          </Field>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-accent" disabled={busy}>{busy ? t('A guardar…') : t('Criar')}</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setCriando(false); setNovo(VAZIO); }}>{t('Cancelar')}</button>
          </div>
        </form>
      ) : null}

      <div className="bz-card bz-tablewrap">
        <table className="bz-table">
          <thead>
            <tr>
              <th>{t('Volume mínimo')}</th>
              <th>{t('Desconto')}</th>
              <th>{t('Estado')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {!lista ? <tr><td colSpan={4}><EmptyRow>A carregar…</EmptyRow></td></tr>
              : lista.length === 0 ? <tr><td colSpan={4}><EmptyRow>Nenhum patamar configurado</EmptyRow></td></tr>
              : lista.map((tItem) => {
                const isEditing = editing === tItem.id;
                return (
                  <tr key={tItem.id}>
                    <td>
                      {isEditing
                        ? <input className="input" type="number" min="1" step="1" value={form.minVolumeUsd}
                            onChange={(e) => setForm((f) => ({ ...f, minVolumeUsd: e.target.value }))} />
                        : <strong>{formatUsd(tItem.minVolumeUsd)}</strong>}
                    </td>
                    <td>
                      {isEditing
                        ? <input className="input" type="number" min="0.1" max="100" step="0.1" value={form.discountPercent}
                            onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))} />
                        : `${Number(tItem.discountPercent)}%`}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => alternarAtivo(tItem)}>
                        {tItem.ativo ? t('Ativo') : t('Inativo')}
                      </button>
                    </td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-accent btn-sm" disabled={busy} onClick={() => guardar(tItem.id)}>
                            {busy ? t('A guardar…') : t('Guardar')}
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>{t('Cancelar')}</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => startEdit(tItem)}>{t('Editar')}</button>
                          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => remover(tItem)}>{t('Remover')}</button>
                        </div>
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
