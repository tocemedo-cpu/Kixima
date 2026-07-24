// src/services/favoriteService.js
// Favoritos (coração) persistidos por utilizador.
const prisma = require('../config/database');
const { NotFoundError } = require('../utils/errors');

async function listIds(userId) {
  const favs = await prisma.favorite.findMany({ where: { userId }, select: { productId: true } });
  return favs.map((f) => f.productId);
}

async function add(userId, productId) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError('Produto');
  await prisma.favorite.upsert({
    where: { userId_productId: { userId, productId } },
    update: {},
    create: { userId, productId },
  });
  return { productId, favorite: true };
}

async function remove(userId, productId) {
  await prisma.favorite.deleteMany({ where: { userId, productId } });
  return { productId, favorite: false };
}

module.exports = { listIds, add, remove };
