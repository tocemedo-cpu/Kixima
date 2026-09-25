# M8 — Cutover de produção Node → Java (runbook)

O que o plano pede (secção 3, marco 8): cutover **aprovado explicitamente**, com
o Node disponível como caminho de recuo durante uma janela acordada antes de
ser desactivado. Este documento é o procedimento, passo a passo, para quem o
vai executar no Render. Tudo o que aqui está foi confirmado contra o código
nesta data; o que depende de tarefas paralelas ainda por fundir, ou do painel
do Render, está marcado com **A CONFIRMAR** — não se inventa.

Produção hoje: **um** serviço web no Render, `kixima` (`render.yaml`, imagem
do `Dockerfile` da raiz), Node a servir `/api` **e** o SPA na mesma origem,
Supabase Postgres pelo pooler (`DATABASE_URL`, transacção 6543; `DIRECT_URL`,
sessão 5432). O domínio público é `kixima.net` (é o que as apps nativas usam
por omissão em `frontend/src/api/client.js`; `capacitor.config.json` não fixa
nenhum servidor, só o esquema `https`). O cutover **não muda** esse domínio —
muda o serviço que o serve.

## 0. O que esta preparação deixou feito no repositório

Cada linha era uma pré-condição em falta quando este runbook foi escrito;
todas ficaram fechadas antes de o runbook ser fundido:

1. `render.yaml` define o segundo serviço `kixima-java` (Docker,
   `dockerfilePath: ./backend-java/Dockerfile`, contexto na raiz,
   `healthCheckPath: /ready`, a mesma lista de variáveis do serviço Node,
   `JWT_SECRET` partilhado via `fromService` para as sessões sobreviverem ao
   cutover, jobs desligados). O serviço `kixima` (Node) fica intacto.
2. `backend-java/Dockerfile`: compila o SPA com `VITE_REALTIME=stomp`, empacota
   o jar (Java 21) e arranca com `SPRING_PROFILES_ACTIVE=prod`, sem root, com
   `postgresql17-client` para o `pg_dump` da cópia de segurança.
3. O Java serve o SPA (`frontend/FrontendDist`, `frontend/SpaHandlerMapping`)
   a partir de `FRONTEND_DIST`, com o mesmo fallback para `index.html` do
   Node e o 404 `ROUTE_NOT_FOUND` de `/api/*` intacto.
4. O frontend escolhe o transporte por `VITE_REALTIME` (`socketio` por
   omissão, `stomp` na imagem Java) e o proxy do Vite aponta a
   `VITE_API_TARGET` (`frontend/src/realtime/stompAdapter.js`).
5. O Java aceita a `DATABASE_URL` única do Node
   (`config/DatabaseUrlEnvironmentPostProcessor`); `DATABASE_URL_JDBC` +
   `DATABASE_USER` + `DATABASE_PASSWORD` continuam a ter precedência.
6. `.github/workflows/ci.yml` corre `backend-java-tests` (Postgres + semente
   do Node + `mvn test`).
7. `AgtPrivateKeyLoader` lê `/etc/secrets/chavePrivada.pem` e
   `/etc/secrets/AGT_JWS_PRIVATE_KEY_BASE64` pela mesma ordem do Node.

Prova disponível sem a réplica de staging: a suite e2e inteira (83 testes,
5 personas, chat por STOMP, acessibilidade) a passar contra o backend Java
com o mesmo frontend e a mesma base de demonstração — ver `M7-PARIDADE.md` §7
e o comando em §1.

## 1. Pré-condições (bloqueantes)

Nenhuma destas se dispensa. Os três primeiros são o que `AUDITORIA-PRE-M8.md` §6
e `M7-PARIDADE.md` §5 deixaram em aberto.

- [ ] **Carga contra a réplica de staging.** `pg_dump -Fc` da réplica para
  `DUMP`; base de trabalho restaurada a partir dele (nunca a réplica viva);
  depois, em `backend-java/`:
  `DUMP=/caminho/staging.dump PGHOST=… PGUSER=… PGPASSWORD=… PGDATABASE=kixima_trabalho PORTA_NODE=4000 PORTA_JAVA=4001 DURACAO=120 CONCORRENCIA=50 paridade/correr.sh carga`.
  Critério (M7 §3): zero 5xx no Java que não existam no Node; p95/p99 da mesma
  ordem de grandeza. Resultados em `paridade/gravacoes/carga-{node,java}.md`.
- [ ] **S3 de ponta a ponta** contra o bucket real: um upload de imagem de
  produto (`POST /api/catalog/{id}/image`), um comprovativo de pagamento
  (`POST /api/payments/invoices/{invoiceId}/pay`) e uma cópia de segurança
  (`POST /api/admin/backup` + `POST /api/admin/backup/verificar`) feitos pelo
  Java contra `STORAGE_BUCKET`/`STORAGE_BACKUP_BUCKET` de produção (ou cópias
  com as mesmas credenciais).
- [ ] **Configuração de produção do Java confirmada no painel**:
  `SPRING_PROFILES_ACTIVE=prod` (nunca `dev`: sem `prod` o `ProducaoStartupGuard`
  não corre, o cookie sai sem `Secure` e a *stack trace* pode fugir),
  `EMAIL_PROVIDER=brevo` + `BREVO_API_KEY` (o Render bloqueia SMTP de saída,
  ver `render.yaml`), `SENTRY_DSN` preenchido.
- [ ] **CI verde**, incluindo o job `backend-java-tests` (a criar; ver §0.6) —
  referência actual em `M7-PARIDADE.md` §7: 251 testes Java, 1020 Node, 167
  frontend, 83 e2e.
- [ ] **E2E contra o Java**, localmente, com a base de demonstração:
  ```bash
  cd backend-java && mvn -q package -DskipTests
  java -jar target/kixima-backend-0.1.0-SNAPSHOT.jar --spring.profiles.active=dev --server.port=4001 &
  cd ../frontend && VITE_API_TARGET=http://localhost:4001 VITE_REALTIME=stomp npm run dev -- --port 5173 &
  E2E_BASE_URL=http://localhost:5173 npm run e2e
  ```
  (`VITE_API_TARGET` e `VITE_REALTIME` são as variáveis de `vite.config.js` e
  `src/realtime/RealtimeContext.jsx`. Os 83 testes têm de passar, incluindo
  `chat.spec.js`, que é o que exercita o STOMP — passaram nesta preparação.)
- [ ] Replay de contrato ainda verde na semente: `DUMP=/tmp/kixima_test.dump paridade/correr.sh`
  (só as 6 diferenças documentadas em M7 §2) e `python3 paridade/inventario.py` a 246/246.
- [ ] `JWT_SECRET` de produção **copiado** (é `generateValue: true` no Render —
  só se lê no painel) e pronto para o segundo serviço.

## 2. Mapa de variáveis de ambiente Node → Java

Fonte Node: `backend/src/config/env.js` mais as leituras directas de
`process.env` fora dele (indicadas). Fonte Java: `application.yml` /
`application-prod.yml`. "=" significa: mesmo nome, mesma semântica, mesma
omissão. Os valores por omissão só se citam quando diferem ou quando o
operador tem de os copiar.

### 2.1 Arranque, base de dados, sessão

| Node | Java | Diferença / nota |
|---|---|---|
| `NODE_ENV=production` | `SPRING_PROFILES_ACTIVE=prod` | Liga `application-prod.yml`, `ProducaoStartupGuard`, cookie `Secure`. `/health` devolve `env: "prod"` (Node: `"production"`); o Sentry recebe `environment=prod`. |
| `PORT` (Render injecta) | `PORT` → `server.port` | = (omissão local 4000 vs 4001). |
| `APP_URL` | `APP_URL` → `kixima.app-url` | = ; vazio = origem do pedido, nos dois. Também entra na allow-list de CORS nos dois lados. |
| `DATABASE_URL` (libpq, pooler 6543, `?sslmode=require&pgbouncer=true`) | **Forma A (hoje):** `DATABASE_URL_JDBC=jdbc:postgresql://aws-0-<região>.pooler.supabase.com:6543/postgres?sslmode=require&prepareThreshold=0` + `DATABASE_USER=postgres.<ref>` + `DATABASE_PASSWORD`. **Forma B (`config/DatabaseUrlEnvironmentPostProcessor`):** a mesma `DATABASE_URL` do Node — `pgbouncer=true` passa a `prepareThreshold=0`, `connection_limit` é ignorado com aviso. A forma A tem precedência quando as duas existem. | `prepareThreshold=0` é o equivalente JDBC de `pgbouncer=true` (a Prontidão Java avisa sem ele). Nunca o host `db.<ref>.supabase.co` (IPv6). |
| `DIRECT_URL` (libpq, pooler 5432) | `DIRECT_URL` → `kixima.backup.direct-url` | = ; libpq nos dois (é o `pg_dump`). Sem ela o Java deriva da ligação JDBC; a Prontidão exige porta 5432. |
| — | `DB_POOL_MAX` (omissão 5) | Só Java. **5 durante a sobreposição** (plano §5); rever depois de o Node ser desligado. |
| — (Prisma `migrate-boot.js` corre sempre no arranque) | `FLYWAY_ENABLED` (omissão `false`; `baseline-on-migrate: true`, `baseline-version: 0`) | Só Java. Ver §3.6: `true` **só** depois de o Node estar parado. |
| `JWT_SECRET` | `JWT_SECRET` → `kixima.auth.jwt-secret` | = , **e tem de ser o MESMO valor nos dois serviços** (secção 3.4). Mesmas recusas (vazio, `CHANGE_ME`, placeholders, < 32 caracteres). |
| `JWT_EXPIRES_IN` (`1d`) | `JWT_EXPIRES_IN` → `kixima.auth.jwt-expires-in` | = ; também define o `maxAge` do cookie nos dois. |
| `MFA_REQUIRED_ROLES`, `MFA_ENFORCE_FROM` | `kixima.auth.mfa-required-roles`, `mfa-enforce-from` | = . `MFA_ENFORCE_FROM` também liga o job de lembretes nos dois lados. |
| `FRONTEND_DIST` (`app.js`) | **sem equivalente** | Ver §0.3: o Java precisa de passar a servir o SPA; a variável (ou o caminho fixo na imagem) fica definida por essa tarefa. |
| `LOG_LEVEL` (`info`) | `LOG_LEVEL` → `logging.level.ao.kixima` (`INFO`) | = ; o Logback aceita `info` em minúsculas. |
| `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE` (0) | `sentry.dsn`, `sentry.traces-sample-rate` | = . `SENTRY_FRONTEND_DSN` (`csp.js`) → `kixima.sentry.frontend-dsn`, = . |
| `CORS_ORIGINS` | `CORS_ORIGINS` → `kixima.cors.origins` | = (`CorsOrigins` espelha `config/cors.js`, REST e WebSocket). |
| `DB_MAX_ROWS` (`config/database.js`, 1000) | `DB_MAX_ROWS` → `kixima.db.max-rows` | = (`TectoDeLinhas`). |
| `API_RATE_LIMIT` 600, `AUTH_RATE_LIMIT` 60, `FORGOT_PASSWORD_RATE_LIMIT` 10, `CHAT_RATE_LIMIT` 60 (`middleware/rateLimit.js`) | `kixima.rate-limit.{api,auth,forgot-password,chat}` | = . Java tem ainda `RATE_LIMIT_ENABLED` (omissão `true`; o Node desliga só com `NODE_ENV=test`). **Não** definir em produção. |
| `XLSX_TIMEOUT_MS`, `XLSX_MEMORIA_MB` (`xlsxSeguro.js`) | **sem equivalente** | Java lê a folha com POI em memória sob o tecto de 25 MB do multipart (`AUDITORIA-PRE-M8.md` §4). Não definir. |
| `npm_package_version` (`0.1.0`, do `backend/package.json`) | `KIXIMA_VERSAO` (omissão `1.0`) | `ProductVersion` do SAF-T. Definir `KIXIMA_VERSAO=0.1.0` para não mudar o cabeçalho do SAF-T no cutover. |

### 2.2 Email, armazenamento, cópias de segurança

| Node | Java | Diferença / nota |
|---|---|---|
| `EMAIL_PROVIDER` (`console`/`smtp`/`brevo`/`brevo-api`), `EMAIL_FROM`, `BREVO_API_KEY`, `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_USER`, `SMTP_PASSWORD` | `kixima.email.*` | = (mesmas opções, mesma lista `emFalta`). |
| `STORAGE_PROVIDER`, `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_ENDPOINT`, `STORAGE_PUBLIC_URL`, `STORAGE_BACKUP_BUCKET` | `kixima.storage.*` | = . Em `prod` os dois recusam arrancar sem `s3` + as três credenciais. |
| `STORAGE_FORCE_PATH_STYLE` (omissão: `true` se há `STORAGE_ENDPOINT`, senão `false`) | `kixima.storage.force-path-style` (omissão `true`) | Omissão diferente. Com Supabase Storage os dois dão `true`; **definir explicitamente** `STORAGE_FORCE_PATH_STYLE=true` para não depender disso. |
| — | `STORAGE_LOCAL_DIR` (`uploads`) | Só Java, só modo `local`; irrelevante em produção. |
| `BACKUP_CRON` (opt-in, 5 campos, lida no agendamento), `BACKUP_MAX_IDADE_HORAS` (26) | `kixima.backup.cron`, `kixima.backup.max-idade-horas` | = (o Java converte para os 6 campos do Spring). **Mas** no Java o job só existe com `KIXIMA_JOB_BACKUP_ENABLED=true`. |

### 2.3 Regras de negócio, cobrança, integrações

| Node | Java | Diferença / nota |
|---|---|---|
| `PAYMENT_SLA_DAYS` 7, `POLICY_EXPIRY_ALERT_DAYS` 30, `KIXIMA_USD_AOA_RATE` 900 | `kixima.business.*` | = . |
| `KIXIMA_FEE_PER_PO_USD` 8, `KIXIMA_FEE_PER_INVOICE_USD` 15, `KIXIMA_FEE_THRESHOLD_USD` 11500, `KIXIMA_FEE_PERCENT_ABOVE` 0.002 (`platformFeeService.js`, `planosRoutes.js`) | `kixima.fees.*` | = . |
| `IVA_RATE` 0.14, `WITHHOLDING_RATE` 0.065 (`taxService.js`) | `kixima.tax.*` | = . |
| `KIXIMA_SEAT_PRICE_CAP_USD` 100, `KIXIMA_GRACE_PERIOD_DAYS` 7, `KIXIMA_PRECO_{BASE,CORE,PRO}_{USD,PERIODO}` (100/TRIMESTRAL, 100/MENSAL, 5000/ANUAL) (`planService.js`) | `kixima.plan.*`, `kixima.bancos.grace-period-days` | = . |
| `KIXIMA_PRECO_ADDON_PO_ROBOT_USD` 200, `_PERIODO` MENSAL (`addonService.js`) | `kixima.addons.po-robot.*` | = . |
| `KIXIMA_BANCO_{IBAN,TITULAR,NOME,SWIFT,MOEDA}` (`assinaturaService.js`) | `kixima.banco.*` | = (MOEDA omissão `USD` nos dois). |
| `EMIS_{BASE_URL,POS_ID,TOKEN,CALLBACK_URL}`, `PAYPAY_{BASE_URL,MERCHANT_ID,TOKEN,CALLBACK_URL}`, `BAI_*`, `BFA_*`, `STANDARD_BANK_AO_*` | `kixima.emis.*`, `kixima.paypay.*`, `kixima.bancos.*` | = ; sem elas o canal não existe, nos dois. |
| `ALERTA_INTERVALO_MIN` 60 (`alertaOperacionalService.js`) | `kixima.ops.alerta-intervalo-min` | = . |
| `RETENCAO_{NOTIFICACOES,CONVITES,CODIGOS}_DIAS` 180/90/1 (`retencaoService.js`) | `kixima.retencao.*` | = . |
| `RABBITMQ_URL`, `RABBITMQ_EXCHANGE` `kixima.events` (`eventBus.js`) | `kixima.events.*` | = ; opcional, não bloqueante. |
| `ERP_CONFIG_ENCRYPTION_KEY` (`erpCrypto.js`), `INTEGRATION_URL`, `INTEGRATION_ADMIN_TOKEN` (`erpConfigService.js`), `KIXIMA_CALLBACK_SECRET` (`integrationRoutes.js`) | `kixima.erp.*`, `kixima.integration.callback-secret` | = . A chave AES tem de ser a mesma, senão as configurações ERP já cifradas ficam ilegíveis. |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | `kixima.anthropic.*` | = (mesma omissão de modelo em `env.js` e `application.yml`). |

### 2.4 AGT / faturação certificada

| Node | Java | Diferença / nota |
|---|---|---|
| `KIXIMA_NIF`, `KIXIMA_CERTIFICADO_AGT` | `kixima.faturacao.*` | = . |
| `AGT_JWS_PRIVATE_KEY_BASE64`; **fallback automático** para `/etc/secrets/chavePrivada.pem` e `/etc/secrets/AGT_JWS_PRIVATE_KEY_BASE64` (Secret File do Render) | `AGT_JWS_PRIVATE_KEY_BASE64`; fallback **só** para `AGT_JWS_PRIVATE_KEY_PATH` (omissão `src/main/resources/chave/chavePrivada.pem`) | **Diferença real.** Produção usa o Secret File (o painel corta o Base64 — `render.yaml`). No `kixima-java`: criar o mesmo Secret File `chavePrivada.pem` **e** definir `AGT_JWS_PRIVATE_KEY_PATH=/etc/secrets/chavePrivada.pem`. O loader Java aceita PEM PKCS#1/PKCS#8 ou o Base64 dentro do ficheiro. |
| `AGT_SOFTWARE_ID` `KIXIMA`, `AGT_SOFTWARE_VALIDATION_NUMBER`, `AGT_NIF`, `AGT_ESTABLISHMENT_NUMBER`, `AGT_ENV` `hml`, `AGT_SANDBOX_USERNAME`, `AGT_SANDBOX_PASSWORD` | `kixima.agt.*` | = . |
| `AGT_SOFTWARE_VERSION` (omissão `npm_package_version` = `0.1.0`) | `kixima.agt.software-version` (omissão `1.0`) | Omissão diferente. **Definir `AGT_SOFTWARE_VERSION=0.1.0`** nos dois, para o envelope AGT não mudar de versão a meio de uma série. |

### 2.5 Só num dos lados

- **Só Node, não migram**: `LOAD_DEMO_CATALOG`, `CATALOG_COMPANY` (seed no `CMD` do
  `Dockerfile`), `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_NAME` (`prisma/seed.js`),
  `BACKUP_RETENTION_DAYS`/`BACKUP_DIR` (`scripts/backup.js`), `SOURCE_DATABASE_URL`/
  `TARGET_DATABASE_URL`, `AGT_HOMOLOGACAO_NIF` (scripts).
- **Só Java**: `SPRING_PROFILES_ACTIVE`, `DATABASE_URL_JDBC`/`DATABASE_USER`/
  `DATABASE_PASSWORD` (forma A), `DB_POOL_MAX`, `FLYWAY_ENABLED`, `RATE_LIMIT_ENABLED`,
  `AGT_JWS_PRIVATE_KEY_PATH`, `KIXIMA_VERSAO`, `STORAGE_LOCAL_DIR`, e as seis
  flags `KIXIMA_JOB_{RETENCAO,EXPIRACAO_APOLICES,EXPIRACAO_SUBSCRICOES,LEMBRETES_2FA,PO_ROBOT,BACKUP}_ENABLED`
  (todas `false` por omissão — `@ConditionalOnProperty`, o bean nem existe).
- **Só no build do SPA**: `VITE_SENTRY_DSN` (build-arg do `Dockerfile`), `VITE_REALTIME`
  (`stomp` na imagem Java, `socketio` na imagem Node), `VITE_API_BASE_URL` (só apps nativas).

Recomendação prática no Render: pôr tudo o que é **partilhado** (2.1 a 2.4,
excepto `SPRING_PROFILES_ACTIVE`, `DB_POOL_MAX`, `FLYWAY_ENABLED`, as flags
`KIXIMA_JOB_*` e `AGT_JWS_PRIVATE_KEY_PATH`) num *Environment Group* ligado aos
dois serviços, para o `JWT_SECRET`, a `ERP_CONFIG_ENCRYPTION_KEY` e as
credenciais nunca divergirem. **A CONFIRMAR** no painel se o Secret File pode
viver no grupo ou tem de ser criado por serviço.

## 3. Sequência de cutover

### 3.1 Subir `kixima-java` ao lado do `kixima`

1. Serviço `kixima-java` (blueprint ou painel): Docker, região `frankfurt`,
   `healthCheckPath: /ready`, mesma branch.
2. Variáveis: as partilhadas (grupo) + `SPRING_PROFILES_ACTIVE=prod`,
   `DB_POOL_MAX=5`, `FLYWAY_ENABLED` **ausente/`false`**, as seis
   `KIXIMA_JOB_*_ENABLED` **ausentes/`false`**, `AGT_JWS_PRIVATE_KEY_PATH=/etc/secrets/chavePrivada.pem`
   + Secret File `chavePrivada.pem`, `KIXIMA_VERSAO=0.1.0`, `AGT_SOFTWARE_VERSION=0.1.0`,
   `STORAGE_FORCE_PATH_STYLE=true`.
3. Deploy. O arranque tem de passar o `ProducaoStartupGuard` (mensagens
   idênticas às do `env.js`) e o `ddl-auto: validate` — uma coluna a menos no
   schema derruba o arranque aqui, não em runtime. Se falhar, o log diz qual.

### 3.2 Smoke no URL interno (`https://kixima-java.onrender.com`)

```bash
J=https://kixima-java.onrender.com
curl -s $J/health          # {"status":"ok","env":"prod"}
curl -s $J/ready           # {"status":"ok","database":"ok","latencyMs":…,"env":"prod"}; 503 "degradado" = base inacessível
# Login de cada persona (cookie httpOnly kixima_sessao). ADMIN_SISTEMA e COMPANY_ADMIN
# têm 2FA obrigatória: o login devolve um desafio; completar com POST /api/auth/2fa/verify.
curl -s -c c.txt -H 'content-type: application/json' -d '{"email":"<comprador>","password":"…"}' $J/api/auth/login
curl -s -b c.txt $J/api/auth/me
curl -s -b c.txt "$J/api/catalog?page=1"                 # catálogo
curl -s -b c.txt "$J/api/marketplace/search?q=mangueira" # marketplace
curl -s -b c.txt $J/api/purchase-orders                  # POs (a listagem com items+invoice.payment, M7 §2.2)
curl -s -b c.txt $J/api/notifications                     # notificações
curl -s -b c.txt $J/api/contracts                         # contratos
curl -s -b c.txt $J/api/support/tickets                   # suporte
# fornecedor: /api/catalog/documents, /api/reports/fornecedor ; financeiro: /api/financeiro/overview
# admin (após 2FA): /api/admin/prontidao, /api/admin/activities, /api/faturacao/metricas
```

Critério: nenhum 5xx; formas iguais às do Node (comparar a olho com o mesmo
pedido em `https://kixima.onrender.com`). `GET /api/admin/prontidao` no Java
tem de mostrar `db-url` e `db-direct` a OK e a chave AGT lida do Secret File.

### 3.3 Replay contra uma cópia fresca de produção (nunca a base viva)

```bash
# 1. Dump pela ligação de SESSÃO (5432); o pooler de transacção não serve o pg_dump.
pg_dump -Fc --no-owner --no-privileges "$DIRECT_URL" > /tmp/prod-$(date +%F).dump
# 2. Base de trabalho local/staging (o correr.sh faz pg_restore --clean nela antes de CADA lado):
createdb kixima_trabalho
# 3. Em backend-java/ (o jar já feito):
DUMP=/tmp/prod-…dump PGHOST=localhost PGUSER=… PGPASSWORD=… PGDATABASE=kixima_trabalho \
  PORTA_NODE=4000 PORTA_JAVA=4001 paridade/correr.sh          # grava os dois lados e compara
DUMP=… PGDATABASE=kixima_trabalho paridade/correr.sh comparar  # só o diff (sai com 1 se houver)
```

Limitações a saber antes de correr: `correr.sh` arranca o Node com
`NODE_ENV=test -r ./tests/env.js`, que fixa `DATABASE_URL` em `kixima_test` se
a variável não vier do ambiente — **exportar `DATABASE_URL`/`DIRECT_URL` para
`kixima_trabalho`** antes. E `replay.mjs`/`carga.mjs` entram com as cinco
contas da semente (`comprador@petroangola.co.ao`, …, senha `Kixima@123`), que
não existem numa cópia de produção: ou se criam essas contas na cópia, ou se
passa `--cenario` com um ficheiro cujas personas existam (e se repõe o hash de
senha dessas contas **na cópia**). Critério: só as diferenças de M7 §2 ("que
ficam"); qualquer 5xx ou forma nova é bloqueante.

### 3.4 Sessões e cookies — verificado no código

`security/JwtService.java` × `services/authService.js` + `middleware/auth.js`:
HS256 nos dois, segredo usado como bytes UTF-8 (`Keys.hmacShaKeyFor` ↔
`Buffer.from(secret)`), claims do token de sessão `sub`, `role`, `companyId`,
`tv` (tokenVersion) + `iat`/`exp` com `JWT_EXPIRES_IN`; tokens especiais com
`t` = `2fa` (15 min), `pwreset` (1 h), `invite` (7 d, `iid`). Cookie
(`SessionCookieUtil.java` × `utils/sessionCookie.js`): `kixima_sessao`,
`HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` em produção, `maxAge` =
validade do JWT. O interceptor STOMP lê o mesmo cookie no *upgrade*
(`RealtimeHandshakeInterceptor`), como o `realtimeService.js`.

Consequência: com **o mesmo `JWT_SECRET`** nos dois serviços e **o mesmo
domínio**, uma sessão aberta no Node continua válida no Java sem novo login, e
vice-versa no recuo. Um `JWT_SECRET` diferente = todos os utilizadores
deslogados e os links de convite/recuperação em circulação inválidos.

### 3.5 Mudar o tráfego (Render)

Fazer numa janela de pouco tráfego (as apps nativas apontam a `kixima.net`;
os separadores abertos com o SPA antigo continuam a tentar `/socket.io`, que
o Java não tem — o chat em tempo real só volta nesses separadores depois de
um *reload*, que carrega o bundle STOMP da imagem Java).

1. No `kixima-java` já com smoke e replay verdes, confirmar o SPA a servir em
   `https://kixima-java.onrender.com/` (login pela interface, chat de suporte
   a ligar em `/ws`).
2. Mover o domínio: `kixima` → *Settings → Custom Domains* → remover
   `kixima.net` (e `www`, se existir); `kixima-java` → *Custom Domains* → *Add*
   `kixima.net`. O Render emite o certificado TLS para o novo serviço.
   **A CONFIRMAR no painel** se o registo DNS actual é um `CNAME` para
   `kixima.onrender.com` (então tem de passar a `kixima-java.onrender.com`,
   com o TTL que tiver) ou um `A`/`ALIAS` para o IP do Render (então não há
   alteração de DNS). Renomear serviços é a alternativa (`kixima` →
   `kixima-node`, `kixima-java` → `kixima`), mas muda os hostnames
   `*.onrender.com` e não dispensa o passo anterior.
3. Confirmar: `curl -sI https://kixima.net/health` responde e
   `curl -s https://kixima.net/health` dá `"env":"prod"` (o Node dizia
   `"production"` — é o sinal mais rápido de que o domínio já está no Java).
4. **Não tocar** no `kixima`: continua de pé, com os seus jobs, durante toda a
   janela de recuo (secção 4).

### 3.6 Passagem dos jobs e da posse do DDL — só no FIM da janela de recuo

Facto do código: **o Node não tem flag para desligar os jobs.** `server.js`
agenda os seis incondicionalmente; só `backupJob.js` (opt-in por
`BACKUP_CRON`) e `mfaLembreteJob.js` (só com `MFA_ENFORCE_FROM`, que é
política de 2FA e não se mexe) dependem do ambiente. Logo, a única forma
segura de o Node deixar de correr `poRoboJob`/`policyExpiryJob`/
`subscriptionExpiryJob`/`retencaoJob` é **parar o serviço** (*Settings →
Suspend Service*). Ligar um job Java com o Node ainda vivo duplica-o: o PO
Robot cria POs em duplicado, os avisos de apólice/subscrição vão duas vezes.

Ordem, uma flag de cada vez (cada uma exige *redeploy* do `kixima-java`):

| Passo | Flag | Verificação |
|---|---|---|
| 0 | Suspender `kixima` (Node) | `https://kixima.onrender.com/health` deixa de responder; nenhuma nova linha de auditoria com `actorName: "Sistema"` vinda do Node. |
| 1 | `KIXIMA_JOB_BACKUP_ENABLED=true` (+ `BACKUP_CRON=0 3 * * *`, sem aspas) | Log: "Cópia de segurança automática agendada: 0 3 * * * (UTC)". Forçar `POST /api/admin/backup`; `GET /api/admin/audit-logs` mostra `COPIA_SEGURANCA_CONCLUIDA` com `chave`; objecto novo em `STORAGE_BACKUP_BUCKET`; `POST /api/admin/backup/verificar` lê-o inteiro. Na manhã seguinte: a cópia das 03:00 (ou a de recuperação até 26 h) existe. |
| 2 | `KIXIMA_JOB_RETENCAO_ENABLED=true` | 1 h após o arranque corre `RetentionService.limpar()`; sem alerta operacional `RETENCAO_DADOS`; `GET /api/retencao` inalterado. |
| 3 | `KIXIMA_JOB_EXPIRACAO_APOLICES_ENABLED=true` | Às 07:00 UTC: log "Alertas de expiração de apólice enviados: N" (só se N>0) e nenhum alerta `EXPIRACAO_APOLICES`. |
| 4 | `KIXIMA_JOB_EXPIRACAO_SUBSCRICOES_ENABLED=true` | Às 07:00 UTC: nenhum alerta `EXPIRACAO_SUBSCRICOES`; empresas a vencer em 30/7/3/1/0 dias recebem o email uma vez. |
| 5 | `KIXIMA_JOB_LEMBRETES_2FA_ENABLED=true` | 5 min após o arranque e de hora a hora: `GET /api/admin/mfa-pendentes` baixa; log "Lembrete de 2FA enviado a N conta(s)"; ninguém recebe dois no mesmo dia. |
| 6 | `KIXIMA_JOB_PO_ROBOT_ENABLED=true` | Às 06:00 UTC: log "PO Robot: ciclo concluído — total=… criadas=…"; as regras activas em `/api/po-robot` produzem **uma** PO cada; nenhum alerta `PO_ROBOT`. |
| 7 | `FLYWAY_ENABLED=true` | Arranque cria `flyway_schema_history` com baseline `0` (`baseline-on-migrate`), sem tocar em `_prisma_migrations`. |

Depois do passo 7 o Flyway é o dono do DDL. **`scripts/migrate-boot.js` não
pode voltar a correr contra esta base**: corre em todo o arranque do contentor
Node (`CMD` do `Dockerfile`) e aplicaria qualquer migração Prisma nova que
viesse numa imagem futura. Regra: nunca mais fazer deploy de uma imagem Node
nova; um arranque do Node **já existente** (só no recuo, secção 4) é seguro
apenas enquanto o Flyway não tiver aplicado nenhuma migração.

## 4. Janela de recuo (rollback)

**Duração: 7 dias** a partir da mudança do domínio — apanha as corridas das
06:00/07:00 de uma semana inteira, um fecho de semana de faturação e a cópia
das 03:00 sete vezes. Durante a janela: o Node fica de pé com os seus jobs (os
únicos ligados), as seis flags Java ficam `false`, `FLYWAY_ENABLED` fica
`false`, e os dois serviços mantêm o mesmo `JWT_SECRET`. Nenhuma migração de
schema (Prisma ou Flyway) durante a janela.

Gatilhos de recuo (qualquer um chega): um 5xx no Java em rota que respondia
2xx/4xx no Node (Sentry, filtrado por `environment=prod`); uma diferença de
contrato que o replay não tinha mostrado (uma página do SPA a falhar por
forma de resposta); rejeição da AGT num documento que o Node submetia
(`GET /api/faturacao/agt-estado/{invoiceId}` com `agtErro` novo); chat de
suporte sem tempo real após *reload*; `/ready` a 503 por esgotamento de
ligações no pooler (`DB_POOL_MAX` + o pool do Node ainda vivo).

Passos, por esta ordem:

1. `kixima-java` → *Custom Domains* → remover `kixima.net`; `kixima` →
   *Custom Domains* → adicionar `kixima.net` (e o DNS, se foi mudado em 3.5).
   `curl -s https://kixima.net/health` volta a dar `"env":"production"`.
2. Se alguma flag `KIXIMA_JOB_*` já tinha sido ligada (não devia, dentro da
   janela): pô-la a `false` e *redeploy* do `kixima-java` **antes** de
   retomar o Node, para não haver dois donos do mesmo job.
3. Se o Node tinha sido suspenso: *Resume*. O `migrate-boot.js` corre
   (`migrate deploy` não faz nada se não houver migrações novas — confirmar no
   log "No pending migrations").
4. Sessões: intactas (mesmo segredo, mesmo domínio). Separadores abertos com
   o bundle STOMP precisam de *reload* para voltar ao Socket.IO.
5. Registar o motivo em `docs/migracao-java/` e reabrir o marco.

Se o Flyway já tiver aplicado uma migração (passo 7 de 3.6 e além), o recuo
deixa de ser "mover o domínio": passa a exigir uma migração Prisma equivalente
e uma imagem Node nova — fora deste runbook.

## 5. Verificação pós-cutover (em `https://kixima.net`, logo após 3.5)

| Domínio | Como | Resultado esperado |
|---|---|---|
| Auth — senha + TOTP | Login de um ADMIN_SISTEMA com TOTP; `POST /api/auth/2fa/verify` | 200, cookie `kixima_sessao` `Secure; HttpOnly; SameSite=Lax`; `GET /api/auth/me` com `role`, `adminAreas`. |
| Auth — 2FA por email | Login de um COMPANY_ADMIN com `mfaMethod=EMAIL`; `POST /api/auth/2fa/reenviar` | Código de 6 dígitos chega pelo Brevo; reenvio só após 60 s; 5 tentativas. |
| Auth — recuperação de senha | `POST /api/auth/forgot-password` | Email com link `APP_URL/…`; `POST /api/auth/reset-password` invalida as sessões (`tv` incrementa). |
| Catálogo | Fornecedor: `POST /api/catalog` com imagem; comprador: `GET /api/catalog/{id}`, `GET /api/marketplace/search` | Imagem servida do `STORAGE_PUBLIC_URL`; ordenação estável (D7). |
| PO ponta a ponta | Comprador `POST /api/purchase-orders` → `PATCH …/approve` (Company Admin, 2FA) → `PATCH …/accept` (fornecedor) → `POST /api/payments/invoices/{invoiceId}/pay` (multipart `proof`, PDF real) → `…/dispatch` → `…/delivered` → `PATCH …/reception` → `GET …/history` | Cada transição 200 com a forma de M7 §2.2; o comprovativo aparece em `invoice.payment`; a taxa KIXIMA em `GET /api/admin/platform-fees`. |
| Fatura + AGT (sandbox, `AGT_ENV=hml`) | Depois do `accept`: `GET /api/faturacao/agt-payload/FT/{invoiceId}`, `GET /api/faturacao/agt-estado/{invoiceId}`, `GET /api/faturacao/integridade` | Payload assinado (JWS RS256, chave do Secret File); `agtEstado` aceite pela sandbox, `agtErro` `null`; cadeia de hash íntegra. |
| Contratos / call-offs | `POST /api/contracts/{id}/consolidate-billing` e pagamento da fatura consolidada | Fatura sem PO paga pelo contrato (D2); `paidAt` em todas as call-offs; `poCount` = nº de POs na taxa. |
| Suporte em tempo real | Dois browsers: `POST /api/support/tickets/{id}/messages` num, o outro subscrito a `/topic/support/{ticketId}` via `/ws` | Mensagem aparece sem *reload*; `GET /api/support/unread-count` actualiza. Admin: `POST /api/support/admin/tickets/{id}/assume`. |
| Notificações | Após a aprovação da PO: `GET /api/notifications`, `PATCH /api/notifications/{id}/read` | Notificação nova ao fornecedor em `/user/queue/notifications` e na lista. |
| Admin | `GET /api/admin/prontidao`, `/activities`, `/audit-logs`, `/users` (Super Admin) | Prontidão sem FALHA; auditoria com `detail.valor` em texto sem zeros (M7 §2.7). |
| Relatórios | `GET /api/reports/fornecedor`, `GET /api/reports/conteudo-local`, `GET /api/dashboard/comprador` | Totais iguais aos do Node para o mesmo período (números, não texto). |
| SAF-T | `GET /api/faturacao/saft/resumo?de=…&ate=…&supplierCompanyId=…` e `GET /api/faturacao/saft?…` | XML `SAFT-AO-<de>-a-<ate>.xml` com `ProductVersion=0.1.0`, `ProductCompanyTaxID=KIXIMA_NIF`; período ilegível → 422 (D12). |

## 6. Desactivação do Node

Só depois da janela (secção 4) e dos passos 0–7 de 3.6, por esta ordem:

1. **Suspender** `kixima` (já feito no passo 0 de 3.6) — não apagar. Manter
   as variáveis e o Secret File no serviço: é o que permite um *Resume* de
   emergência enquanto o Flyway não aplicar migrações.
2. Subir `DB_POOL_MAX` no `kixima-java` (o limite 5 existia para não esfomear o
   pool do Node; rever contra o limite do pooler Supabase do plano).
3. Manter a definição do serviço `kixima` em `render.yaml` **durante mais um
   release**; só depois a remover, juntamente com o `Dockerfile` da raiz, o
   `CMD` com `migrate-boot.js`, e actualizar `README.md` "Deploy" e `DEPLOY.md`
   (que ainda descrevem o `prisma migrate deploy` no arranque).
4. Apagar o serviço `kixima` no Render no release seguinte. O `backend/`
   continua no repositório como referência de comportamento até o plano dizer
   o contrário; as migrações novas passam a nascer em
   `backend-java/src/main/resources/db/migration/`.

## 7. Checklist

- [ ] §0: `kixima-java` no `render.yaml`, Dockerfile Java com SPA (`VITE_REALTIME=stomp`), Java a servir o SPA, `VITE_REALTIME`/`VITE_API_TARGET` fundidos, `DATABASE_URL` única aceite (ou forma A configurada), job `backend-java-tests` no CI
- [ ] Carga contra staging (`correr.sh carga`, 120 s × 50) sem 5xx novos; S3 ponta a ponta; `SPRING_PROFILES_ACTIVE=prod`, `EMAIL_PROVIDER=brevo`, `SENTRY_DSN` no painel
- [ ] CI verde; e2e verde contra o Java (83 testes); replay 246/246 e só as 6 diferenças de M7
- [ ] Variáveis partilhadas num Environment Group; `JWT_SECRET` idêntico nos dois; `AGT_JWS_PRIVATE_KEY_PATH` + Secret File; `KIXIMA_VERSAO=0.1.0`; `AGT_SOFTWARE_VERSION=0.1.0`; `STORAGE_FORCE_PATH_STYLE=true`; `DB_POOL_MAX=5`
- [ ] `kixima-java` arrancou (guarda + `ddl-auto: validate`), `/health` e `/ready` OK, smoke por persona sem 5xx, Prontidão sem FALHA
- [ ] Replay contra `pg_dump` fresco de produção numa base de trabalho (nunca a viva) — verde
- [ ] Domínio `kixima.net` movido para `kixima-java`; TLS emitido; `/health` diz `"env":"prod"`; login pela interface sem novo login; chat de suporte a ligar em `/ws`
- [ ] Janela de 7 dias: Node de pé com os jobs, flags Java `false`, `FLYWAY_ENABLED=false`, sem migrações; gatilhos de recuo vigiados no Sentry
- [ ] Fim da janela: Node suspenso → flags Java ligadas uma a uma com a verificação de cada (3.6) → `FLYWAY_ENABLED=true` → `flyway_schema_history` criado
- [ ] Verificação pós-cutover da secção 5 completa, incluindo AGT na sandbox e SAF-T
- [ ] `kixima` mantido suspenso um release; `render.yaml`/`README.md`/`DEPLOY.md` actualizados no seguinte
