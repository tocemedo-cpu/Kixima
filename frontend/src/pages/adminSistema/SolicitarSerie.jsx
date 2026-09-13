// src/pages/adminSistema/SolicitarSerie.jsx
// Admin do Sistema → gera e assina o pedido de atribuição de série de
// numeração à AGT ("Solicitar Série", spec SETIC-FP DS.120, 4.5) para uma
// empresa fornecedora — pré-requisito documentado antes de a empresa poder
// emitir documentos fiscais com série própria (ver agtSeriesService.js).
//
// SÓ GERA E ASSINA: não há submissão automática ao portal da AGT — quem tem
// acesso à conta de homologação/produção copia o JSON e submete-o à parte,
// mesmo princípio já usado em /agt-payload.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead } from '../../components/BuyerUI';
import { SuccessBanner, ErrorBanner, Field } from '../../components/Common';
import { useI18n } from '../../i18n';

const TIPOS_DOCUMENTO = ['FT', 'FR', 'NC', 'RC', 'ND'];
const ANO_ATUAL = new Date().getFullYear();

export default function SolicitarSerie() {
  const { t } = useI18n();
  const [companies, setCompanies] = useState(null);
  const [companyId, setCompanyId] = useState('');
  const [ano, setAno] = useState(String(ANO_ATUAL));
  const [tipoDocumento, setTipoDocumento] = useState('FT');
  const [numeroEstabelecimento, setNumeroEstabelecimento] = useState('');
  const [indicadorContingencia, setIndicadorContingencia] = useState('N');
  const [resultado, setResultado] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/api/companies', { type: 'FORNECEDOR', status: 'APROVADA' }).then(setCompanies).catch(setError);
  }, []);

  async function gerar(e) {
    e.preventDefault();
    setBusy(true); setError(null); setResultado(null); setCopiado(false);
    try {
      const data = await api.get('/api/faturacao/agt-serie-payload', {
        supplierCompanyId: companyId,
        ano,
        tipoDocumento,
        numeroEstabelecimento,
        indicadorContingencia,
      });
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

  const list = companies || [];

  return (
    <div>
      <Crumbs trail={[{ label: 'Configurações e Suporte', to: '/sistema' }, 'Solicitar Série']} />
      <PageHead
        title="Solicitar Série"
        subtitle="Gera e assina o pedido de atribuição de série de numeração à AGT para uma empresa fornecedora — o passo que a spec (DS.120, 4.5) exige antes de a empresa poder emitir documentos fiscais com série própria. Só gera e assina; a submissão ao portal da AGT é feita à parte, por quem tem acesso à conta de homologação/produção."
      />

      <ErrorBanner error={error} />

      <form className="bz-card" style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }} onSubmit={gerar}>
        <Field label="Empresa fornecedora" obrigatorio style={{ minWidth: 240 }}>
          {(id) => (
            <select id={id} className="input" required value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="" disabled>{t('Selecione…')}</option>
              {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </Field>

        <Field label="Ano da série" obrigatorio>
          {(id) => (
            <input id={id} className="input" type="number" min="2000" step="1" required style={{ width: 110 }}
              value={ano} onChange={(e) => setAno(e.target.value)} />
          )}
        </Field>

        <Field label="Tipo de documento" obrigatorio>
          {(id) => (
            <select id={id} className="input" required value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)}>
              {TIPOS_DOCUMENTO.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
            </select>
          )}
        </Field>

        <Field label="Nº do estabelecimento" obrigatorio>
          {(id) => (
            <input id={id} className="input" type="text" required style={{ width: 140 }}
              value={numeroEstabelecimento} onChange={(e) => setNumeroEstabelecimento(e.target.value)} />
          )}
        </Field>

        <Field label="Indicador de contingência" hint="N = regime normal · C = contingência">
          {(id) => (
            <select id={id} className="input" value={indicadorContingencia} onChange={(e) => setIndicadorContingencia(e.target.value)}>
              <option value="N">N — {t('Normal')}</option>
              <option value="C">C — {t('Contingência')}</option>
            </select>
          )}
        </Field>

        <button type="submit" className="btn btn-accent" disabled={busy || !companyId}>
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
