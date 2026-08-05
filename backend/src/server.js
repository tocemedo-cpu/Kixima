// src/server.js
// Ponto de entrada do processo. Usa `node -r dotenv/config src/server.js
// dotenv_config_path=.env.<ambiente>` (ver scripts em package.json).

const app = require('./app');
const config = require('./config/env');
const logger = require('./config/logger');
const prisma = require('./config/database');
const { schedulePolicyExpiryJob } = require('./jobs/policyExpiryJob');
const eventBus = require('./services/eventBus');

const server = app.listen(config.port, () => {
  logger.info(`KIXIMA API a correr em ${config.appUrl} (${config.env})`);
  schedulePolicyExpiryJob();
  // Regista nos logs se a integração ERP (RabbitMQ) está ativa.
  eventBus.init();
});

async function shutdown(signal) {
  logger.info(`${signal} recebido — a encerrar graciosamente...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
