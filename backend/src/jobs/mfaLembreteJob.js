// src/jobs/mfaLembreteJob.js
// Lembra automaticamente quem ainda não ativou a verificação em dois passos.
//
// Porquê não deixar isto no botão da página de Prontidão: um botão só funciona
// se alguém se lembrar de carregar nele, e o problema que estamos a resolver É
// gente a não se lembrar. Se o prazo chegar e oito contas com poder ficarem
// trancadas no ecrã de ativação, a culpa não foi delas — foi de o aviso ter
// dependido de um gesto manual que ninguém marcou na agenda.
//
// Não usa `cron.schedule` de propósito. No plano gratuito do Render o serviço
// suspende sem tráfego, e um agendamento a hora fixa não corre quando o processo
// está adormecido. A pergunta aqui é "há alguém por avisar hoje?", e essa pode
// ser feita sempre que o serviço estiver acordado — o que acontece sempre que
// alguém o usa. A proteção contra insistir é o próprio serviço: ninguém é
// lembrado duas vezes em 24 horas.
const logger = require('../config/logger');
const config = require('../config/env');
const mfaLembreteService = require('../services/mfaLembreteService');

const INTERVALO_MS = 60 * 60 * 1000;              // de hora a hora, enquanto acordado
const ESPERA_APOS_ARRANQUE_MS = 5 * 60 * 1000;    // não competir com o arranque

async function correr() {
  try {
    const r = await mfaLembreteService.lembretesAutomaticos();
    if (r.corrido && r.enviados?.length) {
      logger.info(`Lembrete de 2FA enviado a ${r.enviados.length} conta(s) — faltam ${r.dias} dias.`);
    }
    if (r.corrido && r.falhas?.length) {
      logger.error(`Lembrete de 2FA falhou em ${r.falhas.length} conta(s)`, { falhas: r.falhas });
    }
  } catch (err) {
    logger.error('Falha ao processar lembretes de 2FA', { erro: err.message });
  }
}

function scheduleMfaLembreteJob() {
  // Sem data de entrada em vigor não há nada para lembrar: a 2FA é um convite,
  // e um convite repetido por email é spam.
  if (!config.auth.mfaEnforceFrom) return;

  logger.info(
    'Lembretes de 2FA ativos: semanais enquanto o prazo estiver longe, diários na última semana.',
  );
  setTimeout(correr, ESPERA_APOS_ARRANQUE_MS).unref?.();
  setInterval(correr, INTERVALO_MS).unref?.();
}

module.exports = { scheduleMfaLembreteJob, correr };
