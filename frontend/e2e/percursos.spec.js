// e2e/percursos.spec.js
// Os percursos que atravessam as duas metades da plataforma.
//
// Os 496 testes do backend cobrem a API e as regras de negócio a fundo. Nenhum
// deles abre uma página, e é por isso que estes existem: o que parte em
// silêncio é a junta — um botão que deixa de chamar o endpoint certo, uma rota
// que passa a devolver 403 à persona errada, um formulário que envia o campo
// com o nome antigo. Nada disso falha um teste de API, e nada disso se vê ao
// ler o diff.
//
// São quatro, e são estes quatro porque é por aqui que passa o dinheiro:
// entrar, pedir e aprovar uma compra, pagar com comprovativo, subscrever.
import { test, expect } from '@playwright/test';

const SENHA = 'Kixima@123';
const sessao = (nome) => `e2e/.sessoes/${nome}.json`;

// Um PDF válido de verdade: desde a verificação de assinaturas (RA-3), um
// buffer qualquer é recusado — e é suposto ser.
const COMPROVATIVO = Buffer.from('%PDF-1.4 comprovativo de transferencia');

// Estes testes fazem login e logout à mão, e usam de propósito uma persona que
// mais nenhum teste deste ficheiro usa: o "Sair" da plataforma termina a sessão
// em TODOS os dispositivos (revoga os tokens emitidos), por isso sair aqui
// mataria também a sessão guardada que os outros testes reutilizam. Foi
// exatamente o que aconteceu à primeira — e a falha aparecia no teste seguinte,
// não neste.
test.describe('Entrar', () => {
  test('com credenciais certas, entra e a sessão sobrevive ao recarregamento', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type=email]', 'fornecedor@kianda.co.ao');
    await page.fill('input[type=password]', SENHA);
    await page.click('button[type=submit]');
    await page.waitForURL(/\/fornecedor/);

    // A sessão está num cookie httpOnly: o JavaScript da página não lhe toca.
    // Se algum dia voltar para o localStorage, este teste dá por isso.
    const legivelPeloJs = await page.evaluate(() => document.cookie.includes('kixima_sessao'));
    expect(legivelPeloJs).toBe(false);
    const tokensGuardados = await page.evaluate(() => Object.keys(localStorage).filter((k) => /token/i.test(k)));
    expect(tokensGuardados).toEqual([]);

    await page.reload();
    await expect(page).toHaveURL(/\/fornecedor/);
  });

  test('com a senha errada, diz que está errada e não entra', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type=email]', 'fornecedor@kianda.co.ao');
    await page.fill('input[type=password]', 'isto-nao-e-a-senha');
    await page.click('button[type=submit]');
    await expect(page.locator('.banner-error, .error-text')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('sair termina mesmo a sessão', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type=email]', 'fornecedor@kianda.co.ao');
    await page.fill('input[type=password]', SENHA);
    await page.click('button[type=submit]');
    await page.waitForURL(/\/fornecedor/);
    await page.click('text=Sair');
    await page.waitForURL(/\/login/);

    // E a página autenticada deixa mesmo de abrir — não basta o menu mudar.
    await page.goto('/fornecedor');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Comprar', () => {
  test.use({ storageState: sessao('comprador') });

  // O catálogo de PRODUTOS, e não o Explorar: no Explorar o primeiro resultado
  // costuma ser um serviço, e um serviço não se põe na cesta — pede-se cotação.
  // São dois caminhos diferentes e este teste é sobre o da cesta.
  test('do catálogo à cesta', async ({ page }) => {
    // Parte-se de uma cesta vazia para a asserção do fim significar alguma
    // coisa: com itens de uma execução anterior, o teste passava sem ter feito
    // nada.
    await page.goto('/comprador/cesta');
    await page.waitForTimeout(1500);
    const limpar = page.locator('button:has-text("Remover"), button:has-text("Esvaziar")');
    while (await limpar.count() > 0) {
      await limpar.first().click();
      await page.waitForTimeout(800);
    }

    await page.goto('/comprador/catalogo');
    await page.waitForSelector('button:has-text("Adicionar à Cesta")', { timeout: 20000 });
    await page.locator('button:has-text("Adicionar à Cesta")').first().click();
    await page.waitForTimeout(1800);

    await page.goto('/comprador/cesta');
    await page.waitForTimeout(1800);
    await expect(page.locator('text=A sua cesta está vazia')).toHaveCount(0);
  });

  test('a página de um produto abre e deixa adicionar', async ({ page }) => {
    await page.goto('/comprador/catalogo');
    await page.waitForSelector('main a[href*="/comprador/catalogo/"]', { timeout: 20000 });
    await page.locator('main a[href*="/comprador/catalogo/"]').first().click();
    await page.waitForURL(/\/comprador\/catalogo\/[0-9a-f-]{36}/);
    // Esperar pelo URL não chega: o endereço muda antes de a lista sair do
    // ecrã, e nesse intervalo os botões "Adicionar à Cesta" dos cartões da
    // lista ainda lá estão. Espera-se por algo que SÓ existe no detalhe.
    await expect(page.locator('button:has-text("Voltar ao catálogo")')).toBeVisible();
    await expect(page.locator('button:has-text("Adicionar à cesta")')).toHaveCount(1);
  });
});

test.describe('Pagar uma fatura', () => {
  test.use({ storageState: sessao('financeiro') });

  test('exige o comprovativo — e recusa um ficheiro que não é o que diz ser', async ({ page }) => {
    await page.goto('/financeiro/faturas');
    await page.waitForTimeout(2000);

    const pagar = page.locator('button:has-text("Pagar")').first();
    if (await pagar.count() === 0) test.skip(true, 'sem faturas pendentes nos dados de demonstração');

    await pagar.click();
    await page.waitForTimeout(1000);

    // Um executável renomeado para .pdf tem de ser recusado (RA-3).
    const campo = page.locator('input[type=file]').first();
    await campo.setInputFiles({
      name: 'comprovativo.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00]),   // MZ — um executável
    });
    await page.locator('button:has-text("Confirmar pagamento")').click();
    await page.waitForTimeout(2500);

    // A mensagem tem de dizer o que se recebeu, e não só que foi recusado
    // (RA-3): quem envia um PDF corrompido e quem renomeia um ficheiro
    // precisam de saber qual dos dois foi.
    await expect(page.locator('text=/não é de nenhum formato reconhecido|conteúdo é/i').first()).toBeVisible();
  });
});

test.describe('Subscrever um plano', () => {
  test.use({ storageState: sessao('admin') });

  test('pedir, ver a cobrança e carregar o comprovativo', async ({ page }) => {
    await page.goto('/empresa/assinatura');
    await page.waitForSelector('text=Plano atual', { timeout: 20000 });

    // Se ficou uma cobrança de uma execução anterior, cancela-se primeiro: o
    // servidor só permite uma em aberto de cada vez.
    const cancelar = page.locator('button:has-text("Cancelar cobrança")');
    if (await cancelar.count() > 0) {
      page.once('dialog', (d) => d.accept('limpeza do teste'));
      await cancelar.click();
      await page.waitForTimeout(2000);
    }

    const subir = page.locator('button:has-text("Subir para este plano")').first();
    if (await subir.count() === 0) test.skip(true, 'sem plano acima do atual');
    await subir.click();
    await page.waitForTimeout(2500);

    // A cobrança aparece com referência e o plano AINDA NÃO mudou: é a regra
    // central do fluxo e é aqui que se vê pelos olhos de quem a usa.
    await expect(page.locator('text=/SUB-\\d{4}-\\d{6}/').first()).toBeVisible();
    await expect(page.locator('text=Por pagar').first()).toBeVisible();

    await page.locator('input[type=file]').first().setInputFiles({
      name: 'transferencia.pdf',
      mimeType: 'application/pdf',
      buffer: COMPROVATIVO,
    });
    await page.waitForTimeout(3000);
    // O upload multipart leva o cookie de sessão — se não levasse, isto era 401.
    await expect(page.locator('text=Aguarda confirmação da KIXIMA')).toBeVisible();
  });
});

test.describe('A KIXIMA confirma', () => {
  test.use({ storageState: sessao('kixima') });

  test('a cobrança com comprovativo aparece na fila por confirmar', async ({ page }) => {
    await page.goto('/sistema/cobrancas');
    await page.waitForSelector('text=Cobranças de subscrição', { timeout: 20000 });
    // Só a KIXIMA vê esta página, e é o único sítio onde um plano pago fica ativo.
    await expect(page.locator('text=Por confirmar').first()).toBeVisible();
  });
});

test.describe('Fronteiras entre personas', () => {
  test.use({ storageState: sessao('comprador') });

  test('o Comprador não chega às cobranças da KIXIMA', async ({ page }) => {
    await page.goto('/sistema/cobrancas');
    await page.waitForTimeout(1500);
    // Não fica na página: o router devolve-o ao seu próprio painel.
    await expect(page).not.toHaveURL(/\/sistema\/cobrancas/);
  });
});
