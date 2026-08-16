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
const assinaturaService = require('./assinaturaService');

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


/**
 * A DIRECT_URL LIGA mesmo?
 *
 * Ler o texto do URL não chega, e depois de uma rotação de senha é precisamente
 * onde isto falha: a senha aparece em DUAS variáveis, quem atualiza só a
 * DATABASE_URL vê a plataforma a funcionar na mesma — porque é essa que a
 * aplicação usa — e a DIRECT_URL fica para trás com a senha antiga. O que parte
 * são as migrações no deploy seguinte e a cópia de segurança da noite. Ambas em
 * silêncio, ambas descobertas tarde.
 *
 * Por isso abre-se mesmo uma ligação. Custa uma sessão curta, numa página que só
 * o Admin do Sistema vê.
 */
async function testarLigacaoDireta() {
  const url = config.database.directUrl;
  if (!url) return 'não definida';
  // Se for a mesma string da aplicação, já sabemos que liga: o processo está de pé.
  if (url === config.database.url) return null;

  const { PrismaClient } = require('@prisma/client');
  const cliente = new PrismaClient({ datasources: { db: { url } } });
  try {
    await Promise.race([
      cliente.$queryRaw`SELECT 1`,
      new Promise((_, rej) => setTimeout(() => rej(new Error('a ligação não respondeu em 8 segundos')), 8000)),
    ]);
    return null;
  } catch (err) {
    return explicarLigacao(err.message);
  } finally {
    await cliente.$disconnect().catch(() => {});
  }
}

// O erro cru do Postgres/Supabase não diz o que fazer. Estes três cobrem quase tudo.
function explicarLigacao(mensagem) {
  const m = String(mensagem || '');
  if (/authentication failed|autentica|credentials .* not valid|senha/i.test(m)) {
    return 'a senha foi RECUSADA — depois de rodar a senha do Supabase é preciso atualizar as DUAS '
      + 'variáveis; esta ficou com a antiga';
  }
  if (/Tenant or user not found/i.test(m)) {
    return 'o utilizador não foi reconhecido pelo pooler — confirme o formato postgres.<ref> no URL';
  }
  if (/ENOTFOUND|EAI_AGAIN|ETIMEDOUT|não respondeu/i.test(m)) {
    return `o servidor não respondeu (${m.slice(0, 80)}) — confirme o host e a porta`;
  }
  return m.slice(0, 160);
}

async function verBaseDeDados() {
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
    const problema = await testarLigacaoDireta();
    checks.push(problema
      ? { id: 'db-direct', titulo: 'Ligação direta (DIRECT_URL)', estado: FALHA,
        detalhe: `Aponta para ${direta.host}:5432, mas NÃO liga: ${problema}.`,
        acao: 'As migrações e a cópia de segurança usam esta ligação, e mais nada — a plataforma '
          + 'continua a funcionar sem ela, o que faz com que a avaria só se note no deploy seguinte '
          + 'ou na noite em que a cópia devia correr. Corrija e reinicie o serviço.' }
      : { id: 'db-direct', titulo: 'Ligação direta (DIRECT_URL)', estado: OK,
        detalhe: `Pooler de sessão em ${direta.host}:5432 — ligação confirmada.` });
  }

  return checks;
}

// --- Armazenamento ----------------------------------------------------------
/**
 * Quantos ficheiros já estão no disco do contentor — ou seja, quantos se perdem
 * no próximo reinício.
 *
 * Um URL local começa por /api/uploads/; um que esteja no bucket começa por
 * https://. A distinção é essa e não há outra: a base guarda o URL tal como o
 * storageService o devolveu na altura.
 *
 * Existe porque "o disco é apagado a cada reinício" é uma frase que não move
 * ninguém. "Tem 7 comprovativos de pagamento e 12 documentos de credenciamento
 * neste disco" move.
 */
const LOCAL = { startsWith: '/api/uploads/' };

async function ficheirosEmRisco() {
  try {
    const [comprovativos, subscricoes, documentos, apolices, fichas] = await Promise.all([
      prisma.payment.count({ where: { proofUrl: LOCAL } }),
      prisma.planoCobranca.count({ where: { comprovativoUrl: LOCAL } }),
      prisma.companyDocument.count({ where: { fileUrl: LOCAL } }),
      prisma.supplierToKiximaPolicy.count({ where: { documentUrl: LOCAL } }),
      prisma.productDocument.count({ where: { fileUrl: LOCAL } }),
    ]);
    return { comprovativos: comprovativos + subscricoes, documentos, apolices, fichas,
      total: comprovativos + subscricoes + documentos + apolices + fichas };
  } catch {
    // Uma contagem que falha não pode calar o aviso — o aviso é o que importa.
    return null;
  }
}

// Ordenado por gravidade do que se perde, não por número: um comprovativo de
// pagamento vale mais do que uma ficha técnica que o fornecedor volta a enviar.
function descreverRisco(r) {
  if (!r || r.total === 0) return '';
  const partes = [];
  if (r.comprovativos) partes.push(`${r.comprovativos} comprovativo(s) de pagamento`);
  if (r.documentos) partes.push(`${r.documentos} documento(s) de credenciamento`);
  if (r.apolices) partes.push(`${r.apolices} apólice(s)`);
  if (r.fichas) partes.push(`${r.fichas} ficha(s) técnica(s)`);
  return ` NESTE MOMENTO estão em risco: ${partes.join(', ')}.`;
}

async function verArmazenamento() {
  const emFalta = config.storage.missing || [];
  if (config.storage.provider !== 's3') {
    const risco = await ficheirosEmRisco();
    return [{ id: 'storage', titulo: 'Armazenamento de ficheiros', estado: FALHA,
      detalhe: 'A guardar no disco do contentor, que é apagado a cada deploy e a cada arranque depois de suspensão.'
        + descreverRisco(risco),
      acao: 'Defina STORAGE_PROVIDER=s3 e as credenciais do Supabase Storage (receita no DEPLOY.md). '
        + 'O que se perde não é decorativo: os COMPROVATIVOS DE TRANSFERÊNCIA são a prova inteira que sustenta '
        + 'o "pagamento garantido", e a certidão comercial, o alvará e a licença ANPG são o que justificou '
        + 'aprovar cada empresa. Quando desaparecem, a base continua a apontar para o URL e o pedido devolve '
        + '404 sem registar erro nenhum — só se descobre no dia em que há uma disputa.' }];
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
  const expressao = config.limparValor(process.env.BACKUP_CRON);
  const checks = [];

  if (!expressao) {
    // "Em falta" aqui significa uma coisa muito precisa: esta VARIÁVEL NÃO
    // CHEGOU A ESTE PROCESSO. Quem já a definiu no painel e vê esta mensagem
    // está quase sempre num de dois casos — o serviço não reiniciou depois de
    // guardar, ou a variável foi para outro sítio. Dizer só "em falta" manda a
    // pessoa redefinir uma variável que já está definida.
    checks.push({ id: 'backup-cron', titulo: 'Cópia de segurança automática', estado: FALHA,
      detalhe: 'Não está agendada — a variável BACKUP_CRON não chegou a este processo.',
      acao: 'Se ainda não a definiu: BACKUP_CRON=0 3 * * * (cinco campos, sem aspas) dá uma cópia '
        + 'diária às 03:00 UTC. Se JÁ a definiu no Render e continua a ver isto, a variável é lida '
        + 'uma única vez no arranque: guardar no painel não basta, o serviço tem de reiniciar '
        + '(Manual Deploy → Deploy latest commit, ou Restart service). Confirme também que ficou no '
        + 'serviço certo e que o nome não tem espaços nem letras minúsculas.' });
  } else if (!cron.validate(expressao)) {
    // A causa mais comum, de longe: aspas copiadas junto com o exemplo. O
    // Render guarda o valor literalmente, aspas incluídas, e o node-cron
    // rejeita-o — sem que se perceba porquê, porque no painel "parece" certo.
    const temAspas = /["']/.test(expressao);
    const temTravessao = /[–—∗]/.test(expressao);
    checks.push({ id: 'backup-cron', titulo: 'Cópia de segurança automática', estado: FALHA,
      detalhe: `A expressão ${JSON.stringify(expressao)} não é válida — a cópia automática não corre.`,
      acao: (temAspas
        ? 'O valor tem ASPAS. O Render guarda-as como parte do valor e a expressão deixa de ser válida — '
          + 'escreva 0 3 * * * sem aspas nenhumas. '
        : temTravessao
          ? 'O valor tem caracteres que não são asteriscos simples (provavelmente autocorreção ao copiar). '
            + 'Reescreva à mão: 0 3 * * * . '
          : '')
        + 'Formato: cinco campos separados por espaços — minuto hora dia-do-mês mês dia-da-semana. '
        + 'Não são aceites @daily nem o caractere ? — o node-cron rejeita ambos. '
        + 'Depois de corrigir, reinicie o serviço: a expressão só é lida no arranque.' });
  } else {
    checks.push({ id: 'backup-cron', titulo: 'Cópia de segurança automática', estado: OK,
      detalhe: `Agendada: ${expressao} (UTC), com recuperação automática se falhar a janela.` });
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
        ? `Já passaram ${Math.floor(horas)} horas, e a recuperação automática também não a repôs. `
          + 'Verifique o registo do serviço: a cópia está a falhar, não a ser adiada.'
        : undefined });

    // A escrita não prova que a cópia se lê. Enquanto ninguém a tiver lido de
    // volta, o que existe é a suposição de que existe.
    const verificada = await prisma.auditLog.findFirst({
      where: { action: 'COPIA_SEGURANCA_VERIFICADA' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }).catch(() => null);

    checks.push({ id: 'backup-legivel', titulo: 'A cópia foi lida de volta',
      estado: verificada ? OK : AVISO,
      detalhe: verificada
        ? `Confirmada a ${new Date(verificada.createdAt).toISOString().slice(0, 16).replace('T', ' ')} UTC.`
        : 'Nunca foi confirmado que a cópia se lê — só que se escreve.',
      acao: verificada
        ? undefined
        : 'Use "Verificar a última cópia": vai buscá-la ao bucket, descomprime-a e confirma que traz '
          + 'a base toda. Um objeto truncado ou um gzip corrompido são indistinguíveis de uma cópia '
          + 'boa até alguém tentar lê-los.' });
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

  // O APP_URL importa MENOS do que o aviso original dizia. Tanto o link do
  // convite como o da recuperação de senha usam a mesma cadeia —
  // `APP_URL || host real do pedido || fallback` — e o host real do pedido faz
  // com que saiam certos mesmo sem o APP_URL definido.
  // O que o APP_URL faz mesmo: é a única entrada da allow-list de CORS, é o
  // valor que manda quando houver domínio próprio, e é o único que serve se
  // algum dia um email for enviado fora do contexto de um pedido (um job).
  const app = String(config.appUrl || '');
  if (/localhost|127\.0\.0\.1/.test(app)) {
    checks.push({ id: 'app-url', titulo: 'Endereço público (APP_URL)', estado: AVISO, detalhe: app,
      acao: 'Ainda aponta para localhost. Os links dos convites saem certos mesmo assim, porque são '
        + 'construídos a partir do endereço real do pedido — mas o APP_URL é a única entrada da '
        + 'allow-list de CORS e é o valor que manda assim que ligar um domínio próprio. Defina-o com '
        + 'o endereço real do serviço.' });
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

  // Uma data que o servidor não consegue ler é PIOR do que não ter data: no
  // painel a variável parece estar definida, e a 2FA nunca chega a ser exigida.
  if (config.auth.mfaEnforceFromInvalido) {
    checks.push({ id: 'mfa-prazo', titulo: '2FA obrigatória (MFA_ENFORCE_FROM)', estado: FALHA,
      detalhe: `O valor ${JSON.stringify(config.auth.mfaEnforceFromInvalido)} não é uma data — está a ser ignorado, e a 2FA NÃO é exigida a ninguém.`,
      acao: 'Escreva a data no formato ISO, sem aspas: 2026-09-15T00:00:00Z (ou só 2026-09-15). '
        + 'Formatos como 15/09/2026 não são lidos. Depois de corrigir, reinicie o serviço.' });
  } else if (!prazo) {
    checks.push({ id: 'mfa-prazo', titulo: '2FA obrigatória (MFA_ENFORCE_FROM)', estado: AVISO,
      detalhe: 'Sem data definida — a 2FA é só um aviso e nunca é exigida.',
      acao: `Defina MFA_ENFORCE_FROM com uma data futura no formato 2026-09-15T00:00:00Z (sem aspas), para dar prazo a ${perfis.join(' e ')} configurarem a 2FA antes de passar a ser obrigatória.` });
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

// --- Contas bloqueadas ------------------------------------------------------
/**
 * Contas bloqueadas por tentativas falhadas, AGORA.
 *
 * O titular de cada uma recebe um email, mas isso avisa uma pessoa de cada vez.
 * Alguém a varrer a plataforma inteira aparece aqui como um número — e é o
 * número que diz que não é um utilizador distraído.
 */
async function verContasBloqueadas() {
  const bloqueio = require('./loginAttemptService');
  let contas;
  try {
    contas = await bloqueio.bloqueadasAgora();
  } catch (err) {
    return [{ id: 'bloqueios', titulo: 'Contas bloqueadas por tentativas falhadas', estado: AVISO,
      detalhe: `Não foi possível contar: ${err.message}` }];
  }
  if (contas.length === 0) {
    return [{ id: 'bloqueios', titulo: 'Contas bloqueadas por tentativas falhadas', estado: OK,
      detalhe: 'Nenhuma neste momento.' }];
  }
  // Uma conta bloqueada é normal (alguém enganou-se). Várias ao mesmo tempo não é.
  const varias = contas.length > 2;
  return [{ id: 'bloqueios', titulo: 'Contas bloqueadas por tentativas falhadas',
    estado: varias ? AVISO : OK,
    detalhe: `${contas.length} conta(s): ${contas.map((c) => c.email).join(', ')}.`,
    acao: varias
      ? 'Várias contas bloqueadas ao mesmo tempo não é distração — é alguém a varrer a plataforma. '
        + 'Os titulares já foram avisados por email; confirme com eles e considere antecipar o prazo da 2FA.'
      : undefined }];
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

// --- Cobranças de subscrição -------------------------------------------------
/**
 * Os dados bancários para onde as empresas transferem a subscrição.
 *
 * Falha silenciosa clássica: sem o IBAN, a página de subscrição continua a
 * emitir cobranças e a pedir o comprovativo, mas não diz para onde transferir.
 * Ninguém vê um erro — vê-se dinheiro que não chega, semanas depois, sem se
 * perceber porquê. O IBAN não é segredo (é para ser dado a quem paga), por isso
 * é o único valor que esta página mostra por inteiro; e mostra-o de propósito,
 * para se poder CONFERIR que está certo, e não só que está preenchido.
 */
function verCobrancas() {
  const b = assinaturaService.dadosBancarios();
  if (!b.configurado) {
    return [{ id: 'iban', titulo: 'Dados bancários para as subscrições', estado: FALHA,
      detalhe: 'KIXIMA_BANCO_IBAN não está definido.',
      acao: 'Defina KIXIMA_BANCO_IBAN (e, se quiser, KIXIMA_BANCO_TITULAR, KIXIMA_BANCO_NOME, '
        + 'KIXIMA_BANCO_SWIFT e KIXIMA_BANCO_MOEDA). Sem o IBAN, quem pede um plano lê "transfira o valor" '
        + 'e não tem para onde.' }];
  }
  const faltam = ['titular', 'banco', 'swift'].filter((k) => !b[k]);
  return [{ id: 'iban', titulo: 'Dados bancários para as subscrições',
    estado: faltam.length ? AVISO : OK,
    detalhe: `IBAN ${b.iban} · ${b.moeda}${b.banco ? ` · ${b.banco}` : ''}${b.titular ? ` · ${b.titular}` : ''}. `
      + 'Confira que é a conta certa — é este o número que as empresas vão usar.',
    acao: faltam.length
      ? `Por preencher: ${faltam.join(', ')}. Uma transferência internacional costuma exigir o SWIFT e o titular.`
      : undefined }];
}

/**
 * Estado de prontidão do ambiente onde este processo corre.
 * Nunca devolve o valor de nenhum segredo.
 */
/**
 * Faturação certificada e canais de pagamento.
 *
 * Estas duas coisas partilham a pior propriedade possível: por omissão estão
 * desligadas e a plataforma funciona na mesma. Ninguém recebe erro nenhum — as
 * faturas saem sem série, os pagamentos continuam a ser conferidos à mão, e a
 * ausência só se nota numa inspeção ou quando o volume cresce. Por isso
 * aparecem aqui: para serem uma decisão tomada e não uma omissão descoberta.
 */
function verFaturacao() {
  const checks = [];
  const f = config.faturacao;

  if (!f.serie) {
    checks.push({ id: 'agt-serie', titulo: 'Série de faturação (KIXIMA_SERIE_FATURACAO)', estado: AVISO,
      detalhe: 'Não está definida — as faturas saem sem numeração certificada.',
      acao: 'Defina-a SÓ depois de a série estar declarada à AGT. Ligá-la antes disso emite documentos numa série que não existe, e a numeração não se corrige para trás.' });
  } else {
    checks.push({ id: 'agt-serie', titulo: 'Série de faturação', estado: OK, detalhe: f.serie,
      acao: 'Confirme em Faturação → Integridade que a cadeia não tem buracos.' });
  }

  checks.push(f.nif
    ? { id: 'agt-nif', titulo: 'NIF da KIXIMA (KIXIMA_NIF)', estado: OK, detalhe: f.nif }
    : { id: 'agt-nif', titulo: 'NIF da KIXIMA (KIXIMA_NIF)', estado: AVISO,
      detalhe: 'Não está definido.',
      acao: 'O SAF-T sai com o campo por preencher. É preferível a um número inventado, mas a AGT recusa o ficheiro assim.' });

  checks.push(f.certificadoAgt
    ? { id: 'agt-certificado', titulo: 'Certificado do programa (AGT)', estado: OK, detalhe: f.certificadoAgt }
    : { id: 'agt-certificado', titulo: 'Certificado do programa (AGT)', estado: AVISO,
      detalhe: 'Ainda não atribuído.',
      acao: 'Sai do processo de certificação junto da AGT. Fica vazio até existir — um número de certificado inventado num ficheiro fiscal é uma declaração falsa.' });

  return checks;
}

function verCanaisDePagamento() {
  const multicaixa = require('./multicaixaService');
  const checks = [];

  checks.push({ id: 'pag-manual', titulo: 'Transferência com comprovativo', estado: OK,
    detalhe: 'Sempre disponível.',
    acao: 'É a alternativa que fica de pé quando um canal automático falha — não a desligue.' });

  const iban = process.env.KIXIMA_BANCO_IBAN;
  checks.push(iban
    ? { id: 'pag-referencia', titulo: 'Referência bancária', estado: OK,
      detalhe: 'Cada fatura recebe uma referência única, conciliada pelo extrato.' }
    : { id: 'pag-referencia', titulo: 'Referência bancária (KIXIMA_BANCO_IBAN)', estado: FALHA,
      detalhe: 'O IBAN não está definido.',
      acao: 'Sem ele a plataforma gera a referência mas não tem para onde dizer que se transfira — o comprador vê uma referência e nenhuma conta.' });

  const m = multicaixa.estado();
  checks.push(m.disponivel
    ? { id: 'pag-multicaixa', titulo: 'Multicaixa Express', estado: OK, detalhe: 'Configurado.' }
    : { id: 'pag-multicaixa', titulo: 'Multicaixa Express', estado: AVISO,
      detalhe: m.nota,
      acao: `Requer contrato com a EMIS. Em falta: ${m.emFalta.join(', ')}. Sem isto o canal recusa-se a funcionar em vez de simular — que é o comportamento certo.` });

  return checks;
}

async function verificar() {
  const [copias, mfa, baseDeDados, armazenamento, contas] = await Promise.all([
    verCopias(), verMfa(), verBaseDeDados(), verArmazenamento(), verContasBloqueadas(),
  ]);
  const grupos = [
    { grupo: 'Base de dados', checks: baseDeDados },
    { grupo: 'Armazenamento', checks: armazenamento },
    { grupo: 'Cópias de segurança', checks: copias },
    { grupo: 'Email', checks: verEmail() },
    { grupo: 'Autenticação de dois fatores', checks: mfa },
    { grupo: 'Segredos', checks: verSegredos() },
    { grupo: 'Contas sob ataque', checks: contas },
    { grupo: 'Cobranças de subscrição', checks: verCobrancas() },
    { grupo: 'Faturação certificada (AGT)', checks: verFaturacao() },
    { grupo: 'Canais de pagamento', checks: verCanaisDePagamento() },
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
