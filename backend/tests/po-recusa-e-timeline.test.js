// tests/po-recusa-e-timeline.test.js
// Duas peças do fluxo completo de PO que ainda não tinham cobertura própria:
//   - a recusa do fornecedor exige motivo (não pode ficar sem explicação);
//   - a linha do tempo auditável (GET /:id/history) — quem pode vê-la e o
//     que ela contém.
const bcrypt = require('bcryptjs');
const { auth, prisma, loginAll, login, PASSWORD } = require('./helpers');

let tokens;
let product;

beforeAll(async () => {
  tokens = await loginAll();
  const catalog = await auth(tokens.comprador).get('/api/catalog');
  product = catalog.body[0];
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function novaPOAprovada() {
  const created = await auth(tokens.comprador)
    .post('/api/purchase-orders')
    .send({ supplierCompanyId: product.supplierId, items: [{ productId: product.id, quantity: 1 }] });
  const po = created.body;
  await auth(tokens.companyAdmin).patch(`/api/purchase-orders/${po.id}/approve`);
  return po;
}

describe('Recusa do fornecedor — motivo obrigatório', () => {
  test('sem motivo é rejeitada (422) e o estado não muda', async () => {
    const po = await novaPOAprovada();
    const res = await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/refuse`).send({});
    expect(res.status).toBe(422);

    const dbPo = await prisma.purchaseOrder.findUnique({ where: { id: po.id } });
    expect(dbPo.status).toBe('APROVADA');
  });

  test('motivo demasiado curto também é rejeitado (422)', async () => {
    const po = await novaPOAprovada();
    const res = await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/refuse`).send({ reason: 'no' });
    expect(res.status).toBe(422);
  });

  test('com motivo, a PO fica RECUSADA_FORNECEDOR com o motivo e a auditoria gravados', async () => {
    const po = await novaPOAprovada();
    const motivo = 'Sem stock suficiente para cumprir a quantidade pedida.';
    const res = await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/refuse`).send({ reason: motivo });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RECUSADA_FORNECEDOR');
    expect(res.body.refusalReason).toBe(motivo);
    expect(res.body.refusedAt).toBeTruthy();

    const log = await prisma.auditLog.findFirst({ where: { action: 'PO_RECUSADA_FORNECEDOR', entityId: po.id } });
    expect(log).toBeTruthy();
    expect(log.detail.motivo).toBe(motivo);

    // O comprador é notificado do motivo.
    const notif = await prisma.notification.findFirst({
      where: { type: 'PO_RECUSADA_FORNECEDOR', relatedEntityId: po.id, user: { companyId: po.buyerCompanyId } },
    });
    expect(notif).toBeTruthy();
    expect(notif.message).toContain(motivo);
  });

  test('uma PO já recusada não pode ser aceite nem recusada de novo (409)', async () => {
    const po = await novaPOAprovada();
    await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/refuse`).send({ reason: 'Sem capacidade de produção este mês.' });

    const acceptAfter = await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/accept`);
    expect(acceptAfter.status).toBe(409);

    const refuseAgain = await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/refuse`).send({ reason: 'Outro motivo qualquer.' });
    expect(refuseAgain.status).toBe(409);
  });
});

describe('Linha do tempo auditável (GET /:id/history)', () => {
  test('regista, por ordem cronológica, cada transição de estado', async () => {
    const po = await novaPOAprovada();
    await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/accept`);

    const res = await auth(tokens.companyAdmin).get(`/api/purchase-orders/${po.id}/history`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const acoes = res.body.map((e) => e.action);
    expect(acoes).toEqual(['PO_CRIADA', 'PO_APROVADA', 'PO_ACEITE']);
    // Ordem cronológica: cada entrada não é mais antiga que a anterior.
    const tempos = res.body.map((e) => new Date(e.createdAt).getTime());
    expect(tempos).toEqual([...tempos].sort((a, b) => a - b));
  });

  test('o comprador e o fornecedor da PO veem a mesma linha do tempo', async () => {
    const po = await novaPOAprovada();
    const asBuyer = await auth(tokens.comprador).get(`/api/purchase-orders/${po.id}/history`);
    const asSupplier = await auth(tokens.fornecedor).get(`/api/purchase-orders/${po.id}/history`);
    expect(asBuyer.status).toBe(200);
    expect(asSupplier.status).toBe(200);
    expect(asBuyer.body.map((e) => e.id)).toEqual(asSupplier.body.map((e) => e.id));
  });

  test('uma empresa alheia à PO leva 404 (não revela a existência)', async () => {
    const po = await novaPOAprovada();
    const outsider = await prisma.company.create({
      data: {
        name: 'Empresa Alheia à Timeline Lda', taxId: `TAX-HIST-${Date.now()}`, type: 'CLIENTE',
        status: 'APROVADA', contactEmail: 'geral@alheia-hist.co.ao',
      },
    });
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const email = 'admin.alheia.hist@alheia-hist.co.ao';
    await prisma.user.create({
      data: { name: 'Admin Alheia', email, passwordHash, role: 'COMPANY_ADMIN', companyId: outsider.id, active: true },
    });
    try {
      const outsiderToken = await login(email);
      const res = await auth(outsiderToken).get(`/api/purchase-orders/${po.id}/history`);
      expect(res.status).toBe(404);
    } finally {
      await prisma.user.deleteMany({ where: { email } });
      await prisma.company.deleteMany({ where: { id: outsider.id } });
    }
  });

  test('o Admin do Sistema vê a linha do tempo de qualquer PO', async () => {
    const po = await novaPOAprovada();
    const res = await auth(tokens.adminSistema).get(`/api/purchase-orders/${po.id}/history`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});
