// src/services/catalogService.js

const prisma = require('../config/database');
const { NotFoundError, ForbiddenError } = require('../utils/errors');
const storageService = require('./storageService');

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
    include: {
      supplier: { select: { id: true, name: true, status: true } },
      images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
      documents: { orderBy: { type: 'asc' } },
    },
  });
  if (!product) throw new NotFoundError('Produto');
  return product;
}

// Guarda ficheiros no storage e devolve os registos a criar. Feito fora da
// transação (como no cadastro de empresas) — bytes primeiro, linhas depois.
async function persistProductMedia({ mainImage = null, gallery = [], documents = [] }, keyHint) {
  const imageRecords = [];
  let primaryUrl = null;

  if (mainImage) {
    primaryUrl = await storageService.saveFile({
      buffer: mainImage.buffer, originalname: mainImage.originalname, mimetype: mainImage.mimetype,
      keyHint: `${keyHint}-main`, folder: 'products',
    });
    imageRecords.push({ url: primaryUrl, isPrimary: true, sortOrder: 0 });
  }
  for (let i = 0; i < gallery.length; i++) {
    const g = gallery[i];
    const url = await storageService.saveFile({
      buffer: g.buffer, originalname: g.originalname, mimetype: g.mimetype,
      keyHint: `${keyHint}-g${i}`, folder: 'products',
    });
    // Se não houver imagem principal, a primeira da galeria assume esse papel.
    if (!primaryUrl && i === 0) { primaryUrl = url; imageRecords.push({ url, isPrimary: true, sortOrder: 0 }); }
    else imageRecords.push({ url, isPrimary: false, sortOrder: i + 1 });
  }

  const docRecords = [];
  for (const d of documents) {
    const fileUrl = await storageService.saveFile({
      buffer: d.file.buffer, originalname: d.file.originalname, mimetype: d.file.mimetype,
      keyHint: `${keyHint}-${d.type}`, folder: 'documents',
    });
    docRecords.push({ type: d.type, fileUrl, originalName: d.file.originalname });
  }

  return { imageRecords, docRecords, primaryUrl };
}

async function createProduct(supplierCompanyId, data, media = {}) {
  const supplier = await prisma.company.findUnique({ where: { id: supplierCompanyId } });
  if (!supplier || supplier.type !== 'FORNECEDOR') {
    throw new ForbiddenError('Apenas empresas fornecedoras podem publicar itens no catálogo.');
  }
  if (supplier.status !== 'APROVADA') {
    throw new ForbiddenError('A empresa precisa estar credenciada (due diligence aprovada) para publicar itens.');
  }

  const keyHint = (data.sku || data.name || 'produto').toString().replace(/\s+/g, '-').slice(0, 40);
  const { imageRecords, docRecords, primaryUrl } = await persistProductMedia(media, keyHint);

  return prisma.product.create({
    data: {
      ...data,
      supplierId: supplierCompanyId,
      imageUrl: primaryUrl || undefined,
      images: imageRecords.length ? { create: imageRecords } : undefined,
      documents: docRecords.length ? { create: docRecords } : undefined,
    },
    include: { images: true, documents: true },
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

async function setProductImage(id, supplierCompanyId, file) {
  const product = await getProduct(id);
  if (product.supplierId !== supplierCompanyId) {
    throw new ForbiddenError('Só pode editar itens da sua própria empresa.');
  }
  // Guarda no provider configurado (local/S3) só depois de validar a propriedade.
  const imageUrl = await storageService.saveImage({
    buffer: file.buffer,
    originalname: file.originalname,
    mimetype: file.mimetype,
    keyHint: id,
  });
  return prisma.product.update({ where: { id }, data: { imageUrl } });
}

module.exports = { listCatalog, getProduct, createProduct, updateProduct, deactivateProduct, setProductImage };
