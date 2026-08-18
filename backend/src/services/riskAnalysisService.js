// src/services/riskAnalysisService.js
// Trust & Safety do Chat Comercial — deteção de tentativas de levar a
// negociação ou o pagamento para fora da KIXIMA.
//
// NÃO é uma lista de palavras proibidas. Uma palavra isolada ("whatsapp",
// "conta") aparece em conversas comerciais legítimas o tempo todo — bloquear
// por palavra dava tantos falsos positivos que ninguém confiaria no alerta.
// Em vez disso, cada mensagem é pontuada por VÁRIOS sinais independentes
// (partilha de contacto, linguagem de pagamento fora, padrão de
// cancelar-para-continuar-fora, intenção de contrato à parte); só a
// COMBINAÇÃO de sinais — ou um sinal muito explícito — ultrapassa o limiar
// que gera alerta. Isto é heurística, não é infalível: fica pensado para
// reduzir falsos positivos, não para os eliminar, e por isso o Suporte pode
// sempre reclassificar como falso positivo (ver conversationService).
//
// NÃO BLOQUEIA nada nesta versão — só classifica e, a partir de MEDIUM,
// regista um alerta para o Suporte analisar. Ver a decisão registada no
// histórico do projeto: LOW nunca é persistido (é assim que "só as
// conversas de risco relevante geram alerta" se cumpre).

const LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function semAcentos(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Cada sinal: uma expressão regular sobre o texto normalizado (sem acentos,
// minúsculas) + um peso + um rótulo humano (vai para `reason`).
const SINAIS = [
  {
    key: 'telefone',
    label: 'partilha de número de telefone',
    peso: 2,
    // Angola: 9 dígitos a começar por 9 (com ou sem +244), em blocos ou seguidos.
    teste: /(\+?244[\s.-]?)?\b9\d{2}[\s.-]?\d{3}[\s.-]?\d{3}\b/,
  },
  {
    key: 'email',
    label: 'partilha de email',
    peso: 2,
    teste: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/,
  },
  {
    key: 'app_mensagens',
    label: 'referência a um aplicativo de mensagens externo',
    peso: 2,
    teste: /\b(whatsapp|zap ?zap|telegram|signal|viber|messenger|imo)\b/,
  },
  {
    key: 'pagamento_fora',
    label: 'linguagem de pagamento fora da plataforma',
    peso: 4,
    teste: /(fora da kixima|fora da plataforma|sem passar pela kixima|sem passar pela plataforma|pagamento direto|pagar direto|transferencia direta|deposito direto|evitar a taxa|sem taxa da kixima|poupar a taxa|por fora\b)/,
  },
  {
    key: 'cancelar_continuar_fora',
    label: 'indício de cancelar na Kixima para continuar fora',
    peso: 5,
    teste: /(cancelar(mos)? (aqui|a compra|o pedido|na kixima)|cancela(mos)? (aqui|isso) e (continuamos|fechamos|seguimos))/,
  },
  {
    key: 'negocio_a_parte',
    label: 'intenção de fechar contrato/negócio à parte',
    peso: 5,
    teste: /(contrato a parte|negocio a parte|combinamos por fora|fechamos (isso |o negocio )?fora|acordo a parte)/,
  },
];

function limiarPara(score) {
  if (score >= 11) return 'CRITICAL';
  if (score >= 7) return 'HIGH';
  if (score >= 4) return 'MEDIUM';
  return 'LOW';
}

/**
 * Analisa UMA mensagem, com o contexto do que já se passou na conversa.
 *
 * @param {string} texto corpo da mensagem
 * @param {{ escalar: boolean }} contexto `escalar`=true quando já existe um
 *   alerta MEDIUM+ em aberto nesta conversa — um segundo indício depois de já
 *   ter havido um alerta pesa mais do que o primeiro (padrão de insistência,
 *   não um deslize isolado).
 * @returns {{ level: 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL', score: number, reason: string, signals: string[] }}
 */
function analisar(texto, contexto = {}) {
  const normalizado = semAcentos(texto);
  const encontrados = SINAIS.filter((s) => s.teste.test(normalizado));
  let score = encontrados.reduce((soma, s) => soma + s.peso, 0);

  let nivel = limiarPara(score);
  const escalado = contexto.escalar && score >= 4 && LEVELS.indexOf(nivel) < LEVELS.length - 1;
  if (escalado) nivel = LEVELS[LEVELS.indexOf(nivel) + 1];

  const reason = encontrados.length
    ? `Sinais detetados: ${encontrados.map((s) => s.label).join('; ')}.`
      + (escalado ? ' Repetição de indício após alerta já aberto nesta conversa.' : '')
    : 'Nenhum sinal de risco detetado.';

  return { level: nivel, score, reason, signals: encontrados.map((s) => s.key) };
}

module.exports = { analisar, LEVELS };
