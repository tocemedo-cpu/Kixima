// src/services/planService.js
// Dimensão da empresa e planos de subscrição (modelo comercial KIXIMA).
//
// DIMENSÃO — critério MPME angolano (Lei n.º 30/11, "Lei das Micro, Pequenas e
// Médias Empresas"), que classifica por nº de trabalhadores e volume de negócios
// anual. Aplica-se o critério mais exigente dos dois (o que der maior dimensão),
// como é prática na aplicação da lei:
//
//   MICRO    < 10 trabalhadores   e  ≤ 250.000 USD
//   PEQUENA  < 100 trabalhadores  e  ≤ 3.000.000 USD
//   MEDIA    ≤ 200 trabalhadores  e  ≤ 10.000.000 USD
//   GRANDE   acima disso
//
// PLANOS:
//   BASICO — versão essencial. Taxa de acesso por utilizador/mês (teto 100 USD).
//   PRO    — obrigatório para GRANDES empresas. Além do resto, permite a
//            integração com ERPs externos (SAP, AS400, Ariba, Maximo, Oracle…).
const { BusinessRuleError } = require('../utils/errors');

const SEAT_PRICE_CAP_USD = Number(process.env.KIXIMA_SEAT_PRICE_CAP_USD) || 100;

const SIZE_RULES = [
  { size: 'MICRO', maxEmployees: 9, maxRevenueUsd: 250_000 },
  { size: 'PEQUENA', maxEmployees: 99, maxRevenueUsd: 3_000_000 },
  { size: 'MEDIA', maxEmployees: 200, maxRevenueUsd: 10_000_000 },
];

/**
 * Classifica a empresa pela dimensão. Sem dados declarados assume PEQUENA
 * (o plano mais permissivo para quem ainda não declarou) — o Admin do Sistema
 * confirma ou corrige na due diligence.
 */
function classify({ employees, annualRevenueUsd } = {}) {
  const emp = Number(employees);
  const rev = Number(annualRevenueUsd);
  if (!Number.isFinite(emp) && !Number.isFinite(rev)) return 'PEQUENA';

  for (const rule of SIZE_RULES) {
    const okEmployees = !Number.isFinite(emp) || emp <= rule.maxEmployees;
    const okRevenue = !Number.isFinite(rev) || rev <= rule.maxRevenueUsd;
    // Critério mais exigente: para ficar nesta classe tem de cumprir os dois.
    if (okEmployees && okRevenue) return rule.size;
  }
  return 'GRANDE';
}

// Plano mínimo exigido pela dimensão: grandes empresas têm de subscrever o PRO.
function requiredPlan(size) {
  return size === 'GRANDE' ? 'PRO' : 'ENTRADA';
}

// O plano escolhido é aceitável para a dimensão? (subir para PRO é sempre OK)
// O plano escolhido é aceitável para a dimensão? Subir é sempre permitido.
const ESCADA = ['ENTRADA', 'CORE', 'PRO'];
function planAllowed(size, plan) {
  const minimo = ESCADA.indexOf(requiredPlan(size));
  return ESCADA.indexOf(normalizarPlano(plan)) >= minimo;
}

// --- Planos -----------------------------------------------------------------
//
// ENTRADA · CORE · PRO. Fonte única de verdade: qualquer limite ou
// funcionalidade que dependa do plano lê-se daqui, e de mais lado nenhum.
//
// O PRINCÍPIO que decide o que se limita e o que não se limita:
//
//   NUNCA se limita o VOLUME do catálogo. Limita-se a INTENSIDADE de uso.
//
// Num marketplace, a densidade do catálogo é o que cria valor para o comprador,
// que cria transações, que geram a Taxa KIXIMA — que é a receita maior. Limitar
// itens cortaria a própria receita transacional para proteger uma receita de
// subscrição muito menor. Pior: um fornecedor limitado a 10 itens não publica 10
// SKUs bem classificados, publica uma linha "Válvulas diversas — consultar", e a
// taxonomia UNSPSC, as facetas e a pesquisa — que SÃO o produto — degradam-se.
//
// Por isso não há limite de itens em plano nenhum, e não deve passar a haver.
// O que se limita são cotações por mês, janela de histórico, lugares e
// funcionalidades de escala (importação em massa, ERP, contratos-quadro).
const ILIMITADO = null;   // null = sem limite, para distinguir de 0

const FEATURES = {
  ENTRADA: {
    itensNoCatalogo: ILIMITADO,
    // Posição na pesquisa. É esta a alavanca que SUBSTITUI o limite de itens:
    // o plano de entrada publica tudo, mas ordena abaixo dos pagos na
    // relevância. Mesma pressão para subir de plano, zero dano à densidade do
    // catálogo — que é o que faz o marketplace valer.
    posicaoNaPesquisa: 0,
    selo: false,
    lugaresIncluidos: 2,
    kits: false,
    carregamentoEmMassa: false,
    documentosPorItem: 1,
    imagensPorItem: 3,
    cotacoesPorMes: 3,
    historicoRelatoriosMeses: 3,
    frameworkContracts: false,
    erpIntegration: false,
    supplierComparison: true,
    auditTrail: true,
  },
  CORE: {
    itensNoCatalogo: ILIMITADO,
    posicaoNaPesquisa: 1,
    selo: false,
    lugaresIncluidos: 5,
    kits: true,
    carregamentoEmMassa: false,
    documentosPorItem: 3,
    imagensPorItem: 10,
    cotacoesPorMes: 20,
    historicoRelatoriosMeses: 12,
    frameworkContracts: false,
    erpIntegration: false,
    supplierComparison: true,
    auditTrail: true,
  },
  PRO: {
    itensNoCatalogo: ILIMITADO,
    posicaoNaPesquisa: 2,
    selo: true,
    lugaresIncluidos: ILIMITADO,
    kits: true,
    carregamentoEmMassa: true,
    documentosPorItem: 6,
    imagensPorItem: 10,
    cotacoesPorMes: ILIMITADO,
    historicoRelatoriosMeses: ILIMITADO,
    frameworkContracts: true,
    erpIntegration: true,
    supplierComparison: true,
    auditTrail: true,
  },
};

// Posição do plano na ordenação por relevância. Guardada em Company.searchRank
// para o Postgres poder ordenar por ela: ordenar pelo ENUM daria a ordem de
// declaração do tipo, que não é a ordem comercial.
function rankDoPlano(plan) {
  return features(plan).posicaoNaPesquisa ?? 0;
}

// BASICO foi o plano intermédio antes de haver três. A migração passou essas
// empresas para CORE; este alias existe para o caso de alguma linha ficar para
// trás — um plano desconhecido não pode tirar funcionalidades a quem as tinha.
const ALIASES = { BASICO: 'CORE' };

function normalizarPlano(plan) {
  const p = String(plan || '').toUpperCase();
  return ALIASES[p] || (FEATURES[p] ? p : 'ENTRADA');
}

function features(plan) {
  return FEATURES[normalizarPlano(plan)];
}

/**
 * Limite numérico de uma funcionalidade, ou null se for ilimitado.
 * Separado de hasFeature porque 0 e null querem dizer coisas opostas: 0 é
 * "nenhum", null é "sem limite" — confundi-los abriria ou fecharia tudo.
 */
function limite(plan, nome) {
  const v = features(plan)[nome];
  return v === undefined ? 0 : v;
}

/**
 * Guarda de LIMITE: lança se o próximo já ultrapassa o que o plano inclui.
 * A mensagem diz sempre o número atual e o do plano — "atingiu o limite" sem
 * dizer qual manda a pessoa adivinhar.
 */
function assertLimite(company, nome, usadoAgora, label) {
  const max = limite(company?.plan, nome);
  if (max === ILIMITADO) return;
  if (Number(usadoAgora) < max) return;
  const plano = normalizarPlano(company?.plan);
  const seguinte = plano === 'ENTRADA' ? 'Core' : 'Pro';
  throw new BusinessRuleError(
    `O plano ${plano} inclui ${max} ${label}. Já tem ${usadoAgora}. `
    + `O plano ${seguinte} aumenta este limite.`,
  );
}

function hasFeature(plan, feature) {
  return Boolean(features(plan)[feature]);
}

// O plano mais baixo da escada que inclui esta funcionalidade. Calculado a
// partir da matriz, e não escrito à mão: quando uma funcionalidade mudar de
// degrau, a mensagem muda com ela em vez de passar a mentir.
function planoQueInclui(feature) {
  return ESCADA.find((p) => Boolean(FEATURES[p][feature])) || null;
}

// Guarda de funcionalidade: lança com mensagem explicativa se o plano da
// empresa não a inclui, dizendo qual é o plano que a tem.
function assertFeature(company, feature, label) {
  if (!hasFeature(company?.plan, feature)) {
    throw new BusinessRuleError(
      `Esta funcionalidade (${label}) não está incluída no plano ${normalizarPlano(company?.plan)}. `
      + `Faz parte do plano ${planoQueInclui(feature) || 'PRO'}.`
    );
  }
}

// Custo mensal de acesso de uma empresa: nº de utilizadores ativos × preço/seat.
function monthlyAccessCost({ activeUsers, seatPriceUsd }) {
  const seats = Math.max(0, Number(activeUsers) || 0);
  const price = Math.min(Number(seatPriceUsd) || SEAT_PRICE_CAP_USD, SEAT_PRICE_CAP_USD);
  return { seats, seatPriceUsd: price, amountUsd: Math.round(seats * price * 100) / 100, currency: 'USD' };
}

// Taxa de acesso ao PROGRAMA Supplier Development (e à procura de parceiros
// internacionais). É a taxa de acesso das pequenas empresas — 100 USD — e é
// COBRADA LOGO NA SUBMISSÃO DA INTENÇÃO, igual para qualquer candidato: no
// momento da candidatura ainda não há diagnóstico, por isso o valor de entrada
// tem de ser o de tabela. O RESTO do programa (os serviços efetivamente
// prestados) é orçamentado caso a caso depois da triagem.
function supplierDevAccessFee() {
  return {
    amountUsd: SEAT_PRICE_CAP_USD,
    currency: 'USD',
    dueOnSubmission: true,
    // O restante do programa fica por orçamentar até a KIXIMA fazer a proposta.
    remainderCustom: true,
  };
}

module.exports = {
  supplierDevAccessFee,
  SEAT_PRICE_CAP_USD, SIZE_RULES, FEATURES, ESCADA, ILIMITADO,
  classify, requiredPlan, planAllowed, features, hasFeature, assertFeature,
  limite, assertLimite, normalizarPlano, planoQueInclui, rankDoPlano, monthlyAccessCost,
};
