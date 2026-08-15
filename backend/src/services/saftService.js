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

async function gerar({ de, ate }) {
  const { ini, fim } = validarPeriodo({ de, ate });

  const faturas = await prisma.invoice.findMany({
    where: { issuedAt: { gte: ini, lte: fim } },
    orderBy: [{ serie: 'asc' }, { numeroNaSerie: 'asc' }, { issuedAt: 'asc' }],
    include: {
      purchaseOrder: {
        select: {
          reference: true,
          buyerCompany: { select: { id: true, name: true, taxId: true, address: true, city: true, country: true } },
        },
      },
      contract: {
        select: {
          reference: true,
          clientCompany: { select: { id: true, name: true, taxId: true, address: true, city: true, country: true } },
        },
      },
    },
    take: 100000,
  });

  const clienteDe = (f) => f.purchaseOrder?.buyerCompany || f.contract?.clientCompany || null;

  // Tabela mestre de clientes: cada um UMA vez, mesmo com várias faturas.
  const clientes = new Map();
  for (const f of faturas) {
    const c = clienteDe(f);
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
  linhas.push(`    ${el('CompanyID', config.faturacao?.nif || 'POR-CONFIGURAR')}`);
  linhas.push(`    ${el('TaxRegistrationNumber', config.faturacao?.nif || 'POR-CONFIGURAR')}`);
  linhas.push(`    ${el('TaxAccountingBasis', 'F')}`);
  linhas.push(`    ${el('CompanyName', config.faturacao?.nome || 'KIXIMA')}`);
  linhas.push(`    ${el('FiscalYear', String(ini.getFullYear()))}`);
  linhas.push(`    ${el('StartDate', data(ini))}`);
  linhas.push(`    ${el('EndDate', data(fim))}`);
  linhas.push(`    ${el('CurrencyCode', 'AOA')}`);
  linhas.push(`    ${el('DateCreated', data(new Date()))}`);
  linhas.push(`    ${el('TaxEntity', 'Global')}`);
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
  linhas.push(`      ${el('NumberOfEntries', String(faturas.length))}`);
  linhas.push(`      ${el('TotalDebit', dinheiro(0))}`);
  linhas.push(`      ${el('TotalCredit', dinheiro(totalTributavel))}`);

  for (const f of faturas) {
    const c = clienteDe(f);
    // Faturas anteriores à série certificada não têm número de série. Vão com a
    // referência interna, que é o que existe — inventar um número de série para
    // trás seria fabricar histórico, e a cadeia de integridade serve
    // precisamente para o detetar.
    const numero = f.serie && f.numeroNaSerie ? `${f.serie}/${f.numeroNaSerie}` : f.reference;

    linhas.push('      <Invoice>');
    linhas.push(`        ${el('InvoiceNo', numero)}`);
    linhas.push('        <DocumentStatus>');
    linhas.push(`          ${el('InvoiceStatus', f.status === 'ANULADA' ? 'A' : 'N')}`);
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
    linhas.push('        <DocumentTotals>');
    linhas.push(`          ${el('TaxPayable', dinheiro(f.taxAmount))}`);
    linhas.push(`          ${el('NetTotal', dinheiro(f.netAmount))}`);
    linhas.push(`          ${el('GrossTotal', dinheiro(f.amount))}`);
    linhas.push('        </DocumentTotals>');
    linhas.push('      </Invoice>');
  }

  linhas.push('    </SalesInvoices>');
  linhas.push('  </SourceDocuments>');
  linhas.push('</AuditFile>');

  return {
    xml: linhas.filter((l) => l.trim() !== '').join('\n'),
    resumo: {
      periodo: { de: data(ini), ate: data(fim) },
      documentos: faturas.length,
      clientes: clientes.size,
      totalTributavel: Number(totalTributavel.toFixed(2)),
      totalImposto: Number(totalImposto.toFixed(2)),
      totalDocumentos: Number(totalDocumentos.toFixed(2)),
      // Dito alto, e não descoberto na entrega: os documentos sem série são os
      // anteriores à faturação certificada.
      semSerieCertificada: faturas.filter((f) => !f.serie).length,
      porConfigurar: [
        config.faturacao?.nif ? null : 'KIXIMA_NIF',
        config.faturacao?.certificadoAgt ? null : 'KIXIMA_CERTIFICADO_AGT',
      ].filter(Boolean),
    },
  };
}

module.exports = { gerar, validarPeriodo };
