// src/services/paypayService.js
// PayPay — adaptador PLACEHOLDER, POR LIGAR E POR CONFIRMAR.
//
// LEIA ISTO ANTES DE USAR. Ao contrário do Multicaixa Express (esquema
// nacional documentado publicamente, ver multicaixaService.js), não há aqui
// nenhuma documentação real da API da PayPay à disposição desta plataforma.
// O que está neste ficheiro é a forma MAIS PROVÁVEL de uma carteira móvel
// angolana funcionar (pedir pagamento a um número de telemóvel, confirmar por
// callback) — não é uma implementação verificada contra a especificação real
// da PayPay, e os nomes dos campos do pedido/resposta (`corpo`/`verdade`
// abaixo) são um palpite razoável, não um facto. Antes de ligar a produção,
// isto tem de ser conferido campo a campo contra a documentação real que a
// PayPay fornecer no contrato comercial.
//
// RECUSA-SE A FINGIR, tal como o Multicaixa: sem credenciais, cada função
// lança com uma mensagem que diz exatamente o que falta. Não devolve sucesso
// simulado — um canal de pagamento que responde "pago" sem falar com a PayPay
// é a pior avaria que esta plataforma pode ter.
const CONFIG = {
  baseUrl: process.env.PAYPAY_BASE_URL || '',
  merchantId: process.env.PAYPAY_MERCHANT_ID || '',
  token: process.env.PAYPAY_TOKEN || '',
  callbackUrl: process.env.PAYPAY_CALLBACK_URL || '',
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
      'PayPay não está configurado. Em falta: '
      + falta.map((k) => `PAYPAY_${k.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`).join(', ')
      + '. Este canal não funciona sem credenciais da PayPay — e não simula pagamentos.',
    );
  }
}

/**
 * Pede um pagamento ao telemóvel do comprador.
 *
 * Genérico (referência/valor/moeda/telemóvel), tal como multicaixaService —
 * usado tanto para faturas de fornecedor como para cobranças de subscrição.
 * O montante vai em cêntimos e como INTEIRO, pela mesma razão do Multicaixa:
 * decimais numa API de pagamentos são arredondamentos que ninguém vê até ao
 * fecho de contas.
 */
async function pedirPagamento({ referencia, valor, moeda, telemovel }) {
  exigirConfiguracao();

  const corpo = {
    reference: referencia,
    amount: Math.round(Number(valor) * 100),
    currency: moeda,
    merchantId: CONFIG.merchantId,
    phone: telemovel,
    callbackUrl: CONFIG.callbackUrl,
  };

  const resposta = await fetch(`${CONFIG.baseUrl}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CONFIG.token}` },
    body: JSON.stringify(corpo),
  });

  if (!resposta.ok) {
    throw new Error(`A PayPay recusou o pedido (${resposta.status}). O documento NÃO foi pago.`);
  }
  return resposta.json();
}

/**
 * Confere um aviso de pagamento recebido da PayPay.
 *
 * Tal como no Multicaixa: nunca se acredita no callback pelo valor que ele
 * traz — confirma-se sempre contra a PayPay, e é o que ELA diz que conta.
 */
async function confirmarCallback(payload) {
  exigirConfiguracao();

  const idTransacao = payload?.id || payload?.transactionId;
  if (!idTransacao) throw new Error('Callback sem identificador de transação.');

  const resposta = await fetch(`${CONFIG.baseUrl}/payments/${encodeURIComponent(idTransacao)}`, {
    headers: { Authorization: `Bearer ${CONFIG.token}` },
  });
  if (!resposta.ok) {
    throw new Error(`Não foi possível confirmar a transação ${idTransacao} junto da PayPay.`);
  }

  const verdade = await resposta.json();
  return {
    idTransacao,
    pago: verdade.status === 'PAID' || verdade.status === 'COMPLETED',
    montante: Number(verdade.amount || 0) / 100,
    referencia: verdade.reference || null,
    origem: 'PAYPAY',
  };
}

// O estado deste canal, para o painel de prontidão o mostrar em vez de a
// ausência ser descoberta por um comprador que carrega no botão.
function estado() {
  return {
    canal: 'PAYPAY',
    disponivel: disponivel(),
    emFalta: emFalta(),
    nota: disponivel()
      ? 'Configurado.'
      : 'Forma provável, por confirmar contra a documentação real da PayPay. Requer contrato e credenciais.',
  };
}

module.exports = { disponivel, estado, pedirPagamento, confirmarCallback, emFalta };
