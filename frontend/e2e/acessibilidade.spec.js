// e2e/acessibilidade.spec.js
// Auditoria automática de acessibilidade (axe, WCAG 2.1 A + AA).
//
// Existe porque a acessibilidade regride em silêncio: ninguém abre um leitor de
// ecrã ao rever um pull request, e um campo novo sem rótulo tem exatamente o
// mesmo aspeto de um campo com rótulo. Aqui, tem aspeto de teste vermelho.
//
// A ISENÇÃO DO LOGÓTIPO. O `brand-word` (a palavra KIXIMA em vermelho sobre a
// barra escura) não passa o contraste, e fica assim de propósito: a norma
// isenta expressamente o texto que faz parte de um logótipo ou nome de marca
// (WCAG 1.4.3, "Logotypes"). A isenção está escrita AQUI, e não subentendida —
// se um dia alguém puser texto normal com essa classe, este teste deixa de a
// cobrir por acidente.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function analisar(page) {
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Ver a nota sobre a isenção de logótipos no topo do ficheiro.
    .exclude('.brand-word')
    .analyze();
  return r.violations;
}

const PUBLICAS = [['login', '/login'], ['planos', '/planos'], ['cadastro', '/cadastro']];

for (const [nome, caminho] of PUBLICAS) {
  test(`sem barreiras: ${nome}`, async ({ page }) => {
    await page.goto(caminho);
    await page.waitForTimeout(800);
    const violacoes = await analisar(page);
    expect(violacoes.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
  });
}

// A LISTA É O QUE ESTÁ VIGIADO. Fora dela, a acessibilidade regride sem
// ninguém dar por isso — que é exatamente o que este ficheiro existe para
// impedir. Eram quatro páginas autenticadas; uma varredura manual em 26 páginas
// encontrou um defeito real (o emblema "pendente", 2,62:1) numa página que não
// estava aqui. A lição não foi "corrigir o emblema" — foi que a lista era
// curta de mais para o número de páginas que a aplicação tem.
//
// Cobre-se agora pelo menos uma página de cada PERSONA e de cada tipo de ecrã:
// listagem, formulário, detalhe e painel. Não são as 81 páginas — são as que,
// se regredirem, levam as outras atrás por partilharem os mesmos componentes.
const AUTENTICADAS = [
  // Comprador
  ['comprador', 'comprador', '/comprador'],
  ['explorar', 'comprador', '/comprador/explorar'],
  ['catálogo', 'comprador', '/comprador/catalogo'],
  ['ordens do comprador', 'comprador', '/comprador/ordens'],
  ['cesta', 'comprador', '/comprador/cesta'],
  ['perfil', 'comprador', '/perfil'],
  // Fornecedor — foi aqui que o emblema ilegível apareceu.
  ['painel do fornecedor', 'fornecedor', '/fornecedor'],
  ['ordens do fornecedor', 'fornecedor', '/fornecedor/ordens'],
  ['faturas do fornecedor', 'fornecedor', '/fornecedor/faturas'],
  ['catálogo do fornecedor', 'fornecedor', '/fornecedor/catalogo'],
  // Administração da empresa
  ['subscrição', 'admin', '/empresa/assinatura'],
  ['utilizadores', 'admin', '/empresa/utilizadores'],
  ['contratos', 'admin', '/empresa/contratos'],
  // Financeiro
  ['centro financeiro', 'financeiro', '/financeiro'],
  ['faturas a pagar', 'financeiro', '/financeiro/faturas'],
  // KIXIMA
  ['painel do sistema', 'kixima', '/sistema'],
  ['planos e subscrições', 'kixima', '/sistema/planos'],
  ['cobranças', 'kixima', '/sistema/cobrancas'],
  ['auditoria', 'kixima', '/sistema/auditoria'],
  ['prontidão', 'kixima', '/sistema/prontidao'],
];

for (const [nome, conta, caminho] of AUTENTICADAS) {
  test.describe(nome, () => {
    test.use({ storageState: `e2e/.sessoes/${conta}.json` });
    test(`sem barreiras: ${nome}`, async ({ page }) => {
      await page.goto(caminho);
      await page.waitForTimeout(1200);
      const violacoes = await analisar(page);
      expect(violacoes.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
    });
  });
}

test.describe('teclado', () => {
  test.use({ storageState: 'e2e/.sessoes/comprador.json' });
  test('o salto para o conteúdo funciona com teclado', async ({ page }) => {
    await page.goto('/comprador');
    // Espera a hidratação antes de carregar na tecla: sem isto o Tab chega
    // antes de haver alguma coisa focável e o teste falha por corrida, não por
    // regressão.
    await page.locator('.skip-link').waitFor({ state: 'attached' });
    // Primeiro Tab a partir do topo: tem de cair no salto, senão quem usa
    // teclado percorre a barra lateral inteira em cada página.
    await page.keyboard.press('Tab');
    const focado = await page.evaluate(() => document.activeElement?.className || '');
    expect(focado).toContain('skip-link');

    await page.keyboard.press('Enter');
    const destino = await page.evaluate(() => document.activeElement?.id || location.hash);
    expect(String(destino)).toContain('conteudo');
  });
});
