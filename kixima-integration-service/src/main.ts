import 'reflect-metadata';
import { startTracing, stopTracing } from '@app/monitoring/tracing';

// Inicia o OpenTelemetry o mais cedo possível.
startTracing();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from '@app/app.module';

async function bootstrap(): Promise<void> {
  // rawBody: true expõe req.rawBody para verificação de assinatura HMAC dos
  // webhooks de entrada (sem alterar o parsing JSON normal).
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });

  app.useLogger(app.get(PinoLogger));
  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 4100);
  await app.listen(port);

  const logger = app.get(PinoLogger);
  logger.log(`KIXIMA Integration Service a correr em http://localhost:${port}`);

  const shutdown = async (): Promise<void> => {
    await app.close();
    await stopTracing();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void bootstrap();
