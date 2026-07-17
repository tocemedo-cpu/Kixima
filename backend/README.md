# KIXIMA — Backend (MVP)

E-market com pagamento garantido para o setor Petrolífero e Gás (Angola/África).
Backend em Node.js + Express + PostgreSQL (Prisma), implementando o fluxo
funcional descrito em `kixima-especificacao-funcional.md`.

## Stack

- **Runtime**: Node.js + Express
- **Base de dados**: PostgreSQL via Prisma ORM
- **Autenticação**: JWT (`jsonwebtoken` + `bcryptjs`)
- **Validação**: Zod
- **Jobs**: `node-cron` (alerta de expiração de apólice)

## Estrutura

```
prisma/
  schema.prisma        # modelo de dados completo
  seed.js               # dados de exemplo (5 personas)
src/
  config/               # env.js (já existente), database.js, logger.js
  middleware/            # auth.js (JWT), rbac.js (5 personas), errorHandler.js
  routes/                 # 1 ficheiro de rotas por módulo
  controllers/            # fino — delega tudo aos services
  services/                # regras de negócio (poService é o núcleo)
  jobs/                    # cron jobs
  utils/                    # erros, validação, referências (PO-2026-000123, etc.)
  app.js                    # montagem da app Express
  server.js                 # arranque do processo
```

## Como correr localmente

```bash
npm install

# O .env.development já está apontado para o projeto Supabase
# mhonwkmmjngvnjpdvqhk — só falta substituir [DB-PASSWORD] pela password
# real da base de dados (dashboard -> Project Settings -> Database).
#
# Se ainda não correu o script de criação das tabelas nesse projeto,
# faça-o primeiro: cole prisma/supabase_setup.sql no SQL Editor do
# dashboard do Supabase e execute.

npx prisma generate
npm run seed                 # popula dados de exemplo (5 personas + catálogo)

npm run dev                   # arranca em http://localhost:4000
```

Utilizadores de teste criados pelo seed (password: `Kixima@123`):

| Persona | Email |
|---|---|
| Comprador | comprador@petroangola.co.ao |
| Company Admin | admin@petroangola.co.ao |
| Financeiro | financeiro@petroangola.co.ao |
| Fornecedor | fornecedor@kianda.co.ao |
| Admin do Sistema KIXIMA | admin@kixima.co.ao |

## Fluxo principal (end-to-end)

Implementado em `src/services/poService.js`, espelhando a secção 3 da especificação:

1. `POST /api/purchase-orders` — Comprador monta a cesta e emite a PO.
   - Deteta automaticamente se existe contrato-quadro ativo cobrindo o
     fornecedor/categorias → marca a PO como **Call-off** (`contractService`).
2. `PATCH /api/purchase-orders/:id/approve` — Company Admin aprova (ponto único
   de aprovação). Call-offs saltam este passo.
3. `PATCH /api/purchase-orders/:id/accept` — Fornecedor aceita.
4. Ao aceitar, o sistema gera a fatura automaticamente e o **relógio dos 7
   dias** (`PAYMENT_SLA_DAYS`) começa a contar. Call-offs não geram fatura
   individual — são faturados de forma consolidada (`POST
   /api/contracts/:id/consolidate-billing`).
5. `POST /api/payments/invoices/:invoiceId/pay` — Financeiro paga com fundos
   do cliente, dentro do prazo. O Financeiro executa, não decide.
6. `PATCH /api/purchase-orders/:id/dispatch` — Fornecedor só pode despachar
   depois do pagamento confirmado (validado no service).
7. `PATCH /api/purchase-orders/:id/reception` — Comprador confirma receção ou
   reporta divergência (o que dispara o aviso de "caso a acompanhar fora da
   plataforma" ao Admin do Sistema KIXIMA — sinistros não são processados
   pela plataforma).
8. Receção conforme → sistema fecha a ordem automaticamente (`CONCLUIDA`).

## Apólices (`src/services/policyService.js`)

- **Fornecedor → KIXIMA**: submetida pelo próprio fornecedor no onboarding
  (`POST /api/policies/supplier-to-kixima`). Condição para o Admin do Sistema
  aprovar o cadastro (`companyService.decideCompanyStatus` valida isto).
- **KIXIMA → Cliente**: emitida pelo Admin do Sistema após due diligence
  (`POST /api/policies/kixima-to-client/:companyId`), com escopo por empresa.
- Alerta de expiração 30 dias antes: `src/jobs/policyExpiryJob.js`, corrido
  diariamente via cron.

## Notificações (`src/services/notificationService.js`)

Implementa a tabela da secção 6 da especificação — um evento de negócio, uma
função. Canal `IN_APP`, `EMAIL` ou `IN_APP_EMAIL` conforme a regra. O
provider de email é plugável (`EMAIL_PROVIDER=console` no MVP regista em
log; trocar por SMTP real sem tocar no resto do código).

## Contratos e Call-offs (`src/services/contractService.js`)

- `findActiveContractForOrder` — chamado no checkout para detetar
  automaticamente se a PO deve virar Call-off.
- `consolidateContractBilling` — soma as call-offs "por faturar" de um
  contrato e gera uma única fatura consolidada, com o prazo de pagamento do
  próprio contrato (não os 7 dias padrão).

## Segurança / RBAC

5 personas (`PersonaRole` no schema): `COMPRADOR`, `COMPANY_ADMIN`,
`FORNECEDOR`, `FINANCEIRO`, `ADMIN_SISTEMA`. Middleware `requireRole(...)`
em cada rota; `ADMIN_SISTEMA` é interno à KIXIMA e não pertence a nenhuma
empresa transacionadora (`companyId: null`).

## Fora de escopo do MVP

Conforme a secção 7 da especificação, o schema já guarda dados granulares
(cada transação, fatura, pagamento) para suportar evolução futura para ERP,
mas **não expõe** relatórios avançados (DRE, Balanço, EBITDA, auditoria
completa, etc.) — isso fica para uma fase posterior.

## Testes automatizados

Testes de integração em Jest + Supertest, que exercitam a API real (via
`src/app.js`, sem abrir porta) contra uma base de dados de teste.

```bash
# Precisa de um PostgreSQL acessível. Por omissão os testes usam
#   postgresql://kixima:kixima@127.0.0.1:5432/kixima_test
# Podes sobrepor com a variável DATABASE_URL (ex.: em CI).
createdb kixima_test          # ou cria a base de dados como preferires
npm test
```

Antes de toda a suite, `tests/globalSetup.js` repõe o schema
(`prisma db push --force-reset`) e corre o seed. Cobertura atual:

- **`auth.test.js`** — login válido/ inválido, proteção de rotas por token.
- **`po-flow.test.js`** — fluxo completo até `CONCLUIDA`, fatura + relógio dos
  7 dias na aceitação, despacho bloqueado antes do pagamento, divergência.
- **`rbac.test.js`** — cada persona só faz o que lhe compete.
- **`calloff.test.js`** — PO coberta por contrato-quadro vira Call-off e salta
  a aprovação individual.

## Próximos passos sugeridos

- Upload de documentos (apólices, certificados) para `STORAGE_PROVIDER=s3`.
- Provider de email real (SMTP/SES) em `notificationService.dispatchEmail`.
- Paginação nas listagens (`GET /api/purchase-orders`, `/api/catalog`, etc.).
