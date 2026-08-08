// src/services/catalogService.js

const prisma = require('../config/database');
const { NotFoundError, ForbiddenError } = require('../utils/errors');
const storageService = require('./storageService');

// Gera um slug URL-amigável a partir do nome + sufixo curto para ser único.
function slugify(name, hint) {
  const base = String(name || 'item')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
  return `${base || 'item'}-${String(hint).slice(0, 6)}`;
}

async function listCatalog({ category, search, supplierId, excludeSupplierId, kind } = {}) {
  return prisma.product.findMany({
    where: {
      active: true,
      ...(category ? { category } : {}),
      // PRODUTO vs SERVICO — a página de Produtos pede kind=PRODUTO e a de
      // Serviços kind=SERVICO; sem o parâmetro, devolve ambos (Explorar/geral).
      ...(kind === 'PRODUTO' || kind === 'SERVICO' ? { kind } : {}),
      ...(supplierId ? { supplierId } : {}),
      // Um comprador não vê (nem compra) produtos da própria empresa.
      ...(excludeSupplierId ? { supplierId: { not: excludeSupplierId } } : {}),
      ...(search
        ? { name: { contains: search, mode: 'insensitive' } }
        : {}),
    },
    include: { supplier: { select: { id: true, name: true, status: true, verified: true, logoUrl: true, city: true, country: true } } },
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

async function getProductBySlug(slug) {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      supplier: { select: { id: true, name: true, status: true, verified: true, logoUrl: true } },
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
  const slug = slugify(data.name, Math.random().toString(36).slice(2, 8));

  return prisma.product.create({
    data: {
      ...data,
      slug,
      supplierId: supplierCompanyId,
      // Imagem: a carregada pelo fornecedor tem prioridade; senão, a imagem do
      // catálogo de referência (escolhida no dropdown de classificação).
      imageUrl: primaryUrl || data.imageUrl || undefined,
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

// Atualiza apenas os campos de inventário de um produto da própria empresa.
async function updateStock(id, supplierCompanyId, data) {
  const product = await getProduct(id);
  if (product.supplierId !== supplierCompanyId) {
    throw new ForbiddenError('Só pode gerir o stock de itens da sua própria empresa.');
  }
  const { stockQuantity, minStock, warehouse, availability } = data;
  return prisma.product.update({
    where: { id },
    data: { stockQuantity, minStock, warehouse, availability },
  });
}

// Regista uma visualização do produto (compradores) — usado nos relatórios.
async function incrementView(id) {
  try {
    await prisma.product.update({ where: { id }, data: { viewCount: { increment: 1 } } });
  } catch {
    /* produto inexistente — ignora (contador é best-effort) */
  }
}

// Reúne todos os documentos do fornecedor: documentos técnicos dos produtos
// (ficha técnica, certificado, catálogo, etc.) + documentos da empresa
// (alvará, licença ANPG, certidão) para o módulo de Documentação.
async function listSupplierDocuments(supplierCompanyId) {
  const [productDocs, companyDocs] = await Promise.all([
    prisma.productDocument.findMany({
      where: { product: { supplierId: supplierCompanyId } },
      select: {
        id: true, type: true, fileUrl: true, originalName: true, createdAt: true,
        productId: true, product: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.companyDocument.findMany({
      where: { companyId: supplierCompanyId },
      select: { id: true, type: true, fileUrl: true, originalName: true, createdAt: true },
      orderBy: { type: 'asc' },
    }),
  ]);
  return {
    productDocs: productDocs.map(({ product, ...d }) => ({ ...d, productName: product?.name || '—' })),
    companyDocs,
  };
}

// Regista uma entrada/saída de inventário e ajusta o stock do produto.
async function createStockMovement(supplierCompanyId, userId, { productId, type, quantity, note }) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.supplierId !== supplierCompanyId) {
    throw new NotFoundError('Produto');
  }
  const current = product.stockQuantity || 0;
  const delta = type === 'ENTRADA' ? quantity : -quantity;
  const next = Math.max(0, current + delta);

  return prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id: productId }, data: { stockQuantity: next } });
    return tx.stockMovement.create({
      data: { productId, type, quantity, note: note || null, createdById: userId },
    });
  });
}

async function listStockMovements(supplierCompanyId, { type } = {}) {
  return prisma.stockMovement.findMany({
    where: { product: { supplierId: supplierCompanyId }, ...(type ? { type } : {}) },
    select: {
      id: true, type: true, quantity: true, note: true, createdAt: true,
      productId: true, product: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

module.exports = {
  listCatalog, getProduct, getProductBySlug, createProduct, updateProduct, deactivateProduct, setProductImage,
  updateStock, listSupplierDocuments, createStockMovement, listStockMovements, incrementView,
};
