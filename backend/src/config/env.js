// src/config/env.js
// Ponto único de leitura do ambiente. Todo o resto do código deve importar
// a config a partir daqui, nunca ler process.env diretamente noutro sítio.

const NODE_ENV = process.env.NODE_ENV || 'development';

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
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET,
    // Validade curta do access token (revogável via tokenVersion). 1 dia é um
    // compromisso entre segurança e não obrigar a login constante.
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },

  // Regras de negócio — configuráveis por ambiente, nunca hardcoded no código.
  business: {
    paymentSlaDays: Number(process.env.PAYMENT_SLA_DAYS) || 7,
    policyExpiryAlertDays: Number(process.env.POLICY_EXPIRY_ALERT_DAYS) || 30,
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
    // path-style é necessário para a maioria dos S3-compatíveis (Supabase/MinIO).
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE
      ? process.env.STORAGE_FORCE_PATH_STYLE === 'true'
      : Boolean(process.env.STORAGE_ENDPOINT),
  },

  logLevel: process.env.LOG_LEVEL || 'info',
};

module.exports = config;
