// src/services/auditService.js
// Trilho de auditoria financeira — APPEND-ONLY. Este serviço só INSERE; não
// existe (de propósito) nenhum caminho de update/delete de registos.
//
// Uso:
//   const actor = auditService.actorFrom(req);
//   await auditService.record(prismaOuTx, { actor, action, entityType, ... });
//
// Nas operações de dinheiro (pagamento) o registo é escrito DENTRO da mesma
// transação — ou fica tudo, ou nada. Nas restantes, é escrito logo após o
// sucesso; se falhar, a operação de negócio NÃO é revertida, mas o erro é
// registado com peso (logger + Sentry) para nunca passar despercebido.
const prisma = require('../config/database');
const logger = require('../config/logger');
const { captureException } = require('../config/sentry');

// Snapshot do ator a partir do pedido autenticado (desnormalizado de propósito).
function actorFrom(req) {
  return {
    actorId: req.user?.id ?? null,
    actorName: req.user?.name ?? null,
    actorRole: req.user?.role ?? null,
    companyId: req.user?.companyId ?? null,
    ip: req.ip ?? null,
  };
}

// Ator de um pedido AINDA NÃO autenticado (tentativa de login, recuperação de
// senha). Não há utilizador — o que identifica a tentativa é a origem, por isso
// vai o IP e o agente. Sem isto, uma sequência de tentativas falhadas não deixa
// rasto nenhum.
function anonimoFrom(req) {
  return {
    actorId: null,
    actorName: null,
    actorRole: null,
    companyId: null,
    ip: req.ip ?? null,
  };
}

// Contexto do pedido para o campo `detail`: user agent truncado (é livre e vem
// do cliente) e origem.
function contextoFrom(req) {
  return {
    ip: req.ip ?? null,
    agente: String(req.get?.('user-agent') || '').slice(0, 180) || null,
  };
}

/**
 * Escreve um registo de auditoria.
 * @param client prisma ou tx (para escrever dentro de uma transação)
 * @param entry  { actor, action, entityType, entityId?, entityRef?, detail? }
 */
async function record(client, { actor = {}, action, entityType, entityId = null, entityRef = null, detail = null }) {
  return client.auditLog.create({
    data: { action, entityType, entityId, entityRef, detail, ...actor },
  });
}

// Variante "não pode partir o negócio": regista após o sucesso da operação;
// uma falha aqui é grave (fica um buraco no trilho) — vai para o log e Sentry.
async function recordSafe(entry) {
  try {
    await record(prisma, entry);
  } catch (err) {
    logger.error('AUDITORIA FALHOU — registo perdido', { action: entry.action, message: err.message });
    captureException(err);
  }
}

// Listagem para o Admin do Sistema (paginada, filtrável).
async function list({ page = 1, limit = 25, action, q } = {}) {
  const take = Math.min(Math.max(1, Number(limit) || 25), 100);
  const current = Math.max(1, Number(page) || 1);
  const where = {};
  if (action) where.action = action;
  if (q) {
    where.OR = [
      { entityRef: { contains: q, mode: 'insensitive' } },
      { actorName: { contains: q, mode: 'insensitive' } },
    ];
  }
  const [total, items, actions] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (current - 1) * take, take }),
    prisma.auditLog.groupBy({ by: ['action'], _count: { _all: true }, orderBy: { _count: { action: 'desc' } } }),
  ]);
  return {
    items, total, page: current, pages: Math.max(1, Math.ceil(total / take)),
    actions: actions.map((a) => ({ action: a.action, count: a._count._all })),
  };
}

module.exports = { actorFrom, anonimoFrom, contextoFrom, record, recordSafe, list };
