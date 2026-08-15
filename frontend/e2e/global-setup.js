// e2e/global-setup.js
// Prepara as sessões UMA vez, antes de qualquer teste. Ver e2e/sessoes.js para
// o motivo (o limite de tentativas de autenticação).
import { mkdirSync } from 'node:fs';
import { guardarSessao, CONTAS } from './sessoes.js';

export default async function globalSetup(config) {
  const baseURL = config.projects[0].use.baseURL;
  mkdirSync('e2e/.sessoes', { recursive: true });
  for (const [nome, email] of Object.entries(CONTAS)) {
    await guardarSessao(email, `e2e/.sessoes/${nome}.json`, baseURL);
  }
}
