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

### 3. Define a base de dados (segredo)
No serviço criado → **Environment** → a variável `DATABASE_URL` está marcada como
"a definir". Cola a string do **pooler** do Supabase (Session mode, porta 5432):

```
postgresql://postgres.zbaybvxycwkyjkndjhly:A_TUA_DB_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
```

> Substitui `A_TUA_DB_PASSWORD` pela tua Database password. **Não** a ponhas no
> `render.yaml` nem no git — só neste campo do dashboard.

O `JWT_SECRET` é **gerado automaticamente** pelo Render. As restantes variáveis já
vêm definidas no `render.yaml`.

### 4. Deploy
Clica **Create / Deploy**. O build:
- compila o frontend (`vite build`),
- gera o Prisma Client,
- e no arranque corre `prisma db push` → **cria as tabelas no teu Supabase**.

Quando ficar "Live", abre o URL do serviço (algo como `https://kixima.onrender.com`).

### 5. (Opcional) Dados de exemplo
No serviço → **Shell**:
```bash
cd backend && npm run seed:demo
```
Isto cria as 5 personas de demonstração + catálogo, ordens, faturas e documentos (password `Kixima@123`) e um catálogo base.

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
- **Rastreio de erros (Sentry):** cria um projeto no Sentry e define, no Render →
  Environment, `SENTRY_DSN` (backend). Para o browser, define também o build-arg
  `VITE_SENTRY_DSN` (frontend). Sem estas variáveis o rastreio fica desligado e a
  app corre normalmente; com elas, os erros de servidor (5xx) e as falhas de UI
  passam a ser reportados automaticamente.
