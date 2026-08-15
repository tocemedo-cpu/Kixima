// e2e/mobile.spec.js
// A camada mobile (< 760px), fixada por medição.
//
// O CSS que a sustenta é frágil de uma maneira particular: uma regra nova
// noutro sítio da folha, um `flex-shrink: 0` acrescentado sem pensar, uma
// palavra mais comprida numa tradução — qualquer uma volta a pôr a página a
// deslizar de lado. E é uma avaria que não dá erro nenhum: a app continua a
// funcionar, os testes de API continuam verdes, e só quem abre no telemóvel é
// que vê. Foi assim que esteve até agora.
//
// Estes testes medem o que o browser realmente pintou, e não o que o CSS diz.

import { test, expect } from '@playwright/test';

// As sessões são preparadas uma vez em global-setup.js — ver sessoes.js para
// a razão de não se entrar em cada teste.
const sessaoDe = (nome) => `e2e/.sessoes/${nome}.json`;

// As larguras reais dos telemóveis mais comuns em Angola, mais as fronteiras.
const LARGURAS = [640, 540, 430, 414, 390, 375, 360];

// A fronteira protegida: a partir daqui o desenho de desktop está congelado.
const FRONTEIRA = 760;

const PUBLICAS = ['/login', '/cadastro'];
const POR_PERSONA = {
  comprador: ['/comprador', '/comprador/produtos', '/perfil'],
  fornecedor: ['/fornecedor', '/fornecedor/inventario', '/fornecedor/carteira'],
  kixima: ['/sistema/prontidao', '/sistema/cobrancas'],
};

// Largura que o documento ocupa, contra a que a janela tem.
async function transbordo(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const culpados = [];
    if (de.scrollWidth > de.clientWidth + 1) {
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.right > de.clientWidth + 1 && r.width > 0) {
          culpados.push(`${el.tagName.toLowerCase()}.${typeof el.className === 'string'
            ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} (${Math.round(r.width)}px)`);
        }
      }
    }
    return { doc: de.scrollWidth, janela: de.clientWidth, culpados: culpados.slice(0, 3) };
  });
}

test.describe('Mobile: nenhuma página desliza de lado', () => {
  for (const largura of LARGURAS) {
    test(`páginas públicas a ${largura}px`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: largura, height: 844 } });
      const page = await ctx.newPage();
      for (const url of PUBLICAS) {
        await page.goto(url, { waitUntil: 'networkidle' });
        const m = await transbordo(page);
        expect(m.doc, `${url} a ${largura}px transborda ${m.doc - m.janela}px — ${m.culpados.join(', ')}`)
          .toBeLessThanOrEqual(m.janela + 1);
      }
      await ctx.close();
    });
  }

  for (const [persona, urls] of Object.entries(POR_PERSONA)) {
    for (const largura of LARGURAS) {
      test(`${persona} a ${largura}px`, async ({ browser }) => {
        const ctx = await browser.newContext({
          viewport: { width: largura, height: 844 },
          storageState: sessaoDe(persona),
        });
        const page = await ctx.newPage();
        for (const url of urls) {
          await page.goto(url, { waitUntil: 'networkidle' });
          const m = await transbordo(page);
          expect(m.doc, `${url} a ${largura}px transborda ${m.doc - m.janela}px — ${m.culpados.join(', ')}`)
            .toBeLessThanOrEqual(m.janela + 1);
        }
        await ctx.close();
      });
    }
  }
});

test.describe('Mobile: a marca e a pesquisa não desaparecem', () => {
  for (const largura of LARGURAS) {
    test(`emblema, KIXIMA e pesquisa a ${largura}px`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: largura, height: 844 },
        storageState: sessaoDe('comprador'),
      });
      const page = await ctx.newPage();
      await page.goto('/comprador', { waitUntil: 'networkidle' });

      // A tagline pode sair — é o que não cabe. Estes três não.
      await expect(page.locator('.brand-mark')).toBeVisible();
      await expect(page.locator('.brand-word')).toBeVisible();
      await expect(page.locator('.brand-word')).toHaveText(/KIXIMA/);
      await expect(page.locator('.nav-search input')).toBeVisible();

      // A pesquisa tem de ser utilizável, não apenas existir: um campo com 60px
      // e um botão de 44px lá dentro está tecnicamente visível e serve para
      // nada. Foi por isto que a barra passou a duas linhas.
      const l = await page.locator('.nav-search input').evaluate((e) => e.getBoundingClientRect().width);
      expect(l, `campo de pesquisa com ${Math.round(l)}px é estreito de mais para escrever`).toBeGreaterThan(150);

      await ctx.close();
    });
  }
});

test.describe('Desktop continua congelado', () => {
  test('na fronteira dos 760px a barra mantém a altura e uma só linha', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: FRONTEIRA, height: 900 },
      storageState: sessaoDe('comprador'),
    });
    const page = await ctx.newPage();
    await page.goto('/comprador', { waitUntil: 'networkidle' });

    // 62px é a altura de desktop. Se isto mudar, a camada mobile escorregou
    // para dentro do território protegido.
    const altura = await page.locator('.navbar').evaluate((e) => Math.round(e.getBoundingClientRect().height));
    expect(altura).toBe(62);

    // E a tagline volta a aparecer: é o sinal de que a regra parou nos 759.
    await expect(page.locator('.navbar .brand-sub')).toBeVisible();
    await ctx.close();
  });

  test('a 759px a barra já é a de mobile', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 759, height: 900 },
      storageState: sessaoDe('comprador'),
    });
    const page = await ctx.newPage();
    await page.goto('/comprador', { waitUntil: 'networkidle' });
    const altura = await page.locator('.navbar').evaluate((e) => Math.round(e.getBoundingClientRect().height));
    expect(altura).toBeGreaterThan(62);
    await expect(page.locator('.navbar .brand-sub')).toBeHidden();
    await ctx.close();
  });
});
