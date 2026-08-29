// src/services/multicaixaService.js
// Multicaixa Express (EMIS) — implementado contra a especificação, POR LIGAR.
//
// LEIA ISTO ANTES DE USAR. Este módulo não está ligado a nada. Não existem
// credenciais EMIS nesta plataforma, e o contrato com a EMIS é uma decisão
// comercial que ainda não foi tomada. O que está aqui é a forma do adaptador:
// as chamadas, os estados, o que se guarda e o que se recusa a fazer.
//
// PORQUE EXISTE ASSIM. A alternativa era não escrever nada até haver contrato.
// O custo dessa alternativa aparece depois: o dia em que as credenciais chegam
// é o dia em que se descobre que o fluxo de pagamento não tem sítio por onde
// entrar um segundo canal, e a integração passa a ser uma cirurgia em vez de
// uma configuração. O canal da referência bancária já obrigou a abrir esse
// espaço; este ocupa-o.
//
// RECUSA-SE A FINGIR. Sem credenciais, cada função lança com uma mensagem que
// diz exatamente o que falta. Não devolve sucesso simulado, não devolve dados
// de exemplo: um canal de pagamento que responde "pago" sem falar com o banco é
// a pior avaria que esta plataforma pode ter, e um modo de simulação acaba
// sempre por ser ligado em produção por engano.

const config = require('../config/env');

const CONFIG = {
  baseUrl: process.env.EMIS_BASE_URL || '',
  posId: process.env.EMIS_POS_ID || '',
  token: process.env.EMIS_TOKEN || '',
  callbackUrl: process.env.EMIS_CALLBACK_URL || '',
};

function emFalta() {
  return Object.entries(CONFIG).filter(([, v]) => !String(v || '').trim()).map(([k]) => k);
}

function disponivel() {
  return emFalta().length === 0;
}

function exigirConfiguracao() {
  const falta = emFalta();
  if (falta.length) {
    throw new Error(
      'Multicaixa Express não está configurado. Em falta: '
      + falta.map((k) => `EMIS_${k.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`).join(', ')
      + '. Este canal não funciona sem credenciais da EMIS — e não simula pagamentos.',
    );
  }
}

/**
 * Pede um pagamento ao telemóvel do comprador.
 *
 * Genérico de propósito — usado tanto para faturas de fornecedor como para
 * cobranças de subscrição (planoCobranca), que não têm nada em comum além de
 * "uma referência, um valor, uma moeda". Passar o documento inteiro obrigaria
 * este ficheiro a conhecer dois modelos diferentes; passar só o que é preciso
 * mantém-no cego ao resto da plataforma.
 *
 * O montante vai em cêntimos e como INTEIRO. Enviar decimais a uma API de
 * pagamentos é como se perde dinheiro em arredondamentos que ninguém vê até ao
 * fecho de contas.
 */
async function pedirPagamento({ referencia, valor, moeda, telemovel }) {
  exigirConfiguracao();

  if (moeda !== 'AOA') {
    // O Multicaixa é kwanza. Um documento noutra moeda (as subscrições são em
    // USD) tem de ir por outro canal em vez de ser convertido em silêncio a
    // uma taxa que ninguém escolheu.
    throw new Error(`O Multicaixa Express só liquida em AOA; este documento está em ${moeda}.`);
  }

  const corpo = {
    reference: referencia,
    amount: Math.round(Number(valor) * 100),
    currency: 'AOA',
    token: CONFIG.token,
    mobile: telemovel,
    callbackUrl: CONFIG.callbackUrl,
    posID: CONFIG.posId,
  };

  const resposta = await fetch(`${CONFIG.baseUrl}/online-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CONFIG.token}` },
    body: JSON.stringify(corpo),
  });

  if (!resposta.ok) {
    throw new Error(`A EMIS recusou o pedido (${resposta.status}). A fatura NÃO foi paga.`);
  }
  return resposta.json();
}

/**
 * Confere um aviso de pagamento recebido da EMIS.
 *
 * NUNCA se acredita no callback pelo valor que ele traz. Um callback é um
 * pedido HTTP que qualquer pessoa na internet pode enviar; aceitar o "pago" que
 * vem lá dentro seria deixar o pagamento à mercê de quem souber o endereço.
 * Confirma-se sempre contra a EMIS, e é o que ELA diz que conta.
 */
async function confirmarCallback(payload) {
  exigirConfiguracao();

  const idTransacao = payload?.id || payload?.transactionId;
  if (!idTransacao) throw new Error('Callback sem identificador de transação.');

  const resposta = await fetch(`${CONFIG.baseUrl}/transactions/${encodeURIComponent(idTransacao)}`, {
    headers: { Authorization: `Bearer ${CONFIG.token}` },
  });
  if (!resposta.ok) {
    throw new Error(`Não foi possível confirmar a transação ${idTransacao} junto da EMIS.`);
  }

  const verdade = await resposta.json();
  return {
    idTransacao,
    pago: verdade.status === 'ACCEPTED',
    montante: Number(verdade.amount || 0) / 100,
    referencia: verdade.reference || null,
    // Devolve-se o que a EMIS disse, e não o que o callback afirmava.
    origem: 'EMIS',
  };
}

// O estado deste canal, para o painel de prontidão o mostrar em vez de a
// ausência ser descoberta por um comprador que carrega no botão.
function estado() {
  return {
    canal: 'MULTICAIXA_EXPRESS',
    disponivel: disponivel(),
    emFalta: emFalta(),
    nota: disponivel()
      ? 'Configurado.'
      : 'Implementado contra a especificação da EMIS, por ligar. Requer contrato e credenciais.',
  };
}

module.exports = { disponivel, estado, pedirPagamento, confirmarCallback, emFalta, config };
