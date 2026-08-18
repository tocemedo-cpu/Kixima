// src/services/riskAlertService.js
// O ÚNICO caminho pelo qual o Suporte chega a uma conversa do Chat Comercial.
//
// Nada aqui dá ao Suporte acesso a "todas as conversas comerciais" — ver a
// regra crítica do pedido: só as sinalizadas (RiskAlert ativo) aparecem, e
// aceder a UMA delas fica sempre gravado na auditoria. requirePermission
// (SUPORTE) já é aplicado nas rotas antes de chegar aqui; este serviço
// verifica a segunda condição, que a rota não sabe verificar sozinha: que a
// conversa TEM MESMO um alerta.
const prisma = require('../config/database');
const { NotFoundError, ValidationError } = require('../utils/errors');
const auditService = require('./auditService');

const STATUS_RECLASSIFICACAO = ['EM_ANALISE', 'FALSO_POSITIVO', 'RESOLVIDO'];
const ACTION_POR_STATUS = {
  EM_ANALISE: 'ALERTA_SEGURANCA_EM_ANALISE',
  FALSO_POSITIVO: 'ALERTA_SEGURANCA_FALSO_POSITIVO',
  RESOLVIDO: 'ALERTA_SEGURANCA_RESOLVIDO',
};

async function listarAlertas({ status } = {}) {
  const where = status ? { status } : { status: { in: ['ABERTO', 'EM_ANALISE'] } };
  const alertas = await prisma.riskAlert.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
  if (!alertas.length) return [];
  const companyIds = new Set();
  const conversas = await prisma.conversation.findMany({ where: { id: { in: alertas.map((a) => a.conversationId) } } });
  const convPorId = Object.fromEntries(conversas.map((c) => [c.id, c]));
  conversas.forEach((c) => { companyIds.add(c.buyerCompanyId); companyIds.add(c.supplierCompanyId); });
  const empresas = await prisma.company.findMany({ where: { id: { in: [...companyIds] } }, select: { id: true, name: true } });
  const empPorId = Object.fromEntries(empresas.map((e) => [e.id, e.name]));
  return alertas.map((a) => {
    const c = convPorId[a.conversationId];
    return {
      ...a,
      conversation: c ? {
        id: c.id, buyerCompanyId: c.buyerCompanyId, supplierCompanyId: c.supplierCompanyId,
        buyerCompany: empPorId[c.buyerCompanyId], supplierCompany: empPorId[c.supplierCompanyId],
      } : null,
    };
  });
}

// Acesso a UMA conversa sinalizada — exige um alerta (qualquer estado, mesmo
// já resolvido: o histórico de uma conversa que já teve alerta continua a ser
// legítimo consultar). Sem alerta nenhuma vez, nem o Suporte entra: é a
// fronteira que torna a exceção "só o que tem risco relevante", real.
async function acederConversaSinalizada(conversationId, admin, req) {
  const temAlerta = await prisma.riskAlert.findFirst({ where: { conversationId } });
  if (!temAlerta) throw new NotFoundError('Conversa sinalizada');
  const conversa = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversa) throw new NotFoundError('Conversa sinalizada');
  const [mensagens, alertas] = await Promise.all([
    prisma.conversationMessage.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' } }),
    prisma.riskAlert.findMany({ where: { conversationId }, orderBy: { createdAt: 'desc' } }),
  ]);
  await auditService.recordSafe({
    actor: auditService.actorFrom(req), action: 'CONVERSA_SINALIZADA_ACEDIDA',
    entityType: 'Conversation', entityId: conversationId,
    detail: auditService.contextoFrom(req),
  });
  return { conversation: conversa, messages: mensagens, alerts: alertas };
}

async function reclassificar(alertId, admin, { status, decision }, req) {
  if (!STATUS_RECLASSIFICACAO.includes(status)) throw new ValidationError('Estado de alerta inválido.');
  const alerta = await prisma.riskAlert.findUnique({ where: { id: alertId } });
  if (!alerta) throw new NotFoundError('Alerta de segurança');
  const atualizado = await prisma.riskAlert.update({
    where: { id: alertId },
    data: { status, decision: String(decision || '').slice(0, 1000) || null, reviewedById: admin.id, reviewedAt: new Date() },
  });
  await auditService.recordSafe({
    actor: auditService.actorFrom(req), action: ACTION_POR_STATUS[status],
    entityType: 'RiskAlert', entityId: alertId,
    detail: { ...auditService.contextoFrom(req), conversationId: alerta.conversationId, decision: decision || null },
  });
  return atualizado;
}

module.exports = { listarAlertas, acederConversaSinalizada, reclassificar };
