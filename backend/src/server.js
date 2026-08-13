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

  // Estado do email. Sem isto, uma configuração em falta só se descobre quando
  // alguém se queixa de nunca ter recebido o convite ou o link de recuperação —
  // e aí já passaram dias.
  if (config.email.apenasLog) {
    logger.error(
      'Email: NENHUM envio real está configurado (EMAIL_PROVIDER=console). Convites, recuperação '
      + 'de senha, avisos de fatura e confirmações ficam apenas no log — o utilizador não vê erro '
      + 'nenhum e simplesmente nunca recebe nada. Defina EMAIL_PROVIDER=brevo + BREVO_API_KEY.',
    );
  } else if (config.email.missing.length) {
    logger.error(
      `Email: provider "${config.email.provider}" ativo mas mal configurado — faltam: `
      + `${config.email.missing.join(', ')}. Os envios vão falhar em silêncio.`,
    );
  } else {
    logger.info(`Email: ${config.email.provider} (remetente ${config.email.from})`);
  }
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
