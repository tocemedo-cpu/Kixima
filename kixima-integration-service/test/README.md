# Testes

- **Unitários**: ficam junto ao código (`src/**/*.spec.ts`) e correm com `npm test`.
  Cobrem a criptografia AES-256-GCM e o mapeamento de eventos.
- **E2E**: `*.e2e-spec.ts` nesta pasta, executados com `npm run test:e2e`
  (config em `test/jest-e2e.json`). Requerem Postgres/Redis de teste a correr.

Exemplo de um e2e de saúde (a adicionar quando houver ambiente de teste):

```ts
// test/health.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MonitoringModule } from '@app/monitoring/monitoring.module';

describe('Monitoring (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [MonitoringModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  it('/health (GET)', () => request(app.getHttpServer()).get('/health').expect(200));
  afterAll(async () => app.close());
});
```
