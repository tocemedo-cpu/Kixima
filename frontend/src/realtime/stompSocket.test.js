// src/realtime/stompSocket.test.js
// O adaptador STOMP tem de se comportar como o socket do Socket.IO que os componentes já usam: despachar eventos por
// nome, confirmar (ou recusar) a entrada numa sala, repor as salas ao reconectar e largar tudo ao desligar.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// O Client do STOMP é trocado por uma dupla que regista o que o adaptador lhe pede.
const instancias = [];
vi.mock('@stomp/stompjs', () => ({
  Client: class {
    constructor(cfg) {
      this.cfg = cfg;
      this.connected = false;
      this.subs = [];
      this.recibos = {};
      this.activated = false;
      instancias.push(this);
    }
    activate() { this.activated = true; }
    deactivate() { this.activated = false; this.connected = false; }
    subscribe(destino, cb) {
      const sub = { destino, cb, unsubscribe: vi.fn() };
      this.subs.push(sub);
      return sub;
    }
    // ajudante de teste
    ligar() { this.connected = true; this.onConnect(); }
  },
}));

// eslint-disable-next-line import/first
import { criarSocketStomp, urlDoBroker, JANELA_CONFIRMACAO_MS } from './stompSocket';

const cliente = () => instancias[instancias.length - 1];
const msg = (event, payload) => ({ body: JSON.stringify({ event, payload }) });

beforeEach(() => { instancias.length = 0; vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('urlDoBroker', () => {
  test('troca http(s) por ws(s) e acrescenta /ws', () => {
    expect(urlDoBroker('https://kixima.net')).toBe('wss://kixima.net/ws');
    expect(urlDoBroker('http://localhost:4001/')).toBe('ws://localhost:4001/ws');
  });
  test('sem base usa a origem da página (serviço único)', () => {
    expect(urlDoBroker('', 'https://app.exemplo.ao')).toBe('wss://app.exemplo.ao/ws');
  });
});

describe('criarSocketStomp', () => {
  test('liga ao endpoint /ws e envia o Bearer só quando existe (app nativa)', () => {
    criarSocketStomp({ base: 'http://localhost:4001' });
    expect(cliente().activated).toBe(true);
    expect(cliente().cfg.brokerURL).toBe('ws://localhost:4001/ws');
    expect(cliente().cfg.connectHeaders).toEqual({});
    criarSocketStomp({ base: 'http://x', bearer: 'abc' });
    expect(cliente().cfg.connectHeaders).toEqual({ Authorization: 'Bearer abc' });
  });

  test('ao ligar subscreve as notificações do utilizador e avisa quem o pediu', () => {
    const aoLigar = vi.fn();
    criarSocketStomp({ base: 'http://x', aoLigar });
    cliente().ligar();
    expect(cliente().subs.map((s) => s.destino)).toEqual(['/user/queue/notifications']);
    expect(aoLigar).toHaveBeenCalled();
  });

  test('despacha o payload ao ouvinte do EVENTO certo (mesmo nome do Socket.IO) e off deixa de o chamar', () => {
    const s = criarSocketStomp({ base: 'http://x' });
    cliente().ligar();
    const novas = vi.fn();
    const outras = vi.fn();
    s.on('notification:new', novas).on('support:message', outras);
    cliente().subs[0].cb(msg('notification:new', { id: 'n1' }));
    expect(novas).toHaveBeenCalledWith({ id: 'n1' });
    expect(outras).not.toHaveBeenCalled();
    s.off('notification:new', novas);
    cliente().subs[0].cb(msg('notification:new', { id: 'n2' }));
    expect(novas).toHaveBeenCalledTimes(1);
  });

  test('ignora mensagens que não são um envelope JSON', () => {
    const s = criarSocketStomp({ base: 'http://x' });
    cliente().ligar();
    s.on('x', vi.fn());
    expect(() => cliente().subs[0].cb({ body: 'não é json' })).not.toThrow();
  });

  test('support:join subscreve a sala e confirma {ok:true} se não vier ERROR dentro da janela (o Spring não envia RECEIPT)', () => {
    const s = criarSocketStomp({ base: 'http://x' });
    cliente().ligar();
    const ack = vi.fn();
    s.emit('support:join', 't-1', ack);
    expect(cliente().subs.find((x) => x.destino === '/topic/support/t-1')).toBeTruthy();
    expect(ack).not.toHaveBeenCalled();
    vi.advanceTimersByTime(JANELA_CONFIRMACAO_MS + 10);
    expect(ack).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalledWith({ ok: true });
  });

  test('um SUBSCRIBE recusado (frame ERROR) vira {ok:false,error} e a sala deixa de ser reposta', () => {
    const s = criarSocketStomp({ base: 'http://x' });
    cliente().ligar();
    const ack = vi.fn();
    s.emit('conversation:join', 'c-9', ack);
    cliente().onStompError({ headers: { message: 'Sem acesso.' } });
    expect(ack).toHaveBeenCalledWith({ ok: false, error: 'Sem acesso.' });
    vi.advanceTimersByTime(JANELA_CONFIRMACAO_MS + 10);
    expect(ack).toHaveBeenCalledTimes(1); // a recusa não é depois "confirmada" pelo temporizador
    // reconexão: a sala recusada não volta a ser pedida (senão ficava num ciclo de recusas)
    cliente().subs.length = 0;
    cliente().ligar();
    expect(cliente().subs.map((x) => x.destino)).toEqual(['/user/queue/notifications']);
  });

  test('entrar duas vezes na mesma sala confirma logo, sem subscrição repetida', () => {
    const s = criarSocketStomp({ base: 'http://x' });
    cliente().ligar();
    s.emit('support:join', 't-1');
    const ack = vi.fn();
    s.emit('support:join', 't-1', ack);
    expect(ack).toHaveBeenCalledWith({ ok: true });
    expect(cliente().subs.filter((x) => x.destino === '/topic/support/t-1')).toHaveLength(1);
  });

  test('pedir a sala antes de ligar fica em espera, e a janela de confirmação só conta depois de ligar', () => {
    const s = criarSocketStomp({ base: 'http://x' });
    const ack = vi.fn();
    s.emit('conversation:join', 'c-1', ack);
    expect(cliente().subs).toHaveLength(0);
    vi.advanceTimersByTime(JANELA_CONFIRMACAO_MS * 4);
    expect(ack).not.toHaveBeenCalled(); // ainda a ligar: nada foi enviado ao servidor
    cliente().ligar();
    expect(cliente().subs.map((x) => x.destino)).toContain('/topic/conversation/c-1');
    vi.advanceTimersByTime(JANELA_CONFIRMACAO_MS + 10);
    expect(ack).toHaveBeenCalledWith({ ok: true });
  });

  test('support:leave cancela a subscrição; ao reconectar não volta a entrar', () => {
    const s = criarSocketStomp({ base: 'http://x' });
    cliente().ligar();
    s.emit('support:join', 't-1');
    const sub = cliente().subs.find((x) => x.destino === '/topic/support/t-1');
    s.emit('support:leave', 't-1');
    expect(sub.unsubscribe).toHaveBeenCalled();
    cliente().subs.length = 0;
    cliente().ligar();
    expect(cliente().subs.map((x) => x.destino)).toEqual(['/user/queue/notifications']);
  });

  test('ao reconectar repõe as salas em que a pessoa estava', () => {
    const s = criarSocketStomp({ base: 'http://x' });
    cliente().ligar();
    s.emit('conversation:join', 'c-1');
    cliente().subs.length = 0;
    cliente().ligar();
    expect(cliente().subs.map((x) => x.destino)).toEqual(['/user/queue/notifications', '/topic/conversation/c-1']);
  });

  test('disconnect desativa o cliente e esquece os ouvintes', () => {
    const s = criarSocketStomp({ base: 'http://x' });
    cliente().ligar();
    const fn = vi.fn();
    s.on('notification:new', fn);
    s.disconnect();
    expect(cliente().activated).toBe(false);
    cliente().subs[0].cb(msg('notification:new', {}));
    expect(fn).not.toHaveBeenCalled();
  });
});
