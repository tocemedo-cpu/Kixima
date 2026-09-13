// tests/contract-billing.test.js
// Contratos-quadro/Call-offs — cobre 3 achados da auditoria (N1-N3):
//   N1: consolidateContractBilling não podia crashar (ReferenceError) nem
//       reemitir a mesma fatura para as MESMAS call-offs num pedido repetido.
//   N2: POST /api/contracts exige que o COMPANY_ADMIN pertença à empresa
//       cliente do contrato — não pode criar contratos entre empresas alheias.
//   N3: POST /api/contracts/:id/consolidate-billing exige que o utilizador
//       seja parte do contrato — não pode forçar a faturação de um alheio.
const bcrypt = require('bcryptjs');
const { request, app, prisma, loginAll, login, auth, PASSWORD } = require('./helpers');

const OUTSIDER_EMAIL = 'admin.outsider@terceira-contratos.co.ao';

let tokens;
let product;
let clientCompanyId; // Petro Angola (cliente do seed)
let supplierCompanyId; // Kianda (fornecedor do seed)
let planoOriginal;
let outsiderToken;
let outsiderCompanyId;

beforeAll(async () => {
  tokens = await loginAll();
  const catalog = await auth(tokens.comprador).get('/api/catalog');
  product = catalog.body[0];
  supplierCompanyId = product.supplierId;

  const client = await prisma.company.findFirst({ where: { type: 'CLIENTE' } });
  clientCompanyId = client.id;
  planoOriginal = { plan: client.plan, searchRank: client.searchRank };
  await prisma.company.update({ where: { id: clientCompanyId }, data: { plan: 'PRO', searchRank: 2 } });

  const outsider = await prisma.company.create({
    data: {
      name: 'Terceira Empresa Contratos Lda', taxId: `TAX-CTR-${Date.now()}`, type: 'CLIENTE',
      status: 'APROVADA', contactEmail: 'geral@terceira-contratos.co.ao', plan: 'PRO', searchRank: 2,
    },
  });
  outsiderCompanyId = outsider.id;
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await prisma.user.create({
    data: { name: 'Admin Terceira', email: OUTSIDER_EMAIL, passwordHash, role: 'COMPANY_ADMIN', companyId: outsider.id, active: true },
  });
  outsiderToken = await login(OUTSIDER_EMAIL);
});

afterAll(async () => {
  await prisma.contract.deleteMany({ where: { clientCompanyId } });
  await prisma.company.update({ where: { id: clientCompanyId }, data: planoOriginal });
  await prisma.user.deleteMany({ where: { email: OUTSIDER_EMAIL } });
  await prisma.company.deleteMany({ where: { id: outsiderCompanyId } });
  await prisma.$disconnect();
});

describe('N2 — POST /api/contracts exige que o utilizador pertença à empresa cliente', () => {
  test('COMPANY_ADMIN de uma empresa alheia não pode criar um contrato em nome de outra empresa (403)', async () => {
    const res = await auth(outsiderToken).post('/api/contracts').send({
      clientCompanyId, // não é a empresa do outsider
      supplierCompanyId,
      categoriesCovered: [product.category],
      totalValue: 1000,
      currency: 'AOA',
      billingPeriodicity: 'TRIMESTRAL',
      paymentTermDays: 30,
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(res.status).toBe(403);
  });

  test('COMPANY_ADMIN pode criar um contrato em nome da SUA PRÓPRIA empresa (201)', async () => {
    const res = await auth(tokens.companyAdmin).post('/api/contracts').send({
      clientCompanyId,
      supplierCompanyId,
      categoriesCovered: [product.category],
      totalValue: 1000,
      currency: 'AOA',
      billingPeriodicity: 'TRIMESTRAL',
      paymentTermDays: 30,
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(res.status).toBe(201);
    expect(res.body.clientCompanyId).toBe(clientCompanyId);

    // Limpo de imediato: um contrato ativo a mais entre o mesmo cliente/
    // fornecedor/categoria confundiria a deteção de call-off (findActiveContractForOrder)
    // do bloco seguinte, que precisa de UM contrato só para ser determinístico.
    await prisma.contract.delete({ where: { id: res.body.id } });
  });
});

describe('N1/N3 — consolidação de faturação: posse do contrato + sem reemissão da mesma fatura', () => {
  let contractId;
  let poId;

  beforeAll(async () => {
    const contrato = await auth(tokens.companyAdmin).post('/api/contracts').send({
      clientCompanyId,
      supplierCompanyId,
      categoriesCovered: [product.category],
      totalValue: 100_000,
      currency: 'AOA',
      billingPeriodicity: 'TRIMESTRAL',
      paymentTermDays: 15,
      validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    });
    contractId = contrato.body.id;

    // Checkout dentro da cobertura do contrato -> nasce Call-off automaticamente.
    const created = await auth(tokens.comprador).post('/api/purchase-orders').send({
      supplierCompanyId, items: [{ productId: product.id, quantity: 1 }],
    });
    poId = created.body.id;
    const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
    expect(po.isCallOff).toBe(true);
    expect(po.status).toBe('APROVADA'); // call-off nasce já aprovada

    // Fornecedor aceita -> EM_EXECUCAO, elegível para consolidação.
    await auth(tokens.fornecedor).patch(`/api/purchase-orders/${poId}/accept`);
  });

  test('utilizador alheio ao contrato não pode forçar a sua consolidação (404)', async () => {
    const res = await auth(outsiderToken).post(`/api/contracts/${contractId}/consolidate-billing`);
    expect(res.status).toBe(404);
  });

  test('parte do contrato consolida com sucesso — a call-off fica marcada e a notificação não crasha', async () => {
    const res = await auth(tokens.companyAdmin).post(`/api/contracts/${contractId}/consolidate-billing`);
    expect(res.status).toBe(201);
    expect(res.body.contractId).toBe(contractId);
    expect(res.body.consolidatedPoIds).toContain(poId);
    expect(Number(res.body.amount)).toBeGreaterThan(0);

    const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
    expect(po.consolidatedInvoiceId).toBe(res.body.id);
  });

  test('uma segunda consolidação NÃO reemite a mesma call-off — não há pendentes (400)', async () => {
    const res = await auth(tokens.companyAdmin).post(`/api/contracts/${contractId}/consolidate-billing`);
    expect(res.status).toBe(400);

    const faturas = await prisma.invoice.findMany({ where: { contractId } });
    expect(faturas).toHaveLength(1); // continua a existir só UMA fatura consolidada
  });
});
