// src/pages/comprador/PoRobot.jsx
// Automatic PO Robot — add-on PRO pago. Duas partes:
//   1. O add-on em si: pedir, pagar por transferência, aguardar confirmação
//      da KIXIMA (mesmo mecanismo da Subscrição — nunca finge estar ativo
//      antes de confirmado).
//   2. Com o add-on ativo: regras por produto (periodicidade, média aceite
//      da IA ou definida à mão, limite de segurança). O robot PREPARA a PO;
//      nunca a aprova nem paga — isso continua sujeito à aprovação humana ou
//      ao workflow DOA do ERP, exatamente como qualquer PO criada por alguém.
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Pill, EmptyRow } from '../../components/BuyerUI';
import { ErrorBanner, SuccessBanner, Field } from '../../components/Common';
import { formatDate, formatUsd, formatNumber } from '../../domain';
import { useI18n } from '../../i18n';
import { useAuth } from '../../auth/AuthContext';

const ADDON_KEY = 'PO_ROBOT';
const PERIODOS = { MENSAL: 'por mês', TRIMESTRAL: 'por trimestre', SEMESTRAL: 'por semestre', ANUAL: 'por ano' };
const PERIODICIDADE_LABEL = { SEMANAL: 'Semanal', QUINZENAL: 'Quinzenal', MENSAL: 'Mensal' };

const REGRA_VAZIA = {
  productId: '', productName: '', mediaOrigem: 'IA', mediaMensal: '', periodicidade: 'MENSAL', quantidade: '', limiteMaximoUsd: '',
};

export default function PoRobot() {
  const { t } = useI18n();
  const { user } = useAuth();
  const podeAgir = user?.role === 'COMPANY_ADMIN';

  const [addon, setAddon] = useState(null);
  const [banco, setBanco] = useState(null);
  const [regras, setRegras] = useState(null);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState('');
  const [busy, setBusy] = useState(false);
  const ficheiro = useRef(null);

  const [novaRegra, setNovaRegra] = useState(false);
  const [form, setForm] = useState(REGRA_VAZIA);
  const [pesquisa, setPesquisa] = useState('');
  const [resultados, setResultados] = useState([]);
  const [sugestaoIa, setSugestaoIa] = useState(null);

  function carregar() {
    setError(null);
    api.get(`/api/addons/${ADDON_KEY}/estado`).then(setAddon).catch(setError);
    api.get('/api/assinatura').then((r) => setBanco(r.banco)).catch(() => {});
  }
  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    if (addon?.ativo) {
      api.get('/api/po-robot/regras').then(setRegras).catch((e) => setError(e));
    }
  }, [addon?.ativo]);

  async function pedirAddon() {
    setBusy(true); setError(null); setAviso('');
    try {
      const c = await api.post(`/api/addons/${ADDON_KEY}/pedir`);
      setAviso(t('Cobrança {ref} emitida. Faça a transferência e carregue o comprovativo aqui.', { ref: c.referencia }));
      carregar();
    } catch (e) { setError(e); } finally { setBusy(false); }
  }

  async function enviarComprovativo(cobrancaId, file) {
    setBusy(true); setError(null); setAviso('');
    try {
      const fd = new FormData();
      fd.append('comprovativo', file);
      await api.postForm(`/api/addons/${cobrancaId}/comprovativo`, fd);
      setAviso(t('Comprovativo recebido. A KIXIMA confirma a entrada do valor e o add-on fica ativo.'));
      carregar();
    } catch (e) { setError(e); } finally { setBusy(false); if (ficheiro.current) ficheiro.current.value = ''; }
  }

  async function cancelarCobranca(id) {
    const motivo = window.prompt(t('Porque está a cancelar esta cobrança?'));
    if (!motivo) return;
    setBusy(true); setError(null);
    try {
      await api.post(`/api/addons/${id}/cancelar`, { motivo });
      carregar();
    } catch (e) { setError(e); } finally { setBusy(false); }
  }

  async function pesquisarProduto(q) {
    setPesquisa(q);
    if (!q || q.trim().length < 2) { setResultados([]); return; }
    try {
      const res = await api.get('/api/marketplace/search', { q, limit: 6 });
      setResultados(res.items || []);
    } catch { setResultados([]); }
  }

  function escolherProduto(p) {
    setForm((f) => ({ ...f, productId: p.id, productName: p.name }));
    setResultados([]);
    setPesquisa(p.name);
    setSugestaoIa(null);
  }

  async function sugerirMedia() {
    if (!form.productId) return;
    try {
      const r = await api.get(`/api/po-robot/media-sugerida/${form.productId}`);
      setSugestaoIa(r);
    } catch (e) { setError(e); }
  }

  function aceitarSugestao() {
    if (!sugestaoIa) return;
    setForm((f) => ({ ...f, mediaOrigem: 'IA', mediaMensal: String(sugestaoIa.mediaMensal) }));
  }

  async function criarRegra(e) {
    e.preventDefault();
    if (!form.productId) { setError({ message: t('Escolha um produto.') }); return; }
    setBusy(true); setError(null);
    try {
      await api.post('/api/po-robot/regras', {
        productId: form.productId,
        mediaOrigem: form.mediaOrigem,
        mediaMensal: Number(form.mediaMensal),
        periodicidade: form.periodicidade,
        quantidade: form.quantidade ? Number(form.quantidade) : null,
        limiteMaximoUsd: form.limiteMaximoUsd ? Number(form.limiteMaximoUsd) : null,
      });
      setAviso(t('Regra criada. A próxima PO desta regra é preparada na próxima corrida do robot.'));
      setNovaRegra(false); setForm(REGRA_VAZIA); setPesquisa(''); setSugestaoIa(null);
      api.get('/api/po-robot/regras').then(setRegras);
    } catch (e) { setError(e); } finally { setBusy(false); }
  }

  async function alternarAtivo(regra) {
    setBusy(true); setError(null);
    try {
      await api.put(`/api/po-robot/regras/${regra.id}`, { ativo: !regra.ativo });
      api.get('/api/po-robot/regras').then(setRegras);
    } catch (e) { setError(e); } finally { setBusy(false); }
  }

  async function removerRegra(regra) {
    const ok = window.confirm(t('Remover esta regra do robot?'));
    if (!ok) return;
    setBusy(true); setError(null);
    try {
      await api.del(`/api/po-robot/regras/${regra.id}`);
      api.get('/api/po-robot/regras').then(setRegras);
    } catch (e) { setError(e); } finally { setBusy(false); }
  }

  if (!addon) {
    return (
      <div>
        <Crumbs trail={[{ label: 'Home Marketplace', to: '/comprador' }, 'Automatic PO Robot']} />
        {error ? <ErrorBanner error={error} /> : <p className="loading-text">{t('A carregar…')}</p>}
      </div>
    );
  }

  return (
    <div>
      <Crumbs trail={[{ label: 'Home Marketplace', to: '/comprador' }, 'Automatic PO Robot']} />
      <PageHead
        title="Automatic PO Robot"
        subtitle="Prepara ordens de compra automaticamente, com base no histórico. Nunca aprova nem paga — a aprovação continua a ser sua."
      />

      {error ? <ErrorBanner error={error} /> : null}
      {aviso ? <SuccessBanner message={aviso} /> : null}

      {!addon.ativo ? (
        <div className="bz-card card-pad" style={{ marginBottom: 18, borderLeft: '4px solid var(--brand-600)' }}>
          <h3 style={{ marginTop: 0 }}>{t('Add-on por ativar')}</h3>
          <p style={{ fontSize: 14 }}>
            {t('{label} — {valor} {periodo}', {
              label: addon.label, valor: formatUsd(addon.preco.valorUsd), periodo: t(PERIODOS[addon.preco.periodo] || addon.preco.periodo),
            })}
          </p>

          {!addon.emAberto ? (
            podeAgir ? (
              <button className="btn btn-accent" disabled={busy} onClick={pedirAddon}>{t('Pedir add-on')}</button>
            ) : (
              <p className="helptext">{t('Só o administrador da empresa pode pedir este add-on.')}</p>
            )
          ) : (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
              <p style={{ fontSize: 14 }}>
                <strong>{t('Cobrança {ref}', { ref: addon.emAberto.referencia })}</strong>{' '}
                <Pill tone={addon.emAberto.status === 'COMPROVATIVO_ENVIADO' ? 'info' : 'pending'}>
                  {addon.emAberto.status === 'COMPROVATIVO_ENVIADO' ? t('Aguarda confirmação da KIXIMA') : t('Por pagar')}
                </Pill>
              </p>
              {addon.emAberto.status === 'PENDENTE' && podeAgir ? (
                banco?.configurado ? (
                  <>
                    <p style={{ fontSize: 13.5 }}>
                      {t('Transfira {valor} para:', { valor: formatUsd(addon.emAberto.valorUsd) })}{' '}
                      <strong>{banco.titular}</strong> — {banco.banco} — IBAN <span className="mono">{banco.iban}</span>
                    </p>
                    <p className="helptext" style={{ margin: '4px 0 10px' }}>
                      {t('Indique a referência {ref} na descrição da transferência.', { ref: addon.emAberto.referencia })}
                    </p>
                    <input ref={ficheiro} type="file" accept="application/pdf,image/png,image/jpeg" disabled={busy}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarComprovativo(addon.emAberto.id, f); }} />
                    <div style={{ marginTop: 10 }}>
                      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => cancelarCobranca(addon.emAberto.id)}>
                        {t('Cancelar cobrança')}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="error-text">{t('Os dados bancários da KIXIMA ainda não estão publicados. Contacte o suporte.')}</p>
                )
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <>
          <KpiRow cards={[
            { icon: 'engineering', tone: 'success', label: 'Add-on', value: t('Ativo'), sub: `${t('Desde')} ${formatDate(addon.activatedAt)}` },
            { icon: 'orders', tone: 'info', label: 'Regras', value: regras ? regras.length : '—', sub: regras ? `${regras.filter((r) => r.ativo).length} ${t('ativas')}` : '' },
          ]} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '10px 0' }}>
            <button className="btn btn-accent" onClick={() => setNovaRegra((v) => !v)}>{t('+ Nova regra')}</button>
          </div>

          {novaRegra ? (
            <form className="bz-card card-pad" style={{ marginBottom: 18, display: 'grid', gap: 12 }} onSubmit={criarRegra}>
              <Field label="Produto" obrigatorio>
                {(id) => (
                  <div style={{ position: 'relative' }}>
                    <input id={id} className="input" value={pesquisa} placeholder={t('Pesquisar produto…')}
                      onChange={(e) => pesquisarProduto(e.target.value)} />
                    {resultados.length > 0 ? (
                      <div className="bz-card" style={{ position: 'absolute', zIndex: 5, width: '100%', maxHeight: 220, overflowY: 'auto' }}>
                        {resultados.map((p) => (
                          <div key={p.id} style={{ padding: 8, cursor: 'pointer', borderBottom: '1px solid var(--line)' }} onClick={() => escolherProduto(p)}>
                            <strong>{p.name}</strong> <span className="bz-muted">{formatMoneySafe(p)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </Field>

              {form.productId ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={sugerirMedia}>{t('Ver média sugerida pela IA')}</button>
                  {sugestaoIa ? (
                    <span className="helptext">
                      {t('Média calculada: {media}/mês ({amostras} compras)', { media: formatNumber(sugestaoIa.mediaMensal), amostras: sugestaoIa.amostras })}{' '}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={aceitarSugestao}>{t('Aceitar')}</button>
                    </span>
                  ) : null}
                </div>
              ) : null}

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Field label="Origem da média">
                  {(id) => (
                    <select id={id} className="input" value={form.mediaOrigem} onChange={(e) => setForm((f) => ({ ...f, mediaOrigem: e.target.value }))}>
                      <option value="IA">{t('Calculada pela IA')}</option>
                      <option value="MANUAL">{t('Definida manualmente')}</option>
                    </select>
                  )}
                </Field>
                <Field label="Média mensal (unidades)" obrigatorio>
                  {(id) => (
                    <input id={id} className="input" type="number" min="0.001" step="0.001" required
                      value={form.mediaMensal} onChange={(e) => setForm((f) => ({ ...f, mediaMensal: e.target.value }))} />
                  )}
                </Field>
                <Field label="Periodicidade">
                  {(id) => (
                    <select id={id} className="input" value={form.periodicidade} onChange={(e) => setForm((f) => ({ ...f, periodicidade: e.target.value }))}>
                      {Object.entries(PERIODICIDADE_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
                    </select>
                  )}
                </Field>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Field label="Quantidade fixa por execução" hint="Opcional — sobrepõe o cálculo pela média.">
                  {(id) => (
                    <input id={id} className="input" type="number" min="1" step="1"
                      value={form.quantidade} onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))} />
                  )}
                </Field>
                <Field label="Limite de segurança (USD)" hint="Opcional — nenhuma PO desta regra ultrapassa este valor.">
                  {(id) => (
                    <input id={id} className="input" type="number" min="1" step="1"
                      value={form.limiteMaximoUsd} onChange={(e) => setForm((f) => ({ ...f, limiteMaximoUsd: e.target.value }))} />
                  )}
                </Field>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-accent" disabled={busy}>{busy ? t('A guardar…') : t('Criar regra')}</button>
                <button type="button" className="btn btn-ghost" onClick={() => { setNovaRegra(false); setForm(REGRA_VAZIA); }}>{t('Cancelar')}</button>
              </div>
            </form>
          ) : null}

          <div className="bz-card bz-tablewrap">
            <table className="bz-table">
              <thead>
                <tr>
                  <th>{t('Produto')}</th>
                  <th>{t('Média mensal')}</th>
                  <th>{t('Periodicidade')}</th>
                  <th>{t('Limite de segurança')}</th>
                  <th>{t('Próxima execução')}</th>
                  <th>{t('Estado')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {!regras ? <tr><td colSpan={7}><EmptyRow>A carregar…</EmptyRow></td></tr>
                  : regras.length === 0 ? <tr><td colSpan={7}><EmptyRow>Nenhuma regra configurada</EmptyRow></td></tr>
                  : regras.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.product?.name}</strong></td>
                      <td>{formatNumber(r.mediaMensal)} {r.mediaOrigem === 'IA' ? <Pill tone="info">IA</Pill> : <Pill tone="neutral">{t('Manual')}</Pill>}</td>
                      <td>{t(PERIODICIDADE_LABEL[r.periodicidade] || r.periodicidade)}</td>
                      <td>{r.limiteMaximoUsd ? formatUsd(r.limiteMaximoUsd) : '—'}</td>
                      <td>{formatDate(r.proximaExecucaoEm)}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => alternarAtivo(r)}>
                          {r.ativo ? t('Ativa') : t('Inativa')}
                        </button>
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => removerRegra(r)}>{t('Remover')}</button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function formatMoneySafe(p) {
  if (p.unitPrice == null) return '';
  return `${p.unitPrice} ${p.currency || ''}`;
}
