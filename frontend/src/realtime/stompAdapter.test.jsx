// src/realtime/stompAdapter.test.jsx
// O transporte STOMP (backend Java) visto pelos ecrãs: tem de ser
// indistinguível do Socket.IO — o mesmo `socket.on(evento)`, o mesmo
// `joinTicket(id, ack)` com `{ ok }` — e de seguir o contrato de
// backend-java/.../realtime (WebSocketConfig.java, RealtimeAuthInterceptor.java,
// RealtimeStompTest.java): o Bearer no cabeçalho `Authorization` do CONNECT,
// a subscrição como "join", a recusa como frame ERROR com `receipt-id`.
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';

const { clientes, ioMock } = vi.hoisted(() => ({ clientes: [], ioMock: vi.fn() }));

vi.mock('socket.io-client', () => ({ io: (...a) => ioMock(...a) }));

// Um Client do stompjs falso: guarda as opções, regista subscrições e deixa o
// teste fazer de servidor (ligar, entregar envelopes, recusar, cair).
vi.mock('@stomp/stompjs', () => ({
  ReconnectionTimeMode: { LINEAR: 0, EXPONENTIAL: 1 },
  Client: class ClienteFalso {
    constructor(opcoes) {
      this.opcoes = opcoes;
      this.connected = false;
      this.subscricoes = [];
      this.activate = vi.fn();
      this.deactivate = vi.fn(() => { this.connected = false; });
      this.subscribe = vi.fn((destino, callback, headers = {}) => {
        const sub = { destino, callback, headers, ativa: true, unsubscribe: vi.fn(() => { sub.ativa = false; }) };
        this.subscricoes.push(sub);
        return sub;
      });
      clientes.push(this);
    }

    simularLigacao() { this.connected = true; this.opcoes.onConnect({}); }
    simularQueda() {
      this.connected = false;
      this.subscricoes.forEach((s) => { s.ativa = false; });
      this.opcoes.onWebSocketClose({});
    }
    simularMensagem(destino, envelope) {
      this.subscricoes
        .filter((s) => s.ativa && s.destino === destino)
        .forEach((s) => s.callback({ body: JSON.stringify(envelope) }));
    }
    // O que o Spring faz a um SUBSCRIBE não autorizado: ERROR com a razão em
    // `message` e o `receipt` do cliente ecoado em `receipt-id` — e fecha a ligação.
    simularRecusa(destino, razao = 'Sem acesso.') {
      const sub = this.subscricoes.filter((s) => s.destino === destino).at(-1);
      this.opcoes.onStompError({ command: 'ERROR', headers: { message: razao, 'receipt-id': sub.headers.receipt }, body: '' });
      this.simularQueda();
    }
    destinosAtivos() { return this.subscricoes.filter((s) => s.ativa).map((s) => s.destino); }
  },
}));

async function montar({ nativo = false, user = { id: 'u1' }, flag = 'stomp' } = {}) {
  vi.resetModules();
  clientes.length = 0;
  ioMock.mockClear();
  ioMock.mockImplementation(() => ({ on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() }));
  // `null` = variável por definir (undefined ativaria o valor por omissão do parâmetro).
  if (flag === null) vi.unstubAllEnvs();
  else vi.stubEnv('VITE_REALTIME', flag);
  if (nativo) window.Capacitor = { isNativePlatform: () => true };
  else delete window.Capacitor;

  const estado = { user };
  vi.doMock('../auth/AuthContext', () => ({ useAuth: () => ({ user: estado.user }) }));
  const clientModule = await import('../api/client');
  const { RealtimeProvider, useRealtime } = await import('./RealtimeContext');

  let valor = null;
  function Sonda() { valor = useRealtime(); return null; }
  // Um elemento NOVO em cada render: com o mesmo objeto o React salta o
  // provider (props iguais) e o useAuth() nunca voltaria a ser lido.
  const arvore = () => <RealtimeProvider><Sonda /></RealtimeProvider>;
  const { rerender } = render(arvore());

  return {
    clientModule,
    estado,
    rerender: () => rerender(arvore()),
    rt: () => valor,
    cliente: () => clientes[0],
  };
}

afterEach(() => {
  delete window.Capacitor;
  vi.unstubAllEnvs();
  vi.doUnmock('../auth/AuthContext');
});

describe('escolha do transporte (VITE_REALTIME)', () => {
  test('por omissão é o Socket.IO — o Node continua a ser o caminho de recuo', async () => {
    const { cliente } = await montar({ flag: null });
    await waitFor(() => expect(ioMock).toHaveBeenCalled());
    expect(cliente()).toBeUndefined();
  });

  test('um valor desconhecido também cai no Socket.IO', async () => {
    const { cliente } = await montar({ flag: 'qualquer-coisa' });
    await waitFor(() => expect(ioMock).toHaveBeenCalled());
    expect(cliente()).toBeUndefined();
  });

  test('"stomp" liga pelo STOMP e nunca abre Socket.IO', async () => {
    const { cliente } = await montar({ flag: 'stomp' });
    await waitFor(() => expect(cliente()).toBeDefined());
    expect(cliente().activate).toHaveBeenCalled();
    expect(ioMock).not.toHaveBeenCalled();
  });
});

describe('ligação e autenticação', () => {
  test('Web: /ws na mesma origem (esquema ws), sem Bearer — o cookie de sessão vai sozinho', async () => {
    const { cliente } = await montar();
    await waitFor(() => expect(cliente()).toBeDefined());
    expect(cliente().opcoes.brokerURL).toBe(`ws://${window.location.host}/ws`);
    expect(cliente().opcoes.connectHeaders).toEqual({});
  });

  test('Capacitor nativo: wss://kixima.net/ws com o Bearer em memória no cabeçalho Authorization do CONNECT', async () => {
    const { cliente, clientModule, estado, rerender } = await montar({ nativo: true, user: null });
    clientModule.definirBearerNativo('jwt-de-teste');
    estado.user = { id: 'u1' };
    await act(async () => rerender());

    await waitFor(() => expect(cliente()).toBeDefined());
    expect(cliente().opcoes.brokerURL).toBe('wss://kixima.net/ws');
    expect(cliente().opcoes.connectHeaders).toEqual({ Authorization: 'Bearer jwt-de-teste' });
  });

  test('sem utilizador não liga; ao aparecer liga; no logout desliga', async () => {
    const { cliente, estado, rerender, rt } = await montar({ user: null });
    expect(cliente()).toBeUndefined();
    expect(rt().socket).toBeNull();

    estado.user = { id: 'u1' };
    await act(async () => rerender());
    await waitFor(() => expect(cliente()).toBeDefined());
    expect(rt().socket).not.toBeNull();
    expect(rt().connected).toBe(false);

    await act(async () => cliente().simularLigacao());
    expect(rt().connected).toBe(true);

    estado.user = null;
    await act(async () => rerender());
    expect(cliente().deactivate).toHaveBeenCalled();
    expect(rt().socket).toBeNull();
    expect(rt().connected).toBe(false);
  });

  test('ao ligar subscreve as notificações pessoais e despacha notification:new', async () => {
    const { cliente, rt } = await montar();
    await waitFor(() => expect(cliente()).toBeDefined());
    await act(async () => cliente().simularLigacao());
    expect(cliente().destinosAtivos()).toEqual(['/user/queue/notifications']);

    const recebido = vi.fn();
    rt().socket.on('notification:new', recebido);
    cliente().simularMensagem('/user/queue/notifications', { event: 'notification:new', payload: { id: 'n1', type: 'SUPORTE_MENSAGEM' } });
    expect(recebido).toHaveBeenCalledWith({ id: 'n1', type: 'SUPORTE_MENSAGEM' });

    rt().socket.off('notification:new', recebido);
    cliente().simularMensagem('/user/queue/notifications', { event: 'notification:new', payload: { id: 'n2' } });
    expect(recebido).toHaveBeenCalledTimes(1);
  });
});

describe('salas (join = subscrição)', () => {
  test('joinTicket subscreve /topic/support/{id} com receipt e acusa { ok:true } quando o servidor não recusa', async () => {
    const { cliente, rt } = await montar();
    await waitFor(() => expect(cliente()).toBeDefined());
    await act(async () => cliente().simularLigacao());

    const ack = vi.fn();
    rt().joinTicket('t1', ack);
    const sub = cliente().subscricoes.find((s) => s.destino === '/topic/support/t1');
    expect(sub).toBeDefined();
    expect(sub.headers.id).toBeTruthy();
    expect(sub.headers.receipt).toBe(sub.headers.id);
    expect(ack).not.toHaveBeenCalled();
    await waitFor(() => expect(ack).toHaveBeenCalledWith({ ok: true }), { timeout: 1500 });
    expect(ack).toHaveBeenCalledTimes(1);

    // O envelope da sala chega ao handler registado por nome de evento, com o payload tal e qual.
    const onMessage = vi.fn();
    const onUpdated = vi.fn();
    rt().socket.on('support:message', onMessage);
    rt().socket.on('support:updated', onUpdated);
    cliente().simularMensagem('/topic/support/t1', { event: 'support:message', payload: { ticketId: 't1', body: 'olá' } });
    expect(onMessage).toHaveBeenCalledWith({ ticketId: 't1', body: 'olá' });
    expect(onUpdated).not.toHaveBeenCalled();

    // leaveTicket cancela a subscrição.
    rt().leaveTicket('t1');
    expect(sub.unsubscribe).toHaveBeenCalled();
    cliente().simularMensagem('/topic/support/t1', { event: 'support:message', payload: { ticketId: 't1', body: 'tarde' } });
    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  test('joinConversation subscreve /topic/conversation/{id} e conversation:message chega', async () => {
    const { cliente, rt } = await montar();
    await waitFor(() => expect(cliente()).toBeDefined());
    await act(async () => cliente().simularLigacao());

    rt().joinConversation('c9');
    expect(cliente().destinosAtivos()).toContain('/topic/conversation/c9');
    const onMessage = vi.fn();
    rt().socket.on('conversation:message', onMessage);
    cliente().simularMensagem('/topic/conversation/c9', { event: 'conversation:message', payload: { conversationId: 'c9' } });
    expect(onMessage).toHaveBeenCalledWith({ conversationId: 'c9' });
  });

  test('um join antes de ligar fica pendente e subscreve-se no onConnect', async () => {
    const { cliente, rt } = await montar();
    await waitFor(() => expect(cliente()).toBeDefined());

    const ack = vi.fn();
    rt().joinTicket('t1', ack);
    expect(cliente().subscribe).not.toHaveBeenCalled();

    await act(async () => cliente().simularLigacao());
    expect(cliente().destinosAtivos()).toEqual(['/user/queue/notifications', '/topic/support/t1']);
    await waitFor(() => expect(ack).toHaveBeenCalledWith({ ok: true }), { timeout: 1500 });
  });

  test('uma subscrição recusada (frame ERROR) acusa { ok:false } e não é refeita na religação', async () => {
    const { cliente, rt } = await montar();
    await waitFor(() => expect(cliente()).toBeDefined());
    await act(async () => cliente().simularLigacao());

    const ackMinha = vi.fn();
    const ackIntrusa = vi.fn();
    rt().joinTicket('minha', ackMinha);
    rt().joinTicket('de-outro', ackIntrusa);

    await act(async () => cliente().simularRecusa('/topic/support/de-outro'));
    expect(ackIntrusa).toHaveBeenCalledWith({ ok: false, error: 'Sem acesso.' });
    expect(rt().connected).toBe(false);

    // A religação refaz as notificações e a sala autorizada — nunca a recusada.
    await act(async () => cliente().simularLigacao());
    expect(rt().connected).toBe(true);
    expect(cliente().destinosAtivos()).toEqual(['/user/queue/notifications', '/topic/support/minha']);

    await waitFor(() => expect(ackMinha).toHaveBeenCalledWith({ ok: true }), { timeout: 1500 });
    // Passada a janela de recusa, a recusada continua com um único ack — nunca um { ok:true } tardio.
    expect(ackIntrusa).toHaveBeenCalledTimes(1);
  });

  test('um CONNECT recusado deixa de tentar religar (como o Socket.IO num erro do middleware)', async () => {
    const { cliente } = await montar();
    await waitFor(() => expect(cliente()).toBeDefined());
    cliente().opcoes.onStompError({ command: 'ERROR', headers: { message: 'Sessão em falta.' }, body: '' });
    expect(cliente().deactivate).toHaveBeenCalled();
  });
});
