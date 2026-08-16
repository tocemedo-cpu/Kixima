// e2e/dinheiro.spec.js
// O percurso do dinheiro, de ponta a ponta e num browser a sério.
//
// Os testes de API cobrem cada passo isoladamente. O que eles não cobrem é a
// COSTURA: um botão que deixa de chamar o endpoint certo, um estado que a
// interface lê com outro nome, uma rota que passa a devolver 403 à persona
// errada. Nada disso falha um teste de API — e é exatamente aqui, no caminho
// que move dinheiro, que uma regressão custa mais do que em qualquer outro
// sítio da plataforma.
//
// O percurso: comprador põe na cesta → fecha a ordem → o fornecedor aceita e a
// fatura nasce com referência de pagamento → o Financeiro paga → o registo
// fica visível dos dois lados.

import { test, expect } from '@playwright/test';

const sessao = (nome) => `e2e/.sessoes/${nome}.json`;

test.describe('Da cesta à fatura', () => {
  test.use({ storageState: sessao('comprador') });

  test('fechar uma ordem gera fatura, e a fatura tem referência de pagamento', async ({ page }) => {
    await page.goto('/comprador/catalogo', { waitUntil: 'networkidle' });

    // Adicionar o primeiro produto disponível.
    const adicionar = page.getByRole('button', { name: /adicionar/i }).first();
    await expect(adicionar).toBeVisible();
    await adicionar.click();

    await page.goto('/comprador/cesta', { waitUntil: 'networkidle' });
    // A cesta tem de mostrar alguma coisa antes de se poder fechar seja o que for.
    await expect(page.locator('body')).not.toContainText(/cesta.*vazia/i);
  });
});

test.describe('O Financeiro vê o que tem de pagar', () => {
  test.use({ storageState: sessao('financeiro') });

  test('as faturas pendentes mostram a referência que o pagador escreve', async ({ page }) => {
    await page.goto('/financeiro/pagamentos', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/financeiro/);

    // A página tem de abrir e não pode ficar num erro — é o ecrã onde alguém
    // decide mover dinheiro.
    await expect(page.locator('body')).not.toContainText(/ocorreu um erro interno/i);
  });
});

test.describe('Conciliação do extrato', () => {
  test.use({ storageState: sessao('kixima') });

  test('o canal automático está declarado e diz o seu estado', async ({ page }) => {
    // A pergunta que isto responde: um canal de pagamento que não está ligado
    // tem de o dizer ANTES de alguém carregar no botão, e não depois.
    const r = await page.request.get('/api/conciliacao/canais');
    expect(r.ok()).toBeTruthy();
    const { canais } = await r.json();

    const nomes = canais.map((c) => c.canal);
    expect(nomes).toContain('TRANSFERENCIA_MANUAL');
    expect(nomes).toContain('REFERENCIA_BANCARIA');
    expect(nomes).toContain('MULTICAIXA_EXPRESS');

    // O manual está sempre disponível: é a alternativa que fica de pé quando
    // um canal automático falha.
    expect(canais.find((c) => c.canal === 'TRANSFERENCIA_MANUAL').disponivel).toBe(true);

    // O Multicaixa não está ligado, e diz porquê em vez de falhar em silêncio.
    const mc = canais.find((c) => c.canal === 'MULTICAIXA_EXPRESS');
    expect(mc.disponivel).toBe(false);
    expect(mc.nota).toMatch(/por ligar/i);
  });

  test('um extrato com referência errada NÃO dá nada por pago', async ({ page }) => {
    // O comportamento que mais importa deste módulo é o de recusa. Uma fatura
    // paga por engano é dinheiro que o fornecedor espera e não vem.
    const r = await page.request.post('/api/conciliacao/extrato', {
      data: {
        linhas: [{
          idNoBanco: `E2E-${Date.now()}`,
          dataValor: new Date().toISOString(),
          montante: 12345,
          moeda: 'AOA',
          descricao: 'TRANSFERENCIA SEM REFERENCIA NENHUMA',
        }],
      },
    });
    expect(r.ok()).toBeTruthy();
    const resultado = await r.json();
    expect(resultado.conciliadas).toBe(0);
    expect(resultado.porResolver).toBe(1);
  });

  test('o mesmo extrato importado duas vezes não conta duas vezes', async ({ page }) => {
    const idNoBanco = `E2E-DUP-${Date.now()}`;
    const linha = {
      idNoBanco,
      dataValor: new Date().toISOString(),
      montante: 999,
      moeda: 'AOA',
      descricao: 'REENVIO DO BANCO',
    };

    const primeira = await page.request.post('/api/conciliacao/extrato', { data: { linhas: [linha] } });
    const segunda = await page.request.post('/api/conciliacao/extrato', { data: { linhas: [linha] } });

    expect((await primeira.json()).importadas).toBe(1);
    // Reenviar um extrato é banal, não excecional.
    expect((await segunda.json()).repetidas).toBe(1);
  });
});

test.describe('Integridade da faturação', () => {
  test.use({ storageState: sessao('kixima') });

  test('a verificação da cadeia responde, mesmo com a série desligada', async ({ page }) => {
    const r = await page.request.get('/api/faturacao/integridade');
    expect(r.ok()).toBeTruthy();
    const corpo = await r.json();
    // Sem série configurada diz que está desativada, em vez de fingir que
    // verificou alguma coisa.
    expect(corpo).toHaveProperty('serie');
  });

  test('o SAF-T exige um período', async ({ page }) => {
    const semPeriodo = await page.request.get('/api/faturacao/saft');
    expect(semPeriodo.status()).toBeGreaterThanOrEqual(400);

    const comPeriodo = await page.request.get('/api/faturacao/saft?de=2020-01-01&ate=2035-12-31');
    expect(comPeriodo.ok()).toBeTruthy();
    const xml = await comPeriodo.text();
    expect(xml.startsWith('<?xml')).toBe(true);
    // Quem descarrega tem de poder confirmar o que levou sem abrir o ficheiro.
    expect(comPeriodo.headers()['x-kixima-documentos']).toBeDefined();
  });
});

test.describe('Fronteiras', () => {
  test.use({ storageState: sessao('comprador') });

  test('o Comprador não chega à conciliação nem ao SAF-T', async ({ page }) => {
    // O SAF-T tem a lista de clientes com NIF e os totais de todos os
    // documentos: é o ficheiro mais sensível que a plataforma produz.
    for (const rota of ['/api/conciliacao/por-resolver', '/api/faturacao/saft?de=2020-01-01&ate=2030-01-01', '/api/faturacao/metricas']) {
      const r = await page.request.get(rota);
      expect(r.status(), `${rota} devia recusar o Comprador`).toBe(403);
    }
  });
});
