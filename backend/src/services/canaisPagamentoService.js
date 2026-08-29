// src/services/canaisPagamentoService.js
// Ponto único que sabe mapear um CanalCobranca ao adaptador que fala com
// esse gateway. Existe para que assinaturaService.js, a rota de webhook e o
// painel de prontidão nunca divirjam sobre qual serviço trata qual canal.
const multicaixaService = require('./multicaixaService');
const paypayService = require('./paypayService');
const bancoGatewayService = require('./bancoGatewayService');

// Todos os canais de pagamento automático — sem a transferência manual, que
// não passa por nenhum adaptador (é o formulário de comprovativo de sempre).
const CANAIS_GATEWAY = ['EMIS_MULTICAIXA', 'PAYPAY', 'BAI', 'BFA', 'STANDARD_BANK_ANGOLA'];

/** O adaptador para um canal — ou null para TRANSFERENCIA_MANUAL/desconhecido. */
function adaptador(canal) {
  if (canal === 'EMIS_MULTICAIXA') return multicaixaService;
  if (canal === 'PAYPAY') return paypayService;
  if (['BAI', 'BFA', 'STANDARD_BANK_ANGOLA'].includes(canal)) return bancoGatewayService.criarAdaptador(canal);
  return null;
}

/** O estado de todos os canais de pagamento automático, para o painel de prontidão. */
function estados() {
  return Object.fromEntries(CANAIS_GATEWAY.map((canal) => [canal, adaptador(canal).estado()]));
}

module.exports = { CANAIS_GATEWAY, adaptador, estados };
