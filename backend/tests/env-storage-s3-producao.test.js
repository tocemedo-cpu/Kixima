// tests/env-storage-s3-producao.test.js
// Em modo 'local' (disco do contentor), os ficheiros carregados — documentos
// de credenciamento, comprovativos de pagamento, e até as cópias de
// segurança da própria base — desaparecem a cada reinício/deploy do Render.
// Antes, uma má configuração de storage em produção só ficava registada num
// log de erro; a app arrancava na mesma e continuava a aceitar uploads que
// se perderiam. Agora falha o arranque, tal como já acontece para
// DATABASE_URL/JWT_SECRET.
//
// Cada caso corre num subprocesso (env.js lança ao ser importado).
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
      JWT_SECRET: 'a'.repeat(48),
      ...env,
    },
    encoding: 'utf8',
    timeout: 30_000,
  });
}

describe('Guardião de storage S3 em produção', () => {
  test('recusa arrancar em modo local (STORAGE_PROVIDER nunca definido)', () => {
    const saida = tentaCarregar({ STORAGE_PROVIDER: '' });
    expect(saida).toContain('LANCOU');
    expect(saida).toMatch(/Armazenamento inseguro/);
  });

  test('recusa arrancar com STORAGE_PROVIDER=s3 mas credenciais incompletas', () => {
    const saida = tentaCarregar({
      STORAGE_PROVIDER: 's3', STORAGE_BUCKET: 'kixima', STORAGE_ACCESS_KEY: '', STORAGE_SECRET_KEY: '',
    });
    expect(saida).toContain('LANCOU');
    expect(saida).toMatch(/STORAGE_ACCESS_KEY/);
  });

  test('aceita com STORAGE_PROVIDER=s3 e credenciais completas', () => {
    const saida = tentaCarregar({
      STORAGE_PROVIDER: 's3', STORAGE_BUCKET: 'kixima', STORAGE_ACCESS_KEY: 'ak', STORAGE_SECRET_KEY: 'sk',
    });
    expect(saida.trim()).toBe('OK');
  });
});
