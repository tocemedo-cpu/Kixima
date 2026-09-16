// src/pages/adminSistema/SolicitarSerie.jsx
// Admin do Sistema → gera, assina e SUBMETE o pedido de atribuição de série
// de numeração à AGT ("Solicitar Série", spec SETIC-FP DS.120, 4.5) para a
// conta de homologação/produção configurada no ambiente (AGT_NIF) — pré-
// requisito documentado antes de se poder emitir documentos fiscais com
// série própria (ver agtSeriesService.js).
//
// Desde que agtSeriesService.solicitarSerie() passou a chamar mesmo o
// endpoint solicitarSerie da AGT (não só construir e assinar), a resposta
// do backend é { pedido, resposta } — pedido é o JSON assinado (o mesmo de
// antes), resposta é o que a própria AGT devolveu. "Dados assinados" abaixo
// mostra em claro exatamente os 5 campos que entram na assinatura JWS (ver
// dadosAssinatura em agtSeriesService.construirPedidoSerie) — é o que se
// quer conseguir conferir de imediato, sem ter de ler o JSON completo.
//
// Quando a AGT RECUSA o pedido (AgtRecusadoError, 502), o backend devolve o
// `pedido` construído dentro de error.details.pedido — sem isto, uma recusa
// só mostrava o texto do erro, nunca os dados que o causaram. `pedido`
// abaixo vem de resultado (sucesso) OU de error.details (recusa), para o
// painel "Dados assinados" aparecer sempre que existir um pedido para
// mostrar, com ou sem sucesso.
import { useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead } from '../../components/BuyerUI';
import { SuccessBanner, ErrorBanner, Field } from '../../components/Common';
import { useI18n } from '../../i18n';

const TIPOS_DOCUMENTO = ['FT', 'FR', 'NC', 'RC', 'ND'];
const ANO_ATUAL = new Date().getFullYear();

export default function SolicitarSerie() {
  const { t } = useI18n();
  const [tipoDocumento, setTipoDocumento] = useState('FT');
  const [resultado, setResultado] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function gerar(e) {
    e.preventDefault();
    setBusy(true); setError(null); setResultado(null); setCopiado(false);
    try {
      const data = await api.get('/api/faturacao/agt-serie-payload', { ano: ANO_ATUAL, tipoDocumento });
      setResultado(data);
    } catch (e2) {
      setError(e2);
    } finally {
      setBusy(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(resultado || { pedido, erroAgt: error?.details }, null, 2));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem acesso à área de transferência (permissão do browser) — o JSON
      // continua visível para copiar à mão; não há nada mais a fazer aqui.
    }
  }

  // Sucesso: pedido vem de resultado.pedido. Recusa da AGT (AgtRecusadoError):
  // o backend devolve o mesmo pedido construído em error.details.pedido — ver
  // o comentário no topo do ficheiro. Nos outros erros (503 de configuração
  // em falta, 422 de validação, ...) não há pedido nenhum para mostrar.
  const pedido = resultado?.pedido || error?.details?.pedido || null;
  const recusadoPelaAgt = error?.code === 'AGT_RECUSOU';

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

      {pedido ? (
        <>
          <div className="bz-card" style={{ padding: 16, marginTop: 16 }}>
            <strong style={{ fontSize: 13.5 }}>{t('Dados assinados')}</strong>
            <p style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              {t('Exatamente os campos que entraram na assinatura JWS deste pedido — confira-os antes de considerar a submissão válida.')}
            </p>
            <dl style={{
              marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12,
            }}
            >
              {[
                ['NIF (taxRegistrationNumber)', pedido.taxRegistrationNumber],
                ['Ano da série (seriesYear)', pedido.seriesYear],
                ['Tipo de documento (documentType)', pedido.documentType],
                ['Estabelecimento (establishmentNumber)', pedido.establishmentNumber],
                ['Indicador de contingência (seriesContingencyIndicator)', pedido.seriesContingencyIndicator],
              ].map(([rotulo, valor]) => (
                <div key={rotulo}>
                  <dt style={{ fontSize: 11, opacity: 0.65, textTransform: 'uppercase', letterSpacing: 0.3 }}>{t(rotulo)}</dt>
                  <dd style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{String(valor ?? '—')}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bz-card" style={{ padding: 16, marginTop: 16 }}>
            <strong style={{ fontSize: 13.5 }}>{recusadoPelaAgt ? t('A AGT recusou o pedido') : t('Resposta da AGT')}</strong>
            <dl style={{
              marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12,
            }}
            >
              <div>
                <dt style={{ fontSize: 11, opacity: 0.65, textTransform: 'uppercase', letterSpacing: 0.3 }}>{t('resultCode')}</dt>
                <dd style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                  {String((recusadoPelaAgt ? error.details?.resultCode : resultado?.resposta?.resultCode) ?? '—')}
                </dd>
              </div>
              {Object.entries((recusadoPelaAgt ? error.details : resultado?.resposta) || {})
                .filter(([k]) => k !== 'resultCode' && k !== 'pedido')
                .map(([k, v]) => (
                  <div key={k}>
                    <dt style={{ fontSize: 11, opacity: 0.65, textTransform: 'uppercase', letterSpacing: 0.3 }}>{k}</dt>
                    <dd style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
                  </div>
                ))}
            </dl>
          </div>

          <div className="bz-card" style={{ padding: 16, marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 13.5 }}>
                {recusadoPelaAgt
                  ? t('JSON completo (pedido assinado + recusa da AGT)')
                  : t('JSON completo (pedido assinado + resposta da AGT)')}
              </strong>
              <button type="button" className="btn btn-ghost btn-sm" onClick={copiar}>
                {copiado ? t('Copiado!') : t('Copiar JSON')}
              </button>
            </div>
            <SuccessBanner message={copiado ? t('Copiado para a área de transferência.') : ''} />
            <pre className="bz-scroll-x" style={{ marginTop: 10, padding: 12, background: 'var(--surface-2, #fafafa)', borderRadius: 8, fontSize: 12.5, lineHeight: 1.5 }}>
              {JSON.stringify(resultado || { pedido, erroAgt: error?.details }, null, 2)}
            </pre>
          </div>
        </>
      ) : null}
    </div>
  );
}
