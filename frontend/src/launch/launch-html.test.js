// src/launch/launch-html.test.js
// launch.html (a página estática que os backends servem no modo de lançamento) e
// ComingSoon.jsx (a mesma página dentro do SPA) são dois ficheiros com o mesmo desenho:
// este teste vigia que dizem o mesmo, e que a estática não depende da app.
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, test } from 'vitest';
import { EN18, FR18 } from '../i18n/content17';

const AQUI = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(AQUI, '..', '..', 'launch.html'), 'utf8');
const jsx = readFileSync(join(AQUI, '..', 'pages', 'corporate', 'ComingSoon.jsx'), 'utf8');

const textos = [...html.matchAll(/data-t="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));

describe('launch.html', () => {
  test('tem os textos da página', () => {
    expect(textos).toEqual(expect.arrayContaining([
      'O maior ecossistema africano de catálogos digitais', 'Estamos a chegar…', 'Brevemente!', 'Procurement digital · Oil & Gas · África',
    ]));
  });

  test('os mesmos textos estão em ComingSoon.jsx e traduzidos para EN e FR', () => {
    for (const t of textos) {
      expect(jsx).toContain(`t('${t}')`);
      expect(EN18[t], `EN: ${t}`).toBeTruthy();
      expect(FR18[t], `FR: ${t}`).toBeTruthy();
    }
  });

  test('é estática: sem React, sem a API; só o script e o estilo próprios', () => {
    expect(html).not.toMatch(/id="root"/);
    expect(html).not.toMatch(/src="\/src\/main\.jsx"/);
    expect(html).toMatch(/src="\/src\/launch\/launch-page\.js"/);
    expect(html).not.toMatch(/<script(?![^>]*src=)[^>]*>/); // sem scripts inline (CSP script-src 'self')
    expect(html).toContain('<main class="soon"');
    expect(html).toMatch(/<h1 class="soon-h1">/);
  });
});
