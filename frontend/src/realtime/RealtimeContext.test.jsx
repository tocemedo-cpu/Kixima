// src/realtime/RealtimeContext.test.jsx
// O socket liga-se à MESMA base e ao MESMO Bearer que a API REST (ver
// api/client.js) — dentro do Capacitor, '/' e o cookie sozinho não chegam,
// exatamente como já não chegavam para o fetch antes dessa correção.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const ioMock = vi.fn(() => ({
  on: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock('socket.io-client', () => ({ io: (...a) => ioMock(...a) }));

async function carregarComo({ nativo, user }) {
  vi.resetModules();
  ioMock.mockClear();
  if (nativo) window.Capacitor = { isNativePlatform: () => true };
  else delete window.Capacitor;

  vi.doMock('../auth/AuthContext', () => ({ useAuth: () => ({ user }) }));
  const clientModule = await import('../api/client');
  const { RealtimeProvider } = await import('./RealtimeContext');
  return { clientModule, RealtimeProvider };
}

beforeEach(() => { delete window.Capacitor; });
afterEach(() => { delete window.Capacitor; vi.doUnmock('../auth/AuthContext'); });

test('Web: liga a "/" (mesma origem), sem token no handshake', async () => {
  const { RealtimeProvider } = await carregarComo({ nativo: false, user: { id: 'u1' } });
  render(<RealtimeProvider>{null}</RealtimeProvider>);

  await waitFor(() => expect(ioMock).toHaveBeenCalled());
  const [url, opts] = ioMock.mock.calls[0];
  expect(url).toBe('/');
  expect(opts.auth).toBeUndefined();
  expect(opts.withCredentials).toBe(true);
});

test('Capacitor nativo: liga a https://kixima.net, com o Bearer em memória no handshake', async () => {
  const { clientModule, RealtimeProvider } = await carregarComo({ nativo: true, user: { id: 'u1' } });
  clientModule.definirBearerNativo('jwt-de-teste');

  render(<RealtimeProvider>{null}</RealtimeProvider>);

  await waitFor(() => expect(ioMock).toHaveBeenCalled());
  const [url, opts] = ioMock.mock.calls[0];
  expect(url).toBe('https://kixima.net');
  expect(opts.auth).toEqual({ token: 'jwt-de-teste' });
});

test('sem utilizador, não liga socket nenhum', async () => {
  const { RealtimeProvider } = await carregarComo({ nativo: false, user: null });
  render(<RealtimeProvider>{null}</RealtimeProvider>);
  expect(ioMock).not.toHaveBeenCalled();
});
