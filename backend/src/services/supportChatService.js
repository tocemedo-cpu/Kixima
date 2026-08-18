// src/services/supportChatService.js
// Chat de Suporte — por cima do SupportTicket que já existia, sem lhe tocar.
//
// Os cinco estados do SupportStatus (ABERTO, EM_ANDAMENTO,
// AGUARDANDO_RESPOSTA, RESOLVIDO, FECHADO) não mudam de nome — são os mesmos
// que a página de Ajuda e o painel administrativo já usam. O pedido descreve
// o fluxo como NOVO → EM_ATENDIMENTO → AGUARDANDO_CLIENTE → RESOLVIDO →
// FECHADO; é o MESMO fluxo, só com outro rótulo — ver LABEL_ESTADO abaixo,
// usado apenas para apresentação (nunca gravado na base nem comparado em
// código).
const prisma = require('../config/database');
const { NotFoundError, ForbiddenError, ConflictError, ValidationError } = require('../utils/errors');
const { SUPORTE } = require('../utils/adminAreas');
const auditService = require('./auditService');
const realtimeService = require('./realtimeService');
const notificationService = require('./notificationService');

const LABEL_ESTADO = {
  ABERTO: 'Novo',
  EM_ANDAMENTO: 'Em Atendimento',
  AGUARDANDO_RESPOSTA: 'Aguardando Cliente',
  RESOLVIDO: 'Resolvido',
  FECHADO: 'Fechado',
};

function podeGerirSuporte(user) {
  if (user.role !== 'ADMIN_SISTEMA') return false;
  const areas = user.adminAreas || [];
  return areas.length === 0 || areas.includes(SUPORTE);
}

// Um cliente só vê o SEU pedido; um assessor de Suporte (ou Super Admin) vê
// qualquer um — é o próprio propósito de uma fila partilhada. Nunca confia no
// que o pedido diz sobre o dono: vai sempre buscar o ticket à base primeiro.
async function ticketComAcesso(ticketId, user) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new NotFoundError('Pedido de suporte');
  const dono = ticket.userId === user.id;
  if (!dono && !podeGerirSuporte(user)) throw new NotFoundError('Pedido de suporte');
  return ticket;
}

// Usado pelo Socket.IO (io.use "conversation:join" para Suporte) — mesma
// regra de acesso do REST, sem lançar (o handshake só quer sim/não).
async function podeEntrarNoTicket(socketUser, ticketId) {
  try {
    await ticketComAcesso(ticketId, socketUser);
    return true;
  } catch {
    return false;
  }
}
realtimeService.setAutorizadores({ ticket: podeEntrarNoTicket });

async function listarMensagens(ticketId, user) {
  await ticketComAcesso(ticketId, user);
  return prisma.supportMessage.findMany({ where: { ticketId }, orderBy: { createdAt: 'asc' } });
}

// Fila: pedidos em aberto, sem ninguém a atender ainda — a lista que o painel
// mostra para "escolher o próximo". Fica separada de "os meus atendimentos"
// (ver listarMeusAtendimentos) de propósito: são duas telas diferentes.
async function listarFila() {
  return prisma.supportTicket.findMany({
    where: { status: 'ABERTO', assignedToId: null },
    orderBy: { createdAt: 'asc' },
  });
}

async function listarMeusAtendimentos(adminId) {
  return prisma.supportTicket.findMany({
    where: { assignedToId: adminId, status: { in: ['EM_ANDAMENTO', 'AGUARDANDO_RESPOSTA'] } },
    orderBy: { createdAt: 'asc' },
  });
}

async function assumir(ticketId, admin, req) {
  if (!podeGerirSuporte(admin)) throw new ForbiddenError('Esta ação está reservada a quem gere Suporte.');
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new NotFoundError('Pedido de suporte');
  if (ticket.assignedToId && ticket.assignedToId !== admin.id) {
    throw new ConflictError('Este pedido já está a ser atendido por outra pessoa. Use "Transferir" se for o caso.');
  }
  const atualizado = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { assignedToId: admin.id, status: ticket.status === 'ABERTO' ? 'EM_ANDAMENTO' : ticket.status },
  });
  await auditService.recordSafe({
    actor: auditService.actorFrom(req), action: 'SUPORTE_TICKET_ASSUMIDO',
    entityType: 'SupportTicket', entityId: ticketId, entityRef: ticket.reference,
    detail: auditService.contextoFrom(req),
  });
  realtimeService.emitToTicket(ticketId, 'support:updated', atualizado);
  return atualizado;
}

async function transferir(ticketId, admin, toUserId, req) {
  if (!podeGerirSuporte(admin)) throw new ForbiddenError('Esta ação está reservada a quem gere Suporte.');
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new NotFoundError('Pedido de suporte');
  const destino = await prisma.user.findUnique({ where: { id: toUserId } });
  if (!destino || !destino.active || !podeGerirSuporte(destino)) {
    throw new ValidationError('O destinatário tem de ser um assessor de Suporte ativo.');
  }
  const atualizado = await prisma.supportTicket.update({
    where: { id: ticketId }, data: { assignedToId: destino.id },
  });
  await auditService.recordSafe({
    actor: auditService.actorFrom(req), action: 'SUPORTE_TICKET_TRANSFERIDO',
    entityType: 'SupportTicket', entityId: ticketId, entityRef: ticket.reference,
    detail: { ...auditService.contextoFrom(req), de: ticket.assignedToId, para: destino.id },
  });
  realtimeService.emitToTicket(ticketId, 'support:updated', atualizado);
  await notificationService.notifyUser({
    userId: destino.id, type: 'SUPORTE_MENSAGEM', channel: 'IN_APP',
    title: 'Pedido de suporte transferido para si',
    message: `O pedido ${ticket.reference} foi transferido para si.`,
    relatedEntityType: 'SupportTicket', relatedEntityId: ticketId,
  });
  return atualizado;
}

// Envia uma mensagem — cliente ou assessor, a mesma função. As transições de
// estado ao enviar mensagem são as únicas AUTOMÁTICAS deste fluxo (o resto —
// resolver/fechar/reabrir — é sempre uma ação explícita do assessor):
//   cliente escreve num pedido RESOLVIDO/AGUARDANDO_RESPOSTA → volta para
//     EM_ANDAMENTO (é a vez do Suporte agir outra vez).
//   assessor escreve → o pedido fica AGUARDANDO_RESPOSTA (a vez do cliente);
//     se ainda não tinha dono, fica implicitamente assumido por quem respondeu.
// Um pedido FECHADO não aceita mensagens novas — tem de ser reaberto primeiro
// (ação explícita), para não reviver silenciosamente um caso já arquivado.
async function enviarMensagem(ticketId, user, { body, attachmentUrl, attachmentName }, req) {
  const texto = String(body || '').trim().slice(0, 4000);
  if (!texto && !attachmentUrl) throw new ValidationError('Escreva uma mensagem ou anexe um ficheiro.');

  const ticket = await ticketComAcesso(ticketId, user);
  if (ticket.status === 'FECHADO') {
    throw new ConflictError('Este pedido está fechado. Reabra-o para continuar a conversa.');
  }

  const ehCliente = ticket.userId === user.id;
  const data = { ticketId, authorId: user.id, authorRole: user.role, body: texto, attachmentUrl, attachmentName };
  const [mensagem] = await prisma.$transaction([
    prisma.supportMessage.create({ data }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: ehCliente
        ? { status: ['RESOLVIDO', 'AGUARDANDO_RESPOSTA'].includes(ticket.status) ? 'EM_ANDAMENTO' : ticket.status }
        : { status: 'AGUARDANDO_RESPOSTA', assignedToId: ticket.assignedToId || user.id },
    }),
  ]);

  realtimeService.emitToTicket(ticketId, 'support:message', mensagem);

  // Quem NÃO escreveu é avisado — o cliente quando o Suporte responde, e o
  // assessor responsável quando o cliente escreve de volta.
  if (ehCliente && ticket.assignedToId) {
    await notificationService.notifyUser({
      userId: ticket.assignedToId, type: 'SUPORTE_MENSAGEM', channel: 'IN_APP',
      title: 'Nova mensagem no pedido de suporte',
      message: `${user.name} respondeu no pedido ${ticket.reference}.`,
      relatedEntityType: 'SupportTicket', relatedEntityId: ticketId,
    });
  } else if (!ehCliente) {
    await notificationService.notifyUser({
      userId: ticket.userId, type: 'SUPORTE_MENSAGEM', channel: 'IN_APP',
      title: 'Nova resposta do Suporte',
      message: `O Suporte respondeu ao seu pedido ${ticket.reference}.`,
      relatedEntityType: 'SupportTicket', relatedEntityId: ticketId,
    });
  }

  return mensagem;
}

async function marcarLidas(ticketId, user) {
  await ticketComAcesso(ticketId, user);
  await prisma.supportMessage.updateMany({
    where: { ticketId, authorId: { not: user.id }, readAt: null },
    data: { readAt: new Date() },
  });
}

// Total de mensagens não lidas do utilizador em TODOS os seus pedidos — o
// contador "Suporte: X mensagens" do cabeçalho.
async function contarNaoLidas(user) {
  const where = user.role === 'ADMIN_SISTEMA' && podeGerirSuporte(user)
    ? { authorId: { not: user.id }, readAt: null, ticket: { assignedToId: user.id } }
    : { authorId: { not: user.id }, readAt: null, ticket: { userId: user.id } };
  return prisma.supportMessage.count({ where });
}

async function mudarEstado(ticketId, admin, novoEstado, req) {
  if (!podeGerirSuporte(admin)) throw new ForbiddenError('Esta ação está reservada a quem gere Suporte.');
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new NotFoundError('Pedido de suporte');
  const atualizado = await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: novoEstado } });
  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: novoEstado === 'RESOLVIDO' ? 'SUPORTE_TICKET_RESOLVIDO'
      : novoEstado === 'FECHADO' ? 'SUPORTE_TICKET_FECHADO' : 'SUPORTE_TICKET_REABERTO',
    entityType: 'SupportTicket', entityId: ticketId, entityRef: ticket.reference,
    detail: { ...auditService.contextoFrom(req), de: ticket.status, para: novoEstado },
  });
  realtimeService.emitToTicket(ticketId, 'support:updated', atualizado);
  return atualizado;
}

module.exports = {
  LABEL_ESTADO, podeGerirSuporte, ticketComAcesso,
  listarMensagens, listarFila, listarMeusAtendimentos,
  assumir, transferir, enviarMensagem, marcarLidas, contarNaoLidas, mudarEstado,
};
