// src/jobs/backupJob.js
// Cópia de segurança automática, de dentro do próprio serviço.
//
// Porquê aqui e não num cron do Render: o plano em uso não dá acesso a shell nem
// a cron jobs, e uma cópia que depende de alguém se lembrar de a correr à mão
// não é uma política de backup. A aplicação já tem agendador (node-cron), e é o
// único sítio de onde isto pode partir sozinho.
//
// OPT-IN: só corre com BACKUP_CRON definido. Sem essa variável não faz nada —
// não se impõe carga a quem já tenha os backups tratados do lado do Supabase.
//
//   BACKUP_CRON="0 3 * * *"   → todos os dias às 03:00 (hora do servidor, UTC)
//
// A cópia vai para o armazenamento S3 configurado. Sem S3, o job recusa-se a
// correr: escrever para o disco do contentor seria uma cópia que desaparece com
// o próprio serviço — pior do que não ter cópia nenhuma, porque dá falsa
// segurança.
const { execFile } = require('child_process');
const { promisify } = require('util');
const zlib = require('zlib');
const cron = require('node-cron');
const config = require('../config/env');
const logger = require('../config/logger');
const storage = require('../services/storageService');

const execFileAsync = promisify(execFile);

function urlDeDump() {
  return process.env.DIRECT_URL || process.env.DATABASE_URL;
}

async function copiar() {
  const url = urlDeDump();
  if (!url) throw new Error('DIRECT_URL/DATABASE_URL não definido');

  const inicio = Date.now();
  const { stdout } = await execFileAsync(
    'pg_dump',
    ['--no-owner', '--no-privileges', '--clean', '--if-exists', url],
    { maxBuffer: 1 << 30, encoding: 'buffer' },
  );
  const comprimido = zlib.gzipSync(stdout, { level: 9 });
  const nome = `kixima-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.sql.gz`;

  const destino = await storage.saveFile({
    buffer: comprimido,
    originalname: nome,
    mimetype: 'application/gzip',
    keyHint: 'kixima-backup',
    folder: 'backups',
    // Bucket PRIVADO, separado do das imagens (que é público por necessidade).
    bucket: config.storage.backupBucket,
  });

  return { destino, bytes: comprimido.length, segundos: (Date.now() - inicio) / 1000 };
}

function scheduleBackupJob() {
  const expressao = process.env.BACKUP_CRON;
  if (!expressao) return;

  if (!cron.validate(expressao)) {
    logger.error(`BACKUP_CRON inválido ("${expressao}") — a cópia automática NÃO vai correr.`);
    return;
  }
  if (storage.providerAtivo() !== 's3') {
    logger.error(
      'BACKUP_CRON definido mas sem armazenamento S3 — a cópia automática não vai correr. ' +
      'Uma cópia no disco do contentor desaparece com ele, o que é pior do que não ter cópia: ' +
      'dá a impressão de estar protegido. Configure STORAGE_* e reinicie.',
    );
    return;
  }
  if (!config.storage.backupBucket) {
    logger.error(
      'BACKUP_CRON definido mas STORAGE_BACKUP_BUCKET em falta — a cópia automática não vai correr. ' +
      'As cópias NÃO podem ir para o bucket das imagens: esse é público (é de lá que o marketplace ' +
      'serve as fotos do catálogo), e um dump da base tem hashes de senha, os dados de todas as ' +
      'empresas e o histórico financeiro. Crie um bucket PRIVADO só para cópias e indique-o aqui.',
    );
    return;
  }
  if (config.storage.backupBucket === config.storage.bucket) {
    logger.error(
      'STORAGE_BACKUP_BUCKET é o MESMO bucket das imagens — a cópia automática não vai correr. ' +
      'O bucket das imagens é público; as cópias precisam de um bucket privado só delas.',
    );
    return;
  }

  logger.info(`Cópia de segurança automática agendada: ${expressao} (UTC)`);
  cron.schedule(expressao, async () => {
    try {
      const r = await copiar();
      logger.info(
        `Cópia de segurança concluída em ${r.segundos.toFixed(1)}s — ${(r.bytes / 1024 / 1024).toFixed(2)} MB`,
        { destino: r.destino },
      );
    } catch (err) {
      // Uma cópia que falha em silêncio é o mesmo que não existir.
      logger.error('FALHA NA CÓPIA DE SEGURANÇA — a base ficou sem cópia hoje', { erro: err.message });
    }
  });
}

module.exports = { scheduleBackupJob, copiar };
