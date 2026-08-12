// src/pages/shared/FeeStatement.jsx
// Extrato / documento de cobrança da Taxa KIXIMA de um fornecedor (folha A4
// imprimível, modelo oficial). O fornecedor vê o seu; o Admin do Sistema vê o
// de qualquer empresa. Ligado a /api/companies/:id/platform-fees.
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { Loading, ErrorBanner } from '../../components/Common';
import { useI18n, activeLocale } from '../../i18n';

function money(v, cur = 'AOA') {
  const n = Number(v ?? 0).toFixed(2);
  const [int, dec] = n.split('.');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec} ${cur}`;
}
function d(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(activeLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

export default function FeeStatement() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/api/companies/${companyId}/platform-fees`).then(setData).catch((e) => setError(e.message));
  }, [companyId]);

  if (error) return <div style={{ padding: 24 }}><ErrorBanner message={error} /></div>;
  if (!data) return <Loading />;

  const { company, fees, kpis, formula } = data;
  const cur = formula.currency || 'AOA';

  return (
    <div className="doc-page">
      <div className="doc-toolbar no-print">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>{t('← Voltar')}</button>
        <button className="btn btn-accent" onClick={() => window.print()}>{t('Imprimir / Guardar PDF')}</button>
      </div>

      <div className="pdoc-sheet">
        <header className="pdoc-head">
          <div className="pdoc-tagline" style={{ fontSize: 15 }}><strong>KIXIMA</strong> {t('— e-Market Oil & Gas · Angola / África')}</div>
          <div className="pdoc-tagline">{t('Plataforma de procurement com pagamento garantido')}</div>
        </header>

        <div className="pdoc-titlebar">
          <h1>{t('EXTRATO DE TAXAS KIXIMA / PLATFORM FEE STATEMENT')}</h1>
          <div className="pdoc-ref">{d(data.generatedAt)}</div>
        </div>

        <section className="pdoc-parties">
          <div className="pdoc-party">
            <div className="pdoc-lbl">{t('EMITIDO POR / FROM')}</div>
            <strong>KIXIMA</strong>
            <div>{t('Plataforma de procurement Oil & Gas')}</div>
            <div>Luanda, Angola</div>
          </div>
          <div className="pdoc-party">
            <div className="pdoc-lbl">{t('FORNECEDOR / SUPPLIER')}</div>
            <strong>{company.name}</strong>
            {company.taxId ? <div>NIF: {company.taxId}</div> : null}
            {company.address ? <div>{company.address}</div> : (
              [company.city, company.province, company.country].filter(Boolean).length
                ? <div>{[company.city, company.province, company.country].filter(Boolean).join(', ')}</div> : null
            )}
            {company.contactEmail ? <div>{company.contactEmail}</div> : null}
          </div>
        </section>

        <section className="pdoc-boxes">
          <div className="pdoc-box">
            <div className="pdoc-lbl">{t('FÓRMULA DA TAXA')}</div>
            <strong>{t('(nº de POs × {perPo}) + {perInvoice} por fatura · acima de {limiar}: {pct} do valor', { perPo: money(formula.perPo, cur), perInvoice: money(formula.perInvoice, cur), limiar: money(formula.thresholdUsd || 11500, cur), pct: `${((formula.percentAbove || 0.002) * 100).toFixed(2).replace('.', ',')}%` })}</strong>
          </div>
          <div className="pdoc-box">
            <div className="pdoc-lbl">{t('TOTAL POR COBRAR')}</div>
            <strong>{money(kpis.pendingAOA, cur)}</strong>
          </div>
        </section>

        <table className="pdoc-items">
          <thead>
            <tr>
              <th>{t('Data')}</th><th>{t('Fatura de origem')}</th><th>POs</th><th>{t('Composição')}</th>
              <th style={{ textAlign: 'right' }}>{t('Taxa')}</th><th>{t('Estado')}</th>
            </tr>
          </thead>
          <tbody>
            {fees.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#888' }}>{t('Ainda não há taxas geradas para esta empresa.')}</td></tr>
            ) : fees.map((f) => (
              <tr key={f.id}>
                <td>{d(f.createdAt)}</td>
                <td>{f.invoice?.reference || '—'}</td>
                <td>{f.poCount}</td>
                <td>{f.poCount} × {money(f.perPo, cur)} + {money(f.perInvoice, cur)}</td>
                <td style={{ textAlign: 'right' }}>{money(f.amount, f.currency)}</td>
                <td>{f.status === 'COBRADO' ? t('Cobrada em {data}', { data: d(f.chargedAt) }) : t('Pendente')}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={{ textAlign: 'right', fontWeight: 600 }}>{t('Total gerado')}</td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(kpis.totalAOA, cur)}</td>
              <td />
            </tr>
            <tr>
              <td colSpan={4} style={{ textAlign: 'right' }}>{t('Já cobrado')}</td>
              <td style={{ textAlign: 'right' }}>{money(kpis.chargedAOA, cur)}</td>
              <td />
            </tr>
            <tr>
              <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700 }}>{t('POR COBRAR')}</td>
              <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(kpis.pendingAOA, cur)}</td>
              <td />
            </tr>
          </tfoot>
        </table>

        <p className="pdoc-muted" style={{ marginTop: 18, fontSize: 11 }}>
          {t('A Taxa KIXIMA é gerada automaticamente em cada pagamento processado na plataforma e é cobrada ao fornecedor, à parte da PO/Fatura. Este extrato serve como documento de cobrança; o pagamento é conciliado pela equipa KIXIMA. Dúvidas: suporte via Ajuda.')}
        </p>
      </div>
    </div>
  );
}
