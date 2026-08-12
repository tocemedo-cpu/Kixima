// scripts/migration-lock.js
// Trava contra a edição de migrações já publicadas.
//
// Editar uma migração depois de ela estar aplicada é o erro que partiu a
// produção: o `migrate deploy` não reavalia migrações já registadas — vê-as como
// aplicadas e salta-as — por isso o que se lhes acrescenta NUNCA corre nas bases
// que já as tinham. O esquema fica em falta e a aplicação rebenta com
// «column does not exist», sem nada nos logs de migração a denunciá-lo.
//
// Este ficheiro guarda o SHA-256 de cada migração publicada. O teste
// tests/migrations.test.js compara-o com o disco e falha se algum mudar.
//
//   npm run migrations:lock    → regista as migrações NOVAS (as existentes não
//                                podem mudar; a trava recusa reescrevê-las)
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');
const LOCK_FILE = path.join(MIGRATIONS_DIR, 'checksums.json');

function checksums() {
  return Object.fromEntries(
    fs
      .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(MIGRATIONS_DIR, d.name, 'migration.sql')))
      .map((d) => [
        d.name,
        crypto.createHash('sha256')
          .update(fs.readFileSync(path.join(MIGRATIONS_DIR, d.name, 'migration.sql')))
          .digest('hex'),
      ])
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

function load() {
  return fs.existsSync(LOCK_FILE) ? JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8')) : {};
}

// Compara o disco com a trava. Devolve o que mudou e o que é novo.
function diff() {
  const atual = checksums();
  const travado = load();
  const alteradas = Object.keys(travado).filter((n) => atual[n] && atual[n] !== travado[n]);
  const removidas = Object.keys(travado).filter((n) => !atual[n]);
  const novas = Object.keys(atual).filter((n) => !travado[n]);
  return { atual, alteradas, removidas, novas };
}

// Regista as migrações novas. Recusa-se a reescrever as que já estão travadas.
function lock() {
  const { atual, alteradas, removidas, novas } = diff();
  if (alteradas.length || removidas.length) {
    console.error('✗ Migrações já publicadas foram alteradas ou removidas:');
    [...alteradas, ...removidas].forEach((n) => console.error(`    ${n}`));
    console.error('\n  Uma migração publicada não pode mudar — as bases que já a aplicaram');
    console.error('  nunca voltam a corrê-la. Reponha o ficheiro e crie uma migração nova.');
    process.exit(1);
  }
  const travado = { ...load() };
  novas.forEach((n) => { travado[n] = atual[n]; });
  fs.writeFileSync(LOCK_FILE, `${JSON.stringify(travado, Object.keys(travado).sort(), 2)}\n`);
  console.log(novas.length ? `✓ ${novas.length} migração(ões) registada(s): ${novas.join(', ')}` : '✓ Nada de novo a registar.');
}

module.exports = { checksums, load, diff, LOCK_FILE };

if (require.main === module) lock();
