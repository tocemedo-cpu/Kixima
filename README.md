# KIXIMA

E-market com **pagamento garantido** para o setor Petrolífero & Gás (Angola / África).

Monorepo com duas aplicações:

| Pasta | Stack | Descrição |
|---|---|---|
| [`backend/`](./backend) | Node.js + Express + Prisma (PostgreSQL/Supabase) | API REST, regras de negócio, RBAC de 5 personas, jobs |
| [`frontend/`](./frontend) | React 18 + Vite + React Router | Consola operacional com as telas das 5 personas |

## Arranque rápido (desenvolvimento)

Precisas de **dois terminais**.

### 1. Backend — `http://localhost:4000`

```bash
cd backend
npm install
# Copia .env.example para .env.development e preenche DATABASE_URL + JWT_SECRET.
# Se ainda não criaste as tabelas: cola prisma/supabase_setup.sql no SQL Editor
# do Supabase e executa.
npx prisma generate
npm run seed        # 5 personas de demonstração + catálogo
npm run dev
```

### 2. Frontend — `http://localhost:5173`

```bash
cd frontend
npm install
npm run dev         # proxy de /api -> localhost:4000
```

Utilizadores de demonstração (password `Kixima@123`) — a página de login tem
atalhos para preencher cada persona:

| Persona | Email |
|---|---|
| Comprador | comprador@petroangola.co.ao |
| Company Admin | admin@petroangola.co.ao |
| Financeiro | financeiro@petroangola.co.ao |
| Fornecedor | fornecedor@kianda.co.ao |
| Admin do Sistema KIXIMA | admin@kixima.co.ao |

## Correr com Docker (stack completa)

Com Docker instalado, uma linha sobe Postgres + backend + frontend:

```bash
docker compose up --build
```

- Frontend: **http://localhost:8080** (Nginx serve o build e faz proxy de `/api`)
- Backend: **http://localhost:4000**
- Postgres: serviço interno `db` (dados persistidos no volume `pgdata`)

O backend aplica o schema (`prisma db push`) no arranque. Para popular os dados
de demonstração uma vez:

```bash
docker compose exec backend node prisma/seed.js
```

Em produção define `JWT_SECRET` e `DB_PASSWORD` como variáveis de ambiente reais
(o compose lê `${JWT_SECRET}` / `${DB_PASSWORD}` e só usa valores locais por
omissão).

## Deploy (Render + Supabase)

`render.yaml` define um **serviço único**: o backend serve a API em `/api` **e** o
frontend compilado (SPA) na mesma origem — sem CORS nem proxy. A base de dados é
o teu **Supabase** (a `DATABASE_URL` é definida no dashboard como segredo, nunca
no repositório).

1. Sobe o repositório para o GitHub.
2. Render → **New → Blueprint** → aponta para o repo (usa o `render.yaml`).
3. No serviço, em **Environment**, define `DATABASE_URL` com a connection string
   do **pooler** do Supabase (Session mode, porta 5432, `?sslmode=require`).
   O `JWT_SECRET` é gerado automaticamente.
4. Deploy — o build compila o frontend e `prisma db push` cria as tabelas.
5. (Opcional) popular dados de exemplo, na Shell do serviço: `cd backend && npm run seed`.

O mesmo funciona em qualquer host Node (Railway, Fly, VM): faz o build do
frontend, define `FRONTEND_DIST=../frontend/dist` + `DATABASE_URL` + `JWT_SECRET`
e arranca `node backend/src/server.js`.

> As imagens carregadas ficam em disco local (efémero em muitos hosts). Para
> produção a sério, usa um disco persistente ou um bucket S3.

## Integração contínua

`.github/workflows/ci.yml` corre em cada push/PR:

- **backend-tests** — sobe um Postgres de serviço e corre a suite Jest + Supertest.
- **frontend-build** — instala e faz o build de produção do Vite.

## O produto em uma frase

O fornecedor é pago em **≤ 7 dias** após aceitar a encomenda — a KIXIMA
garante o pagamento e cobra o cliente. O fluxo end-to-end (emissão →
aprovação → aceitação → fatura → pagamento → despacho → receção → conclusão),
contratos-quadro/call-offs e apólices estão descritos nos READMEs de cada
aplicação.

## Segurança

Nunca faças commit de `backend/.env.development` / `.env.production` — contêm
segredos reais (já ignorados pelo `.gitignore`). Usa `.env.example` como modelo.
