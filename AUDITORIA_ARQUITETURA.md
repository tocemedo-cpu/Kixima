# Auditoria de Arquitetura e Bugs Ocultos — KIXIMA (v2)

Data: 2026-09-13 (segunda ronda — ver histórico de correções abaixo)
Âmbito: `backend/` (Node/Express/Prisma/PostgreSQL), `frontend/` (React/Vite), `kixima-integration-service/` (NestJS/TypeScript).

Este documento substitui a versão anterior (commit `d48b2be`). Mantém o que ainda está por corrigir dessa ronda, regista o que já foi corrigido entretanto, e acrescenta os achados novos desta segunda ronda — focada deliberadamente em código que a primeira ronda não tinha coberto em profundidade (contratos-quadro/call-offs, add-ons, conciliação bancária, adapters SAP/Primavera/Oracle, o novo cliente REST da Sandbox AGT).

---

## Resumo executivo — o que mudou desde a v1

| # da v1 | Achado | Estado |
|---|---|---|
| 1 · Crítico | Race no PO Robot duplicava POs | ✅ **Corrigido** (`bc9488d`) |
| 3 · Alto | Timestamp fixo em 1970 no adapter Ariba | ✅ **Corrigido** (`bc9488d`) |
| 5 · Médio | `aplicarPagamentoErp` sem idempotência limpa | ✅ **Corrigido** (`d6ac13a`) |
| 6 · Médio | Duas cobranças abertas por duplo clique | ✅ **Corrigido** (`d6ac13a`) |
| 7 · Médio | Traduções i18n conflituantes | ✅ **Corrigido** (`d6ac13a`) |
| 8 · Médio | Webhook do ERP sem idempotência de relay | ✅ **Corrigido** (`d6ac13a`) |
| 9 · Médio | Segredo de webhook único e global | ✅ **Corrigido** (`d6ac13a`) — mas ver **#N5** abaixo, uma lacuna que esta correção deixou por resolver |
| 2 · Alto | `aplicarDecisaoErp` TOCTOU | ⏳ **Ainda aberto** — ver detalhe original, não repetido aqui |
| 4 · Alto | Perda silenciosa de mensagens no consumidor RabbitMQ | ⏳ **Ainda aberto** — ver detalhe original, não repetido aqui |
| 10 · Baixo | Dead-letter conta como sucesso no BullMQ | ⏳ **Ainda aberto** |
| 11 · Informativo | `requireSameCompany` morto em `rbac.js` | ⏳ **Ainda aberto** (agora mais relevante — ver **#N2**/**#N3**, que são exatamente o buraco que este guard não usado deixou) |

Os quatro itens "ainda aberto" **mantêm a descrição completa da v1** (não repetida aqui para não duplicar); ficam disponíveis no histórico do git em `d48b2be:AUDITORIA_ARQUITETURA.md`.

## Resumo executivo — achados novos desta ronda

| # | Severidade | Achado | Onde |
|---|---|---|---|
| N1 | **Crítico** | `consolidateContractBilling` gera fatura certificada, depois rebenta com `ReferenceError` — e nada impede re-faturar as mesmas call-offs num pedido repetido | ✅ **Corrigido** (`7e4cec9`) |
| N2 | **Alto** | `POST /api/contracts` sem verificar que o `COMPANY_ADMIN` pertence a uma das duas empresas — cria contratos entre empresas alheias | ✅ **Corrigido** (`7e4cec9`) |
| N3 | **Alto** | `POST /api/contracts/:id/consolidate-billing` sem verificar posse do contrato — qualquer empresa força faturação de qualquer contrato | ✅ **Corrigido** (`7e4cec9`) |
| N4 | **Alto** | Add-on PO Robot nunca expira automaticamente — paga-se um mês, fica ativo para sempre | ✅ **Corrigido** (`7e4cec9`) |
| N5 | **Alto** | Segredo de webhook por-tenant (correção #9) não liga o tenant autenticado ao `poId` afetado — decisão/pagamento pode ser aplicado à PO de outra empresa | ✅ **Corrigido** (`7e4cec9`) |
| N6 | **Alto** | Retry de sincronização multi-ERP reenvia a adapters que já tinham tido sucesso | ✅ **Corrigido** (`7e4cec9`) |
| N7 | **Alto** | Adapter SAP com `CompanyCode`/`PurchasingOrganization` fixos em `'1000'` para todos os tenants | ✅ **Corrigido** (`7e4cec9`) |
| N8 | Médio | Conciliação bancária: TOCTOU sem tratamento de `P2002`, aborta o resto do lote | `backend/src/services/conciliacaoService.js:154-229` |
| N9 | Médio | Sem validação nem decremento de stock ligado ao ciclo de compra (pode ser intencional — ver nota) | `backend/src/services/poService.js` (ausência confirmada) |
| N10 | Baixo/Informativo | `agtSandboxClient.js` implementado e testado, mas nunca invocado por nenhuma rota/serviço | `backend/src/services/agtSandboxClient.js` |

**O que continua bem implementado** (reverificado nesta ronda): isolamento por empresa em `conversationService`/`riskAnalysisService`/`riskAlertService`/`supportChatService`; `feedbackService.js`; `discountThresholdService.js`+`categoryAnalyticsService.js`; `retencaoService.js`/`backupVerificacaoService.js`; RBAC de `poRoboRoutes.js`/`addonRoutes.js` (verificação de `companyId` presente); adapters Primavera/Oracle (sem valores fixos indevidos); `crypto.service.ts` do microserviço (AES-256-GCM com IV aleatório de 12 bytes, `authTag` sempre verificado); `credentials.controller.ts` (API server-to-server, sem caminho de IDOR tenant-a-tenant a partir do frontend); frontend recém-adicionado (`PoRobot.jsx`, `CategoryManagement.jsx`, `DescontosEconomiaEscala.jsx`, `ErpIntegrations.jsx`) — botões de mutação sempre com `disabled` durante o pedido, sem `dangerouslySetInnerHTML`, sem dados sensíveis em `localStorage`, guardas `RequireAuth`/`RequireRole` aplicadas a todas as rotas novas.

---

## B. Achados novos — detalhe, cenário e recomendação

### N1 · CRÍTICO — Faturação consolidada de contrato: crash garantido + reemissão da mesma fatura

**`backend/src/services/contractService.js:130-219`**, rota `POST /api/contracts/:id/consolidate-billing`.

Dois problemas, um a alimentar o outro:

1. **Crash garantido, sempre.** Na notificação após a transação (linha ~215), a mensagem usa a variável `amount`, que não existe nesse escopo — só existe `invoice.amount`. `ReferenceError: amount is not defined` acontece **depois** de a fatura já ter sido criada e certificada (AGT) dentro da transação, mas antes de a função devolver. Ou seja: a operação de negócio já se efetivou no lado da base de dados, mas quem chamou recebe um 500.
2. **Nada impede reprocessar as mesmas call-offs.** A query que seleciona call-offs pendentes filtra por `invoice: null` (relação inversa de `Invoice.purchaseOrderId`). Mas esse campo é **estrutural e deliberadamente `null` para faturas consolidadas** (comentário no schema: "null se fatura consolidada de call-offs" — `prisma/schema.prisma:1089`); o vínculo real é só `Invoice.consolidatedPoIds` (array na fatura), que a query de pendências nunca consulta. Isto significa que a mesma PO consolidada **continua a aparecer como "pendente de faturação" para sempre**, em qualquer chamada seguinte à mesma função.

**Cenário concreto**: o Financeiro clica em "Consolidar Faturação" — a fatura é criada e certificada com sucesso, mas o ecrã mostra um erro 500 (por causa do `ReferenceError`). Sem saber que já funcionou, o utilizador tenta novamente (ou o frontend tem lógica de retry). A segunda chamada volta a encontrar as MESMAS call-offs como "pendentes" (porque `invoice: null` continua verdadeiro) e emite uma **segunda fatura certificada AGT a cobrar exatamente os mesmos call-offs outra vez** — duplicação de faturação fiscal real, não um bug cosmético.

**Recomendação**:
- Corrigir `amount` → `invoice.amount` (trivial, mas crítico — sem isto a função nunca teve sucesso "silencioso").
- Impedir reprocessamento: antes de selecionar `pendingCallOffs`, excluir POs cujo id já apareça em `consolidatedPoIds` de qualquer fatura existente do contrato (ou introduzir um campo explícito, ex. `PurchaseOrder.consolidatedInvoiceId`, atualizado dentro da mesma transação).
- Não existem testes para esta função — acrescentar cobertura (consolidação normal; chamada repetida não duplica; falha na notificação não deixa a fatura "invisível" para o utilizador).

---

### N2 · ALTO — Criação de contrato-quadro sem verificar a empresa do utilizador

**`backend/src/controllers/contractController.js:3-6`** + **`backend/src/routes/contractRoutes.js:13`** + schema em `backend/src/utils/schemas.js:406-416`.

`POST /api/contracts` aceita `clientCompanyId`/`supplierCompanyId` diretamente do corpo do pedido (`createContractSchema`, dois UUIDs livres). A rota permite `COMPANY_ADMIN` (não só `ADMIN_SISTEMA`), mas nem a rota, nem o controller, nem `contractService.createContract` verificam que `req.user.companyId` corresponde a uma das duas empresas indicadas.

**Cenário concreto**: um `COMPANY_ADMIN` de qualquer empresa com plano PRO consegue criar, sem qualquer relação real, um contrato-quadro entre **duas empresas terceiras** (`clientCompanyId`/`supplierCompanyId` arbitrários), desde que a empresa-cliente escolhida tenha a feature `frameworkContracts`. O impacto é real: `poService.createPurchaseOrder` deteta call-offs automaticamente a partir de `clientCompanyId+supplierCompanyId+categorias` — POs reais e futuras entre essas duas empresas passam a nascer já `APROVADA` (sem aprovação humana) e a entrar no ciclo de faturação consolidada do contrato forjado.

**Recomendação**: exigir `req.user.companyId === clientCompanyId` quando o papel é `COMPANY_ADMIN` (só `ADMIN_SISTEMA` pode criar livremente, com uma justificação de negócio explícita), reutilizando o padrão de `requireSameCompany` já definido (mas morto) em `rbac.js` — ver achado #11 da v1.

---

### N3 · ALTO — Consolidação de faturação sem verificar posse do contrato

**`backend/src/controllers/contractController.js:22-25`** + **`backend/src/routes/contractRoutes.js:16`**.

`consolidateBilling` chama `contractService.consolidateContractBilling(req.params.id)` sem sequer passar `req.user`; a função de serviço nunca compara `contract.clientCompanyId`/`supplierCompanyId` com quem fez o pedido (ao contrário de `getContract`, que já tem essa verificação e devolve 404 quando a empresa não é parte do contrato).

**Cenário concreto**: qualquer `COMPANY_ADMIN` ou `FINANCEIRO`, de qualquer empresa da plataforma, pode forçar a geração de uma fatura consolidada certificada para **qualquer contrato existente**, bastando saber (ou adivinhar) o UUID — nem precisa de ser parte do contrato.

**Recomendação**: usar `contractService.getContract(id, req.user)` (já tem a verificação de posse) antes de consolidar, ou passar `req.user` a `consolidateContractBilling` e replicar a mesma verificação aí.

---

### N4 · ALTO — Add-on "Automatic PO Robot" nunca expira automaticamente

**`backend/src/services/addonService.js`** (modelo de dados: `prisma/schema.prisma:164-176`, `CompanyAddon`).

Ao contrário da subscrição de plano (`Company.planoValidoAte` + `subscriptionExpiryJob.js`, com avisos escalonados e restrição automática ao expirar), o modelo `CompanyAddon` **não tem nenhum campo de validade** — só `status` (`ATIVO`/`INATIVO`) e `activatedAt`. A validade da mensalidade fica só em `AddonCobranca.validoAte` (o registo de cobrança), mas nada volta a lê-la depois de o add-on ser ativado. `assertAddon` — chamada antes de toda a operação do robot — só verifica `status === 'ATIVO'`. Confirmado por grep: não existe nenhum job de expiração de add-ons em `backend/src/jobs/`, e `subscriptionExpiryJob.js`/`planService.js` não mencionam addons.

**Cenário concreto**: uma empresa paga um único mês do add-on (200 USD por omissão). O `CompanyAddon.status` fica `ATIVO` **para sempre** — o robot continua a criar Purchase Orders reais (compromissos financeiros da empresa) indefinidamente, sem nunca mais ser cobrado.

**Recomendação**: persistir a validade em `CompanyAddon` (ex. `validoAte`, copiado de `AddonCobranca.validoAte` ao confirmar) e ou (a) verificar em `assertAddon` que ainda não expirou, ou (b) criar um job diário de expiração de add-ons, espelhando `subscriptionExpiryJob.js`.

---

### N5 · ALTO — Segredo de webhook por-tenant não liga o tenant à PO afetada

**`kixima-integration-service/src/webhooks/webhook.controller.ts:60-96`** (`receive`) + **`webhook.producer.ts:52-56`** (`notifyKixima`) + **`backend/src/services/poService.js:303-360`** (`aplicarDecisaoErp`/`aplicarPagamentoErp`).

A correção do achado #9 da v1 resolveu a assinatura (agora por tenant+ERP), mas deixou uma lacuna estrutural: `tenantId` (parâmetro da rota `POST /webhooks/erp/:tenantId/:erp`) serve **só** para escolher o segredo de verificação (`resolveSecret`) e para um log de auditoria — nunca é usado para confirmar que o `poId` no corpo do webhook pertence a esse tenant. `notifyKixima(null, type, data)` nem sequer recebe `tenantId` como parâmetro. O callback que chega ao backend Kixima (`POST /api/integration/callback`) aplica a decisão só com base no `poId`, sem qualquer verificação de qual empresa "devia" estar a confirmá-la.

**Cenário concreto**: uma entidade que conheça o segredo de webhook legítimo do tenant B (o próprio ERP de B, ou uma credencial de B comprometida) pode assinar corretamente `POST /webhooks/erp/B/sap` com um `poId` que pertence à empresa A. A assinatura é válida (é mesmo o segredo de B), o microserviço reencaminha, e o backend aplica a decisão/pagamento à PO de A — incluindo emitir um recibo fiscal certificado via `aplicarPagamentoErp`.

**Fator atenuante, para não exagerar a gravidade**: `PurchaseOrder.id` é um UUID (`prisma/schema.prisma:884`), não sequencial e não exposto publicamente; na prática, um tenant só chega a conhecer o `poId` de uma PO que lhe foi endereçada pelo próprio fluxo de sincronização (o `approval_requested` que o microserviço lhe envia). Por isso, hoje, explorar isto exige já ter uma forma de obter o UUID de uma PO alheia — algo que os controlos de acesso normais da aplicação não expõem. Ainda assim, é uma lacuna de defesa em profundidade real: a autorização depende inteiramente do sigilo do UUID nalgum outro sítio do sistema, e não de uma verificação explícita no ponto onde a decisão é aplicada.

**Recomendação**: o backend (`aplicarDecisaoErp`/`aplicarPagamentoErp`) devia validar que a PO pertence à empresa que o `tenantId` do webhook identifica — o que exige passar `tenantId` até ao callback (hoje perdido em `notifyKixima`) e mapear tenant→companyId de forma fiável nos dois lados.

---

### N6 · ALTO — Retry de sincronização multi-ERP reenvia a adapters já bem-sucedidos

**`kixima-integration-service/src/sync/sync.processor.ts:76-140`**.

Quando um tenant tem mais do que um ERP ativo, `resolveEnabledAdapters` devolve vários adapters e o `process()` itera `for (const {adapter} of resolved)` chamando `adapter.sync(...)`/`requestApproval(...)` para **todos**, sem verificar se já existe um `ErpSyncRecord` com `status: SUCCESS` para aquele `(integrationEventId, erp, entityType)`.

**Cenário concreto**: um tenant com SAP e Ariba ativos processa um evento; o SAP tem sucesso, o Ariba falha com um erro retryable (timeout, 5xx). `attemptsLeft > 0` faz o BullMQ relançar o job inteiro — no próximo attempt, o loop volta a correr para **ambos** os adapters, incluindo o SAP que já tinha criado a PO/fatura/pagamento com sucesso na primeira tentativa. Como as operações dos adapters são POSTs de criação (não idempotentes do lado do ERP), isto duplica registos no ERP já sincronizado — no pior caso (`pushPayment`), poderia iniciar uma segunda confirmação de pagamento real no lado que já tinha tido sucesso, só porque outro ERP do mesmo evento falhou.

**Recomendação**: antes de invocar cada adapter, verificar se já existe `erpSyncRecord` com `status: SUCCESS` para esse `(integrationEventId, erp, entityType)` e saltar esse adapter no retry.

---

### N7 · ALTO — Adapter SAP com código de empresa fixo para todos os tenants

**`kixima-integration-service/src/adapters/mappers/erp.mappers.ts:22-24, 41, 55-56`** (usado por `sap.adapter.ts`).

`SapMapper.purchaseOrder`, `approvalRequest` e `supplierInvoice` codificam `CompanyCode: '1000'` e `PurchasingOrganization: '1000'` como constantes — apesar de o adapter já ser configurável por tenant (`baseUrl`, `username`, `password`, `client`), estes dois campos não fazem parte dessa configuração.

**Cenário concreto**: qualquer tenant cujo SAP real use um código de empresa diferente de `1000` vê as suas POs, aprovações e faturas de fornecedor submetidas ao código de empresa/organização de compras **errado** — na melhor hipótese a chamada falha (código inexistente no SAP do cliente), na pior o código `1000` existe mas pertence a outra unidade de negócio do mesmo cliente, misturando dados financeiros entre unidades. É a mesma classe de bug do timestamp fixo do adapter Ariba (já corrigido) — um valor que devia vir da configuração por tenant e está fixo no código.

**Recomendação**: tornar `companyCode`/`purchasingOrganization` campos da configuração do tenant (como `client` já é), e usá-los no mapper.

---

### N8 · MÉDIO — Conciliação bancária: corrida sem tratamento no `P2002`

**`backend/src/services/conciliacaoService.js:154-229`** (`tentarConciliar`), chamada em loop por `importarExtrato` (linhas 90-130, sem `try/catch` por linha).

`tentarConciliar` lê a fatura com `include: { payment: true }` e verifica `if (fatura.payment)` (linha 172) **antes** de abrir a `$transaction` (linha 205) que cria o `Payment` (`invoiceId @unique`). Ao contrário de `poService.aplicarPagamentoErp` (que já trata este mesmo padrão explicitamente, tratando `P2002` como sucesso idempotente), aqui não há `try/catch` nenhum à volta da transação.

**Cenário concreto**: duas linhas de extrato com referências que apontam para a mesma fatura, processadas por chamadas concorrentes a `importarExtrato`/`reconciliarManualmente` (ex.: dois administradores a importar extratos sobrepostos ao mesmo tempo), podem ambas passar a verificação de `fatura.payment` antes de qualquer uma criar o `Payment`. A segunda rebenta com `P2002` sem tratamento — o erro sobe por `tentarConciliar` e interrompe o `for` de `importarExtrato` **a meio do lote**, deixando as linhas seguintes do extrato por processar e devolvendo 500 ao chamador.

**Recomendação**: envolver o bloco em `try/catch` (mesmo padrão de `aplicarPagamentoErp`): em `P2002`, marcar a linha como `DIVERGENTE` ("pagamento já registado por outra linha") em vez de propagar o erro e abortar o resto do lote.

---

### N9 · MÉDIO — Sem validação nem decremento de stock ligado ao ciclo da PO

**Ausência confirmada** em `backend/src/services/poService.js` (grep: `stockQuantity` só aparece em `catalogService.js`/`catalogImportService.js`/`reportsService.js` — nunca em `poService.js`).

Não existe qualquer verificação de "quantidade pedida ≤ stock disponível" na criação de uma PO, nem decremento automático de `Product.stockQuantity` em nenhum ponto do ciclo (criação, aceitação, despacho, entrega). O `stockQuantity` só é alterado manualmente pelo fornecedor via `catalogService.updateStock`/`createStockMovement`.

**Cenário concreto**: várias POs concorrentes para o mesmo produto podem, em conjunto, pedir uma quantidade muito superior ao que o fornecedor declarou em stock, sem qualquer aviso ou bloqueio do sistema.

**Nota importante**: isto pode ser uma decisão de produto deliberada — um marketplace B2B com fulfillment manual, em que "stock" é só informativo para o comprador decidir, não um controlo de disponibilidade automático. Não classifico isto como um bug confirmado; é uma lacuna relativamente à expectativa comum de "stock", que vale a pena confirmar como intencional (e documentar como tal) ou corrigir.

**Recomendação, se for suposto ser um controlo real**: adicionar validação em `createPurchaseOrder` e decrementar dentro da mesma transação, com guarda condicional no `WHERE` (`updateMany` com `stockQuantity: { gte: quantity }`) para evitar oversell sob concorrência.

---

### N10 · BAIXO/INFORMATIVO — Cliente REST da Sandbox AGT implementado mas nunca ligado

**`backend/src/services/agtSandboxClient.js`** — confirmado por grep: só é referenciado pelos próprios testes (`tests/agt-sandbox-client*.test.js`) e por um comentário em `env.js`; nenhuma rota, controller ou outro serviço o invoca.

O módulo (registo/consulta de faturas na Sandbox da AGT, com as 3 assinaturas JWS exigidas) está implementado e testado isoladamente, mas não há nenhum caminho de código que o chame a partir de um evento de negócio real (emissão de fatura, nota de crédito, recibo). Isto não é um bug de correção — é um lembrete de que a submissão à AGT via Sandbox **ainda não está integrada no fluxo**, apesar de o módulo já existir; alguém a olhar só para o código do serviço poderia presumir o contrário.

**Recomendação**: nenhuma ação corretiva necessária agora — só não apresentar isto como "submissão à AGT implementada" sem qualificar que falta a ligação ao fluxo de faturação real.

---

## Metodologia desta ronda

Reverificação direta (leitura de código, não presunção) dos 4 achados da v1 ainda por corrigir, mais 2 agentes de exploração em paralelo, cada um instruído a não repetir achados já conhecidos e a só reportar problemas verificados com ficheiro:linha e cenário concreto de disparo:
- Agente A: `contractService`/`quoteService`/`catalogService` (stock)/`conciliacaoService`/`retencaoService`/`backupVerificacaoService`/Trust & Safety/`feedbackService`/Category Management/`saftService`/`poRoboService`/`addonService`.
- Agente B: adapters SAP/Primavera/Oracle do microserviço, `sync.processor.ts`, `credentials.service.ts`/`crypto.service.ts`, correlação tenant↔PO no webhook de entrada, e páginas novas do frontend (PO Robot, Category Management, Descontos, integrações ERP).

Todos os achados Alto e Crítico reportados pelos agentes foram reverificados manualmente por mim antes de entrarem neste documento (leitura direta do ficheiro:linha citado, confirmação do schema Prisma relevante, e no caso de N1/N2/N3, confirmação também do schema de validação Zod e das rotas). Nenhuma alteração de código foi feita como parte desta auditoria.
