// tests/audit.test.js
// Trilho de auditoria financeira: aprovar/pagar/confirmar deixa registo
// imutável com o ator identificado; o pagamento é auditado NA transação;
// a consulta é exclusiva do Admin do Sistema.
const { auth, prisma, loginAll } = require('./helpers');

const PROOF = Buffer.from('%PDF-1.4 comprovativo de teste');

let tokens;
let product;

beforeAll(async () => {
  tokens = await loginAll();
  const catalog = await auth(tokens.comprador).get('/api/catalog');
  product = catalog.body[0];
});
afterAll(async () => { await prisma.$disconnect(); });

async function novaFatura() {
  const created = await auth(tokens.comprador)
    .post('/api/purchase-orders')
    .send({ supplierCompanyId: product.supplierId, items: [{ productId: product.id, quantity: 1 }] });
  const po = created.body;
  await auth(tokens.companyAdmin).patch(`/api/purchase-orders/${po.id}/approve`);
  await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/accept`);
  const full = await auth(tokens.financeiro).get(`/api/purchase-orders/${po.id}`);
  return { po, invoice: full.body.invoice };
}

describe('Trilho de auditoria financeira', () => {
  test('aprovar uma PO regista PO_APROVADA com o ator identificado', async () => {
    const created = await auth(tokens.comprador)
      .post('/api/purchase-orders')
      .send({ supplierCompanyId: product.supplierId, items: [{ productId: product.id, quantity: 1 }] });
    const po = created.body;
    await auth(tokens.companyAdmin).patch(`/api/purchase-orders/${po.id}/approve`);

    const log = await prisma.auditLog.findFirst({
      where: { action: 'PO_APROVADA', entityId: po.id },
    });
    expect(log).toBeTruthy();
    expect(log.entityRef).toBe(po.reference);
    expect(log.actorId).toBeTruthy();
    expect(log.actorRole).toBe('COMPANY_ADMIN');
    expect(log.actorName).toBeTruthy();
    expect(log.detail.moeda).toBe(po.currency);
  });

  test('rejeitar uma PO regista PO_REJEITADA com o motivo', async () => {
    const created = await auth(tokens.comprador)
      .post('/api/purchase-orders')
      .send({ supplierCompanyId: product.supplierId, items: [{ productId: product.id, quantity: 1 }] });
    const po = created.body;
    await auth(tokens.companyAdmin)
      .patch(`/api/purchase-orders/${po.id}/reject`)
      .send({ reason: 'Orçamento esgotado' });

    const log = await prisma.auditLog.findFirst({ where: { action: 'PO_REJEITADA', entityId: po.id } });
    expect(log).toBeTruthy();
    expect(log.detail.motivo).toBe('Orçamento esgotado');
  });

  test('pagar regista PAGAMENTO_EXECUTADO na MESMA transação do pagamento', async () => {
    const { invoice } = await novaFatura();
    const paid = await auth(tokens.financeiro)
      .post(`/api/payments/invoices/${invoice.id}/pay`)
      .attach('proof', PROOF, 'transferencia.pdf');
    expect(paid.status).toBe(201);

    const log = await prisma.auditLog.findFirst({
      where: { action: 'PAGAMENTO_EXECUTADO', entityId: paid.body.id },
    });
    expect(log).toBeTruthy();
    expect(log.entityRef).toBe(paid.body.reference);
    expect(log.actorRole).toBe('FINANCEIRO');
    expect(log.detail.fatura).toBe(invoice.reference);
    expect(log.detail.comprovativo).toBe('transferencia.pdf');
  });

  test('confirmar a receção do valor regista RECECAO_VALOR_CONFIRMADA', async () => {
    const { invoice } = await novaFatura();
    const paid = await auth(tokens.financeiro)
      .post(`/api/payments/invoices/${invoice.id}/pay`)
      .attach('proof', PROOF, 'comprovativo.pdf');
    await auth(tokens.fornecedor).patch(`/api/payments/${paid.body.id}/confirm-received`);

    const log = await prisma.auditLog.findFirst({
      where: { action: 'RECECAO_VALOR_CONFIRMADA', entityId: paid.body.id },
    });
    expect(log).toBeTruthy();
    expect(log.detail.fatura).toBe(invoice.reference);
  });

  test('alterar dados bancários regista o IBAN MASCARADO (nunca em claro)', async () => {
    const me = await auth(tokens.fornecedor).get('/api/auth/me');
    const companyId = me.body.user.companyId;
    const res = await auth(tokens.fornecedor)
      .put(`/api/companies/${companyId}/bank-details`)
      .send({ bankName: 'BAI', iban: 'AO06004400006729503010102', swift: 'BAIPAOLU' });
    expect(res.status).toBe(200);

    const log = await prisma.auditLog.findFirst({
      where: { action: 'DADOS_BANCARIOS_ALTERADOS', entityId: companyId },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toBeTruthy();
    expect(log.detail.iban).toBe('••••0102');
    expect(log.detail.iban).not.toContain('004400006729503010');
  });

  test('a consulta do trilho é EXCLUSIVA do Admin do Sistema (403 para os restantes)', async () => {
    for (const t of [tokens.comprador, tokens.companyAdmin, tokens.financeiro, tokens.fornecedor]) {
      const res = await auth(t).get('/api/admin/audit-logs');
      expect(res.status).toBe(403);
    }
  });

  test('o Admin do Sistema lista o trilho paginado, filtrável por ação e pesquisa', async () => {
    const all = await auth(tokens.adminSistema).get('/api/admin/audit-logs?limit=5');
    expect(all.status).toBe(200);
    expect(all.body.items.length).toBeGreaterThan(0);
    expect(all.body.items.length).toBeLessThanOrEqual(5);
    expect(all.body.total).toBeGreaterThan(0);
    expect(Array.isArray(all.body.actions)).toBe(true);

    const filtered = await auth(tokens.adminSistema).get('/api/admin/audit-logs?action=PAGAMENTO_EXECUTADO');
    expect(filtered.status).toBe(200);
    expect(filtered.body.items.every((i) => i.action === 'PAGAMENTO_EXECUTADO')).toBe(true);

    // Pesquisa por referência da entidade (ex.: PAY-...).
    const ref = filtered.body.items[0].entityRef;
    const searched = await auth(tokens.adminSistema).get(`/api/admin/audit-logs?q=${encodeURIComponent(ref)}`);
    expect(searched.body.items.some((i) => i.entityRef === ref)).toBe(true);
  });
});
