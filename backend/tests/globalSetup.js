// tests/globalSetup.js
// Corre uma vez antes de toda a suite: repõe o schema na base de dados de teste
// e popula os dados de exemplo (as 5 personas + catálogo), reutilizando o mesmo
// seed usado em desenvolvimento.

const { execSync } = require('child_process');
const path = require('path');

// Garante as mesmas variáveis de ambiente que os workers (setupFiles não corre
// no processo do globalSetup).
require('./env');

module.exports = async () => {
  const backendDir = path.resolve(__dirname, '..');
  const env = { ...process.env };
  const run = (cmd) =>
    execSync(cmd, { cwd: backendDir, env, stdio: ['ignore', 'ignore', 'inherit'] });

  // Repõe o schema do zero (--force-reset apaga e recria as tabelas).
  run('npx prisma db push --force-reset --skip-generate');
  // Popula os dados de demonstração.
  run('node prisma/seed.js');
};
