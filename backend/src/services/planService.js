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
  return size === 'GRANDE' ? 'PRO' : 'BASICO';
}

// O plano escolhido é aceitável para a dimensão? (subir para PRO é sempre OK)
function planAllowed(size, plan) {
  return requiredPlan(size) === 'BASICO' || plan === 'PRO';
}

// Funcionalidades por plano — fonte única de verdade para o gating.
const FEATURES = {
  BASICO: {
    erpIntegration: false,
    frameworkContracts: false,
    supplierComparison: true,
    catalogImport: true,
    auditTrail: true,
  },
  PRO: {
    erpIntegration: true,
    frameworkContracts: true,
    supplierComparison: true,
    catalogImport: true,
    auditTrail: true,
  },
};

function features(plan) {
  return FEATURES[plan] || FEATURES.BASICO;
}

function hasFeature(plan, feature) {
  return Boolean(features(plan)[feature]);
}

// Guarda de funcionalidade: lança 403 com mensagem explicativa se o plano da
// empresa não a inclui. Usado nas rotas exclusivas do PRO.
function assertFeature(company, feature, label) {
  if (!hasFeature(company?.plan, feature)) {
    throw new BusinessRuleError(
      `Esta funcionalidade (${label}) faz parte do plano PRO. A sua empresa está no plano ${company?.plan || 'BASICO'}.`
    );
  }
}

// Custo mensal de acesso de uma empresa: nº de utilizadores ativos × preço/seat.
function monthlyAccessCost({ activeUsers, seatPriceUsd }) {
  const seats = Math.max(0, Number(activeUsers) || 0);
  const price = Math.min(Number(seatPriceUsd) || SEAT_PRICE_CAP_USD, SEAT_PRICE_CAP_USD);
  return { seats, seatPriceUsd: price, amountUsd: Math.round(seats * price * 100) / 100, currency: 'USD' };
}

module.exports = {
  SEAT_PRICE_CAP_USD, SIZE_RULES, FEATURES,
  classify, requiredPlan, planAllowed, features, hasFeature, assertFeature, monthlyAccessCost,
};
