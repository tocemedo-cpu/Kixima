// tests/env.js
// Carregado por Jest (setupFiles) ANTES de qualquer módulo da app ser importado,
// para que src/config/env.js e o Prisma Client leiam já as variáveis certas.
//
// Localmente usa uma base de dados de teste dedicada (kixima_test) num Postgres
// em 127.0.0.1. Em CI, basta exportar DATABASE_URL / JWT_SECRET no ambiente que
// estes valores por omissão são ignorados.

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
process.env.PAYMENT_SLA_DAYS = process.env.PAYMENT_SLA_DAYS || '7';
process.env.EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'console';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://kixima:kixima@127.0.0.1:5432/kixima_test';
// Em teste, a ligação direta é a mesma (Postgres local). O schema exige DIRECT_URL.
process.env.DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
