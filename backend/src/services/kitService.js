// src/services/kitService.js
// Kits: conjuntos de produtos vendidos como pacote (organização do catálogo do
// fornecedor).

const prisma = require('../config/database');
const { NotFoundError, BusinessRuleError, ForbiddenError } = require('../utils/errors');

async function listKits(supplierCompanyId) {
  return prisma.kit.findMany({
    where: { supplierId: supplierCompanyId, active: true },
    include: { items: { include: { product: { select: { id: true, name: true, unitPrice: true, currency: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function createKit(supplierCompanyId, { name, description, items }) {
  if (!items || items.length === 0) {
    throw new BusinessRuleError('Um kit precisa de pelo menos um produto.');
  }
  // Todos os produtos têm de ser da própria empresa.
  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  if (products.length !== productIds.length || products.some((p) => p.supplierId !== supplierCompanyId)) {
    throw new BusinessRuleError('Todos os produtos do kit devem pertencer à sua empresa.');
  }

  return prisma.kit.create({
    data: {
      supplierId: supplierCompanyId,
      name,
      description: description || null,
      items: { create: items.map((i) => ({ productId: i.productId, quantity: i.quantity || 1 })) },
    },
    include: { items: { include: { product: { select: { id: true, name: true, unitPrice: true, currency: true } } } } },
  });
}

async function deleteKit(id, supplierCompanyId) {
  const kit = await prisma.kit.findUnique({ where: { id } });
  if (!kit) throw new NotFoundError('Kit');
  if (kit.supplierId !== supplierCompanyId) throw new ForbiddenError('Só pode remover kits da sua empresa.');
  await prisma.kit.update({ where: { id }, data: { active: false } });
  return { id };
}

module.exports = { listKits, createKit, deleteKit };
