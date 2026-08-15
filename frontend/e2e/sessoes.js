// e2e/sessoes.js
// Sessões reutilizadas entre testes.
//
// PORQUE NÃO SE ENTRA EM CADA TESTE. O servidor limita as tentativas de
// autenticação a 20 por 15 minutos (e agora bloqueia a conta ao fim de 5
// falhas). Uma suite que faz login em cada teste começa a receber "Demasiados
// pedidos" a meio da execução, e as falhas que daí vêm parecem bugs da
// aplicação — quando são a suite a atacar-se a si própria.
//
// A alternativa seria desligar o limite em testes. Não se faz: era uma variável
// que desliga uma proteção, a viver no mesmo sítio que a produção, e a
// distância entre "desligado nos testes" e "desligado sem querer" é um erro de
// configuração.
import { chromium } from '@playwright/test';
import { existsSync, statSync } from 'node:fs';

export const SENHA = 'Kixima@123';
export const CONTAS = {
  comprador: 'comprador@petroangola.co.ao',
  admin: 'admin@petroangola.co.ao',
  financeiro: 'financeiro@petroangola.co.ao',
  fornecedor: 'fornecedor@kianda.co.ao',
  kixima: 'admin@kixima.co.ao',
};

const CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/**
 * A sessão guardada ainda serve?
 *
 * Reaproveitar poupa um login por persona em cada execução. Não é avareza: é a
 * mesma razão de existir deste ficheiro — cada login gasta orçamento do limite
 * por IP, e correr a suite três vezes seguidas esgotava-o.
 */
async function aindaServe(ficheiro, baseURL) {
  if (!existsSync(ficheiro)) return false;
  // Uma sessão de ontem pode ter expirado ou ter sido revogada por um "Sair".
  if (Date.now() - statSync(ficheiro).mtimeMs > 30 * 60 * 1000) return false;
  const browser = await chromium.launch(existsSync(CHROMIUM) ? { executablePath: CHROMIUM } : {});
  try {
    const ctx = await browser.newContext({ storageState: ficheiro, baseURL });
    const r = await ctx.request.get(`${baseURL.replace('5173', '4000')}/api/auth/me`);
    return r.ok();
  } catch {
    return false;
  } finally {
    await browser.close();
  }
}

/** Entra uma vez e guarda o estado, para os testes seguintes o reutilizarem. */
export async function guardarSessao(email, ficheiro, baseURL) {
  if (await aindaServe(ficheiro, baseURL)) return;
  const browser = await chromium.launch(
    existsSync(CHROMIUM) ? { executablePath: CHROMIUM } : {},
  );
  const page = await browser.newPage({ baseURL });
  await page.goto(`${baseURL}/login`);
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', SENHA);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/(comprador|empresa|fornecedor|financeiro|sistema)/, { timeout: 20000 });
  // A sessão vive no localStorage — o storageState leva-o.
  await page.context().storageState({ path: ficheiro });
  await browser.close();
}
