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
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // Regras de negócio — configuráveis por ambiente, nunca hardcoded no código.
  business: {
    paymentSlaDays: Number(process.env.PAYMENT_SLA_DAYS) || 7,
    policyExpiryAlertDays: Number(process.env.POLICY_EXPIRY_ALERT_DAYS) || 30,
  },

  email: {
    provider: process.env.EMAIL_PROVIDER || 'console',
    from: process.env.EMAIL_FROM || 'notificacoes@kixima.co.ao',
    smtp: {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
    },
  },

  storage: {
    provider: process.env.STORAGE_PROVIDER || 's3',
    bucket: process.env.STORAGE_BUCKET,
    region: process.env.STORAGE_REGION,
    accessKey: process.env.STORAGE_ACCESS_KEY,
    secretKey: process.env.STORAGE_SECRET_KEY,
  },

  logLevel: process.env.LOG_LEVEL || 'info',
};

module.exports = config;
