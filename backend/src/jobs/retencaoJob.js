// src/jobs/retencaoJob.js
// Aplica a política de retenção periodicamente.
//
// Não usa cron: correr uma vez por dia com hora marcada obrigaria o contentor a
// estar acordado a essa hora, e no plano gratuito ele suspende sozinho. Um
// intervalo simples corre sempre que o serviço estiver de pé, e a política é
// idempotente — apagar o que já não existe não custa nada.
//
// É por isso que também não há recuperação de execuções perdidas: não há nada a
// recuperar. Se o serviço esteve em baixo três dias, a limpeza seguinte apanha
// os três dias de uma vez.
const logger = require('../config/logger');
const retencao = require('../services/retencaoService');

// Uma hora depois do arranque: o arranque já tem migrações, seed e a primeira
// vaga de pedidos: não é altura para uma limpeza.
const ESPERA_APOS_ARRANQUE_MS = 60 * 60 * 1000;
const INTERVALO_MS = 24 * 60 * 60 * 1000;

let emCurso = null;

async function correr() {
  // Single-flight, como nas cópias de segurança: dois DELETE grandes ao mesmo
  // tempo na mesma tabela é a receita para um lock desnecessário.
  if (emCurso) return emCurso;
  emCurso = (async () => {
    try {
      return await retencao.limpar();
    } catch (err) {
      // Falhar a limpeza não pode derrubar o serviço — é higiene, não é o
      // caminho crítico. Mas fica registado: uma limpeza que nunca corre é uma
      // política de retenção que não se cumpre.
      logger.error(`Retenção: a limpeza falhou — ${err.message}`);
      return null;
    } finally {
      emCurso = null;
    }
  })();
  return emCurso;
}

function scheduleRetencaoJob() {
  setTimeout(correr, ESPERA_APOS_ARRANQUE_MS).unref?.();
  setInterval(correr, INTERVALO_MS).unref?.();
  logger.info('Retenção de dados: limpeza agendada (diária)');
}

module.exports = { scheduleRetencaoJob, correr };
