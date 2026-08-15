// src/pages/companyAdmin/ConteudoLocal.jsx
// Relatório de conteúdo local — o que a operadora entrega para provar que
// compra a empresas angolanas.
//
// A ordem dos blocos não é arbitrária. O aviso de qualidade dos dados vem ANTES
// dos números, porque um relatório onde metade do valor não tem origem
// declarada não é um relatório de 50% — é um relatório que não se pode entregar,
// e quem o abre tem de saber isso antes de olhar para as percentagens.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, EmptyRow } from '../../components/BuyerUI';
import { ErrorBanner , Field } from '../../components/Common';
import { formatMoney, formatDate } from '../../domain';
import { useI18n } from '../../i18n';

const hoje = () => new Date().toISOString().slice(0, 10);
const inicioDoAno = () => `${new Date().getUTCFullYear()}-01-01`;

export default function ConteudoLocal() {
  const { t } = useI18n();
  const [de, setDe] = useState(inicioDoAno());
  const [ate, setAte] = useState(hoje());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function carregar() {
    setBusy(true); setError('');
    api.get(`/api/reports/conteudo-local?de=${de}&ate=${ate}`)
      .then(setData)
      .catch((e) => { setError(e); setData(null); })
      .finally(() => setBusy(false));
  }
  useEffect(() => { carregar(); }, []);

  // Descarrega o relatório inteiro, anexo incluído. É o anexo que o torna
  // defensável: sem ele, são percentagens que ninguém consegue reconstituir.
  function descarregar() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kixima-conteudo-local-${de}-a-${ate}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const moeda = data?.moeda || 'AOA';

  return (
    <div>
      <Crumbs trail={['Relatórios', 'Conteúdo local']} />
      <PageHead
        title="Relatório de conteúdo local"
        subtitle="Quanto do que a sua empresa comprou foi para empresas angolanas, quanto corresponde a bens de origem angolana, e quanto foi para micro, pequenas e médias empresas nacionais."
      />

      <div className="bz-card card-pad" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Field label={t('De')} style={{ margin: 0 }}>
          {(id) => (<>
            <input id={id} type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </>)}
        </Field>
        <Field label={t('Até')} style={{ margin: 0 }}>
          {(id) => (<>
            <input id={id} type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </>)}
        </Field>
        <button className="btn btn-accent" onClick={carregar} disabled={busy}>
          {busy ? t('A calcular…') : t('Gerar relatório')}
        </button>
        {data ? (
          <button className="btn btn-ghost" onClick={descarregar}>{t('Descarregar com o anexo')}</button>
        ) : null}
      </div>

      <ErrorBanner message={error} />

      {/* Antes dos números: dá para entregar isto? */}
      {data?.qualidadeDosDados?.aviso ? (
        <div className="banner banner-warn" style={{ marginTop: 16 }}>
          <span><strong>{t('Este relatório ainda não se pode entregar.')}</strong> {data.qualidadeDosDados.aviso}</span>
        </div>
      ) : null}

      {data ? (
        <>
          <KpiRow cards={[
            {
              icon: 'building', tone: 'success', label: 'Contratação nacional',
              value: `${data.contratacaoNacional.percentagem}%`,
              sub: formatMoney(data.contratacaoNacional.valor, moeda),
            },
            {
              icon: 'truck', tone: data.origemDoBem.percentagemAngolana > 0 ? 'info' : 'pending',
              label: 'Bens de origem angolana',
              value: `${data.origemDoBem.percentagemAngolana}%`,
              sub: formatMoney(data.origemDoBem.angolana, moeda),
            },
            {
              icon: 'suppliers', tone: 'success', label: 'MPME angolanas',
              value: `${data.mpmeAngolana.percentagem}%`,
              sub: formatMoney(data.mpmeAngolana.valor, moeda),
            },
            {
              icon: 'orders', tone: 'info', label: 'Valor comprado',
              value: formatMoney(data.totais.valorTotal, moeda),
              sub: `${data.totais.ordens} ordens · ${data.totais.fornecedores} fornecedores`,
            },
          ]} />

          <p className="bz-muted" style={{ fontSize: 12.5, margin: '0 0 16px' }}>
            {t('Valores sem IVA, de ordens com compromisso financeiro assumido. Linhas sem país de origem declarado não contam como angolanas.')}
          </p>

          {/* A leitura útil não é o total — é onde NÃO se compra local. */}
          <div className="bz-card bz-tablewrap" style={{ marginBottom: 16 }}>
            <table className="bz-table">
              <thead>
                <tr>
                  <th>{t('Categoria')}</th><th>{t('Valor')}</th>
                  <th>{t('A fornecedores nacionais')}</th><th>%</th>
                </tr>
              </thead>
              <tbody>
                {data.porCategoria.length === 0
                  ? <tr><td colSpan={4}><EmptyRow>Sem compras no período.</EmptyRow></td></tr>
                  : data.porCategoria.map((c) => (
                    <tr key={c.categoria}>
                      <td><strong>{c.categoria}</strong></td>
                      <td>{formatMoney(c.total, moeda)}</td>
                      <td>{formatMoney(c.nacional, moeda)}</td>
                      <td>{c.percentagemNacional}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="bz-card bz-tablewrap">
            <table className="bz-table">
              <thead>
                <tr>
                  <th>{t('Fornecedor')}</th><th>NIF</th><th>{t('País')}</th>
                  <th>{t('Dimensão')}</th><th>{t('Ordens')}</th><th>{t('Valor')}</th>
                </tr>
              </thead>
              <tbody>
                {data.fornecedores.map((f) => (
                  <tr key={f.nif}>
                    <td><strong>{f.nome}</strong></td>
                    <td className="mono">{f.nif}</td>
                    <td>{f.pais || '—'}</td>
                    <td className="bz-muted">{f.dimensao}</td>
                    <td>{f.ordens}</td>
                    <td>{formatMoney(f.valor, moeda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="bz-muted" style={{ fontSize: 12.5, marginTop: 12 }}>
            {t('O ficheiro descarregado inclui o anexo com as')} {data.anexo.length}{' '}
            {t('ordens que compõem estes números, com referência, data, NIF e origem — é o que permite justificar cada percentagem linha a linha.')}
          </p>
          <p className="bz-muted" style={{ fontSize: 12.5 }}>
            {t('Período:')} {formatDate(data.periodo.de)} — {formatDate(data.periodo.ate)}
          </p>
        </>
      ) : !error && !busy ? <EmptyRow>Escolha o período e gere o relatório.</EmptyRow> : null}
    </div>
  );
}
