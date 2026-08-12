// src/server.js
// Ponto de entrada do processo. Usa `node -r dotenv/config src/server.js
// dotenv_config_path=.env.<ambiente>` (ver scripts em package.json).

const app = require('./app');
const config = require('./config/env');
const logger = require('./config/logger');
const prisma = require('./config/database');
const { schedulePolicyExpiryJob } = require('./jobs/policyExpiryJob');
const { scheduleBackupJob } = require('./jobs/backupJob');
const eventBus = require('./services/eventBus');

const server = app.listen(config.port, () => {
  logger.info(`KIXIMA API a correr em ${config.appUrl} (${config.env})`);
  // Onde ficam os ficheiros (documentos de credenciamento, comprovativos de
  // pagamento, imagens): visível no log do deploy, para não ser preciso
  // descobri-lo quando um upload falha.
  const storage = require('./services/storageService');
  const ativo = storage.providerAtivo();
  logger.info(
    ativo === 's3'
      ? `Armazenamento: S3 (bucket ${config.storage.bucket})`
      : 'Armazenamento: disco do contentor — os ficheiros NÃO sobrevivem a um reinício',
  );
  schedulePolicyExpiryJob();
  scheduleBackupJob();
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
