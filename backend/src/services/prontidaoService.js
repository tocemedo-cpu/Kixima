// src/services/prontidaoService.js
// Prontidão para produção — o que está mesmo configurado no ambiente em que
// este processo está a correr.
//
// Porquê existir: as definições que protegem a plataforma (armazenamento,
// cópias de segurança, envio de email, 2FA obrigatória) vivem todas em
// variáveis de ambiente, definidas noutro sítio — o painel do Render. Uma
// variável mal escrita, deixada em branco ou esquecida não dá erro: a aplicação
// arranca na mesma e comporta-se como se estivesse tudo bem. Os emails ficam no
// log, os ficheiros vão para um disco que é apagado, a cópia de segurança nunca
// corre.
//
// O plano gratuito do Render não dá shell, por isso não há como ir lá dentro
// confirmar. Este serviço é a forma de confirmar: lê o que o processo tem
// realmente carregado e diz, por palavras, o que falta e o que fazer.
//
// REGRA: nunca devolve o VALOR de um segredo. Diz que existe, que tamanho tem,
// ou que está em falta — nunca o conteúdo. Quem vê esta página é o Admin do
// Sistema, mas uma chave num ecrã é uma chave que sai da consola.
const cron = require('node-cron');
const { spawnSync } = require('child_process');
const config = require('../config/env');
const prisma = require('../config/database');
const storage = require('./storageService');

const OK = 'ok';          // está feito
const AVISO = 'aviso';    // funciona, mas não é o que se quer em produção
const FALHA = 'falha';    // não funciona, ou funciona a fingir

// --- Base de dados ----------------------------------------------------------
// O Supabase tem três formas de ligação e só duas servem. O host direto
// (`db.<ref>.supabase.co`) só resolve em IPv6 e o Render não tem IPv6 — dá
// P1001 "can't reach database server", que não sugere nada disto.
function analisarLigacao(url) {
  if (!url) return null;
  const m = String(url).match(/@([^:/?]+)(?::(\d+))?/);
  return { host: m?.[1] || null, porta: m?.[2] ? Number(m[2]) : null, pgbouncer: /pgbouncer=true/.test(url) };
}

function verBaseDeDados() {
  const app = analisarLigacao(config.database.url);
  const direta = analisarLigacao(config.database.directUrl);
  const checks = [];

  if (!app) {
    checks.push({ id: 'db-url', titulo: 'Ligação da aplicação (DATABASE_URL)', estado: FALHA,
      detalhe: 'Não está definida.', acao: 'Defina DATABASE_URL com o pooler de TRANSAÇÃO do Supabase (porta 6543).' });
  } else if (/^db\..*\.supabase\.co$/.test(app.host)) {
    checks.push({ id: 'db-url', titulo: 'Ligação da aplicação (DATABASE_URL)', estado: FALHA,
      detalhe: `Usa o host direto ${app.host}, que só resolve em IPv6.`,
      acao: 'Troque pelo host do pooler (aws-0-<região>.pooler.supabase.com), porta 6543, com ?pgbouncer=true&sslmode=require.' });
  } else if (app.porta !== 6543 || !app.pgbouncer) {
    checks.push({ id: 'db-url', titulo: 'Ligação da aplicação (DATABASE_URL)', estado: AVISO,
      detalhe: `Ligada a ${app.host}:${app.porta}${app.pgbouncer ? ' com pgbouncer' : ' sem pgbouncer=true'}.`,
      acao: 'Em produção use o pooler de transação: porta 6543 e ?pgbouncer=true&sslmode=require. Sem ele, o número de ligações esgota-se com o tráfego.' });
  } else {
    checks.push({ id: 'db-url', titulo: 'Ligação da aplicação (DATABASE_URL)', estado: OK,
      detalhe: `Pooler de transação em ${app.host}:6543.` });
  }

  if (!direta) {
    checks.push({ id: 'db-direct', titulo: 'Ligação direta (DIRECT_URL)', estado: FALHA,
      detalhe: 'Não está definida.',
      acao: 'Defina DIRECT_URL com o pooler de SESSÃO (mesmo host, porta 5432). As migrações e a cópia de segurança precisam dela — o pooler de transação não serve para nenhuma das duas.' });
  } else if (direta.porta !== 5432) {
    checks.push({ id: 'db-direct', titulo: 'Ligação direta (DIRECT_URL)', estado: FALHA,
      detalhe: `Aponta para a porta ${direta.porta}.`,
      acao: 'A DIRECT_URL tem de ser o pooler de SESSÃO, na porta 5432. Na 6543 o pg_dump falha a meio e as migrações não aplicam.' });
  } else {
    checks.push({ id: 'db-direct', titulo: 'Ligação direta (DIRECT_URL)', estado: OK,
      detalhe: `Pooler de sessão em ${direta.host}:5432.` });
  }

  return checks;
}

// --- Armazenamento ----------------------------------------------------------
function verArmazenamento() {
  const emFalta = config.storage.missing || [];
  if (config.storage.provider !== 's3') {
    return [{ id: 'storage', titulo: 'Armazenamento de ficheiros', estado: FALHA,
      detalhe: 'A guardar no disco do contentor.',
      acao: 'Defina STORAGE_PROVIDER=s3 e as credenciais do Supabase Storage. O disco do contentor é apagado a cada reinício: as fotos do catálogo e os documentos de credenciamento desaparecem.' }];
  }
  if (emFalta.length) {
    // O secret do Supabase é mostrado UMA única vez, no momento em que a chave
    // é criada. Quem fechou o painel não o recupera — tem de gerar outra. É a
    // causa mais provável de faltar só o secret, e não dizê-lo deixa a pessoa
    // à procura de um valor que já não existe em lado nenhum.
    const soOSecret = emFalta.length === 1 && emFalta[0] === 'STORAGE_SECRET_KEY';
    return [{ id: 'storage', titulo: 'Armazenamento de ficheiros', estado: FALHA,
      detalhe: `S3 ativo mas faltam: ${emFalta.join(', ')}.`,
      acao: (soOSecret
        ? 'O Supabase mostra a chave secreta UMA única vez, quando a cria — se fechou o painel, não a recupera. '
          + 'Em Project Settings → Storage → S3 access keys crie uma nova e atualize as DUAS variáveis '
          + '(STORAGE_ACCESS_KEY e STORAGE_SECRET_KEY), depois apague a antiga. '
        : 'Preencha essas variáveis (Supabase → Project Settings → Storage → S3 access keys). ')
        + 'Uma variável criada mas deixada EM BRANCO conta como ausente. Reinicie o serviço depois de guardar — '
        + 'enquanto faltarem, os ficheiros vão para o disco do contentor e desaparecem no reinício seguinte.' }];
  }
  return [{ id: 'storage', titulo: 'Armazenamento de ficheiros', estado: OK,
    detalhe: `S3 ativo no bucket "${config.storage.bucket}".` }];
}

// --- Cópias de segurança ----------------------------------------------------
function temPgDump() {
  const r = spawnSync('pg_dump', ['--version'], { encoding: 'utf8' });
  return r.status === 0 ? String(r.stdout).trim() : null;
}

async function versaoDoServidor() {
  try {
    const r = await prisma.$queryRaw`SHOW server_version`;
    return r?.[0]?.server_version || null;
  } catch { return null; }
}

async function verCopias() {
  const expressao = process.env.BACKUP_CRON;
  const checks = [];

  if (!expressao) {
    checks.push({ id: 'backup-cron', titulo: 'Cópia de segurança automática', estado: FALHA,
      detalhe: 'Não está agendada (BACKUP_CRON em falta).',
      acao: 'Defina BACKUP_CRON, por exemplo "0 3 * * *" para uma cópia diária às 03:00 UTC. Sem isto, o histórico de ordens, faturas e pagamentos existe num único sítio.' });
  } else if (!cron.validate(expressao)) {
    checks.push({ id: 'backup-cron', titulo: 'Cópia de segurança automática', estado: FALHA,
      detalhe: `A expressão "${expressao}" não é válida.`,
      acao: 'Use o formato de 5 campos: minuto hora dia mês dia-da-semana. Ex.: "0 3 * * *".' });
  } else {
    checks.push({ id: 'backup-cron', titulo: 'Cópia de segurança automática', estado: OK,
      detalhe: `Agendada: ${expressao} (UTC).` });
  }

  const bucket = config.storage.backupBucket;
  if (!bucket) {
    checks.push({ id: 'backup-bucket', titulo: 'Bucket das cópias (STORAGE_BACKUP_BUCKET)', estado: FALHA,
      detalhe: 'Não está definido.',
      acao: 'Crie um bucket PRIVADO só para cópias e indique-o aqui. As cópias não podem ir para o bucket das imagens: esse é público, e um dump da base tem hashes de senha, os dados de todas as empresas e o histórico financeiro.' });
  } else if (bucket === config.storage.bucket) {
    checks.push({ id: 'backup-bucket', titulo: 'Bucket das cópias (STORAGE_BACKUP_BUCKET)', estado: FALHA,
      detalhe: 'É o mesmo bucket das imagens, que é público.',
      acao: 'Crie um bucket separado e PRIVADO. Neste estado a cópia automática recusa-se a correr — de propósito.' });
  } else {
    checks.push({ id: 'backup-bucket', titulo: 'Bucket das cópias (STORAGE_BACKUP_BUCKET)', estado: OK,
      detalhe: `Bucket separado "${bucket}".` });
  }

  const versao = temPgDump();
  if (!versao) {
    checks.push({ id: 'pg-dump', titulo: 'Ferramenta de cópia (pg_dump)', estado: FALHA,
      detalhe: 'Não está instalada nesta imagem.',
      acao: 'A imagem precisa do pacote postgresql-client. Sem ele a cópia falha todas as noites e a aplicação continua a dar sinal de estar tudo bem.' });
  } else {
    // O pg_dump recusa-se a copiar um servidor MAIS RECENTE do que ele. É uma
    // incompatibilidade que não se vê em lado nenhum até à noite em que a cópia
    // devia correr, e a mensagem que dá ("server version mismatch") não sugere
    // que o problema está na imagem e não na base.
    const clienteMaior = Number(String(versao).match(/(\d+)\./)?.[1]);
    const servidor = await versaoDoServidor();
    const servidorMaior = servidor ? Number(String(servidor).match(/^(\d+)/)?.[1]) : null;

    if (servidorMaior && clienteMaior && clienteMaior < servidorMaior) {
      checks.push({ id: 'pg-dump', titulo: 'Ferramenta de cópia (pg_dump)', estado: FALHA,
        detalhe: `Cliente ${clienteMaior} contra servidor PostgreSQL ${servidor} — o pg_dump recusa-se a copiar um servidor mais recente do que ele.`,
        acao: `A imagem precisa do cliente ${servidorMaior} ou superior (no Dockerfile, postgresql${servidorMaior}-client em vez de postgresql-client).` });
    } else {
      checks.push({ id: 'pg-dump', titulo: 'Ferramenta de cópia (pg_dump)', estado: OK,
        detalhe: servidor ? `${versao} — servidor PostgreSQL ${servidor}` : versao });
    }
  }

  // A falha mais traiçoeira: estava tudo configurado e a cópia deixou de correr
  // sem ninguém reparar. Por isso a última cópia com sucesso é um dado de
  // primeira ordem, e não uma curiosidade.
  const ultima = await prisma.auditLog.findFirst({
    where: { action: 'COPIA_SEGURANCA_CONCLUIDA' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, detail: true },
  }).catch(() => null);

  if (!ultima) {
    checks.push({ id: 'backup-ultima', titulo: 'Última cópia com sucesso', estado: expressao ? AVISO : FALHA,
      detalhe: 'Ainda não há nenhuma cópia registada.',
      acao: 'Use o botão "Fazer cópia agora" para confirmar que tudo funciona antes de confiar no agendamento. Uma cópia que nunca correu não é uma cópia.' });
  } else {
    const horas = (Date.now() - new Date(ultima.createdAt).getTime()) / 36e5;
    checks.push({ id: 'backup-ultima', titulo: 'Última cópia com sucesso',
      estado: horas > 48 ? FALHA : OK,
      detalhe: `${new Date(ultima.createdAt).toISOString().slice(0, 16).replace('T', ' ')} UTC`
        + (ultima.detail?.megabytes ? ` — ${ultima.detail.megabytes} MB` : ''),
      acao: horas > 48
        ? `Já passaram ${Math.floor(horas)} horas. Verifique o registo do serviço: a cópia pode estar a falhar em silêncio.`
        : undefined });
  }

  return checks;
}

// --- Email ------------------------------------------------------------------
function verEmail() {
  const checks = [];
  if (config.email.apenasLog) {
    checks.push({ id: 'email', titulo: 'Envio de email', estado: FALHA,
      detalhe: 'EMAIL_PROVIDER=console — nada é enviado, tudo fica no registo.',
      acao: 'Defina EMAIL_PROVIDER=brevo e BREVO_API_KEY. Neste estado os convites, a recuperação de senha e os avisos de fatura nunca chegam a ninguém, e não aparece erro nenhum.' });
  } else if (config.email.missing.length) {
    checks.push({ id: 'email', titulo: 'Envio de email', estado: FALHA,
      detalhe: `Provider "${config.email.provider}" configurado mas faltam: ${config.email.missing.join(', ')}.`,
      acao: 'Preencha essas variáveis e reinicie o serviço.' });
  } else {
    checks.push({ id: 'email', titulo: 'Envio de email', estado: OK,
      detalhe: `Provider "${config.email.provider}" configurado.` });
  }

  const remetente = String(config.email.from || '');
  checks.push(remetente
    ? { id: 'email-from', titulo: 'Remetente (EMAIL_FROM)', estado: OK, detalhe: remetente,
      acao: 'Confirme que este endereço está VERIFICADO na conta Brevo — se não estiver, o envio é recusado.' }
    : { id: 'email-from', titulo: 'Remetente (EMAIL_FROM)', estado: FALHA, detalhe: 'Não está definido.',
      acao: 'Defina EMAIL_FROM com um remetente verificado na conta Brevo.' });

  // Os emails levam links para a plataforma. Se APP_URL ficar em localhost, os
  // links saem para fora a apontar para o computador de quem os recebe.
  const app = String(config.appUrl || '');
  if (/localhost|127\.0\.0\.1/.test(app)) {
    checks.push({ id: 'app-url', titulo: 'Endereço público (APP_URL)', estado: FALHA, detalhe: app,
      acao: 'Defina APP_URL com o endereço real da plataforma. Os links dos convites e da recuperação de senha são construídos a partir daqui — em localhost, não funcionam para ninguém.' });
  } else {
    checks.push({ id: 'app-url', titulo: 'Endereço público (APP_URL)', estado: OK, detalhe: app });
  }

  return checks;
}

// --- 2FA obrigatória --------------------------------------------------------
async function verMfa() {
  const checks = [];
  const perfis = config.auth.mfaRequiredRoles;
  const prazo = config.auth.mfaEnforceFrom;

  // Quantas contas com poder ainda não têm 2FA. É o número que decide se a data
  // de entrada em vigor tranca alguém à porta.
  const emFalta = await prisma.user.count({
    where: { role: { in: perfis }, active: true, totpEnabledAt: null },
  }).catch(() => null);

  if (!prazo) {
    checks.push({ id: 'mfa-prazo', titulo: '2FA obrigatória (MFA_ENFORCE_FROM)', estado: AVISO,
      detalhe: 'Sem data definida — a 2FA é só um aviso e nunca é exigida.',
      acao: `Defina MFA_ENFORCE_FROM com uma data futura (ex.: 2026-09-15T00:00:00Z), para dar prazo a ${perfis.join(' e ')} configurarem a 2FA antes de passar a ser obrigatória.` });
  } else {
    const passou = new Date() >= prazo;
    const data = prazo.toISOString().slice(0, 10);
    checks.push({ id: 'mfa-prazo', titulo: '2FA obrigatória (MFA_ENFORCE_FROM)',
      estado: passou && emFalta ? AVISO : OK,
      detalhe: passou ? `Em vigor desde ${data}.` : `Entra em vigor a ${data}.`,
      acao: passou && emFalta
        ? `${emFalta} conta(s) ainda sem 2FA: a sessão delas só dá acesso ao ecrã de ativação. Avise essas pessoas.`
        : undefined });
  }

  checks.push({ id: 'mfa-contas', titulo: 'Contas com poder sem 2FA',
    estado: emFalta === null ? AVISO : emFalta === 0 ? OK : AVISO,
    detalhe: emFalta === null ? 'Não foi possível contar.'
      : emFalta === 0 ? `Nenhuma. Todos os perfis ${perfis.join(' e ')} têm 2FA ativa.`
        : `${emFalta} de perfil ${perfis.join(' ou ')}.`,
    acao: emFalta ? 'Cada pessoa ativa a sua em Configurações → Segurança. Ninguém pode fazê-lo por ela — é esse o ponto.' : undefined });

  return checks;
}

// --- Segredos ---------------------------------------------------------------
function verSegredos() {
  const s = String(config.auth.jwtSecret || '');
  if (!s || s === 'CHANGE_ME') {
    return [{ id: 'jwt', titulo: 'Chave de assinatura das sessões (JWT_SECRET)', estado: FALHA,
      detalhe: 'Em falta ou por preencher.',
      acao: 'Defina um valor aleatório longo. Com uma chave conhecida, qualquer pessoa forja uma sessão de administrador.' }];
  }
  if (s.length < 32) {
    return [{ id: 'jwt', titulo: 'Chave de assinatura das sessões (JWT_SECRET)', estado: AVISO,
      detalhe: `Tem ${s.length} caracteres.`,
      acao: 'Use pelo menos 32 caracteres aleatórios. Trocá-la termina todas as sessões abertas — o que é aceitável, e por vezes desejável.' }];
  }
  return [{ id: 'jwt', titulo: 'Chave de assinatura das sessões (JWT_SECRET)', estado: OK,
    detalhe: `Definida (${s.length} caracteres).` }];
}

/**
 * Estado de prontidão do ambiente onde este processo corre.
 * Nunca devolve o valor de nenhum segredo.
 */
async function verificar() {
  const [copias, mfa] = await Promise.all([verCopias(), verMfa()]);
  const grupos = [
    { grupo: 'Base de dados', checks: verBaseDeDados() },
    { grupo: 'Armazenamento', checks: verArmazenamento() },
    { grupo: 'Cópias de segurança', checks: copias },
    { grupo: 'Email', checks: verEmail() },
    { grupo: 'Autenticação de dois fatores', checks: mfa },
    { grupo: 'Segredos', checks: verSegredos() },
  ];

  const todos = grupos.flatMap((g) => g.checks);
  return {
    ambiente: config.env,
    verificadoEm: new Date(),
    resumo: {
      total: todos.length,
      ok: todos.filter((c) => c.estado === OK).length,
      avisos: todos.filter((c) => c.estado === AVISO).length,
      falhas: todos.filter((c) => c.estado === FALHA).length,
    },
    grupos,
  };
}

module.exports = { verificar, ESTADOS: { OK, AVISO, FALHA } };
