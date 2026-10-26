# KIXIMA — Serviço de integração, backend Java e camada cliente do frontend

> Cobre `kixima-integration-service/`, `backend-java/` e a camada cliente do `frontend/`.

Documento de análise estática (só leitura) sobre três componentes do monorepo `/home/user/Kixima`:

- **A.** `kixima-integration-service/` — microserviço NestJS de integração ERP.
- **B.** `backend-java/` — migração Spring Boot do backend Node.
- **C.** `frontend/` — camada cliente da API (React/Vite).

Convenções: os caminhos são relativos à raiz do repositório, salvo indicação em contrário; `ficheiro:linha` aponta para o código lido. Nada foi executado (nem o servidor Java, nem testes, nem scripts que escrevam em bases de dados). Não se reproduz nenhum valor de segredo: só os nomes das variáveis de ambiente. Onde não foi possível confirmar, diz-se "não confirmado". O inventário de rotas Node usado é o extraído por análise estática dos routers (246 rotas; ver [03](03-inventario-endpoints.md)).

---

# A. `kixima-integration-service/` (microserviço de integração ERP)

## A.1 Resumo

Microserviço NestJS 10 + Prisma + PostgreSQL próprio, com Redis (BullMQ) e RabbitMQ (amqplib). Recebe eventos de negócio do KIXIMA pelo exchange `kixima.events`, sincroniza-os com ERPs externos (SAP S/4HANA, Primavera, Oracle ERP Cloud, SAP Ariba) e devolve resultados ao backend por webhook assinado. Credenciais ERP são por tenant (`tenantId` = id da empresa no KIXIMA; `*` = configuração global), guardadas cifradas (AES-256-GCM). O README declara-o "totalmente desacoplado" do backend principal (`kixima-integration-service/README.md:1-12`): a comunicação com o backend faz-se só por RabbitMQ, HTTP de gestão de credenciais e callback HTTP assinado (ver A.7).

Estrutura (`kixima-integration-service/src/`): `adapters/` (4 adapters + factory + mappers), `consumers/` (consumidor AMQP), `producers/` (ligação AMQP + `EventProducer`), `sync/` (ingestão/idempotência + worker BullMQ), `retry/` (Dead Letter), `webhooks/` (callback de saída + webhook de entrada), `credentials/` (API de gestão + guard), `monitoring/` (health, overview, métricas, painel HTML, tracing), `audit/`, `crypto/`, `common/` (config tipada, constantes, mapeamentos, Prisma).

Arranque: `main.ts` cria a app com `rawBody: true` (para HMAC dos webhooks de entrada), `helmet()` e `ValidationPipe({whitelist, transform})` (`src/main.ts:16-20`); porta `PORT` (omissão 4100, `src/main.ts:23`; `common/config/configuration.ts:38`). Não há CORS activado, nem rate limiting (sem biblioteca de throttling no `package.json`).

## A.2 API HTTP

Todos os endpoints estão na raiz (sem prefixo `/api`). "Token admin" significa `Authorization: Bearer <INTEGRATION_ADMIN_TOKEN>` verificado por `AdminTokenGuard` (comparação em tempo constante; se a variável não estiver definida o guard devolve 401 a tudo, falha segura — `src/credentials/admin-token.guard.ts:18-30`).

| Método | Rota | Auth | Corpo / parâmetros | Resposta | Código |
|---|---|---|---|---|---|
| GET | `/health` | pública | — | `{ status: 'ok', service: 'kixima-integration-service' }` (sem detalhes internos, de propósito) | `src/monitoring/monitoring.controller.ts:23-28` |
| GET | `/dashboard` | HTML público; os dados que o painel carrega exigem token | — | página HTML autossuficiente; pede o token por `?token=`, `sessionStorage` ou `prompt()` | `src/monitoring/dashboard.controller.ts:10`, script em `:69-71` |
| GET | `/monitoring/overview` | token admin | — | `{ events:{received,processing,completed,failed,deadLetter,duplicate}, deadLetters, pendingWebhooks, queue:{waiting,active,failed} }` | `monitoring.controller.ts:30-58` |
| GET | `/monitoring/dead-letters` | token admin | — | até 100 linhas `DeadLetter` não reprocessadas, `createdAt` desc (inclui o `payload` JSON) | `monitoring.controller.ts:60-68` |
| POST | `/monitoring/dead-letters/:id/replay` | token admin | `:id` = id da `DeadLetter` | `{ replayed: boolean }`; estado HTTP 201 (omissão do Nest, sem `@HttpCode`) | `monitoring.controller.ts:70-85` |
| GET | `/metrics` | token admin | — | `text/plain` (Prometheus, `prom-client`) | `monitoring.controller.ts:87-91` |
| GET | `/credentials/erp-systems` | token admin | — | `{ supported: ['SAP_S4HANA','PRIMAVERA','ORACLE_ERP_CLOUD','SAP_ARIBA'] }` | `src/credentials/credentials.controller.ts:25-28`; `adapters/adapter.factory.ts:16-21` |
| GET | `/credentials/tenants/:tenantId` | token admin | — | lista `{ erp, enabled, updatedAt, config }`, com `config` mascarada (chaves que casam `/pass|secret|key|token/i` saem como `••••••`) | `credentials.controller.ts:31-34`; `credentials.service.ts:56-66,131-137` |
| PUT | `/credentials/tenants/:tenantId/:erp` | token admin | `{ enabled?: boolean (omissão true), config: Record<string,string> (omissão {}) }` | `{ ok: true }` | `credentials.controller.ts:37-46` |
| POST | `/credentials/tenants/:tenantId/:erp/test` | token admin | — | `{ ok: boolean, message: string }`, estado 200; chama `healthCheck()` do adapter com a config guardada | `credentials.controller.ts:48-52`; `credentials.service.ts:testConnection` |
| DELETE | `/credentials/tenants/:tenantId/:erp` | token admin | — | `{ ok: true }` | `credentials.controller.ts:55-58` |
| POST | `/webhooks/erp/:tenantId/:erp` | assinatura HMAC-SHA256 | cabeçalho `x-signature` (hex do HMAC do corpo bruto); corpo JSON; `:erp` ∈ `sap`, `s4hana`, `primavera`, `oracle`, `ariba` | 202 `{ received: true }`; 401 assinatura inválida ou PO de outro tenant; 503 sem segredo configurado | `src/webhooks/webhook.controller.ts:67-122,142-171` |

Notas sobre os endpoints:

- Campos de `config` por ERP, segundo o README (`README.md`, secção "Multi-tenant multi-ERP"): SAP_S4HANA `baseUrl, username, password, client, companyCode?, purchasingOrganization?`; PRIMAVERA `baseUrl, apiKey, company`; ORACLE_ERP_CLOUD `baseUrl, username, password`; SAP_ARIBA `baseUrl, sharedSecret, networkId`; qualquer config pode ter `webhookSecret`. O corpo `config` não é validado por classe (`UpsertBody` é uma interface TS, `credentials.controller.ts:7-10`), por isso o `ValidationPipe` global não o valida; a validação real só ocorre quando o adapter tenta ligar.
- O parâmetro `:erp` está tipado como o enum Prisma `ErpSystem` mas não há validação explícita; o comportamento com um valor inválido não foi confirmado (esperável erro do Prisma → 500).
- Webhook de entrada: só reencaminha ao KIXIMA se `body.type` ∈ `{purchase_order.approval_decided, payment.confirmed}` e houver `poId` (`webhook.controller.ts:22,86`). Antes de reencaminhar, confirma que a PO pertence ao tenant que assinou, usando o evento `purchase_order.approval_requested` guardado (`webhook.producer.ts:66-76`), e ignora duplicados `(type, poId)` já entregues (`webhook.producer.ts:38-50`). Quando não há registo da PO (`null`), não bloqueia (decisão explícita no comentário, `webhook.controller.ts:90-96`).
- Resolução do segredo do webhook de entrada: `webhookSecret` do tenant+ERP → `webhookSecret` da config global `*` → variável `WEBHOOK_SIGNING_SECRET` (`webhook.controller.ts:130-140`).
- Formato canónico do corpo do webhook de entrada (comentário do código): `{ type, poId, aprovado?, erpExternalId?, motivo?, valorPago?, pagoEm? }` (`webhook.controller.ts:50-56`).

## A.3 Filas

### RabbitMQ (broker externo, assumido como existente)

| Elemento | Nome (omissão) | Variável | Declarado em |
|---|---|---|---|
| Exchange de eventos (topic, durável) | `kixima.events` | `RABBITMQ_EXCHANGE` | `consumers/rabbitmq.consumer.ts:42`; `producers/event.producer.ts:33` |
| Fila de consumo (durável, `deadLetterExchange` = DLX) | `kixima.integration.q` | `RABBITMQ_QUEUE` | `rabbitmq.consumer.ts:44` |
| Dead Letter Exchange (topic, durável) | `kixima.integration.dlx` | `RABBITMQ_DLX` | `rabbitmq.consumer.ts:43`; `event.producer.ts:34` |
| Dead Letter Queue (ligada à DLX com `#`) | `kixima.integration.dlq` | `RABBITMQ_DLQ` | `event.producer.ts:35-36` |
| Prefetch | 10 | `RABBITMQ_PREFETCH` | `rabbitmq.consumer.ts:47`; `configuration.ts:46` |

Routing keys subscritas (`src/common/constants.ts:6-17`): `purchase_order.approved`, `purchase_order.approval_requested`, `invoice.issued`, `goods.received`, `payment.completed`. Cada uma liga a fila ao exchange (`rabbitmq.consumer.ts:45-47`).

- **Produtores (do lado do KIXIMA):** o backend Node publica em `backend/src/services/eventBus.js:52-80` (confirm channel, `persistent: true`, `messageId = eventId`); chamadores: `purchase_order.approval_requested` (`backend/src/services/poService.js:176`), `purchase_order.approved` (`poService.js:303`), `invoice.issued` (`poService.js:599`), `goods.received` (`poService.js:690`), `payment.completed` (`backend/src/services/paymentService.js:155`). O backend Java faz o mesmo (`backend-java/src/main/java/ao/kixima/messaging/EventBus.java:100-120`; chamadores em `po/PoService.java:270,439,527,621` e `payment/PaymentService.java:199`), publicando só depois do commit (`EventBus.java:115-120`).
- **Produtor no próprio serviço:** `EventProducer.publishToDlq` (só chamado por `DeadLetterService.capture`, `retry/dead-letter.service.ts:34`). `EventProducer.publish` (eventos de retorno no exchange principal, `event.producer.ts:46-48`) não tem nenhum chamador.
- **Consumidor:** `RabbitmqConsumer` (`consumers/rabbitmq.consumer.ts:58-89`): routing key desconhecida → `ack` e descarta (`:62-67`); JSON inválido ou falha de ingestão → `nack(msg, false, false)` sem requeue, a fila reencaminha para a DLX (`:84-88`).

**Formato da mensagem** (publicada pelo KIXIMA, `eventBus.js:62-68`), JSON UTF-8:

```json
{ "eventId": "<uuid ou id estável>", "tenantId": "<id da empresa ou null>", "source": "kixima",
  "occurredAt": "<ISO-8601>", "payload": { /* corpo do evento */ } }
```

O consumidor monta o envelope interno com: `eventId` = `messageId` AMQP, senão `content.eventId`, senão UUID novo; `routingKey`; `eventType` (mapeado de routing key, `common/event-mapping.ts`); `tenantId`; `source` (omissão `kixima`); `occurredAt`; `headers`; `payload` = `content.payload` ou o próprio conteúdo (`rabbitmq.consumer.ts:69-80`).

Payloads canónicos dos 5 eventos (construtores em `backend/src/services/eventBus.js:108-184`): `purchase_order.approved` e `.approval_requested` (`poId, reference, buyer{taxId,name}, supplier{taxId,name}, currency, totalAmount, lines[{sku,description,quantity,unitPrice,lineTotal}]`, mais `approvedAt`/`requestedAt`); `invoice.issued` (`invoiceId, reference, poReference, supplier, currency, amount, issuedAt, dueAt`); `goods.received` (`goodsReceiptId, poReference, receivedAt, lines[{sku,description,quantityReceived}]`); `payment.completed` (`paymentId, invoiceReference, amount, currency, paidAt, method`).

### BullMQ (Redis)

| Fila | Constante | Produtor | Consumidor | Formato do job |
|---|---|---|---|---|
| `erp-sync` | `QUEUES.SYNC` (`constants.ts:20-23`) | `SyncService.ingest` (`sync/sync.service.ts:75-86`) e `replay` (`monitoring.controller.ts:81`) | `SyncProcessor` (`@Processor(QUEUES.SYNC)`, `sync/sync.processor.ts`) | nome `sync-erp`; dados `{ integrationEventId: string }`; `jobId = event.id`; `attempts` = `RETRY_ATTEMPTS` (omissão 5); backoff exponencial com atraso base `RETRY_BACKOFF_MS` (5000); `removeOnComplete: 1000`; `removeOnFail: false` |
| `webhook-callback` | `QUEUES.WEBHOOK` | nenhum | nenhum | declarada mas sem uso (grep: só `constants.ts:22`) |

Prefixo das chaves no Redis: `BULLMQ_PREFIX` (omissão `kixima-int`, `app.module.ts:42`). O replay usa `attempts: 5` fixo, sem backoff nem `jobId` (`monitoring.controller.ts:81`).

## A.4 Fluxo de processamento

1. Ingestão (`sync.service.ts:31-87`): numa só transacção Prisma cria `IdempotencyKey(key=eventId)` e `IntegrationEvent(status=RECEIVED)`; P2002 → evento duplicado, auditado e `ack` (`:60-66`). Depois enfileira o job BullMQ.
2. Worker (`sync.processor.ts:40-180`): marca `PROCESSING`, resolve os adapters activos do tenant (config própria + `*`, `credentials.service.ts:resolveEnabledAdapters`); sem adapters → evento `COMPLETED` (no-op, `sync.no_adapters`, `:55-66`). Para cada ERP: salta se já há `ErpSyncRecord` com `SUCCESS` para `(evento, erp, entidade)` (`:82-86`), chama `adapter.requestApproval` se o evento é `purchase_order.approval_requested`, senão `adapter.sync(entityType, ...)` (`:91-104`); grava `ErpSyncRecord` (resposta cifrada) e `AuditLog`.
3. Sem falhas → `COMPLETED` e callback `integration.completed` ao KIXIMA (`:159-163`). Com falhas retryable e tentativas restantes → relança (BullMQ faz backoff) (`:166-175`). Caso contrário → `DEAD_LETTER`, `DeadLetter` persistida, mensagem na DLX e callback `integration.failed` (`:178-190`).

## A.5 Configuração (apenas nomes de variáveis)

`common/config/configuration.ts` e `.env.example`: `NODE_ENV`, `PORT`, `SERVICE_NAME`, `LOG_LEVEL`, `DATABASE_URL`, `RABBITMQ_URL`, `RABBITMQ_EXCHANGE`, `RABBITMQ_QUEUE`, `RABBITMQ_PREFETCH`, `RABBITMQ_DLX`, `RABBITMQ_DLQ`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `BULLMQ_PREFIX`, `RETRY_ATTEMPTS`, `RETRY_BACKOFF_MS`, `ENCRYPTION_KEY` (32 bytes em hex; o serviço recusa arrancar se o formato for inválido, `crypto/crypto.service.ts:23-31`), `INTEGRATION_ADMIN_TOKEN`, `WEBHOOK_SIGNING_SECRET`, `KIXIMA_CALLBACK_URL`, `KIXIMA_CALLBACK_SECRET`, `WEBHOOK_TIMEOUT_MS` (10000), `OTEL_ENABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`. O `.env.example` não lista `WEBHOOK_SIGNING_SECRET` (existe só em `configuration.ts:62`).

Base de dados própria (`prisma/schema.prisma`; 3 migrações em `prisma/migrations/`): `integration_events`, `erp_sync_records`, `idempotency_keys`, `audit_logs`, `webhook_deliveries`, `dead_letters`, `erp_credentials`. O entrypoint corre `prisma migrate deploy` e, se falhar, `prisma db push --skip-generate` (`docker/entrypoint.sh:5-9`).

## A.6 `render.yaml` próprio (`kixima-integration-service/render.yaml`)

- Blueprint independente do `render.yaml` da raiz (comentário, `:1-16`): Postgres `kixima-integration-db` (plano free, Frankfurt), `keyvalue` (Redis) `kixima-integration-redis`, e um web service Docker `kixima-integration-service` com `rootDir: kixima-integration-service`, `healthCheckPath: /health` (`:20-43`).
- Variáveis ligadas a recursos: `DATABASE_URL` (do Postgres), `REDIS_HOST`, `REDIS_PORT` (do Redis). Segredos com `sync: false`: `RABBITMQ_URL`, `ENCRYPTION_KEY`, `INTEGRATION_ADMIN_TOKEN`, `KIXIMA_CALLBACK_URL`, `KIXIMA_CALLBACK_SECRET` (`:66-75`). `NODE_ENV`, `PORT` e `RABBITMQ_EXCHANGE` têm valor fixo.
- O RabbitMQ não é criado (usa-se um broker externo, p. ex. gerido).
- O web service aponta para `repo: https://github.com/tocemedo-cpu/Kixima` e `branch: claude/kixima-app-work-gmz6jk` (`:36-37`): ramo de trabalho, não o ramo principal (ver A.9, A7).
- O `render.yaml` da raiz declara, para o serviço Node e para o `kixima-java`, as variáveis que falam com este microserviço: `RABBITMQ_URL`, `RABBITMQ_EXCHANGE`, `KIXIMA_CALLBACK_SECRET`, `ERP_CONFIG_ENCRYPTION_KEY`, `INTEGRATION_URL`, `INTEGRATION_ADMIN_TOKEN` (`render.yaml:70-86` e `:231-241`). O microserviço em si não está no `render.yaml` da raiz.

## A.7 Como comunica com o backend principal

1. **Backend → microserviço, por RabbitMQ**: eventos de negócio (A.3). Opcional e não-bloqueante: sem `RABBITMQ_URL` ou com o broker em baixo, `publish()` é um no-op com aviso (`backend/src/services/eventBus.js:5-8,52-60`).
2. **Backend → microserviço, por HTTP**: o Admin do Sistema configura o ERP de uma empresa; o backend sincroniza para `PUT|DELETE /credentials/tenants/:companyId/:erp` e `POST .../test` com `Authorization: Bearer <INTEGRATION_ADMIN_TOKEN>`, usando `INTEGRATION_URL` (`backend/src/services/erpConfigService.js:42-58,135,159,165,186`; Java: `backend-java/.../erp/ErpConfigService.java:125,154,157,190` e `ErpIntegrationClient.java`). Sem `INTEGRATION_URL`/token, a config fica guardada mas não sincronizada (`erpConfigService.js:45`).
3. **Microserviço → backend, callback HTTP assinado**: `WebhookProducer.notifyKixima` faz `POST KIXIMA_CALLBACK_URL` (o URL completo, p. ex. `.../api/integration/callback`) com corpo `{ type, data, occurredAt }` e cabeçalho `X-Kixima-Signature` = HMAC-SHA256 hex do corpo com `KIXIMA_CALLBACK_SECRET` (`webhooks/webhook.producer.ts:78-123`). Cada tentativa fica em `webhook_deliveries` (`PENDING`→`DELIVERED`/`FAILED`). O backend recebe em `POST /api/integration/callback` (rota pública, protegida pela assinatura; falha fechada com 503 `CALLBACK_NOT_CONFIGURED` sem segredo — `backend/src/routes/integrationRoutes.js:26-41`; Java: `integration/IntegrationCallbackController.java:85-90`). O backend só trata dois tipos: `purchase_order.approval_decided` (→ `poService.aplicarDecisaoErp`) e `payment.confirmed` (→ `poService.aplicarPagamentoErp`) (`integrationRoutes.js:48-65`); erros de negócio devolvem `200 { received: true, error }` para o microserviço não repetir (`:67-75`).
4. **ERP → microserviço → backend**: o ERP chama `POST /webhooks/erp/:tenantId/:erp` e o microserviço reencaminha a decisão/pagamento para o callback do backend (A.2).

## A.8 Estado de completude

Implementado e coerente no código lido: consumidor AMQP com DLX; ingestão idempotente e transaccional; worker BullMQ com retry; 4 adapters com as 5 operações (`pushPurchaseOrder`, `pushInvoice`, `pushGoodsReceipt`, `pushPayment`, `requestApproval`); credenciais multi-tenant cifradas; API de gestão; monitorização (overview, DLQ, replay, métricas Prometheus, tracing OpenTelemetry opcional); webhooks de entrada e de saída; 7 ficheiros `*.spec.ts` unitários.

Em falta ou parcial (detalhe nos Achados): reenvio de callbacks falhados; uso de `QUEUES.WEBHOOK`, `EventProducer.publish` e do campo `requestEnc` (código previsto e nunca ligado); estados `FAILED`/`DUPLICATE` do evento nunca atribuídos (só lidos em `monitoring.controller.ts:50,52`); testes e2e (só existe `test/README.md` com um exemplo, `kixima-integration-service/test/README.md`); nenhuma verificação em CI (nenhum job em `.github/workflows/ci.yml` refere o serviço); README parcialmente desactualizado. Não há verificação contra ERPs reais no repositório: os caminhos e formatos dos adapters (p. ex. `purchaseOrders/approval` no Primavera, `primavera.adapter.ts:53`) não foram confirmados contra documentação dos fornecedores, e o próprio código reconhece que não há especificação pública do fluxo de decisão (`webhook.controller.ts:50-56`).

## A.9 Achados (A)

| Id | Severidade | Tipo | Descrição | Evidência | Confirmado? |
|---|---|---|---|---|---|
| A1 | Alta | falha | Uma decisão de aprovação/pagamento vinda do ERP pode perder-se sem rasto visível ao ERP: `notifyKixima` engole qualquer erro de HTTP (grava `FAILED` e só faz `logger.warn`), o webhook de entrada regista `webhook.relayed` e responde 202 `{received:true}` mesmo assim, e nada volta a tentar a entrega. | `webhooks/webhook.controller.ts:114-121`; `webhooks/webhook.producer.ts:101-122` | Sim, por leitura do código (não executado) |
| A2 | Média | incompleto | Não existe reenvio das `WebhookDelivery` em `FAILED`: o comentário diz "persistida para auditoria e reenvio" mas nenhum código as relê; os callbacks `integration.completed`/`integration.failed` falhados perdem-se. A fila `webhook-callback` está definida e nunca usada. O overview só conta `PENDING`, não `FAILED`. | `webhook.producer.ts:8-12`; `common/constants.ts:22`; `monitoring.controller.ts:36` | Sim (grep: nenhuma leitura de `webhookDelivery` com `FAILED`) |
| A3 | Média | falha | Possível Dead Letter nunca alcançada: o worker decide "ainda há tentativas" com `attempts - job.attemptsMade > 0`. Se `attemptsMade` for 0 na primeira execução (comportamento que se espera do BullMQ 5), na última tentativa `attemptsLeft` vale 1, o job relança, o BullMQ marca-o falhado em definitivo e `moveToDeadLetter` nunca corre (evento fica `RECEIVED`, sem `DeadLetter`, sem callback `integration.failed`). O teste unitário assume `attemptsMade: 1` na primeira tentativa. | `sync/sync.processor.ts:166-175`; `sync/sync.processor.spec.ts:56,111` | Não confirmado: depende da semântica de `attemptsMade` na versão instalada (`bullmq ^5.13.2`); não há `node_modules` para verificar |
| A4 | Baixa | vulnerabilidade | O token de administração pode viajar na query string (`/dashboard?token=...`) e o `pino-http` regista os pedidos (`autoLogging: true`) com a redacção só de cabeçalhos; o URL com o token ficaria nos logs e no histórico do browser. Sem rate limiting nos endpoints protegidos pelo token. | `monitoring/dashboard.controller.ts:69-71`; `app.module.ts:26-29`; `package.json` (sem throttler) | Sim para o código; o registo efectivo do URL em log não foi observado |
| A5 | Baixa | incompleto | O callback `integration.completed`/`integration.failed` enviado pelo microserviço não tem tratamento no backend: o `switch` só conhece `purchase_order.approval_decided` e `payment.confirmed`, o resto cai em "tipo de callback desconhecido" e responde 200. | `sync/sync.processor.ts:159,189`; `backend/src/routes/integrationRoutes.js:48-65` | Sim |
| A6 | Baixa | dívida | README desactualizado: lista 4 eventos (o código subscreve 5, incluindo `purchase_order.approval_requested`); diz que `/health` mostra o estado de cada adapter (devolve só `status` e `service`); apresenta a integração com o backend como "EXEMPLO — NÃO APLICAR" quando o backend já publica eventos e recebe o callback; não lista `POST /credentials/tenants/:tenantId/:erp/test`; diz que cifra request e response, mas `requestEnc` nunca é escrito. | `README.md:20-23,97,183-199`; `common/constants.ts:6-12`; `monitoring.controller.ts:23-28`; `credentials.controller.ts:48`; `prisma/schema.prisma:131` (grep de `requestEnc` em `src/`: sem resultados) | Sim |
| A7 | Média | dívida | O blueprint do microserviço fixa `branch: claude/kixima-app-work-gmz6jk`, um ramo de trabalho: um deploy por este ficheiro seguiria esse ramo e não o principal. | `kixima-integration-service/render.yaml:36-37` | Sim para o ficheiro; a existência/estado do ramo não foi verificada |
| A8 | Baixa | dívida | Código previsto e não ligado: `QUEUES.WEBHOOK`, `EventProducer.publish`, `requestEnc`, `EventStatus.FAILED` e `DUPLICATE` (só lidos no overview, nunca escritos), `DeadLetterService.markReplayed` (o replay faz o `update` à mão). | `common/constants.ts:22`; `producers/event.producer.ts:46-48`; `monitoring.controller.ts:50,52,82-83`; `retry/dead-letter.service.ts:42-44` | Sim (grep) |
| A9 | Baixa | incompleto | Sem CI nem testes e2e para o serviço; `:erp` e `config` das rotas de credenciais sem validação explícita. | `.github/workflows/ci.yml` (sem referência); `test/README.md`; `credentials.controller.ts:7-10,38-39` | Sim para a ausência de CI; o efeito de um `:erp` inválido não foi confirmado |

## A.10 Dúvidas (A)

- Semântica exacta de `job.attemptsMade` na versão instalada do BullMQ (A3). Convém um teste de integração com Redis real.
- Se `KIXIMA_CALLBACK_URL` em produção inclui o caminho `/api/integration/callback` (o código faz `POST` ao URL tal como está, `webhook.producer.ts:102`).
- Se algum ERP real entrega a decisão por webhook no formato canónico ou se há um intermediário que o traduz; o código assume o formato canónico (`webhook.controller.ts:50-56`).
- Estado real do ramo referido em A7.

---

# B. `backend-java/` (Spring Boot, espelho do backend Node)

## B.1 Resumo

`backend-java/` é uma reescrita incremental, lado a lado, do backend Node em Spring Boot 3.3.4 / Java 21 (`backend-java/pom.xml`), com o Node a continuar em produção durante a migração (`docs/migracao-java/PLANO.md`, "Contexto"). Liga-se à mesma base PostgreSQL (Supabase) e às mesmas tabelas; o Prisma continua dono do DDL (B.6). Serve a API em `/api`, o frontend compilado (SPA, na mesma origem) e, em vez de Socket.IO, WebSocket/STOMP (B.5). Não foi corrido nesta análise.

Organização: um pacote por domínio em `backend-java/src/main/java/ao/kixima/` (47 pacotes), cada um com `*Controller` fino, `*Service`, repositório Spring Data e DTOs, tal como planeado (`PLANO.md` §1). Números lidos no código: 45 classes `*Controller` com 247 mapeamentos HTTP; 47 entidades JPA; 78 ficheiros de teste em `src/test` (o resultado dos testes não foi verificado: `M7-PARIDADE.md:225` declara 251 testes sem falhas).

Dependências relevantes (`pom.xml`): `spring-boot-starter-web`, `-websocket`, `-data-jpa`, `-security`, `-validation`, `-aop`, `-amqp`, `-mail`, `-quartz`, `-actuator`, `jjwt` (JWT), `flyway-core` + `flyway-database-postgresql`, `bucket4j-core` (rate limit), AWS SDK v2 `s3`, Apache POI (importação de folhas de cálculo) e `sentry-spring-boot-starter-jakarta`.

## B.2 Controllers Spring (rotas)

Gerado por análise estática das anotações `@*Mapping` (concatenando o `@RequestMapping` de classe com o de método):

| Controller (backend-java/src/main/java/ao/kixima/) | @RequestMapping de classe | Mapeamentos | Prefixos efectivos |
|---|---|---|---|
| `cobranca/AddonController.java` | `/api/addons` | 7 | `/api/addons` |
| `admin/AdminAuditController.java` | `/api/admin` | 1 | `/api/admin` |
| `admin/AdminController.java` | `/api/admin` | 12 | `/api/admin` |
| `agt/AgtController.java` | `/api/faturacao` | 4 | `/api/faturacao` |
| `apicatalogo/ApiCatalogoController.java` | `/api/v1/catalogo` | 3 | `/api/v1/catalogo` |
| `cobranca/AssinaturaController.java` | `/api/assinatura` | 8 | `/api/assinatura` |
| `auth/AuthController.java` | `/api/auth` | 14 | `/api/auth` |
| `admin/BackupAdminController.java` | `/api/admin` | 2 | `/api/admin` |
| `painel/BuyerController.java` | `/api/buyer` | 7 | `/api/buyer` |
| `catalog/CatalogController.java` | `/api/catalog` | 20 | `/api/catalog` |
| `analytics/CategoryManagementController.java` | `/api/category-management` | 2 | `/api/category-management` |
| `painel/CompanyAdminController.java` | `/api/company-admin` | 6 | `/api/company-admin` |
| `company/CompanyController.java` | `/api/companies` | 12 | `/api/companies` |
| `company/CompanyPlatformFeeController.java` | `/api/companies` | 1 | `/api/companies` |
| `conciliacao/ConciliacaoController.java` | `/api/conciliacao` | 4 | `/api/conciliacao` |
| `contract/ContractController.java` | `/api/contracts` | 4 | `/api/contracts` |
| `conversation/ConversationController.java` | `/api/conversations` | 10 | `/api/conversations` |
| `discount/DiscountThresholdController.java` | `/api/category-management/admin/thresholds` | 4 | `/api/category-management` |
| `erp/ErpConfigController.java` | `/api/companies` | 4 | `/api/companies` |
| `faturacao/FaturacaoController.java` | `/api/faturacao` | 4 | `/api/faturacao` |
| `feedback/FeedbackAdminController.java` | `/api/admin` | 3 | `/api/admin` |
| `feedback/FeedbackController.java` | `/api/feedback` | 3 | `/api/feedback` |
| `feedback/FeedbackPublicController.java` | `/api/public` | 1 | `/api/public` |
| `painel/FinanceiroController.java` | `/api/financeiro` | 3 | `/api/financeiro` |
| `ops/HealthController.java` | `—` | 2 | `/health`, `/ready` |
| `integration/IntegrationCallbackController.java` | `/api/integration` | 1 | `/api/integration` |
| `invite/InviteController.java` | `/api/companies` | 10 | `/api/companies` |
| `kit/KitController.java` | `/api/kits` | 3 | `/api/kits` |
| `marketplace/MarketplaceController.java` | `/api/marketplace` | 10 | `/api/marketplace` |
| `admin/MfaReminderController.java` | `/api/admin` | 2 | `/api/admin` |
| `notification/NotificationController.java` | `/api/notifications` | 2 | `/api/notifications` |
| `painel/PaineisController.java` | `—` | 2 | `/api/dashboard`, `/api/public` |
| `payment/PaymentController.java` | `/api/payments` | 7 | `/api/payments` |
| `admin/PlatformFeeAdminController.java` | `/api/admin` | 2 | `/api/admin` |
| `po/PoController.java` | `/api/purchase-orders` | 12 | `/api/purchase-orders` |
| `porobo/PoRoboController.java` | `/api/po-robot` | 5 | `/api/po-robot` |
| `policy/PolicyController.java` | `/api/policies` | 5 | `/api/policies` |
| `cobranca/PublicoCobrancaController.java` | `—` | 2 | `/api/planos`, `/api/webhooks` |
| `quote/QuoteController.java` | `/api/quotes` | 4 | `/api/quotes` |
| `report/ReportsController.java` | `/api/reports` | 2 | `/api/reports` |
| `retention/RetentionController.java` | `—` | 1 | `/api/retencao` |
| `supplierdev/SupplierDevController.java` | `/api/supplier-development` | 6 | `/api/supplier-development` |
| `support/SupportController.java` | `/api/support` | 22 | `/api/support` |
| `storage/UploadsController.java` | `—` | 1 | `/api/uploads` |
| `user/UserController.java` | `/api/users` | 7 | `/api/users` |

## B.3 Cobertura face ao backend Node

Método: comparei, por método HTTP + caminho normalizado (`:id` e `{id}` → `{}`), as 246 rotas Node extraídas dos routers (ver [03](03-inventario-endpoints.md)) com os 247 mapeamentos Java extraídos acima.

- **Rotas Node sem equivalente Java: 0.** A única diferença de conjunto é um artefacto de forma: o Node tem `GET /api/policies/company/:companyId?` (parâmetro opcional do Express) e o Java declara as duas formas (`GET /api/policies/company` e `GET /api/policies/company/{companyId}`), `policy/PolicyController.java:66`. É por isso que há 247 mapeamentos para 246 rotas.
- **Rotas só no Java: 0 funcionais** (apenas as duas formas acima). Para além do HTTP "de negócio", o Java expõe `/actuator/health` (a única exposição do Actuator, `application.yml:331-339`; marcado como público em `security/PublicPaths.java:43`), e os endpoints STOMP `/ws` e `/ws/sockjs` (`realtime/WebSocketConfig.java:51-55`), que não têm equivalente HTTP no Node (lá é Socket.IO em `/socket.io`).
- **Por grupo:** a contagem coincide em todos os 37 grupos de prefixo.

| Grupo (prefixo) | Rotas Node | Mapeamentos Java |
|---|---:|---:|
| `/api/addons` | 7 | 7 |
| `/api/admin` | 22 | 22 |
| `/api/assinatura` | 8 | 8 |
| `/api/auth` | 14 | 14 |
| `/api/buyer` | 7 | 7 |
| `/api/catalog` | 20 | 20 |
| `/api/category-management` | 6 | 6 |
| `/api/companies` | 27 | 27 |
| `/api/company-admin` | 6 | 6 |
| `/api/conciliacao` | 4 | 4 |
| `/api/contracts` | 4 | 4 |
| `/api/conversations` | 10 | 10 |
| `/api/dashboard` | 1 | 1 |
| `/api/faturacao` | 8 | 8 |
| `/api/feedback` | 3 | 3 |
| `/api/financeiro` | 3 | 3 |
| `/api/integration` | 1 | 1 |
| `/api/kits` | 3 | 3 |
| `/api/marketplace` | 10 | 10 |
| `/api/notifications` | 2 | 2 |
| `/api/payments` | 7 | 7 |
| `/api/planos` | 1 | 1 |
| `/api/po-robot` | 5 | 5 |
| `/api/policies` | 4 | 5 |
| `/api/public` | 2 | 2 |
| `/api/purchase-orders` | 12 | 12 |
| `/api/quotes` | 4 | 4 |
| `/api/reports` | 2 | 2 |
| `/api/retencao` | 1 | 1 |
| `/api/supplier-development` | 6 | 6 |
| `/api/support` | 22 | 22 |
| `/api/uploads` | 1 | 1 |
| `/api/users` | 7 | 7 |
| `/api/v1` | 3 | 3 |
| `/api/webhooks` | 1 | 1 |
| `/health` | 1 | 1 |
| `/ready` | 1 | 1 |
| **Total** | **246** | **247** |

- **Restrições de papel/área (`requireRole`/`requirePermission`/`requireSuperAdmin` vs `@RequireRole`/`@RequirePermission`/`@RequireSuperAdmin`):** extraí os middlewares de cada rota Node (`rotas.json`, campo `mw`) e as anotações de cada método Java. Nas 245 rotas comuns não encontrei diferenças: 164 com `requireRole`, 77 com `requirePermission`, 7 com `requireSuperAdmin`, com o mesmo conjunto de papéis/área em ambos os lados. (A verificação compara apenas a anotação; as regras de posse por empresa dentro dos serviços não foram comparadas uma a uma.)
- **Rotas públicas (sem `authenticate`):** as 25 rotas Node sem `authenticate` (health, ready, retencao, uploads, login/forgot/reset/2fa, public stats/feedback, register, convites, supplier-development, `v1/catalogo`, planos, webhooks de pagamento, integração) têm todas entrada correspondente em `PublicPaths` (`security/PublicPaths.java:36-90`). Diferença de granularidade: várias entradas Java valem para todos os métodos HTTP (p. ex. `/api/auth/login`, `/api/uploads/*`, `/api/v1/catalogo/*`), enquanto o Node declara método+rota; como só existem esses métodos nessas rotas, não há efeito observável hoje.

### Diferenças conhecidas e documentadas (`M7-PARIDADE.md`, `AUDITORIA-PRE-M8.md`)

- Ordem de empates em `marketplace/facets` e `reports/fornecedor` (o Node não é determinístico), e desempate por `id` na pesquisa do marketplace.
- `invoice.agtErro.code`: `null` no Node, `SERVICO_INDISPONIVEL` no Java (503 "recusa-se a fingir" sem chave AGT).
- Mensagens de validação de `@Size/@Positive/@Email` são as do Hibernate Validator, não as do zod; a forma e o `code` são iguais (`details` imita o `flatten()` do zod).
- `searchText` (coluna interna) omitida nas respostas Java.
- Corrigidas durante o M7 (já não são diferenças): forma das respostas de PO, decimais como texto (`JacksonDecimalConfig`), `updatedAt`, `emFalta` dos canais de cobrança, `details` do 422.

## B.4 Segurança

- **Spring Security como casca:** `SecurityConfig` tem `anyRequest().permitAll()`, CSRF desactivado, sessão `STATELESS`, `httpBasic`/`formLogin` desligados; a decisão real de acesso está em `AuthenticationFilter` + `RbacAspect`, como o Node tem em `auth.js`/`rbac.js` (`security/SecurityConfig.java:19-27,43-52`). O Spring só fornece o `BCryptPasswordEncoder(12)` (mesmo custo que o `SALT_ROUNDS = 12` do Node, `backend/src/services/authService.js:14`; `SecurityConfig.java:33-36`).
- **JWT:** HS256 com `JWT_SECRET` (bytes UTF-8 do segredo), claims `sub`, `role`, `companyId`, `tv` (tokenVersion); tokens de uso especial com `t` ∈ `2fa` (15 min), `pwreset` (1 h), `invite` (7 d) (`security/JwtService.java:82,86,211-238`). Validade de sessão `JWT_EXPIRES_IN` (omissão `1d`, `application.yml:145`; o Node tem a mesma omissão, `backend/src/config/env.js:256`). O render do serviço Java reutiliza o MESMO `JWT_SECRET` do Node, para as sessões valerem nos dois (`render.yaml`, comentário no serviço `kixima-java`).
- **Cookie de sessão:** `kixima_sessao`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` apenas se o perfil activo contiver `prod`, `Max-Age` = validade do JWT (`security/SessionCookieUtil.java:27,33-37`). O Bearer continua aceite como alternativa (cookie tem prioridade) (`AuthenticationFilter.java:53-60`).
- **Autenticação por pedido** (`AuthenticationFilter.java:74-148`): token inválido/ausente → 401 `UNAUTHORIZED` excepto rota pública; vai sempre à base buscar o utilizador (activo) e compara `tv` com `tokenVersion` (revogação); calcula a política 2FA (`MfaPolicyService`) e, em sessão "restrita", só deixa passar `/api/auth/(me|logout|2fa/*)`, `/api/users/profile` e `/api/notifications` (403 `FORBIDDEN`) — expressões idênticas às do Node (`security/MfaPolicyService.java:20-24` vs `backend/src/services/mfaPolicy.js:17-21`). O SPA fica fora do filtro (`shouldNotFilter`, `:70-72`).
- **RBAC:** aspecto AOP `@Before("execution(* ao.kixima..*Controller.*(..))")` que aplica `@RequireRole`, `@RequirePermission`, `@RequireSuperAdmin` pela mesma ordem do Node; `@RequirePermission` sozinho é "pass-through" para quem não é `ADMIN_SISTEMA`, tal como `requirePermission()` do Node (`security/RbacAspect.java:34,69-83`). `adminAreas` vazio = Super Admin.
- **CORS:** `CorsOrigins` (allow-list `APP_URL` + origens do Capacitor `https://localhost` e `capacitor://localhost` + `CORS_ORIGINS`; em perfil `dev`/`test`/sem perfil aceita qualquer origem) usado tanto pelo REST como pelo STOMP; `allowCredentials(true)`, métodos `GET,POST,PUT,PATCH,DELETE,OPTIONS`, origem concreta nunca `*` (`security/CorsOrigins.java:162,190-194`; `SecurityConfig.java:97-109`; `realtime/WebSocketConfig.java:62-65`).
- **Cabeçalhos:** os do helmet 7.2.0 e a CSP de `config/csp.js` replicados à mão (`SecurityConfig.java:68-82`, `security/ContentSecurityPolicy.java`), com `X-Frame-Options: SAMEORIGIN`, HSTS 15552000 s, `Cross-Origin-Resource-Policy: cross-origin`, etc.
- **Rate limit:** `RateLimitFilter` (Bucket4j, janela fixa, em memória, por instância) antes da autenticação, com as regras do `rateLimit.js`: `api` 600/15 min por utilizador (ou IP), `auth` 60/15 min só falhas, `forgot-password` 10/15 min, `sensitive` 30/15 min, `chat` 60/min, `feedback` 10/15 min, `candidaturas` 10/15 min; resposta 429 `RATE_LIMITED` com cabeçalhos draft-7; desligado no perfil `test` (`security/RateLimitFilter.java:102-115`; `application.yml:98-107`). A API de catálogo por chave tem limite próprio (120/min por chave, `apicatalogo/ApiCatalogoController.java:57`).
- **Erros:** `GlobalExceptionHandler` com o mesmo envelope `{error:{code,message,details?}}`; 404 `ROUTE_NOT_FOUND` para rotas sem handler (`spring.mvc.throw-exception-if-no-handler-found`, `application.yml:82`), `UNIQUE_CONSTRAINT` 409, `NOT_FOUND` 404, `INTERNAL_ERROR` 500; `stack` só com o perfil `dev` activo (`common/error/GlobalExceptionHandler.java:41-44,139-151`).
- **Guarda de arranque em produção:** `ProducaoStartupGuard` (`@Profile("prod")`) recusa arrancar com `JWT_SECRET` fraco ou S3 mal configurado (`config/ProducaoStartupGuard.java:35`).

## B.5 STOMP / WebSocket (em vez de Socket.IO)

- **Endpoints:** `/ws` (WebSocket nativo) e `/ws/sockjs` (fallback SockJS), ambos com o `RealtimeHandshakeInterceptor` (guarda o cookie de sessão do handshake) (`realtime/WebSocketConfig.java:51-55`).
- **Broker simples** em memória: destinos `/topic` e `/queue`, prefixo de utilizador `/user`, prefixo de aplicação `/app` (sem destinos `/app` em uso) (`WebSocketConfig.java:67-72`).
- **Autenticação no `CONNECT`** (`realtime/RealtimeAuthInterceptor.java:94-115`): mesmo cookie (do handshake) ou `Authorization: Bearer` no frame, mesmo JWT, vai sempre à base buscar o utilizador e confere `tokenVersion`.
- **Autorização no `SUBSCRIBE`** (`RealtimeAuthInterceptor.java:117-140`): `/user/queue/notifications` (só o próprio), `/topic/support/{ticketId}` e `/topic/conversation/{id}` — revalidados contra a base pela mesma regra do REST (`SupportChatService.ticketComAcesso`, `ConversationService.conversationComAcesso`); qualquer outro destino é negado.
- **Mapa de eventos** (`WebSocketConfig.java:17-27`): `user:<id>` → `/user/queue/notifications` (evento `notification:new`); `support:<ticketId>` → `/topic/support/{ticketId}` (`support:message`, `support:updated`); `conversation:<id>` → `/topic/conversation/{id}` (`conversation:message`, `conversation:risk-alert`). Cada mensagem é um envelope `{ event, payload }`.
- **Cliente:** o frontend só tem cliente Socket.IO (ver C.5 e achado B1/C1): a mudança de cliente prevista no plano (`PLANO.md`, "Decisões já tomadas") não está implementada.

## B.6 Flyway/JPA vs Prisma

| Tema | Node (Prisma) | Java (JPA/Hibernate) | Evidência |
|---|---|---|---|
| Fonte do schema | `backend/prisma/schema.prisma` (49 `model`, 36 `enum`); 53 directórios de migração em `backend/prisma/migrations/` | Entidades `@Entity` + `@Table(name=…)`/`@Column(name=…)` explícitos, sem inferência | `schema.prisma`; `ao/kixima/**/Kit.java:13-35` (exemplo) |
| Dono do DDL | Prisma (`migrate`) | Hibernate só valida: `ddl-auto: validate` | `application.yml:38-43` |
| Flyway | — | dependência presente, `enabled: ${FLYWAY_ENABLED:false}`, `baseline-on-migrate: true`, `baseline-version: 0`; **não existe nenhum ficheiro `.sql`** nem pasta `db/migration` em `backend-java/src` | `application.yml:51-59`; `find` sem resultados |
| Entidades | 49 modelos | 47 entidades; `reference_counters` e `series_faturacao` não têm entidade e são acedidas por SQL nativo | `common/reference/ReferenceCounterService.java:67`; `faturacao/FaturacaoService.java:123` |
| Identificadores | `@default(uuid())` em 47 colunas (gerado na aplicação) | `UUID.randomUUID().toString()` gerado no serviço antes do `INSERT` | `schema.prisma`; p. ex. `po/PoService.java` (várias) |
| `updatedAt` | `@updatedAt` | `@UpdateTimestamp` (21 ocorrências, algumas com o nome totalmente qualificado em `Company.java:136` e `User.java:126`) | grep |
| Decimais | `Decimal` (texto no JSON) | `BigDecimal`; `JacksonDecimalConfig` serializa como texto; aritmética "JS" como número (`Decimais.numero`) | `config/JacksonDecimalConfig.java`; `common/Decimais.java` |
| Lazy loading | `include`/`select` explícitos por query | `open-in-view: false`; DTOs construídos dentro de transacção de leitura (`PoDtoService`) após o replay de paridade ter apanhado `LazyInitializationException` | `application.yml:44`; `M7-PARIDADE.md`, defeito 1 |
| Pool | pool do Prisma | Hikari `maximum-pool-size: ${DB_POOL_MAX:5}`, pequeno de propósito para não esfomear o Node | `application.yml:32-36` |
| `DATABASE_URL` | connection string Prisma | `DatabaseUrlEnvironmentPostProcessor` traduz-a para `spring.datasource.*` (parâmetros Prisma como `pgbouncer` ignorados com aviso); alternativa `DATABASE_URL_JDBC` + `DATABASE_USER` + `DATABASE_PASSWORD` | `application.yml:1-31`; `config/DatabaseUrlEnvironmentPostProcessor.java` |
| Tecto de linhas | extensão global (`DB_MAX_ROWS`) | `TectoDeLinhasStatementInspector` + aspecto; `reference_counters` isento | `config/TectoDeLinhasConfig.java`; `application.yml:236` |

Jobs agendados: 6 (`RetencaoJob`, `PolicyExpiryJob`, `SubscriptionExpiryJob`, `MfaReminderJob`, `PoRoboJob`, `BackupJob`), todos **desligados por omissão** (`KIXIMA_JOB_*_ENABLED:false`) para não duplicarem os do Node (`application.yml:113-129`).

## B.7 Estado da migração (`docs/migracao-java/`)

- **`PLANO.md`** define os marcos M0–M8 (scaffolding, auth/RBAC, empresa/catálogo, fluxo comercial, AGT, suporte/operações, jobs/realtime/mensageria, paridade, cutover).
- **`LACUNAS-POS-M6.md`**: inventário feito no fecho do M6 (Node 244 × Java 124, 121 em falta, 23 controllers) — seguido de grupos A a D todos marcados "FECHADO" (`:31,49,64,77`). A tabela do início (`:9-11`) é histórica e já não reflecte o estado actual (ver achado B2).
- **`M7-PARIDADE.md`**: inventário 246/246 (`:20-22`); replay de contrato de 95 passos Node × Java (89 iguais, 6 com diferenças explicadas); 8 defeitos reais corrigidos; teste de carga local indicativo (Node 503 pedidos/s, Java 466 pedidos/s, sem 5xx, `:149-150`); suites declaradas: Java 251 testes, Node 111 suites/1020 testes (`:225-226`).
- **`AUDITORIA-PRE-M8.md`**: veredicto inicial "não pronto para o M8" e oito riscos de produção (R1–R8: reset de senha por email, MFA por email, helmet/CSP, SMTP e i18n de emails, tecto de linhas, Sentry, allow-list de CORS, guarda de arranque) mais doze diferenças (D1–D12), todos declarados corrigidos.
- **Por fazer antes do cutover** (segundo os próprios documentos): teste de carga contra a réplica de staging, S3 de ponta a ponta contra um bucket real, e confirmar em produção `SPRING_PROFILES_ACTIVE`, provider de email e `SENTRY_DSN` (`AUDITORIA-PRE-M8.md:70-75`; `M7-PARIDADE.md:158,192-198`).
- **Deploy lado a lado já preparado:** o `render.yaml` da raiz define o serviço `kixima-java` (Docker, `backend-java/Dockerfile`, `healthCheckPath: /ready`, `SPRING_PROFILES_ACTIVE` = `prod`) ao lado do serviço `kixima` (Node) (`render.yaml:18-28,149-162`). A imagem Java compila o frontend com `VITE_REALTIME=stomp` (`backend-java/Dockerfile:24`) — flag que o frontend actual não lê (achado B1). O estado do cutover (M8) não está documentado em `docs/migracao-java/` como concluído; o plano exige aprovação explícita do utilizador por domínio (`PLANO.md` §3, M8).

## B.8 Achados (B)

| Id | Severidade | Tipo | Descrição | Evidência | Confirmado? |
|---|---|---|---|---|---|
| B1 | Alta | incompleto | O tempo real do Java não é utilizável pelo frontend actual. O Java só oferece STOMP (`/ws`, `/ws/sockjs`); o frontend só tem `socket.io-client` e liga-se a `/socket.io`. O `Dockerfile` Java define `VITE_REALTIME=stomp`, mas nada no frontend lê essa variável nem existe dependência STOMP (`@stomp/stompjs`). Num deploy do `kixima-java`, chat de suporte, chat comercial e notificações em tempo real ficariam sem ligação. | `backend-java/Dockerfile:24`; `realtime/WebSocketConfig.java:51-55`; `frontend/src/realtime/RealtimeContext.jsx:12,40`; `frontend/package.json` (só `socket.io-client`); grep de `VITE_REALTIME`/`stomp` em `frontend/` (sem resultados fora do Dockerfile Java) | Sim, por leitura e grep; comportamento em runtime não executado |
| B2 | Média | dívida | `LACUNAS-POS-M6.md` contradiz o estado actual: a tabela de topo diz Node 244 / Java 124 / 121 em falta / 23 controllers; o código tem 45 controllers e 247 mapeamentos sem rotas em falta (e `M7-PARIDADE.md:20-22` diz 246/246). Quem ler só o primeiro documento conclui que metade da API falta. | `docs/migracao-java/LACUNAS-POS-M6.md:7-14`; contagem em B.3 | Sim |
| B3 | Baixa | dívida | A auditoria diz ter varrido os marcadores "NÃO PORTADO" ("zero restantes") mas há 15 no código de produção, vários já falsos: `EventBus.java:38-40` diz que `approval_requested` e `payment.completed` não têm chamador Java (têm: `PoService.java:270`, `PaymentService.java:199`); `FeedbackPublicController.java:11` diz que `/api/public/stats` não está portado (está em `painel/PaineisController.java:98`); `FeedbackController.java:24`, `SupplierDevController.java:40`, `SupportController.java:58` e `ConversationController.java:49` dizem que os limitadores de taxa não estão portados (estão em `RateLimitFilter.java:102-115`). | `AUDITORIA-PRE-M8.md:49`; `grep "NÃO PORTADO" backend-java/src/main` (15 resultados) | Sim |
| B4 | Média | incompleto | Faturas consolidadas de contrato (call-offs, sem PO): o pagamento foi corrigido (D2), mas `CreditNoteService` e `ConciliacaoService` ainda declaram o ramo `contract` como não portado e lêem `invoice.getPurchaseOrder()`; o Node trata `invoice.contract` nos dois (`creditNoteService.js:33,42-43`; `conciliacaoService.js:165,197`). O comportamento Java para uma fatura sem PO nestas duas operações não foi confirmado (esperável erro ou negação indevida). | `creditnote/CreditNoteService.java:52,105`; `conciliacao/ConciliacaoService.java:50,192,229` | Parcial: o marcador e a leitura estão confirmados; o efeito em runtime não |
| B5 | Média | vulnerabilidade | Segurança por configuração: sem o perfil `prod` activo, o CORS aceita qualquer origem com credenciais (o perfil "default" conta como desenvolvimento) e o cookie de sessão perde `Secure`. Hoje o `render.yaml` define `SPRING_PROFILES_ACTIVE=prod` e há guarda de arranque, mas um deploy fora do Render sem a variável ficaria aberto. | `security/CorsOrigins.java:162,190-194`; `SessionCookieUtil.java:27`; `render.yaml:161-162`; `AUDITORIA-PRE-M8.md` (item "Fuga de stack trace… depende de `SPRING_PROFILES_ACTIVE`") | Sim, por leitura |
| B6 | Baixa | falha | Qualquer `DataIntegrityViolationException` (chave estrangeira, `NOT NULL`, `CHECK`, não só unicidade) responde 409 `UNIQUE_CONSTRAINT` "Já existe um registo com estes dados". O Node só trata o código `P2002` (unicidade) desta forma; outras violações do Prisma caem no 500 genérico. | `common/error/GlobalExceptionHandler.java:106-111`; `backend/src/middleware/errorHandler.js:42-45` | Sim, por leitura |
| B7 | Baixa | dívida | O Flyway está declarado mas sem migrações; o DDL continua a ser do Prisma e o Java só valida (`ddl-auto: validate`). Um cutover final exige decidir quem passa a ser dono do DDL (o plano diz "só no cutover final", `PLANO.md` §2) e migrar o histórico de 53 migrações Prisma ou fazer baseline. Duas tabelas (`reference_counters`, `series_faturacao`) existem só como SQL nativo, fora do `validate`. | `application.yml:38-59`; `ReferenceCounterService.java:67`; `FaturacaoService.java:123` | Sim |
| B8 | Baixa | dívida | O RBAC depende de uma convenção de nomes: o aspecto só intercepta classes cujo nome termina em `Controller`; uma anotação `@RequireRole` em qualquer outra classe seria ignorada sem erro. Todos os 45 controllers actuais cumprem a convenção. | `security/RbacAspect.java:34` | Sim |
| B9 | Baixa | dívida | Rate limit em memória por instância (Bucket4j) — o mesmo alcance do `MemoryStore` do Node, mas com mais de uma instância (ou durante a sobreposição Node + Java) os limites somam-se por instância e não são partilhados. | `security/RateLimitFilter.java:23-33` (comentário) | Sim, por desenho declarado |

## B.9 Dúvidas (B)

- Se o plano de cutover prevê alterar o frontend para STOMP antes do M8 (B1); não há ramo, ficheiro ou issue no repositório que o mostre.
- Comportamento em runtime das operações de nota de crédito/conciliação sobre faturas consolidadas (B4).
- A igualdade de regras de posse por empresa dentro dos serviços (fora do que as anotações RBAC mostram) só está garantida pelos testes portados e pelo replay (`M7-PARIDADE.md`); não foi relida serviço a serviço.
- Estado do M8 (cutover): não há registo de aprovação nem de domínios já cortados nos documentos lidos.

---

# C. `frontend/` (camada cliente da API)

## C.1 Resumo

SPA React 18 + Vite 5 + `react-router-dom` 7, empacotável como app nativa (Capacitor 8) (`frontend/package.json`, `frontend/capacitor.config.json`). Não existe uma camada de "serviços" por domínio: há **um único cliente HTTP** (`frontend/src/api/client.js`, objecto `api`) e as páginas/componentes chamam-no directamente com caminhos `/api/...` escritos à mão. A tabela C.6 mapeia por isso ficheiro de página → grupos de endpoints. Tempo real por Socket.IO (C.5). Autorização real é do servidor; o cliente só decide o que mostrar (C.8).

## C.2 Onde está o cliente HTTP, base URL e proxy

- **Cliente:** `frontend/src/api/client.js`. É um *wrapper* fino sobre `fetch` (não usa axios). API: `api.get(path, params)`, `post`, `patch`, `put`, `del`, `upload(path, file, field='image')` (multipart, 1 ficheiro) e `postForm(path, formData)` (multipart já montado) (`client.js:223-231`). `request()` junta `params` à query ignorando `undefined`/`null`/`''` (`:124-130`), envia sempre `Content-Type: application/json` (também em GET) (`:137`) e serializa o corpo com `JSON.stringify` se existir (`:138`).
- **Base URL:** `apiBaseUrl()` devolve `''` (caminho relativo, mesma origem) na Web e, dentro do Capacitor, `VITE_API_BASE_URL` ou, na sua falta, `https://kixima.net` (`client.js:70-72`). É função e não constante porque `window.Capacitor` é injectado de forma assíncrona (`:63-69`). `ehAppNativa()` detecta o runtime nativo (`:49-54`). Os caminhos nas chamadas já começam por `/api/...`; a base nunca acrescenta `/api` (`:56-59`).
- **Proxy do Vite (só desenvolvimento):** `/api` → `http://localhost:4000` (`changeOrigin`) e `/socket.io` → `http://localhost:4000` com `ws: true` (`frontend/vite.config.js:32-44`). O alvo está fixo no ficheiro (porta do Node); não há `/ws` (STOMP) nem alvo configurável. Em produção o SPA e a API são servidos pela mesma origem (comentário `client.js:29-39`; no Node pelo `middleware/frontend.js`, no Java por `frontend/SpaHandlerMapping`).
- **Outros caminhos de produção:** `frontend/nginx.conf` (imagem `frontend/Dockerfile`, serviço `frontend` do `docker-compose.yml`) reencaminha `/api/` e `/health` para `http://backend:4000` e faz fallback de SPA; **não** tem `location /socket.io/` (achado C5).
- **Variáveis `VITE_*` lidas em `src/`:** `VITE_API_BASE_URL`, `VITE_SENTRY_DSN`, `VITE_LABEL`, `VITE_TONE`. (`VITE_REALTIME`, que a imagem Java define, não é lida — achado B1/C1.)

## C.3 Cookies e credenciais

- **Sessão = cookie `httpOnly` `kixima_sessao` posto pelo servidor.** O frontend nunca lê nem guarda o JWT em `localStorage` (comentário `client.js:10-20`). Todos os pedidos levam `credentials: 'include'` (`COM_SESSAO`, `client.js:25`; aplicado em `:139,178,202`).
- **Marca de sessão (não é credencial):** `localStorage['kixima_tem_sessao'] = '1'` serve só para decidir se vale a pena perguntar `/api/auth/me` no arranque e para decisões de interface (`client.js:113-122`; `auth/AuthContext.jsx:25-28`).
- **App nativa (Capacitor):** o cookie `SameSite=Lax` pode não sobreviver ao pedido cross-origin; por isso a resposta do login/2FA devolve `token` e o cliente guarda-o **só em memória** (`definirBearerNativo`, recusado fora do Capacitor) e envia `Authorization: Bearer` em todos os pedidos (`client.js:92-108`; chamado em `AuthContext.jsx:77,88,97`). O Socket.IO reutiliza o mesmo Bearer no handshake (C.5).
- **CSRF:** não há token CSRF no cliente; a defesa é `SameSite=Lax` no cookie (backend) e o corpo JSON.

## C.4 Interceptores e tratamento de erros

Não há interceptores globais (nem para 401, 403, 429, nem para 2FA): o tratamento é local.

| Situação | Onde e como é tratada | Evidência |
|---|---|---|
| Erro HTTP genérico | `request()` lança `Error` com `message` = `error.message` do envelope `{error:{code,message,details}}`, traduzida por `translate()` (i18n: a mensagem do servidor em PT é a chave); anexa `err.rawMessage`, `err.code`, `err.details`, `err.status`. Sem corpo JSON: "Erro {status} ao contactar a API." | `client.js:145-155` |
| 2xx sem JSON válido | Lança "A API respondeu sem dados válidos — verifique a ligação." (nunca devolve `null`) | `client.js:163-167` |
| 401 | Só tratado no arranque: `loadMe` apaga a marca de sessão e mostra o login; qualquer outro erro (429, rede, 5xx) **não** apaga a sessão — tenta 3 vezes (espera 400 ms e 1200 ms) e, esgotadas, marca "sessão indeterminada" com botão "Tentar de novo" | `AuthContext.jsx:7-13,43-64`; `RequireAuth.jsx:138-147` |
| 401 a meio da sessão | Sem tratamento central: a página que fez o pedido mostra o erro; o utilizador só é reencaminhado ao login quando `user` desaparece (logout) ou a app recarrega (achado C2) | `RequireAuth.jsx:126-150` |
| 403 | Sem tratamento central. Páginas isoladas usam `err.status === 403` para mostrar "sem acesso" (`PermissionsPanel`, `SuporteChat` fila, `SecurityAlerts`, `adminSistema/Home`). A sessão "restrita" por 2FA obrigatória devolve 403 `FORBIDDEN` com mensagem explicativa que cada página mostra tal como vem | `components/PermissionsPanel.jsx:81`; `pages/shared/SuporteChat.jsx:168`; `pages/adminSistema/SecurityAlerts.jsx:31`; `pages/adminSistema/Home.jsx:21` |
| `PLANO_INSUFICIENTE` | `ErrorBanner` reconhece o código (não o texto) e mostra o botão "Ver planos e subscrever" (só `COMPANY_ADMIN`), "Ver a subscrição" (`COMPANY_ADMIN`, `FINANCEIRO`) ou a explicação para os restantes papéis | `components/Common.jsx:71-74,98-118` |
| 2FA no login | `POST /api/auth/login` devolve `{ requires2fa, challenge }` em vez de sessão; a página guarda o `challenge`, pede o código e chama `POST /api/auth/2fa/verify { challenge, code }`; há reenvio por `POST /api/auth/2fa/reenviar { challenge }`. A resposta final traz `user`, `mfaPendente`, `mfaPrazo` | `AuthContext.jsx:70-92`; `pages/shared/LoginPage.jsx:45-46,64,84` |
| 2FA por activar | Banner `AvisoMfa` com contagem de dias quando `user.mfaPendente`; `user.mfaRestrita` **não é lido** em lado nenhum do frontend | `components/AppLayout.jsx:161,175-203`; grep de `mfaRestrita` em `frontend/src` (sem resultados) |
| 429 | Sem tratamento especial, excepto a repetição no arranque (`AuthContext`) | `AuthContext.jsx:31-42` |
| Falha de rede | `fetch` rejeita; as páginas apanham com `.catch` e mostram `e.message`; logout é "best-effort" | `AuthContext.jsx:94-100` |

## C.5 Socket.IO

- **Ligação única por sessão** em `realtime/RealtimeContext.jsx`: `io(apiBaseUrl() || '/', { withCredentials: true, transports: ['websocket','polling'], auth: { token: <Bearer nativo> } })`, criada quando há `user` e fechada no logout ou na troca de conta (`RealtimeContext.jsx:24-57`). O cookie de sessão autentica o handshake na Web; o Bearer em `auth.token` é usado na app nativa.
- **Emissão do cliente** (`RealtimeContext.jsx:61-64`): `support:join`/`support:leave` (ticket) e `conversation:join`/`conversation:leave`, com `ack` do servidor (`{ ok:false }` quando não há autorização; o servidor revalida sempre).
- **Eventos ouvidos:** `notification:new` (`components/AppLayout.jsx:94`), `conversation:message` (`pages/shared/ChatComercial.jsx:89`), `support:message` e `support:updated` (`pages/shared/SuporteChat.jsx:106-107,252-253`). O evento `conversation:risk-alert`, emitido pelo servidor Node/Java, não tem `socket.on` correspondente na pesquisa feita (não confirmado se outro componente o ouve por outro nome).
- **Compatibilidade com o Java:** o servidor Java só fala STOMP, por isso este cliente não liga a um `kixima-java` (achado B1/C1).

## C.6 Módulos do frontend e grupos de endpoints que consomem

Gerado por análise estática: `api.<método>('/api/…')` com literais ou *template strings* (`${…}` normalizado para `{}`), mais 9 chamadas de caminho indirecto adicionadas à mão (props de `PermissionsPanel`, anexos de chat via `postForm`, uma cadeia `.get(` quebrada em linhas em `adminSistema/Companies.jsx:20` e o `fetch` directo de `i18n/index.jsx:116`). Total: **282 chamadas em 93 ficheiros**. O grupo é o prefixo `/api/<recurso>[/<subrecurso>]` (n.º de chamadas entre parênteses). As rotas dinâmicas aparecem como `/api/companies` quando o segundo segmento é um id.

| Ficheiro (frontend/src/) | Grupos de endpoints consumidos (n.º de chamadas) |
|---|---|
| `auth/AuthContext.jsx` | `/api/auth` (4) |
| `components/AppLayout.jsx` | `/api/assinatura` (1), `/api/conversations` (2), `/api/notifications` (1), `/api/support` (1), `/api/users` (1) |
| `components/AvatarUploader.jsx` | `/api/users` (2) |
| `components/MarketAside.jsx` | `/api/purchase-orders` (1) |
| `components/NotificationPanel.jsx` | `/api/notifications` (1) |
| `components/PermissionsPanel.jsx` | `/api/admin` (3), `/api/companies` (2) |
| `components/chat/StartConversationButton.jsx` | `/api/conversations` (1) |
| `i18n/index.jsx` | `/api/users` (1) |
| `pages/adminSistema/Administradores.jsx` | `/api/admin` (6) |
| `pages/adminSistema/AuditTrail.jsx` | `/api/admin` (1) |
| `pages/adminSistema/Avaliacoes.jsx` | `/api/admin` (3) |
| `pages/adminSistema/Cobrancas.jsx` | `/api/addons` (4), `/api/assinatura` (3) |
| `pages/adminSistema/Companies.jsx` | `/api/companies` (2) |
| `pages/adminSistema/Contracts.jsx` | `/api/companies` (2), `/api/contracts` (2) |
| `pages/adminSistema/DescontosEconomiaEscala.jsx` | `/api/category-management` (5) |
| `pages/adminSistema/DueDiligence.jsx` | `/api/companies` (3) |
| `pages/adminSistema/ErpIntegrations.jsx` | `/api/companies` (7) |
| `pages/adminSistema/Home.jsx` | `/api/companies` (1) |
| `pages/adminSistema/Plans.jsx` | `/api/companies` (2), `/api/planos` (1) |
| `pages/adminSistema/PlatformFees.jsx` | `/api/admin` (2) |
| `pages/adminSistema/PolicyManagement.jsx` | `/api/companies` (2), `/api/policies` (4) |
| `pages/adminSistema/Prontidao.jsx` | `/api/admin` (6) |
| `pages/adminSistema/SecurityAlerts.jsx` | `/api/conversations` (3) |
| `pages/adminSistema/SolicitarSerie.jsx` | `/api/faturacao` (2) |
| `pages/adminSistema/SupplierDev.jsx` | `/api/supplier-development` (3) |
| `pages/adminSistema/SystemActivities.jsx` | `/api/admin` (1) |
| `pages/companyAdmin/Activities.jsx` | `/api/company-admin` (1) |
| `pages/companyAdmin/Approvals.jsx` | `/api/purchase-orders` (1) |
| `pages/companyAdmin/Assinatura.jsx` | `/api/assinatura` (6) |
| `pages/companyAdmin/CompanyDocuments.jsx` | `/api/companies` (1) |
| `pages/companyAdmin/CompanyProfile.jsx` | `/api/companies` (1), `/api/policies` (1) |
| `pages/companyAdmin/ConteudoLocal.jsx` | `/api/reports` (1) |
| `pages/companyAdmin/Contracts.jsx` | `/api/contracts` (1) |
| `pages/companyAdmin/Home.jsx` | `/api/company-admin` (1) |
| `pages/companyAdmin/Organization.jsx` | `/api/companies` (2), `/api/company-admin` (1) |
| `pages/companyAdmin/Reports.jsx` | `/api/company-admin` (1) |
| `pages/companyAdmin/Settings.jsx` | `/api/company-admin` (2) |
| `pages/companyAdmin/Users.jsx` | `/api/companies` (8) |
| `pages/comprador/Activities.jsx` | `/api/buyer` (1) |
| `pages/comprador/Catalog.jsx` | `/api/marketplace` (2) |
| `pages/comprador/CategoryManagement.jsx` | `/api/category-management` (1) |
| `pages/comprador/Checkout.jsx` | `/api/purchase-orders` (1) |
| `pages/comprador/Deliveries.jsx` | `/api/buyer` (1) |
| `pages/comprador/Explore.jsx` | `/api/marketplace` (5) |
| `pages/comprador/Home.jsx` | `/api/dashboard` (1), `/api/marketplace` (4), `/api/notifications` (1) |
| `pages/comprador/ItemDetail.jsx` | `/api/catalog` (1) |
| `pages/comprador/Orders.jsx` | `/api/buyer` (1) |
| `pages/comprador/Payments.jsx` | `/api/buyer` (1) |
| `pages/comprador/PoRobot.jsx` | `/api/addons` (4), `/api/assinatura` (1), `/api/marketplace` (1), `/api/po-robot` (8) |
| `pages/comprador/Quotes.jsx` | `/api/catalog` (1), `/api/quotes` (3) |
| `pages/comprador/Receptions.jsx` | `/api/buyer` (1) |
| `pages/comprador/ServiceDetail.jsx` | `/api/catalog` (4), `/api/quotes` (1) |
| `pages/comprador/Services.jsx` | `/api/marketplace` (4), `/api/quotes` (1) |
| `pages/comprador/SupplierCompare.jsx` | `/api/marketplace` (1) |
| `pages/comprador/Suppliers.jsx` | `/api/buyer` (1) |
| `pages/corporate/CorporateHome.jsx` | `/api/public` (2) |
| `pages/financeiro/Home.jsx` | `/api/companies` (1), `/api/financeiro` (1), `/api/payments` (1), `/api/purchase-orders` (1) |
| `pages/financeiro/PaymentHistory.jsx` | `/api/financeiro` (1) |
| `pages/financeiro/PendingInvoices.jsx` | `/api/financeiro` (1), `/api/payments` (1) |
| `pages/fornecedor/CatalogImport.jsx` | `/api/catalog` (1), `/api/planos` (1) |
| `pages/fornecedor/CatalogInsights.jsx` | `/api/catalog` (1) |
| `pages/fornecedor/CatalogManage.jsx` | `/api/catalog` (10), `/api/planos` (1) |
| `pages/fornecedor/Documents.jsx` | `/api/catalog` (1) |
| `pages/fornecedor/Home.jsx` | `/api/purchase-orders` (1) |
| `pages/fornecedor/Inventory.jsx` | `/api/catalog` (2) |
| `pages/fornecedor/Invoices.jsx` | `/api/purchase-orders` (1) |
| `pages/fornecedor/Kits.jsx` | `/api/catalog` (1), `/api/kits` (3) |
| `pages/fornecedor/OrderHistory.jsx` | `/api/purchase-orders` (1) |
| `pages/fornecedor/OrdersReceived.jsx` | `/api/purchase-orders` (1) |
| `pages/fornecedor/Payments.jsx` | `/api/payments` (1), `/api/purchase-orders` (1) |
| `pages/fornecedor/ProductRanking.jsx` | `/api/reports` (1) |
| `pages/fornecedor/Reports.jsx` | `/api/reports` (1) |
| `pages/fornecedor/StockMovements.jsx` | `/api/catalog` (3) |
| `pages/fornecedor/SupplierQuotes.jsx` | `/api/quotes` (2) |
| `pages/fornecedor/Wallet.jsx` | `/api/companies` (1), `/api/purchase-orders` (1) |
| `pages/shared/AcceptAdminInvite.jsx` | `/api/admin` (2) |
| `pages/shared/AcceptInvite.jsx` | `/api/companies` (2) |
| `pages/shared/ChatComercial.jsx` | `/api/conversations` (4) |
| `pages/shared/FeeStatement.jsx` | `/api/companies` (1) |
| `pages/shared/Help.jsx` | `/api/conversations` (1), `/api/support` (5) |
| `pages/shared/HelpAdmin.jsx` | `/api/support` (5) |
| `pages/shared/LoginPage.jsx` | `/api/auth` (1) |
| `pages/shared/Notifications.jsx` | `/api/notifications` (2) |
| `pages/shared/OrderDetail.jsx` | `/api/payments` (2), `/api/purchase-orders` (11) |
| `pages/shared/PasswordReset.jsx` | `/api/auth` (2) |
| `pages/shared/Plans.jsx` | `/api/planos` (1) |
| `pages/shared/PrintableDocument.jsx` | `/api/purchase-orders` (1) |
| `pages/shared/Profile.jsx` | `/api/users` (1) |
| `pages/shared/Register.jsx` | `/api/companies` (1) |
| `pages/shared/Security.jsx` | `/api/auth` (8), `/api/users` (2) |
| `pages/shared/SuporteChat.jsx` | `/api/support` (15) |
| `pages/shared/SuporteFeedback.jsx` | `/api/feedback` (3) |
| `pages/shared/SupplierDevelopment.jsx` | `/api/supplier-development` (2) |

## C.7 Páginas por persona e rotas protegidas (`react-router`)

Rotas em `frontend/src/App.jsx`. Estrutura: `RequireAuth` (`:179`) → `Shell` (`RealtimeProvider` + `CartProvider` + `AppLayout`, `:135-143,185`) → um `RequireRole` por persona. Todas as páginas, excepto o *login*, são carregadas com `lazy()` (code-splitting). Antes de tudo, o **modo de lançamento** (`useLancamento`, lê `launch.json`) pode mostrar só a página "Em breve" por cima de todas as rotas (`App.jsx:152-157`).

**Públicas** (`:163-177`): `/login`, `/cadastro`, `/convite/:token`, `/convite-admin/:token`, `/recuperar`, `/recuperar/:token`, `/supplier-development`, `/parcerias`, `/planos`, `/termos`, `/privacidade`, `/noticias`, `/carreiras`, `/faq`, `/recursos`; mais `/em-breve`, `/` (Landing: home corporativa sem sessão, redirecciona para o dashboard do papel com sessão) e `*` (`:307-309`).

**Autenticadas, sem restrição de papel** (`:181-193`): documentos imprimíveis `/documento/po/:id`, `/documento/fatura/:id`, `/documento/taxas/:companyId` (fora do `Shell`); e dentro do `Shell`: `/notificacoes`, `/perfil`, `/ajuda`, `/suporte/chat`, `/suporte/feedback`, `/mensagens/chat-comercial`, `/seguranca`.

| Persona (`RequireRole`) | Rota base | Páginas (ficheiros em `frontend/src/pages/<pasta>/`) | Linhas em `App.jsx` |
|---|---|---|---|
| `COMPRADOR` | `/comprador` | `comprador/`: Home, Explore (`/explorar`), Catalog (`/catalogo`), ItemDetail (`/catalogo/:id`), Services (`/servicos`), ServiceDetail (`/servicos/:slug`), SupplierCompare (`/comparar`), Cart (`/cesta`), Checkout, Quotes (`/cotacoes`), Orders (`/ordens`), `shared/OrderDetail` (`/ordens/:id`), Payments, Deliveries (`/entregas`), Receptions (`/recepcao`), Suppliers (`/fornecedores`), CategoryManagement (`/economia-de-escala`), PoRobot (`/po-robot`), Activities (`/atividades`), Profile (`/perfil`) | 196-217 |
| `COMPANY_ADMIN` | `/empresa` | `companyAdmin/`: Home, Approvals (`/aprovacoes`, `/aprovacoes/:id` → OrderDetail), Users (`/utilizadores`), Organization, CompanyDocuments (`/documentos`), Permissions (`/permissoes`), CompanyProfile (`/perfil`), Contracts (`/contratos`), Reports (`/relatorios`), ConteudoLocal (`/conteudo-local`), Activities, Settings (`/configuracoes`), Assinatura (`/assinatura`) | 220-238 |
| `FORNECEDOR` | `/fornecedor` | `fornecedor/`: Home, CatalogManage (`/catalogo`, `/catalogo/servicos`), OrdersReceived (`/ordens`), OrderDetail (`/ordens/:id`), Invoices (`/faturas`), Payments (`/pagamentos`), Inventory (`/inventario/stock`, `/inventario/armazens`), StockMovements (`/inventario/entradas`, `/saidas`), Reports (`/relatorios/estatisticas`), ProductRanking (`/relatorios/mais-vendidos`, `/mais-vistos`), Documents (`/documentacao/certificacoes`, `/catalogos`, `/fichas`), CatalogInsights (`/catalogo/categorias`, `/marcas`, `/promocoes`), Kits (`/catalogo/kits`), CatalogImport (`/catalogo/importar`), OrderHistory (`/pedidos/historico`), SupplierQuotes (`/pedidos/solicitacoes`, `/pedidos/cotacoes`), Wallet (`/financeiro/carteira`); `/fornecedor/*` → ModulePlaceholder (módulos do menu ERP ainda "em preparação") | 241-270 |
| `FINANCEIRO` | `/financeiro` | `financeiro/`: Home, PendingInvoices (`/faturas`), PaymentHistory (`/historico`); `fornecedor/Payments` (`/recebidos`, para Financeiro de empresa fornecedora); `shared/OrderDetail` (`/ordens/:id`) | 273-280 |
| `ADMIN_SISTEMA` | `/sistema` | `adminSistema/`: Home, DueDiligence, PolicyManagement (`/apolices`), ErpIntegrations (`/integracoes-erp`), Contracts, Companies (`/empresas`), Permissions, Administradores, SystemActivities (`/atividades`), PlatformFees (`/taxas`), AuditTrail (`/auditoria`), Plans (`/planos`), SupplierDev, Prontidao, Cobrancas, SecurityAlerts (`/alertas-seguranca`), Avaliacoes, DescontosEconomiaEscala (`/economia-de-escala`), SolicitarSerie | 283-303 |

Páginas de pastas partilhadas: `pages/shared/` (21 ficheiros: login, registo, convites, recuperação de senha, planos, legal, notificações, perfil, ajuda, chats, detalhe de ordem, segurança, documentos imprimíveis, extracto de taxas, módulo-placeholder) e `pages/corporate/` (11 ficheiros: home corporativa, notícias, carreiras, FAQ, recursos, "em breve").

## C.8 Gate de papéis no cliente (e a autorização real)

- **Mecanismo:** `RequireAuth` espera `/api/auth/me` e só renderiza se houver `user` em memória; senão redirecciona para `/login` (`auth/RequireAuth.jsx:126-150`). `RequireRole` compara `user.role` com a lista permitida e, se falhar, redirecciona para o início do papel (`ROLE_HOME`, `domain.js:39-45`) (`RequireAuth.jsx:159-164`). O menu lateral vem de `data/sidebar.js` por papel (e variante `FINANCEIRO` + `companyType === 'FORNECEDOR'`, `components/AppLayout.jsx:104-106`).
- **Áreas do Admin do Sistema:** só filtram o **menu** (`filtrarPorAreas`, `AppLayout.jsx:111`; `data/sidebar.js:116-176`); as rotas `/sistema/*` só exigem o papel `ADMIN_SISTEMA` (`App.jsx:283`), por isso um assessor com áreas restritas consegue abrir por URL uma página fora das suas áreas; quem barra é o servidor (`requirePermission` → 403) e algumas páginas mostram "sem acesso" (`adminSistema/Home.jsx:21`).
- **Tipo de empresa e plano:** `RequireRole` não verifica `companyType` nem plano; o ecrã adapta-se (menu, `PLANO_INSUFICIENTE` em `ErrorBanner`) mas a rota abre.
- **Aviso:** nada disto é segurança. O cliente pode ser alterado pelo utilizador; **a autorização real é do servidor** (`authenticate` + `requireRole`/`requirePermission` + regras de posse por empresa nos serviços, Node e Java). O gate do cliente existe para experiência de utilização (não mostrar ecrãs inúteis, mensagens úteis).

## C.9 Chamadas do frontend a endpoints que não existem no inventário Node

Resultado: **nenhuma.** Todas as 282 chamadas detectadas (método + caminho normalizado, com `${…}` e `:param` → `{}`) correspondem a uma rota de `rotas.json`, incluindo as 9 de caminho indirecto. Limitações da aproximação: só se vêem caminhos escritos como literal em `src/` (ou compostos por `${…}` simples); um caminho totalmente calculado em runtime não seria detectado (a pesquisa de `api.<método>(` com primeiro argumento que não seja literal `/api/…` encontrou apenas os casos indirectos já incluídos); os testes (`*.test.*`) foram excluídos.

## C.10 Endpoints do backend que o frontend nunca chama (aproximação por grep)

**É uma aproximação**: baseia-se na ausência de literal `/api/…` em `src/` (excluindo testes), não em análise de fluxo; links `<a href>`, imagens servidas por URL devolvido pela API e chamadas feitas por outros clientes não aparecem. Das 246 rotas Node, **40** não têm nenhuma chamada correspondente:

- **Chamados por máquina ou fora do SPA (esperado):** `GET /health`, `GET /ready`, `POST /api/integration/callback`, `POST /api/webhooks/pagamento/{canal}`, `GET|PATCH /api/v1/catalogo[/{sku}]` (3, API externa por chave), `GET /api/retencao` (referida só em texto legal), `GET /api/uploads/{filename}` (consumido indirectamente: os URLs de imagem/documento vêm nas respostas da API), `GET /api/supplier-development/requests/{reference}/track` (consulta pública, sem UI encontrada).
- **Sem interface encontrada** (funcionalidade só via API, ou UI em falta):
  - Faturação/AGT: `GET /api/faturacao/integridade`, `/saft`, `/saft/resumo`, `/metricas`, `/agt-estado/{id}`, `/agt-payload/{id}/{tipo}` (só se usam `agt-series-fe` e `agt-serie-payload`).
  - Conciliação bancária: `POST /api/conciliacao/extrato`, `GET /por-resolver`, `POST /{id}/conciliar`, `GET /canais`.
  - Chaves de API de catálogo: `GET|POST /api/catalog/api-keys`, `DELETE /api/catalog/api-keys/{id}`.
  - Empresa: `POST /api/companies/users`, `PUT /api/companies/{id}/budget-limit`, `/data-adesao`, `/serie-fiscal`, `GET /api/companies/{id}/subscription`.
  - Contratos: `GET /api/contracts/{id}`, `POST /api/contracts/{id}/consolidate-billing`.
  - Outros: `GET /api/buyer/profile`, `GET /api/category-management/produtos/{id}/media-mensal`, `GET /api/conversations/{id}` (a UI usa `/api/conversations/admin/conversations/{id}`), `GET /api/marketplace/favorites`, `GET|DELETE /api/marketplace/saved-searches[/{id}]` (só se usa o `POST`), `GET /api/payments/history`, `GET /api/payments/invoices/{id}/notas-credito` (só o `POST`), `POST /api/policies/supplier-to-kixima`, `GET /api/users/me`.

## C.11 Achados (C)

| Id | Severidade | Tipo | Descrição | Evidência | Confirmado? |
|---|---|---|---|---|---|
| C1 | Alta | incompleto | Mesmo problema do B1 visto do lado cliente: o frontend só fala Socket.IO e não existe cliente STOMP; contra o backend Java o tempo real não liga. | `frontend/src/realtime/RealtimeContext.jsx:12,40`; `frontend/package.json`; `backend-java/Dockerfile:24` | Sim (leitura e grep) |
| C2 | Média | falha | Sem tratamento central de 401 a meio da sessão (token expirado ou revogado por `tokenVersion`, ex.: após mudança de senha noutro dispositivo): `request()` apenas lança o erro; o `user` em memória mantém-se e a pessoa continua num ecrã onde todas as chamadas falham, até recarregar. O 401 só é tratado no arranque (`/api/auth/me`). | `api/client.js:145-155`; `auth/AuthContext.jsx:50`; `auth/RequireAuth.jsx:126-150`; grep de `status === 401` (um único resultado) | Sim, por leitura |
| C3 | Baixa | falha | O `fetch` directo que guarda o idioma no servidor contorna `api/client.js`: sem `credentials` explícito, sem `apiBaseUrl()` (na app Capacitor o pedido vai à origem falsa do WebView e falha em silêncio) e lê um `kixima_token` de `localStorage` que nada escreve (a sessão já não usa esse armazenamento). Na Web funciona por ser mesma origem. | `frontend/src/i18n/index.jsx:116-123`; `api/client.js:10-20` | Sim, por leitura (efeito na app nativa não executado) |
| C4 | Baixa | incompleto | `mfaRestrita` (sessão limitada por 2FA obrigatória fora do prazo) não é consumida: o frontend só mostra o banner `mfaPendente` e, quando a sessão fica restrita, cada página mostra o 403 isolado em vez de levar a pessoa à página de Segurança. | `components/AppLayout.jsx:161`; `auth/AuthContext.jsx:81,90`; grep de `mfaRestrita` | Sim (grep); o conteúdo de `/api/auth/me` não foi relido |
| C5 | Média | incompleto | `frontend/nginx.conf` (imagem do frontend e serviço `frontend` do `docker-compose.yml`) só reencaminha `/api/` e `/health`; não há `/socket.io/` nem cabeçalhos de *upgrade* WebSocket, pelo que nessa topologia o tempo real cai no fallback de SPA. Em produção (serviço único) não se aplica. | `frontend/nginx.conf:10-25`; `docker-compose.yml:48-52` | Sim, por leitura; runtime não verificado |
| C6 | Baixa | dívida | O alvo do proxy de desenvolvimento está fixo em `http://localhost:4000` (Node) e só cobre `/api` e `/socket.io`: correr o frontend em dev contra o Java (porta 4001 por omissão, STOMP em `/ws`) exige editar `vite.config.js`. | `frontend/vite.config.js:32-44`; `backend-java/src/main/resources/application.yml:78` | Sim |
| C7 | Baixa | dívida | O gate de papéis não considera áreas do Admin do Sistema, tipo de empresa nem plano: só esconde menus. Um assessor restrito abre por URL páginas fora das suas áreas (o servidor devolve 403). Não é vulnerabilidade (a autorização é do servidor), mas a experiência é de ecrã com erro. | `App.jsx:283-303`; `components/AppLayout.jsx:111`; `data/sidebar.js:116-176` | Sim |
| C8 | Baixa | incompleto | 40 endpoints Node sem chamada no SPA, 30 deles funcionalidades de negócio sem interface (AGT/SAF-T, conciliação, chaves de API, ajustes de empresa, consolidação de contratos…). | secção C.10 | Aproximação por grep |
| C9 | Baixa | dívida | O cliente envia `Content-Type: application/json` também em `GET`/`DELETE` sem corpo; em pedidos cross-origin (app nativa) isso força *preflight* desnecessário. | `api/client.js:137` | Sim, por leitura |

## C.12 Dúvidas (C)

- Se há outro componente a ouvir `conversation:risk-alert` (o backend emite-o; a pesquisa `socket.on` não o encontrou).
- O conteúdo exacto de `/api/auth/me` (se devolve `mfaRestrita`) para avaliar C4.
- Comportamento real da app nativa com o cookie `SameSite=Lax` (C3); depende do WebView e do domínio configurado em `VITE_API_BASE_URL`.
