# Deploy da KIXIMA (Render + Supabase)

Coloca a plataforma online num **serviço único**: o backend serve a API em `/api`
**e** o frontend compilado (SPA) na mesma origem — sem CORS nem proxy. A base de
dados é o teu **Supabase** (projeto `zbaybvxycwkyjkndjhly`).

O blueprint está em [`render.yaml`](./render.yaml).

## Pré-requisitos
- O código no **GitHub** (este repositório).
- Conta gratuita em [render.com](https://render.com) ligada ao teu GitHub.
- A **connection string** do teu Supabase (pooler) e a **Database password**.

## Passos

### 1. Garante o código no GitHub
Faz merge desta branch para `main` (ou usa a branch que tem o código ao criar o
blueprint):
```bash
git checkout main && git merge claude/kixima-app-work-gmz6jk && git push origin main
```

### 2. Cria o serviço no Render
1. Render → **New → Blueprint**.
2. Seleciona este repositório (e a branch com o código).
3. O Render lê o `render.yaml` e propõe um web service chamado **kixima**. Confirma.

### 3. Define a base de dados (segredos)
No serviço → **Environment**. Define **duas** variáveis, ambas com o host do
**pooler** (`...pooler.supabase.com`, IPv4). Copia-as em Supabase → Project
Settings → Database → **Connect**:

```
# App — Transaction pooler (porta 6543):
DATABASE_URL=postgresql://postgres.zbaybvxycwkyjkndjhly:A_TUA_DB_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true

# Migrações — Session pooler (porta 5432, MESMO host do pooler):
DIRECT_URL=postgresql://postgres.zbaybvxycwkyjkndjhly:A_TUA_DB_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require
```

> ⚠️ **Não uses** o host direto `db.<ref>.supabase.co:5432` — é **só IPv6** e no
> Render dá `P1001: Can't reach database server`. Usa sempre o host `pooler`.
> Substitui `A_TUA_DB_PASSWORD` pela tua Database password (só no dashboard, nunca no git).

O `JWT_SECRET` é **gerado automaticamente** pelo Render. As restantes variáveis já
vêm definidas no `render.yaml`.

### 4. Deploy
Clica **Create / Deploy**. O build:
- compila o frontend (`vite build`),
- gera o Prisma Client,
- e no arranque corre **`prisma migrate deploy`** → aplica as migrações versionadas
  (pasta `backend/prisma/migrations`) à base de dados, pela ligação DIRETA (`DIRECT_URL`).

Quando ficar "Live", abre o URL do serviço (algo como `https://kixima.onrender.com`).

### 4b. Migrações (Supabase) — passo único de baseline ⚠️
O projeto usa **migrações Prisma** (SQL versionado, seguro) em vez de `db push`.
A app usa o **pooler de transação** (`DATABASE_URL`, porta 6543) e as migrações o
**pooler de sessão** (`DIRECT_URL`, porta 5432) — ambos no host `...pooler.supabase.com`
(IPv4). Nunca o host direto `db.<ref>.supabase.co` (IPv6, dá `P1001`). Ver secção 3.

Como a tua base **já tinha as tabelas** (criadas por `db push`), a 1ª execução do
`migrate deploy` daria `P3005 (schema not empty)`. O arranque **trata disto
automaticamente** (auto-baseline): se apanhar o P3005, faz `prisma migrate
resolve --applied 0_init` e volta a correr o `migrate deploy`. Ou seja, **basta
fazer deploy** — não precisas de correr nada à mão.

> Se preferires fazer o baseline manualmente (ex.: local com o `DIRECT_URL` do
> Supabase): `cd backend && npm run migrate:baseline`.

A partir daí, cada nova migração aplica-se sozinha no deploy.

**Fluxo de futuras alterações ao esquema:** altera `schema.prisma`, gera a migração
(`npx prisma migrate dev --name a_minha_alteracao` em local com `DIRECT_URL`), faz
commit da pasta `prisma/migrations/…` e deploy — o `migrate deploy` aplica-a.
Confirma o estado com `npm run migrate:status`.

### 5. (Opcional) Dados de exemplo — OPT-IN
Os dados de demonstração **nunca entram sozinhos** em produção: o arranque só
carrega o catálogo fictício (fornecedor "Catálogo KIXIMA (Demonstração)" + 119
itens) se a variável `LOAD_DEMO_CATALOG=1` estiver definida no Render.

- **Para um piloto/testes:** define `LOAD_DEMO_CATALOG=1` no Environment e faz
  deploy — o catálogo de demonstração (re)carrega a cada arranque (idempotente).
- **Para produção real:** não definas a variável (ou remove-a) e, para limpar os
  dados de demonstração já carregados antes desta mudança, corre no Shell:
  ```bash
  cd backend && npm run demo:remove
  ```
  (apaga o fornecedor fictício e os seus produtos; os que já estiverem
  referenciados por ordens reais são apenas desativados, preservando o histórico).
- **Personas de teste completas** (5 utilizadores, ordens, faturas — password
  `Kixima@123`), só para ambientes de teste: `cd backend && npm run seed:demo`.

## Variáveis de ambiente (já no `render.yaml`, exceto o segredo)
| Variável | Valor | Notas |
|---|---|---|
| `DATABASE_URL` | *(segredo, no dashboard)* | string do pooler Supabase |
| `JWT_SECRET` | *(auto-gerado)* | segredo de assinatura dos tokens da app |
| `NODE_ENV` | `production` | |
| `FRONTEND_DIST` | `../frontend/dist` | faz o backend servir o SPA |
| `PAYMENT_SLA_DAYS` | `7` | prazo de pagamento |
| `POLICY_EXPIRY_ALERT_DAYS` | `30` | alerta de apólice |
| `EMAIL_PROVIDER` | `console` | troca por `smtp` + credenciais para email real |

### Modelo comercial (Taxa KIXIMA e planos)
As taxas são definidas **em dólares**; as POs e faturas continuam em Kwanzas. O
câmbio serve apenas para aferir o limiar dos 0,20% e fica **gravado em cada
taxa**, para o histórico não mudar quando o câmbio mudar.

| Variável | Valor por omissão | O que faz |
|---|---|---|
| `KIXIMA_FEE_PER_PO_USD` | `8` | taxa fixa por ordem de compra (até ao limiar) |
| `KIXIMA_FEE_PER_INVOICE_USD` | `15` | taxa fixa por fatura |
| `KIXIMA_FEE_THRESHOLD_USD` | `11500` | limiar por transação |
| `KIXIMA_FEE_PERCENT_ABOVE` | `0.002` | 0,20% — **substitui** o valor fixo acima do limiar |
| `KIXIMA_USD_AOA_RATE` | `900` | câmbio USD→AOA para aferir o limiar — **atualiza-o quando o Kwanza mudar** |
| `KIXIMA_SEAT_PRICE_CAP_USD` | `100` | teto da taxa de acesso por utilizador/mês (plano Básico) |

**Planos:** `BASICO` (micro/pequenas/médias) e `PRO` (obrigatório para grandes
empresas; inclui a integração com ERPs — SAP, AS400, Ariba, Maximo, Oracle). A
dimensão é declarada no cadastro (nº de trabalhadores e volume de negócios),
classificada automaticamente pelo critério MPME e confirmada pelo Admin do
Sistema em **Planos e Subscrições**.

## Notas de produção
- **Imagens de produtos (persistência):** por omissão ficam em disco local, que
  no plano free do Render é **efémero** (perde-se em cada deploy). Para
  persistirem, usa o **Supabase Storage** (S3-compatível, já tens Supabase):
  1. Supabase → Storage → cria um bucket **público** `product-images`.
  2. Storage → Settings → **S3 Connection**: ativa e copia Access key / Secret.
  3. No Render → Environment, acrescenta:
     ```
     STORAGE_PROVIDER=s3
     STORAGE_BUCKET=product-images
     STORAGE_REGION=eu-central-1
     STORAGE_ENDPOINT=https://zbaybvxycwkyjkndjhly.supabase.co/storage/v1/s3
     STORAGE_PUBLIC_URL=https://zbaybvxycwkyjkndjhly.supabase.co/storage/v1/object/public/product-images
     STORAGE_ACCESS_KEY=...   (segredo)
     STORAGE_SECRET_KEY=...   (segredo)
     STORAGE_FORCE_PATH_STYLE=true
     ```
  4. **Verifica** a configuração (no Shell do serviço):
     ```bash
     cd backend && npm run storage:check
     ```
     Deve enviar um objeto de teste e confirmar `HTTP 200` no URL público.
  A partir daí, as fotos carregadas pelos fornecedores (incluindo a importação
  em massa **Catálogo → Importar (Excel)**) ficam guardadas no Supabase e
  sobrevivem aos deploys. Nota: as imagens do catálogo de demonstração vão no
  próprio build (pasta `catalog/`), pelo que já persistem sem Storage.
- **Segurança:** roda a Database password e quaisquer chaves que tenham sido
  partilhadas em texto.
- **Domínio próprio:** podes ligar `app.kixima.co.ao` em Settings → Custom Domains.
- **Email real:** define `EMAIL_PROVIDER=smtp` + `SMTP_*` para as notificações
  saírem por email em vez de irem só para o log.
- **Rastreio de erros (Sentry):**
  1. Cria conta em sentry.io → **Create Project** → plataforma **Node.js** (dá o
     DSN do backend) e outra **React** (dá o DSN do frontend). Copia cada DSN
     (`https://…@…ingest.sentry.io/…`).
  2. No Render → Environment: `SENTRY_DSN` = DSN do Node; e o **build-arg**
     `VITE_SENTRY_DSN` = DSN do React (é embutido no build do frontend).
  3. **Verifica** o backend (no Shell do serviço): `cd backend && npm run sentry:test`
     → deve aparecer um issue em Sentry → Issues. O frontend confirma-se quando
     ocorrer um erro real (o `ErrorBoundary` mostra o ecrã de recurso e reporta).

  Sem estas variáveis o rastreio fica desligado e a app corre normalmente; com
  elas, os erros de servidor (5xx) e as falhas de UI passam a ser reportados.
