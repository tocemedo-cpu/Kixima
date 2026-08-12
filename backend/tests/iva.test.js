// tests/iva.test.js
// O IVA é calculado no SERVIDOR e o total da ordem de compra é o que o comprador
// se compromete a pagar.
//
// Existe porque durante muito tempo o IVA só entrava na fatura: a PO guardava o
// líquido e a fatura o valor com imposto. O comprador via na ordem um total
// menor do que aquele que ia pagar, o documento da PO dizia "estimado", e o
// limite do contrato-quadro era consumido a menos.
const { loginAll, auth, prisma } = require('./helpers');

const IVA = 0.14;
const cent = (n) => Math.round(Number(n) * 100) / 100;

describe('IVA no cálculo do servidor', () => {
  let tokens;
  let po;

  beforeAll(async () => {
    tokens = await loginAll();
    const produto = await prisma.product.findFirst({ where: { active: true, kind: 'PRODUTO' } });
    const res = await auth(tokens.comprador)
      .post('/api/purchase-orders')
      .send({ supplierCompanyId: produto.supplierId, items: [{ productId: produto.id, quantity: 3 }] });
    expect(res.status).toBe(201);
    po = res.body;
  });

  test('a PO guarda o líquido, o IVA e o total com imposto', () => {
    expect(Number(po.netAmount)).toBeGreaterThan(0);
    expect(cent(po.taxAmount)).toBe(cent(Number(po.netAmount) * IVA));
    expect(cent(po.totalAmount)).toBe(cent(Number(po.netAmount) + Number(po.taxAmount)));
  });

  test('o total da PO é a soma das linhas mais o IVA', () => {
    const linhas = po.items.reduce((s, i) => s + Number(i.lineTotal), 0);
    expect(cent(po.netAmount)).toBe(cent(linhas));
    expect(cent(po.totalAmount)).toBe(cent(linhas * (1 + IVA)));
  });

  test('a fatura emitida bate certo com a ordem — o comprador paga o que a PO diz', async () => {
    await auth(tokens.companyAdmin).patch(`/api/purchase-orders/${po.id}/approve`);
    const aceite = await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/accept`);
    expect(aceite.status).toBe(200);

    const fatura = await prisma.invoice.findUnique({ where: { purchaseOrderId: po.id } });
    expect(cent(fatura.amount)).toBe(cent(po.totalAmount));
    expect(cent(fatura.netAmount)).toBe(cent(po.netAmount));
    expect(cent(fatura.taxAmount)).toBe(cent(po.taxAmount));
  });

  test('serviços trazem retenção na fonte; produtos não', async () => {
    const servico = await prisma.product.findFirst({ where: { active: true, kind: 'SERVICO' } });
    if (!servico) return;
    const res = await auth(tokens.comprador)
      .post('/api/purchase-orders')
      .send({ supplierCompanyId: servico.supplierId, items: [{ productId: servico.id, quantity: 1 }] });
    expect(res.status).toBe(201);
    expect(cent(res.body.withholdingAmount)).toBe(cent(Number(res.body.netAmount) * 0.065));
    // A retenção não soma ao que o comprador paga — é descontada ao fornecedor.
    expect(cent(res.body.totalAmount)).toBe(cent(Number(res.body.netAmount) * (1 + IVA)));
    expect(cent(po.withholdingAmount)).toBe(0);
  });
});
