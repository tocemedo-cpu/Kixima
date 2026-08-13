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
//   BACKUP_CRON=0 3 * * *   → todos os dias às 03:00 (hora do servidor, UTC)
//
// SEM ASPAS. No painel do Render o valor é guardado literalmente: umas aspas
// copiadas junto com o exemplo entram no valor, o node-cron rejeita-o e a cópia
// deixa de ser agendada — com a variável a "parecer" certa no painel.
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
const prisma = require('../config/database');
const auditService = require('../services/auditService');

const execFileAsync = promisify(execFile);

function urlDeDump() {
  return config.database.directUrl || config.database.url;
}

// Uma cópia de cada vez. O pg_dump carrega a base inteira em memória e o plano
// gratuito tem 512 MB: duas em paralelo — o agendamento e alguém a carregar no
// botão — derrubavam o serviço. Quem chega a meio de uma cópia recebe a que já
// está a correr, em vez de iniciar outra.
let emCurso = null;

async function copiar() {
  if (emCurso) return emCurso;
  emCurso = executar().finally(() => { emCurso = null; });
  return emCurso;
}

async function executar() {
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

  const { url: destino, key } = await storage.saveFile({
    buffer: comprimido,
    originalname: nome,
    mimetype: 'application/gzip',
    keyHint: 'kixima-backup',
    folder: 'backups',
    // Bucket PRIVADO, separado do das imagens (que é público por necessidade).
    bucket: config.storage.backupBucket,
    comChave: true,
  });

  const resultado = { destino, key, bytes: comprimido.length, segundos: (Date.now() - inicio) / 1000 };
  await registar('COPIA_SEGURANCA_CONCLUIDA', {
    megabytes: Number((resultado.bytes / 1024 / 1024).toFixed(2)),
    segundos: Number(resultado.segundos.toFixed(1)),
    bucket: config.storage.backupBucket,
    // A chave é o que permite voltar a LER a cópia mais tarde para confirmar que
    // está inteira. Sem ela, saber-se-ia que foi escrita e nada mais.
    chave: key,
  });
  return resultado;
}

// A cópia fica no trilho de auditoria, e não só no registo do serviço. O
// registo do Render é rotativo e some ao fim de uns dias; a pergunta "quando é
// que a última cópia correu mesmo?" tem de continuar a ter resposta meses
// depois. É também o que permite dar por uma cópia que deixou de correr.
async function registar(action, detail) {
  await auditService.recordSafe({
    actor: { actorId: null, actorName: 'Sistema', actorRole: null, companyId: null, ip: null },
    action,
    entityType: 'Backup',
    entityRef: detail.bucket || null,
    detail,
  });
}

/**
 * Porque é que uma cópia NÃO pode correr agora — ou null, se puder.
 *
 * A mesma função serve o agendamento e o botão "Fazer cópia agora". Se o botão
 * aceitasse condições que o agendamento recusa, seria pior do que não ter
 * botão: dava por confirmado um caminho que à noite não existe.
 */
function motivoParaNaoCorrer() {
  if (storage.providerAtivo() !== 's3') {
    return 'Sem armazenamento S3 configurado. Uma cópia no disco do contentor desaparece com ele, '
      + 'o que é pior do que não ter cópia: dá a impressão de estar protegido. Configure STORAGE_* e reinicie.';
  }
  if (!config.storage.backupBucket) {
    return 'STORAGE_BACKUP_BUCKET em falta. As cópias NÃO podem ir para o bucket das imagens: esse é '
      + 'público (é de lá que o marketplace serve as fotos do catálogo), e um dump da base tem hashes de '
      + 'senha, os dados de todas as empresas e o histórico financeiro. Crie um bucket PRIVADO só para cópias.';
  }
  if (config.storage.backupBucket === config.storage.bucket) {
    return 'STORAGE_BACKUP_BUCKET é o MESMO bucket das imagens, que é público. '
      + 'As cópias precisam de um bucket privado só delas.';
  }
  return null;
}


// --- Recuperação de cópias perdidas -----------------------------------------
//
// O PROBLEMA que isto resolve, e que o agendamento sozinho não resolve:
// no plano gratuito do Render o serviço SUSPENDE ao fim de ~15 minutos sem
// tráfego. Às 03:00 UTC não há tráfego nenhum — o processo está adormecido, o
// setTimeout do node-cron não corre, e o `recoverMissedExecutions: false` (o
// valor por omissão) significa que a execução perdida nunca é recuperada. Não
// aparece erro em lado nenhum: a cópia simplesmente não acontece, todas as
// noites, com a página de Prontidão a dizer "agendada".
//
// A SOLUÇÃO não é insistir na hora certa — é deixar de depender dela. Em vez de
// "às 03:00", a pergunta passa a ser "já passou demasiado tempo desde a última?".
// Essa pergunta pode ser feita a qualquer momento em que o serviço esteja
// acordado, e o serviço está acordado sempre que alguém o usa. Uma plataforma
// com utilizadores tem tráfego todos os dias; a cópia acontece nesse tráfego.
//
// O intervalo por omissão é 26 horas: dá folga a um agendamento diário sem
// deixar passar um dia inteiro sem cópia.
const IDADE_MAXIMA_HORAS = Number(config.limparValor(process.env.BACKUP_MAX_IDADE_HORAS)) || 26;

// De quanto em quanto tempo se faz a pergunta, enquanto o processo vive.
const INTERVALO_VERIFICACAO_MS = 30 * 60 * 1000;

// Quanto se espera depois do arranque antes da primeira verificação. O arranque
// já tem as migrações e o seed a competir por CPU e memória; um pg_dump por
// cima disso, num contentor de 512 MB, é como se pede um reinício em ciclo.
const ESPERA_APOS_ARRANQUE_MS = 3 * 60 * 1000;

async function ultimaCopiaComSucesso() {
  const r = await prisma.auditLog.findFirst({
    where: { action: 'COPIA_SEGURANCA_CONCLUIDA' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  }).catch(() => null);
  return r?.createdAt || null;
}

/**
 * Corre uma cópia se a última for demasiado antiga (ou não existir).
 * Devolve o que foi decidido, para ser testável e para o log dizer porquê.
 */
async function verificarAtraso() {
  if (!process.env.BACKUP_CRON) return { corrida: false, motivo: 'sem BACKUP_CRON' };
  const impedimento = motivoParaNaoCorrer();
  if (impedimento) return { corrida: false, motivo: impedimento };

  const ultima = await ultimaCopiaComSucesso();
  const horas = ultima ? (Date.now() - new Date(ultima).getTime()) / 36e5 : Infinity;
  if (horas < IDADE_MAXIMA_HORAS) {
    return { corrida: false, motivo: 'em dia', horas: Number(horas.toFixed(1)) };
  }

  logger.info(
    ultima
      ? `Cópia de segurança em atraso — a última foi há ${horas.toFixed(1)}h (limite ${IDADE_MAXIMA_HORAS}h). A copiar agora.`
      : 'Ainda não existe nenhuma cópia de segurança. A copiar agora.',
  );
  try {
    const r = await copiar();
    logger.info(`Cópia de recuperação concluída — ${(r.bytes / 1024 / 1024).toFixed(2)} MB`);
    return { corrida: true, megabytes: Number((r.bytes / 1024 / 1024).toFixed(2)) };
  } catch (err) {
    logger.error('FALHA NA CÓPIA DE RECUPERAÇÃO', { erro: err.message });
    await registar('COPIA_SEGURANCA_FALHOU', { erro: String(err.message).slice(0, 500) });
    return { corrida: false, motivo: err.message };
  }
}

function scheduleBackupJob() {
  // A mesma limpeza do resto do ambiente: o painel do Render guarda o que lá for
  // colado, aspas e rótulos incluídos.
  const expressao = config.limparValor(process.env.BACKUP_CRON);
  if (!expressao) return;

  if (config.precisouDeLimpeza(process.env.BACKUP_CRON)) {
    logger.warn(
      `BACKUP_CRON tinha espaços, aspas ou texto a mais; foi lido como "${expressao}". `
      + 'Vale a pena arrumar o valor no painel.',
    );
  }

  if (!cron.validate(expressao)) {
    logger.error(`BACKUP_CRON inválido ("${expressao}") — a cópia automática NÃO vai correr.`);
    return;
  }
  const motivo = motivoParaNaoCorrer();
  if (motivo) {
    logger.error(`BACKUP_CRON definido mas a cópia automática não vai correr. ${motivo}`);
    return;
  }

  logger.info(
    `Cópia de segurança automática agendada: ${expressao} (UTC). `
    + `Recuperação de cópias perdidas ativa: se a última tiver mais de ${IDADE_MAXIMA_HORAS}h, `
    + 'corre assim que o serviço estiver acordado.',
  );

  // A rede de segurança do plano gratuito: o serviço dorme às 03:00, mas acorda
  // com o primeiro utilizador do dia — e é aí que a cópia perdida acontece.
  setTimeout(() => { verificarAtraso().catch(() => {}); }, ESPERA_APOS_ARRANQUE_MS).unref?.();
  setInterval(() => { verificarAtraso().catch(() => {}); }, INTERVALO_VERIFICACAO_MS).unref?.();
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
      await registar('COPIA_SEGURANCA_FALHOU', { erro: String(err.message).slice(0, 500) });
    }
  });
}

module.exports = {
  scheduleBackupJob, copiar, motivoParaNaoCorrer,
  verificarAtraso, IDADE_MAXIMA_HORAS,
};
