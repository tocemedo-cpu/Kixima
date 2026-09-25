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

**Verificação ao vivo desta etapa** (Postgres + backend Java a correr localmente, Angular com o seu proxy): login como Comprador → pesquisa no catálogo → produto → cesta → checkout (gera PO) → lista de ordens com KPIs → detalhe da PO → aprovação pelo Company Admin → aceitação pelo Fornecedor (gera fatura com os campos AGT presentes, correctamente vazios sem credenciais) → guarda de máquina de estados (despachar antes de pago devolve 400) → fluxo de rejeição com motivo. RBAC confirmado com 403 em cada ponto errado: Comprador não aprova nem aceita a própria PO, Fornecedor não aprova, Fornecedor não lê `/api/buyer/orders` (403), pedido sem sessão dá 401. Um bug de routing desta sessão anterior foi encontrado e corrigido: a rota de Cotações do Comprador estava em `/comprador/pedidos`, mas a real (`frontend/src/App.jsx:191`) é `/comprador/cotacoes` — nunca teria sido alcançável pela navegação real da aplicação.

## Inventário completo das 97 páginas React e prioridade sugerida

Prioridade: **1** = fluxo comercial crítico (dinheiro/AGT), **2** = operação
diária de alto uso, **3** = administração/configuração, **4** = conteúdo
estático/ajuda. Dentro de cada prioridade, a ordem é a recomendada.

### Partilhadas (`pages/shared/`) — 21 páginas

| Página | Prioridade | Estado |
|---|---|---|
| `LoginPage.jsx` | 1 | **Migrado** |
| `Register.jsx` | 1 | Pendente |
| `AcceptInvite.jsx` | 1 | Pendente |
| `AcceptAdminInvite.jsx` | 1 | Pendente |
| `PasswordReset.jsx` | 1 | Pendente |
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
| `Payments.jsx` | 1 | Pendente |
| `Deliveries.jsx` | 2 | Pendente |
| `Receptions.jsx` | 2 | Pendente |
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
| `OrdersReceived.jsx` | 1 | Pendente |
| `Invoices.jsx` | 1 | Pendente |
| `Payments.jsx` | 1 | Pendente |
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
| `Approvals.jsx` | 1 | Pendente |
| `Contracts.jsx` | 1 | Pendente |
| `Assinatura.jsx` | 2 | Pendente |
| `Home.jsx` | 2 | Pendente |
| `Users.jsx` | 2 | Pendente |
| `Organization.jsx` | 2 | Pendente |
| `CompanyProfile.jsx` | 2 | Pendente |
| `CompanyDocuments.jsx` | 3 | Pendente |
| `Permissions.jsx` | 3 | Pendente |
| `Reports.jsx` | 3 | Pendente |
| `ConteudoLocal.jsx` | 3 | Pendente |
| `Activities.jsx` | 3 | Pendente |
| `Settings.jsx` | 3 | Pendente |

### Financeiro (`pages/financeiro/`) — 3 páginas

| Página | Prioridade | Estado |
|---|---|---|
| `PendingInvoices.jsx` | 1 | Pendente |
| `PaymentHistory.jsx` | 1 | Pendente |
| `Home.jsx` | 2 | Pendente |

### Admin do Sistema (`pages/adminSistema/`) — 20 páginas

| Página | Prioridade | Estado |
|---|---|---|
| `DueDiligence.jsx` | 1 | Pendente |
| `PlatformFees.jsx` | 1 | Pendente |
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

1. Escolher o próximo domínio pela tabela de prioridade acima. O percurso de
   compra do Comprador (Catálogo → Cesta → Checkout → Ordens) já está
   completo nesta sessão; sugestão para a próxima: **Faturação e Pagamentos
   do Fornecedor** (`fornecedor/{Invoices,Payments}.jsx`, prioridade 1 —
   fecha o outro lado da mesma PO já migrada) ou **Aprovações do Company
   Admin** (`companyAdmin/Approvals.jsx`, prioridade 1 — a lista que falta
   para o detalhe já migrado de `OrderDetail`). Ambas reutilizam
   directamente `OrdersService`/`PurchaseOrderDto` já existentes.
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
