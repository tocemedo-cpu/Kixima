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
| GET | `/dashboard` | **Painel visual** de monitorização (HTML) |
| GET | `/monitoring/overview` | Contadores de eventos, filas e DLQ |
| GET | `/monitoring/dead-letters` | Lista de eventos em Dead Letter |
| POST | `/monitoring/dead-letters/:id/replay` | Reprocessa um evento da DLQ |
| GET | `/metrics` | Métricas Prometheus |
| POST | `/webhooks/erp/:erp` | Webhook de entrada de um ERP |

## Multi-tenant multi-ERP (credenciais)

O Kixima é multi-tenant: cada operadora/cliente pode ter o **seu** ERP com as
**suas** credenciais. Por isso as credenciais são **por tenant**, guardadas
**cifradas (AES-256-GCM)** na base de dados e resolvidas em runtime pelo
`tenantId` que vem no evento. Um `tenantId` especial **`*`** define uma
configuração **global** (fallback para tenants sem config própria).

Gestão via API protegida por `Authorization: Bearer $INTEGRATION_ADMIN_TOKEN`:

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/credentials/erp-systems` | ERPs suportados |
| GET | `/credentials/tenants/:tenantId` | credenciais do tenant (mascaradas) |
| PUT | `/credentials/tenants/:tenantId/:erp` | criar/atualizar (`{ enabled, config }`) |
| DELETE | `/credentials/tenants/:tenantId/:erp` | remover |

`erp` ∈ `SAP_S4HANA | PRIMAVERA | ORACLE_ERP_CLOUD | SAP_ARIBA`. Campos de `config`:

- **SAP_S4HANA**: `baseUrl, username, password, client`
- **PRIMAVERA**: `baseUrl, apiKey, company`
- **ORACLE_ERP_CLOUD**: `baseUrl, username, password`
- **SAP_ARIBA**: `baseUrl, sharedSecret, networkId`

Exemplo — ativar SAP para um tenant:

```bash
curl -X PUT https://SEU-MICROSERVICO.onrender.com/credentials/tenants/<companyId>/SAP_S4HANA \
  -H "Authorization: Bearer $INTEGRATION_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": true, "config": {
        "baseUrl": "https://sap.cliente.com/sap/opu/odata/sap",
        "username": "KIXIMA", "password": "•••", "client": "100" } }'
```

O `tenantId` corresponde ao **id da empresa (operadora/cliente)** do Kixima, que
viaja no envelope do evento (`purchase_order.approved`, etc.).

## Migrações Prisma

Migrações versionadas em `prisma/migrations/`. No arranque, o contentor corre
`prisma migrate deploy` (com `db push` como recurso). Em desenvolvimento, para
criar uma nova migração: `npm run prisma:migrate -- --name <nome>`.

## Deploy no Render (via GitHub)

Serviço **independente** do Kixima — o `render.yaml` da raiz do Kixima **não é
alterado**. Duas opções (ver `render.yaml` deste microserviço):

1. **Web Service próprio** (recomendado): Render → **New → Web Service** → ligar
   ao repo → **Root Directory** = `kixima-integration-service` → **Runtime** =
   Docker. Adicione um **Postgres** e um **Key Value (Redis)** e defina as
   variáveis: `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `RABBITMQ_URL`,
   `RABBITMQ_EXCHANGE=kixima.events`, `ENCRYPTION_KEY` (32 bytes hex),
   `KIXIMA_CALLBACK_URL`, `KIXIMA_CALLBACK_SECRET`.
2. **Blueprint dedicado**: aponte um novo Blueprint para
   `kixima-integration-service/render.yaml` (mantendo o do Kixima intacto).

> O RabbitMQ não é fornecido pelo Render — use um broker existente/gerido
> (ex.: CloudAMQP) e configure `RABBITMQ_URL`. A base de dados é **exclusiva**
> do microserviço (nunca o banco do Kixima).

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
