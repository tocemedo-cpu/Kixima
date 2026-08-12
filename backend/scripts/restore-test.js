// scripts/restore-test.js
// Ensaio de restauro. Copia a base, restaura para uma base DESCARTÁVEL e conta
// as linhas dos dois lados.
//
// É a única forma de saber se a cópia serve. Um ficheiro que nunca foi
// restaurado é uma promessa, não uma cópia — e descobre-se que estava truncado
// exatamente no dia em que é preciso.
//
//   npm run backup:restore-test
//
// Não toca na base de origem: lê e escreve numa base temporária que apaga no
// fim. A base temporária é criada no MESMO servidor da origem, por isso precisa
// de uma ligação com permissão para CREATE DATABASE — em dev é o Postgres local;
// em produção, corra isto contra uma cópia, nunca contra o Supabase de produção.
const { execFileSync, spawnSync } = require('child_process');
const zlib = require('zlib');

const TABELAS = [
  'companies', 'users', 'products', 'purchase_orders', 'purchase_order_items',
  'invoices', 'payments', 'contracts', 'audit_logs', 'platform_fees',
];

function urlOrigem() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Defina DIRECT_URL (ou DATABASE_URL).');
  return url;
}

// Troca o nome da base no fim do URL, mantendo credenciais e parâmetros.
function comBase(url, nome) {
  return url.replace(/\/([^/?]+)(\?|$)/, `/${nome}$2`);
}

function psql(url, sql) {
  const r = spawnSync('psql', [url, '-tAc', sql], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr.trim() || 'psql falhou');
  return r.stdout.trim();
}

function contar(url) {
  const linhas = {};
  for (const t of TABELAS) {
    try { linhas[t] = Number(psql(url, `SELECT count(*) FROM "${t}"`)); }
    catch { linhas[t] = null; } // tabela pode não existir em bases antigas
  }
  return linhas;
}

async function main() {
  const origem = urlOrigem();
  const nomeTemp = `kixima_restore_test_${Date.now()}`;
  const admin = comBase(origem, 'postgres');
  const destino = comBase(origem, nomeTemp);

  console.log('1. A contar as linhas da origem…');
  const antes = contar(origem);
  const totalAntes = Object.values(antes).reduce((s, n) => s + (n || 0), 0);
  console.log(`   ${totalAntes} linhas em ${TABELAS.length} tabelas.`);

  console.log('2. A copiar…');
  const dump = execFileSync('pg_dump', ['--no-owner', '--no-privileges', '--clean', '--if-exists', origem], { maxBuffer: 1 << 30 });
  const comprimido = zlib.gzipSync(dump);
  console.log(`   ${(comprimido.length / 1024 / 1024).toFixed(2)} MB comprimidos.`);

  console.log(`3. A restaurar para uma base descartável (${nomeTemp})…`);
  psql(admin, `CREATE DATABASE "${nomeTemp}"`);
  let ok = false;
  try {
    const r = spawnSync('psql', [destino, '-v', 'ON_ERROR_STOP=0', '-q'], {
      input: zlib.gunzipSync(comprimido).toString('utf8'),
      encoding: 'utf8',
      maxBuffer: 1 << 30,
    });
    if (r.status !== 0) throw new Error(r.stderr.slice(0, 600));

    console.log('4. A comparar…');
    const depois = contar(destino);
    let divergencias = 0;
    for (const t of TABELAS) {
      const a = antes[t]; const b = depois[t];
      const sinal = a === b ? '✓' : '✗';
      if (a !== b) divergencias++;
      console.log(`   ${sinal} ${t.padEnd(22)} ${String(a ?? '—').padStart(6)} → ${String(b ?? '—').padStart(6)}`);
    }
    ok = divergencias === 0;
    console.log(ok
      ? `\n✓ Restauro fiel: ${totalAntes} linhas repostas, nenhuma divergência.`
      : `\n✗ ${divergencias} tabela(s) com contagem diferente — a cópia NÃO é fiável.`);
  } finally {
    // Encerra ligações pendentes e apaga a base de ensaio, aconteça o que acontecer.
    try {
      psql(admin, `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${nomeTemp}'`);
      psql(admin, `DROP DATABASE IF EXISTS "${nomeTemp}"`);
      console.log('   (base de ensaio removida)');
    } catch (e) {
      console.warn(`   ⚠ não foi possível remover a base de ensaio ${nomeTemp}: ${e.message}`);
    }
  }
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error('✗ Erro:', e.message); process.exit(1); });
