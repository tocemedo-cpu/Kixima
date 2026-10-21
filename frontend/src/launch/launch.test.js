// src/launch/launch.test.js
// O interruptor da página de lançamento. O que importa proteger: só o booleano
// `true` liga a página, e QUALQUER avaria na leitura do ficheiro deixa o site
// corporativo de sempre — nunca a página de lançamento por acidente.
import { describe, test, expect, vi } from 'vitest';
import { interpretarLancamento, lerLancamento, lerEstadoLancamento, LANCAMENTO_URL } from './launch';

const resposta = (corpo, { ok = true, json } = {}) => ({ ok, json: json || (async () => corpo) });

describe('interpretarLancamento', () => {
  test('só enabled === true liga', () => {
    expect(interpretarLancamento({ enabled: true })).toBe(true);
    for (const v of [{ enabled: false }, {}, { enabled: 'true' }, { enabled: 1 }, { enabled: 'on' }, { enabled: null }, null, undefined, 'true', true, []]) {
      expect(interpretarLancamento(v)).toBe(false);
    }
  });
});

describe('lerLancamento', () => {
  test('lê /launch.json sem cache e devolve o estado', async () => {
    const f = vi.fn(async () => resposta({ enabled: true, _nota: 'x' }));
    expect(await lerLancamento(f)).toBe(true);
    expect(f).toHaveBeenCalledWith(LANCAMENTO_URL, expect.objectContaining({ cache: 'no-store' }));
    expect(await lerLancamento(async () => resposta({ enabled: false }))).toBe(false);
  });

  test('falha para o site de sempre: 404, HTML do fallback de SPA, erro de rede, sem fetch', async () => {
    expect(await lerLancamento(async () => resposta(null, { ok: false }))).toBe(false);
    // ficheiro em falta → o fallback de SPA responde 200 com index.html; r.json() rebenta
    expect(await lerLancamento(async () => resposta(null, { json: async () => { throw new SyntaxError('Unexpected token <'); } }))).toBe(false);
    expect(await lerLancamento(async () => { throw new TypeError('Failed to fetch'); })).toBe(false);
    expect(await lerLancamento(null)).toBe(false);
  });
});

describe('lerEstadoLancamento (true / false / null = não sei)', () => {
  test('distingue "desligado" de "não foi possível saber"', async () => {
    expect(await lerEstadoLancamento(async () => resposta({ enabled: true }))).toBe(true);
    expect(await lerEstadoLancamento(async () => resposta({ enabled: false }))).toBe(false);
    // ficheiro em falta: 404, ou o fallback de SPA (200 com HTML que não é JSON) → desligado
    expect(await lerEstadoLancamento(async () => ({ ok: false, status: 404, json: async () => ({}) }))).toBe(false);
    expect(await lerEstadoLancamento(async () => resposta(null, { json: async () => { throw new SyntaxError('<'); } }))).toBe(false);
    // rede em baixo ou 5xx → não sei
    expect(await lerEstadoLancamento(async () => { throw new TypeError('Failed to fetch'); })).toBeNull();
    expect(await lerEstadoLancamento(async () => ({ ok: false, status: 503, json: async () => ({}) }))).toBeNull();
    expect(await lerEstadoLancamento(null)).toBeNull();
  });
});
