// src/pages/adminSistema/PlatformFees.jsx
// Taxa KIXIMA — livro das taxas da plataforma geradas em cada pagamento, à parte
// da PO/Fatura. Fórmula: (nº de POs × valor por PO) + valor fixo por fatura.
// Cobrada ao fornecedor. Ligado a /api/admin/platform-fees.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Tabs, Pill, Toolbar, EmptyRow } from '../../components/BuyerUI';
import { formatDateTime, formatMoney } from '../../domain';
import { useI18n } from '../../i18n';
import { SuccessBanner } from '../../components/Common';

const STATUS_TONE = { PENDENTE: 'pending', COBRADO: 'success' };
const STATUS_LABEL = { PENDENTE: 'Pendente', COBRADO: 'Cobrada' };

export default function PlatformFees() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  // Confirmação depois da API responder — nunca antes. Um "guardado"
  // mostrado antes do servidor confirmar é uma mentira com bom aspeto.
  const [sucesso, setSucesso] = useState('');
  const [busy, setBusy] = useState('');

  function load() {
    api.get('/api/admin/platform-fees').then(setData).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function charge(id) {
    setBusy(id);
    setError('');
    try {
      await api.patch(`/api/admin/platform-fees/${id}/charge`);
      setSucesso(t('Taxa marcada como cobrada.'));
      setTimeout(() => setSucesso(''), 3500);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  const k = data?.kpis;
  const tabs = [
    { key: '', label: 'Todas' },
    { key: 'PENDENTE', label: 'Pendentes' },
    { key: 'COBRADO', label: 'Cobradas' },
  ];
  let fees = data?.fees || [];
  if (tab) fees = fees.filter((f) => f.status === tab);
  if (q) {
    const s = q.toLowerCase();
    fees = fees.filter((f) => (f.company?.name || '').toLowerCase().includes(s) || (f.invoice?.reference || '').toLowerCase().includes(s));
  }

  return (
    <div>
      <Crumbs trail={['Configurações e Suporte', 'Taxa KIXIMA']} />
      <PageHead title="Taxa KIXIMA" subtitle="Taxas da plataforma geradas em cada pagamento, à parte da fatura. 8 USD por PO até 11.500 USD por transação (0,20% acima) + 15 USD por fatura — cobradas ao fornecedor." />

      <KpiRow cards={[
        { icon: 'payment', tone: 'info', label: 'Taxas geradas', value: k?.total ?? '—', sub: 'Total de registos' },
        { icon: 'wallet', tone: 'success', label: 'Valor total', value: k ? formatMoney(k.totalAOA, 'USD') : '—', sub: 'Acumulado' },
        { icon: 'invoice', tone: 'pending', label: 'Por cobrar', value: k ? formatMoney(k.pendingAOA, 'USD') : '—', sub: 'Pendentes' },
        { icon: 'orders', tone: 'success', label: 'Cobradas', value: k?.cobradas ?? '—', sub: 'Liquidadas' },
      ]} />

      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <Toolbar placeholder="Pesquisar por empresa ou fatura…" q={q} onQ={setQ} />

      <SuccessBanner message={sucesso} />
      {error ? <div className="empty-state"><p>{error}</p></div> : (
        <div className="bz-card bz-tablewrap">
          <table className="bz-table">
            <thead>
              <tr>
                <th>{t('Fornecedor')}</th><th>{t('Fatura')}</th><th>POs</th><th>{t('Composição')}</th>
                <th>{t('Taxa')}</th><th>{t('Estado')}</th><th>{t('Data')}</th><th></th>
              </tr>
            </thead>
            <tbody>
              {!data ? <tr><td colSpan={8}><EmptyRow>A carregar…</EmptyRow></td></tr>
                : fees.length === 0 ? <tr><td colSpan={8}><EmptyRow>Ainda não há taxas geradas. São criadas automaticamente quando um pagamento é processado.</EmptyRow></td></tr>
                : fees.map((f) => (
                  <tr key={f.id}>
                    <td><strong>{f.company?.name || '—'}</strong></td>
                    <td className="mono">{f.invoice?.reference || '—'}</td>
                    <td>{f.poCount}</td>
                    <td className="bz-muted">{f.poCount} × {formatMoney(f.perPo, f.currency)} + {formatMoney(f.perInvoice, f.currency)}{f.basis === 'PERCENTUAL' ? ` (0,20% ${t('de')} ${formatMoney(f.poValueUsd, 'USD')})` : ''}</td>
                    <td><strong>{formatMoney(f.amount, f.currency)}</strong></td>
                    <td><Pill tone={STATUS_TONE[f.status] || 'neutral'}>{STATUS_LABEL[f.status] || f.status}</Pill></td>
                    <td className="bz-muted">{formatDateTime(f.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {f.status === 'PENDENTE' ? (
                          <button className="btn btn-sm" disabled={busy === f.id} onClick={() => charge(f.id)}>
                            {busy === f.id ? t('A cobrar…') : t('Marcar cobrada')}
                          </button>
                        ) : (
                          <span className="bz-muted">{formatDateTime(f.chargedAt)}</span>
                        )}
                        <button
                          className="btn btn-ghost btn-sm"
                          title={t('Extrato/documento de cobrança do fornecedor')}
                          onClick={() => window.open(`/documento/taxas/${f.companyId}`, '_blank')}
                        >
                          {t('Extrato')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
