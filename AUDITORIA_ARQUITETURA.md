# Auditoria de Arquitetura e Bugs Ocultos — KIXIMA

Data: 2026-09-13
Âmbito: `backend/` (Node/Express/Prisma/PostgreSQL), `frontend/` (React/Vite), `kixima-integration-service/` (NestJS/TypeScript).

Este documento tem duas partes: **(A)** o levantamento da arquitetura tal como está hoje, e **(B)** os bugs ocultos encontrados, ordenados por severidade, cada um com ficheiro:linha, o cenário concreto que o dispara, e uma recomendação.

---

## Resumo executivo — achados por severidade

| # | Severidade | Achado | Onde |
|---|---|---|---|
| 1 | **Crítico** | `poRoboService.executarCiclo()` sem lock — duas corridas concorrentes duplicam POs geradas pelo robot | `backend/src/services/poRoboService.js:122-145` |
| 2 | **Alto** | `aplicarDecisaoErp` — TOCTOU sem guarda de estado no UPDATE; uma decisão pode sobrepor silenciosamente outra já aplicada | `backend/src/services/poService.js:303-346` |
| 3 | **Alto** | Adapter SAP Ariba envia `timestamp` cXML fixo em `1970-01-01` — quebra a integração Ariba em produção | `kixima-integration-service/src/adapters/ariba.adapter.ts:41` |
| 4 | **Alto** | Perda silenciosa de mensagem no consumidor RabbitMQ — chave de idempotência gravada antes do evento persistir; um crash a meio marca eventos reais como "duplicados" e o `ack` descarta-os para sempre | `kixima-integration-service/src/sync/sync.service.ts:31-59` |
| 5 | Médio | `aplicarPagamentoErp` — mesmo padrão TOCTOU, mas protegido acidentalmente por `Payment.invoiceId`/`PlatformFee.invoiceId` únicos; produz erro Prisma cru em vez de idempotência limpa | `backend/src/services/poService.js:352-427` |
| 6 | Médio | "Uma cobrança em aberto por empresa" não é garantida pela BD (check-then-create) — duplo clique cria duas cobranças abertas | `backend/src/services/addonService.js:91-140`, `assinaturaService.js:272-337` |
| 7 | Médio | 19 chaves i18n (EN) + 18 (FR) com traduções **diferentes** para a mesma chave PT, dependendo do ficheiro — duas mudam o sentido, não só a formulação | `frontend/src/i18n/content*.js` |
| 8 | Médio | Webhook de decisão do ERP (microserviço) sem idempotência nem correlação com o pedido original — decisão pode ser reencaminhada ao KIXIMA repetidamente | `kixima-integration-service/src/webhooks/webhook.controller.ts:62-68` |
| 9 | Médio | `WEBHOOK_SIGNING_SECRET` único e global para os 4 ERPs/todos os tenants — uma fuga falsifica webhooks de qualquer ERP | `kixima-integration-service/src/config/configuration.ts:31,62` |
| 10 | Baixo | Job de dead-letter retorna sucesso ao BullMQ — painel de monitorização subestima falhas reais | `kixima-integration-service/src/sync/sync.processor.ts:166` |
| 11 | Informativo | `requireSameCompany` definido mas nunca usado — código morto, falsa sensação de guarda central de isolamento por empresa | `backend/src/middleware/rbac.js:29-39` |

**O que está bem implementado** (verificado, não presumido): RBAC/IDOR em `poRoboRoutes`, `addonRoutes`, `catalogRoutes`, `faturacaoRoutes`, `webhookPagamentoRoutes`; assinatura JWS/RS256 (`agtSigningService`/`agtSandboxClient` — base64url consistente, nunca assina sem configuração, nunca diverge entre o assinado e o submetido); verificação HMAC do callback ERP com `timingSafeEqual`; lógica de `auth.js`/`rbac.js`; numeração de faturas/referências (`nextReference` via `INSERT ON CONFLICT`, `faturacaoService.atribuir` via `SELECT FOR UPDATE` — sem race possível); mecanismo de retry/backoff/dead-letter do microserviço (limites e backoff corretos); verificação de assinatura do webhook de entrada do microserviço.

---

## A. Levantamento da Arquitetura

### A.1 Backend — Modelo de dados

Fonte: `backend/prisma/schema.prisma`.

- **Empresas/utilizadores**: `Company` (tipo CLIENTE/FORNECEDOR, estado, dimensão MPME, plano BASE/CORE/PRO), `User` (papel, `adminAreas[]` para delegação de Admin do Sistema, MFA, bloqueio progressivo).
- **Catálogo**: `Product` + imagens/documentos/stock/kits/favoritos/reviews; `QuoteRequest`/`QuoteItem` (RFQ).
- **Compras (núcleo do sistema)**: `PurchaseOrder` (12 estados, desde `AGUARDANDO_APROVACAO` até `CONCLUIDA`; campos ERP-DOA `erpManaged`/`erpExternalId`; origem `createdBySource` HUMANO/ROBOT) + `PurchaseOrderItem`; `ErpSyncLog`; `PoRoboRegra` (add-on robot).
- **Faturação/AGT**: `Invoice` + `InvoiceLine` (cadeia de hash/série certificada), `CreditNote`, `Payment` (1:1 com Invoice), `LinhaExtrato` (conciliação bancária), `SerieFaturacao`, `PlatformFee`.
- **Billing/add-ons**: `PlanoCobranca`, `CompanyAddon` + `AddonCobranca`.
- **Integração ERP**: `CompanyErpConfig` (credenciais cifradas AES-256-GCM) + `CompanyErpConfigAudit`.
- **Contratos**: `Contract` (call-offs, periodicidade de faturação).
- **Notificações**, **Chat/Trust&Safety** (`Conversation`, `RiskAlert`, `SupportTicket`), **Auditoria** (`AuditLog`, append-only), **Feedback**, **DiscountThreshold**, apólices.

### A.2 Backend — Camada de serviços (`backend/src/services/*.js`)

Agrupados por domínio: **Compras/PO** (`poService`, `poRoboService`+`categoryAnalyticsService`, `contractService`, `quoteService`); **Faturação/AGT** (`faturacaoService`, `agtPayloadService`, `agtSigningService`, `agtSandboxClient`, `agtSeriesService`, `creditNoteService`, `saftService`, `taxService`, `conciliacaoService`, `platformFeeService`); **Billing** (`assinaturaService`, `addonService`, `canaisPagamentoService`, `planService`); **ERP** (`erpConfigService`, `erpCrypto`, `eventBus`); **Catálogo** (`catalogService`, `catalogImportService`, `kitService`, `marketplaceService`); **Chat/Trust&Safety** (`conversationService`, `riskAnalysisService`, `riskAlertService`, `supportChatService`, `realtimeService`); **Notificações** (`notificationService`, `mfaEmailService`, `alertaOperacionalService`); **Outros** (`authService`, `auditService`, `companyService`, `policyService`, `retencaoService`, `backupVerificacaoService`, `prontidaoService` — o "painel de verdade" do que está mesmo configurado em produção).

### A.3 Backend — Jobs agendados (`backend/src/jobs/`, registados em `server.js`)

| Job | Agendamento | Função |
|---|---|---|
| `policyExpiryJob` | cron diário 07:00 UTC | Avisos de expiração de apólice KIXIMA→Cliente |
| `subscriptionExpiryJob` | cron diário 07:00 UTC | Avisos escalonados de expiração de subscrição |
| `poRoboJob` | cron diário 06:00 UTC | `poRoboService.executarCiclo()` — **ver achado #1** |
| `backupJob` | `BACKUP_CRON` opt-in + polling de recuperação | `pg_dump` + upload S3, single-flight |
| `mfaLembreteJob` | `setInterval` 1h | Lembretes de ativação de 2FA |
| `retencaoJob` | `setTimeout`+`setInterval` 24h | Limpeza de retenção de dados |

### A.4 Backend — RBAC

`PersonaRole`: COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA. `requireRole`/`requirePermission`/`requireSuperAdmin` em `middleware/rbac.js`; `adminAreas` (CADASTRO, FINANCEIRO, FATURACAO, APOLICES, SUPORTE, OPERACOES) permite delegar Admin do Sistema em "assessores" restritos — array vazio = Super Admin.

### A.5 Backend — Integrações externas

| Serviço | Estado |
|---|---|
| Multicaixa Express, PayPay, Bancos (BAI/BFA/Standard Bank) | Placeholders "recusa-se a fingir" — por ligar, sem credenciais reais |
| AGT (assinatura JWS + Sandbox REST) | Implementado contra a spec/documentação oficial, por ligar |
| ERP (`erpConfigService` + `kixima-integration-service` via RabbitMQ) | Funcional; execução real delegada ao microserviço |
| Claude API (`aiRecommendationService`) | Real quando configurado; nunca inventa números, só texto sobre agregados já calculados |

### A.6 Frontend — Arquitetura

- **Roteamento** (`App.jsx`): 92 páginas lazy-loaded, árvore por persona (`comprador/*`, `empresa/*`, `fornecedor/*`, `financeiro/*`, `sistema/*`), `RequireAuth`/`RequireRole` como guardas client-side (a autorização real é sempre no backend).
- **Cliente API** (`api/client.js`): sessão via cookie `httpOnly` (sem JWT em localStorage); exceção só para o wrapper nativo Capacitor (`Authorization: Bearer` em memória); formato de erro padronizado `{code, message, status}`.
- **i18n** (`i18n/index.jsx` + 15 ficheiros `content*.js`): dicionário final montado por spread — ordem de import decide quem vence em caso de chave duplicada. **Ver achado #7.**
- **Componentes partilhados** (`BuyerUI.jsx`, `Common.jsx`): tudo passa por `t()`/`tr()` — daí a i18n consistente ser crítica.
- **Realtime**: uma ligação Socket.IO por sessão (`RealtimeContext.jsx`), usada por Chat de Suporte e Chat Comercial; autorização de "join" decidida sempre pelo servidor.
- **Auth** (`AuthContext.jsx`): sem JWT persistido; `sessaoIndeterminada` como terceiro estado explícito (falha de rede ≠ sessão inválida) — evita logout falso por soluço de rede.

### A.7 `kixima-integration-service` — Arquitetura

Pipeline: `RabbitmqConsumer` → `SyncService.ingest()` (idempotência + persiste `IntegrationEvent` + enfileira BullMQ) → `SyncProcessor` (resolve adapters do tenant, chama `ErpAdapter.sync()`/`requestApproval()`, grava `ErpSyncRecord` cifrado) → `WebhookProducer.notifyKixima()` (HMAC-SHA256 de saída). Decisões assíncronas do ERP entram por `WebhookController` (verifica `x-signature` com `timingSafeEqual`, fail-closed sem segredo) e são reencaminhadas ao KIXIMA. Retry com backoff exponencial e limite de tentativas (BullMQ); erros não-retryable (4xx) e tentativas esgotadas vão para `DeadLetterService` (Postgres + DLX/DLQ AMQP). Credenciais por tenant cifradas AES-256-GCM, com fallback para config global (`tenantId = '*'`).

---

## B. Bugs ocultos — detalhe, cenário e recomendação

### #1 · CRÍTICO — Race no PO Robot duplica ordens de compra

**`backend/src/services/poRoboService.js:122-145`** (`executarCiclo`), disparado por **`backend/src/jobs/poRoboJob.js:12`** (`cron.schedule('0 6 * * *', ...)`).

Não existe `SELECT ... FOR UPDATE`, `$transaction` a envolver a seleção, nem um `UPDATE ... WHERE proximaExecucaoEm <= now() RETURNING *` atómico a "reservar" cada regra. O fluxo é: `findMany` (sem lock) → loop → `createPurchaseOrder` → só no fim `poRoboRegra.update({ proximaExecucaoEm })`.

**Cenário**: duas instâncias da app (ou uma sobreposição durante um redeploy, ou uma corrida manual disparada enquanto a das 06:00 ainda decorre) chamam `executarCiclo()` quase ao mesmo tempo. Ambas leem a mesma regra como devida antes de qualquer uma avançar `proximaExecucaoEm` — cada uma cria a sua própria PO para o mesmo produto/quantidade. Resultado: encomenda duplicada, sem qualquer erro ou aviso.

Hoje mitigado apenas porque o deploy está numa única instância (plano free do Render) — **não pelo código**. Qualquer escalonamento horizontal futuro, ou um redeploy que deixe o processo antigo vivo por segundos a mais, reintroduz a duplicação.

**Recomendação**: envolver a seleção+reserva numa única operação atómica, ex.:
```sql
UPDATE po_robo_regras SET proxima_execucao_em = <novo valor temporário/lock>
WHERE id IN (SELECT id FROM po_robo_regras WHERE ativo AND proxima_execucao_em <= now() FOR UPDATE SKIP LOCKED)
RETURNING *;
```
ou um `SELECT ... FOR UPDATE SKIP LOCKED` por regra dentro de uma transação antes de criar a PO.

---

### #2 · ALTO — `aplicarDecisaoErp` pode sobrepor silenciosamente uma decisão já aplicada

**`backend/src/services/poService.js:303-346`**.

A verificação de idempotência (`if (po.status !== 'AGUARDANDO_APROVACAO') return po;`, linha 307) acontece **fora** da transação (leitura solta na linha 304), e o `UPDATE` final (linha 320) só filtra por `id`, não por `status`.

**Cenário**: o ERP reenvia o callback (retry de rede, ou duas decisões próximas no workflow DOA) e dois pedidos concorrentes chegam a `POST /api/integration/callback` quase em simultâneo. Ambos passam a verificação antes de qualquer um comitar — o segundo `UPDATE` sobrepõe o primeiro sem erro (ex.: uma PO fica `REJEITADA` depois de já ter sido `APROVADA`). Cada passagem duplica ainda `ErpSyncLog`, `AuditLog` e notificações, sem constraint de unicidade a impedir.

Nota: `aplicarPagamentoErp` (mesmo ficheiro, linhas 352-427) tem o **mesmo padrão TOCTOU**, mas está protegido *acidentalmente* por `Payment.invoiceId @unique`/`PlatformFee.invoiceId @unique` — a segunda escrita falha por violação de unicidade em vez de duplicar dinheiro (ver achado #5 para o efeito colateral disso).

**Recomendação**: trocar o `update` por `updateMany({ where: { id: poId, status: 'AGUARDANDO_APROVACAO' }, data })` e verificar `count === 1` antes de prosseguir com auditoria/notificações — o mesmo padrão que já protege (por acidente) o caminho de pagamento, mas de forma intencional.

---

### #3 · ALTO — Adapter SAP Ariba envia timestamp fixo em 1970

**`kixima-integration-service/src/adapters/ariba.adapter.ts:41`**: `'@_timestamp': new Date(0).toISOString()` no cabeçalho cXML, em vez de `new Date().toISOString()`.

O protocolo cXML do Ariba usa `payloadID`+`timestamp` para deteção de duplicados/replay — um timestamp fixo no passado tende a ser rejeitado ou tratado como mensagem expirada por implementações reais do lado do Ariba. **Isto provavelmente quebra toda a integração com SAP Ariba em produção**, e cada tentativa de retry reenviaria o mesmo timestamp inválido, nunca recuperando sozinho.

**Recomendação**: trivial — trocar para `new Date().toISOString()`. Corrigir com prioridade antes de qualquer teste real com um tenant Ariba.

---

### #4 · ALTO — Perda silenciosa de mensagens no consumidor RabbitMQ do microserviço

**`kixima-integration-service/src/sync/sync.service.ts:31-59`**.

`ingest()` faz `idempotencyKey.create()` (linha 34) e só depois, em chamadas Prisma separadas e **não transacionadas**, `integrationEvent.create()` (linha 48) e `syncQueue.add()` (linha 67).

**Cenário**: o processo morre (crash, OOM-kill, restart) entre gravar a chave de idempotência e enfileirar o job — ou `integrationEvent.create()`/`syncQueue.add()` falha por qualquer razão (Postgres/Redis indisponível). Numa reentrega do RabbitMQ, `idempotencyKey.create()` volta a falhar com `P2002`, o código trata isso como "duplicado legítimo" (linha 38-43), o consumidor faz `ack`, e a mensagem é **perdida para sempre** — nunca chega a nenhum ERP, nunca vai para Dead Letter, e nada acusa o problema.

**Recomendação**: envolver `idempotencyKey.create()` + `integrationEvent.create()` + `syncQueue.add()` numa única transação lógica (ex.: gravar a chave de idempotência e o evento na mesma transação Prisma; só depois enfileirar o job BullMQ com retry se a transação tiver sucesso — ou usar um outbox pattern).

---

### #5 · MÉDIO — `aplicarPagamentoErp` produz erro Prisma cru em vez de idempotência limpa

**`backend/src/services/poService.js:352-427`** + **`backend/src/routes/integrationRoutes.js:67-75`**.

Mesmo padrão TOCTOU do achado #2, mas salvo pela constraint `Payment.invoiceId @unique`. Num duplo callback concorrente, a segunda transação rebenta com violação de unicidade (P2002); `integrationRoutes.js` apanha isso como "erro de negócio" e grava a mensagem crua do Prisma no `ErpSyncLog`, respondendo 200 com `error: ...`. Sem risco financeiro, mas confuso operacionalmente — parece uma falha do sistema quando é apenas uma repetição legítima.

**Recomendação**: tratar `P2002` sobre `Payment.invoiceId` explicitamente como sucesso idempotente (devolver o pagamento já existente), não como erro.

---

### #6 · MÉDIO — Duas cobranças abertas concorrentes por duplo clique

**`backend/src/services/addonService.js:91-140`**, **`backend/src/services/assinaturaService.js:272-337`**.

`pedir()` faz `findFirst` sobre cobranças abertas e só depois `create` — check-then-create em JS. Não existe nenhum índice único (nem parcial) que impeça duas cobranças `PENDENTE`/`COMPROVATIVO_ENVIADO` para a mesma empresa em simultâneo (`PlanoCobranca`/`AddonCobranca` só têm `referencia @unique`).

**Cenário**: duplo clique em "Pedir plano PRO" (ou duas abas) gera dois `POST /pedir` quase simultâneos; ambos passam o `findFirst` antes de qualquer um criar a linha. Resultado: duas cobranças abertas para a mesma empresa, risco de confirmação duplicada por um humano da KIXIMA.

**Recomendação**: índice único parcial em Postgres, ex. `CREATE UNIQUE INDEX ... ON plano_cobrancas (company_id) WHERE status IN ('PENDENTE','COMPROVATIVO_ENVIADO')` (e equivalente para `addon_cobrancas` sobre `(company_id, addon_key)`).

---

### #7 · MÉDIO — Traduções i18n conflituantes entre ficheiros `content*.js`

15 ficheiros `content.js`..`content15.js`, montados por spread em `frontend/src/i18n/index.jsx:86` — a ordem de import decide qual tradução vence quando a mesma chave PT aparece em mais de um ficheiro com valores diferentes (chaves duplicadas com o **mesmo** valor são inofensivas e não entram nesta lista).

**Casos que mudam o sentido, não só a formulação** (os mais graves):
- `"Credenciamento"` — `content3.js`: *Accreditation* vs. base `EN` (`index.jsx`): *Onboarding*.
- `"Pedidos"` — `content4.js`: *Requests* vs. base `EN`: *Orders* (pode confundir Pedidos de Cotação com Ordens de Compra).

Mais 17 casos EN e 18 FR de divergência de formulação (ex. "Catálogo"/"Catalogue" vs "Catalog", "Remover"/"Retirer" vs "Supprimer") — listados na íntegra no relatório do agente de exploração (secção i18n, disponível no histórico desta sessão). Muitos destes são texto morto (a entrada em `content3.js`/`content4.js` nunca aparece, porque o dicionário base `EN`/`FR` hardcoded em `index.jsx` é espalhado por último e sempre vence) — mas indicam traduções mantidas em duplicado sem nunca serem reconciliadas, o que é uma armadilha para quem editar um dos dois sem saber do outro.

**Recomendação**: correr um script de auditoria de chaves duplicadas (fácil de escrever — comparar todos os `content*.js` chave a chave) como parte do `npm run i18n:missing`, e decidir uma fonte única por chave, especialmente para "Credenciamento"/"Pedidos".

---

### #8 · MÉDIO — Webhook de decisão do ERP sem idempotência nem correlação

**`kixima-integration-service/src/webhooks/webhook.controller.ts:62-68`**.

Ao contrário do consumidor RabbitMQ (que tem `IdempotencyKey`), `WebhookController.receive()` chama `notifyKixima(null, type, data)` sem qualquer deduplicação por `poId`/tipo, e sem atualizar o `ErpSyncRecord` original do pedido de aprovação com o desfecho real.

**Cenário**: o ERP reentrega o mesmo webhook de decisão (comportamento comum em sistemas de webhook) — a mesma decisão é reencaminhada ao KIXIMA repetidamente. O KIXIMA está protegido pela idempotência por-estado do achado #2 (para o caso feliz), mas a base de dados do microserviço nunca fica com o histórico de qual foi o desfecho real da aprovação — só sabe que "foi submetida".

**Recomendação**: gravar o desfecho no `ErpSyncRecord` original (via `integrationEventId` correlacionado por `poId`) e aplicar a mesma tabela `IdempotencyKey` também aos webhooks de entrada.

---

### #9 · MÉDIO — Segredo de webhook único e global para os 4 ERPs

**`kixima-integration-service/src/config/configuration.ts:31,62`**: `WEBHOOK_SIGNING_SECRET` é um único valor partilhado por SAP, Oracle, Ariba e Primavera, para todos os tenants.

Uma única fuga permite forjar webhooks "vindos" de qualquer um dos 4 ERPs, para qualquer tenant — a verificação em si está bem implementada (`timingSafeEqual`, fail-closed), mas o alcance do segredo é maior do que precisava de ser.

**Recomendação**: segredo por-tenant (ou pelo menos por-ERP), guardado como as outras credenciais (`ErpCredential`, AES-256-GCM).

---

### #10 · BAIXO — Painel de monitorização subestima falhas reais

**`kixima-integration-service/src/sync/sync.processor.ts:166`**: quando um job vai para Dead Letter, `process()` retorna normalmente em vez de lançar — o BullMQ regista isso como sucesso, não falha. `monitoring.controller.ts:39/56` usa `getFailedCount()` para o card "Falhados", que nunca conta estes casos.

**Recomendação**: lançar a exceção original depois de `moveToDeadLetter` completar, para o BullMQ contabilizar corretamente.

---

### #11 · INFORMATIVO — Código morto em `rbac.js`

**`backend/src/middleware/rbac.js:29-39`**: `requireSameCompany` está definido mas não é usado em rota nenhuma (cada rota reimplementa a verificação manualmente, e todas verificadas estão corretas). Não é uma vulnerabilidade, mas pode induzir a falsa impressão de que existe um guard central de isolamento por empresa. Remover ou adotar consistentemente.

---

## Metodologia

Levantamento feito por 5 agentes de exploração/revisão em paralelo, cada um focado num recorte diferente (dados+serviços+jobs+RBAC do backend; concorrência financeira; RBAC/IDOR+criptografia AGT; arquitetura do frontend+i18n; microserviço de integração ERP), com instrução explícita de só reportar achados reais e verificados no código (com ficheiro:linha como prova), nunca problemas hipotéticos ou de estilo. Nenhuma alteração de código foi feita como parte desta auditoria — é só o levantamento e a análise, conforme pedido.
