// src/i18n/dicts.test.js
// Todo o dicionário que existe na pasta tem de estar LIGADO ao mapa de tradução.
//
// Existe por causa de uma avaria real: o content8.js foi criado com as traduções
// dos textos que o servidor produz, mas bastava esquecer o import ou o spread no
// index.jsx para as páginas continuarem em português — sem erro, sem aviso, e
// com a auditoria estática a dar zero (o ficheiro nem era lido).
import { readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, test } from 'vitest';

const AQUI = dirname(fileURLToPath(import.meta.url));
const indexSrc = readFileSync(join(AQUI, 'index.jsx'), 'utf8');

const ficheiros = readdirSync(AQUI)
  .filter((f) => /^content\d*\.js$/.test(f))
  .sort();

describe('Dicionários de tradução', () => {
  test('há dicionários na pasta', () => {
    expect(ficheiros.length).toBeGreaterThan(0);
  });

  test.each(ficheiros)('%s é importado pelo index.jsx', (f) => {
    const modulo = f.replace(/\.js$/, '');
    expect(indexSrc).toMatch(new RegExp(`from '\\./${modulo}'`));
  });

  test.each(ficheiros)('as chaves de %s entram no mapa DICT (EN e FR)', (f) => {
    const src = readFileSync(join(AQUI, f), 'utf8');
    // Cada ficheiro exporta um par (EN…, FR…) — ambos têm de ser espalhados
    // dentro do DICT, senão as traduções nunca chegam ao ecrã.
    const exportados = [...src.matchAll(/export const (EN\d*|FR\d*)\s*=/g)].map((m) => m[1]);
    expect(exportados.length).toBe(2);
    const dict = indexSrc.match(/const DICT = \{[\s\S]*?\};/)?.[0] || '';
    for (const nome of exportados) {
      expect(dict).toContain(`...${nome}`);
    }
  });
});
