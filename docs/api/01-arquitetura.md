# 01 · Arquitetura

> Baseado na leitura do código (`backend/src/app.js`, `server.js`, `render.yaml`, `Dockerfile`). Nada foi executado. Referências no formato `ficheiro:linha` são relativas à raiz do repositório.

## 1. Componentes do monorepo

| Pasta | O que é | Papel na API |
|---|---|---|
| `backend/` | Node 20 + Express 4 + Prisma + Zod + Socket.IO + `node-cron` | **API de referência**: 247 operações HTTP em 34 ficheiros de rotas, 71 services, 6 jobs agendados. É o que corre no serviço `kixima` do `render.yaml`. |
| `backend-java/` | Spring Boot 3.3 / Java 21 | Porta da mesma API (45 controllers, 247 mapeamentos), com STOMP em vez de Socket.IO. Serviço `kixima-java` no `render.yaml`. Ver [10](10-frontend-java-e-integration-service.md). |
| `frontend/` | React 18 + Vite + react-router 7, i18n PT/EN/FR | SPA. Em produção é servida pelo próprio processo do backend (`backend/src/middleware/frontend.js`), por isso API e SPA partilham a origem. |
| `kixima-integration-service/` | Microserviço (NestJS/BullMQ/RabbitMQ) | Consome eventos do KIXIMA e fala com ERPs de clientes; devolve decisões por `POST /api/integration/callback`. |
| `docs/migracao-java/` | Documentação da migração Node → Java | Contexto do `backend-java/`. |

## 2. Camadas do backend Node

```
HTTP ──► app.js (middleware global) ──► routes/*.js ──► [controllers/*.js] ──► services/*.js ──► Prisma ──► PostgreSQL (Supabase)
                                              │                                    │
                                              │                                    ├──► storageService (S3 / disco)
                                              │                                    ├──► notificationService (Brevo / SMTP / console)
                                              │                                    ├──► agt*Service (AGT, e-Fatura/SAF-T)
                                              │                                    ├──► eventBus (RabbitMQ) ──► kixima-integration-service ──► ERP
                                              │                                    └──► realtimeService (Socket.IO)
                                              └─ validate(zod) · authenticate · requireRole · requirePermission
```

- Só 8 dos 34 routers usam `controllers/`; nos restantes os *handlers* são inline e chamam o service directamente.
- A **autorização por empresa/posse** (quem pode ver ou alterar *este* registo) é feita **dentro dos services**, não em middleware. `requireSameCompany` (`middleware/rbac.js`) existe mas nunca é usado ([07](07-seguranca.md), SEG-27).
- Os `Decimal` do Prisma saem em JSON como **string**.
- Todo `findMany` sem `take` é cortado a 1000 linhas por uma extensão do cliente Prisma (`config/database.js`), com apenas uma linha de erro no log (ver [05](05-base-de-dados-supabase.md) e [grupos/C](grupos/C-admin-e-relatorios.md)).

## 3. Pipeline de cada pedido (ordem real em `backend/src/app.js`)

1. `helmet` + CSP (`config/csp.js`).
2. `cors` com lista de origens e `credentials: true` (`config/cors.js`).
3. `cookieParser`, `express.json` (guarda `rawBody` para o HMAC do callback ERP).
4. `/api/uploads` (ficheiros locais, com controlo de posse só em modo `local`) e `morgan` (registo de acessos).
5. `GET /health`, `GET /ready` (sem autenticação, sem *rate limit*).
6. `apiLimiter` em `/api/` (600 pedidos / 15 min, por utilizador ou IP).
7. Limitadores específicos: `authLimiter` (login, `2fa/verify`, `reset-password`), `forgotPasswordLimiter`, `sensitiveLimiter` (`companies/register`, `companies/invite`, `admin/invite`).
8. Routers `/api/*` (cada um aplica `authenticate`, papéis e `validate`).
9. **Modo de lançamento / SPA** (`middleware/frontend.js`): com `frontend/public/launch.json` `enabled:true`, tudo o que não é API recebe a página «Estamos a chegar em breve», excepto quem tem o cookie de equipa (`LAUNCH_BYPASS_KEY`). A API e os serviços internos não são bloqueados.
10. `notFoundHandler` (404 `ROUTE_NOT_FOUND`) e `errorHandler` (envelope `{error:{code,message}}`).

## 4. Frontend ↔ backend ↔ base de dados

```
Browser (React SPA)
   │  `fetch` (frontend/src/api/client.js) com cookie httpOnly `kixima_sessao` (ou Bearer na app móvel Capacitor)
   ▼
Backend Node ── Prisma ──► Supabase Postgres (pooler 6543 para a app; 5432 para migrações e pg_dump)
   │                       Supabase Storage (S3-compatível) para ficheiros em produção
   ├─ Socket.IO /socket.io  ◄── frontend/src/realtime/RealtimeContext.jsx
   ├─ RabbitMQ (opcional)   ──► kixima-integration-service ──► ERP do cliente
   ├─ Brevo (API HTTP)      ──► emails
   ├─ AGT (HML/PRD)         ──► e-Fatura (registo de documentos, séries)
   └─ Anthropic API         ──► recomendações do Category Management (opcional)
```

- O Supabase é usado **apenas como Postgres e Storage S3**. Não há Supabase Auth, nem RLS, nem `supabase-js` ([05](05-base-de-dados-supabase.md), secção 4).
- O mapa «módulo do frontend → endpoints que consome» e as chamadas do SPA sem endpoint correspondente estão em [10](10-frontend-java-e-integration-service.md), secção C.

## 5. Tarefas agendadas (`backend/src/server.js:57-62`)

| Job | Ficheiro | Função |
|---|---|---|
| Expiração de apólices | `jobs/policyExpiryJob.js` | Marca/avisa apólices expiradas |
| Expiração de subscrições | `jobs/subscriptionExpiryJob.js` | Fecha subscrições/add-ons vencidos |
| Cópia de segurança | `jobs/backupJob.js` | `pg_dump` para bucket privado (opt-in, `BACKUP_CRON`) |
| Lembrete de 2FA | `jobs/mfaLembreteJob.js` | Avisa quem ainda não activou a 2FA |
| Retenção de dados | `jobs/retencaoJob.js` | Limpeza segundo a política de retenção (`GET /api/retencao`) |
| PO Robot | `jobs/poRoboJob.js` | Cria POs automáticas a partir de regras (06:00) |

Horários exactos e funções estão em [05](05-base-de-dados-supabase.md), secção 8. **Não existe job que aplique o prazo de pagamento de 7 dias** ([09](09-fluxos-de-negocio.md), achado A6).

## 6. Deploy descrito no repositório

`render.yaml` define dois serviços *web* Docker: `kixima` (`Dockerfile` da raiz, Node, `healthCheckPath: /ready`) e `kixima-java` (`backend-java/Dockerfile`). O `kixima-integration-service/` tem o seu próprio `render.yaml`. Que serviço do painel do Render corresponde a cada um **não é visível no repositório**.
