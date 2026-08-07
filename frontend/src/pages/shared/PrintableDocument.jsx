// src/pages/shared/PrintableDocument.jsx
// Documento imprimível/descarregável da Ordem de Compra ou da Fatura, no modelo
// oficial KIXIMA (folha A4). O botão "Imprimir / Guardar PDF" abre o diálogo do
// browser (imprimir OU guardar como PDF). O CSS de impressão esconde a barra de
// ações e deixa só o documento.
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { Loading, ErrorBanner } from '../../components/Common';
import { PO_STATUS, INVOICE_STATUS } from '../../domain';
import { useI18n } from '../../i18n';

// Formatação de valores igual ao modelo: 5.100.000,00 AOA (ponto de milhar,
// vírgula decimal, moeda como sufixo).
function money(v, cur = 'AOA') {
  const n = Number(v ?? 0).toFixed(2);
  const [int, dec] = n.split('.');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec} ${cur}`;
}
function d(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}
function dt(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function Party({ label, c }) {
  return (
    <div className="pdoc-party">
      <div className="pdoc-lbl">{label}</div>
      <strong>{c?.name || '—'}</strong>
      {c?.taxId ? <div>NIF: {c.taxId}</div> : null}
      {c?.address ? <div>{c.address}</div> : ([c?.city, c?.province, c?.country].filter(Boolean).length ? <div>{[c.city, c.province, c.country].filter(Boolean).join(', ')}</div> : null)}
      {c?.contactEmail ? <div>{c.contactEmail}</div> : null}
      {c?.contactPhone ? <div>{c.contactPhone}</div> : null}
    </div>
  );
}
function Sign({ label, name, date }) {
  return (
    <div className="pdoc-sign">
      <div className="pdoc-sign-line" />
      <div className="pdoc-lbl">{label}</div>
      <strong>{name || '—'}</strong>
      <div className="pdoc-muted">{date ? d(date) : ''}</div>
    </div>
  );
}

export default function PrintableDocument({ kind }) {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const [po, setPo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.get(`/api/purchase-orders/${id}`).then(setPo).catch((e) => setError(e.message)); }, [id]);

  if (error) return <div style={{ padding: 24 }}><ErrorBanner message={error} /></div>;
  if (!po) return <Loading />;

  const isInvoice = kind === 'invoice';
  const invoice = po.invoice;
  if (isInvoice && !invoice) {
    return (
      <div className="doc-page">
        <div className="doc-toolbar no-print"><button className="btn btn-ghost" onClick={() => navigate(-1)}>← Voltar</button></div>
        <div className="pdoc-sheet"><p style={{ padding: 24 }}>Esta ordem ainda não tem fatura emitida.</p></div>
      </div>
    );
  }

  const buyer = po.buyerCompany || {};
  const supplier = po.supplierCompany || {};
  const cur = po.currency || 'AOA';
  const subtotal = po.items.reduce((s, it) => s + Number(it.lineTotal || 0), 0);
  // IVA (lei angolana): 14% produtos, 6,5% serviços — por linha, conforme o tipo.
  const IVA_RATE = { PRODUTO: 0.14, SERVICO: 0.065 };
  const taxCalc = po.items.reduce((s, it) => s + Number(it.lineTotal || 0) * (IVA_RATE[it.product?.kind] ?? IVA_RATE.PRODUTO), 0);
  // Na fatura usa os valores gravados (autoritativos); na PO é uma estimativa.
  const net = isInvoice ? Number(invoice.netAmount ?? subtotal) : subtotal;
  const tax = isInvoice ? Number(invoice.taxAmount ?? taxCalc) : taxCalc;
  const total = isInvoice ? Number(invoice.amount) : subtotal + taxCalc;
  const ref = isInvoice ? invoice.reference : po.reference;
  const delivery = buyer.address || [buyer.city, buyer.province, buyer.country].filter(Boolean).join(', ') || 'A definir na receção';

  return (
    <div className="doc-page">
      <div className="doc-toolbar no-print">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Voltar</button>
        <button className="btn btn-accent" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
      </div>

      <div className="pdoc-sheet">
        {/* Cabeçalho: logótipo do cliente + tagline KIXIMA */}
        <header className="pdoc-head">
          <div className="pdoc-clientlogo">
            {buyer.logoUrl ? <img src={buyer.logoUrl} alt={buyer.name} /> : <span>LOGÓTIPO DO CLIENTE</span>}
          </div>
          <div className="pdoc-tagline">Emitido via <strong>KIXIMA</strong> — e-Market Oil &amp; Gas · Angola / África</div>
        </header>

        {/* Título + referência */}
        <div className="pdoc-titlebar">
          <h1>{isInvoice ? 'FATURA / INVOICE' : 'ORDEM DE COMPRA / PURCHASE ORDER'}</h1>
          <div className="pdoc-ref">{ref}</div>
        </div>

        {/* Metadados */}
        <section className="pdoc-meta">
          {isInvoice ? (
            <>
              <Meta l="ESTADO" v={INVOICE_STATUS[invoice.status]?.label || invoice.status} />
              <Meta l="DATA DE EMISSÃO" v={d(invoice.issuedAt)} />
              <Meta l="DATA DE VENCIMENTO" v={d(invoice.dueAt)} />
              <Meta l="MOEDA" v={cur} />
            </>
          ) : (
            <>
              <Meta l="ESTADO" v={PO_STATUS[po.status]?.label || po.status} />
              <Meta l="DATA DE EMISSÃO" v={d(po.createdAt)} />
              <Meta l="MOEDA" v={cur} />
              <Meta l="REF. CONTRATO" v={po.contract?.reference || 'N/A — PO regular'} />
            </>
          )}
        </section>

        {/* Partes */}
        <section className="pdoc-parties">
          {isInvoice ? (
            <>
              <Party label="EMITIDO POR / FROM" c={supplier} />
              <Party label="FATURADO A / BILL TO" c={buyer} />
            </>
          ) : (
            <>
              <Party label="COMPRADOR / BUYER" c={buyer} />
              <Party label="FORNECEDOR / SUPPLIER" c={supplier} />
            </>
          )}
        </section>

        {/* Caixas contextuais */}
        <section className="pdoc-boxes">
          {isInvoice ? (
            <>
              <div className="pdoc-box"><div className="pdoc-lbl">ORDEM DE COMPRA DE ORIGEM</div><strong>{po.reference}</strong></div>
              <div className="pdoc-box"><div className="pdoc-lbl">PRAZO DE PAGAMENTO</div><div>Vencimento em {d(invoice.dueAt)} (7 dias após aceitação da PO pelo fornecedor).</div></div>
            </>
          ) : (
            <>
              <div className="pdoc-box"><div className="pdoc-lbl">LOCAL DE ENTREGA / DELIVERY SITE</div><div>{delivery}</div></div>
              <div className="pdoc-box pdoc-box-accent"><div className="pdoc-lbl">GARANTIA DE PAGAMENTO KIXIMA</div><div>Pagamento ao fornecedor em até 7 dias após aceitação — coberto por apólice de seguro.</div></div>
            </>
          )}
        </section>

        {/* Itens */}
        <table className="pdoc-table">
          <thead>
            <tr><th>{t('#')}</th><th>{t('DESCRIÇÃO')}</th><th>{t('CATEGORIA')}</th><th className="r">{t('QTD')}</th><th className="r">{t('PREÇO UNIT.')}</th><th className="r">{t('TOTAL')}</th></tr>
          </thead>
          <tbody>
            {po.items.map((it, i) => (
              <tr key={it.id}>
                <td>{i + 1}</td>
                <td>{it.product?.name || it.productId}</td>
                <td>{it.product?.category || '—'}</td>
                <td className="r">{it.quantity}</td>
                <td className="r">{money(it.unitPrice, cur)}</td>
                <td className="r">{money(it.lineTotal, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totais */}
        <section className="pdoc-totals">
          <div className="pdoc-total-row"><span>Subtotal (sem IVA)</span><span>{money(net, cur)}</span></div>
          <div className="pdoc-total-row"><span>IVA{isInvoice ? '' : ' (estimado)'}</span><span>{money(tax, cur)}</span></div>
          <div className="pdoc-total-row pdoc-total-grand"><span>{isInvoice ? 'TOTAL A PAGAR' : 'TOTAL ESTIMADO (c/ IVA)'}</span><span>{money(total, cur)}</span></div>
        </section>

        {/* Blocos legais específicos */}
        {isInvoice ? (
          <>
            <section className="pdoc-legal">
              <div className="pdoc-lbl">DADOS BANCÁRIOS DO FORNECEDOR / BANK DETAILS</div>
              <div>Banco: [a preencher] · IBAN: [a preencher] · SWIFT/BIC: [a preencher]</div>
            </section>
            {invoice.payment ? (
              <section className="pdoc-confirm">
                <div className="pdoc-lbl">PAGAMENTO CONFIRMADO</div>
                <div>Pagamento processado em {dt(invoice.payment.processedAt)} — referência {invoice.payment.reference}. Protegido pela garantia de pagamento KIXIMA, com fundos do cliente.</div>
              </section>
            ) : null}
            <section className="pdoc-terms">
              <div className="pdoc-lbl">TERMOS DA FATURA</div>
              <p>1. <strong>Emissão automática:</strong> esta fatura foi gerada automaticamente pela plataforma KIXIMA na aceitação da ordem de compra pelo fornecedor, sem intervenção manual. 2. <strong>Pagamento:</strong> processado pelo Financeiro da empresa compradora, com fundos próprios, dentro do prazo indicado. 3. <strong>Sinistros:</strong> incumprimentos do prazo são cobertos pela apólice de seguro em nome do fornecedor e acompanhados pela KIXIMA junto da seguradora, fora da plataforma. 4. <strong>Lei aplicável:</strong> leis da República de Angola.</p>
            </section>
          </>
        ) : (
          <>
            <section className="pdoc-legal">
              <div className="pdoc-lbl">GARANTIA DE PAGAMENTO / PAYMENT GUARANTEE</div>
              <div><strong>Como funciona:</strong> o fornecedor submete, no credenciamento, uma apólice a favor da KIXIMA; a KIXIMA emite uma apólice a favor do comprador contra não-entrega. O comprador paga sempre com fundos próprios — a KIXIMA nunca adianta capital. O relógio dos 7 dias começa a contar na aceitação desta PO pelo fornecedor.</div>
            </section>
            <section className="pdoc-terms">
              <div className="pdoc-lbl">TERMOS E CONDIÇÕES</div>
              <p>1. <strong>HSE &amp; Qualidade:</strong> cumprimento das políticas de Saúde, Segurança e Ambiente do setor e das certificações aplicáveis (API, ISO ou equivalentes). 2. <strong>Inspeção:</strong> o comprador pode inspecionar os bens/serviços antes de confirmar a receção. 3. <strong>Confidencialidade</strong> dos termos comerciais desta PO. 4. <strong>Força maior:</strong> nenhuma das partes responde por atrasos fora do seu controlo razoável. 5. <strong>Lei aplicável:</strong> leis da República de Angola. 6. <strong>Sinistros:</strong> divergências na receção são registadas na plataforma e acompanhadas pela KIXIMA junto da seguradora, fora da plataforma.</p>
            </section>
          </>
        )}

        {/* Assinaturas */}
        <section className="pdoc-signs">
          {isInvoice ? (
            <>
              <Sign label="FATURA EMITIDA POR" name="Sistema KIXIMA (automático)" date={invoice.issuedAt} />
              <Sign label="PROCESSADO POR (FINANCEIRO)" name={invoice.payment?.processedByName || 'Financeiro'} date={invoice.payment?.processedAt} />
            </>
          ) : (
            <>
              <Sign label="EMITIDO POR (COMPRADOR)" name={po.createdBy?.name} date={po.createdAt} />
              <Sign label="APROVADO POR (COMPANY ADMIN)" name={po.approvedBy?.name} date={po.approvedAt} />
              <Sign label="ACEITE POR (FORNECEDOR)" name={supplier.name} date={po.acceptedAt} />
            </>
          )}
        </section>

        <footer className="pdoc-foot">
          Documento gerado eletronicamente pela plataforma KIXIMA em {dt(new Date().toISOString())}. Ref. {ref} · Pág. 1
        </footer>
      </div>
    </div>
  );
}

function Meta({ l, v }) {
  return <div className="pdoc-meta-item"><div className="pdoc-lbl">{l}</div><div className="pdoc-meta-v">{v}</div></div>;
}
