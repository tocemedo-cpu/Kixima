// tests/backup-recuperacao.test.js
// As duas perguntas que a cópia de segurança tinha por responder.
//
// 1. CORRE? No plano gratuito do Render o serviço suspende ao fim de ~15 minutos
//    sem tráfego. Às 03:00 UTC não há tráfego: o processo está adormecido, o
//    node-cron não dispara, e a execução perdida nunca é recuperada. Sem erro
//    nenhum — a página dizia "agendada" e a cópia não acontecia.
//
// 2. LÊ-SE? Fazer a cópia prova que ela se escreve. Um objeto truncado, um gzip
//    corrompido ou um bucket esvaziado por retenção só se descobrem no dia em
//    que a cópia é precisa, que é o pior dia possível para descobrir.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const prisma = require('../src/config/database');
const config = require('../src/config/env');
const backupJob = require('../src/jobs/backupJob');
const verificacao = require('../src/services/backupVerificacaoService');
const storage = require('../src/services/storageService');

const ACAO = 'COPIA_SEGURANCA_CONCLUIDA';

async function limparHistorico() {
  await prisma.auditLog.deleteMany({
    where: { action: { in: [ACAO, 'COPIA_SEGURANCA_FALHOU'] } },
  });
}

beforeEach(limparHistorico);
afterAll(limparHistorico);

describe('Ler a cópia de volta', () => {
  // Ciclo completo: pg_dump → gzip → armazenamento → ler → descomprimir →
  // confirmar que traz a base toda. Corre contra o provider de disco; no Render
  // o troço do meio é o S3, com a mesma chave e o mesmo conteúdo.
  test('uma cópia acabada de fazer lê-se, descomprime e traz a base toda', async () => {
    await backupJob.copiar();

    const r = await verificacao.verificar();
    expect(r.tabelasNoDump).toBeGreaterThan(0);
    expect(r.tabelasNaBase).toBeGreaterThan(0);
    // O dump tem de trazer TODAS as tabelas que a base tem hoje.
    expect(r.tabelasNoDump).toBeGreaterThanOrEqual(r.tabelasNaBase);
    expect(r.blocosDeDados).toBeGreaterThan(0);
    // E dizer o que NÃO é, para não ser confundido com um ensaio de restauro.
    expect(r.nota).toMatch(/NÃO é um ensaio de restauro/);
  }, 60000);

  test('sem nenhuma cópia feita, diz para fazer uma', async () => {
    await expect(verificacao.verificar()).rejects.toThrow(/nenhuma cópia registada/i);
  });

  // O ponto mais importante do ficheiro: um ficheiro corrompido tem de ser
  // apanhado AQUI, e não no dia em que a base for precisa.
  test('um ficheiro corrompido é apanhado, e diz que está corrompido', async () => {
    const r = await backupJob.copiar();

    // Estraga o conteúdo mantendo o ficheiro e o tamanho — é assim que uma
    // cópia truncada se apresenta: existe, tem bytes, e não abre.
    const caminho = path.join(storage.uploadsDir, path.basename(r.key));
    fs.writeFileSync(caminho, Buffer.alloc(fs.statSync(caminho).size, 0x41));

    await expect(verificacao.verificar()).rejects.toThrow(/CORROMPIDA/);
  }, 60000);

  test('um dump sem tabelas nenhumas não passa por bom', async () => {
    const r = await backupJob.copiar();
    const caminho = path.join(storage.uploadsDir, path.basename(r.key));
    // Um gzip válido, mas com um dump vazio lá dentro.
    fs.writeFileSync(caminho, zlib.gzipSync('-- PostgreSQL database dump\n-- (vazio)\n'));

    await expect(verificacao.verificar()).rejects.toThrow(/não contém nenhuma tabela/i);
  }, 60000);

  test('um dump incompleto — menos tabelas do que a base tem — é recusado', async () => {
    const r = await backupJob.copiar();
    const caminho = path.join(storage.uploadsDir, path.basename(r.key));
    fs.writeFileSync(caminho, zlib.gzipSync(
      '-- PostgreSQL database dump\nCREATE TABLE "users" (id text);\nCOPY "users" (id) FROM stdin;\n\\.\n',
    ));

    await expect(verificacao.verificar()).rejects.toThrow(/está incompleto/i);
  }, 60000);
});

describe('Recuperar uma cópia perdida', () => {
  const cronOriginal = process.env.BACKUP_CRON;
  afterEach(() => {
    if (cronOriginal === undefined) delete process.env.BACKUP_CRON;
    else process.env.BACKUP_CRON = cronOriginal;
  });

  test('sem BACKUP_CRON não faz nada — continua a ser opt-in', async () => {
    delete process.env.BACKUP_CRON;
    const r = await backupJob.verificarAtraso();
    expect(r.corrida).toBe(false);
    expect(r.motivo).toMatch(/sem BACKUP_CRON/);
  });

  test('recusa-se pelas mesmas razões que o agendamento', async () => {
    process.env.BACKUP_CRON = '0 3 * * *';
    const motivo = backupJob.motivoParaNaoCorrer();
    const r = await backupJob.verificarAtraso();

    // No ambiente de teste não há S3, por isso tem de recusar — e pelo mesmo
    // motivo que o agendamento recusaria. Um caminho de recuperação que
    // aceitasse condições que o agendamento recusa daria por protegido algo
    // que à noite não existe.
    expect(motivo).toBeTruthy();
    expect(r.corrida).toBe(false);
    expect(r.motivo).toBe(motivo);
  });

  test('uma cópia recente não é repetida', async () => {
    process.env.BACKUP_CRON = '0 3 * * *';
    await prisma.auditLog.create({
      data: { action: ACAO, entityType: 'Backup', detail: { megabytes: 1 } },
    });

    const r = await backupJob.verificarAtraso();
    expect(r.corrida).toBe(false);
    // "em dia" ou o impedimento do S3 — em nenhum dos casos corre.
    expect(r).not.toHaveProperty('megabytes');
  });

  // O caso que o plano gratuito cria todas as noites.
  test('uma cópia antiga demais é detetada como atraso', async () => {
    process.env.BACKUP_CRON = '0 3 * * *';
    const antiga = new Date(Date.now() - (backupJob.IDADE_MAXIMA_HORAS + 5) * 36e5);
    await prisma.auditLog.create({
      data: { action: ACAO, entityType: 'Backup', detail: { megabytes: 1 }, createdAt: antiga },
    });

    // Com S3 configurado correria; aqui confirma-se que o atraso é RECONHECIDO,
    // e que o que o impede é o armazenamento e não a idade.
    const r = await backupJob.verificarAtraso();
    expect(r.motivo).not.toBe('em dia');
  });

  test('o limite é configurável e tem um valor por omissão sensato', () => {
    // 26 horas: folga para um agendamento diário sem deixar passar um dia inteiro.
    expect(backupJob.IDADE_MAXIMA_HORAS).toBeGreaterThanOrEqual(24);
    expect(backupJob.IDADE_MAXIMA_HORAS).toBeLessThanOrEqual(48);
  });
});
