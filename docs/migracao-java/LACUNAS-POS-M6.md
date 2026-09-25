# Lacunas de cobertura no fim do M6 — o que o Java ainda não serve

Inventário mecânico (rotas do Node × controllers do Java), feito no fecho do
M6, antes de arrancar o M7. O M7 do plano ("diff de contrato em **todos** os
endpoints") pressupõe que todos os domínios existem em Java — e não existem:

| | Endpoints |
|---|---|
| Node (34 routers + rotas directas em app.js) | **244** |
| Java (23 controllers) | **124** |
| **Node sem correspondente Java** | **121** |

Os 124 portados estão cobertos por testes de paridade (84 testes JUnit, 100 %
verdes) e são: autenticação/2FA, catálogo (leitura, stock, avaliações,
documentos, chaves de API), ordens de compra (máquina de estados completa),
faturação AGT (payloads/estado/séries), convites e utilizadores da empresa,
ERP config, conversas/alertas de risco, suporte (chat), notificações,
favoritos/pesquisas guardadas, apólices, supplier development, descontos,
feedback, PO Robot, admin (auditoria, 2FA pendentes, backup), retenção.

Cada lacuna abaixo foi **deferida explicitamente** ao longo de M3–M6 (notas
`NÃO PORTADO` no código), não omitida por engano — mas a soma delas é metade
da API, e inclui o caminho do dinheiro. Um cutover por domínio (M8) não é
seguro enquanto o fluxo comercial estiver partido a meio entre os dois
backends.

## O que falta, por grupo (tamanho ≈ linhas do serviço Node correspondente)

### A. Núcleo comercial — o caminho do dinheiro (bloqueia o cutover de PO/fatura)

**Estado: FECHADO** (commits "Lacunas A.1" a "Lacunas A.6/A.7"). Única
excepção, documentada: o webhook `/api/webhooks/pagamento/{canal}` e os
adaptadores de gateway ficam para o grupo C (partilham o serviço de
subscrição/cobrança). Também portados de passagem: contexto "quote" e
"contract" do Chat Comercial, ERP-managed no checkout, `ErpSyncLog`.

| Rotas Node | Endpoints | Serviço(s) Node | Notas |
|---|---|---|---|
| `/api/payments` | 7 | paymentService (257), creditNoteService (278) | pagar fatura, confirmar receção, notas de crédito, anular; desbloqueia `payment.completed` (eventBus) e a categoria PAGAMENTO do feedback |
| `/api/conciliacao`, `/api/webhooks/pagamento` | 5 | conciliacaoService (308), multicaixaService (140), canaisPagamento | extrato bancário, conciliação, canais automáticos |
| `/api/admin/platform-fees`, `/api/companies/{id}/platform-fees` | 3 | platformFeeService (151) | taxa da plataforma (M3d listava-a; só `toUsd` foi portado) |
| `/api/quotes` | 4 | quoteService | cotações — contexto "quote" do chat comercial recusa 503 até aqui |
| `/api/contracts` | 4 | contractService (250) | contratos-quadro / call-off — toda a PO nasce `isCallOff=false` até aqui |
| `/api/purchase-orders/{id}/history` | 1 | poService | histórico da PO |
| `/api/integration/callback` | 1 | poService.aplicarDecisaoErp/aplicarPagamentoErp | POs ERP-managed (DOA) + `purchase_order.approval_requested` |

### B. Empresa, utilizadores e painéis

**Estado: FECHADO** (commits "Lacunas B.1" a "Lacunas B.4"): `/api/companies`,
`/api/users`, `/api/company-admin`, `/api/buyer`, `/api/financeiro`,
`/api/dashboard`, `/api/reports` e `/api/public/stats`.

| Rotas Node | Endpoints | Serviço(s) Node | Notas |
|---|---|---|---|
| `/api/companies` (register, list, get, decision, plan, serie-fiscal, data-adesao, subscription, bank-details, budget-limit, users POST) | 13 | companyService (713) | cadastro e due diligence de empresas — o Java só CRIA empresas via supplier-dev |
| `/api/users` | 7 | dadosPessoaisService (165), userService | perfil, locale, avatar, dados pessoais/anonimização (RGPD) |
| `/api/company-admin` | 6 | companyAdminService (165) | organização, dashboard, settings |
| `/api/buyer` | 7 | buyerService (285) | painéis do comprador |
| `/api/financeiro`, `/api/dashboard`, `/api/reports` | 6 | metricasService (166), reportsService (135), conteudoLocalService (261) | painéis financeiro/comprador e relatórios (conteúdo local) |
| `/api/public/stats` | 1 | — | estatísticas públicas da home |

### C. Cobrança da própria KIXIMA (subscrição, add-ons, planos)

**Estado: FECHADO** (commit "Lacunas C"): `/api/assinatura`, `/api/addons`,
`/api/planos` e o webhook `/api/webhooks/pagamento/{canal}` com os cinco
adaptadores de gateway (EMIS, PayPay, BAI, BFA, Standard Bank Angola) — todos
"recusam-se a fingir" sem credenciais, como no Node.

| Rotas Node | Endpoints | Serviço(s) Node | Notas |
|---|---|---|---|
| `/api/assinatura` | 8 | assinaturaService (780) | pedir → comprovativo → confirmar; canais automáticos (gateway) |
| `/api/addons` | 7 | addonService (361) | idem para add-ons (PO Robot) — só a guarda `assertAddon` está em Java |
| `/api/planos` | 1 | planService (preços/tabela) | metade "preços" do planService |

### D. Administração, operações e catálogo (escrita)

**Estado: FECHADO** (commits "Lacunas D.1" a "Lacunas D.6/D.7/D.8").

| Rotas Node | Endpoints | Serviço(s) Node | Notas |
|---|---|---|---|
| ~~`/api/admin` (invites de assessor, users/areas/status, activities, prontidão, email-teste)~~ | 14 | adminService (320), prontidaoService (675) | **FECHADO** (commit "Lacunas D.1"): `admin/AdminService`, `admin/AdminController`, `admin/ProntidaoService`; email de teste via `EmailDispatchService.enviarDireto` (recusa-se a fingir em modo console: 422). A Prontidão diz o NOME das credenciais S3 em falta, nunca o valor. |
| ~~`/api/catalog` (create/update/delete, import, imagens/media/documentos)~~ | 8 | catalogService (escrita), catalogImportService (310), storage | **FECHADO** (commit "Lacunas D.2"): `CatalogService` (escrita e media), `CatalogImportService` (Apache POI no lugar do SheetJS; fotos embebidas lidas do zip), `catalog/dto/ProductPayload` (createProductSchema/partial), `catalog/UploadFilters` (filtros do multer). |
| ~~`/api/marketplace` (search, compare, facets, suppliers)~~ | 4 | marketplaceService (259) | **FECHADO** (commit "Lacunas D.3/D.4"): `marketplace/MarketplaceService` — filtros em SQL nativo (search_text por gatilho, text[], search_rank do fornecedor), hidratação pelo JPA. |
| ~~`/api/kits`~~ | 3 | kitService | **FECHADO** (commit "Lacunas D.3/D.4"): `kit/{Kit,KitItem,KitService,KitController}`. |
| ~~`/api/faturacao` (integridade, saft, saft/resumo, metricas)~~ | 4 | saftService (355), faturacaoService | **FECHADO** (commit "Lacunas D.5"): `faturacao/{CadeiaIntegridadeService,SaftService,MetricasService,FaturacaoController}`. Diferença deliberada: período ilegível no SAF-T é 422, não o 500 do `Error` cru do Node. |
| ~~`/api/support` (overview, admin/overview, imagens de categorias)~~ | 5 | supportService | **FECHADO** (commit "Lacunas D.6/D.7/D.8"): `support/SupportOverviewService` + rotas em `SupportController`; overrides mortos no disco voltam ao default (`StorageService.urlAindaVivo`). |
| ~~`/api/category-management` (analise, media-mensal)~~ | 2 | categoryAnalyticsService (resto) | **FECHADO** (commit "Lacunas D.6/D.7/D.8"): `analytics/{CategoryManagementController,AiRecommendationService}`, `CategoryAnalyticsService` (volume/oportunidades/previsão), `DiscountThresholdService.proximoThreshold`. A IA chama a Messages API só com `ANTHROPIC_API_KEY`; sem ela, texto null com motivo. |
| ~~`/api/v1/catalogo`~~ | 3 | apiCatalogoRoutes (181) | **FECHADO** (commit "Lacunas D.6/D.7/D.8"): `apicatalogo/ApiCatalogoController` — chave `kxm_` fora da sessão JWT (PublicPaths), 120/min por chave com Bucket4j (janela fixa), auditoria `CATALOGO_ATUALIZADO_POR_API`. Diferença deliberada: `prazoEntregaDias` inválido é 422 (o Node deixava um NaN rebentar em 500). |

## Dependências transversais ainda por portar

- ~~**S3** no `StorageService`~~ — **PORTADO** (commit "Lacunas D.6/D.7/D.8"):
  SDK da AWS v2 (`s3` + `apache-client`), mesmas variáveis `STORAGE_*` do Node,
  pastas por tipo de ficheiro, 502 com o motivo explicado quando o bucket falha;
  a cópia de segurança passa a correr com S3 configurado. Só testável de ponta a
  ponta contra um bucket real (em M7, no staging).
- ~~**Rate limiting** (Bucket4j)~~ — **PORTADO** (M7): `/api/v1/catalogo`
  (120/min por chave) e, em `security/RateLimitFilter`, todos os limitadores
  de `middleware/rateLimit.js` + os locais de feedback/candidaturas — ver
  `M7-PARIDADE.md`, secção 4.
- **SMTP** como provider de email (JavaMail) — só `console`/`brevo` existem.
- **i18n dos emails** (`i18n/emails.js`) — o email sai sempre em português.
- **Interceptor genérico de tecto de linhas** (`DB_MAX_ROWS`) — só aplicado
  explicitamente no catálogo.

O estado destes três (SMTP, i18n, `DB_MAX_ROWS`) e o que o replay de contrato
do M7 encontrou e corrigiu está em `M7-PARIDADE.md`.

## Ordem proposta (mesma disciplina de M5/M6: um commit + testes por domínio)

1. **A** — dinheiro primeiro: pagamentos/notas de crédito → conciliação +
   webhook → taxa da plataforma → cotações → contratos → histórico da PO →
   callback ERP. É o que torna PO/fatura cortáveis em bloco.
2. **B** — empresa/utilizadores/painéis (cadastro é pré-requisito de
   qualquer empresa nova entrar pelo Java).
3. **C** — subscrição/add-ons/planos.
4. **D** — admin/operações/catálogo (escrita), com S3 e Bucket4j a entrar
   aqui (dependências novas no `pom.xml`, decisão a confirmar).
5. Só então **M7** (replay de contrato sobre os 244 endpoints) e **M8**.
