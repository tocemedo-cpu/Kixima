// tests/agt-payload.test.js
// Payload de submissão AGT (e-Fatura, schema v1.2) — FT/NC/RC.
//
// A configuração (chave privada RSA + número de validação) é lida UMA VEZ,
// ao carregar agtSigningService.js — por isso um par de chaves de teste é
// injetado em process.env ANTES de qualquer require dos serviços, aqui no
// topo do ficheiro. O caso "sem configuração" vive à parte
// (agt-signing-sem-configuracao.test.js), porque não se pode alternar
// "configurado"/"não configurado" dentro do mesmo ficheiro.
const crypto = require('crypto');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
process.env.AGT_JWS_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString('base64');
process.env.AGT_SOFTWARE_VALIDATION_NUMBER = 'FE/00/2025/AGT-TESTE';

const { auth, prisma, login } = require('./helpers');
const faturacaoService = require('../src/services/faturacaoService');
const agtPayloadService = require('../src/services/agtPayloadService');

const SERIE = 'TESTE-AGTPAY';
const SERIE_NC = `${SERIE}-NC`;
const SERIE_RC = `${SERIE}-RC`;
const SERIE_RET = `${SERIE}-RET`;
const SERIE_RET_NC = `${SERIE_RET}-NC`;
const SERIE_RET_RC = `${SERIE_RET}-RC`;

function base64urlParaBuffer(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

// Verifica um JWS compacto contra a chave pública de teste e devolve o
// cabeçalho/payload descodificados, para os testes comparares o que foi
// realmente assinado.
function verificarJWS(jws) {
  const [h, p, s] = jws.split('.');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`, 'utf8'), publicKey, base64urlParaBuffer(s));
  return {
    ok,
    header: JSON.parse(base64urlParaBuffer(h).toString('utf8')),
    payload: JSON.parse(base64urlParaBuffer(p).toString('utf8')),
  };
}

let fornecedorId;
let fornecedorTaxId;
let compradorId;
let compradorUserId;
let fornecedorToken;
let poId;
let poIdRet;
let invoice;
let creditNote;
let payment;
let invoiceComRetencao;
let creditNoteComRetencao;
let paymentComRetencao;

beforeAll(async () => {
  const fornecedor = await prisma.company.findUnique({ where: { taxId: 'AO-FOR-0001' } });
  const comprador = await prisma.company.findUnique({ where: { taxId: 'AO-CLI-0001' } });
  const compradorUser = await prisma.user.findUnique({ where: { email: 'comprador@petroangola.co.ao' } });
  fornecedorId = fornecedor.id;
  fornecedorTaxId = fornecedor.taxId;
  compradorId = comprador.id;
  compradorUserId = compradorUser.id;
  fornecedorToken = await login('fornecedor@kianda.co.ao');

  const po = await prisma.purchaseOrder.create({
    data: {
      reference: `PO-TESTE-AGTPAY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      buyerCompanyId: compradorId, supplierCompanyId: fornecedorId, createdById: compradorUserId,
      totalAmount: 1, status: 'CONCLUIDA',
    },
  });
  poId = po.id;

  // Invoice.purchaseOrderId é único (uma fatura por PO) — o segundo conjunto
  // (com retenção) precisa da sua própria PO.
  const poRet = await prisma.purchaseOrder.create({
    data: {
      reference: `PO-TESTE-AGTPAY-RET-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      buyerCompanyId: compradorId, supplierCompanyId: fornecedorId, createdById: compradorUserId,
      totalAmount: 1, status: 'CONCLUIDA',
    },
  });
  poIdRet = poRet.id;

  invoice = await prisma.$transaction(async (tx) => {
    const certificacao = await faturacaoService.atribuir(tx, { emitidaEm: new Date(), total: 1140, codigo: SERIE });
    return tx.invoice.create({
      data: {
        ...certificacao,
        reference: `FAT-TESTE-AGTPAY-${Math.random().toString(36).slice(2, 8)}`,
        purchaseOrderId: poId,
        amount: 1140, netAmount: 1000, taxAmount: 140, withholdingAmount: 0,
        currency: 'AOA', dueAt: new Date(Date.now() + 7 * 86400000), status: 'PENDENTE',
        lines: {
          create: [{
            lineNumber: 1, productCode: 'SKU-AGT-1', description: 'Produto AGT teste',
            quantity: 2, unitPrice: 500, netAmount: 1000, ivaAmount: 140, ivaTaxCode: 'NOR',
          }],
        },
      },
      include: { lines: true },
    });
  });

  creditNote = await prisma.$transaction(async (tx) => {
    const certificacao = await faturacaoService.atribuir(tx, { emitidaEm: new Date(), total: 228, codigo: SERIE_NC });
    return tx.creditNote.create({
      data: {
        ...certificacao, reference: `NC-TESTE-AGTPAY-${Math.random().toString(36).slice(2, 8)}`,
        invoiceId: invoice.id, motivo: 'Correção de teste AGT', amount: 228, netAmount: 200, taxAmount: 28, currency: 'AOA',
      },
    });
  });

  payment = await prisma.$transaction(async (tx) => {
    const certificacao = await faturacaoService.atribuir(tx, { emitidaEm: new Date(), total: Number(invoice.amount), codigo: SERIE_RC });
    return tx.payment.create({
      data: {
        ...certificacao, invoiceId: invoice.id, amount: invoice.amount, currency: 'AOA',
        reference: `PAY-TESTE-AGTPAY-${Math.random().toString(36).slice(2, 8)}`, status: 'PROCESSADO',
      },
    });
  });

  // Segundo conjunto: fatura COM retenção (serviço), para exercitar
  // withholdingTaxList em FT/NC/RC — o primeiro conjunto acima fica sem
  // retenção de propósito (a lista tem de sair vazia nesse caso).
  invoiceComRetencao = await prisma.$transaction(async (tx) => {
    const certificacao = await faturacaoService.atribuir(tx, { emitidaEm: new Date(), total: 1140, codigo: SERIE_RET });
    return tx.invoice.create({
      data: {
        ...certificacao,
        reference: `FAT-TESTE-AGTPAY-RET-${Math.random().toString(36).slice(2, 8)}`,
        purchaseOrderId: poIdRet,
        amount: 1140, netAmount: 1000, taxAmount: 140, withholdingAmount: 65,
        currency: 'AOA', dueAt: new Date(Date.now() + 7 * 86400000), status: 'PENDENTE',
        lines: {
          create: [{
            lineNumber: 1, productCode: 'SVC-AGT-1', description: 'Serviço AGT teste',
            quantity: 1, unitPrice: 1000, netAmount: 1000, ivaAmount: 140, ivaTaxCode: 'NOR',
          }],
        },
      },
    });
  });

  creditNoteComRetencao = await prisma.$transaction(async (tx) => {
    const certificacao = await faturacaoService.atribuir(tx, { emitidaEm: new Date(), total: 570, codigo: SERIE_RET_NC });
    return tx.creditNote.create({
      data: {
        ...certificacao, reference: `NC-TESTE-AGTPAY-RET-${Math.random().toString(36).slice(2, 8)}`,
        invoiceId: invoiceComRetencao.id, motivo: 'Correção parcial (metade)', amount: 570, netAmount: 500, taxAmount: 70, currency: 'AOA',
      },
    });
  });

  paymentComRetencao = await prisma.$transaction(async (tx) => {
    const certificacao = await faturacaoService.atribuir(tx, { emitidaEm: new Date(), total: Number(invoiceComRetencao.amount), codigo: SERIE_RET_RC });
    return tx.payment.create({
      data: {
        ...certificacao, invoiceId: invoiceComRetencao.id, amount: invoiceComRetencao.amount, currency: 'AOA',
        reference: `PAY-TESTE-AGTPAY-RET-${Math.random().toString(36).slice(2, 8)}`, status: 'PROCESSADO',
      },
    });
  });
});

afterAll(async () => {
  await prisma.payment.deleteMany({ where: { serie: { in: [SERIE_RC, SERIE_RET_RC] } } });
  await prisma.creditNote.deleteMany({ where: { serie: { in: [SERIE_NC, SERIE_RET_NC] } } });
  await prisma.invoice.deleteMany({ where: { serie: { in: [SERIE, SERIE_RET] } } });
  await prisma.purchaseOrder.deleteMany({ where: { id: { in: [poId, poIdRet] } } });
  await prisma.$executeRaw`DELETE FROM "series_faturacao" WHERE "codigo" IN (${SERIE}, ${SERIE_NC}, ${SERIE_RC}, ${SERIE_RET}, ${SERIE_RET_NC}, ${SERIE_RET_RC})`;
  await prisma.$disconnect();
});

describe('construirPayload — FT (fatura)', () => {
  test('produz o envelope com schemaVersion 1.2, NIF do fornecedor e submissionUUID', async () => {
    const payload = await agtPayloadService.construirPayload('FT', invoice.id, fornecedorId);
    expect(payload.schemaVersion).toBe('1.2');
    expect(payload.taxRegistrationNumber).toBe(fornecedorTaxId);
    expect(payload.numberOfEntries).toBe(1);
    expect(payload.documents).toHaveLength(1);
    expect(payload.submissionUUID).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(payload.submissionTimeStamp).toString()).not.toBe('Invalid Date');
  });

  test('documentNo usa o formato "FT <numeroDocumentoAGT>", linhas e totais batem com a InvoiceLine/Invoice', async () => {
    const payload = await agtPayloadService.construirPayload('FT', invoice.id, fornecedorId);
    const doc = payload.documents[0];
    const numeroEsperado = faturacaoService.numeroDocumentoAGT({
      serie: invoice.serie, ano: invoice.assinadaEm.getFullYear(), numeroNaSerie: invoice.numeroNaSerie,
    });
    expect(doc.documentType).toBe('FT');
    expect(doc.documentNo).toBe(`FT ${numeroEsperado}`);
    expect(doc.lines).toHaveLength(1);
    expect(doc.lines[0]).toMatchObject({ productCode: 'SKU-AGT-1', quantity: 2, unitPrice: 500, creditAmount: 1000, debitAmount: 0 });
    expect(doc.lines[0].taxes[0]).toMatchObject({ taxType: 'IVA', taxCountryRegion: 'AO', taxCode: 'NOR', taxPercentage: 14, taxContribution: 140 });
    expect(doc.documentTotals).toEqual({ taxPayable: 140, netTotal: 1000, grossTotal: 1140 });
    expect(doc.withholdingTaxList).toEqual([]);
    // paymentReceipt "não é preenchido para os demais tipos de documentos de
    // facturação" (spec oficial 4.1.6) — fica undefined aqui (o objeto JS),
    // e a verificação de que a CHAVE desaparece do JSON final (não fica
    // null) está no teste do endpoint HTTP, abaixo.
    expect(doc.paymentReceipt).toBeUndefined();
  });

  test('jwsDocumentSignature verifica com a chave pública, sobre exatamente os 8 campos esperados (spec oficial AGT/SETIC-FP 4.1.6)', async () => {
    const payload = await agtPayloadService.construirPayload('FT', invoice.id, fornecedorId);
    const doc = payload.documents[0];
    const { ok, header, payload: assinado } = verificarJWS(doc.jwsDocumentSignature);
    expect(ok).toBe(true);
    expect(header).toEqual({ typ: 'JOSE', alg: 'RS256' });
    expect(assinado).toEqual({
      documentNo: doc.documentNo, taxRegistrationNumber: fornecedorTaxId, documentType: 'FT',
      documentDate: doc.documentDate, customerTaxID: doc.customerTaxID, customerCountry: doc.customerCountry, companyName: doc.companyName,
      documentTotals: doc.documentTotals,
    });
  });

  test('softwareInfo traz o número de validação e uma jwsSoftwareSignature verificável sobre só os 3 campos de softwareInfoDetail', async () => {
    const payload = await agtPayloadService.construirPayload('FT', invoice.id, fornecedorId);
    expect(payload.softwareInfo.softwareInfoDetail).toMatchObject({ productId: 'KIXIMA', softwareValidationNumber: 'FE/00/2025/AGT-TESTE' });
    const { ok, payload: assinado } = verificarJWS(payload.softwareInfo.jwsSoftwareSignature);
    expect(ok).toBe(true);
    expect(assinado).toEqual(payload.softwareInfo.softwareInfoDetail);
  });

  test('com retenção na fatura original, withholdingTaxList sai preenchida (IRT)', async () => {
    const payload = await agtPayloadService.construirPayload('FT', invoiceComRetencao.id, fornecedorId);
    expect(payload.documents[0].withholdingTaxList).toEqual([
      { withholdingTaxType: 'IRT', withholdingTaxDescription: 'Retenção na fonte', withholdingTaxAmount: 65 },
    ]);
  });
});

describe('construirPayload — NC (nota de crédito)', () => {
  test('gera uma linha sintética com referenceInfo apontando para a fatura original', async () => {
    const payload = await agtPayloadService.construirPayload('NC', creditNote.id, fornecedorId);
    const doc = payload.documents[0];
    const numeroFatura = faturacaoService.numeroDocumentoAGT({
      serie: invoice.serie, ano: invoice.assinadaEm.getFullYear(), numeroNaSerie: invoice.numeroNaSerie,
    });
    expect(doc.documentType).toBe('NC');
    expect(doc.lines).toHaveLength(1);
    expect(doc.lines[0].referenceInfo).toEqual({ reason: 'retificacao', reference: `FT ${numeroFatura}`, referenceItemLineNo: 1 });
    expect(doc.lines[0]).toMatchObject({ debitAmount: 200, creditAmount: 0 });
    expect(doc.documentTotals).toEqual({ taxPayable: 28, netTotal: 200, grossTotal: 228 });
    expect(doc.withholdingTaxList).toEqual([]); // fatura original sem retenção

    const { ok, payload: assinado } = verificarJWS(doc.jwsDocumentSignature);
    expect(ok).toBe(true);
    expect(assinado.documentType).toBe('NC');
  });

  test('retenção proporcional ao peso da NC sobre a fatura original, quando esta tinha retenção', async () => {
    const payload = await agtPayloadService.construirPayload('NC', creditNoteComRetencao.id, fornecedorId);
    // NC credita 500 de 1000 (metade) de uma fatura com 65 de retenção -> 32.5.
    expect(payload.documents[0].withholdingTaxList).toEqual([
      { withholdingTaxType: 'IRT', withholdingTaxDescription: 'Retenção na fonte', withholdingTaxAmount: 32.5 },
    ]);
  });
});

describe('construirPayload — RC (recibo)', () => {
  test('sem linhas, totais herdados da fatura quitada, paymentReceipt aponta para a fatura paga', async () => {
    const payload = await agtPayloadService.construirPayload('RC', payment.id, fornecedorId);
    const doc = payload.documents[0];
    const numeroFatura = faturacaoService.numeroDocumentoAGT({
      serie: invoice.serie, ano: invoice.assinadaEm.getFullYear(), numeroNaSerie: invoice.numeroNaSerie,
    });
    expect(doc.documentType).toBe('RC');
    expect(doc.lines).toEqual([]);
    expect(doc.documentTotals).toEqual({ taxPayable: 140, netTotal: 1000, grossTotal: 1140 });
    // paymentReceipt é obrigatório no RC (spec oficial 4.1.6) — liga o
    // recibo à fatura paga, não as "lines" (que ficam vazias).
    expect(doc.paymentReceipt).toEqual({
      sourceDocuments: [{
        lineNo: 1,
        sourceDocumentID: {
          originatingON: `FT ${numeroFatura}`,
          documentDate: invoice.assinadaEm.toISOString().slice(0, 10),
        },
        creditAmount: 1000,
      }],
    });
    const { ok } = verificarJWS(doc.jwsDocumentSignature);
    expect(ok).toBe(true);
  });

  test('herda a retenção da fatura que quita', async () => {
    const payload = await agtPayloadService.construirPayload('RC', paymentComRetencao.id, fornecedorId);
    expect(payload.documents[0].withholdingTaxList).toEqual([
      { withholdingTaxType: 'IRT', withholdingTaxDescription: 'Retenção na fonte', withholdingTaxAmount: 65 },
    ]);
  });
});

describe('Posse', () => {
  test('um fornecedor não consegue construir o payload de um documento de outra empresa', async () => {
    const outro = await prisma.company.create({
      data: { name: 'Fornecedora Isolada AGT', taxId: `AO-TEST-AGTPAY-${Date.now()}`, type: 'FORNECEDOR', contactEmail: 'iso-agt@test.co.ao', status: 'APROVADA' },
    });
    try {
      await expect(agtPayloadService.construirPayload('FT', invoice.id, outro.id)).rejects.toThrow(/não pertence/);
    } finally {
      await prisma.company.delete({ where: { id: outro.id } });
    }
  });

  test('endpoint HTTP: o fornecedor dono recebe o payload da sua própria fatura', async () => {
    const res = await auth(fornecedorToken).get(`/api/faturacao/agt-payload/FT/${invoice.id}`);
    expect(res.status).toBe(200);
    expect(res.body.documents[0].documentType).toBe('FT');
    expect(res.body.taxRegistrationNumber).toBe(fornecedorTaxId);
    // No JSON de verdade (depois de passar por res.json()/JSON.stringify),
    // "paymentReceipt" não é só null num tipo que não é RC — a chave
    // desaparece por completo, tal como a spec exige.
    expect(Object.prototype.hasOwnProperty.call(res.body.documents[0], 'paymentReceipt')).toBe(false);
  });
});

describe('Tipo de documento não suportado', () => {
  test('FR não tem produtor automático no KIXIMA — mensagem explica, não inventa um documento', async () => {
    await expect(agtPayloadService.construirPayload('FR', invoice.id, fornecedorId))
      .rejects.toThrow(/FR não tem produtor automático/);
  });

  test('tipo desconhecido é rejeitado', async () => {
    await expect(agtPayloadService.construirPayload('XX', invoice.id, fornecedorId))
      .rejects.toThrow(/não suportado/);
  });
});
