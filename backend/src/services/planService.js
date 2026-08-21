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
const { PlanRequiredError } = require('../utils/errors');

const SEAT_PRICE_CAP_USD = Number(process.env.KIXIMA_SEAT_PRICE_CAP_USD) || 100;

// --- Estado da subscrição (expiração, tolerância) ---------------------------
//
// NUNCA PERSISTIDO. Calculado a cada leitura a partir de planoValidoAte —
// exatamente como o campo `expirada` que assinaturaService.estado() já
// devolvia. Um estado guardado (ex.: uma coluna "estado: RESTRITA" ou um
// evento de cron que a define) pode ficar dessincronizado da data real; um
// calculado nunca pode, porque não há nada para dessincronizar.
//
// GRACE_PERIOD_DAYS: quantos dias depois de vencer é que a empresa ainda
// não sente NADA — nem um recurso premium bloqueado. Existe porque uma
// transferência bancária demora dias a confirmar-se do lado da KIXIMA (ver
// assinaturaService.js): sem tolerância nenhuma, uma empresa que já pagou
// mas cujo comprovativo ainda não foi revisto ficava bloqueada por um atraso
// administrativo que não é dela.
const GRACE_PERIOD_DAYS = Number(process.env.KIXIMA_GRACE_PERIOD_DAYS) || 7;
const DIA_MS = 24 * 60 * 60 * 1000;
// Quantos dias antes de vencer é que a subscrição passa a "A_EXPIRAR" — só
// muda o que se MOSTRA (avisos), nunca o que se permite.
const LIMIAR_A_EXPIRAR_DIAS = 30;

/**
 * Patamar de urgência da subscrição desta empresa, agora.
 *
 *   ATIVA      — paga, ou nunca cobrada (planoValidoAte null: a empresa de
 *                arranque no BASE, ou posta num plano à mão pela KIXIMA).
 *   A_EXPIRAR  — paga, mas termina dentro de LIMIAR_A_EXPIRAR_DIAS dias.
 *   GRACE      — venceu, mas ainda dentro do período de tolerância.
 *   RESTRITA   — venceu há mais do que GRACE_PERIOD_DAYS.
 *
 * `agora` é parâmetro (não Date.now() direto) só para os testes poderem fixar
 * o tempo sem mexer no relógio do sistema.
 */
function estadoSubscricao(company, agora = new Date()) {
  const validoAte = company?.planoValidoAte;
  if (!validoAte) return 'ATIVA';
  const diasAteVencer = Math.ceil((new Date(validoAte).getTime() - agora.getTime()) / DIA_MS);
  if (diasAteVencer > LIMIAR_A_EXPIRAR_DIAS) return 'ATIVA';
  if (diasAteVencer > 0) return 'A_EXPIRAR';
  if (-diasAteVencer <= GRACE_PERIOD_DAYS) return 'GRACE';
  return 'RESTRITA';
}

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
  return size === 'GRANDE' ? 'PRO' : 'BASE';
}

// O plano escolhido é aceitável para a dimensão? (subir para PRO é sempre OK)
// O plano escolhido é aceitável para a dimensão? Subir é sempre permitido.
const ESCADA = ['BASE', 'CORE', 'PRO'];
function planAllowed(size, plan) {
  const minimo = ESCADA.indexOf(requiredPlan(size));
  return ESCADA.indexOf(normalizarPlano(plan)) >= minimo;
}

// --- Planos -----------------------------------------------------------------
//
// BASE · CORE · PRO. Fonte única de verdade: qualquer limite ou
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

// --- Preços -----------------------------------------------------------------
//
// Os três planos têm PERÍODOS diferentes, e isso é uma armadilha de comunicação:
// o Base custa 100 USD por TRIMESTRE e o Core 100 USD por MÊS. Quem passa os
// olhos pela tabela vê "100 USD" duas vezes e não regista a diferença — ou seja,
// vê o Core como se fosse igual ao Base, e o salto real (3×) fica invisível.
//
// Por isso o preço mensal equivalente é CALCULADO aqui e mostrado sempre ao
// lado. Nunca escrito à mão: um número que se calcula não pode ficar
// dessincronizado do preço a que se refere.
const MESES_DO_PERIODO = { MENSAL: 1, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12 };

const PRECOS = {
  BASE: {
    valor: Number(process.env.KIXIMA_PRECO_BASE_USD) || 100,
    periodo: process.env.KIXIMA_PRECO_BASE_PERIODO || 'TRIMESTRAL',
  },
  CORE: {
    valor: Number(process.env.KIXIMA_PRECO_CORE_USD) || 100,
    periodo: process.env.KIXIMA_PRECO_CORE_PERIODO || 'MENSAL',
  },
  PRO: {
    valor: Number(process.env.KIXIMA_PRECO_PRO_USD) || 5000,
    // ANUAL por omissão. Ver a nota em `preco()` — a escolha do período muda o
    // preço efetivo do Pro em 12×, e é configurável de propósito.
    periodo: process.env.KIXIMA_PRECO_PRO_PERIODO || 'ANUAL',
  },
};

/**
 * Preço de um plano, com o equivalente mensal para se poderem comparar.
 *
 * NOTA SOBRE O PERÍODO DO PRO: 5.000 USD por ANO são ~417 USD/mês — um degrau de
 * 4× sobre o Core, que é uma escada que alguém sobe. Os mesmos 5.000 por MÊS
 * seriam 50× o Core: isso não é uma escada, é um penhasco, e penhascos matam
 * upgrades. Quem cresce olha para a conta, faz as contas e fica onde está.
 * Por isso o valor por omissão é anual, e o período é configurável sem tocar
 * em código.
 */
function preco(plan) {
  const p = PRECOS[normalizarPlano(plan)];
  if (!p) return null;
  const meses = MESES_DO_PERIODO[p.periodo] || 1;
  return {
    valorUsd: p.valor,
    periodo: p.periodo,
    meses,
    // Arredondado ao cêntimo — é para comparar, não para faturar.
    porMesUsd: Math.round((p.valor / meses) * 100) / 100,
  };
}

// Todos os planos com preço e funcionalidades, para a página pública e para a
// interface. Um sítio só: a tabela de preços não pode divergir do que a
// plataforma faz.
function tabela() {
  return ESCADA.map((plano) => ({ plano, preco: preco(plano), features: FEATURES[plano] }));
}

const FEATURES = {
  BASE: {
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
    relatorioConteudoLocal: false,
    apiCatalogo: false,
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
    relatorioConteudoLocal: false,
    apiCatalogo: false,
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
    relatorioConteudoLocal: true,
    apiCatalogo: true,
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
  return ALIASES[p] || (FEATURES[p] ? p : 'BASE');
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
  const seguinte = plano === 'BASE' ? 'CORE' : 'PRO';
  throw new PlanRequiredError(
    `O plano ${plano} inclui ${max} ${label}. Já tem ${usadoAgora}. `
    + `O plano ${seguinte} aumenta este limite.`,
    seguinte,
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
//
// Verifica TAMBÉM se a subscrição está RESTRITA (vencida há mais do que o
// período de tolerância) — todas as chamadas a assertFeature em toda a
// plataforma são exatamente "recursos premium"/"novas integrações" (kits, API
// de catálogo, ERP, carregamento em massa, contratos-quadro, relatório de
// conteúdo local): o conjunto que o modelo comercial diz para restringir
// quando a empresa deixa de pagar. Nunca dados, nunca histórico, nunca PO,
// nunca o catálogo já publicado — nada disso passa por aqui.
function assertFeature(company, feature, label) {
  if (estadoSubscricao(company) === 'RESTRITA') {
    throw new PlanRequiredError(
      `A subscrição da sua empresa está vencida há mais de ${GRACE_PERIOD_DAYS} dias. `
      + `Regularize o pagamento para voltar a usar "${label}".`,
      normalizarPlano(company?.plan),
    );
  }
  if (!hasFeature(company?.plan, feature)) {
    const necessario = planoQueInclui(feature) || 'PRO';
    throw new PlanRequiredError(
      `Esta funcionalidade (${label}) não está incluída no plano ${normalizarPlano(company?.plan)}. `
      + `Faz parte do plano ${necessario}.`,
      necessario,
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
  PRECOS, MESES_DO_PERIODO, preco, tabela,
  GRACE_PERIOD_DAYS, LIMIAR_A_EXPIRAR_DIAS, estadoSubscricao,
};
