// src/jobs/policyExpiryJob.js
// Corre diariamente: avisa Company Admin + Financeiro POLICY_EXPIRY_ALERT_DAYS
// antes da apólice KIXIMA→Cliente expirar (secção 4.3 da especificação).

const cron = require('node-cron');
const logger = require('../config/logger');
const policyService = require('../services/policyService');
const alertaOperacional = require('../services/alertaOperacionalService');

function schedulePolicyExpiryJob() {
  // Todos os dias às 07:00.
  cron.schedule('0 7 * * *', async () => {
    try {
      const count = await policyService.sendExpiryAlerts();
      if (count > 0) {
        logger.info(`Alertas de expiração de apólice enviados: ${count}`);
      }
    } catch (err) {
      logger.error('Falha ao processar alertas de expiração de apólice', { message: err.message });
      await alertaOperacional.avisarFalha(
        'EXPIRACAO_APOLICES',
        'os avisos de expiração de apólice falharam',
        `O processamento não correu.\n\nErro: ${err.message}\n\n`
        + 'Uma apólice que expira sem aviso deixa uma transação sem cobertura — que é a garantia '
        + 'que a plataforma promete.',
      ).catch(() => {});
    }
  });
}

module.exports = { schedulePolicyExpiryJob };
