/**
 * Configuração tipada, carregada de variáveis de ambiente.
 */

const bool = (v: string | undefined, def = false): boolean =>
  v === undefined ? def : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());

const int = (v: string | undefined, def: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

export interface AppConfig {
  env: string;
  port: number;
  serviceName: string;
  logLevel: string;
  databaseUrl: string;
  rabbitmq: {
    url: string;
    exchange: string;
    queue: string;
    prefetch: number;
    dlx: string;
    dlq: string;
  };
  redis: { host: string; port: number; password?: string };
  bullmq: { prefix: string; attempts: number; backoffMs: number };
  encryptionKey: string;
  adminToken: string;
  callback: { url: string; secret: string; timeoutMs: number };
  otel: { enabled: boolean; endpoint: string; serviceName: string };
}

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: int(process.env.PORT, 4100),
  serviceName: process.env.SERVICE_NAME ?? 'kixima-integration-service',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  databaseUrl: process.env.DATABASE_URL ?? '',
  rabbitmq: {
    url: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
    exchange: process.env.RABBITMQ_EXCHANGE ?? 'kixima.events',
    queue: process.env.RABBITMQ_QUEUE ?? 'kixima.integration.q',
    prefetch: int(process.env.RABBITMQ_PREFETCH, 10),
    dlx: process.env.RABBITMQ_DLX ?? 'kixima.integration.dlx',
    dlq: process.env.RABBITMQ_DLQ ?? 'kixima.integration.dlq',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: int(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  bullmq: {
    prefix: process.env.BULLMQ_PREFIX ?? 'kixima-int',
    attempts: int(process.env.RETRY_ATTEMPTS, 5),
    backoffMs: int(process.env.RETRY_BACKOFF_MS, 5000),
  },
  encryptionKey: process.env.ENCRYPTION_KEY ?? '',
  adminToken: process.env.INTEGRATION_ADMIN_TOKEN ?? '',
  callback: {
    url: process.env.KIXIMA_CALLBACK_URL ?? '',
    secret: process.env.KIXIMA_CALLBACK_SECRET ?? '',
    timeoutMs: int(process.env.WEBHOOK_TIMEOUT_MS, 10000),
  },
  otel: {
    enabled: bool(process.env.OTEL_ENABLED, false),
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318',
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'kixima-integration-service',
  },
});
