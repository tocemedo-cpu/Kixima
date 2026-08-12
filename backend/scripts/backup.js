// scripts/backup.js
// Cópia de segurança da base de dados para fora do Supabase.
//
// Porquê existir: o histórico de ordens, faturas e pagamentos é o registo
// comercial da plataforma. Uma migração mal aplicada, um deleteMany enganado ou
// uma falha do fornecedor apaga-o, e o plano gratuito do Supabase não faz cópias
// point-in-time. Uma cópia que vive no mesmo sítio que o original não é uma
// cópia — por isso este script escreve para o armazenamento S3 configurado
// (Supabase Storage, R2, S3) ou para disco, se for o que houver.
//
//   npm run backup                 → cópia completa, comprimida
//   npm run backup -- --verificar  → só confirma que dá para ler (não escreve)
//
// A ligação usada é a DIRECT_URL (pooler de sessão): o pg_dump precisa de uma
// sessão estável e não funciona bem através do pooler de transação.
//
// REGRA QUE NÃO SE NEGOCEIA: uma cópia que nunca foi restaurada não é uma
// cópia. O `npm run backup:restore-test` faz esse ensaio.
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const config = require('../src/config/env');
const storage = require('../src/services/storageService');

const RETENCAO_DIAS = Number(process.env.BACKUP_RETENTION_DAYS) || 30;
const DESTINO_LOCAL = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');

function urlDeDump() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Defina DIRECT_URL (ou DATABASE_URL) para saber que base copiar.');
  // O pooler de transação não serve para pg_dump; avisa em vez de falhar a meio.
  if (/pgbouncer=true|:6543\b/.test(url) && !process.env.DIRECT_URL) {
    console.warn('⚠  A ligação parece ser o pooler de TRANSAÇÃO (porta 6543).');
    console.warn('   O pg_dump precisa do pooler de SESSÃO — defina DIRECT_URL (porta 5432).');
  }
  return url;
}

function temPgDump() {
  const r = spawnSync('pg_dump', ['--version'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

// Nome com data ordenável: a listagem alfabética é a listagem cronológica.
function nomeDoFicheiro(carimbo) {
  return `kixima-${carimbo.toISOString().replace(/[:.]/g, '-').slice(0, 19)}.sql.gz`;
}

async function main() {
  const apenasVerificar = process.argv.includes('--verificar');
  const versao = temPgDump();
  if (!versao) {
    console.error('✗ pg_dump não está instalado. Instale o cliente do PostgreSQL (postgresql-client).');
    process.exit(1);
  }
  console.log(`Ferramenta: ${versao}`);

  const url = urlDeDump();
  const alvo = url.replace(/:\/\/[^@]*@/, '://***@'); // nunca imprimir credenciais
  console.log(`Base: ${alvo}`);

  if (apenasVerificar) {
    // Só confirma que a base responde e diz o tamanho, sem produzir ficheiro.
    const r = spawnSync('pg_dump', ['--schema-only', '--no-owner', url], { encoding: 'utf8', maxBuffer: 1 << 28 });
    if (r.status !== 0) { console.error(`✗ Não foi possível ler a base:\n${r.stderr}`); process.exit(1); }
    console.log(`✓ A base responde. Esquema com ${r.stdout.split('\n').length} linhas.`);
    return;
  }

  console.log('A copiar…');
  const inicio = Date.now();
  const dump = execFileSync(
    'pg_dump',
    ['--no-owner', '--no-privileges', '--clean', '--if-exists', url],
    { maxBuffer: 1 << 30 },
  );
  const comprimido = zlib.gzipSync(dump, { level: 9 });
  const nome = nomeDoFicheiro(new Date());
  const mb = (comprimido.length / 1024 / 1024).toFixed(2);

  // Guarda FORA do Supabase sempre que houver armazenamento configurado; caso
  // contrário fica em disco, com aviso — no Render esse disco é efémero.
  let destino;
  if (storage.providerAtivo() === 's3') {
    destino = await storage.saveFile({
      buffer: comprimido,
      originalname: nome,
      mimetype: 'application/gzip',
      keyHint: 'kixima-backup',
      folder: 'backups',
    });
  } else {
    fs.mkdirSync(DESTINO_LOCAL, { recursive: true });
    destino = path.join(DESTINO_LOCAL, nome);
    fs.writeFileSync(destino, comprimido);
    console.warn('⚠  Sem armazenamento S3 configurado: a cópia ficou em disco.');
    console.warn('   No Render esse disco é APAGADO a cada reinício — configure STORAGE_* ou');
    console.warn('   copie o ficheiro para fora antes de reiniciar.');
  }

  console.log(`✓ Cópia concluída em ${((Date.now() - inicio) / 1000).toFixed(1)}s — ${mb} MB`);
  console.log(`  ${destino}`);
  console.log(`\nRetenção definida: ${RETENCAO_DIAS} dias.`);
  console.log('Lembrete: uma cópia que nunca foi restaurada não é uma cópia.');
  console.log('          npm run backup:restore-test  faz o ensaio.');
}

main().catch((e) => { console.error('✗ Erro:', e.message); process.exit(1); });
