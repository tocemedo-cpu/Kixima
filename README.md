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

## O produto em uma frase

O fornecedor é pago em **≤ 7 dias** após aceitar a encomenda — a KIXIMA
garante o pagamento e cobra o cliente. O fluxo end-to-end (emissão →
aprovação → aceitação → fatura → pagamento → despacho → receção → conclusão),
contratos-quadro/call-offs e apólices estão descritos nos READMEs de cada
aplicação.

## Segurança

Nunca faças commit de `backend/.env.development` / `.env.production` — contêm
segredos reais (já ignorados pelo `.gitignore`). Usa `.env.example` como modelo.
