// src/jobs/poRoboJob.js
// Automatic PO Robot (add-on PRO): corre diariamente e prepara as POs cuja
// regra chegou à vez — nunca aprova nem paga (ver poRoboService.js).

const cron = require('node-cron');
const logger = require('../config/logger');
const poRoboService = require('../services/poRoboService');
const alertaOperacional = require('../services/alertaOperacionalService');

function schedulePoRoboJob() {
  // Todos os dias às 06:00.
  cron.schedule('0 6 * * *', async () => {
    try {
      const resultado = await poRoboService.executarCiclo();
      if (resultado.total > 0) {
        logger.info('PO Robot: ciclo concluído', {
          total: resultado.total, criadas: resultado.criadas, falhas: resultado.falhas.length,
        });
      }
    } catch (err) {
      logger.error('Falha ao correr o ciclo do PO Robot', { message: err.message });
      await alertaOperacional.avisarFalha(
        'PO_ROBOT',
        'o ciclo do Automatic PO Robot falhou',
        `O processamento não correu.\n\nErro: ${err.message}\n\n`
        + 'Regras ativas ficam por executar até à próxima corrida — nenhuma PO se perde, só atrasa.',
      ).catch(() => {});
    }
  });
}

module.exports = { schedulePoRoboJob };
