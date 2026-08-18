// src/services/realtimeService.js
// Socket.IO — a mesma sessão que autentica a API autentica o socket.
//
// A autenticação do handshake espelha, deliberadamente, o middleware/auth.js:
// lê o MESMO cookie httpOnly (kixima_sessao), verifica o MESMO JWT e vai
// SEMPRE à base buscar o utilizador atual (nunca confia no que o payload do
// token diz sobre papel/áreas — só o id). Um utilizador desativado, com a
// tokenVersion revogada, ou cuja sessão expirou, não consegue abrir socket
// nenhum, exatamente como não consegue chamar a API.
//
// Salas:
//   user:<id>          — notificações pessoais (o que hoje é só uma linha na
//                         tabela Notification passa também a chegar em tempo
//                         real, sem trocar o que já existe).
//   support:<ticketId> — Chat de Suporte. Sala PRÓPRIA, separada da do Chat
//                         Comercial de propósito — os dois sistemas ficam
//                         isolados também no transporte, não só na base.
//   conversation:<id>  — Chat Comercial (Conversation).
//
// Entrar numa destas duas últimas salas nunca é um pedido que se aceite às
// cegas: quem pede para entrar tem de passar pela mesma verificação de
// autorização que a rota REST equivalente aplicaria — ver `setAutorizadores`.
//
// Fora do processo, `io` é `null` até `init(server)` correr — os testes
// Jest nunca abrem um servidor HTTP real, e por isso `emitToUser` /
// `emitToTicket` / `emitToConversation` têm de ser no-ops seguros nesse caso,
// para que os serviços de negócio possam chamá-los incondicionalmente.

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const config = require('../config/env');
const prisma = require('../config/database');
const logger = require('../config/logger');
const sessionCookie = require('../utils/sessionCookie');

let io = null;

// Injetadas pelos serviços de chat (supportChatService / conversationService)
// via setAutorizadores() — o realtimeService não conhece SupportTicket nem
// Conversation; isso evitaria uma dependência circular (chat services
// importam realtimeService para emitir, não o inverso).
let autorizadores = {
  ticket: async () => false,
  conversation: async () => false,
};

function setAutorizadores(parcial) {
  autorizadores = { ...autorizadores, ...parcial };
}

function tokenDoHandshake(socket) {
  const cabecalho = socket.handshake.headers.cookie;
  if (cabecalho) {
    const cookies = cookie.parse(cabecalho);
    const doCookie = cookies[sessionCookie.NOME];
    if (doCookie) return doCookie;
  }
  // Bearer, para clientes programáticos/testes — o mesmo fallback que a API aceita.
  const auth = socket.handshake.auth || {};
  if (auth.token) return auth.token;
  return null;
}

async function autenticarSocket(socket, next) {
  try {
    const token = tokenDoHandshake(socket);
    if (!token) return next(new Error('Sessão em falta.'));

    let payload;
    try {
      payload = jwt.verify(token, config.auth.jwtSecret, { algorithms: ['HS256'] });
    } catch {
      return next(new Error('Token inválido ou expirado.'));
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active) return next(new Error('Utilizador inválido ou inativo.'));
    if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0)) return next(new Error('Sessão terminada.'));

    socket.user = {
      id: user.id,
      role: user.role,
      adminAreas: user.adminAreas || [],
      companyId: user.companyId,
    };
    next();
  } catch (err) {
    logger.error('Falha na autenticação do socket', { erro: err.message });
    next(new Error('Falha na autenticação.'));
  }
}

function registarSalaDinamica(socket, { evento, prefixo, autorizar }) {
  socket.on(`${evento}:join`, async (id, ack) => {
    try {
      const autorizado = await autorizar(socket.user, id);
      if (!autorizado) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Sem acesso.' });
        return;
      }
      socket.join(`${prefixo}:${id}`);
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      logger.error(`Falha ao entrar na sala ${prefixo}`, { erro: err.message, id });
      if (typeof ack === 'function') ack({ ok: false, error: 'Erro ao validar acesso.' });
    }
  });
  socket.on(`${evento}:leave`, (id) => socket.leave(`${prefixo}:${id}`));
}

function init(server) {
  io = new Server(server, {
    cors: {
      origin(origin, cb) {
        if (!origin) return cb(null, true);
        if (config.isDevelopment || config.isTest) return cb(null, true);
        const allowList = [config.appUrl, ...String(process.env.CORS_ORIGINS || '').split(',')]
          .map((s) => (s || '').trim()).filter(Boolean);
        return cb(null, allowList.includes(origin));
      },
      credentials: true,
    },
  });

  io.use(autenticarSocket);

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);

    // conversationId/ticketId vêm do cliente; a AUTORIZAÇÃO nunca vem dele —
    // é sempre revalidada aqui, contra a base, pelo autorizador registado.
    registarSalaDinamica(socket, { evento: 'support', prefixo: 'support', autorizar: autorizadores.ticket });
    registarSalaDinamica(socket, { evento: 'conversation', prefixo: 'conversation', autorizar: autorizadores.conversation });
  });

  logger.info('Socket.IO inicializado.');
  return io;
}

// Emissões seguras: no-op se init() nunca correu (testes, ou o processo que
// ainda não chegou ao listen). Nenhum chamador precisa de verificar isto.
function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
}

function emitToTicket(ticketId, event, payload) {
  if (!io || !ticketId) return;
  io.to(`support:${ticketId}`).emit(event, payload);
}

function emitToConversation(conversationId, event, payload) {
  if (!io || !conversationId) return;
  io.to(`conversation:${conversationId}`).emit(event, payload);
}

module.exports = { init, emitToUser, emitToTicket, emitToConversation, setAutorizadores };
