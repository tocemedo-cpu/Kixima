// src/services/aiRecommendationService.js
// Recomendação em texto do Category Management — chamada real à API da
// Claude sobre os números já calculados por categoryAnalyticsService/
// discountThresholdService. Este ficheiro NUNCA consulta a base de dados —
// recebe só os agregados já prontos, para nunca poder inventar um número
// que não veio de lá.
//
// RECUSA-SE A FINGIR (mesmo princípio de multicaixaService.js): sem
// ANTHROPIC_API_KEY configurada, gerar() devolve texto=null com um motivo
// explícito. A análise numérica (volume, threshold, desconto, poupança) não
// depende deste ficheiro e continua a funcionar por inteiro sem IA nenhuma.
const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config/env');
const logger = require('../config/logger');

let client = null;
function getClient() {
  if (!config.anthropic.apiKey) return null;
  if (!client) client = new Anthropic({ apiKey: config.anthropic.apiKey });
  return client;
}

function disponivel() {
  return Boolean(config.anthropic.apiKey);
}

function construirPrompt({ empresa, volumeAtual, categorias, thresholdInfo, oportunidades }) {
  const linhasCategorias = (categorias || [])
    .slice(0, 8)
    .map((c) => `- ${c.categoria}: ${c.valor.toFixed(2)} USD (${c.percentual}% do total)`)
    .join('\n') || 'Sem compras no período.';

  const linhaThreshold = thresholdInfo.proximoThreshold
    ? `Próximo patamar: ${thresholdInfo.proximoThreshold.minVolumeUsd} USD (desconto de ${thresholdInfo.proximoThreshold.discountPercent}%). Faltam ${thresholdInfo.faltamUsd} USD. Poupança adicional potencial ao atingir: ${thresholdInfo.poupancaPotencialUsd} USD.`
    : 'Já está no maior patamar de desconto ativo.';

  const linhasOportunidades = (oportunidades || [])
    .slice(0, 5)
    .map((o) => `- ${o.categoria}: ${o.numeroPos} ordens separadas, faltam ${o.faltamUsd} USD para o desconto de ${o.descontoPotencial}%`)
    .join('\n') || 'Nenhuma identificada no período.';

  return `És um analista de compras B2B. Com base nestes dados REAIS de compra da empresa "${empresa}" nos últimos 12 meses, escreve uma recomendação curta (máximo 120 palavras, em português, tom direto e prático) sobre como aproveitar a economia de escala.

Volume total: ${Number(volumeAtual).toFixed(2)} USD
Desconto atual: ${thresholdInfo.descontoAtual}%
${linhaThreshold}

Categorias com mais volume:
${linhasCategorias}

Oportunidades de consolidação (compras fragmentadas que poderiam cruzar um patamar se juntas):
${linhasOportunidades}

Não inventes números que não estejam aqui. Se não houver nada de acionável, diz isso claramente em vez de forçar uma recomendação.`;
}

/**
 * Gera a recomendação em texto. NUNCA lança por falta de configuração ou
 * falha de rede — devolve { texto: null, motivo } para o resto da análise
 * (que não depende de IA) continuar a responder normalmente.
 */
async function gerar({ empresa, volumeAtual, categorias, thresholdInfo, oportunidades }) {
  const anthropic = getClient();
  if (!anthropic) {
    return { texto: null, motivo: 'ANTHROPIC_API_KEY não está configurada — recomendação de IA desativada.' };
  }

  try {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 400,
      // Tarefa de sumarização/formatação sobre números já calculados, não de
      // raciocínio pesado — effort baixo mantém o custo proporcional a uma
      // chamada que pode acontecer a cada vez que o cliente abre o ecrã.
      output_config: { effort: 'low' },
      messages: [
        { role: 'user', content: construirPrompt({ empresa, volumeAtual, categorias, thresholdInfo, oportunidades }) },
      ],
    });
    const bloco = response.content.find((b) => b.type === 'text');
    const texto = bloco?.text?.trim() || null;
    return { texto, motivo: texto ? null : 'A API não devolveu texto.' };
  } catch (err) {
    logger.warn('aiRecommendationService: falha ao chamar a API da Claude', { error: err.message });
    return { texto: null, motivo: 'Falha ao contactar o serviço de IA — tenta novamente mais tarde.' };
  }
}

module.exports = { disponivel, gerar };
