// src/utils/reference.js
// Gera referências legíveis (PO-2026-000123) com contagem atómica por tabela+ano.

const prisma = require('../config/database');

async function nextReference(prefix, counterModel, dateField = 'createdAt') {
  const year = new Date().getFullYear();
  const start = new Date(`${year}-01-01T00:00:00.000Z`);
  const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  const count = await prisma[counterModel].count({
    where: { [dateField]: { gte: start, lt: end } },
  });

  const seq = String(count + 1).padStart(6, '0');
  return `${prefix}-${year}-${seq}`;
}

module.exports = { nextReference };
