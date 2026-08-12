// tests/schema-indexes.test.js
// Toda a chave estrangeira tem de ter índice.
//
// O PostgreSQL cria a restrição mas não o índice. Sem ele, as consultas que
// filtram por essa coluna varrem a tabela inteira, e cada eliminação na tabela
// referenciada procura as linhas dependentes à força bruta. Não se nota com
// poucos dados — nota-se muito quando já é tarde.
//
// Este teste lê as migrações (que são a verdade sobre a base) e falha se
// alguma relação nova entrar sem índice.
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'prisma', 'migrations');

function sqlDasMigracoes() {
  return fs.readdirSync(DIR)
    .filter((d) => fs.existsSync(path.join(DIR, d, 'migration.sql')))
    .sort()
    .map((d) => fs.readFileSync(path.join(DIR, d, 'migration.sql'), 'utf8'))
    .join('\n');
}

// Colunas de FK que dispensam índice próprio: as que já são únicas (o índice da
// unicidade serve) e as que são a primeira coluna de um índice composto.
function indicesExistentes(sql) {
  const idx = new Set();
  const padrao = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF NOT EXISTS\s+)?"[^"]+"\s+ON\s+"(\w+)"\s*\(([^)]+)\)/gi;
  for (const m of sql.matchAll(padrao)) {
    const primeira = m[2].split(',')[0].trim().replace(/"/g, '').split(' ')[0];
    idx.add(`${m[1]}.${primeira}`);
  }
  // Restrições UNIQUE declaradas na criação da tabela também criam índice.
  for (const m of sql.matchAll(/"(\w+)"\s+\w+[^,\n]*\bUNIQUE\b/gi)) idx.add(m[1]);
  return idx;
}

describe('Índices das chaves estrangeiras', () => {
  const sql = sqlDasMigracoes();
  const idx = indicesExistentes(sql);

  const fks = [...sql.matchAll(/ALTER TABLE "(\w+)" ADD CONSTRAINT "\w+" FOREIGN KEY \("(\w+)"\)/g)]
    .map((m) => ({ tabela: m[1], coluna: m[2] }));

  test('há chaves estrangeiras para verificar', () => {
    expect(fks.length).toBeGreaterThan(30);
  });

  test('nenhuma chave estrangeira ficou sem índice', () => {
    const semIndice = [...new Set(
      fks.filter((f) => !idx.has(`${f.tabela}.${f.coluna}`)).map((f) => `${f.tabela}.${f.coluna}`),
    )].sort();
    // Se falhar: acrescente @@index([campo]) ao modelo e uma migração com
    // CREATE INDEX IF NOT EXISTS para a coluna correspondente.
    expect(semIndice).toEqual([]);
  });
});
