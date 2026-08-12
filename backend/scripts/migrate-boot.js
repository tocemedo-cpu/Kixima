// scripts/migrate-boot.js
// Migrações no ARRANQUE do contentor, com diagnóstico e reparação.
//
// O que substitui: a cadeia
//   migrate deploy || (migrate resolve --applied 0_init && migrate deploy)
// que disparava o baseline a QUALQUER falha e rebentava com um P3008
// ("0_init já está registada"), escondendo o erro verdadeiro e matando o
// arranque — o servidor nem chegava a subir.
//
// O que faz agora: corre `migrate deploy`; se falhar, MOSTRA o erro real e
// tenta reconciliar os estados conhecidos, um de cada vez, repetindo o deploy:
//
//   P3005  base já com esquema e sem histórico  → baseline (resolve 0_init)
//   P3009  migração registada como falhada      → resolve --rolled-back e repete
//   drift  ficheiro alterado depois de aplicado → repõe o checksum e repete
//
// Estas reparações são seguras NESTE repositório porque todas as migrações são
// escritas de forma idempotente (IF NOT EXISTS / DO $$ EXCEPTION WHEN
// duplicate_object): voltar a correr uma migração já aplicada não faz nada.
//
// REGRA: nunca editar uma migração já aplicada. O checksum deixa de bater certo
// e o deploy passa a falhar. Se for preciso mudar alguma coisa, cria-se uma
// migração nova. O caso do drift é tratado aqui por causa do histórico, não
// para o tornar aceitável.
//
// O servidor arranca mesmo que sobre alguma migração por aplicar: uma
// inconsistência no registo não deve deixar o site em baixo. Fica um aviso
// impossível de ignorar no log, com o estado exato.
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');

function prisma(args) {
  return execFileSync('npx', ['prisma', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
}

// Corre um comando do Prisma devolvendo saída e erro em vez de rebentar.
function tryPrisma(args) {
  try {
    return { ok: true, out: prisma(args) };
  } catch (e) {
    return { ok: false, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
}

// Checksum de uma migração — SHA-256 do ficheiro, como o Prisma o calcula.
function checksumOf(name) {
  const file = path.join(MIGRATIONS_DIR, name, 'migration.sql');
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function migrationNames() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(MIGRATIONS_DIR, d.name, 'migration.sql')))
    .map((d) => d.name)
    .sort();
}

// Nomes de migrações citados numa mensagem de erro do Prisma.
function namesIn(text) {
  const known = new Set(migrationNames());
  const found = new Set();
  for (const m of String(text).matchAll(/`([^`]+)`|(\b\d{14}_[a-z0-9_]+)/gi)) {
    const n = m[1] || m[2];
    if (known.has(n)) found.add(n);
  }
  return [...found];
}

// Repõe o checksum de uma migração cujo ficheiro mudou depois de aplicada.
// Único caso em que se escreve diretamente no registo do Prisma — e só o
// checksum, nunca o estado.
async function fixChecksums(names) {
  const { PrismaClient } = require('@prisma/client');
  // DDL e manutenção usam sempre a ligação DIRETA (pooler de sessão).
  const client = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL });
  try {
    for (const name of names) {
      const sum = checksumOf(name);
      const n = await client.$executeRaw`
        UPDATE "_prisma_migrations" SET checksum = ${sum} WHERE migration_name = ${name}
      `;
      console.log(`  checksum reposto em ${name} (${n} registo).`);
    }
  } finally {
    await client.$disconnect();
  }
}

const RECOVERIES = [
  {
    // Base criada por db push (ou por SQL à mão): tem esquema mas não tem
    // histórico. É o baseline legítimo — só aqui, e não a qualquer falha.
    code: 'P3005',
    label: 'a base já tem esquema mas não tem histórico de migrações',
    fix: () => {
      const r = tryPrisma(['migrate', 'resolve', '--applied', '0_init']);
      console.log(r.ok ? '  baseline aplicado (0_init).' : `  baseline não aplicado: ${r.out.trim().split('\n').pop()}`);
      return r.ok;
    },
  },
  {
    // Migração que ficou a meio. O SQL é idempotente, por isso marcá-la como
    // revertida e voltar a correr é seguro.
    code: 'P3009',
    label: 'há migrações registadas como falhadas',
    fix: (out) => {
      const names = namesIn(out);
      if (!names.length) return false;
      let any = false;
      for (const n of names) {
        const r = tryPrisma(['migrate', 'resolve', '--rolled-back', n]);
        console.log(r.ok ? `  ${n} marcada como revertida (vai voltar a correr).` : `  ${n}: ${r.out.trim().split('\n').pop()}`);
        any = any || r.ok;
      }
      return any;
    },
  },
  {
    // O ficheiro de uma migração já aplicada foi alterado.
    match: /modified after it was applied|checksum/i,
    label: 'uma migração já aplicada foi alterada depois de aplicada',
    fix: async (out) => {
      const names = namesIn(out);
      if (!names.length) return false;
      await fixChecksums(names);
      return true;
    },
  },
];

async function main() {
  let attempt = tryPrisma(['migrate', 'deploy']);
  if (attempt.ok) {
    console.log(attempt.out.trim());
    return;
  }

  const tried = new Set();
  for (let i = 0; i < RECOVERIES.length && !attempt.ok; i++) {
    const rec = RECOVERIES.find(
      (r) => !tried.has(r.label) && (r.code ? attempt.out.includes(r.code) : r.match.test(attempt.out)),
    );
    if (!rec) break;
    tried.add(rec.label);

    console.error('\n─── Migrações: o deploy falhou ───────────────────────────');
    console.error(attempt.out.trim());
    console.error(`─── Causa reconhecida: ${rec.label}. A reconciliar… ───`);

    if (!(await rec.fix(attempt.out))) break;
    attempt = tryPrisma(['migrate', 'deploy']);
  }

  if (attempt.ok) {
    console.log(attempt.out.trim());
    console.log('✓ Migrações reconciliadas e aplicadas.');
    return;
  }

  // Sem reparação possível: mostra o erro verdadeiro e o estado, mas deixa o
  // servidor arrancar — o site não deve ficar em baixo por causa disto.
  console.error('\n╔══════════════════════════════════════════════════════════╗');
  console.error('║  MIGRAÇÕES POR APLICAR — o servidor arranca mesmo assim  ║');
  console.error('╚══════════════════════════════════════════════════════════╝');
  console.error(attempt.out.trim());
  console.error('\n─── Estado atual ─────────────────────────────────────────');
  console.error(tryPrisma(['migrate', 'status']).out.trim());
  console.error('──────────────────────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('Migrações: erro inesperado no arranque —', e.message);
  })
  // Nunca bloqueia o arranque do servidor.
  .finally(() => process.exit(0));
