// src/pages/adminSistema/SolicitarSerie.jsx
// Admin do Sistema → gera e assina o pedido de atribuição de série de
// numeração à AGT ("Solicitar Série", spec SETIC-FP DS.120, 4.5) para a
// conta de homologação/produção configurada no ambiente (AGT_NIF) — pré-
// requisito documentado antes de se poder emitir documentos fiscais com
// série própria (ver agtSeriesService.js).
//
// SÓ GERA E ASSINA: não há submissão automática ao portal da AGT — quem tem
// acesso à conta de homologação/produção copia o JSON e submete-o à parte,
// mesmo princípio já usado em /agt-payload.
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
      await navigator.clipboard.writeText(JSON.stringify(resultado, null, 2));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem acesso à área de transferência (permissão do browser) — o JSON
      // continua visível para copiar à mão; não há nada mais a fazer aqui.
    }
  }

  return (
    <div>
      <Crumbs trail={[{ label: 'Configurações e Suporte', to: '/sistema' }, 'Solicitar Série']} />
      <PageHead
        title="Solicitar Série"
        subtitle="Gera e assina o pedido de atribuição de série de numeração à AGT para a conta de homologação/produção configurada no ambiente — o passo que a spec (DS.120, 4.5) exige antes de se poder emitir documentos fiscais com série própria. Só gera e assina; a submissão ao portal da AGT é feita à parte, por quem tem acesso à conta de homologação/produção."
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
          {busy ? t('A gerar…') : t('Gerar pedido')}
        </button>
      </form>

      {resultado ? (
        <div className="bz-card" style={{ padding: 16, marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 13.5 }}>{t('Pedido gerado e assinado')}</strong>
            <button type="button" className="btn btn-ghost btn-sm" onClick={copiar}>
              {copiado ? t('Copiado!') : t('Copiar JSON')}
            </button>
          </div>
          <SuccessBanner message={copiado ? t('Copiado para a área de transferência.') : ''} />
          <pre className="bz-scroll-x" style={{ marginTop: 10, padding: 12, background: 'var(--surface-2, #fafafa)', borderRadius: 8, fontSize: 12.5, lineHeight: 1.5 }}>
            {JSON.stringify(resultado, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
