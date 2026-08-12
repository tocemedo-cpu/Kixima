// tests/pricing-plans.test.js
// Modelo comercial: Taxa KIXIMA em USD (8$/PO até 11.500$, 0,20% acima;
// 15$/fatura), dimensão da empresa (MPME) e planos BÁSICO/PRO com o ERP
// exclusivo do PRO.
const { auth, request, app, prisma, loginAll } = require('./helpers');
const fees = require('../src/services/platformFeeService');
const plans = require('../src/services/planService');

const PROOF = Buffer.from('%PDF-1.4 comprovativo de teste');

let tokens;
let product;

beforeAll(async () => {
  tokens = await loginAll();
  const catalog = await auth(tokens.comprador).get('/api/catalog');
  product = catalog.body[0];
});
afterAll(async () => { await prisma.$disconnect(); });

describe('Taxa KIXIMA (USD, com limiar)', () => {
  test('até 11.500 USD por transação: 8 USD por PO + 15 USD por fatura', () => {
    expect(fees.compute(1, 5000)).toMatchObject({ perPo: 8, perInvoice: 15, amount: 23, currency: 'USD', basis: 'FIXO' });
    // No próprio limiar ainda é o valor fixo.
    expect(fees.compute(1, 11500)).toMatchObject({ perPo: 8, amount: 23, basis: 'FIXO' });
  });

  test('acima de 11.500 USD: 0,20% cobrado no fim, INCLUINDO a PO e a fatura', () => {
    const f = fees.compute(1, 20000);
    expect(f.basis).toBe('PERCENTUAL');
    expect(f.perPo).toBe(40);        // 0,20% × 20.000
    expect(f.perInvoice).toBe(0);    // a percentagem já inclui a parcela da fatura
    expect(f.amount).toBe(40);       // não se somam os 8 USD nem os 15 USD
  });

  test('fatura consolidada: a parcela por PO conta N vezes, a da fatura só uma', () => {
    const f = fees.compute(3, 1000);
    expect(f.amount).toBe(3 * 8 + 15);
  });

  test('converte Kwanzas para USD ao câmbio configurado', () => {
    const rate = fees.fxRate();
    expect(fees.toUsd(rate * 100, 'AOA')).toBe(100);
    expect(fees.toUsd(250, 'USD')).toBe(250);
  });

  test('o pagamento gera a taxa em USD, com base e câmbio registados', async () => {
    const created = await auth(tokens.comprador)
      .post('/api/purchase-orders')
      .send({ supplierCompanyId: product.supplierId, items: [{ productId: product.id, quantity: 1 }] });
    const po = created.body;
    await auth(tokens.companyAdmin).patch(`/api/purchase-orders/${po.id}/approve`);
    await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/accept`);
    const full = await auth(tokens.financeiro).get(`/api/purchase-orders/${po.id}`);
    await auth(tokens.financeiro)
      .post(`/api/payments/invoices/${full.body.invoice.id}/pay`)
      .attach('proof', PROOF, 'comprovativo.pdf');

    const fee = await prisma.platformFee.findUnique({ where: { invoiceId: full.body.invoice.id } });
    expect(fee).toBeTruthy();
    expect(fee.currency).toBe('USD');
    expect(['FIXO', 'PERCENTUAL']).toContain(fee.basis);
    expect(Number(fee.fxRate)).toBeGreaterThan(0);
    expect(Number(fee.poValueUsd)).toBeGreaterThan(0);
    // Abaixo do limiar cobra-se a parcela da fatura; acima, ela vem incluída
    // nos 0,20% e fica a zero.
    expect(Number(fee.perInvoice)).toBe(fee.basis === 'PERCENTUAL' ? 0 : 15);
  });
});

describe('Dimensão da empresa e planos', () => {
  test('classifica pelo critério MPME (trabalhadores e volume de negócios)', () => {
    expect(plans.classify({ employees: 5, annualRevenueUsd: 200_000 })).toBe('MICRO');
    expect(plans.classify({ employees: 50, annualRevenueUsd: 2_000_000 })).toBe('PEQUENA');
    expect(plans.classify({ employees: 150, annualRevenueUsd: 8_000_000 })).toBe('MEDIA');
    expect(plans.classify({ employees: 300 })).toBe('GRANDE');
    // O critério mais exigente manda: poucos trabalhadores mas faturação alta.
    expect(plans.classify({ employees: 20, annualRevenueUsd: 50_000_000 })).toBe('GRANDE');
  });

  test('grandes empresas exigem o plano PRO; as restantes podem ficar no BÁSICO', () => {
    expect(plans.requiredPlan('GRANDE')).toBe('PRO');
    expect(plans.requiredPlan('PEQUENA')).toBe('BASICO');
    expect(plans.planAllowed('GRANDE', 'BASICO')).toBe(false);
    expect(plans.planAllowed('GRANDE', 'PRO')).toBe(true);
    expect(plans.planAllowed('PEQUENA', 'PRO')).toBe(true);
  });

  test('a integração com ERP é exclusiva do PRO', () => {
    expect(plans.hasFeature('BASICO', 'erpIntegration')).toBe(false);
    expect(plans.hasFeature('PRO', 'erpIntegration')).toBe(true);
  });

  test('custo mensal de acesso = utilizadores ativos × preço por utilizador (teto 100 USD)', () => {
    expect(plans.monthlyAccessCost({ activeUsers: 12, seatPriceUsd: 100 })).toMatchObject({ amountUsd: 1200, currency: 'USD' });
    // O teto é respeitado mesmo que se tente configurar acima.
    expect(plans.monthlyAccessCost({ activeUsers: 2, seatPriceUsd: 500 }).seatPriceUsd).toBe(100);
  });
});

describe('Gestão do plano (Admin do Sistema)', () => {
  let companyId;
  beforeAll(async () => {
    const me = await auth(tokens.fornecedor).get('/api/auth/me');
    companyId = me.body.user.companyId;
  });

  test('o Admin define dimensão, plano e preço por utilizador', async () => {
    const res = await auth(tokens.adminSistema)
      .put(`/api/companies/${companyId}/plan`)
      .send({ size: 'GRANDE', plan: 'PRO', seatPriceUsd: 80 });
    expect(res.status).toBe(200);
    expect(res.body.size).toBe('GRANDE');
    expect(res.body.plan).toBe('PRO');
    expect(Number(res.body.seatPriceUsd)).toBe(80);
  });

  test('uma empresa GRANDE não pode ficar no plano BÁSICO', async () => {
    const res = await auth(tokens.adminSistema)
      .put(`/api/companies/${companyId}/plan`)
      .send({ size: 'GRANDE', plan: 'BASICO' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/PRO/);
  });

  test('o preço por utilizador não pode exceder o teto de 100 USD', async () => {
    const res = await auth(tokens.adminSistema)
      .put(`/api/companies/${companyId}/plan`)
      .send({ seatPriceUsd: 250 });
    expect(res.status).toBe(422);
  });

  test('a empresa consulta a sua subscrição (plano, utilizadores e custo mensal)', async () => {
    const res = await auth(tokens.fornecedor).get(`/api/companies/${companyId}/subscription`);
    expect(res.status).toBe(200);
    expect(res.body.company.plan).toBe('PRO');
    expect(res.body.monthly.currency).toBe('USD');
    expect(res.body.monthly.amountUsd).toBe(res.body.activeUsers * Number(res.body.company.seatPriceUsd));
    expect(res.body.features.erpIntegration).toBe(true);
  });

  test('só o Admin do Sistema altera o plano', async () => {
    const res = await auth(tokens.companyAdmin).put(`/api/companies/${companyId}/plan`).send({ plan: 'PRO' });
    expect(res.status).toBe(403);
  });

  test('no plano BÁSICO a configuração de ERP é recusada; no PRO é permitida', async () => {
    // Desce para BÁSICO (empresa pequena) e tenta configurar o ERP.
    await auth(tokens.adminSistema).put(`/api/companies/${companyId}/plan`).send({ size: 'PEQUENA', plan: 'BASICO' });
    const barrado = await auth(tokens.adminSistema)
      .put(`/api/companies/${companyId}/erp-config`)
      .send({ erp: 'SAP_S4HANA', config: { baseUrl: 'https://erp.example.com', apiKey: 'x' } });
    expect(barrado.status).toBe(400);
    expect(barrado.body.error.message).toMatch(/PRO/);

    // Volta ao PRO: deixa de estar barrado PELO PLANO (pode falhar noutra
    // regra — ex.: campos obrigatórios do ERP —, mas já não por subscrição).
    await auth(tokens.adminSistema).put(`/api/companies/${companyId}/plan`).send({ size: 'GRANDE', plan: 'PRO' });
    const permitido = await auth(tokens.adminSistema)
      .put(`/api/companies/${companyId}/erp-config`)
      .send({ erp: 'SAP_S4HANA', config: { baseUrl: 'https://erp.example.com', apiKey: 'x' } });
    expect(permitido.body?.error?.message || '').not.toMatch(/plano PRO/);
  });
});

describe('Supplier Development', () => {
  let reference;

  test('a taxa de acesso ao programa segue a das pequenas empresas (100 USD)', () => {
    expect(plans.supplierDevAccessFee('PEQUENA')).toMatchObject({ amountUsd: 100, currency: 'USD', custom: false });
    expect(plans.supplierDevAccessFee('MICRO').amountUsd).toBe(100);
    // As restantes dimensões são orçamentadas caso a caso.
    expect(plans.supplierDevAccessFee('MEDIA')).toMatchObject({ amountUsd: null, custom: true });
    expect(plans.supplierDevAccessFee('GRANDE').custom).toBe(true);
  });

  test('qualquer empresa se candidata pela página pública (sem conta)', async () => {
    const res = await request(app)
      .post('/api/supplier-development/requests')
      .send({
        companyName: 'Metalúrgica do Kwanza, Lda',
        contactName: 'Joana Silva',
        contactEmail: 'joana@metalkwanza.co.ao',
        province: 'Luanda',
        sector: 'Metalomecânica',
        employees: 24,
        track: 'AMBOS',
        needs: 'Precisamos de apoio no licenciamento e de um parceiro internacional para soldadura certificada.',
      });
    expect(res.status).toBe(201);
    expect(res.body.reference).toMatch(/^SD-/);
    expect(res.body.status).toBe('RECEBIDA');
    // 24 trabalhadores → pequena empresa → taxa de tabela.
    expect(res.body.accessFee).toMatchObject({ amountUsd: 100, currency: 'USD', custom: false });
    reference = res.body.reference;
  });

  test('a candidatura é validada (email e nome obrigatórios)', async () => {
    const res = await request(app)
      .post('/api/supplier-development/requests')
      .send({ companyName: 'X', contactName: 'Y', contactEmail: 'nao-e-email' });
    expect(res.status).toBe(422);
  });

  test('a empresa acompanha o estado pela referência, sem conta', async () => {
    const res = await request(app).get(`/api/supplier-development/requests/${reference}/track`);
    expect(res.status).toBe(200);
    expect(res.body.companyName).toMatch(/Metalúrgica/);
    // A consulta pública não expõe notas internas nem contactos.
    expect(res.body.adminNotes).toBeUndefined();
    expect(res.body.contactEmail).toBeUndefined();
  });

  test('o Admin do Sistema lista e acompanha as candidaturas; outros perfis não', async () => {
    const lista = await auth(tokens.adminSistema).get('/api/supplier-development/requests');
    expect(lista.status).toBe(200);
    expect(lista.body.items.some((r) => r.reference === reference)).toBe(true);
    expect(lista.body.kpis.total).toBeGreaterThan(0);

    const alvo = lista.body.items.find((r) => r.reference === reference);
    const upd = await auth(tokens.adminSistema)
      .patch(`/api/supplier-development/requests/${alvo.id}`)
      .send({ status: 'EM_ACOMPANHAMENTO', adminNotes: 'Reunião marcada com parceiro norueguês.' });
    expect(upd.status).toBe(200);
    expect(upd.body.status).toBe('EM_ACOMPANHAMENTO');
    expect(upd.body.handledById).toBeTruthy();

    const barrado = await auth(tokens.comprador).get('/api/supplier-development/requests');
    expect(barrado.status).toBe(403);
  });
});
