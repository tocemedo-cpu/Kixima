// src/config/env.js
// Ponto único de leitura do ambiente. Todo o resto do código deve importar
// a config a partir daqui, nunca ler process.env diretamente noutro sítio.

const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Limpa um valor colado no painel do Render.
 *
 * O painel guarda o que lá for posto, LITERALMENTE, e a colagem traz lixo com
 * uma regularidade que já não é acidente: aspas agarradas ao exemplo
 * (`"2026-09-15T00:00:00Z"`), espaços à volta, e o próprio rótulo do formulário
 * copiado com o valor —
 *
 *     Value:
 *     2026-09-15T00:00:00Z
 *
 * Nenhum destes valores é uma data, um cron ou uma chave; todos parecem certos
 * a quem olha para o painel. Como nenhuma destas definições é multi-linha, fica
 * a última linha com conteúdo — que é sempre o valor de facto.
 */
function limpar(valor) {
  const linhas = String(valor ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const ultima = linhas.length ? linhas[linhas.length - 1] : '';
  return ultima.replace(/^["']|["']$/g, '').trim();
}

// O valor foi mesmo alterado pela limpeza? Serve para o assinalar em vez de o
// corrigir em silêncio — quem definiu a variável deve arrumá-la.
function precisouDeLimpeza(valor) {
  const cru = String(valor ?? '');
  return Boolean(cru) && cru !== limpar(cru);
}

// Data vinda do ambiente, ou null se não existir/não for uma data.
function dataDoAmbiente(valor) {
  const limpo = limpar(valor);
  if (!limpo) return null;
  const d = new Date(limpo);
  return Number.isNaN(d.getTime()) ? null : d;
}

// O valor original, quando existe mas não é uma data — para se poder dizer
// PORQUÊ, em vez de o ignorar em silêncio.
function dataInvalida(valor) {
  const limpo = limpar(valor);
  if (!limpo) return null;
  return Number.isNaN(new Date(limpo).getTime()) ? String(valor) : null;
}

const required = ['DATABASE_URL', 'JWT_SECRET'];

if (NODE_ENV === 'production') {
  const missing = required.filter((key) => !process.env[key] || process.env[key] === 'CHANGE_ME');
  if (missing.length) {
    throw new Error(
      `Configuração em falta para produção: ${missing.join(', ')}. Verifique .env.production.`
    );
  }
}

const config = {
  env: NODE_ENV,
  isProduction: NODE_ENV === 'production',
  isDevelopment: NODE_ENV === 'development',
  isTest: NODE_ENV === 'test',

  port: Number(process.env.PORT) || 4000,
  appUrl: process.env.APP_URL || 'http://localhost:4000',

  database: {
    url: process.env.DATABASE_URL,
    // Pooler de SESSÃO (porta 5432). As migrações e o pg_dump da cópia de
    // segurança precisam de uma sessão estável — nenhum dos dois funciona
    // através do pooler de transação.
    directUrl: process.env.DIRECT_URL,
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET,
    // Validade curta do access token (revogável via tokenVersion). 1 dia é um
    // compromisso entre segurança e não obrigar a login constante.
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',

    // --- 2FA obrigatória ------------------------------------------------------
    // Perfis para quem a senha não basta: aprovam ordens de compra, autorizam
    // pagamentos e credenciam empresas. Uma senha comprometida numa destas
    // contas chega para tudo.
    mfaRequiredRoles: (process.env.MFA_REQUIRED_ROLES || 'ADMIN_SISTEMA,COMPANY_ADMIN')
      .split(',').map((r) => r.trim().toUpperCase()).filter(Boolean),
    // A partir desta data a 2FA deixa de ser um aviso e passa a ser exigida.
    // Antes dela, quem ainda não a configurou entra na mesma e é avisado — dar
    // prazo é o que evita trancar administradores fora no dia do lançamento.
    // Sem a variável definida, fica só o aviso (nunca bloqueia).
    //
    // O valor é validado aqui, e não onde é usado, porque uma data inválida
    // falhava do PIOR modo possível: `new Date("lixo")` devolve um objeto que é
    // truthy, mas cuja comparação com qualquer data dá SEMPRE false. A 2FA
    // deixava de ser exigida sem nada o denunciar — e a variável, no painel,
    // parecia estar lá.
    mfaEnforceFrom: dataDoAmbiente(process.env.MFA_ENFORCE_FROM),
    // Guardado para o arranque e a página de Prontidão poderem dizer o que está
    // errado, em vez de a definição ser ignorada em silêncio.
    mfaEnforceFromInvalido: dataInvalida(process.env.MFA_ENFORCE_FROM),
  },

  // Regras de negócio — configuráveis por ambiente, nunca hardcoded no código.
  business: {
    paymentSlaDays: Number(process.env.PAYMENT_SLA_DAYS) || 7,
    policyExpiryAlertDays: Number(process.env.POLICY_EXPIRY_ALERT_DAYS) || 30,
    // Câmbio USD→AOA usado para aferir o limiar da Taxa KIXIMA (as taxas são
    // em dólares; as POs em Kwanzas). Configurável — o Kwanza flutua.
    usdAoaRate: Number(process.env.KIXIMA_USD_AOA_RATE) || 900,
  },

  email: {
    // 'console' (log), 'smtp' (nodemailer) ou 'brevo' (API HTTP do Brevo —
    // usa a porta 443, imune ao bloqueio de portas SMTP de saída no Render).
    provider: process.env.EMAIL_PROVIDER || 'console',
    from: process.env.EMAIL_FROM || 'notificacoes@kixima.co.ao',
    brevoApiKey: process.env.BREVO_API_KEY,
    smtp: {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
    },
  },

  storage: {
    // 'local' (disco, por omissão) ou 's3' (AWS S3 / Supabase Storage / R2 / MinIO).
    provider: process.env.STORAGE_PROVIDER || 'local',
    bucket: process.env.STORAGE_BUCKET,
    region: process.env.STORAGE_REGION,
    accessKey: process.env.STORAGE_ACCESS_KEY,
    secretKey: process.env.STORAGE_SECRET_KEY,
    // Endpoint S3-compatível (ex.: Supabase Storage, R2, MinIO). Vazio = AWS S3.
    endpoint: process.env.STORAGE_ENDPOINT || undefined,
    // URL público base para servir as imagens (CDN / bucket público). Se vazio,
    // é construído a partir do endpoint/bucket ou do host AWS.
    publicUrl: process.env.STORAGE_PUBLIC_URL || undefined,
    // Bucket SEPARADO para as cópias de segurança. O bucket das imagens tem de
    // ser público (é dele que o marketplace serve as fotos do catálogo) — e um
    // dump da base guardado num bucket público fica descarregável por quem
    // souber o URL, com hashes de senha, dados de todas as empresas e o
    // histórico financeiro lá dentro. Sem esta variável a cópia automática
    // recusa-se a correr.
    backupBucket: process.env.STORAGE_BACKUP_BUCKET,
    // path-style é necessário para a maioria dos S3-compatíveis (Supabase/MinIO).
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE
      ? process.env.STORAGE_FORCE_PATH_STYLE === 'true'
      : Boolean(process.env.STORAGE_ENDPOINT),
  },

  logLevel: process.env.LOG_LEVEL || 'info',

  // Rastreio de erros (Sentry) — inativo se SENTRY_DSN não estiver definido.
  sentry: {
    dsn: process.env.SENTRY_DSN || '',
    // Amostragem de performance (0 = desligado). Erros são sempre capturados.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0,
  },

  // Faturação certificada (AGT). Tudo INATIVO por omissão.
  //
  // Sem `serie` definida, as faturas são emitidas como sempre foram — sem
  // número de série e sem hash — e distinguem-se por `serie IS NULL`. É
  // deliberado: ligar a numeração certificada antes de a série estar declarada
  // à AGT produziria documentos numerados numa série que não existe, e a
  // numeração não se corrige para trás.
  faturacao: {
    serie: process.env.KIXIMA_SERIE_FATURACAO || '',
    nif: process.env.KIXIMA_NIF || '',
    nome: process.env.KIXIMA_NOME_FISCAL || 'KIXIMA',
    // Atribuído pela AGT ao programa, no fim do processo de certificação.
    certificadoAgt: process.env.KIXIMA_CERTIFICADO_AGT || '',
  },
  versao: process.env.npm_package_version || '1.0',
};

// Variáveis obrigatórias quando o armazenamento é S3-compatível. Uma string
// vazia conta como ausente: no painel do Render é fácil criar a variável e
// deixá-la por preencher, e o SDK só se queixa (mal) na hora do upload.
const STORAGE_REQUIRED = {
  STORAGE_BUCKET: config.storage.bucket,
  STORAGE_ACCESS_KEY: config.storage.accessKey,
  STORAGE_SECRET_KEY: config.storage.secretKey,
};
// Configuração de email em falta. Sem provider definido, TUDO o que é email
// fica só no log — convites, recuperação de senha, aviso de fatura pendente,
// confirmação de candidatura — e o utilizador não vê erro nenhum: simplesmente
// nunca recebe nada. É a falha mais silenciosa que a plataforma pode ter.
const EMAIL_REQUIRED = {
  brevo: { BREVO_API_KEY: config.email.brevoApiKey },
  'brevo-api': { BREVO_API_KEY: config.email.brevoApiKey },
  smtp: { SMTP_HOST: config.email.smtp.host, SMTP_USER: config.email.smtp.user, SMTP_PASSWORD: config.email.smtp.password },
};
config.email.missing = Object.entries(EMAIL_REQUIRED[config.email.provider] || {})
  .filter(([, v]) => !String(v || '').trim())
  .map(([k]) => k);
// 'console' não é um provider a sério: escreve no log e segue.
config.email.apenasLog = config.email.provider === 'console';

config.storage.missing =
  config.storage.provider === 's3'
    ? Object.entries(STORAGE_REQUIRED).filter(([, v]) => !String(v || '').trim()).map(([k]) => k)
    : [];

// Exportado para as poucas definições lidas fora daqui (BACKUP_CRON é lida no
// momento do agendamento, não no arranque) poderem passar pela mesma limpeza.
config.limparValor = limpar;
config.precisouDeLimpeza = precisouDeLimpeza;

module.exports = config;
