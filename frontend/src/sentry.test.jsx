// src/sentry.test.jsx
// Recuperação automática de uma aba presa numa versão antiga do build.
//
// O QUE ISTO CORRIGE. Cada rota é o seu próprio ficheiro com hash, e o build é
// reconstruído a cada deploy. Uma aba já aberta antes de um deploy pede, ao
// navegar para uma rota ainda não visitada, o ficheiro com o hash de ANTES —
// que já não existe — e o Vite dispara 'vite:preloadError' antes de deixar o
// erro subir até ao ErrorBoundary. Isto ouve esse evento e recarrega, em vez
// de mostrar "Ocorreu um erro inesperado" por causa de um deploy normal.

import {
  describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';
import { recuperarDeChunkDesatualizado } from './sentry';

function dispararPreloadError() {
  const evento = new Event('vite:preloadError', { cancelable: true });
  window.dispatchEvent(evento);
  return evento;
}

describe('recuperarDeChunkDesatualizado', () => {
  let reload;

  beforeEach(() => {
    sessionStorage.clear();
    reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test('um chunk desatualizado recarrega a página, sem deixar o erro subir', () => {
    recuperarDeChunkDesatualizado();
    const evento = dispararPreloadError();

    expect(evento.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test('um SEGUNDO chunk desatualizado a seguir não recarrega outra vez', () => {
    // O guarda de repetição: se a causa não for um deploy, recarregar sem
    // parar prendia a pessoa num ciclo silencioso — pior do que o ecrã de erro.
    recuperarDeChunkDesatualizado();
    dispararPreloadError();
    reload.mockClear();

    const segundo = dispararPreloadError();
    expect(segundo.defaultPrevented).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  test('passada a janela de repetição, volta a recuperar sozinho', () => {
    // Um deploy seguinte é um problema novo, não o mesmo ciclo.
    recuperarDeChunkDesatualizado();
    dispararPreloadError();
    reload.mockClear();

    vi.advanceTimersByTime(10_001);

    const depois = dispararPreloadError();
    expect(depois.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
