// tests/credit-note.test.js
// Nota de crédito — o mecanismo de correção fiscal de uma fatura já emitida
// (ver src/services/creditNoteService.js). O que se testa aqui não é só "cria
// um registo": é que a fatura original nunca é tocada, que o crédito nunca
// excede o saldo por creditar, e que só quem emitiu a fatura (ou o Admin do
// Sistema) a pode corrigir.
const { auth, prisma, loginAll } = require('./helpers');

let tokens;
let product;

beforeAll(async () => {
  tokens = await loginAll();
  const catalog = await auth(tokens.comprador).get('/api/catalog');
  product = catalog.body[0];
});
afterAll(async () => { await prisma.$disconnect(); });

// Leva uma PO nova até ter fatura pendente; devolve { po, invoice }.
async function novaFatura() {
  const created = await auth(tokens.comprador)
    .post('/api/purchase-orders')
    .send({ supplierCompanyId: product.supplierId, items: [{ productId: product.id, quantity: 2 }] });
  const po = created.body;
  await auth(tokens.companyAdmin).patch(`/api/purchase-orders/${po.id}/approve`);
  await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/accept`);
  const full = await auth(tokens.financeiro).get(`/api/purchase-orders/${po.id}`);
  return { po, invoice: full.body.invoice };
}

describe('Emissão de nota de crédito', () => {
  test('o fornecedor emite uma nota de crédito parcial contra a sua fatura', async () => {
    const { invoice } = await novaFatura();
    const valor = Number(invoice.amount) / 2;

    const res = await auth(tokens.fornecedor)
      .post(`/api/payments/invoices/${invoice.id}/notas-credito`)
      .send({ motivo: 'Devolução parcial de mercadoria', amount: valor });

    expect(res.status).toBe(201);
    expect(res.body.reference).toMatch(/^NC-/);
    expect(Number(res.body.amount)).toBeCloseTo(valor);
    expect(res.body.motivo).toBe('Devolução parcial de mercadoria');

    // A fatura original fica exatamente como estava — a correção é um
    // documento à parte, nunca um UPDATE na fatura.
    const db = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(Number(db.amount)).toBeCloseTo(Number(invoice.amount));
  });

  test('recusa creditar mais do que a fatura tem por creditar (mesmo em duas parcelas)', async () => {
    const { invoice } = await novaFatura();
    const metade = Number(invoice.amount) / 2;

    const primeira = await auth(tokens.fornecedor)
      .post(`/api/payments/invoices/${invoice.id}/notas-credito`)
      .send({ motivo: 'Primeira parcela', amount: metade });
    expect(primeira.status).toBe(201);

    // Ainda cabe exatamente o resto — não deve ser recusada.
    const resto = await auth(tokens.fornecedor)
      .post(`/api/payments/invoices/${invoice.id}/notas-credito`)
      .send({ motivo: 'Resto', amount: Number(invoice.amount) - metade });
    expect(resto.status).toBe(201);

    // Já não sobra nada — a fatura está 100% creditada.
    const excesso = await auth(tokens.fornecedor)
      .post(`/api/payments/invoices/${invoice.id}/notas-credito`)
      .send({ motivo: 'Excesso', amount: 1 });
    expect(excesso.status).toBe(409);
    expect(excesso.body.error.message).toMatch(/saldo/);
  });

  test('exige motivo e um valor positivo', async () => {
    const { invoice } = await novaFatura();

    const semMotivo = await auth(tokens.fornecedor)
      .post(`/api/payments/invoices/${invoice.id}/notas-credito`)
      .send({ amount: 10 });
    expect(semMotivo.status).toBe(422);

    const valorZero = await auth(tokens.fornecedor)
      .post(`/api/payments/invoices/${invoice.id}/notas-credito`)
      .send({ motivo: 'x', amount: 0 });
    expect(valorZero.status).toBe(422);

    const valorNegativo = await auth(tokens.fornecedor)
      .post(`/api/payments/invoices/${invoice.id}/notas-credito`)
      .send({ motivo: 'x', amount: -5 });
    expect(valorNegativo.status).toBe(422);
  });

  test('só o fornecedor DESTA fatura (ou o Admin do Sistema) pode emitir a nota de crédito', async () => {
    const { invoice } = await novaFatura();

    // O comprador nem passa no perfil da rota.
    const comoComprador = await auth(tokens.comprador)
      .post(`/api/payments/invoices/${invoice.id}/notas-credito`)
      .send({ motivo: 'x', amount: 10 });
    expect(comoComprador.status).toBe(403);

    // O Financeiro do lado do comprador passa no perfil da rota (COMPANY_ADMIN
    // e FINANCEIRO partilham perfil noutras rotas de pagamento) mas esta rota
    // não inclui FINANCEIRO isolado — confirma que continua fora.
    const comoFinanceiro = await auth(tokens.financeiro)
      .post(`/api/payments/invoices/${invoice.id}/notas-credito`)
      .send({ motivo: 'x', amount: 10 });
    expect(comoFinanceiro.status).toBe(403);

    // O Admin do Sistema (Super Admin, sem áreas restritas) pode.
    const comoAdmin = await auth(tokens.adminSistema)
      .post(`/api/payments/invoices/${invoice.id}/notas-credito`)
      .send({ motivo: 'Correção administrativa', amount: 10 });
    expect(comoAdmin.status).toBe(201);
  });

  test('lista as notas de crédito de uma fatura às partes envolvidas', async () => {
    const { invoice } = await novaFatura();
    await auth(tokens.fornecedor)
      .post(`/api/payments/invoices/${invoice.id}/notas-credito`)
      .send({ motivo: 'Nota única', amount: 5 });

    const comoFornecedor = await auth(tokens.fornecedor).get(`/api/payments/invoices/${invoice.id}/notas-credito`);
    expect(comoFornecedor.status).toBe(200);
    expect(comoFornecedor.body).toHaveLength(1);
    expect(comoFornecedor.body[0].motivo).toBe('Nota única');

    // O comprador (dono da PO/fatura do lado comprador) também é parte.
    const comoComprador = await auth(tokens.comprador).get(`/api/payments/invoices/${invoice.id}/notas-credito`);
    expect(comoComprador.status).toBe(200);
    expect(comoComprador.body).toHaveLength(1);
  });
});

describe('Série fiscal por empresa (Admin do Sistema)', () => {
  test('só o Admin do Sistema a pode declarar', async () => {
    const semAcesso = await auth(tokens.fornecedor)
      .put(`/api/companies/${product.supplierId}/serie-fiscal`)
      .send({ serieFiscal: 'X' });
    expect(semAcesso.status).toBe(403);
  });

  test('depois de declarada, a PRÓXIMA fatura deste fornecedor sai com numeração e hash certificados', async () => {
    const empresa = await prisma.company.findUnique({ where: { id: product.supplierId } });
    const original = empresa.serieFiscal;

    const declarada = await auth(tokens.adminSistema)
      .put(`/api/companies/${product.supplierId}/serie-fiscal`)
      .send({ serieFiscal: 'TESTEHTTP' });
    expect(declarada.status).toBe(200);
    expect(declarada.body.serieFiscal).toBe('TESTEHTTP');

    try {
      const { invoice } = await novaFatura();
      expect(invoice.serie).toBe('TESTEHTTP');
      expect(invoice.numeroNaSerie).toEqual(expect.any(Number));
      expect(invoice.hashDocumento).toEqual(expect.any(String));

      // A nota de crédito desta fatura usa a MESMA série, com o sufixo "-NC"
      // — nunca a mesma série da fatura, mas sempre a do mesmo fornecedor.
      const nota = await auth(tokens.fornecedor)
        .post(`/api/payments/invoices/${invoice.id}/notas-credito`)
        .send({ motivo: 'Correção', amount: 1 });
      expect(nota.body.serie).toBe('TESTEHTTP-NC');
    } finally {
      await auth(tokens.adminSistema)
        .put(`/api/companies/${product.supplierId}/serie-fiscal`)
        .send({ serieFiscal: original });
      await prisma.creditNote.deleteMany({ where: { serie: 'TESTEHTTP-NC' } });
      await prisma.invoice.deleteMany({ where: { serie: 'TESTEHTTP' } });
      await prisma.$executeRaw`DELETE FROM "series_faturacao" WHERE "codigo" IN ('TESTEHTTP', 'TESTEHTTP-NC')`;
    }
  });
});

describe('Data de adesão à faturação eletrónica (Admin do Sistema)', () => {
  test('só o Admin do Sistema a pode declarar', async () => {
    const semAcesso = await auth(tokens.fornecedor)
      .put(`/api/companies/${product.supplierId}/data-adesao`)
      .send({ dataAdesao: '2026-01-01' });
    expect(semAcesso.status).toBe(403);
  });

  test('uma adesão no FUTURO bloqueia a certificação de faturas emitidas antes dela', async () => {
    const empresa = await prisma.company.findUnique({ where: { id: product.supplierId } });
    const originalAdesao = empresa.dataAdesaoFacturacaoElectronica;
    const originalSerie = empresa.serieFiscal;

    // A validação de adesão só corre dentro de atribuir() quando a empresa já
    // tem série declarada (sem série, o documento sai "desligado" como sempre
    // saiu — ver `faturacaoService.atribuir`) — por isso o teste declara as
    // duas, tal como uma empresa real teria as duas ao aderir.
    await auth(tokens.adminSistema)
      .put(`/api/companies/${product.supplierId}/serie-fiscal`)
      .send({ serieFiscal: 'TESTEADESAO' });

    const emAnoQueVem = new Date();
    emAnoQueVem.setFullYear(emAnoQueVem.getFullYear() + 1);
    const declarada = await auth(tokens.adminSistema)
      .put(`/api/companies/${product.supplierId}/data-adesao`)
      .send({ dataAdesao: emAnoQueVem.toISOString() });
    expect(declarada.status).toBe(200);

    try {
      // A PO é aceite AGORA — antes da data de adesão declarada — e é isso
      // que faturacaoService.atribuir() recusa dentro da transação da fatura.
      const created = await auth(tokens.comprador)
        .post('/api/purchase-orders')
        .send({ supplierCompanyId: product.supplierId, items: [{ productId: product.id, quantity: 1 }] });
      const po = created.body;
      await auth(tokens.companyAdmin).patch(`/api/purchase-orders/${po.id}/approve`);
      const aceite = await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/accept`);
      expect(aceite.status).toBeGreaterThanOrEqual(400);
    } finally {
      await auth(tokens.adminSistema)
        .put(`/api/companies/${product.supplierId}/data-adesao`)
        .send({ dataAdesao: originalAdesao ? originalAdesao.toISOString() : null });
      await auth(tokens.adminSistema)
        .put(`/api/companies/${product.supplierId}/serie-fiscal`)
        .send({ serieFiscal: originalSerie });
      await prisma.$executeRaw`DELETE FROM "series_faturacao" WHERE "codigo" = 'TESTEADESAO'`;
    }
  });
});
