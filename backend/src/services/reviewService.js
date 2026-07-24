// src/services/reviewService.js
// Avaliações reais (média + contagem) de um produto/serviço.
const prisma = require('../config/database');
const { NotFoundError } = require('../utils/errors');

async function addReview(productId, userId, { rating, comment }) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError('Produto');

  await prisma.review.upsert({
    where: { productId_userId: { productId, userId } },
    update: { rating, comment: comment || null },
    create: { productId, userId, rating, comment: comment || null },
  });

  // Recalcula a média e a contagem a partir das avaliações reais.
  const agg = await prisma.review.aggregate({
    where: { productId }, _avg: { rating: true }, _count: { _all: true },
  });
  const avg = agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null;
  await prisma.product.update({
    where: { id: productId },
    data: { rating: avg, reviewCount: agg._count._all },
  });
  return { rating: avg, reviewCount: agg._count._all };
}

async function listForProduct(productId) {
  return prisma.review.findMany({
    where: { productId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

module.exports = { addReview, listForProduct };
