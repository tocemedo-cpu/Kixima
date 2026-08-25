// src/pages/shared/PrintableDocument.jsx
// Documento imprimível/descarregável da Ordem de Compra ou da Fatura, no modelo
// oficial KIXIMA (folha A4). O botão "Imprimir / Guardar PDF" abre o diálogo do
// browser (imprimir OU guardar como PDF). O CSS de impressão esconde a barra de
// ações e deixa só o documento.
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { Loading, ErrorBanner } from '../../components/Common';
import { PO_STATUS, INVOICE_STATUS } from '../../domain';
import { useI18n, activeLocale } from '../../i18n';

// Formatação de valores igual ao modelo: 5.100.000,00 AOA (ponto de milhar,
// vírgula decimal, moeda como sufixo).
function money(v, cur = 'AOA') {
  const n = Number(v ?? 0).toFixed(2);
  const [int, dec] = n.split('.');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec} ${cur}`;
}
function d(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(activeLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}
function dt(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(activeLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

// Espelha faturacaoService.numeroDocumentoAGT() do backend: série + ano de
// emissão + sequencial com 7 dígitos — o formato do documento oficial da AGT
// (ex.: "000AB.2025/0000001"), sem letra de tipo de documento.
function numeroDocumentoAGT(doc) {
  if (!doc?.serie || !doc?.numeroNaSerie) return null;
  const ano = new Date(doc.issuedAt).getFullYear();
  return `${doc.serie}.${ano}/${String(doc.numeroNaSerie).padStart(7, '0')}`;
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
  const [searchParams] = useSearchParams();
  // "Baixar PDF" chega aqui com ?baixar=1 (ver OrderDetail) — poupa o clique
  // extra no botão, abrindo já o diálogo de impressão do navegador.
  const baixarAutomatico = searchParams.get('baixar') === '1';
  const jaImprimiu = useRef(false);
  const [po, setPo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.get(`/api/purchase-orders/${id}`).then(setPo).catch((e) => setError(e.message)); }, [id]);

  useEffect(() => {
    if (po && baixarAutomatico && !jaImprimiu.current) {
      jaImprimiu.current = true;
      // O documento só existe depois de o browser desenhar a página — sem o
      // atraso, o diálogo de impressão às vezes abre sobre uma folha ainda
      // em branco.
      const timer = setTimeout(() => window.print(), 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [po, baixarAutomatico]);

  if (error) return <div style={{ padding: 24 }}><ErrorBanner message={error} /></div>;
  if (!po) return <Loading />;

  const isInvoice = kind === 'invoice';
  const invoice = po.invoice;
  if (isInvoice && !invoice) {
    return (
      <div className="doc-page">
        <div className="doc-toolbar no-print"><button className="btn btn-ghost" onClick={() => navigate(-1)}>{t('← Voltar')}</button></div>
        <div className="pdoc-sheet"><p style={{ padding: 24 }}>{t('Esta ordem ainda não tem fatura emitida.')}</p></div>
      </div>
    );
  }

  const buyer = po.buyerCompany || {};
  const supplier = po.supplierCompany || {};
  const cur = po.currency || 'AOA';
  const subtotal = po.items.reduce((s, it) => s + Number(it.lineTotal || 0), 0);
  // IVA (lei angolana): 14% sobre tudo (produtos e serviços).
  const IVA_RATE = 0.14;
  const taxCalc = po.items.reduce((s, it) => s + Number(it.lineTotal || 0) * IVA_RATE, 0);
  // Retenção na Fonte de Imposto Industrial (Lei 26/20): 6,5% só sobre serviços.
  const WHT_RATE = 0.065;
  const whtCalc = po.items.reduce((s, it) => s + (it.product?.kind === 'SERVICO' ? Number(it.lineTotal || 0) * WHT_RATE : 0), 0);
  // Os valores gravados pelo servidor mandam — na fatura e agora também na PO,
  // que passou a guardar o imposto em vez de o deixar por estimar no cliente.
  // O cálculo local só serve as ordens antigas, criadas antes dessa alteração.
  const fonte = isInvoice ? invoice : po;
  const net = Number(fonte.netAmount ?? subtotal);
  const tax = Number(fonte.taxAmount ?? taxCalc);
  const withheld = Number(fonte.withholdingAmount ?? whtCalc);
  const total = isInvoice ? Number(invoice.amount) : Number(po.totalAmount ?? subtotal + taxCalc);
  // "Estimado" só quando o valor não veio do servidor.
  const estimado = !isInvoice && po.taxAmount == null;
  const ref = isInvoice ? invoice.reference : po.reference;
  const invoiceLines = isInvoice ? (invoice.lines || []) : [];
  const delivery = buyer.address || [buyer.city, buyer.province, buyer.country].filter(Boolean).join(', ') || 'A definir na receção';

  return (
    <div className="doc-page">
      <div className="doc-toolbar no-print">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>{t('← Voltar')}</button>
        <button className="btn btn-ghost" onClick={() => window.print()}>{t('Visualizar PDF')}</button>
        <button className="btn btn-accent" onClick={() => window.print()}>{t('Baixar PDF')}</button>
      </div>
      <p className="helptext no-print" style={{ margin: '8px 0 0', textAlign: 'center' }}>
        {t('Este documento é gerado pelo seu navegador: no diálogo que se abre, escolha "Imprimir" para pré-visualizar ou "Guardar como PDF" para transferir o ficheiro.')}
      </p>

      <div className="pdoc-sheet">
        {/* Cabeçalho: logótipo do cliente + tagline KIXIMA */}
        <header className="pdoc-head">
          <div className="pdoc-clientlogo">
            {buyer.logoUrl ? <img src={buyer.logoUrl} alt={buyer.name} /> : <span>{t('LOGÓTIPO DO CLIENTE')}</span>}
          </div>
          <div className="pdoc-tagline">{t('Emitido via')} <strong>KIXIMA</strong> {t('— e-Market Oil & Gas · Angola / África')}</div>
        </header>

        {/* Título + referência */}
        <div className="pdoc-titlebar">
          <h1>{t(isInvoice ? 'FATURA / INVOICE' : 'ORDEM DE COMPRA / PURCHASE ORDER')}</h1>
          <div className="pdoc-ref">{ref}</div>
        </div>

        {/* Metadados */}
        <section className="pdoc-meta">
          {isInvoice ? (
            <>
              <Meta l={t('ESTADO')} v={t(INVOICE_STATUS[invoice.status]?.label || invoice.status)} />
              <Meta l={t('DATA DE EMISSÃO')} v={d(invoice.issuedAt)} />
              <Meta l={t('DATA DE VENCIMENTO')} v={d(invoice.dueAt)} />
              <Meta l={t('MOEDA')} v={cur} />
            </>
          ) : (
            <>
              <Meta l={t('ESTADO')} v={t(PO_STATUS[po.status]?.label || po.status)} />
              <Meta l={t('DATA DE EMISSÃO')} v={d(po.createdAt)} />
              <Meta l={t('MOEDA')} v={cur} />
              <Meta l={t('REF. CONTRATO')} v={po.contract?.reference || t('N/A — PO regular')} />
            </>
          )}
        </section>

        {/* Partes */}
        <section className="pdoc-parties">
          {isInvoice ? (
            <>
              <Party label={t('EMITIDO POR / FROM')} c={supplier} />
              <Party label={t('FATURADO A / BILL TO')} c={buyer} />
            </>
          ) : (
            <>
              <Party label={t('COMPRADOR / BUYER')} c={buyer} />
              <Party label={t('FORNECEDOR / SUPPLIER')} c={supplier} />
            </>
          )}
        </section>

        {/* Caixas contextuais */}
        <section className="pdoc-boxes">
          {isInvoice ? (
            <>
              <div className="pdoc-box"><div className="pdoc-lbl">{t('ORDEM DE COMPRA DE ORIGEM')}</div><strong>{po.reference}</strong></div>
              <div className="pdoc-box"><div className="pdoc-lbl">{t('PRAZO DE PAGAMENTO')}</div><div>{t('Vencimento em {data} (7 dias após aceitação da PO pelo fornecedor).', { data: d(invoice.dueAt) })}</div></div>
              {invoice.serie && invoice.numeroNaSerie ? (
                <div className="pdoc-box pdoc-box-fiscal">
                  <div className="pdoc-lbl">{t('DOCUMENTO FISCAL CERTIFICADO')}</div>
                  <div>{t('N.º {numero}', { numero: numeroDocumentoAGT(invoice) })}</div>
                  {invoice.hashDocumento ? <div className="pdoc-hash">{t('Hash')}: {invoice.hashDocumento.slice(0, 16)}…</div> : null}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="pdoc-box"><div className="pdoc-lbl">{t('LOCAL DE ENTREGA / DELIVERY SITE')}</div><div>{delivery}</div></div>
              <div className="pdoc-box pdoc-box-accent"><div className="pdoc-lbl">{t('GARANTIA DE PAGAMENTO KIXIMA')}</div><div>{t('Pagamento ao fornecedor em até 7 dias após aceitação — coberto por apólice de seguro.')}</div></div>
            </>
          )}
        </section>

        {/* Itens — a fatura mostra o imposto por linha (documento fiscal certificado);
            a PO mostra só os totais por linha, ainda sem imposto discriminado. */}
        <table className="pdoc-table">
          <thead>
            {isInvoice && invoiceLines.length ? (
              <tr><th>{t('#')}</th><th>{t('DESCRIÇÃO')}</th><th className="r">{t('QTD')}</th><th className="r">{t('PREÇO UNIT.')}</th><th className="r">{t('TOTAL S/ IVA')}</th><th className="r">{t('IVA')}</th><th className="r">{t('TOTAL')}</th></tr>
            ) : (
              <tr><th>{t('#')}</th><th>{t('DESCRIÇÃO')}</th><th>{t('CATEGORIA')}</th><th className="r">{t('QTD')}</th><th className="r">{t('PREÇO UNIT.')}</th><th className="r">{t('TOTAL')}</th></tr>
            )}
          </thead>
          <tbody>
            {isInvoice && invoiceLines.length ? invoiceLines.map((li) => (
              <tr key={li.id}>
                <td>{li.lineNumber}</td>
                <td>{li.description}</td>
                <td className="r">{li.quantity}</td>
                <td className="r">{money(li.unitPrice, cur)}</td>
                <td className="r">{money(li.netAmount, cur)}</td>
                <td className="r">{money(li.ivaAmount, cur)}</td>
                <td className="r">{money(Number(li.netAmount) + Number(li.ivaAmount), cur)}</td>
              </tr>
            )) : po.items.map((it, i) => (
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
          <div className="pdoc-total-row"><span>{t('Subtotal (sem IVA)')}</span><span>{money(net, cur)}</span></div>
          <div className="pdoc-total-row"><span>{t('IVA (14%)')}{estimado ? ` — ${t('estimado')}` : ''}</span><span>{money(tax, cur)}</span></div>
          <div className="pdoc-total-row pdoc-total-grand"><span>{t(isInvoice || !estimado ? 'TOTAL A PAGAR' : 'TOTAL ESTIMADO (c/ IVA)')}</span><span>{money(total, cur)}</span></div>
          {withheld > 0 ? (
            <>
              <div className="pdoc-total-row" style={{ marginTop: 6 }}><span>{t('Retenção na fonte II (6,5% s/ serviços)')}</span><span>− {money(withheld, cur)}</span></div>
              <div className="pdoc-total-row pdoc-total-grand"><span>{t('LÍQUIDO A RECEBER (FORNECEDOR)')}</span><span>{money(total - withheld, cur)}</span></div>
            </>
          ) : null}
        </section>

        {/* Blocos legais específicos */}
        {isInvoice ? (
          <>
            <section className="pdoc-legal">
              <div className="pdoc-lbl">{t('DADOS BANCÁRIOS DO FORNECEDOR / BANK DETAILS')}</div>
              <div>{t('Banco')}: {supplier.bankName || t('[a preencher]')} · IBAN: {supplier.iban || t('[a preencher]')} · SWIFT/BIC: {supplier.swift || t('[a preencher]')}</div>
            </section>
            {invoice.payment ? (
              <section className="pdoc-confirm">
                <div className="pdoc-lbl">{t('PAGAMENTO CONFIRMADO')}</div>
                <div>{t('Pagamento processado em {data} — referência {ref}. Protegido pela garantia de pagamento KIXIMA, com fundos do cliente.', { data: dt(invoice.payment.processedAt), ref: invoice.payment.reference })}</div>
              </section>
            ) : null}
            {invoice.creditNotes?.length ? (
              <section className="pdoc-legal">
                <div className="pdoc-lbl">{t('NOTAS DE CRÉDITO')}</div>
                {invoice.creditNotes.map((n) => (
                  <div key={n.id}>
                    {t('{ref} — emitida em {data}: {motivo} ({valor})', {
                      ref: numeroDocumentoAGT(n) || n.reference,
                      data: d(n.issuedAt),
                      motivo: n.motivo,
                      valor: money(n.amount, invoice.currency),
                    })}
                  </div>
                ))}
              </section>
            ) : null}
            <section className="pdoc-terms">
              <div className="pdoc-lbl">{t('TERMOS DA FATURA')}</div>
              <p>{t('1. Emissão automática: esta fatura foi gerada automaticamente pela plataforma KIXIMA na aceitação da ordem de compra pelo fornecedor, sem intervenção manual. 2. Pagamento: processado pelo Financeiro da empresa compradora, com fundos próprios, dentro do prazo indicado. 3. Sinistros: incumprimentos do prazo são cobertos pela apólice de seguro em nome do fornecedor e acompanhados pela KIXIMA junto da seguradora, fora da plataforma. 4. Lei aplicável: leis da República de Angola.')}</p>
            </section>
          </>
        ) : (
          <>
            <section className="pdoc-legal">
              <div className="pdoc-lbl">{t('GARANTIA DE PAGAMENTO / PAYMENT GUARANTEE')}</div>
              <div>{t('Como funciona: o fornecedor submete, no credenciamento, uma apólice a favor da KIXIMA; a KIXIMA emite uma apólice a favor do comprador contra não-entrega. O comprador paga sempre com fundos próprios — a KIXIMA nunca adianta capital. O relógio dos 7 dias começa a contar na aceitação desta PO pelo fornecedor.')}</div>
            </section>
            <section className="pdoc-terms">
              <div className="pdoc-lbl">{t('TERMOS E CONDIÇÕES')}</div>
              <p>{t('1. HSE & Qualidade: cumprimento das políticas de Saúde, Segurança e Ambiente do setor e das certificações aplicáveis (API, ISO ou equivalentes). 2. Inspeção: o comprador pode inspecionar os bens/serviços antes de confirmar a receção. 3. Confidencialidade dos termos comerciais desta PO. 4. Força maior: nenhuma das partes responde por atrasos fora do seu controlo razoável. 5. Lei aplicável: leis da República de Angola. 6. Sinistros: divergências na receção são registadas na plataforma e acompanhadas pela KIXIMA junto da seguradora, fora da plataforma.')}</p>
            </section>
          </>
        )}

        {/* Assinaturas */}
        <section className="pdoc-signs">
          {isInvoice ? (
            <>
              <Sign label={t('FATURA EMITIDA POR')} name={t('Sistema KIXIMA (automático)')} date={invoice.issuedAt} />
              <Sign label={t('PROCESSADO POR (FINANCEIRO)')} name={invoice.payment?.processedByName || t('Financeiro')} date={invoice.payment?.processedAt} />
            </>
          ) : (
            <>
              <Sign label={t('EMITIDO POR (COMPRADOR)')} name={po.createdBy?.name} date={po.createdAt} />
              <Sign label={t('APROVADO POR (COMPANY ADMIN)')} name={po.approvedBy?.name} date={po.approvedAt} />
              <Sign label={t('ACEITE POR (FORNECEDOR)')} name={supplier.name} date={po.acceptedAt} />
            </>
          )}
        </section>

        <footer className="pdoc-foot">
          {t('Documento gerado eletronicamente pela plataforma KIXIMA em {data}. Ref. {ref} · Pág. 1', { data: dt(new Date().toISOString()), ref })}
        </footer>
      </div>
    </div>
  );
}

function Meta({ l, v }) {
  return <div className="pdoc-meta-item"><div className="pdoc-lbl">{l}</div><div className="pdoc-meta-v">{v}</div></div>;
}
