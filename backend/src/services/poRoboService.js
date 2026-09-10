// src/services/poRoboService.js
// Automatic PO Robot (add-on PRO, pago) — PREPARA POs periodicamente, com
// base na média mensal de compra por produto. NUNCA aprova nem paga: a PO
// nasce em AGUARDANDO_APROVACAO como qualquer outra (createPurchaseOrder é
// chamado TAL E QUAL, sem via paralela), sujeita à mesma aprovação humana ou
// ao workflow DOA do ERP (funcionalidade 1) — createdBySource só marca a
// origem para a auditoria/interface saberem distinguir.
const prisma = require('../config/database');
const logger = require('../config/logger');
const poService = require('./poService');
const addonService = require('./addonService');
const categoryAnalyticsService = require('./categoryAnalyticsService');
const platformFeeService = require('./platformFeeService');
const auditService = require('./auditService');
const alertaOperacionalService = require('./alertaOperacionalService');

const ATOR_ROBOT = { actorId: null, actorName: 'PO Robot', actorRole: null, companyId: null };

// Fração do mês que cada periodicidade representa, para escalar a média
// mensal na quantidade de UMA execução — 30 dias é a mesma aproximação de
// calendário já usada noutros pontos da plataforma para "um mês".
const FRACAO_DO_MES = { SEMANAL: 7 / 30, QUINZENAL: 14 / 30, MENSAL: 1 };
const DIAS_ATE_PROXIMA = { SEMANAL: 7, QUINZENAL: 14, MENSAL: 30 };

function proximaExecucao(periodicidade, base = new Date()) {
  const dias = DIAS_ATE_PROXIMA[periodicidade] || 30;
  const proxima = new Date(base);
  proxima.setDate(proxima.getDate() + dias);
  return proxima;
}

/**
 * A quantidade a pedir NESTA execução — a média aceite/definida pelo cliente,
 * escalada para a periodicidade da regra. `quantidade` (fixa) sobrepõe o
 * cálculo quando o cliente a definiu à mão.
 */
async function resolverQuantidade(regra) {
  if (regra.quantidade != null) return regra.quantidade;

  let mediaMensal = Number(regra.mediaMensal);
  if (regra.mediaOrigem === 'IA') {
    const calc = await categoryAnalyticsService.mediaMensalPorProduto({
      companyId: regra.companyId,
      productId: regra.productId,
    });
    mediaMensal = calc.mediaMensal;
  }

  const fracao = FRACAO_DO_MES[regra.periodicidade] || 1;
  return Math.max(1, Math.round(mediaMensal * fracao));
}

/**
 * Uma regra, um ciclo: resolve a quantidade, valida o limite de segurança,
 * cria a PO (sempre por aprovar) e avança a próxima execução — só depois do
 * sucesso, para não duplicar se o job correr duas vezes seguidas.
 */
async function executarRegra(regra) {
  await addonService.assertAddon(regra.companyId, 'PO_ROBOT', 'Automatic PO Robot');

  const product = await prisma.product.findUnique({ where: { id: regra.productId } });
  if (!product || !product.active) {
    throw new Error(`Produto ${regra.productId} não existe ou está inativo — regra desativada.`);
  }

  const quantidade = await resolverQuantidade(regra);
  const valorEstimadoUsd = platformFeeService.toUsd(Number(product.unitPrice) * quantidade, product.currency);

  if (regra.limiteMaximoUsd != null && valorEstimadoUsd > Number(regra.limiteMaximoUsd)) {
    throw new Error(
      `PO estimada em ${valorEstimadoUsd} USD excede o limite de segurança de ${regra.limiteMaximoUsd} USD — não criada.`,
    );
  }

  // O robot atribui a PO ao Company Admin mais antigo da empresa (a PO
  // precisa de um autor humano válido — o FK não abre exceção nenhuma para
  // "sistema"); createdBySource é o que distingue a origem na auditoria.
  const admin = await prisma.user.findFirst({
    where: { companyId: regra.companyId, role: 'COMPANY_ADMIN', active: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) {
    throw new Error('Nenhum Company Admin ativo nesta empresa — o robot não tem em nome de quem criar a PO.');
  }

  const po = await poService.createPurchaseOrder({
    buyerCompanyId: regra.companyId,
    supplierCompanyId: product.supplierId,
    createdById: admin.id,
    items: [{ productId: product.id, quantity: quantidade }],
    createdBySource: 'ROBOT',
  });

  await auditService.recordSafe({
    actor: ATOR_ROBOT,
    action: 'PO_CRIADA_ROBOT',
    entityType: 'PurchaseOrder',
    entityId: po.id,
    entityRef: po.reference,
    detail: {
      regraId: regra.id,
      produto: product.name,
      quantidade,
      valorEstimadoUsd: String(valorEstimadoUsd),
      mediaOrigem: regra.mediaOrigem,
    },
  });

  await prisma.poRoboRegra.update({
    where: { id: regra.id },
    data: { proximaExecucaoEm: proximaExecucao(regra.periodicidade) },
  });

  return po;
}

/**
 * Corre todas as regras ativas cuja vez chegou. Uma regra que falha (produto
 * descontinuado, limite excedido, empresa sem add-on ativo…) NÃO aborta o
 * ciclo inteiro — regista o erro e segue para a regra seguinte.
 */
async function executarCiclo() {
  const regras = await prisma.poRoboRegra.findMany({
    where: { ativo: true, proximaExecucaoEm: { lte: new Date() } },
  });

  const resultado = { total: regras.length, criadas: 0, falhas: [] };

  for (const regra of regras) {
    try {
      await executarRegra(regra);
      resultado.criadas += 1;
    } catch (err) {
      resultado.falhas.push({ regraId: regra.id, companyId: regra.companyId, erro: err.message });
      logger.warn('poRoboService: falha ao executar regra', { regraId: regra.id, error: err.message });
      await alertaOperacionalService.avisarFalha(
        'PO_ROBOT',
        `Falha ao criar PO automática (regra ${regra.id})`,
        err.message,
      ).catch(() => {});
    }
  }

  return resultado;
}

module.exports = { executarCiclo, executarRegra, resolverQuantidade, proximaExecucao };
