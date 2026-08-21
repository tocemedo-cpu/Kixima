// src/jobs/subscriptionExpiryJob.js
// Corre diariamente: avisa Company Admin + Financeiro em patamares (30/7/3/1/0
// dias e durante o período de tolerância) antes/depois de a subscrição vencer.
// Mesmo padrão de policyExpiryJob.js — a lógica em si vive em
// assinaturaService.enviarAvisosDeExpiracao, este ficheiro só agenda.

const cron = require('node-cron');
const logger = require('../config/logger');
const assinaturaService = require('../services/assinaturaService');
const alertaOperacional = require('../services/alertaOperacionalService');

function scheduleSubscriptionExpiryJob() {
  // Todos os dias às 07:00 — mesma hora do aviso de expiração de apólices.
  cron.schedule('0 7 * * *', async () => {
    try {
      const count = await assinaturaService.enviarAvisosDeExpiracao();
      if (count > 0) {
        logger.info(`Avisos de expiração de subscrição enviados: ${count}`);
      }
    } catch (err) {
      logger.error('Falha ao processar avisos de expiração de subscrição', { message: err.message });
      await alertaOperacional.avisarFalha(
        'EXPIRACAO_SUBSCRICOES',
        'os avisos de expiração de subscrição falharam',
        `O processamento não correu.\n\nErro: ${err.message}\n\n`
        + 'Uma subscrição que vence sem aviso é receita perdida em silêncio — a empresa não sabe '
        + 'que tem de renovar, e a KIXIMA só descobre quando alguém olhar para a fila do Admin.',
      ).catch(() => {});
    }
  });
}

module.exports = { scheduleSubscriptionExpiryJob };
