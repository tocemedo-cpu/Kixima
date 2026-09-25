// src/realtime/socketioAdapter.js
// Transporte Socket.IO — o do backend Node (backend/src/services/realtimeService.js).
// É o transporte por omissão enquanto o Node estiver em produção e continua a
// ser o caminho de recuo durante a janela do cutover para o Java (M8); o
// STOMP fica em stompAdapter.js. Os dois expõem a MESMA forma ao
// RealtimeContext: `socket` (on/off por nome de evento), `joinTicket` /
// `leaveTicket` / `joinConversation` / `leaveConversation` com o mesmo `ack`
// `{ ok }`, e `desligar()`.
import { io } from 'socket.io-client';
import { apiBaseUrl, bearerNativoAtual } from '../api/client';

export function ligarSocketIO({ aoMudarLigacao }) {
  // withCredentials envia o MESMO cookie httpOnly de sessão que a API usa.
  // Dentro do Capacitor isso tem duas questões próprias da API REST (ver
  // api/client.js): '/' resolve-se contra a origem falsa do WebView, não
  // contra kixima.net — por isso a MESMA base (apiBaseUrl()); e o cookie
  // cross-origin pode não sobreviver — por isso o MESMO Bearer em memória,
  // aqui passado no handshake (auth.token), que é onde o backend também o
  // procura (ver backend/src/services/realtimeService.js).
  const s = io(apiBaseUrl() || '/', {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    auth: bearerNativoAtual() ? { token: bearerNativoAtual() } : undefined,
  });
  s.on('connect', () => aoMudarLigacao(true));
  s.on('disconnect', () => aoMudarLigacao(false));

  // O servidor é quem decide se um "join" é permitido: mandar um id aqui não
  // dá acesso nenhum, só pede; o `ack` devolve `{ ok:false }` quando a pessoa
  // não tem autorização.
  return {
    socket: s,
    joinTicket: (id, cb) => s.emit('support:join', id, cb),
    leaveTicket: (id) => s.emit('support:leave', id),
    joinConversation: (id, cb) => s.emit('conversation:join', id, cb),
    leaveConversation: (id) => s.emit('conversation:leave', id),
    desligar: () => s.disconnect(),
  };
}
