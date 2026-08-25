// tests/faturacao-agt.test.js
// Base técnica de faturação certificada (KX-01).
//
// O que estes testes protegem não é uma funcionalidade — é uma propriedade que
// não se corrige para trás. Uma numeração com um buraco, ou uma cadeia de hash
// partida, descobre-se numa inspeção da AGT, e nessa altura não há como emendar:
// as faturas já foram emitidas e entregues.
//
// A parte difícil não é gerar números sequenciais. É garantir que um número
// NÃO É CONSUMIDO quando a transação que o pediu falha. Um contador comum
// (INSERT … ON CONFLICT DO UPDATE, como o `reference_counters` desta mesma
// aplicação) incrementa numa instrução independente e deixa buraco. É por isso
// que a série usa SELECT … FOR UPDATE dentro da transação da fatura, e é isso
// que o teste do rollback mede.
//
// A SÉRIE É POR FORNECEDOR, NÃO GLOBAL (ver faturacaoService.js): cada empresa
// é o emitente fiscal das suas próprias faturas. Por isso `codigo` é sempre
// explícito nestes testes — nunca uma variável de ambiente global — e há um
// bloco dedicado a provar que dois fornecedores nunca partilham numeração.

const { prisma } = require('./helpers');
const faturacao = require('../src/services/faturacaoService');
const saft = require('../src/services/saftService');

const SERIE = 'TESTE';
const SERIE_NC = `${SERIE}-NC`;

afterAll(async () => {
  await prisma.creditNote.deleteMany({ where: { serie: SERIE_NC } });
  await prisma.invoice.deleteMany({ where: { serie: SERIE } });
  await prisma.$executeRaw`DELETE FROM "series_faturacao" WHERE "codigo" IN (${SERIE}, ${SERIE_NC})`;
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.creditNote.deleteMany({ where: { serie: SERIE_NC } });
  await prisma.invoice.deleteMany({ where: { serie: SERIE } });
  await prisma.$executeRaw`DELETE FROM "series_faturacao" WHERE "codigo" IN (${SERIE}, ${SERIE_NC})`;
});

// Nota de crédito mínima, com a série própria (nunca a da fatura), na mesma
// transação — mesmo padrão de `emitir()`, sem passar pelo creditNoteService
// (RBAC e regras de negócio já são cobertas em credit-note.test.js; aqui
// interessa só a numeração e a integração com o SAF-T).
async function emitirNotaCredito(invoiceId, valor, motivo = 'Correção de teste', codigo = SERIE_NC) {
  return prisma.$transaction(async (tx) => {
    const certificacao = await faturacao.atribuir(tx, { emitidaEm: new Date(), total: valor, codigo });
    return tx.creditNote.create({
      data: {
        ...certificacao,
        reference: `NC-TESTE-${certificacao.numeroNaSerie}-${Math.random().toString(36).slice(2, 8)}`,
        invoiceId,
        motivo,
        amount: valor,
        netAmount: valor,
        taxAmount: 0,
        currency: 'AOA',
      },
    });
  });
}

// Cria uma fatura mínima com numeração certificada, na mesma transação.
// `purchaseOrderId` só é preciso quando o teste depende do SAF-T conseguir
// atribuí-la a um fornecedor (o gerador filtra por essa relação — ver
// saftService.js) — os testes de numeração/cadeia não precisam dela.
async function emitir(total = 1000, { rebentar = false, codigo = SERIE, purchaseOrderId = null, linhas = null } = {}) {
  return prisma.$transaction(async (tx) => {
    const certificacao = await faturacao.atribuir(tx, { emitidaEm: new Date(), total, codigo });
    const criada = await tx.invoice.create({
      data: {
        ...certificacao,
        reference: `FAT-TESTE-${certificacao.numeroNaSerie ?? 0}-${Math.random().toString(36).slice(2, 8)}`,
        purchaseOrderId,
        amount: total,
        netAmount: total,
        taxAmount: 0,
        currency: 'AOA',
        dueAt: new Date(Date.now() + 7 * 86400000),
        status: 'PENDENTE',
        ...(linhas ? { lines: { create: linhas } } : {}),
      },
      include: { lines: true },
    });
    if (rebentar) throw new Error('falha depois de atribuir o número');
    return criada;
  });
}

describe('Numeração da série', () => {
  test('começa no 1 e não salta', async () => {
    const a = await emitir();
    const b = await emitir();
    const c = await emitir();
    expect([a.numeroNaSerie, b.numeroNaSerie, c.numeroNaSerie]).toEqual([1, 2, 3]);
    expect(a.serie).toBe(SERIE);
  });

  test('uma transação que falha NÃO consome o número', async () => {
    // É este o teste que justifica o desenho todo. Com um contador
    // independente, a emissão seguinte receberia o 3 e o 2 ficaria por
    // explicar — e "onde está a fatura 2?" é a pergunta que não tem resposta
    // boa numa inspeção.
    await emitir();
    await expect(emitir(500, { rebentar: true })).rejects.toThrow(/falha depois/);

    const seguinte = await emitir();
    expect(seguinte.numeroNaSerie).toBe(2);
  });

  test('emissões simultâneas não recebem o mesmo número', async () => {
    const resultados = await Promise.all([emitir(100), emitir(200), emitir(300), emitir(400)]);
    const numeros = resultados.map((r) => r.numeroNaSerie).sort((x, y) => x - y);
    expect(numeros).toEqual([1, 2, 3, 4]);
  });

  test('a base recusa dois documentos com o mesmo número na série', async () => {
    const primeira = await emitir();
    await expect(prisma.invoice.create({
      data: {
        serie: SERIE,
        numeroNaSerie: primeira.numeroNaSerie,
        reference: 'FAT-DUPLICADA',
        amount: 1, netAmount: 1, taxAmount: 0, currency: 'AOA',
        dueAt: new Date(), status: 'PENDENTE',
      },
    })).rejects.toThrow();
  });
});

describe('Cadeia de integridade', () => {
  test('cada documento agarra-se ao anterior', async () => {
    const a = await emitir(1000);
    const b = await emitir(2000);

    expect(a.hashAnterior).toBeNull();
    expect(a.hashDocumento).toEqual(expect.any(String));
    expect(b.hashAnterior).toBe(a.hashDocumento);
    expect(b.hashDocumento).not.toBe(a.hashDocumento);
  });

  test('a verificação diz que está íntegra quando está', async () => {
    await emitir(1000);
    await emitir(2000);
    const r = await faturacao.verificarCadeia(SERIE);
    expect(r.documentos).toBe(2);
    expect(r.integra).toBe(true);
    expect(r.problemas).toEqual([]);
  });

  test('alterar o valor de uma fatura emitida é DETETADO', async () => {
    const a = await emitir(1000);
    await emitir(2000);

    // Alteração feita por baixo do serviço, como faria quem quisesse esconder
    // alguma coisa. O hash deixa de bater com o conteúdo.
    await prisma.invoice.update({ where: { id: a.id }, data: { amount: 999999 } });

    const r = await faturacao.verificarCadeia(SERIE);
    expect(r.integra).toBe(false);
    expect(r.problemas.map((p) => p.tipo)).toContain('DOCUMENTO_ALTERADO');
  });

  test('apagar uma fatura do meio parte a numeração E a cadeia', async () => {
    await emitir(1000);
    const meio = await emitir(2000);
    await emitir(3000);

    await prisma.invoice.delete({ where: { id: meio.id } });

    const r = await faturacao.verificarCadeia(SERIE);
    expect(r.integra).toBe(false);
    const tipos = r.problemas.map((p) => p.tipo);
    expect(tipos).toContain('BURACO_NA_NUMERACAO');
    expect(tipos).toContain('ELO_PARTIDO');
  });

  test('a verificação relata TODOS os problemas, não só o primeiro', async () => {
    const a = await emitir(1000);
    const b = await emitir(2000);
    await prisma.invoice.update({ where: { id: a.id }, data: { amount: 111 } });
    await prisma.invoice.update({ where: { id: b.id }, data: { amount: 222 } });

    const r = await faturacao.verificarCadeia(SERIE);
    // Parar no primeiro obrigaria a corrigir e repetir N vezes para ver N
    // problemas — num relatório de integridade isso é inútil.
    expect(r.problemas.filter((p) => p.tipo === 'DOCUMENTO_ALTERADO').length).toBe(2);
  });

  test('verificarCadeia exige um código de série — já não há uma série global única', async () => {
    const r = await faturacao.verificarCadeia();
    expect(r.verificada).toBe(false);
  });
});

describe('Desligada, nada muda', () => {
  test('sem código de série, a fatura sai como sempre saiu', async () => {
    const semSerie = await emitir(1234, { codigo: null });
    expect(semSerie.serie).toBeNull();
    expect(semSerie.numeroNaSerie).toBeNull();
    expect(semSerie.hashDocumento).toBeNull();
  });
});

describe('Notas de crédito', () => {
  test('tem série e numeração PRÓPRIAS, independentes da fatura', async () => {
    const fatura = await emitir(1000);
    const nc1 = await emitirNotaCredito(fatura.id, 300);
    const nc2 = await emitirNotaCredito(fatura.id, 200);

    expect(nc1.serie).toBe(SERIE_NC);
    expect(nc1.serie).not.toBe(fatura.serie);
    expect([nc1.numeroNaSerie, nc2.numeroNaSerie]).toEqual([1, 2]);
    // Cadeia de hash própria: a primeira nota de crédito não se agarra a
    // nenhuma fatura — começa a sua própria cadeia.
    expect(nc1.hashAnterior).toBeNull();
    expect(nc2.hashAnterior).toBe(nc1.hashDocumento);
  });

  test('a base recusa duas notas de crédito com o mesmo número na série', async () => {
    const fatura = await emitir(1000);
    const primeira = await emitirNotaCredito(fatura.id, 100);
    await expect(prisma.creditNote.create({
      data: {
        serie: SERIE_NC,
        numeroNaSerie: primeira.numeroNaSerie,
        reference: 'NC-DUPLICADA',
        invoiceId: fatura.id,
        motivo: 'x',
        amount: 1,
      },
    })).rejects.toThrow();
  });
});

describe('Isolamento por fornecedor', () => {
  test('serieFiscalDoFornecedor / serieNotaCreditoDoFornecedor derivam SEMPRE da empresa, nunca de uma variável global', () => {
    expect(faturacao.serieFiscalDoFornecedor({ serieFiscal: 'A' })).toBe('A');
    expect(faturacao.serieFiscalDoFornecedor({ serieFiscal: null })).toBeNull();
    expect(faturacao.serieFiscalDoFornecedor(null)).toBeNull();
    expect(faturacao.serieNotaCreditoDoFornecedor({ serieFiscal: 'A' })).toBe('A-NC');
    expect(faturacao.serieNotaCreditoDoFornecedor({ serieFiscal: null })).toBeNull();
  });

  test('duas empresas fornecedoras diferentes NUNCA partilham a mesma numeração', async () => {
    const SERIE_A = `${SERIE}-ISOA`;
    const SERIE_B = `${SERIE}-ISOB`;
    try {
      const a1 = await emitir(100, { codigo: SERIE_A });
      const b1 = await emitir(200, { codigo: SERIE_B });
      const a2 = await emitir(100, { codigo: SERIE_A });
      const b2 = await emitir(200, { codigo: SERIE_B });

      // Cada série começa no 1 e conta sozinha — uma fatura do fornecedor B
      // entre as duas do fornecedor A não lhe rouba nem lhe empresta números.
      expect([a1.numeroNaSerie, a2.numeroNaSerie]).toEqual([1, 2]);
      expect([b1.numeroNaSerie, b2.numeroNaSerie]).toEqual([1, 2]);
      expect(a1.serie).toBe(SERIE_A);
      expect(b1.serie).toBe(SERIE_B);
    } finally {
      await prisma.invoice.deleteMany({ where: { serie: { in: [SERIE_A, SERIE_B] } } });
      await prisma.$executeRaw`DELETE FROM "series_faturacao" WHERE "codigo" IN (${SERIE_A}, ${SERIE_B})`;
    }
  });
});

describe('numeroDocumentoAGT', () => {
  test('formato exato do exemplo oficial (FACTURA.png): série + ano + sequencial com 7 dígitos, sem letra de tipo', () => {
    expect(faturacao.numeroDocumentoAGT({ serie: '000AB', ano: 2025, numeroNaSerie: 1 })).toBe('000AB.2025/0000001');
  });

  test('sem série ou sem número atribuído, devolve null em vez de inventar', () => {
    expect(faturacao.numeroDocumentoAGT({ serie: null, ano: 2025, numeroNaSerie: 1 })).toBeNull();
    expect(faturacao.numeroDocumentoAGT({ serie: 'X', ano: 2025, numeroNaSerie: null })).toBeNull();
    expect(faturacao.numeroDocumentoAGT()).toBeNull();
  });
});

describe('arredondarPorExcessoAoCentimo', () => {
  test('os três exemplos oficiais da especificação DS.120 (sempre por excesso, nunca ao mais próximo)', () => {
    expect(faturacao.arredondarPorExcessoAoCentimo(23.144)).toBeCloseTo(23.15, 2);
    expect(faturacao.arredondarPorExcessoAoCentimo(0.001844)).toBeCloseTo(0.01, 2);
    expect(faturacao.arredondarPorExcessoAoCentimo(5.9999999)).toBeCloseTo(6.00, 2);
  });
});

describe('linhasFaturaAGT', () => {
  test('gera uma linha por item, com IVA por linha e o código de imposto normal', () => {
    const items = [
      { quantity: 2, unitPrice: 500, lineTotal: 1000, productId: 'p1', product: { sku: 'SKU-1', name: 'Produto 1' } },
      { quantity: 1, unitPrice: 300, lineTotal: 300, productId: 'p2', product: { unspscCode: 'UNSPSC-2', name: 'Produto 2' } },
    ];
    const linhas = faturacao.linhasFaturaAGT(items);

    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({
      lineNumber: 1, productCode: 'SKU-1', description: 'Produto 1',
      netAmount: 1000, ivaAmount: 140, ivaTaxCode: faturacao.AGT_TAX_CODE_NORMAL,
    });
    // sku tem prioridade sobre unspscCode — só cai para o código UNSPSC quando não há sku.
    expect(linhas[1]).toMatchObject({ lineNumber: 2, productCode: 'UNSPSC-2', netAmount: 300, ivaAmount: 42 });
  });

  test('sem sku nem unspscCode, usa o id do produto — nunca um código vazio', () => {
    const linhas = faturacao.linhasFaturaAGT([{ quantity: 1, unitPrice: 10, lineTotal: 10, productId: 'p-sem-sku', product: {} }]);
    expect(linhas[0].productCode).toBe('p-sem-sku');
  });
});

describe('Data de adesão à faturação eletrónica', () => {
  const CODIGO = `${SERIE}-ADESAO`;

  afterEach(async () => {
    await prisma.invoice.deleteMany({ where: { serie: CODIGO } });
    await prisma.$executeRaw`DELETE FROM "series_faturacao" WHERE "codigo" = ${CODIGO}`;
  });

  // atribuir() é o MESMO mecanismo para fatura, nota de crédito e recibo — só
  // muda o `codigo` da série que quem chama resolve. Testar aqui cobre os três.
  test('recusa atribuir número a um documento datado antes da adesão da empresa', async () => {
    const dataAdesao = new Date('2026-01-01');
    await expect(prisma.$transaction((tx) => faturacao.atribuir(tx, {
      emitidaEm: new Date('2025-12-31'), total: 1000, codigo: CODIGO, dataAdesao,
    }))).rejects.toThrow(/anterior à data de/);
  });

  test('aceita um documento emitido na própria data de adesão, ou depois', async () => {
    const dataAdesao = new Date('2026-01-01');
    const naData = await prisma.$transaction((tx) => faturacao.atribuir(tx, {
      emitidaEm: new Date('2026-01-01'), total: 1000, codigo: CODIGO, dataAdesao,
    }));
    expect(naData.numeroNaSerie).toBe(1);

    const depois = await prisma.$transaction((tx) => faturacao.atribuir(tx, {
      emitidaEm: new Date('2026-06-01'), total: 1000, codigo: CODIGO, dataAdesao,
    }));
    expect(depois.numeroNaSerie).toBe(2);
  });

  test('sem data de adesão definida (null), não valida nada — o comportamento de sempre', async () => {
    const cert = await prisma.$transaction((tx) => faturacao.atribuir(tx, {
      emitidaEm: new Date('2000-01-01'), total: 1000, codigo: CODIGO, dataAdesao: null,
    }));
    expect(cert.numeroNaSerie).toBe(1);
  });
});

describe('Recibo fiscal (documento RC)', () => {
  test('serieReciboDoFornecedor deriva SEMPRE da empresa, sufixo "-RC", nunca uma variável global', () => {
    expect(faturacao.serieReciboDoFornecedor({ serieFiscal: 'A' })).toBe('A-RC');
    expect(faturacao.serieReciboDoFornecedor({ serieFiscal: null })).toBeNull();
    expect(faturacao.serieReciboDoFornecedor(null)).toBeNull();
  });

  test('o Payment ganha série, numeração e cadeia de hash próprias, na série -RC do fornecedor', async () => {
    const SERIE_RC = `${SERIE}-RC`;
    try {
      const fatura1 = await emitir(1000);
      const fatura2 = await emitir(2000);

      const cert1 = await prisma.$transaction((tx) => faturacao.atribuir(tx, { emitidaEm: new Date(), total: 1000, codigo: SERIE_RC }));
      const rec1 = await prisma.payment.create({
        data: {
          ...cert1, invoiceId: fatura1.id, amount: 1000, currency: 'AOA',
          reference: `PAY-TESTE-${Math.random().toString(36).slice(2, 8)}`, status: 'PROCESSADO',
        },
      });
      const cert2 = await prisma.$transaction((tx) => faturacao.atribuir(tx, { emitidaEm: new Date(), total: 2000, codigo: SERIE_RC }));
      const rec2 = await prisma.payment.create({
        data: {
          ...cert2, invoiceId: fatura2.id, amount: 2000, currency: 'AOA',
          reference: `PAY-TESTE-${Math.random().toString(36).slice(2, 8)}`, status: 'PROCESSADO',
        },
      });

      expect(rec1.serie).toBe(SERIE_RC);
      expect(rec1.numeroNaSerie).toBe(1);
      expect(rec1.hashAnterior).toBeNull();
      expect(rec1.hashDocumento).toEqual(expect.any(String));
      // Cadeia própria do recibo: agarra-se ao recibo anterior, nunca à fatura.
      expect(rec2.numeroNaSerie).toBe(2);
      expect(rec2.hashAnterior).toBe(rec1.hashDocumento);
    } finally {
      await prisma.payment.deleteMany({ where: { serie: SERIE_RC } });
      await prisma.$executeRaw`DELETE FROM "series_faturacao" WHERE "codigo" = ${SERIE_RC}`;
    }
  });
});

describe('SAF-T (AO)', () => {
  // O SAF-T é sempre de UMA empresa fornecedora (ver saftService.js) — os
  // testes usam o fornecedor semeado (Kianda) com faturas ligadas a uma PO
  // real, porque é essa ligação que o gerador usa para filtrar.
  let fornecedorId;
  let compradorId;
  let compradorUserId;
  let posCriadas = [];

  beforeAll(async () => {
    const fornecedor = await prisma.company.findUnique({ where: { taxId: 'AO-FOR-0001' } });
    const comprador = await prisma.company.findUnique({ where: { taxId: 'AO-CLI-0001' } });
    const compradorUser = await prisma.user.findUnique({ where: { email: 'comprador@petroangola.co.ao' } });
    fornecedorId = fornecedor.id;
    compradorId = comprador.id;
    compradorUserId = compradorUser.id;
  });

  afterEach(async () => {
    if (posCriadas.length) {
      await prisma.purchaseOrder.deleteMany({ where: { id: { in: posCriadas } } });
      posCriadas = [];
    }
  });

  async function criarPO(supplierCompanyId = fornecedorId) {
    const po = await prisma.purchaseOrder.create({
      data: {
        reference: `PO-TESTE-SAFT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        buyerCompanyId: compradorId,
        supplierCompanyId,
        createdById: compradorUserId,
        totalAmount: 1,
        status: 'CONCLUIDA',
      },
    });
    posCriadas.push(po.id);
    return po;
  }

  async function emitirDoFornecedor(total, opts = {}) {
    const po = await criarPO();
    return emitir(total, { ...opts, purchaseOrderId: po.id });
  }

  test('exige um período, e recusa datas invertidas', async () => {
    await expect(saft.gerar({ de: 'ontem', ate: 'hoje', supplierCompanyId: fornecedorId })).rejects.toThrow(/AAAA-MM-DD/);
    await expect(saft.gerar({ de: '2030-01-01', ate: '2020-01-01', supplierCompanyId: fornecedorId })).rejects.toThrow(/posterior/);
  });

  test('exige a empresa fornecedora — o SAF-T nunca é de "todos"', async () => {
    await expect(saft.gerar({ de: '2020-01-01', ate: '2035-12-31' })).rejects.toThrow(/supplierCompanyId/);
  });

  test('produz XML bem formado com o cabeçalho e os totais', async () => {
    await emitirDoFornecedor(1000);
    await emitirDoFornecedor(2000);

    const { xml, resumo } = await saft.gerar({ de: '2020-01-01', ate: '2035-12-31', supplierCompanyId: fornecedorId });
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<AuditFile');
    expect(xml).toContain('</AuditFile>');
    expect(xml).toContain('<SalesInvoices>');
    // Cada abertura tem o seu fecho — o erro mais banal a construir XML à mão.
    for (const tag of ['Header', 'MasterFiles', 'SourceDocuments', 'SalesInvoices']) {
      expect((xml.match(new RegExp(`<${tag}>`, 'g')) || []).length)
        .toBe((xml.match(new RegExp(`</${tag}>`, 'g')) || []).length);
    }
    expect(resumo.documentos).toBeGreaterThanOrEqual(2);
  });

  test('o CompanyID do cabeçalho é do FORNECEDOR, nunca da KIXIMA', async () => {
    const fornecedor = await prisma.company.findUnique({ where: { id: fornecedorId } });
    await emitirDoFornecedor(1000);

    const { xml, resumo } = await saft.gerar({ de: '2020-01-01', ate: '2035-12-31', supplierCompanyId: fornecedorId });
    expect(xml).toContain(`<CompanyID>${fornecedor.taxId}</CompanyID>`);
    expect(xml).toContain(`<CompanyName>${fornecedor.name}</CompanyName>`);
    expect(resumo.fornecedor.id).toBe(fornecedorId);
  });

  test('as faturas de UM fornecedor não aparecem no SAF-T de outro', async () => {
    const outroFornecedor = await prisma.company.create({
      data: { name: 'Fornecedora Isolada Teste', taxId: `AO-TEST-ISO-${Date.now()}`, type: 'FORNECEDOR', contactEmail: 'iso@test.co.ao', status: 'APROVADA' },
    });
    try {
      const poOutro = await criarPO(outroFornecedor.id);
      const faturaOutro = await emitir(500, { purchaseOrderId: poOutro.id });
      await emitirDoFornecedor(1000);

      const numeroOutro = faturacao.numeroDocumentoAGT({
        serie: faturaOutro.serie, ano: faturaOutro.issuedAt.getFullYear(), numeroNaSerie: faturaOutro.numeroNaSerie,
      });
      const { xml } = await saft.gerar({ de: '2020-01-01', ate: '2035-12-31', supplierCompanyId: fornecedorId });
      expect(xml).not.toContain(numeroOutro);

      const { xml: xmlOutro, resumo: resumoOutro } = await saft.gerar({ de: '2020-01-01', ate: '2035-12-31', supplierCompanyId: outroFornecedor.id });
      expect(xmlOutro).toContain(numeroOutro);
      expect(resumoOutro.fornecedor.id).toBe(outroFornecedor.id);
    } finally {
      // A fatura e a PO têm de sair ANTES da empresa — é a fatura que a
      // referencia, não o contrário.
      await prisma.invoice.deleteMany({ where: { purchaseOrder: { supplierCompanyId: outroFornecedor.id } } });
      await prisma.purchaseOrder.deleteMany({ where: { supplierCompanyId: outroFornecedor.id } });
      await prisma.company.delete({ where: { id: outroFornecedor.id } });
    }
  });

  test('escapa caracteres que partiriam o XML', async () => {
    // Um nome de empresa com "&" é comum, e produz um ficheiro que a AGT
    // recusa sem dizer porquê.
    const empresa = await prisma.company.findUnique({ where: { id: compradorId } });
    const nomeOriginal = empresa.name;
    await prisma.company.update({ where: { id: empresa.id }, data: { name: 'Sonangol & Filhos <Lda>' } });
    try {
      await emitirDoFornecedor(1000);
      const { xml } = await saft.gerar({ de: '2020-01-01', ate: '2035-12-31', supplierCompanyId: fornecedorId });
      expect(xml).not.toContain('Sonangol & Filhos <Lda>');
      expect(xml).toContain('Sonangol &amp; Filhos &lt;Lda&gt;');
    } finally {
      await prisma.company.update({ where: { id: empresa.id }, data: { name: nomeOriginal } });
    }
  });

  test('emite <Line> por fatura, com o código/descrição/imposto da InvoiceLine — e o InvoiceNo no formato oficial', async () => {
    const fatura = await emitirDoFornecedor(1140, {
      linhas: [{
        lineNumber: 1, productCode: 'SKU-SAFT-1', description: 'Produto de teste SAF-T',
        quantity: 2, unitPrice: 500, netAmount: 1000, ivaAmount: 140, ivaTaxCode: 'NOR',
      }],
    });

    const { xml } = await saft.gerar({ de: '2020-01-01', ate: '2035-12-31', supplierCompanyId: fornecedorId });
    expect(xml).toContain('<ProductCode>SKU-SAFT-1</ProductCode>');
    expect(xml).toContain('<ProductDescription>Produto de teste SAF-T</ProductDescription>');
    expect(xml).toContain('<Quantity>2</Quantity>');
    expect(xml).toContain('<UnitPrice>500.00</UnitPrice>');
    expect(xml).toContain('<TaxCode>NOR</TaxCode>');
    expect(xml).toContain('<TaxAmount>140.00</TaxAmount>');
    for (const tag of ['Line', 'Tax']) {
      expect((xml.match(new RegExp(`<${tag}>`, 'g')) || []).length)
        .toBe((xml.match(new RegExp(`</${tag}>`, 'g')) || []).length);
    }

    const numero = faturacao.numeroDocumentoAGT({
      serie: fatura.serie, ano: fatura.issuedAt.getFullYear(), numeroNaSerie: fatura.numeroNaSerie,
    });
    expect(xml).toContain(`<InvoiceNo>${numero}</InvoiceNo>`);
    expect(numero).toMatch(/^.+\.\d{4}\/\d{7}$/);
  });

  test('diz o que ficou por configurar em vez de inventar', async () => {
    const { resumo } = await saft.gerar({ de: '2020-01-01', ate: '2035-12-31', supplierCompanyId: fornecedorId });
    // Um número de certificado inventado num ficheiro fiscal é pior do que um
    // campo por preencher: o primeiro é uma declaração falsa.
    expect(resumo.porConfigurar).toContain('KIXIMA_CERTIFICADO_AGT');
    expect(typeof resumo.semSerieCertificada).toBe('number');
  });

  test('uma nota de crédito emitida no período entra como InvoiceType=NC, referenciando a fatura original', async () => {
    const fatura = await emitirDoFornecedor(1000);
    const nota = await emitirNotaCredito(fatura.id, 300, 'Devolução parcial');

    const { xml } = await saft.gerar({ de: '2020-01-01', ate: '2035-12-31', supplierCompanyId: fornecedorId });
    expect((xml.match(/InvoiceType>NC</g) || []).length).toBeGreaterThanOrEqual(1);
    const numeroNota = faturacao.numeroDocumentoAGT({
      serie: nota.serie, ano: nota.issuedAt.getFullYear(), numeroNaSerie: nota.numeroNaSerie,
    });
    expect(xml).toContain(numeroNota);
    expect(xml).toContain('Devolução parcial');
    // A referência aponta para a fatura original, nunca um valor arbitrário.
    const numeroFatura = faturacao.numeroDocumentoAGT({
      serie: fatura.serie, ano: fatura.issuedAt.getFullYear(), numeroNaSerie: fatura.numeroNaSerie,
    });
    expect(xml).toContain(`<Reference>${numeroFatura}</Reference>`);
  });

  test('o status da fatura é A (anulada) só quando totalmente creditada — nunca a string morta "ANULADA"', async () => {
    const parcial = await emitirDoFornecedor(1000);
    await emitirNotaCredito(parcial.id, 400);
    const total = await emitirDoFornecedor(2000);
    await emitirNotaCredito(total.id, 2000);

    const { xml } = await saft.gerar({ de: '2020-01-01', ate: '2035-12-31', supplierCompanyId: fornecedorId });
    // Isola o bloco <Invoice> de cada fatura pelo seu InvoiceNo para verificar
    // o InvoiceStatus correspondente sem depender da ordem no XML.
    const statusDe = (numero) => {
      const inicio = xml.indexOf(`<InvoiceNo>${numero}</InvoiceNo>`);
      const bloco = xml.slice(inicio, xml.indexOf('</Invoice>', inicio));
      return bloco.match(/<InvoiceStatus>(.)<\/InvoiceStatus>/)[1];
    };
    expect(statusDe(faturacao.numeroDocumentoAGT({
      serie: parcial.serie, ano: parcial.issuedAt.getFullYear(), numeroNaSerie: parcial.numeroNaSerie,
    }))).toBe('N');
    expect(statusDe(faturacao.numeroDocumentoAGT({
      serie: total.serie, ano: total.issuedAt.getFullYear(), numeroNaSerie: total.numeroNaSerie,
    }))).toBe('A');
  });

  test('NumberOfEntries conta faturas E notas de crédito do período', async () => {
    const fatura = await emitirDoFornecedor(1000);
    await emitirNotaCredito(fatura.id, 100);
    await emitirNotaCredito(fatura.id, 100);

    const { xml } = await saft.gerar({ de: '2020-01-01', ate: '2035-12-31', supplierCompanyId: fornecedorId });
    const n = Number(xml.match(/<NumberOfEntries>(\d+)<\/NumberOfEntries>/)[1]);
    expect(n).toBeGreaterThanOrEqual(3); // 1 fatura + 2 notas de crédito
  });
});
