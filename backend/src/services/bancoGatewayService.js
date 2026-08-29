// src/services/bancoGatewayService.js
// APIs de bancos angolanos (BAI, BFA, Standard Bank Angola) — adaptador
// PLACEHOLDER, POR LIGAR E POR CONFIRMAR.
//
// LEIA ISTO ANTES DE USAR. Não há aqui nenhuma documentação real da API de
// iniciação de pagamento de nenhum destes três bancos. Cada banco tem
// certamente a sua própria API, com o seu próprio formato — inventar TRÊS
// implementações "diferentes" sem ter visto nenhuma das três documentações
// seria fingir um conhecimento que não existe. Em vez disso, os três
// partilham UM adaptador genérico (`criarAdaptador(codigoBanco)`), com a
// forma mais provável de uma API de iniciação de pagamento bancário (pedido
// com referência/valor, callback de confirmação) — a mesma honestidade que
// paypayService.js: um palpite razoável, não um facto, por confirmar campo a
// campo assim que cada banco fornecer a sua documentação real.
//
// RECUSA-SE A FINGIR, tal como o Multicaixa e a PayPay: sem credenciais, cada
// função lança com uma mensagem que diz exatamente o que falta. Não devolve
// sucesso simulado.

// Prefixo das variáveis de ambiente e nome de exibição de cada banco. O
// prefixo do Standard Bank Angola é abreviado (STANDARD_BANK_AO) só para não
// ter nomes de variável quilométricos — o valor do enum CanalCobranca é que
// continua por extenso (STANDARD_BANK_ANGOLA).
const BANCOS = {
  BAI: { envPrefix: 'BAI', nome: 'BAI' },
  BFA: { envPrefix: 'BFA', nome: 'BFA' },
  STANDARD_BANK_ANGOLA: { envPrefix: 'STANDARD_BANK_AO', nome: 'Standard Bank Angola' },
};

function criarAdaptador(codigoBanco) {
  const banco = BANCOS[codigoBanco];
  if (!banco) {
    throw new Error(`Banco desconhecido: "${codigoBanco}". Bancos suportados: ${Object.keys(BANCOS).join(', ')}.`);
  }

  const CONFIG = {
    baseUrl: process.env[`${banco.envPrefix}_BASE_URL`] || '',
    clientId: process.env[`${banco.envPrefix}_CLIENT_ID`] || '',
    clientSecret: process.env[`${banco.envPrefix}_CLIENT_SECRET`] || '',
    callbackUrl: process.env[`${banco.envPrefix}_CALLBACK_URL`] || '',
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
        `${banco.nome} não está configurado. Em falta: `
        + falta.map((k) => `${banco.envPrefix}_${k.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`).join(', ')
        + `. Este canal não funciona sem credenciais do ${banco.nome} — e não simula pagamentos.`,
      );
    }
  }

  /**
   * Pede a iniciação de um pagamento. Forma genérica (referência/valor/
   * moeda), igual à dos outros adaptadores — ver aviso no topo do ficheiro
   * sobre esta forma ser um palpite, não a API real deste banco.
   */
  async function pedirPagamento({ referencia, valor, moeda }) {
    exigirConfiguracao();

    const corpo = {
      reference: referencia,
      amount: Math.round(Number(valor) * 100),
      currency: moeda,
      clientId: CONFIG.clientId,
      callbackUrl: CONFIG.callbackUrl,
    };

    const resposta = await fetch(`${CONFIG.baseUrl}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CONFIG.clientSecret}` },
      body: JSON.stringify(corpo),
    });

    if (!resposta.ok) {
      throw new Error(`O ${banco.nome} recusou o pedido (${resposta.status}). O documento NÃO foi pago.`);
    }
    return resposta.json();
  }

  /**
   * Confere um aviso de pagamento recebido do banco — nunca se acredita no
   * callback pelo valor que ele traz, tal como nos outros canais.
   */
  async function confirmarCallback(payload) {
    exigirConfiguracao();

    const idTransacao = payload?.id || payload?.transactionId;
    if (!idTransacao) throw new Error('Callback sem identificador de transação.');

    const resposta = await fetch(`${CONFIG.baseUrl}/payments/${encodeURIComponent(idTransacao)}`, {
      headers: { Authorization: `Bearer ${CONFIG.clientSecret}` },
    });
    if (!resposta.ok) {
      throw new Error(`Não foi possível confirmar a transação ${idTransacao} junto do ${banco.nome}.`);
    }

    const verdade = await resposta.json();
    return {
      idTransacao,
      pago: verdade.status === 'PAID' || verdade.status === 'COMPLETED',
      montante: Number(verdade.amount || 0) / 100,
      referencia: verdade.reference || null,
      origem: banco.nome,
    };
  }

  function estado() {
    return {
      canal: codigoBanco,
      disponivel: disponivel(),
      emFalta: emFalta(),
      nota: disponivel()
        ? 'Configurado.'
        : `Forma provável, por confirmar contra a documentação real da API do ${banco.nome}. Requer contrato e credenciais.`,
    };
  }

  return {
    disponivel, estado, pedirPagamento, confirmarCallback, emFalta,
  };
}

module.exports = { criarAdaptador, BANCOS };
