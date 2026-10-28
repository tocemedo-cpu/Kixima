// src/realtime/stompSocket.js
// Tempo real sobre STOMP (backend Java) com a MESMA forma mínima do socket do
// Socket.IO que o resto da aplicação já usa — `on(evento, fn)`, `off`, `emit(...)`
// e `disconnect()` — para o Chat de Suporte, o Chat Comercial e o sino de
// notificações funcionarem contra o Java sem tocar em nenhum componente.
//
// O protocolo é o do backend-java/.../realtime (WebSocketConfig, RealtimeAuthInterceptor):
//   - endpoint `/ws` (WebSocket nativo); a sessão é o MESMO cookie httpOnly da API
//     (vem no pedido de upgrade) ou, na app nativa, o Bearer no CONNECT;
//   - salas do Socket.IO viram destinos:  user:<id>        -> /user/queue/notifications
//                                         support:<id>     -> /topic/support/<id>
//                                         conversation:<id>-> /topic/conversation/<id>
//   - cada mensagem é um envelope `{ event, payload }` com o MESMO nome de evento
//     e o MESMO payload que o Socket.IO emite;
//   - "support:join"/"conversation:join" passam a ser a própria subscrição, que o
//     servidor autoriza no SUBSCRIBE. Recusa -> trama ERROR (o `ack({ ok:false })`). O broker simples do
//     Spring NÃO envia RECEIPT, por isso a entrada confirma-se por ausência de erro numa janela curta.
import { Client } from '@stomp/stompjs';

const DESTINO_NOTIFICACOES = '/user/queue/notifications';
const SALAS = {
  'support:join': { prefixo: '/topic/support/', sair: 'support:leave' },
  'conversation:join': { prefixo: '/topic/conversation/', sair: 'conversation:leave' },
};
const SAIR = { 'support:leave': '/topic/support/', 'conversation:leave': '/topic/conversation/' };

// Quanto se espera por um ERROR antes de dar a entrada na sala como aceite. A autorização corre no servidor no
// próprio SUBSCRIBE (uma ou duas consultas) e a recusa volta de imediato, por isso esta janela chega com folga.
export const JANELA_CONFIRMACAO_MS = 500;

/** http(s)://host -> ws(s)://host/ws . Sem base, usa a origem da página (serviço único). */
export function urlDoBroker(base, origem = typeof window !== 'undefined' ? window.location.origin : '') {
  const raiz = (base || origem).replace(/\/+$/, '');
  return `${raiz.replace(/^http/i, 'ws')}/ws`;
}

export function criarSocketStomp({ base = '', bearer, aoLigar, aoDesligar, reconnectDelay = 5000 } = {}) {
  const ouvintes = new Map(); // evento -> Set<fn>
  const salas = new Map(); // destino -> subscrição activa
  const pendentes = new Map(); // destino -> ack à espera de confirmação (ou de um ERROR)
  const temporizadores = new Map(); // destino -> timeout da janela de confirmação
  const salasQuePedi = new Set(); // destinos pedidos pela aplicação (para repor ao reconectar)
  let seq = 0;

  const client = new Client({
    brokerURL: urlDoBroker(base),
    connectHeaders: bearer ? { Authorization: `Bearer ${bearer}` } : {},
    reconnectDelay,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
  });

  const despachar = (mensagem) => {
    let envelope;
    try { envelope = JSON.parse(mensagem.body); } catch { return; }
    (ouvintes.get(envelope?.event) || []).forEach((fn) => fn(envelope.payload));
  };

  function confirmar(destino) {
    clearTimeout(temporizadores.get(destino));
    temporizadores.delete(destino);
    const ack = pendentes.get(destino);
    pendentes.delete(destino);
    ack?.({ ok: true });
  }

  function subscrever(destino) {
    if (salas.has(destino) || !client.connected) return;
    salas.set(destino, client.subscribe(destino, despachar));
    // A janela só começa quando o SUBSCRIBE foi mesmo enviado (não enquanto a ligação ainda está a abrir).
    if (pendentes.has(destino)) temporizadores.set(destino, setTimeout(() => confirmar(destino), JANELA_CONFIRMACAO_MS));
  }

  client.onConnect = () => {
    salas.clear(); // as subscrições antigas morreram com a ligação
    subscrever(DESTINO_NOTIFICACOES);
    // Religa as salas em que a pessoa estava (o Socket.IO também as perdia ao cair: aqui recuperam-se).
    for (const destino of salasQuePedi) subscrever(destino);
    aoLigar?.();
  };
  client.onWebSocketClose = () => aoDesligar?.();
  client.onStompError = (frame) => {
    // O servidor recusou um CONNECT/SUBSCRIBE e fecha a sessão: quem estava à espera de confirmação recebe
    // `{ ok:false }` (como o ack do Socket.IO) e essa sala deixa de ser reposta — senão a reconexão voltava a pedi-la.
    const motivo = frame?.headers?.message || 'Sem acesso.';
    for (const [destino, ack] of pendentes) {
      clearTimeout(temporizadores.get(destino));
      salasQuePedi.delete(destino);
      ack?.({ ok: false, error: motivo });
    }
    pendentes.clear();
    temporizadores.clear();
  };

  const socket = {
    get connected() { return client.connected; },
    on(evento, fn) {
      if (!ouvintes.has(evento)) ouvintes.set(evento, new Set());
      ouvintes.get(evento).add(fn);
      return socket;
    },
    off(evento, fn) {
      if (fn) ouvintes.get(evento)?.delete(fn);
      else ouvintes.delete(evento);
      return socket;
    },
    // emit('support:join', id, ack) | emit('support:leave', id) — os mesmos eventos do Socket.IO.
    emit(evento, id, ack) {
      const sala = SALAS[evento];
      if (sala) {
        const destino = `${sala.prefixo}${id}`;
        salasQuePedi.add(destino);
        // Já estava na sala: não há subscrição nova nem recibo — confirma-se logo.
        if (salas.has(destino)) { if (typeof ack === 'function') ack({ ok: true }); return socket; }
        if (typeof ack === 'function') pendentes.set(destino, ack);
        subscrever(destino);
        return socket;
      }
      if (SAIR[evento]) {
        const destino = `${SAIR[evento]}${id}`;
        salasQuePedi.delete(destino);
        pendentes.delete(destino);
        clearTimeout(temporizadores.get(destino));
        temporizadores.delete(destino);
        salas.get(destino)?.unsubscribe();
        salas.delete(destino);
      }
      return socket;
    },
    disconnect() {
      ouvintes.clear();
      salas.clear();
      salasQuePedi.clear();
      pendentes.clear();
      temporizadores.forEach((t) => clearTimeout(t));
      temporizadores.clear();
      client.deactivate();
    },
  };

  client.activate();
  return socket;
}
