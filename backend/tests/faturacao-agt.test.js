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
async function emitir(total = 1000, { rebentar = false, codigo = SERIE, purchaseOrderId = null } = {}) {
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
      },
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

      const numeroOutro = `${faturaOutro.serie}/${faturaOutro.numeroNaSerie}`;
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
    expect(xml).toContain(`${nota.serie}/${nota.numeroNaSerie}`);
    expect(xml).toContain('Devolução parcial');
    // A referência aponta para a fatura original, nunca um valor arbitrário.
    expect(xml).toContain(`<Reference>${fatura.serie}/${fatura.numeroNaSerie}</Reference>`);
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
    expect(statusDe(`${parcial.serie}/${parcial.numeroNaSerie}`)).toBe('N');
    expect(statusDe(`${total.serie}/${total.numeroNaSerie}`)).toBe('A');
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
