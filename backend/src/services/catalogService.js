// src/services/catalogService.js

const prisma = require('../config/database');
const paginacao = require('../utils/paginacao');
const planService = require('./planService');
const { NotFoundError, ForbiddenError } = require('../utils/errors');
const storageService = require('./storageService');
const notificationService = require('./notificationService');

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
/**
 * A galeria e os documentos deste item cabem no plano?
 *
 * Conta a imagem principal, porque para quem publica ela é uma foto como as
 * outras — dizer "3 imagens" e depois aceitar 4 seria mentir na tabela de preços.
 *
 * `existingImages`/`existingDocs` contam o que o produto já tem (edição de um
 * item publicado) — na criação ficam a 0, sem alterar o comportamento.
 */
function assertMediaCabeNoPlano(empresa, { mainImage = null, gallery = [], documents = [], existingImages = 0, existingDocs = 0 } = {}) {
  const imagens = existingImages + (mainImage ? 1 : 0) + (gallery?.length || 0);
  const maxImagens = planService.limite(empresa?.plan, 'imagensPorItem');
  if (maxImagens !== planService.ILIMITADO && imagens > maxImagens) {
    planService.assertLimite(empresa, 'imagensPorItem', maxImagens, 'imagens por item');
  }
  const docs = existingDocs + (documents?.length || 0);
  const maxDocs = planService.limite(empresa?.plan, 'documentosPorItem');
  if (maxDocs !== planService.ILIMITADO && docs > maxDocs) {
    planService.assertLimite(empresa, 'documentosPorItem', maxDocs, 'documentos técnicos por item');
  }
}

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
  // Quantos itens a empresa publica NÃO é limitado, em plano nenhum — é a
  // densidade do catálogo que faz o marketplace valer. O que o plano limita é
  // quanta MÍDIA cada item leva: mais fotos e mais fichas técnicas vendem
  // melhor, e isso é o que se paga.
  assertMediaCabeNoPlano(supplier, media);
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

  // Mantém a galeria (ProductImage) em sincronia com Product.imageUrl — a
  // foto anterior (se havia) não é apagada, só deixa de ser a principal e
  // passa a fazer parte da galeria.
  const nextSortOrder = product.images.reduce((max, img) => Math.max(max, img.sortOrder), -1) + 1;
  return prisma.$transaction(async (tx) => {
    if (product.images.some((img) => img.isPrimary)) {
      await tx.productImage.updateMany({ where: { productId: id, isPrimary: true }, data: { isPrimary: false } });
    }
    await tx.productImage.create({ data: { productId: id, url: imageUrl, isPrimary: true, sortOrder: nextSortOrder } });
    return tx.product.update({ where: { id }, data: { imageUrl } });
  });
}

// Acrescenta fotos/documentos a um item já publicado — respeitando o mesmo
// limite do plano da criação, mas contando o que o produto já tem.
async function addProductMedia(id, supplierCompanyId, media = {}) {
  const product = await getProduct(id);
  if (product.supplierId !== supplierCompanyId) {
    throw new ForbiddenError('Só pode editar itens da sua própria empresa.');
  }
  const supplier = await prisma.company.findUnique({ where: { id: supplierCompanyId } });
  const gallery = media.gallery || [];
  const documents = media.documents || [];
  assertMediaCabeNoPlano(supplier, {
    gallery,
    documents,
    existingImages: product.images.length,
    existingDocs: product.documents.length,
  });

  const keyHint = (product.sku || product.name || 'produto').toString().replace(/\s+/g, '-').slice(0, 40);
  const hasPrimaryAlready = product.images.some((img) => img.isPrimary);
  let nextSortOrder = product.images.reduce((max, img) => Math.max(max, img.sortOrder), -1) + 1;

  const imageRecords = [];
  for (let i = 0; i < gallery.length; i++) {
    const g = gallery[i];
    const url = await storageService.saveFile({
      buffer: g.buffer, originalname: g.originalname, mimetype: g.mimetype,
      keyHint: `${keyHint}-add${i}`, folder: 'products',
    });
    // Só vira principal se o produto ainda não tinha nenhuma foto.
    imageRecords.push({ url, isPrimary: !hasPrimaryAlready && i === 0, sortOrder: nextSortOrder++ });
  }

  const docRecords = [];
  for (const d of documents) {
    const fileUrl = await storageService.saveFile({
      buffer: d.file.buffer, originalname: d.file.originalname, mimetype: d.file.mimetype,
      keyHint: `${keyHint}-${d.type}-add`, folder: 'documents',
    });
    docRecords.push({ type: d.type, fileUrl, originalName: d.file.originalname });
  }

  const novaPrincipal = imageRecords.find((r) => r.isPrimary);
  return prisma.product.update({
    where: { id },
    data: {
      images: imageRecords.length ? { create: imageRecords } : undefined,
      documents: docRecords.length ? { create: docRecords } : undefined,
      ...(novaPrincipal ? { imageUrl: novaPrincipal.url } : {}),
    },
    include: { images: true, documents: true },
  });
}

// Remove uma foto da galeria. Se era a principal, promove a próxima (menor
// sortOrder) e sincroniza Product.imageUrl; sem galeria, fica sem imagem.
async function removeProductImage(productId, supplierCompanyId, imageId) {
  const product = await getProduct(productId);
  if (product.supplierId !== supplierCompanyId) {
    throw new ForbiddenError('Só pode editar itens da sua própria empresa.');
  }
  const image = product.images.find((img) => img.id === imageId);
  if (!image) throw new NotFoundError('Imagem');

  await prisma.productImage.delete({ where: { id: imageId } });

  if (image.isPrimary) {
    // product.images já vem ordenada (isPrimary desc, sortOrder asc) —
    // o primeiro que sobrar depois de tirar a que foi removida é a próxima.
    const proxima = product.images.find((img) => img.id !== imageId) || null;
    if (proxima) {
      await prisma.productImage.update({ where: { id: proxima.id }, data: { isPrimary: true } });
    }
    await prisma.product.update({ where: { id: productId }, data: { imageUrl: proxima?.url || null } });
  }
  return { id: imageId, removida: true };
}

// Remove um documento técnico do produto. Não apaga o ficheiro do storage —
// mesmo princípio de "não apagar" já usado em deactivateProduct/Kit.
async function removeProductDocument(productId, supplierCompanyId, docId) {
  const product = await getProduct(productId);
  if (product.supplierId !== supplierCompanyId) {
    throw new ForbiddenError('Só pode editar itens da sua própria empresa.');
  }
  const doc = product.documents.find((d) => d.id === docId);
  if (!doc) throw new NotFoundError('Documento');
  await prisma.productDocument.delete({ where: { id: docId } });
  return { id: docId, removido: true };
}

// Atualiza apenas os campos de inventário de um produto da própria empresa.
async function updateStock(id, supplierCompanyId, data) {
  const product = await getProduct(id);
  if (product.supplierId !== supplierCompanyId) {
    throw new ForbiddenError('Só pode gerir o stock de itens da sua própria empresa.');
  }
  const { stockQuantity, minStock, warehouse, availability } = data;
  const updated = await prisma.product.update({
    where: { id },
    data: { stockQuantity, minStock, warehouse, availability },
  });

  // Aviso de stock baixo só na TRANSIÇÃO — ver createStockMovement.
  const minAtual = updated.minStock;
  const wasBelow = product.minStock != null && (product.stockQuantity ?? 0) <= product.minStock;
  const isBelowNow = minAtual != null && (updated.stockQuantity ?? 0) <= minAtual;
  if (!wasBelow && isBelowNow) {
    await notificationService.events.estoqueBaixo(updated);
  }

  return updated;
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

  const movement = await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id: productId }, data: { stockQuantity: next } });
    return tx.stockMovement.create({
      data: { productId, type, quantity, note: note || null, createdById: userId },
    });
  });

  // Aviso de stock baixo só na TRANSIÇÃO para não repetir a cada movimento
  // seguinte enquanto o stock continuar abaixo do mínimo.
  if (product.minStock != null && current > product.minStock && next <= product.minStock) {
    await notificationService.events.estoqueBaixo({ ...product, stockQuantity: next });
  }

  return movement;
}

async function listStockMovements(supplierCompanyId, { type, page, limit } = {}) {
  // Estava aqui um `take: 200` fixo. O histórico de movimentos de stock é a
  // tabela que mais depressa cresce do lado do fornecedor — uma entrada e uma
  // saída por cada linha de cada ordem. Ao fim de uns meses, os 200 mais
  // recentes são uma semana, e o resto desaparecia sem aviso. É o registo que
  // se consulta justamente quando as contas não batem certo.
  const p = paginacao.parametros({ page, limit });
  const where = { product: { supplierId: supplierCompanyId }, ...(type ? { type } : {}) };

  const [total, itens] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      select: {
        id: true, type: true, quantity: true, note: true, createdAt: true,
        productId: true, product: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: p.skip, take: p.take,
    }),
  ]);
  return paginacao.envelope(itens, total, p);
}

module.exports = {
  listCatalog, getProduct, getProductBySlug, createProduct, updateProduct, deactivateProduct, setProductImage,
  addProductMedia, removeProductImage, removeProductDocument,
  updateStock, listSupplierDocuments, createStockMovement, listStockMovements, incrementView,
};
