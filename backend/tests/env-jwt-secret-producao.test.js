// tests/env-jwt-secret-producao.test.js
// O guardião de arranque em produção (src/config/env.js) recusava só ''
// e 'CHANGE_ME' — nunca 'troque-este-valor', que é EXATAMENTE o valor que o
// .env.example do próprio projeto distribui, nem validava um comprimento
// mínimo. Um deploy que copiasse o .env.example sem trocar o JWT_SECRET
// arrancava normalmente com um segredo público no repositório: dava para
// forjar um JWT de qualquer utilizador, incluindo Admin do Sistema.
//
// env.js lança no TOPO do módulo (avaliado ao fazer require) — por isso cada
// caso corre num subprocesso Node à parte, com o seu próprio NODE_ENV/
// JWT_SECRET, em vez de tentar isolar `require` dentro do próprio processo
// de teste (que já correu env.js uma vez, em modo 'test', ao arrancar).
const { execFileSync } = require('child_process');
const path = require('path');

function tentaCarregar(env) {
  const script = `
    try {
      require('${path.join(__dirname, '..', 'src', 'config', 'env.js')}');
      console.log('OK');
    } catch (e) {
      console.log('LANCOU:' + e.message);
    }
  `;
  return execFileSync(process.execPath, ['-e', script], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      // Storage também é obrigatório em produção (ver
      // env-storage-s3-producao.test.js) — presente aqui só para isolar o
      // que este ficheiro testa (JWT_SECRET) do guardião de storage.
      STORAGE_PROVIDER: 's3', STORAGE_BUCKET: 'kixima', STORAGE_ACCESS_KEY: 'ak', STORAGE_SECRET_KEY: 'sk',
      ...env,
    },
    encoding: 'utf8',
    timeout: 30_000,
  });
}

describe('Guardião de JWT_SECRET em produção', () => {
  test('recusa o valor de exemplo do .env.example ("troque-este-valor")', () => {
    const saida = tentaCarregar({ JWT_SECRET: 'troque-este-valor' });
    expect(saida).toContain('LANCOU');
    expect(saida).toMatch(/valor de exemplo/);
  });

  test('recusa "CHANGE_ME" (comportamento já existente, continua a valer)', () => {
    const saida = tentaCarregar({ JWT_SECRET: 'CHANGE_ME' });
    expect(saida).toContain('LANCOU');
  });

  test('recusa um segredo curto, mesmo que não seja um placeholder conhecido', () => {
    const saida = tentaCarregar({ JWT_SECRET: 'segredo-curto-demais' }); // 21 caracteres
    expect(saida).toContain('LANCOU');
    expect(saida).toMatch(/caracteres/);
  });

  test('aceita um segredo real, longo e aleatório', () => {
    const saida = tentaCarregar({ JWT_SECRET: 'a'.repeat(48) });
    expect(saida.trim()).toBe('OK');
  });
});
