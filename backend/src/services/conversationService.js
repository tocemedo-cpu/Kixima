// src/services/conversationService.js
// Chat Comercial — Comprador ↔ Fornecedor/Prestador, isolado por empresa.
//
// A regra que percorre este ficheiro inteiro: o backend NUNCA confia nos ids
// que o pedido manda para decidir quem pode falar com quem. Uma conversa só
// existe entre duas empresas que uma relação comercial real liga (ou, sem
// contexto, que o próprio pedido authenticado inicia), e só quem pertence a
// uma das duas lê ou escreve nela — ver `conversationComAcesso`, chamada no
// TOPO de toda a operação que toca uma conversa já existente.
const prisma = require('../config/database');
const { NotFoundError, ValidationError, ConflictError } = require('../utils/errors');
const auditService = require('./auditService');
const realtimeService = require('./realtimeService');
const notificationService = require('./notificationService');
const riskAnalysisService = require('./riskAnalysisService');

// Personas de empresa (exclui ADMIN_SISTEMA, que não pertence a nenhuma) —
// reutilizado para notificar "todos na empresa contraparte", tal como
// notifyUsersByRole já faz para outros eventos de negócio.
const PERSONAS_DE_EMPRESA = ['COMPRADOR', 'COMPANY_ADMIN', 'FORNECEDOR', 'FINANCEIRO'];

// Cada tipo de contexto sabe resolver as DUAS empresas que uma conversa
// associada a ele tem de ligar — nunca as que o pedido diz, sempre as que o
// registo em si tem gravadas.
const RESOLVEDORES_DE_CONTEXTO = {
  quote: async (id) => {
    const q = await prisma.quoteRequest.findUnique({ where: { id } });
    if (!q) throw new NotFoundError('Cotação');
    return { buyerCompanyId: q.buyerCompanyId, supplierCompanyId: q.supplierCompanyId };
  },
  purchase_order: async (id) => {
    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new NotFoundError('Ordem de compra');
    return { buyerCompanyId: po.buyerCompanyId, supplierCompanyId: po.supplierCompanyId };
  },
  contract: async (id) => {
    const c = await prisma.contract.findUnique({ where: { id } });
    if (!c) throw new NotFoundError('Contrato');
    return { buyerCompanyId: c.clientCompanyId, supplierCompanyId: c.supplierCompanyId };
  },
  // Um produto só tem fornecedor — o lado comprador é sempre quem está a
  // iniciar a conversa (é para isso que "Falar com fornecedor" existe).
  product: async (id, requesterCompanyId) => {
    const p = await prisma.product.findUnique({ where: { id } });
    if (!p) throw new NotFoundError('Produto');
    return { buyerCompanyId: requesterCompanyId, supplierCompanyId: p.supplierId };
  },
};
const CONTEXT_TYPES = Object.keys(RESOLVEDORES_DE_CONTEXTO);

// Inicia (ou reaproveita) a conversa entre a empresa do utilizador e outra.
//
//  - Com contexto (produto/cotação/pedido/contrato): as DUAS empresas vêm do
//    próprio registo — otherCompanyId, se enviado, é ignorado; o que conta é
//    o que a cotação/PO/contrato/produto realmente liga, e a empresa do
//    utilizador TEM de ser uma das duas, senão é 404 (não revela o resto).
//  - Sem contexto: otherCompanyId é obrigatório — inicia uma conversa direta
//    (ex.: a partir do perfil público de um fornecedor).
async function iniciar({ user, otherCompanyId, contextType, contextId }, req) {
  if (!user.companyId) throw new ValidationError('Só utilizadores de uma empresa podem iniciar o Chat Comercial.');

  let buyerCompanyId;
  let supplierCompanyId;

  if (contextType) {
    if (!CONTEXT_TYPES.includes(contextType) || !contextId) {
      throw new ValidationError('Contexto inválido.');
    }
    const par = await RESOLVEDORES_DE_CONTEXTO[contextType](contextId, user.companyId);
    if (par.buyerCompanyId !== user.companyId && par.supplierCompanyId !== user.companyId) {
      throw new NotFoundError('Contexto');
    }
    ({ buyerCompanyId, supplierCompanyId } = par);
  } else {
    if (!otherCompanyId) throw new ValidationError('Indique a empresa com quem quer falar.');
    if (otherCompanyId === user.companyId) throw new ValidationError('Não pode iniciar uma conversa com a sua própria empresa.');
    const outra = await prisma.company.findUnique({ where: { id: otherCompanyId } });
    if (!outra) throw new NotFoundError('Empresa');
    buyerCompanyId = user.companyType === 'FORNECEDOR' ? otherCompanyId : user.companyId;
    supplierCompanyId = user.companyType === 'FORNECEDOR' ? user.companyId : otherCompanyId;
  }

  const existente = await prisma.conversation.findFirst({
    where: { buyerCompanyId, supplierCompanyId, contextType: contextType || null, contextId: contextId || null, status: 'ABERTA' },
  });
  if (existente) return existente;

  const conversa = await prisma.conversation.create({
    data: { buyerCompanyId, supplierCompanyId, contextType: contextType || null, contextId: contextId || null, createdById: user.id },
  });
  await auditService.recordSafe({
    actor: auditService.actorFrom(req), action: 'CHAT_COMERCIAL_INICIADO',
    entityType: 'Conversation', entityId: conversa.id,
    detail: { ...auditService.contextoFrom(req), buyerCompanyId, supplierCompanyId, contextType: contextType || null, contextId: contextId || null },
  });
  return conversa;
}

async function listarConversas(user) {
  if (!user.companyId) return [];
  const conversas = await prisma.conversation.findMany({
    where: { OR: [{ buyerCompanyId: user.companyId }, { supplierCompanyId: user.companyId }] },
    orderBy: { updatedAt: 'desc' },
  });
  if (!conversas.length) return [];
  const outrasIds = [...new Set(conversas.map((c) => (c.buyerCompanyId === user.companyId ? c.supplierCompanyId : c.buyerCompanyId)))];
  const outras = await prisma.company.findMany({ where: { id: { in: outrasIds } }, select: { id: true, name: true, logoUrl: true } });
  const porId = Object.fromEntries(outras.map((c) => [c.id, c]));
  const ultimaPorConversa = await prisma.conversationMessage.findMany({
    where: { conversationId: { in: conversas.map((c) => c.id) } },
    orderBy: { createdAt: 'desc' }, distinct: ['conversationId'],
  });
  const ultimaPorId = Object.fromEntries(ultimaPorConversa.map((m) => [m.conversationId, m]));
  return conversas.map((c) => ({
    ...c,
    counterpart: porId[c.buyerCompanyId === user.companyId ? c.supplierCompanyId : c.buyerCompanyId] || null,
    lastMessage: ultimaPorId[c.id] || null,
  }));
}

// SÓ participantes — nunca ADMIN_SISTEMA por omissão (ver riskAlertService
// para o acesso do Suporte, que é a EXCEÇÃO, sempre por alerta ativo e sempre
// auditada). 404, não 403: uma conversa entre duas outras empresas não deve
// sequer confirmar que existe para uma terceira.
async function conversationComAcesso(conversationId, user) {
  const conversa = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversa) throw new NotFoundError('Conversa');
  const participante = user.companyId && (conversa.buyerCompanyId === user.companyId || conversa.supplierCompanyId === user.companyId);
  if (!participante) throw new NotFoundError('Conversa');
  return conversa;
}

// Autorizador do Socket.IO ('conversation:join') — mesma regra, sem lançar.
async function podeEntrarNaConversa(socketUser, conversationId) {
  try {
    await conversationComAcesso(conversationId, socketUser);
    return true;
  } catch {
    return false;
  }
}
realtimeService.setAutorizadores({ conversation: podeEntrarNaConversa });

async function listarMensagens(conversationId, user) {
  await conversationComAcesso(conversationId, user);
  return prisma.conversationMessage.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' } });
}

async function enviarMensagem(conversationId, user, { body, attachmentUrl, attachmentName }, req) {
  const texto = String(body || '').trim().slice(0, 4000);
  if (!texto && !attachmentUrl) throw new ValidationError('Escreva uma mensagem ou anexe um ficheiro.');

  const conversa = await conversationComAcesso(conversationId, user);
  if (conversa.status === 'FECHADA') throw new ConflictError('Esta conversa está fechada.');

  const mensagem = await prisma.conversationMessage.create({
    data: { conversationId, senderId: user.id, senderCompanyId: user.companyId, body: texto, attachmentUrl, attachmentName },
  });
  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

  realtimeService.emitToConversation(conversationId, 'conversation:message', mensagem);

  const outraCompanyId = conversa.buyerCompanyId === user.companyId ? conversa.supplierCompanyId : conversa.buyerCompanyId;
  await notificationService.notifyUsersByRole({
    companyId: outraCompanyId, roles: PERSONAS_DE_EMPRESA, type: 'CHAT_COMERCIAL_MENSAGEM', channel: 'IN_APP',
    title: 'Nova mensagem no Chat Comercial', message: `Recebeu uma nova mensagem de ${user.name}.`,
    relatedEntityType: 'Conversation', relatedEntityId: conversationId,
  });

  // Trust & Safety: TODA mensagem é classificada; só MEDIUM+ vira alerta —
  // é assim que "o Suporte não recebe todas as conversas comerciais" se
  // cumpre. Nunca bloqueia (versão atual só regista e avisa o Suporte).
  await analisarRisco(conversa, mensagem, req);

  return mensagem;
}

async function analisarRisco(conversa, mensagem, req) {
  const alertaAberto = await prisma.riskAlert.findFirst({
    where: { conversationId: conversa.id, status: { in: ['ABERTO', 'EM_ANALISE'] }, level: { in: ['MEDIUM', 'HIGH', 'CRITICAL'] } },
  });
  const resultado = riskAnalysisService.analisar(mensagem.body, { escalar: Boolean(alertaAberto) });
  if (resultado.level === 'LOW') return null;

  const alerta = await prisma.riskAlert.create({
    data: {
      conversationId: conversa.id, messageId: mensagem.id, level: resultado.level,
      reason: resultado.reason, signals: resultado.signals,
      context: { buyerCompanyId: conversa.buyerCompanyId, supplierCompanyId: conversa.supplierCompanyId, contextType: conversa.contextType, contextId: conversa.contextId },
    },
  });
  await auditService.recordSafe({
    actor: auditService.actorFrom(req), action: 'ALERTA_SEGURANCA_CRIADO',
    entityType: 'RiskAlert', entityId: alerta.id,
    detail: { ...auditService.contextoFrom(req), conversationId: conversa.id, level: resultado.level, reason: resultado.reason },
  });
  realtimeService.emitToConversation(conversa.id, 'conversation:risk-alert', { level: alerta.level });
  return alerta;
}

async function marcarLidas(conversationId, user) {
  await conversationComAcesso(conversationId, user);
  await prisma.conversationMessage.updateMany({
    where: { conversationId, senderCompanyId: { not: user.companyId }, readAt: null },
    data: { readAt: new Date() },
  });
}

async function contarNaoLidas(user) {
  if (!user.companyId) return 0;
  return prisma.conversationMessage.count({
    where: {
      readAt: null,
      senderCompanyId: { not: user.companyId },
      conversation: { OR: [{ buyerCompanyId: user.companyId }, { supplierCompanyId: user.companyId }] },
    },
  });
}

module.exports = {
  CONTEXT_TYPES, iniciar, listarConversas, conversationComAcesso, listarMensagens,
  enviarMensagem, marcarLidas, contarNaoLidas,
};
