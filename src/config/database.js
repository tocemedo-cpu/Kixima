// src/config/database.js
// Instância única do Prisma Client. Todo o resto do código deve importar
// a base de dados a partir daqui, nunca instanciar PrismaClient noutro sítio.

const { PrismaClient } = require('@prisma/client');
const config = require('./env');

const prisma = new PrismaClient({
  log: config.isDevelopment ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
