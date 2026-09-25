# Migração do frontend: React/Vite → Angular

## Contexto e decisão de âmbito

O pedido foi para substituir **progressivamente** o frontend React por Angular
e concentrar o backend em Java. Uma reescrita completa das 97 páginas React
(`frontend/src/pages/**/*.jsx`, excluindo testes) — cada uma com a sua lógica
de negócio, formulários e chamadas à API — é um trabalho de várias semanas de
engenharia real. Tentar "completar tudo" numa única passagem teria obrigado a
escolher entre inventar comportamento não confirmado no código (proibido
explicitamente no pedido) ou produzir páginas incompletas sem o dizer. Nenhuma
das duas opções é aceitável.

Por isso, esta primeira etapa entrega:

1. **A arquitectura completa** do novo frontend Angular — a parte que todas as
   páginas seguintes vão reutilizar (autenticação, RBAC, guards,
   interceptors, cliente HTTP, tema, identidade visual).
2. **Um domínio migrado de ponta a ponta**, com paridade confirmada linha a
   linha com o código React original: autenticação (login + 2FA) e Cotações
   (CRUD completo, comprador e fornecedor).
3. **Este plano**, com o inventário completo das 97 páginas e a ordem
   recomendada para as sessões seguintes continuarem a migração sem
   surpresas.

Nada foi removido do frontend React. O `frontend-angular/` cresce ao lado de
`frontend/`, exactamente como o `backend-java/` cresceu ao lado do
`backend/` durante a migração do backend — a mesma estratégia, já validada
neste repositório.

## O que já está pronto (reutilizável por todas as páginas seguintes)

| Peça | Ficheiro | Espelha (React) |
|---|---|---|
| Cliente HTTP + normalização de erro | `core/services/api.service.ts`, `core/interceptors/error.interceptor.ts`, `core/interceptors/credentials.interceptor.ts` | `frontend/src/api/client.js` |
| Autenticação (sessão, login, 2FA, três estados de sessão) | `core/services/auth.service.ts` | `frontend/src/auth/AuthContext.jsx` |
| Guards de rota (autenticado / papel) | `core/guards/auth.guard.ts`, `core/guards/role.guard.ts`, `core/guards/guest.guard.ts` | `frontend/src/auth/RequireAuth.jsx` |
| Modelos TypeScript (User, Quote, Product, erro) | `core/models/*.ts` | `backend/prisma/schema.prisma`, `utils/schemas.js` |
| Constantes de domínio (papéis, formatação) | `shared/domain.ts` | `frontend/src/domain.js` |
| Tema (3 fundos) | `shared/tema/*` | `frontend/src/tema/TemaContext.jsx` |
| Identidade visual (CSS, fontes, marca) | `src/styles/*.css` (copiados), fontes @fontsource, `shared/components/logo.component.ts` | `frontend/src/styles/*.css`, `Logo.jsx` |
| Componentes partilhados | `shared/components/{page-header,loading,error-banner,success-banner,field,badge,icon,auth-hero,stars,product-cover,button}.component.ts` | `frontend/src/components/{Common,Badge,icons,AuthHero,Logo,ProductCover,Button}.jsx` |
| Componentes "Bancada" do Comprador | `shared/buyer-ui/{crumbs,page-head,kpi-row,tabs,pill,toolbar,supplier-cell,empty-row,pagination}.component.ts` | `frontend/src/components/BuyerUI.jsx` |
| Casca de layout (provisória) | `features/shell/shell.component.ts` | `frontend/src/components/AppLayout.jsx` (versão completa com sidebar ainda por portar) |

## Domínios migrados de ponta a ponta

| Domínio | Componentes Angular | Página(s) React de origem | Endpoints |
|---|---|---|---|
| Autenticação + 2FA | `features/auth/login-page.component.ts` | `pages/shared/LoginPage.jsx` | `/api/auth/*` |
| Cotações — Comprador | `features/quotes/quotes.component.ts` | `pages/comprador/Quotes.jsx` | `GET/POST /api/quotes`, `PATCH .../close` |
| Cotações — Fornecedor | `features/quotes/supplier-quotes.component.ts` | `pages/fornecedor/SupplierQuotes.jsx` | `GET /api/quotes`, `PATCH .../respond` |
| Catálogo — navegação/pesquisa | `features/catalog/catalog-browse.component.ts` | `pages/comprador/Catalog.jsx` | `GET /api/marketplace/search`, `GET .../facets` |
| Catálogo — detalhe do item | `features/catalog/item-detail.component.ts` | `pages/comprador/ItemDetail.jsx` | `GET /api/catalog/:id` |
| Carrinho de compras | `features/cart/{cart.service,cart.component}.ts` | `pages/comprador/{CartContext,Cart}.jsx` | (estado local — sem API própria) |
| Checkout | `features/orders/checkout.component.ts` | `pages/comprador/Checkout.jsx` | `POST /api/purchase-orders` (uma vez por fornecedor) |
| Ordens de Compra — lista do Comprador | `features/orders/orders.component.ts` | `pages/comprador/Orders.jsx` | `GET /api/buyer/orders` |
| Ordens de Compra — detalhe (partilhado por 4 personas) | `features/orders/order-detail.component.ts` | `pages/shared/OrderDetail.jsx` | `GET /api/purchase-orders/:id`, `.../history`, `PATCH .../{approve,reject,accept,refuse,dispatch,delivered,reception,resolve-divergence}`, `POST /api/payments/invoices/:id/{notas-credito,anular}` |
| Aprovações — Company Admin | `features/orders/approvals.component.ts` | `pages/companyAdmin/Approvals.jsx` | `GET /api/purchase-orders?status=AGUARDANDO_APROVACAO` |
| Faturas — Fornecedor | `features/orders/supplier-invoices.component.ts` | `pages/fornecedor/Invoices.jsx` | `GET /api/purchase-orders?invoiced=true&page=&limit=` (envelope paginado) |
| Pagamentos Recebidos — Fornecedor/Financeiro | `features/orders/supplier-payments.component.ts` | `pages/fornecedor/Payments.jsx` (mesmo componente React em `/fornecedor/pagamentos` e `/financeiro/recebidos`) | `GET /api/purchase-orders` (array puro, filtrado no cliente), `PATCH /api/payments/:paymentId/confirm-received` |
| Ordens de Compra Recebidas — Fornecedor | `features/orders/orders-received.component.ts` | `pages/fornecedor/OrdersReceived.jsx` | `GET /api/purchase-orders?status=` (filtro de estado opcional) |
| Contratos-quadro — Company Admin | `features/contracts/contracts.component.ts` | `pages/companyAdmin/Contracts.jsx` | `GET /api/contracts` |
| Faturas Pendentes — Financeiro | `features/financeiro/pending-invoices.component.ts` | `pages/financeiro/PendingInvoices.jsx` | `GET /api/financeiro/invoices`, `POST /api/payments/invoices/:id/pay` (multipart, comprovativo obrigatório) |
| Pagamentos — Financeiro | `features/financeiro/payment-history.component.ts` | `pages/financeiro/PaymentHistory.jsx` | `GET /api/financeiro/payments?status=` |
| Pagamentos — Comprador | `features/orders/buyer-payments.component.ts` | `pages/comprador/Payments.jsx` | `GET /api/buyer/payments?status=&q=` |
| Due Diligence — Admin do Sistema | `features/admin/{due-diligence,company-review-card}.component.ts` | `pages/adminSistema/DueDiligence.jsx` | `GET /api/companies?status=PENDENTE`, `GET /api/companies/:id`, `PATCH /api/companies/:id/decision` |
| Taxa KIXIMA — Admin do Sistema | `features/admin/platform-fees.component.ts` | `pages/adminSistema/PlatformFees.jsx` | `GET /api/admin/platform-fees`, `PATCH /api/admin/platform-fees/:id/charge` |
| Cadastro público de empresa | `features/auth/register.component.ts` | `pages/shared/Register.jsx` | `POST /api/companies/register` (multipart) |
| Aceitar convite de equipa | `features/auth/accept-invite.component.ts` | `pages/shared/AcceptInvite.jsx` | `GET/POST /api/companies/invite/:token` |
| Aceitar convite de Admin do Sistema | `features/auth/accept-admin-invite.component.ts` | `pages/shared/AcceptAdminInvite.jsx` | `GET/POST /api/admin/invite/:token` |
| Recuperação de senha | `features/auth/password-reset.component.ts` | `pages/shared/PasswordReset.jsx` | `POST /api/auth/{forgot-password,reset-password}` |
| Acompanhar Entrega — Comprador | `features/orders/deliveries.component.ts` | `pages/comprador/Deliveries.jsx` | `GET /api/buyer/deliveries?stage=&q=` |
| Recepção — Comprador | `features/orders/receptions.component.ts` | `pages/comprador/Receptions.jsx` | `GET /api/buyer/receptions?status=&q=` |
| Usuários & Perfis — Company Admin | `features/company-admin/users.component.ts` | `pages/companyAdmin/Users.jsx` | `GET/POST/PATCH/DELETE /api/companies/{users,invites}` |
| Perfil da Empresa (organização) — Company Admin | `features/company-admin/{organization,bank-details-panel}.component.ts` | `pages/companyAdmin/Organization.jsx` | `GET /api/company-admin/organizacao`, `GET/PUT /api/companies/:id/bank-details` |
| Perfil da Empresa (apólices) — Company Admin | `features/company-admin/company-profile.component.ts` | `pages/companyAdmin/CompanyProfile.jsx` | `GET /api/companies/:id`, `GET /api/policies/company/:id` |

**Verificação ao vivo desta etapa** (Postgres + backend Java a correr localmente, Angular com o seu proxy): login como Comprador → pesquisa no catálogo → produto → cesta → checkout (gera PO) → lista de ordens com KPIs → detalhe da PO → aprovação pelo Company Admin → aceitação pelo Fornecedor (gera fatura com os campos AGT presentes, correctamente vazios sem credenciais) → guarda de máquina de estados (despachar antes de pago devolve 400) → fluxo de rejeição com motivo. RBAC confirmado com 403 em cada ponto errado: Comprador não aprova nem aceita a própria PO, Fornecedor não aprova, Fornecedor não lê `/api/buyer/orders` (403), pedido sem sessão dá 401. Um bug de routing desta sessão anterior foi encontrado e corrigido: a rota de Cotações do Comprador estava em `/comprador/pedidos`, mas a real (`frontend/src/App.jsx:191`) é `/comprador/cotacoes` — nunca teria sido alcançável pela navegação real da aplicação.

**Verificação ao vivo — Aprovações/Faturas/Pagamentos** (mesmo ambiente, sessões reais via login + cookie de sessão, testado por HTTP directo e por browser headless através do `ng serve`): Company Admin lê `/empresa/aprovacoes` e vê a PO pendente real; Fornecedor lê `/fornecedor/faturas` (envelope paginado, badges de estado) e `/fornecedor/pagamentos` (filtra só as próprias vendas pagas); Financeiro lê `/financeiro/recebidos` — mesmo componente, mostra "sem pagamentos" correctamente porque a empresa cliente não vende; confirmação de recebimento (`PATCH /api/payments/:id/confirm-received`) testada ao vivo: Comprador (empresa errada) → 403, Fornecedor dono → 200 com `receivedAt` preenchido, segunda tentativa → 409. `roleGuard('COMPANY_ADMIN')` confirmado a bloquear um Comprador que tenta `/empresa/aprovacoes` (redireccionado para a sua própria área) — RBAC do lado do cliente, o servidor continua a ser a fonte de verdade.

**Bug de paridade Node↔Java encontrado e corrigido nesta etapa** (fora do Angular, no backend Java): `GET /api/purchase-orders` no `backend-java` (`PoController.list`) só aceitava `status` — ignorava silenciosamente `invoiced`/`page`/`limit`, devolvendo sempre o array completo sem filtrar nem paginar. O Node (`poService.listPurchaseOrders`, `backend/src/services/poService.js:245-268`) filtra por `invoiced` e, quando `page` está presente, devolve o envelope `{items,total,page,pages,limit}`. Corrigido em `PoController`/`PoDtoService`/`PurchaseOrderSpecifications` para reproduzir exactamente os dois ramos do Node (mesmo tecto `min(max(1,limit||15),50)`, mesmo `pages=max(1,ceil(total/take))`), com teste de contrato adicionado em `PoControllerTest` e verificado ao vivo (a diferença foi vista primeiro por HTTP directo, antes de qualquer suposição). Sem esta correcção, o ecrã de Faturas do Fornecedor teria mostrado todas as POs (faturadas ou não) sem paginação real.

**Verificação ao vivo — Ordens Recebidas/Contratos**: `GET /api/contracts` e `GET /api/purchase-orders` (sem `page`) já estavam correctos e completos no Java — nenhuma correcção necessária desta vez. Confirmado por HTTP directo (Company Admin lê os 3 contratos reais de demonstração, com `clientCompany`/`supplierCompany` presentes) e por browser headless: Company Admin em `/empresa/contratos` vê os KPIs correctos (total, ativos, a vencer em 30 dias, vencidos, valor somado — mesmo cálculo do React) e a lista lateral "Próximos a Vencer"; Fornecedor em `/fornecedor/ordens` vê o filtro de estado e a lista de POs recebidas. RBAC do lado do cliente confirmado nos dois sentidos: Fornecedor bloqueado de `/empresa/contratos` (`roleGuard('COMPANY_ADMIN')`) e Comprador bloqueado de `/fornecedor/ordens` (`roleGuard('FORNECEDOR')`), ambos redireccionados para a sua própria área inicial.

**Verificação ao vivo — Financeiro (Faturas Pendentes/Pagamentos)**: `/api/financeiro/{invoices,payments}` já estavam correctos e completos no Java (mesmos KPIs, mesma forma `shapeInvoice`). Fluxo de pagamento completo testado ao vivo, por HTTP directo e pela UI real (browser headless, upload de ficheiro pelo `<input type=file>` e clique em "Confirmar pagamento"): Financeiro paga uma fatura pendente anexando um comprovativo real (PNG) — `POST /api/payments/invoices/:id/pay` devolve o pagamento criado, com o campo `agtInvoiceResubmission` a mostrar honestamente que a submissão à AGT falha por falta de credenciais (nunca finge sucesso); a fatura sai de "pendentes" (2→1→0 ao longo do teste) e passa a aparecer em `/financeiro/historico?status=PAGO` com `paidAt` preenchido. RBAC confirmado: Fornecedor recebe 403 em `/api/financeiro/invoices` e ao tentar pagar uma fatura alheia; Company Admin tem acesso ao endpoint no servidor (`requireRole('FINANCEIRO','COMPANY_ADMIN')`) mas a UI React não expõe estas rotas a esse papel — o `roleGuard('FINANCEIRO')` do Angular reproduz exactamente essa mesma restrição do lado do cliente, não a do servidor. Também adicionado: o grupo de rotas `/documento/*` (fora do `ShellComponent`, tal como em `App.jsx:164-168`) para os links "Ver fatura"/"Ver PO" destas páginas não caírem no wildcard `redirectTo: '/'` — apontam para `PendingPageComponent` até `PrintableDocument.jsx`/`FeeStatement.jsx` serem migrados.

**Verificação ao vivo — Pagamentos do Comprador**: `GET /api/buyer/payments` já estava correcto e completo no Java (mesma forma, mesmos KPIs). Confirmado por HTTP directo (Comprador lê o `aPagar`/`concluidos`/`atrasados`/`totalPO` reais, incluindo a fatura paga no teste anterior) e por browser headless em `/comprador/pagamentos`. RBAC confirmado nos dois sentidos: `GET /api/buyer/payments` devolve 403 a um Fornecedor no servidor, e o `roleGuard('COMPRADOR')` do Angular já bloqueia essa rota no cliente antes mesmo do pedido à API. Dois ícones que faltavam (`help`, `wallet`) portados para `IconComponent`, e o grupo de rotas partilhadas ganhou `ajuda` (antes só existia `suporte`, mas o botão "Contactar Suporte" desta página navega para `/ajuda`, como no React).

**Verificação ao vivo — Due Diligence/Taxa KIXIMA (Admin do Sistema)**: primeiro domínio Angular do Admin do Sistema. `GET/PATCH /api/companies` e `GET/PATCH /api/admin/platform-fees` já estavam correctos e completos no Java. A base de demonstração não tinha nenhuma empresa PENDENTE, por isso duas linhas de teste foram inseridas directamente na base local (`kixima_test`, disposable) para exercitar o fluxo real: aprovação de um cliente (200, `approvedAt` preenchido), tentativa de aprovar um fornecedor sem apólice Fornecedor→KIXIMA submetida (`BUSINESS_RULE_VIOLATION`, a mesma regra do Node), e rejeição desse fornecedor (200, `rejectedAt` preenchido) — confirmado também pela UI real (clique em "Aprovar empresa", banner de sucesso, e o cartão a desaparecer da lista assim que o `reload()` corre, exactamente o mesmo comportamento do `onDecided={load}` do React). Taxa KIXIMA confirmada com os 2 registos reais gerados automaticamente pelos pagamentos processados nesta sessão (23 USD cada), e a acção "Marcar cobrada" testada ao vivo (`status: COBRADO`, `chargedAt` preenchido). RBAC confirmado em ambos: `ADMIN_SISTEMA` só — `COMPANY_ADMIN` recebe 403 em `/api/companies/:id/decision` e em `/api/admin/platform-fees*`.

**Verificação ao vivo — fluxos sem sessão (Cadastro/Convites/Recuperação de senha)**: os quatro endpoints Java (`POST /api/companies/register`, `GET/POST /api/companies/invite/:token`, `GET/POST /api/admin/invite/:token`, `POST /api/auth/{forgot,reset}-password`) já estavam correctos e completos — nenhuma correcção necessária. Os quatro fluxos foram exercitados de ponta a ponta pela UI real (browser headless, sem atalhos): cadastro público de uma empresa CLIENTE com dois documentos PDF reais anexados (a validação de conteúdo do Java recusou corretamente um `.pdf` que era só texto — teve de se gerar um PDF válido de facto); um convite COMPRADOR criado pelo Company Admin real, aceite através de `/convite/:token` (o utilizador fica `active:false`, à espera da aprovação do Company Admin, exactamente como o React); pedido de recuperação de senha com resposta anti-enumeração idêntica para email existente e inexistente, e definição da nova senha em `/recuperar/:token` (o token é um JWT assinado, nunca guardado em tabela — para o testar sem o SMTP configurado, foi construído à mão com o mesmo segredo/algoritmo HS256 do `JwtService`, só para fins de verificação; a senha do utilizador de teste foi reposta no valor de demonstração no final). O convite de Admin do Sistema (`/convite-admin/:token`) foi verificado ao nível do modelo/serviço (contratos confirmados) sem repetir o mesmo teste de ponta-a-ponta, já que a mecânica é idêntica à do convite de equipa.

**Verificação ao vivo — Acompanhar Entrega/Recepção (Comprador)**: primeiras páginas de prioridade 2 migradas. `GET /api/buyer/{deliveries,receptions}` já estavam correctos e completos no Java. Confirmado por HTTP directo (KPIs reais — 1 em trânsito, 3 em preparação, 3 entregues, 2 canceladas; 1 a receber, 1 recebido, 1 com divergência) e por browser headless em `/comprador/{entregas,recepcao}`. RBAC confirmado: Fornecedor recebe 403 nos dois endpoints no servidor, e o `roleGuard('COMPRADOR')` do Angular bloqueia as duas rotas no cliente.

**Verificação ao vivo — Usuários & Perfis/Organização/Perfil da Empresa (Company Admin)**: todos os endpoints (`/api/companies/{users,invites}`, `/api/company-admin/organizacao`, `/api/companies/:id/bank-details`, `/api/policies/company/:id`) já estavam correctos e completos no Java. Fluxo de convite testado ponta-a-ponta pela UI real: modal "+ Novo Usuário" → convite criado → toast de sucesso → convite novo na lista, sem reload da página. O convite de equipa aceite numa etapa anterior desta sessão (`convidado.teste@petroangola.co.ao`) foi confirmado a aparecer em "Cadastros pendentes" e activado com sucesso (`PATCH /api/companies/users/:id/activate`, `active: true`). Dados bancários testados ao vivo para o Fornecedor (Kianda): `GET`/`PUT /api/companies/:id/bank-details` com IBAN e SWIFT reais. RBAC confirmado nas três páginas: Comprador recebe 403 em `/api/companies/users` no servidor, e o `roleGuard('COMPANY_ADMIN')` bloqueia as três rotas no cliente. Dois ícones que faltavam (`cart`, `suppliers`) portados para `IconComponent`, e `CompanyListItem`/`CompanyDetail` ganharam os campos `address`/`city`/`province`/`country`/`verified` (usados por Organization.jsx, ainda não precisos pelos ecrãs anteriores).

## Inventário completo das 97 páginas React e prioridade sugerida

Prioridade: **1** = fluxo comercial crítico (dinheiro/AGT), **2** = operação
diária de alto uso, **3** = administração/configuração, **4** = conteúdo
estático/ajuda. Dentro de cada prioridade, a ordem é a recomendada.

### Partilhadas (`pages/shared/`) — 21 páginas

| Página | Prioridade | Estado |
|---|---|---|
| `LoginPage.jsx` | 1 | **Migrado** |
| `Register.jsx` | 1 | **Migrado** |
| `AcceptInvite.jsx` | 1 | **Migrado** |
| `AcceptAdminInvite.jsx` | 1 | **Migrado** |
| `PasswordReset.jsx` | 1 | **Migrado** |
| `Profile.jsx` | 2 | Pendente |
| `Security.jsx` | 2 | Pendente |
| `Notifications.jsx` | 2 | Pendente |
| `OrderDetail.jsx` | 1 | **Migrado** (partilhada por 4 personas — todas as acções condicionais portadas e testadas com a matriz de RBAC completa) |
| `ChatComercial.jsx` | 2 | Pendente (tempo real — ver secção "Tempo real") |
| `SuporteChat.jsx` | 2 | Pendente (tempo real) |
| `SuporteFeedback.jsx` | 3 | Pendente |
| `FeeStatement.jsx` | 2 | Pendente |
| `PrintableDocument.jsx` | 2 | Pendente |
| `SupplierDevelopment.jsx` | 3 | Pendente |
| `Plans.jsx` | 3 | Pendente |
| `Legal.jsx` | 4 | Pendente |
| `Help.jsx` | 4 | Pendente |
| `HelpAdmin.jsx` | 4 | Pendente |
| `ModulePlaceholder.jsx` | 4 | Pendente (trivial) |

### Comprador (`pages/comprador/`) — 18 páginas

| Página | Prioridade | Estado |
|---|---|---|
| `Quotes.jsx` | 1 | **Migrado** |
| `Catalog.jsx` | 1 | **Migrado** |
| `ItemDetail.jsx` | 1 | **Migrado** |
| `Cart.jsx` / `CartContext.jsx` | 1 | **Migrado** |
| `Checkout.jsx` | 1 | **Migrado** |
| `Orders.jsx` | 1 | **Migrado** |
| `Payments.jsx` | 1 | **Migrado** |
| `Deliveries.jsx` | 2 | **Migrado** |
| `Receptions.jsx` | 2 | **Migrado** |
| `Home.jsx` | 2 | Pendente |
| `Services.jsx` | 2 | Pendente |
| `Explore.jsx` | 2 | Pendente |
| `ServiceDetail.jsx` | 2 | Pendente |
| `SupplierCompare.jsx` | 2 | Pendente |
| `Suppliers.jsx` | 2 | Pendente |
| `Activities.jsx` | 3 | Pendente |
| `CategoryManagement.jsx` | 3 | Pendente |
| `PoRobot.jsx` | 3 | Pendente |

### Fornecedor (`pages/fornecedor/`) — 16 páginas

| Página | Prioridade | Estado |
|---|---|---|
| `SupplierQuotes.jsx` | 1 | **Migrado** |
| `CatalogManage.jsx` | 1 | Pendente (formulário grande — 754 linhas, taxonomia Oil & Gas completa) |
| `OrdersReceived.jsx` | 1 | **Migrado** |
| `Invoices.jsx` | 1 | **Migrado** |
| `Payments.jsx` | 1 | **Migrado** (reutilizado também em `/financeiro/recebidos` — mesmo componente React de origem) |
| `Inventory.jsx` | 2 | Pendente |
| `StockMovements.jsx` | 2 | Pendente |
| `Home.jsx` | 2 | Pendente |
| `CatalogImport.jsx` | 2 | Pendente |
| `CatalogInsights.jsx` | 2 | Pendente |
| `OrderHistory.jsx` | 2 | Pendente |
| `Wallet.jsx` | 2 | Pendente |
| `Kits.jsx` | 3 | Pendente |
| `Documents.jsx` | 3 | Pendente |
| `ProductRanking.jsx` | 3 | Pendente |
| `Reports.jsx` | 3 | Pendente |
| `ApiCatalogo.jsx` | 3 | Pendente |

### Company Admin (`pages/companyAdmin/`) — 13 páginas

| Página | Prioridade | Estado |
|---|---|---|
| `Approvals.jsx` | 1 | **Migrado** |
| `Contracts.jsx` | 1 | **Migrado** |
| `Assinatura.jsx` | 2 | Pendente |
| `Home.jsx` | 2 | Pendente |
| `Users.jsx` | 2 | **Migrado** |
| `Organization.jsx` | 2 | **Migrado** |
| `CompanyProfile.jsx` | 2 | **Migrado** |
| `CompanyDocuments.jsx` | 3 | Pendente |
| `Permissions.jsx` | 3 | Pendente |
| `Reports.jsx` | 3 | Pendente |
| `ConteudoLocal.jsx` | 3 | Pendente |
| `Activities.jsx` | 3 | Pendente |
| `Settings.jsx` | 3 | Pendente |

### Financeiro (`pages/financeiro/`) — 3 páginas

| Página | Prioridade | Estado |
|---|---|---|
| `PendingInvoices.jsx` | 1 | **Migrado** |
| `PaymentHistory.jsx` | 1 | **Migrado** |
| `Home.jsx` | 2 | Pendente |

### Admin do Sistema (`pages/adminSistema/`) — 20 páginas

| Página | Prioridade | Estado |
|---|---|---|
| `DueDiligence.jsx` | 1 | **Migrado** |
| `PlatformFees.jsx` | 1 | **Migrado** |
| `Companies.jsx` | 2 | Pendente |
| `Contracts.jsx` | 2 | Pendente |
| `Cobrancas.jsx` | 2 | Pendente |
| `Home.jsx` | 2 | Pendente |
| `Administradores.jsx` | 3 | Pendente |
| `Permissions.jsx` | 3 | Pendente |
| `PolicyManagement.jsx` | 3 | Pendente |
| `ErpIntegrations.jsx` | 3 | Pendente |
| `AuditTrail.jsx` | 3 | Pendente |
| `SecurityAlerts.jsx` | 3 | Pendente |
| `Plans.jsx` | 3 | Pendente |
| `SupplierDev.jsx` | 3 | Pendente |
| `Prontidao.jsx` | 3 | Pendente |
| `Avaliacoes.jsx` | 3 | Pendente |
| `DescontosEconomiaEscala.jsx` | 3 | Pendente |
| `SolicitarSerie.jsx` | 3 | Pendente |
| `SystemActivities.jsx` | 3 | Pendente |

### Corporativo (`pages/corporate/`) — 6 páginas

| Página | Prioridade | Estado |
|---|---|---|
| `CorporateHome.jsx` | 4 | Pendente |
| `CorporateChrome.jsx` | 4 | Pendente |
| `Noticias.jsx` | 4 | Pendente |
| `Carreiras.jsx` | 4 | Pendente |
| `Faq.jsx` | 4 | Pendente |
| `Recursos.jsx` | 4 | Pendente |

## Pendências transversais (não são "páginas", mas são pré-requisitos de várias)

| Item | Nota |
|---|---|
| **i18n (PT/EN/FR)** | O sistema `frontend/src/i18n/` (dicionários + `useI18n`) ainda não foi portado. Os ecrãs migrados mostram texto directamente em português (a língua-fonte do dicionário original) — nenhuma tradução foi perdida, só ainda não há troca de idioma em Angular. |
| **Barra lateral completa (`AppLayout.jsx` + `data/sidebar.js`)** | O `ShellComponent` actual é uma casca mínima (barra superior + logout). A navegação lateral por persona, com todos os ícones e badges de notificação, ainda não foi portada. |
| **Tempo real (Socket.IO / STOMP)** | `frontend/src/realtime/{RealtimeContext,socketioAdapter,stompAdapter}.jsx` — necessário para Chat Comercial e Suporte. Ainda não portado para Angular; útil portar o adaptador STOMP primeiro, já que o Java é o backend definitivo. O botão "Falar com o fornecedor/comprador" (`StartConversationButton`) foi omitido em `ItemDetail` e `OrderDetail` por esta mesma razão — nada mais foi removido dessas páginas. |
| **Capacitor (app móvel)** | A app móvel actual empacota o **frontend React** (`frontend/capacitor.config.json`). Só deve mudar para empacotar o Angular depois de a cobertura de páginas ser suficiente — ver secção "Node/Vite" abaixo. |
| **Biblioteca de ícones completa** | 15 ícones portados (`shared/components/icon.component.ts`) — os usados por auth, cotações, catálogo e ordens. O ficheiro original tem dezenas (categorias, módulos de outras personas). Um nome não portado cai em `box`, o mesmo comportamento do React para um nome desconhecido. |

## O que ainda depende do Node.js hoje

Nada no frontend Angular depende do Node — fala directamente com o backend
Java (`proxy.conf.mjs` aponta para a porta 4001 por omissão). O que continua
em Node.js, e porquê, está descrito na secção seguinte deste relatório
("O que ainda depende do Node.js").

## Como continuar esta migração

1. Escolher o próximo domínio pela tabela de prioridade acima. Toda a
   prioridade 1 está migrada excepto `fornecedor/CatalogManage.jsx`
   (formulário grande — 754 linhas, taxonomia Oil & Gas completa; sugestão
   para a próxima sessão, sozinha, dado o tamanho). Dentro da prioridade 2,
   `comprador/{Deliveries,Receptions}.jsx` já estão migrados. Candidatos com
   bom custo/benefício para continuar: `companyAdmin/{Users,Organization,
   CompanyProfile}.jsx` (gestão da própria empresa — ainda nenhuma página
   Angular no domínio Company Admin fora de Aprovações/Contratos), ou as
   páginas `Home.jsx` de cada persona (painéis iniciais — Comprador,
   Fornecedor, Company Admin, Financeiro, Admin do Sistema já têm o resto
   do domínio a funcionar, mas
   continuam a cair em `PendingPageComponent` ao entrar na área).
2. Para cada página: ler o `.jsx` original por completo, confirmar as
   chamadas de API reais (nunca assumir pelo nome do ficheiro), portar
   modelo → serviço → componente → template, escrever testes, e só depois
   apagar... não, **nunca apagar** a página React equivalente nesta fase —
   isso só acontece no cutover final desse domínio (ver regra 11 do pedido
   original: não remover Node/Vite antes de confirmar que nada depende
   deles).
3. Quando um domínio inteiro (todas as páginas de uma persona) estiver
   migrado E testado, é o momento de considerar apontar essa persona para o
   Angular em produção — decisão a tomar explicitamente, não implícita.
