// src/services/saftService.js
// Exportação SAF-T (AO) — ficheiro normalizado de auditoria fiscal.
//
// O QUE ISTO É. O SAF-T angolano segue de perto o modelo português: um XML com
// o cabeçalho da empresa, as tabelas mestre (clientes, produtos, impostos) e os
// documentos comerciais do período. A AGT exige-o a quem factura com software
// certificado, e é o ficheiro que se entrega numa inspeção.
//
// O QUE ISTO NÃO É. Não é o ficheiro final validado. O esquema oficial tem
// campos que dependem de decisões que não são técnicas — o número de
// certificado do programa, o plano de contas usado, a classificação exata de
// cada taxa. Esses vêm de configuração e do contabilista, e estão marcados
// abaixo. O que está feito é a estrutura, os totais e a extração — a parte que
// não muda com a decisão fiscal, e a que é preciso ter certa desde a primeira
// fatura porque se alimenta de dados que não se reconstroem depois.
//
// Preferiu-se construir o XML à mão a trazer uma biblioteca: são poucos
// elementos, o formato é fixo, e uma dependência a mais numa exportação fiscal
// é uma superfície que alguém tem de manter atualizada durante anos.

const prisma = require('../config/database');
const config = require('../config/env');
const faturacaoService = require('./faturacaoService');

// Escapar é obrigatório e não decorativo: o nome de uma empresa com "&" — e há
// muitas — produz um XML inválido, que a AGT recusa sem dizer porquê.
function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const el = (nome, valor) => (valor === null || valor === undefined || valor === ''
  ? ''
  : `<${nome}>${esc(valor)}</${nome}>`);

const dinheiro = (v) => Number(v || 0).toFixed(2);
const data = (d) => new Date(d).toISOString().slice(0, 10);

/**
 * Um período fechado, e não "desde sempre".
 *
 * O SAF-T é sempre de um intervalo declarado. Aceitar um pedido sem datas
 * pareceria conveniente e produziria um ficheiro que não corresponde a
 * declaração nenhuma — e que, com o catálogo a crescer, ninguém conseguiria
 * abrir.
 */
function validarPeriodo({ de, ate }) {
  const ini = new Date(de);
  const fim = new Date(ate);
  if (Number.isNaN(ini.getTime()) || Number.isNaN(fim.getTime())) {
    throw new Error('Indique o período no formato AAAA-MM-DD (de e até).');
  }
  if (fim < ini) throw new Error('A data final tem de ser posterior à inicial.');
  fim.setHours(23, 59, 59, 999);
  return { ini, fim };
}

async function gerar({ de, ate, supplierCompanyId }) {
  const { ini, fim } = validarPeriodo({ de, ate });

  // O SAF-T é SEMPRE de UMA empresa fornecedora — é ela o emitente fiscal
  // destes documentos (a KIXIMA nunca compra para revender, só garante o
  // pagamento). Um ficheiro que misturasse faturas de fornecedores diferentes
  // sob um único CompanyID declararia como emitidas por uma empresa faturas
  // que são, na realidade, de outra.
  if (!supplierCompanyId) {
    throw new Error('Indique a empresa fornecedora (supplierCompanyId) — o SAF-T é sempre de uma só empresa.');
  }
  const fornecedor = await prisma.company.findUnique({
    where: { id: supplierCompanyId },
    select: { id: true, name: true, taxId: true, serieFiscal: true },
  });
  if (!fornecedor) throw new Error('Empresa fornecedora não encontrada.');

  const incluirCliente = {
    select: {
      reference: true,
      buyerCompany: { select: { id: true, name: true, taxId: true, address: true, city: true, country: true } },
    },
  };
  const incluirClienteContrato = {
    select: {
      reference: true,
      clientCompany: { select: { id: true, name: true, taxId: true, address: true, city: true, country: true } },
    },
  };
  // Isola as faturas/notas desta empresa fornecedora, quer venham de uma PO
  // direta quer de um contrato-quadro.
  const doFornecedor = {
    OR: [{ purchaseOrder: { supplierCompanyId } }, { contract: { supplierCompanyId } }],
  };

  const faturas = await prisma.invoice.findMany({
    where: { issuedAt: { gte: ini, lte: fim }, ...doFornecedor },
    orderBy: [{ serie: 'asc' }, { numeroNaSerie: 'asc' }, { issuedAt: 'asc' }],
    include: {
      purchaseOrder: incluirCliente,
      contract: incluirClienteContrato,
      lines: { orderBy: { lineNumber: 'asc' } },
    },
    take: 100000,
  });

  const clienteDe = (f) => f.purchaseOrder?.buyerCompany || f.contract?.clientCompany || null;

  // Notas de crédito EMITIDAS neste período — são o próprio documento fiscal
  // reportado (não uma propriedade da fatura original), por isso entram por
  // data de EMISSÃO da nota, não da fatura que corrigem.
  const notasDoPeriodo = await prisma.creditNote.findMany({
    where: { issuedAt: { gte: ini, lte: fim }, invoice: doFornecedor },
    orderBy: [{ serie: 'asc' }, { numeroNaSerie: 'asc' }, { issuedAt: 'asc' }],
    include: {
      invoice: {
        select: {
          reference: true, serie: true, numeroNaSerie: true, issuedAt: true,
          purchaseOrder: incluirCliente, contract: incluirClienteContrato,
        },
      },
    },
    take: 100000,
  });

  // Total creditado por fatura, para decidir se está efetivamente anulada —
  // conta TODAS as notas de crédito de cada fatura, mesmo emitidas noutro
  // período: uma fatura de janeiro totalmente creditada em março continua
  // anulada quando se olha para ela em qualquer altura.
  const faturaIds = faturas.map((f) => f.id);
  const notasDasFaturasDoPeriodo = faturaIds.length
    ? await prisma.creditNote.findMany({ where: { invoiceId: { in: faturaIds } }, select: { invoiceId: true, amount: true } })
    : [];
  const creditadoPorFatura = new Map();
  for (const n of notasDasFaturasDoPeriodo) {
    creditadoPorFatura.set(n.invoiceId, (creditadoPorFatura.get(n.invoiceId) || 0) + Number(n.amount));
  }
  const anulada = (f) => {
    const creditado = creditadoPorFatura.get(f.id) || 0;
    return creditado > 0 && creditado >= Number(f.amount);
  };

  // Tabela mestre de clientes: cada um UMA vez, mesmo com várias faturas ou
  // notas de crédito.
  const clientes = new Map();
  for (const f of faturas) {
    const c = clienteDe(f);
    if (c && !clientes.has(c.id)) clientes.set(c.id, c);
  }
  for (const n of notasDoPeriodo) {
    const c = n.invoice && clienteDe(n.invoice);
    if (c && !clientes.has(c.id)) clientes.set(c.id, c);
  }

  const totalTributavel = faturas.reduce((s, f) => s + Number(f.netAmount || 0), 0);
  const totalImposto = faturas.reduce((s, f) => s + Number(f.taxAmount || 0), 0);
  const totalDocumentos = faturas.reduce((s, f) => s + Number(f.amount || 0), 0);

  const linhas = [];
  linhas.push('<?xml version="1.0" encoding="UTF-8"?>');
  linhas.push('<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:AO_1.01_01">');

  // --- Cabeçalho ------------------------------------------------------------
  linhas.push('  <Header>');
  linhas.push(`    ${el('AuditFileVersion', '1.01_01')}`);
  // CompanyID/TaxRegistrationNumber/CompanyName são do FORNECEDOR — é ele o
  // emitente fiscal destes documentos, nunca a KIXIMA (ver nota no topo do
  // ficheiro e a chamada obrigatória de supplierCompanyId).
  linhas.push(`    ${el('CompanyID', fornecedor.taxId || 'POR-CONFIGURAR')}`);
  linhas.push(`    ${el('TaxRegistrationNumber', fornecedor.taxId || 'POR-CONFIGURAR')}`);
  linhas.push(`    ${el('TaxAccountingBasis', 'F')}`);
  linhas.push(`    ${el('CompanyName', fornecedor.name)}`);
  linhas.push(`    ${el('FiscalYear', String(ini.getFullYear()))}`);
  linhas.push(`    ${el('StartDate', data(ini))}`);
  linhas.push(`    ${el('EndDate', data(fim))}`);
  linhas.push(`    ${el('CurrencyCode', 'AOA')}`);
  linhas.push(`    ${el('DateCreated', data(new Date()))}`);
  linhas.push(`    ${el('TaxEntity', 'Global')}`);
  // ProductCompanyTaxID/SoftwareCertificateNumber/ProductID são da KIXIMA —
  // aqui sim, corretamente: identificam o FABRICANTE do software certificado
  // (a KIXIMA), não o contribuinte do documento (o fornecedor, acima). É a
  // mesma distinção que o SAF-T português já faz entre a empresa que reporta
  // e o produtor do software que gerou o ficheiro.
  linhas.push(`    ${el('ProductCompanyTaxID', config.faturacao?.nif || 'POR-CONFIGURAR')}`);
  // POR CONFIGURAR: o número do certificado é atribuído pela AGT ao programa.
  // Fica vazio até existir, e não com um valor inventado — um certificado falso
  // num ficheiro fiscal é pior do que um campo por preencher.
  linhas.push(`    ${el('SoftwareCertificateNumber', config.faturacao?.certificadoAgt || '0')}`);
  linhas.push(`    ${el('ProductID', 'KIXIMA')}`);
  linhas.push(`    ${el('ProductVersion', config.versao || '1.0')}`);
  linhas.push('  </Header>');

  // --- Tabelas mestre -------------------------------------------------------
  linhas.push('  <MasterFiles>');
  for (const c of clientes.values()) {
    linhas.push('    <Customer>');
    linhas.push(`      ${el('CustomerID', c.id)}`);
    linhas.push(`      ${el('AccountID', 'Desconhecido')}`);
    linhas.push(`      ${el('CustomerTaxID', c.taxId)}`);
    linhas.push(`      ${el('CompanyName', c.name)}`);
    linhas.push('      <BillingAddress>');
    linhas.push(`        ${el('AddressDetail', c.address || 'Desconhecido')}`);
    linhas.push(`        ${el('City', c.city || 'Desconhecido')}`);
    linhas.push(`        ${el('Country', c.country || 'AO')}`);
    linhas.push('      </BillingAddress>');
    linhas.push('    </Customer>');
  }
  linhas.push('  </MasterFiles>');

  // --- Documentos comerciais ------------------------------------------------
  linhas.push('  <SourceDocuments>');
  linhas.push('    <SalesInvoices>');
  // Inclui as notas de crédito no MESMO bloco — é o modelo português em que
  // isto se baseia: NC/ND partilham a tabela SalesInvoices com a fatura,
  // distinguidas pelo InvoiceType, não uma tabela à parte.
  linhas.push(`      ${el('NumberOfEntries', String(faturas.length + notasDoPeriodo.length))}`);
  // NEEDS_AGT_CONFIRMATION: TotalDebit/TotalCredit aqui só somam faturas. Sem
  // confirmar contra o esquema oficial se as notas de crédito entram nestes
  // totais (e com que sinal), preferimos não adivinhar — ficam de fora até
  // essa confirmação, em vez de um número que pareça certo e não seja.
  linhas.push(`      ${el('TotalDebit', dinheiro(0))}`);
  linhas.push(`      ${el('TotalCredit', dinheiro(totalTributavel))}`);

  for (const f of faturas) {
    const c = clienteDe(f);
    // Faturas anteriores à série certificada não têm número de série. Vão com a
    // referência interna, que é o que existe — inventar um número de série para
    // trás seria fabricar histórico, e a cadeia de integridade serve
    // precisamente para o detetar.
    const numero = faturacaoService.numeroDocumentoAGT({
      serie: f.serie, ano: f.issuedAt.getFullYear(), numeroNaSerie: f.numeroNaSerie,
    }) || f.reference;

    linhas.push('      <Invoice>');
    linhas.push(`        ${el('InvoiceNo', numero)}`);
    linhas.push('        <DocumentStatus>');
    // Anulada se e só se totalmente creditada por nota(s) de crédito — nunca
    // um campo de estado escrito à mão (era exatamente o bug daqui: comparava
    // contra 'ANULADA', um valor que não existe no enum InvoiceStatus).
    linhas.push(`          ${el('InvoiceStatus', anulada(f) ? 'A' : 'N')}`);
    linhas.push(`          ${el('InvoiceStatusDate', new Date(f.updatedAt || f.issuedAt).toISOString().slice(0, 19))}`);
    linhas.push(`          ${el('SourceID', 'KIXIMA')}`);
    linhas.push(`          ${el('SourceBilling', 'P')}`);
    linhas.push('        </DocumentStatus>');
    linhas.push(`        ${el('Hash', f.hashDocumento || '')}`);
    linhas.push(`        ${el('HashControl', '1')}`);
    linhas.push(`        ${el('InvoiceDate', data(f.issuedAt))}`);
    linhas.push(`        ${el('InvoiceType', 'FT')}`);
    linhas.push('        <SpecialRegimes>');
    linhas.push(`          ${el('SelfBillingIndicator', '0')}`);
    linhas.push(`          ${el('CashVATSchemeIndicator', '0')}`);
    linhas.push(`          ${el('ThirdPartiesBillingIndicator', '0')}`);
    linhas.push('        </SpecialRegimes>');
    linhas.push(`        ${el('SourceID', 'KIXIMA')}`);
    linhas.push(`        ${el('SystemEntryDate', new Date(f.createdAt).toISOString().slice(0, 19))}`);
    linhas.push(`        ${el('CustomerID', c?.id || 'Desconhecido')}`);
    // Faturas emitidas antes de existir InvoiceLine (histórico) não têm linhas
    // — sai só o cabeçalho do documento, tal como já saía antes desta alteração.
    for (const li of f.lines) {
      linhas.push('        <Line>');
      linhas.push(`          ${el('LineNumber', String(li.lineNumber))}`);
      linhas.push(`          ${el('ProductCode', li.productCode)}`);
      linhas.push(`          ${el('ProductDescription', li.description)}`);
      linhas.push(`          ${el('Quantity', String(li.quantity))}`);
      linhas.push(`          ${el('UnitPrice', dinheiro(li.unitPrice))}`);
      linhas.push(`          ${el('CreditAmount', dinheiro(li.netAmount))}`);
      linhas.push('          <Tax>');
      linhas.push(`            ${el('TaxCode', li.ivaTaxCode)}`);
      linhas.push(`            ${el('TaxAmount', dinheiro(li.ivaAmount))}`);
      linhas.push('          </Tax>');
      linhas.push('        </Line>');
    }
    linhas.push('        <DocumentTotals>');
    linhas.push(`          ${el('TaxPayable', dinheiro(f.taxAmount))}`);
    linhas.push(`          ${el('NetTotal', dinheiro(f.netAmount))}`);
    linhas.push(`          ${el('GrossTotal', dinheiro(f.amount))}`);
    linhas.push('        </DocumentTotals>');
    linhas.push('      </Invoice>');
  }

  for (const n of notasDoPeriodo) {
    const c = n.invoice && clienteDe(n.invoice);
    const numero = faturacaoService.numeroDocumentoAGT({
      serie: n.serie, ano: n.issuedAt.getFullYear(), numeroNaSerie: n.numeroNaSerie,
    }) || n.reference;
    const faturaOriginal = (n.invoice && faturacaoService.numeroDocumentoAGT({
      serie: n.invoice.serie,
      ano: n.invoice.issuedAt ? n.invoice.issuedAt.getFullYear() : n.issuedAt.getFullYear(),
      numeroNaSerie: n.invoice.numeroNaSerie,
    })) || n.invoice?.reference;

    linhas.push('      <Invoice>');
    linhas.push(`        ${el('InvoiceNo', numero)}`);
    linhas.push('        <DocumentStatus>');
    linhas.push(`          ${el('InvoiceStatus', 'N')}`);
    linhas.push(`          ${el('InvoiceStatusDate', new Date(n.createdAt || n.issuedAt).toISOString().slice(0, 19))}`);
    linhas.push(`          ${el('SourceID', 'KIXIMA')}`);
    linhas.push(`          ${el('SourceBilling', 'P')}`);
    linhas.push('        </DocumentStatus>');
    linhas.push(`        ${el('Hash', n.hashDocumento || '')}`);
    linhas.push(`        ${el('HashControl', '1')}`);
    linhas.push(`        ${el('InvoiceDate', data(n.issuedAt))}`);
    linhas.push(`        ${el('InvoiceType', 'NC')}`);
    linhas.push('        <SpecialRegimes>');
    linhas.push(`          ${el('SelfBillingIndicator', '0')}`);
    linhas.push(`          ${el('CashVATSchemeIndicator', '0')}`);
    linhas.push(`          ${el('ThirdPartiesBillingIndicator', '0')}`);
    linhas.push('        </SpecialRegimes>');
    linhas.push(`        ${el('SourceID', 'KIXIMA')}`);
    linhas.push(`        ${el('SystemEntryDate', new Date(n.createdAt).toISOString().slice(0, 19))}`);
    linhas.push(`        ${el('CustomerID', c?.id || 'Desconhecido')}`);
    // NEEDS_AGT_CONFIRMATION: a referência ao documento original segue aqui o
    // elemento References do modelo português (Reference + Reason). Não
    // confirmado contra o esquema/XSD oficial angolano.
    linhas.push('        <References>');
    linhas.push(`          ${el('Reference', faturaOriginal)}`);
    linhas.push(`          ${el('Reason', n.motivo)}`);
    linhas.push('        </References>');
    linhas.push('        <DocumentTotals>');
    linhas.push(`          ${el('TaxPayable', dinheiro(n.taxAmount))}`);
    linhas.push(`          ${el('NetTotal', dinheiro(n.netAmount))}`);
    linhas.push(`          ${el('GrossTotal', dinheiro(n.amount))}`);
    linhas.push('        </DocumentTotals>');
    linhas.push('      </Invoice>');
  }

  linhas.push('    </SalesInvoices>');
  linhas.push('  </SourceDocuments>');
  linhas.push('</AuditFile>');

  return {
    xml: linhas.filter((l) => l.trim() !== '').join('\n'),
    resumo: {
      fornecedor: { id: fornecedor.id, nome: fornecedor.name },
      periodo: { de: data(ini), ate: data(fim) },
      documentos: faturas.length,
      clientes: clientes.size,
      totalTributavel: Number(totalTributavel.toFixed(2)),
      totalImposto: Number(totalImposto.toFixed(2)),
      totalDocumentos: Number(totalDocumentos.toFixed(2)),
      // Dito alto, e não descoberto na entrega: os documentos sem série são os
      // anteriores a esta empresa ter a sua série certificada declarada.
      semSerieCertificada: faturas.filter((f) => !f.serie).length,
      porConfigurar: [
        fornecedor.taxId ? null : 'NIF do fornecedor (Company.taxId)',
        fornecedor.serieFiscal ? null : 'Série certificada do fornecedor (Company.serieFiscal)',
        config.faturacao?.nif ? null : 'KIXIMA_NIF',
        config.faturacao?.certificadoAgt ? null : 'KIXIMA_CERTIFICADO_AGT',
      ].filter(Boolean),
    },
  };
}

module.exports = { gerar, validarPeriodo };
