# KIXIMA Integration Service

Microserviço de integração ERP **enterprise**, **totalmente desacoplado** do backend
principal da KIXIMA. Consome eventos de negócio do RabbitMQ e sincroniza-os com
sistemas ERP externos.

> ⚠️ Este serviço vive **exclusivamente** na pasta `kixima-integration-service/`.
> Não modifica, move nem depende de código, base de dados, schema ou configuração
> do Kixima existente. Comunica apenas por **eventos** (RabbitMQ) e **webhooks**.

## ERPs suportados

| ERP | Protocolo | Adapter |
|-----|-----------|---------|
| SAP S/4HANA | OData (V2/V4) + CSRF | `SapAdapter` |
| Primavera ERP | REST | `PrimaveraAdapter` |
| Oracle ERP Cloud | REST (Financials) | `OracleAdapter` |
| SAP Ariba | cXML | `AribaAdapter` |

## Eventos consumidos (exchange `kixima.events`, tipo *topic*)

- `purchase_order.approved` → cria/atualiza **Purchase Order** no ERP
- `invoice.issued` → cria **Supplier Invoice**
- `goods.received` → regista **Goods Receipt**
- `payment.completed` → regista **Payment**

O RabbitMQ é **assumido como já existente**. O serviço apenas declara (de forma
idempotente) a sua própria fila `kixima.integration.q` ligada ao exchange e a sua
Dead Letter Exchange — **não cria configuração no sistema principal**.

## Arquitetura

```
RabbitMQ (kixima.events)
        │  purchase_order.approved | invoice.issued | goods.received | payment.completed
        ▼
[consumers] RabbitmqConsumer ──► [sync] SyncService
        │                              │  idempotência (IdempotencyKey)
        │                              │  persiste IntegrationEvent
        │                              ▼
        │                        BullMQ (Redis) — retry + backoff exponencial
        │                              ▼
        │                    [sync] SyncProcessor ──► [adapters] SAP / Primavera / Oracle / Ariba
        │                              │  cifra request/response (AES-256-GCM)
        │                              │  ErpSyncRecord + AuditLog
        │              ┌───────────────┴───────────────┐
        ▼              ▼                                ▼
   sucesso        falha retryable                 esgotou tentativas
   webhook de     → re-enfileira (BullMQ)         → [retry] DeadLetterService
   retorno                                         → DeadLetter + DLX
```

Componentes por pasta (`src/`):

- **adapters/** — `ErpAdapter` abstrato + `SapAdapter`, `PrimaveraAdapter`,
  `OracleAdapter`, `AribaAdapter` + `AdapterRegistry`.
- **consumers/** — `RabbitmqConsumer` (liga a fila ao `kixima.events`).
- **producers/** — ligação AMQP resiliente + `EventProducer` (eventos de retorno / DLX).
- **sync/** — `SyncService` (ingestão/idempotência) + `SyncProcessor` (worker BullMQ).
- **retry/** — `DeadLetterService` (captura + replay).
- **webhooks/** — `WebhookProducer` (callback HMAC para o Kixima) + `WebhookController` (entrada).
- **audit/** — `AuditService` (trilho de auditoria persistente).
- **crypto/** — `CryptoService` (AES-256-GCM + HMAC-SHA256).
- **monitoring/** — `MonitoringController` (health, overview, DLQ, replay), métricas
  Prometheus (`MetricsService`) e bootstrap OpenTelemetry (`tracing.ts`).
- **common/** — configuração tipada, Prisma, tipos, constantes, mapeamentos.

## Base de dados

Base de dados **própria e separada** (não é o banco do Kixima). Schema em
`prisma/schema.prisma`. Tabelas principais: `integration_events`, `erp_sync_records`,
`idempotency_keys`, `audit_logs`, `webhook_deliveries`, `dead_letters`, `erp_credentials`.

## Como correr (desenvolvimento)

```bash
cp .env.example .env
# gere a chave AES-256:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # → ENCRYPTION_KEY

npm install
npx prisma generate
npx prisma db push          # cria o schema na base de dados de integração
npm run start:dev
```

Ou tudo isolado via Docker (Postgres próprio :5433 + Redis + serviço):

```bash
docker compose -f docker-compose.integration.yml up --build
```

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Saúde do serviço + estado de cada adapter ERP |
| GET | `/monitoring/overview` | Contadores de eventos, filas e DLQ |
| GET | `/monitoring/dead-letters` | Lista de eventos em Dead Letter |
| POST | `/monitoring/dead-letters/:id/replay` | Reprocessa um evento da DLQ |
| GET | `/metrics` | Métricas Prometheus |
| POST | `/webhooks/erp/:erp` | Webhook de entrada de um ERP |

## Segurança

- **AES-256-GCM** para payloads/respostas ERP e credenciais em repouso.
- **HMAC-SHA256** nos webhooks de retorno (cabeçalho `X-Kixima-Signature`).
- Logs estruturados (**Pino**) com *redaction* de segredos.
- Rastreio distribuído (**OpenTelemetry**).

## Integração com o backend do Kixima (referência)

> **EXEMPLO — NÃO APLICAR AUTOMATICAMENTE NO KIXIMA EXISTENTE**
>
> O backend principal apenas precisaria de **publicar** os eventos no exchange
> `kixima.events` (nas transições que já existem) e **receber** o webhook de
> retorno. Nada disto é gerado/alterado por este microserviço.
>
> ```js
> // Publicação de evento (exemplo conceptual, no backend do Kixima):
> // channel.publish('kixima.events', 'purchase_order.approved',
> //   Buffer.from(JSON.stringify({ eventId, source: 'kixima', occurredAt, payload })),
> //   { messageId: eventId, persistent: true });
>
> // Endpoint de callback (exemplo conceptual):
> // POST /api/integration/callback  → verifica HMAC 'X-Kixima-Signature' e regista o resultado.
> ```

## Licença

UNLICENSED — uso interno KIXIMA.
