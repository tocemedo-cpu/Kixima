// src/services/quoteService.js
// Pedidos de cotação (RFQ): o comprador pede preço a um fornecedor; o fornecedor
// responde com preço/prazo; o comprador pode encerrar.

const prisma = require('../config/database');
const planService = require('./planService');
const { NotFoundError, BusinessRuleError, ForbiddenError } = require('../utils/errors');

const INCLUDE = {
  items: { include: { product: { select: { id: true, name: true, unitPrice: true, currency: true } } } },
  buyerCompany: { select: { id: true, name: true } },
  supplierCompany: { select: { id: true, name: true } },
};

// Quantas cotações esta empresa já pediu no mês corrente (UTC).
async function assertCotacoesDoMes(buyerCompanyId) {
  const empresa = await prisma.company.findUnique({ where: { id: buyerCompanyId } });
  if (planService.limite(empresa?.plan, 'cotacoesPorMes') === planService.ILIMITADO) return;

  const agora = new Date();
  const inicioDoMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
  const usadas = await prisma.quoteRequest.count({
    where: { buyerCompanyId, createdAt: { gte: inicioDoMes } },
  });
  planService.assertLimite(empresa, 'cotacoesPorMes', usadas, 'pedidos de cotação por mês');
}

async function createRequest(buyerCompanyId, createdById, { supplierCompanyId, items, note }) {
  // Cotações por mês: limita a INTENSIDADE de uso, não o catálogo. Cada pedido
  // custa trabalho ao fornecedor do outro lado, por isso é uma medida honesta de
  // quanto a empresa está a usar a plataforma.
  await assertCotacoesDoMes(buyerCompanyId);

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
