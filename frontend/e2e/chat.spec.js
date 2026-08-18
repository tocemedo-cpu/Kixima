// e2e/chat.spec.js
// Chat de Suporte, Chat Comercial e o isolamento entre empresas — num browser
// a sério, contra o servidor real (incluindo o Socket.IO). Os testes de
// integração do backend (tests/chat.test.js) já provam as regras de negócio
// pela API; isto prova a junta: que o botão certo chama a rota certa e que a
// mensagem chega ao outro lado SEM recarregar a página.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const sessao = (nome) => `e2e/.sessoes/${nome}.json`;
const PRODUTO_KIANDA = 'fef4c884-aea0-42e7-abe6-6068545004bc'; // fornecedor@kianda.co.ao

// Ligação da mesma base que os servidores de e2e usam — sem credencial
// nenhuma escrita à mão aqui. Em CI vem diretamente do ambiente (o workflow
// define DATABASE_URL, não há .env nenhum no runner); em desenvolvimento
// local lê-se do .env do backend, exatamente como o backend faz.
function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(new URL('../../backend/.env', import.meta.url), 'utf8');
  const linha = env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
  return linha.slice('DATABASE_URL='.length).trim();
}

// "Empresa C" — uma terceira empresa sem relação nenhuma com A (comprador) ou
// B (fornecedor), criada e destruída só para o teste de isolamento. Sempre
// EFÉMERA: criada no beforeAll, apagada no afterAll deste describe, para não
// deixar dados a mais na base de desenvolvimento.
const EMPRESA_C_ID = 'e2e-empresa-c';
const USER_C_ID = 'e2e-user-c';
const EMAIL_C = 'comprador.empresac.e2e@empresac-e2e.co.ao';
const HASH_KIXIMA123 = '$2a$10$uQvbVfqwhCCoakNvvoPrCumlP8p93Jjb3ipgB7vkS2nKsjMdN48BW'; // 'Kixima@123', reaproveitado do seed

function psql(sql) {
  execFileSync('psql', [databaseUrl(), '-v', 'ON_ERROR_STOP=1', '-c', sql], { stdio: 'pipe' });
}

test.describe('Chat de Suporte', () => {
  const assunto = `E2E Suporte ${Date.now()}`;

  test('cliente abre um pedido e envia mensagem', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: sessao('comprador') });
    try {
      const page = await ctx.newPage();
      await page.goto('/suporte/chat');
      await page.click('text=+ Novo Pedido');
      await page.fill('input[placeholder="Resumo do problema"]', assunto);
      await page.fill('textarea', 'Preciso de ajuda com uma fatura pendente.');
      await page.click('button:has-text("Iniciar Conversa")');
      // A conversa abre-se sozinha depois de criada.
      await expect(page.locator('.chat-thread-head strong', { hasText: assunto })).toBeVisible({ timeout: 10000 });
      await page.fill('.chat-input', 'Olá, alguém pode ajudar?');
      await page.click('.chat-composer button:has-text("Enviar")');
      await expect(page.locator('.chat-bubble', { hasText: 'Olá, alguém pode ajudar?' })).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test('agente (Super Admin) vê o pedido na fila, assume-o e responde — o cliente recebe SEM recarregar', async ({ browser }) => {
    const ctxAgente = await browser.newContext({ storageState: sessao('kixima') });
    const ctxCliente = await browser.newContext({ storageState: sessao('comprador') });
    try {
      const paginaAgente = await ctxAgente.newPage();
      await paginaAgente.goto('/suporte/chat');
      await expect(paginaAgente.locator('.chat-list-item', { hasText: assunto })).toBeVisible({ timeout: 10000 });
      await paginaAgente.click(`.chat-list-item:has-text("${assunto}")`);
      await paginaAgente.click('button:has-text("Assumir")');
      await expect(paginaAgente.locator('.chat-agent-actions button:has-text("Assumir")')).toHaveCount(0);

      // O cliente já está com a conversa aberta, à espera — a resposta do agente
      // tem de chegar por Socket.IO, sem F5.
      const paginaCliente = await ctxCliente.newPage();
      await paginaCliente.goto('/suporte/chat');
      await paginaCliente.click(`.chat-list-item:has-text("${assunto}")`);
      await expect(paginaCliente.locator('.chat-thread-head strong', { hasText: assunto })).toBeVisible();

      await paginaAgente.fill('.chat-input', 'Pode indicar o número da fatura?');
      await paginaAgente.click('.chat-composer button:has-text("Enviar")');

      await expect(paginaCliente.locator('.chat-bubble', { hasText: 'Pode indicar o número da fatura?' }))
        .toBeVisible({ timeout: 15000 });
    } finally {
      await ctxAgente.close();
      await ctxCliente.close();
    }
  });
});

// .serial: os três testes partilham uma conversa (urlConversa) — sem ordem
// garantida, um a mexer primeiro na sessão errada corrompe os outros. Falhar
// o primeiro salta os dependentes em vez de os deixar correr sobre estado que
// nunca existiu.
test.describe.serial('Chat Comercial', () => {
  const nonce = Date.now();
  const perguntaInicial = `Bom dia, qual o prazo de entrega deste produto? (e2e ${nonce})`;
  const respostaFornecedor = `Bom dia! O prazo é de 10 dias úteis. (e2e ${nonce})`;
  let urlConversa;

  test.beforeAll(() => {
    psql(`INSERT INTO companies (id, name, tax_id, type, status, contact_email, approved_at, plan, search_rank, created_at, updated_at)
          VALUES ('${EMPRESA_C_ID}', 'Empresa C E2E, Lda', 'AO-E2E-9999', 'CLIENTE', 'APROVADA', 'c@empresac-e2e.co.ao', now(), 'CORE', 1, now(), now())
          ON CONFLICT (id) DO NOTHING;`);
    psql(`INSERT INTO users (id, name, email, password_hash, role, company_id, active, created_at, updated_at)
          VALUES ('${USER_C_ID}', 'Utilizador Empresa C (E2E)', '${EMAIL_C}', '${HASH_KIXIMA123}', 'COMPRADOR', '${EMPRESA_C_ID}', true, now(), now())
          ON CONFLICT (id) DO NOTHING;`);
  });

  test.afterAll(() => {
    psql(`DELETE FROM users WHERE id = '${USER_C_ID}';`);
    psql(`DELETE FROM companies WHERE id = '${EMPRESA_C_ID}';`);
  });

  test('comprador inicia a conversa a partir da ficha do produto', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: sessao('comprador') });
    try {
      const page = await ctx.newPage();
      await page.goto(`/comprador/catalogo/${PRODUTO_KIANDA}`);
      await page.click('text=Falar com o fornecedor');
      await page.waitForURL(/\/mensagens\/chat-comercial\?c=/, { timeout: 10000 });
      urlConversa = page.url();

      await page.fill('.chat-input', perguntaInicial);
      await page.click('.chat-composer button:has-text("Enviar")');
      await expect(page.locator('.chat-bubble', { hasText: perguntaInicial })).toBeVisible();
      // O aviso de Trust & Safety aparece sempre no Chat Comercial.
      await expect(page.locator('.chat-safety-notice')).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test('fornecedor vê a conversa e responde — o comprador recebe SEM recarregar', async ({ browser }) => {
    const ctxFornecedor = await browser.newContext({ storageState: sessao('fornecedor') });
    const ctxComprador = await browser.newContext({ storageState: sessao('comprador') });
    try {
      const paginaFornecedor = await ctxFornecedor.newPage();
      await paginaFornecedor.goto('/mensagens/chat-comercial');
      await expect(paginaFornecedor.locator('.chat-list-item', { hasText: 'Petro Angola' })).toBeVisible({ timeout: 10000 });
      await paginaFornecedor.click('.chat-list-item:has-text("Petro Angola")');
      await expect(paginaFornecedor.locator('.chat-bubble', { hasText: perguntaInicial })).toBeVisible();

      const paginaComprador = await ctxComprador.newPage();
      await paginaComprador.goto(urlConversa);
      await expect(paginaComprador.locator('.chat-bubble', { hasText: perguntaInicial })).toBeVisible();

      await paginaFornecedor.fill('.chat-input', respostaFornecedor);
      await paginaFornecedor.click('.chat-composer button:has-text("Enviar")');

      await expect(paginaComprador.locator('.chat-bubble', { hasText: respostaFornecedor })).toBeVisible({ timeout: 15000 });
    } finally {
      await ctxFornecedor.close();
      await ctxComprador.close();
    }
  });

  test('Isolamento — a Empresa C não vê nem acede à conversa A↔B', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type=email]', EMAIL_C);
    await page.fill('input[type=password]', 'Kixima@123');
    await page.click('button[type=submit]');
    await page.waitForURL(/\/comprador/);

    // A lista de conversas da Empresa C não inclui a conversa entre A e B.
    await page.goto('/mensagens/chat-comercial');
    await expect(page.locator('.chat-list-item', { hasText: 'Petro Angola' })).toHaveCount(0);
    await expect(page.locator('.chat-list-item', { hasText: 'Kianda' })).toHaveCount(0);

    // Nem seguindo o link direto: o backend nega (404), o frontend não mostra
    // mensagem nenhuma — fica no "escolha uma conversa".
    await page.goto(urlConversa);
    await expect(page.locator('.chat-bubble')).toHaveCount(0);
    await expect(page.locator('.chat-placeholder')).toBeVisible();
  });
});
