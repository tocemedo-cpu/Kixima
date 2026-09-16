// src/pages/adminSistema/SolicitarSerie.jsx
// Admin do Sistema → gera, assina e SUBMETE o pedido de atribuição de série
// de numeração à AGT ("Solicitar Série", spec SETIC-FP DS.120, 4.5) para a
// conta de homologação/produção configurada no ambiente (AGT_NIF) — pré-
// requisito documentado antes de se poder emitir documentos fiscais com
// série própria (ver agtSeriesService.js).
//
// Cada pedido ACEITE pela AGT fica gravado em agtSeriesFe (tabela
// "agtseriesfe" — ver agtSeriesService.solicitarSerie/listarHistorico) — o
// histórico abaixo é a única coisa mostrada: Ano, Tipo de documento, Série
// atribuída e o intervalo/quantidade autorizados (tudo o que vem em
// seriesFEResult), um pedido por linha. Os painéis "Dados assinados"/
// "Resposta da AGT" (o JSON bruto do último pedido desta sessão do browser)
// existiram só enquanto a gravação em agtSeriesFe estava a ser construída e
// validada — com a implementação terminada e o histórico a funcionar,
// deixaram de ser precisos.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { formatDateTime, formatNumber } from '../../domain';
import { Crumbs, PageHead, EmptyRow } from '../../components/BuyerUI';
import { ErrorBanner, Field } from '../../components/Common';
import { useI18n } from '../../i18n';

const TIPOS_DOCUMENTO = ['FT', 'FR', 'NC', 'RC', 'ND'];
const ANO_ATUAL = new Date().getFullYear();

export default function SolicitarSerie() {
  const { t } = useI18n();
  const [tipoDocumento, setTipoDocumento] = useState('FT');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [historico, setHistorico] = useState(null);
  const [errorHistorico, setErrorHistorico] = useState(null);

  function carregarHistorico() {
    api.get('/api/faturacao/agt-series-fe')
      .then(setHistorico)
      .catch(setErrorHistorico);
  }
  useEffect(carregarHistorico, []);

  async function gerar(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.get('/api/faturacao/agt-serie-payload', { ano: ANO_ATUAL, tipoDocumento });
      carregarHistorico(); // o pedido que acabou de ser aceite já está gravado — refrescar a tabela
    } catch (e2) {
      setError(e2);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Crumbs trail={[{ label: 'Configurações e Suporte', to: '/sistema' }, 'Solicitar Série']} />
      <PageHead
        title="Solicitar Série"
        subtitle="Gera, assina e submete à AGT o pedido de atribuição de série de numeração para a conta de homologação/produção configurada no ambiente — o passo que a spec (DS.120, 4.5) exige antes de se poder emitir documentos fiscais com série própria."
      />

      <ErrorBanner error={error} />

      <form className="bz-card" style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }} onSubmit={gerar}>
        <Field label="Tipo de documento" obrigatorio>
          {(id) => (
            <select id={id} className="input" required value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)}>
              {TIPOS_DOCUMENTO.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
            </select>
          )}
        </Field>

        <Field label="Ano da série" hint="Sempre o ano em curso — uma série pedida para um ano diferente não corresponde ao que se está mesmo a emitir.">
          {(id) => (
            <input id={id} className="input" type="number" disabled style={{ width: 110 }} value={ANO_ATUAL} readOnly />
          )}
        </Field>

        <button type="submit" className="btn btn-accent" disabled={busy}>
          {busy ? t('A submeter…') : t('Gerar e submeter pedido')}
        </button>
      </form>

      <div className="bz-card bz-tablewrap" style={{ marginTop: 16 }}>
        <div style={{ padding: '12px 16px 0' }}>
          <strong style={{ fontSize: 13.5 }}>{t('Séries já atribuídas pela AGT')}</strong>
          <p style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            {t('Histórico gravado na base de dados (tabela agtseriesfe) — só entra aqui um pedido depois de a AGT o aceitar.')}
          </p>
        </div>
        <ErrorBanner error={errorHistorico} />
        <table className="bz-table">
          <thead>
            <tr>
              <th>{t('Ano')}</th>
              <th>{t('Tipo de documento')}</th>
              <th>{t('Série atribuída')}</th>
              <th>{t('Intervalo autorizado')}</th>
              <th>{t('Qtd. autorizada')}</th>
              <th>{t('Pedido em')}</th>
            </tr>
          </thead>
          <tbody>
            {!historico ? (
              <tr><td colSpan={6}><EmptyRow>{t('A carregar…')}</EmptyRow></td></tr>
            ) : historico.length === 0 ? (
              <tr><td colSpan={6}><EmptyRow>{t('Nenhuma série pedida ainda.')}</EmptyRow></td></tr>
            ) : historico.map((linha) => (
              <tr key={linha.id}>
                <td>{linha.ano}</td>
                <td>{linha.tipoDocumento}</td>
                <td>{linha.seriesCode || '—'}</td>
                <td>{linha.firstDocumentNo && linha.lastDocumentNo ? `${linha.firstDocumentNo} – ${linha.lastDocumentNo}` : '—'}</td>
                <td>{linha.authorizedQuantity ? formatNumber(linha.authorizedQuantity) : '—'}</td>
                <td>{formatDateTime(linha.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
