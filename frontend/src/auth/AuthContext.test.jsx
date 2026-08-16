// src/auth/AuthContext.test.jsx
// Distinguir "não tem sessão" de "não se conseguiu perguntar".
//
// O QUE ISTO CORRIGE. A verificação inicial da sessão apanhava QUALQUER falha
// no mesmo `catch` e apagava a marca de sessão. Um 429, uma falha de rede ou um
// 500 de meio segundo davam o mesmo resultado que uma sessão expirada: o ecrã
// de entrada. Quem estivesse a meio de uma cesta perdia-a, escrevia a senha
// outra vez, e descobria que a sessão nunca tinha acabado.
//
// COMO APARECEU. Numa execução da suite E2E, o /api/auth/me levou 97 respostas
// 429 do limitador da própria plataforma, e as páginas autenticadas passaram a
// mostrar o ecrã de entrada. Do lado de fora era indistinguível de uma sessão
// expirada — foi preciso ler o registo do servidor para perceber. Um utilizador
// real não tem registo do servidor para ler.

import {
  describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  temSessao: vi.fn(() => true),
  marcarSessao: vi.fn(),
}));

const { api, temSessao, marcarSessao } = await import('../api/client');
const { AuthProvider, useAuth } = await import('./AuthContext');

function Sonda() {
  const { user, loading, sessaoIndeterminada } = useAuth();
  if (loading) return <p>a verificar</p>;
  if (user) return <p>dentro: {user.name}</p>;
  if (sessaoIndeterminada) return <p>indeterminado</p>;
  return <p>fora</p>;
}

const mostrar = () => render(<AuthProvider><Sonda /></AuthProvider>);

function erro(status) {
  const e = new Error(`erro ${status}`);
  e.status = status;
  return e;
}

beforeEach(() => {
  vi.clearAllMocks();
  temSessao.mockReturnValue(true);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => { vi.useRealTimers(); });

describe('Verificação da sessão ao arrancar', () => {
  test('com sessão válida, entra', async () => {
    api.get.mockResolvedValue({ user: { name: 'Ana' } });
    mostrar();
    expect(await screen.findByText(/dentro: Ana/)).toBeInTheDocument();
    expect(marcarSessao).not.toHaveBeenCalled();
  });

  test('401 é a ÚNICA resposta que termina a sessão', async () => {
    api.get.mockRejectedValue(erro(401));
    mostrar();
    expect(await screen.findByText('fora')).toBeInTheDocument();
    expect(marcarSessao).toHaveBeenCalledWith(false);
    // Sem insistir: o servidor já respondeu, e a resposta foi clara.
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  test('429 NÃO termina a sessão — insiste e recupera', async () => {
    // É este o caso que se apanhou a sério. O limitador é da própria
    // plataforma: um pico de pedidos legítimos punha a pessoa fora.
    api.get
      .mockRejectedValueOnce(erro(429))
      .mockResolvedValueOnce({ user: { name: 'Ana' } });

    mostrar();
    expect(await screen.findByText(/dentro: Ana/, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(marcarSessao).not.toHaveBeenCalledWith(false);
  });

  test('falha de rede sem status também não termina a sessão', async () => {
    api.get
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce({ user: { name: 'Ana' } });

    mostrar();
    expect(await screen.findByText(/dentro: Ana/, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(marcarSessao).not.toHaveBeenCalledWith(false);
  });

  test('se insistir não chegar, fica INDETERMINADO e a marca sobrevive', async () => {
    // A marca ficar de pé é o que permite que um recarregamento recupere a
    // sessão em vez de exigir a senha por causa de algo que já passou.
    api.get.mockRejectedValue(erro(503));
    mostrar();
    expect(await screen.findByText('indeterminado', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(marcarSessao).not.toHaveBeenCalledWith(false);
    expect(api.get).toHaveBeenCalledTimes(3);
  });

  test('sem marca de sessão não se pergunta sequer', async () => {
    // Quem nunca entrou não gasta um pedido garantidamente 401 em cada visita.
    temSessao.mockReturnValue(false);
    mostrar();
    expect(await screen.findByText('fora')).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });
});
