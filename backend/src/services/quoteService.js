// src/services/quoteService.js
// Pedidos de cotação (RFQ): o comprador pede preço a um fornecedor; o fornecedor
// responde com preço/prazo; o comprador pode encerrar.

const prisma = require('../config/database');
const { NotFoundError, BusinessRuleError, ForbiddenError } = require('../utils/errors');

const INCLUDE = {
  items: { include: { product: { select: { id: true, name: true, unitPrice: true, currency: true } } } },
  buyerCompany: { select: { id: true, name: true } },
  supplierCompany: { select: { id: true, name: true } },
};

async function createRequest(buyerCompanyId, createdById, { supplierCompanyId, items, note }) {
  if (supplierCompanyId === buyerCompanyId) {
    throw new BusinessRuleError('Não pode pedir cotação à sua própria empresa.');
  }
  if (!items || items.length === 0) {
    throw new BusinessRuleError('Adicione pelo menos um produto ao pedido de cotação.');
  }
  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  if (products.length !== productIds.length || products.some((p) => p.supplierId !== supplierCompanyId)) {
    throw new BusinessRuleError('Todos os produtos devem pertencer ao fornecedor escolhido.');
  }
  return prisma.quoteRequest.create({
    data: {
      buyerCompanyId, supplierCompanyId, createdById, note: note || null,
      items: { create: items.map((i) => ({ productId: i.productId, quantity: i.quantity || 1 })) },
    },
    include: INCLUDE,
  });
}

async function listForBuyer(buyerCompanyId, { status } = {}) {
  return prisma.quoteRequest.findMany({
    where: { buyerCompanyId, ...(status ? { status } : {}) },
    include: INCLUDE, orderBy: { createdAt: 'desc' },
  });
}

async function listForSupplier(supplierCompanyId, { status } = {}) {
  return prisma.quoteRequest.findMany({
    where: { supplierCompanyId, ...(status ? { status } : {}) },
    include: INCLUDE, orderBy: { createdAt: 'desc' },
  });
}

async function respond(id, supplierCompanyId, { price, leadDays, note }) {
  const quote = await prisma.quoteRequest.findUnique({ where: { id } });
  if (!quote) throw new NotFoundError('Pedido de cotação');
  if (quote.supplierCompanyId !== supplierCompanyId) throw new ForbiddenError('Só o fornecedor do pedido pode responder.');
  if (quote.status === 'FECHADA') throw new BusinessRuleError('Este pedido já foi encerrado.');
  return prisma.quoteRequest.update({
    where: { id },
    data: { status: 'RESPONDIDA', responsePrice: price, responseLeadDays: leadDays ?? null, responseNote: note || null, respondedAt: new Date() },
    include: INCLUDE,
  });
}

async function close(id, buyerCompanyId) {
  const quote = await prisma.quoteRequest.findUnique({ where: { id } });
  if (!quote) throw new NotFoundError('Pedido de cotação');
  if (quote.buyerCompanyId !== buyerCompanyId) throw new ForbiddenError('Só o comprador do pedido pode encerrá-lo.');
  return prisma.quoteRequest.update({ where: { id }, data: { status: 'FECHADA' }, include: INCLUDE });
}

module.exports = { createRequest, listForBuyer, listForSupplier, respond, close };
