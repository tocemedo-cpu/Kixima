// src/realtime/stompAdapter.js
// Transporte STOMP — o do backend Java (backend-java/.../realtime/*). Expõe ao
// RealtimeContext exatamente a mesma forma que o socketioAdapter.js, para que
// nenhum consumidor (SuporteChat, ChatComercial, AppLayout) saiba qual dos
// dois está por baixo. Selecionado por VITE_REALTIME=stomp (ver
// RealtimeContext.jsx).
//
// Mapa das salas (é o de WebSocketConfig.java, o contrato deste lado):
//   user:<id>          → /user/queue/notifications   (notification:new)
//   support:<ticket>   → /topic/support/{ticketId}   (support:message, support:updated)
//   conversation:<id>  → /topic/conversation/{id}    (conversation:message, conversation:risk-alert)
// Cada mensagem é um envelope { event, payload } com o MESMO nome de evento e
// o MESMO payload que o Socket.IO emite — daí `socket.on(evento)` continuar a
// funcionar tal e qual: aqui só se despacha por `event`.
//
// "Join" = a própria subscrição, autorizada em RealtimeAuthInterceptor.java.
// O broker simples do Spring NÃO responde com RECEIPT a um SUBSCRIBE aceite
// (é o que RealtimeStompTest.java também assume: dorme 300 ms e verifica que
// não chegou nenhum ERROR). Uma recusa, essa é explícita: um frame ERROR com
// a razão no cabeçalho `message` ("Sem acesso.") e o `receipt-id` a ecoar o
// `receipt` que mandámos no SUBSCRIBE — e o Spring fecha a ligação a seguir
// (é o comportamento do StompSubProtocolHandler para qualquer ERROR). Logo:
//   ack({ ok:false, error })  — chegou o ERROR com o receipt-id da sala;
//   ack({ ok:true })          — passou a janela de recusa sem ERROR nenhum.
// A sala recusada é ESQUECIDA antes da religação automática: religar e
// voltar a subscrevê-la daria outro ERROR, outro fecho, e um ciclo sem fim.
import { Client, ReconnectionTimeMode } from '@stomp/stompjs';
import { apiBaseUrl, bearerNativoAtual } from '../api/client';

// O cabeçalho STOMP nativo que RealtimeAuthInterceptor.tokenDoConnect lê
// (`accessor.getFirstNativeHeader("Authorization")`), com o prefixo "Bearer ".
// Só vai dentro do Capacitor — na Web o cookie httpOnly de sessão segue
// sozinho no pedido de upgrade (RealtimeHandshakeInterceptor guarda-o) e este
// código nunca lhe toca.
export const CABECALHO_BEARER = 'Authorization';
export const DESTINO_NOTIFICACOES = '/user/queue/notifications';
// A mesma espera do teste Java (Thread.sleep(300)) — o tempo que damos ao
// servidor para recusar antes de considerarmos a subscrição aceite.
export const JANELA_DE_RECUSA_MS = 300;
// O mesmo compasso de religação por omissão do Socket.IO (reconnectionDelay
// 1 s a crescer até 5 s) — o stompjs sobe do primeiro valor até ao máximo.
const RELIGACAO_INICIAL_MS = 1000;
const RELIGACAO_MAXIMA_MS = 5000;

// Endpoint WebSocket nativo "/ws", resolvido contra a MESMA base que a API
// REST (apiBaseUrl(): '' na Web, https://kixima.net no Capacitor) e com o
// esquema trocado para ws/wss. Sem SockJS: o fallback "/ws/sockjs" existe no
// servidor, mas nenhum dos nossos alvos (browsers atuais, WebView) precisa.
export function urlDoWebSocket() {
  const url = new URL('/ws', apiBaseUrl() || window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export function ligarStomp({ aoMudarLigacao, janelaDeRecusaMs = JANELA_DE_RECUSA_MS }) {
  // --- socket.on / socket.off por nome de evento (a API que os ecrãs usam) --
  const ouvintes = new Map();
  const socket = {
    on(event, handler) {
      if (!ouvintes.has(event)) ouvintes.set(event, new Set());
      ouvintes.get(event).add(handler);
      return socket;
    },
    off(event, handler) {
      if (handler === undefined) ouvintes.delete(event);
      else ouvintes.get(event)?.delete(handler);
      return socket;
    },
  };

  function despachar(mensagem) {
    let envelope;
    try {
      envelope = JSON.parse(mensagem.body);
    } catch {
      return; // não é um envelope nosso — ignora, tal como o Socket.IO ignoraria um evento sem ouvinte
    }
    if (!envelope || typeof envelope.event !== 'string') return;
    ouvintes.get(envelope.event)?.forEach((handler) => handler(envelope.payload));
  }

  // --- Salas: destino -> { cb, subscricao, id, temporizador } ---------------
  // A lista é a fonte da verdade para a religação: o stompjs só re-subscreve o
  // que for pedido dentro de onConnect, por isso é aqui que se guarda o que
  // está "junto" e é onConnect que volta a subscrever tudo.
  const salas = new Map();
  let contador = 0;

  const bearer = bearerNativoAtual();
  const client = new Client({
    brokerURL: urlDoWebSocket(),
    connectHeaders: bearer ? { [CABECALHO_BEARER]: `Bearer ${bearer}` } : {},
    reconnectDelay: RELIGACAO_INICIAL_MS,
    maxReconnectDelay: RELIGACAO_MAXIMA_MS,
    reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
    onConnect: () => {
      aoMudarLigacao(true);
      // As notificações pessoais são a sala user:<id> do Node: entra-se sempre,
      // sem pedir — o Spring prende o destino /user/... ao principal.
      subscrever(DESTINO_NOTIFICACOES, null);
      for (const [destino, sala] of salas) subscrever(destino, sala);
    },
    onWebSocketClose: () => {
      aoMudarLigacao(false);
      // A ligação caiu: nenhuma subscrição sobrevive no servidor. Marca-se
      // tudo como "por subscrever" para o próximo onConnect as refazer.
      for (const sala of salas.values()) sala.subscricao = null;
    },
    onStompError: (frame) => {
      const razao = frame.headers?.message || 'Sem acesso.';
      const idRecusado = frame.headers?.['receipt-id'];
      const recusada = idRecusado
        ? [...salas.entries()].find(([, sala]) => sala.id === idRecusado)
        : undefined;
      if (recusada) {
        // SUBSCRIBE recusado: o ack({ ok:false }) do Node. Esquece-se a sala
        // ANTES de a religação automática acontecer (ver o cabeçalho).
        const [destino, sala] = recusada;
        salas.delete(destino);
        clearTimeout(sala.temporizador);
        const cb = sala.cb;
        sala.cb = null;
        if (typeof cb === 'function') cb({ ok: false, error: razao });
        return;
      }
      if (!client.connected) {
        // CONNECT recusado (sessão em falta, token inválido, sessão terminada):
        // o Socket.IO também não insiste depois de um erro do middleware —
        // quem trata da sessão expirada é o AuthContext, que ao deitar o
        // utilizador abaixo faz o RealtimeContext desligar de vez.
        client.deactivate();
      }
    },
  });

  function subscrever(destino, sala) {
    if (!client.connected) return;
    const id = `sala-${++contador}`;
    // `receipt`: é este id que o ERROR de uma recusa devolve em `receipt-id`.
    const subscricao = client.subscribe(destino, despachar, { id, receipt: id });
    if (!sala) return;
    sala.id = id;
    sala.subscricao = subscricao;
    if (typeof sala.cb === 'function') {
      clearTimeout(sala.temporizador);
      sala.temporizador = setTimeout(() => {
        sala.temporizador = null;
        const cb = sala.cb;
        sala.cb = null;
        if (typeof cb === 'function') cb({ ok: true });
      }, janelaDeRecusaMs);
    }
  }

  function entrar(destino, cb) {
    const existente = salas.get(destino);
    if (existente) {
      // Já lá está (o Node também aceita um join repetido): só o ack é novo.
      if (existente.subscricao && typeof cb === 'function' && !existente.cb) cb({ ok: true });
      else if (typeof cb === 'function') existente.cb = cb;
      return;
    }
    const sala = { cb: typeof cb === 'function' ? cb : null, subscricao: null, id: null, temporizador: null };
    salas.set(destino, sala);
    // Sem ligação neste momento, fica pendente: onConnect subscreve-a e o ack
    // sai nessa altura — como o Socket.IO, que guarda o emit até ligar.
    subscrever(destino, sala);
  }

  function sair(destino) {
    const sala = salas.get(destino);
    if (!sala) return;
    salas.delete(destino);
    clearTimeout(sala.temporizador);
    if (sala.subscricao && client.connected) {
      try { sala.subscricao.unsubscribe(); } catch { /* a ligação pode ter caído entretanto */ }
    }
  }

  client.activate();

  return {
    socket,
    joinTicket: (id, cb) => entrar(`/topic/support/${id}`, cb),
    leaveTicket: (id) => sair(`/topic/support/${id}`),
    joinConversation: (id, cb) => entrar(`/topic/conversation/${id}`, cb),
    leaveConversation: (id) => sair(`/topic/conversation/${id}`),
    desligar: () => {
      for (const sala of salas.values()) clearTimeout(sala.temporizador);
      salas.clear();
      ouvintes.clear();
      client.deactivate();
    },
  };
}
