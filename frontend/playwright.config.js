// playwright.config.js
// Testes de percurso e de acessibilidade, num browser a sério.
//
// Os 480 testes do backend cobrem a API e as regras de negócio a fundo. Nenhum
// deles abre uma página. Os percursos que partem em silêncio são precisamente
// os que atravessam as duas metades — um botão que deixa de chamar o endpoint
// certo, uma rota que passa a devolver 403 à persona errada, um campo que fica
// sem rótulo. Nada disso falha um teste de API.
//
// NÃO se descarregam browsers: o Chromium já está instalado na imagem e o
// caminho vem de PLAYWRIGHT_BROWSERS_PATH. Um `playwright install` aqui só
// gastava rede e disco.
import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';

// O Chromium desta imagem, se lá estiver. Devolve null quando não está, para o
// Playwright usar o seu próprio (é o que acontece numa máquina normal).
function defaultChromium() {
  const caminho = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  return existsSync(caminho) ? caminho : null;
}

export default defineConfig({
  testDir: './e2e',
  // Entra uma vez por persona e guarda a sessão — ver e2e/sessoes.js.
  globalSetup: './e2e/global-setup.js',
  // Um percurso completo (entrar → cotação → ordem → pagamento) passa por várias
  // páginas e vários pedidos; 30 s é apertado e produz falhas que não são bugs.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Em série: os testes partilham a mesma base de dados de demonstração e
  // mexem em estado real (planos, cobranças, stock). Em paralelo, apanhavam-se
  // uns aos outros e as falhas seriam impossíveis de reproduzir.
  workers: 1,
  fullyParallel: false,
  // Repetir uma vez na integração contínua: distingue um teste instável de uma
  // regressão a sério, sem esconder a instabilidade (fica no relatório).
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE,
    // Só guarda o rasto quando falha: um vídeo de cada passagem enche o disco
    // e ninguém o vê.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'pt-PT',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // O Chromium já vem na imagem. Quando a versão do @playwright/test
          // não corresponde exatamente à do browser instalado, o Playwright
          // procura um caminho que não existe e manda correr
          // `playwright install` — que aqui só gastava rede e disco para
          // descarregar um browser que já cá está.
          //
          // PLAYWRIGHT_CHROMIUM_PATH permite a um ambiente diferente (a
          // integração contínua, a máquina de alguém) usar o seu próprio
          // browser sem tocar neste ficheiro.
          ...(process.env.PLAYWRIGHT_CHROMIUM_PATH || defaultChromium()
            ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || defaultChromium() }
            : {}),
        },
      },
    },
  ],
});
