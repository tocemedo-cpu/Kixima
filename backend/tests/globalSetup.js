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

  // APLICA AS MIGRAÇÕES, e não `db push`.
  //
  // Estava aqui `prisma db push --force-reset`, que constrói as tabelas a
  // partir do schema.prisma e IGNORA o SQL das migrações. A consequência é
  // silenciosa e grande: tudo o que só existe nas migrações — gatilhos,
  // funções, índices, restrições escritas à mão — nunca existiu na base de
  // testes. A suite passava a validar um schema que não é o que corre em
  // produção, e um gatilho partido seria verde aqui e avariado lá.
  //
  // `migrate reset` apaga, recria e aplica as migrações pela ordem real. É
  // mais lento, e é o único jeito de o que se testa ser o que se publica.
  run('npx prisma migrate reset --force --skip-seed --skip-generate');
  // Popula os dados de demonstração (só para os testes — ver prisma/seed.demo.js).
  run('node prisma/seed.demo.js');
};
