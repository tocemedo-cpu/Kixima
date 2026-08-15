// src/pages/adminSistema/Cobrancas.jsx
// Admin do Sistema → Cobranças de subscrição. É aqui, e só aqui, que um plano
// pago passa a estar ativo.
//
// A página tem DUAS listas de propósito, e não uma soma:
//   • Por confirmar — a empresa transferiu e carregou o comprovativo. O trabalho
//     é abrir o comprovativo, conferir a entrada no banco e confirmar.
//   • Por pagar — cobrança emitida, sem comprovativo. Não há nada a confirmar;
//     há alguém a contactar.
// Somá-las num único contador escondia qual dos dois trabalhos está parado.
//
// A terceira lista, as vencidas, existe porque o vencimento NÃO desce o plano
// sozinho — cortar o acesso a quem talvez já tenha transferido é pior do que
// cobrar com atraso. Se não aparecessem aqui, ninguém saberia que existem.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Pill, EmptyRow } from '../../components/BuyerUI';
import { ErrorBanner, SuccessBanner } from '../../components/Common';
import { formatDate } from '../../domain';
import { useI18n } from '../../i18n';

const usd = (v) => `${Number(v ?? 0).toLocaleString('pt-AO', { minimumFractionDigits: 0 })} USD`;

export default function Cobrancas() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [busy, setBusy] = useState('');

  function carregar() {
    setError('');
    api.get('/api/assinatura/fila').then(setData).catch((e) => setError(e.message));
  }
  useEffect(() => { carregar(); }, []);

  async function confirmar(c) {
    // A confirmação afirma que o dinheiro ENTROU. Quem clica tem de o ter visto
    // na conta — o comprovativo prova que alguém deu uma ordem, não que ela foi
    // executada. Por isso a pergunta é essa, e não "tem a certeza?".
    const ok = window.confirm(
      t('Confirma que o valor de {valor} referente a {ref} ({empresa}) entrou na conta da KIXIMA?', {
        valor: usd(c.valorUsd), ref: c.referencia, empresa: c.company?.name || '',
      })
    );
    if (!ok) return;
    const notas = window.prompt(t('Nota interna (opcional) — ex.: data e banco da entrada.')) || '';
    setBusy(c.id); setError(''); setAviso('');
    try {
      await api.post(`/api/assinatura/${c.id}/confirmar`, { notas });
      setAviso(t('{ref} confirmada. A empresa {empresa} está agora no plano {plano}.', {
        ref: c.referencia, empresa: c.company?.name || '', plano: c.planoNovo,
      }));
      carregar();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  async function cancelar(c) {
    const motivo = window.prompt(t('Porque está a cancelar {ref}?', { ref: c.referencia }));
    if (!motivo) return;
    setBusy(c.id); setError('');
    try {
      await api.post(`/api/assinatura/${c.id}/cancelar`, { motivo });
      carregar();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  if (!data) {
    return (
      <div>
        <Crumbs trail={['Planos e Subscrições', 'Cobranças']} />
        {error ? <ErrorBanner message={error} /> : <p className="loading-text">{t('A carregar…')}</p>}
      </div>
    );
  }

  const porConfirmar = data.emAberto.filter((c) => c.status === 'COMPROVATIVO_ENVIADO');
  const porPagar = data.emAberto.filter((c) => c.status === 'PENDENTE');

  return (
    <div>
      <Crumbs trail={['Planos e Subscrições', 'Cobranças']} />
      <PageHead
        title="Cobranças de subscrição"
        subtitle="O plano de uma empresa só muda quando a entrada do valor é confirmada aqui. Confirme apenas o que já viu na conta bancária."
      />

      {error ? <ErrorBanner message={error} /> : null}
      {aviso ? <SuccessBanner message={aviso} /> : null}

      <KpiRow cards={[
        { label: 'Por confirmar', value: data.porConfirmar, icon: 'wallet', tone: 'info' },
        { label: 'Por pagar', value: data.porPagar, icon: 'invoice', tone: 'pending' },
        { label: 'Subscrições vencidas', value: data.vencidas.length, icon: 'policy', tone: 'danger' },
      ]} />

      <h3 style={{ margin: '18px 0 10px' }}>{t('Por confirmar')}</h3>
      <div className="bz-card">
        <table className="bz-table">
          <thead>
            <tr>
              <th>{t('Referência')}</th>
              <th>{t('Empresa')}</th>
              <th>{t('Mudança')}</th>
              <th>{t('Valor')}</th>
              <th>{t('Comprovativo')}</th>
              <th>{t('Enviado em')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {porConfirmar.length === 0 ? (
              <tr><td colSpan={7}><EmptyRow>{t('Nada por confirmar.')}</EmptyRow></td></tr>
            ) : porConfirmar.map((c) => (
              <tr key={c.id}>
                <td>{c.referencia}</td>
                <td>{c.company?.name}</td>
                <td>{c.planoAtual} → <strong>{c.planoNovo}</strong></td>
                <td>{usd(c.valorUsd)}</td>
                <td>
                  <a href={c.comprovativoUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>
                    {t('Abrir')}
                  </a>
                </td>
                <td>{formatDate(c.submetidoEm)}</td>
                <td style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-accent btn-sm" disabled={busy === c.id} onClick={() => confirmar(c)}>
                    {t('Confirmar')}
                  </button>
                  <button className="btn btn-ghost btn-sm" disabled={busy === c.id} onClick={() => cancelar(c)}>
                    {t('Cancelar')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ margin: '22px 0 10px' }}>{t('Por pagar')}</h3>
      <div className="bz-card">
        <table className="bz-table">
          <thead>
            <tr>
              <th>{t('Referência')}</th>
              <th>{t('Empresa')}</th>
              <th>{t('Mudança')}</th>
              <th>{t('Valor')}</th>
              <th>{t('Emitida em')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {porPagar.length === 0 ? (
              <tr><td colSpan={6}><EmptyRow>{t('Nenhuma cobrança por liquidar.')}</EmptyRow></td></tr>
            ) : porPagar.map((c) => (
              <tr key={c.id}>
                <td>{c.referencia}</td>
                <td>{c.company?.name}</td>
                <td>{c.planoAtual} → <strong>{c.planoNovo}</strong></td>
                <td>{usd(c.valorUsd)}</td>
                <td>{formatDate(c.createdAt)}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" disabled={busy === c.id} onClick={() => cancelar(c)}>
                    {t('Cancelar')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ margin: '22px 0 10px' }}>{t('Subscrições vencidas')}</h3>
      <p className="helptext" style={{ marginTop: -4 }}>
        {t('Estas empresas mantêm o acesso — a plataforma não corta o plano sozinha. Contacte-as para regularizar ou emita uma nova cobrança.')}
      </p>
      <div className="bz-card">
        <table className="bz-table">
          <thead>
            <tr>
              <th>{t('Empresa')}</th>
              <th>{t('Plano')}</th>
              <th>{t('Válido até')}</th>
              <th>{t('Dias em atraso')}</th>
            </tr>
          </thead>
          <tbody>
            {data.vencidas.length === 0 ? (
              <tr><td colSpan={4}><EmptyRow>{t('Nenhuma subscrição vencida.')}</EmptyRow></td></tr>
            ) : data.vencidas.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td><Pill tone="info">{c.plan}</Pill></td>
                <td>{formatDate(c.planoValidoAte)}</td>
                <td><Pill tone={c.diasVencida > 30 ? 'danger' : 'pending'}>{String(c.diasVencida)}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
