// src/services/catalogService.js

const prisma = require('../config/database');
const { NotFoundError, ForbiddenError } = require('../utils/errors');

async function listCatalog({ category, search, supplierId } = {}) {
  return prisma.product.findMany({
    where: {
      active: true,
      ...(category ? { category } : {}),
      ...(supplierId ? { supplierId } : {}),
      ...(search
        ? { name: { contains: search, mode: 'insensitive' } }
        : {}),
    },
    include: { supplier: { select: { id: true, name: true, status: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function getProduct(id) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { supplier: { select: { id: true, name: true, status: true } } },
  });
  if (!product) throw new NotFoundError('Produto');
  return product;
}

async function createProduct(supplierCompanyId, data) {
  const supplier = await prisma.company.findUnique({ where: { id: supplierCompanyId } });
  if (!supplier || supplier.type !== 'FORNECEDOR') {
    throw new ForbiddenError('Apenas empresas fornecedoras podem publicar itens no catálogo.');
  }
  if (supplier.status !== 'APROVADA') {
    throw new ForbiddenError('A empresa precisa estar credenciada (due diligence aprovada) para publicar itens.');
  }

  return prisma.product.create({
    data: { ...data, supplierId: supplierCompanyId },
  });
}

async function updateProduct(id, supplierCompanyId, data) {
  const product = await getProduct(id);
  if (product.supplierId !== supplierCompanyId) {
    throw new ForbiddenError('Só pode editar itens da sua própria empresa.');
  }
  return prisma.product.update({ where: { id }, data });
}

async function deactivateProduct(id, supplierCompanyId) {
  const product = await getProduct(id);
  if (product.supplierId !== supplierCompanyId) {
    throw new ForbiddenError('Só pode remover itens da sua própria empresa.');
  }
  return prisma.product.update({ where: { id }, data: { active: false } });
}

module.exports = { listCatalog, getProduct, createProduct, updateProduct, deactivateProduct };
