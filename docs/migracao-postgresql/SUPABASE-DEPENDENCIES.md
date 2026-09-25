# O que no KIXIMA ainda depende do Supabase

Auditoria estática do repositório (backend Node, backend Java, frontend,
scripts, deploy e documentação) feita sem acesso ao projecto Supabase.
Nada foi alterado: este documento diz o que existe, para a migração
para o PostgreSQL próprio saber o que tem de mudar e o que não tem.

## Resumo

| Dependência | Existe? | Onde | O que muda na migração |
|---|---|---|---|
| **Supabase Database** (PostgreSQL) | **Sim** — é a base de produção | `DATABASE_URL` (pooler de transacção 6543, `pgbouncer=true`) + `DIRECT_URL` (pooler de sessão 5432) | Passa a apontar ao PostgreSQL próprio; ver §1 |
| **Supabase Storage** | **Sim** — ficheiros (imagens, documentos, comprovativos, anexos, cópias de segurança) via endpoint S3-compatível | `STORAGE_PROVIDER=s3`, `STORAGE_ENDPOINT=https://<ref>.supabase.co/storage/v1/s3`, `STORAGE_PUBLIC_URL`, bucket `product-images` (+ bucket de backups) | **Não é migrado por este plano** — PostgreSQL ≠ Storage; ver `STORAGE.md` |
| Supabase Auth | Não | autenticação própria: JWT HS256 + cookie httpOnly, bcrypt, TOTP/email (Node `authService.js`, Java `security/`) | nada |
| Supabase SDK (`@supabase/*`) | Não | não está em `backend/package.json`, `frontend/package.json` nem `pom.xml` | nada |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE` | Não | nenhuma variável `SUPABASE_*` é lida em código algum | nada |
| Supabase Realtime / Edge Functions / RLS | Não | tempo real é Socket.IO (Node) / STOMP (Java); sem políticas RLS nas tabelas do Prisma | nada |

## 1. Base de dados

### O que a aplicação usa

- **Prisma** (`backend/prisma/schema.prisma`): `url = env("DATABASE_URL")`,
  `directUrl = env("DIRECT_URL")`. O comentário do datasource explica a
  topologia Supabase: app pelo pooler de **transacção** (6543,
  `pgbouncer=true`), migrações/DDL pelo pooler de **sessão** (5432); nunca o
  host directo `db.<ref>.supabase.co` (só IPv6).
- **Esquema**: 49 tabelas (`@@map`) em `public`, todas com chave `String @id @default(uuid())`
  (o UUID é gerado pela aplicação, não pela base — `gen_random_uuid`/`uuid-ossp`
  não são usados), 36 enums, 115 índices criados nas migrações, `_prisma_migrations`
  com 55 migrações (`0_init` … `20260928000000_indices_invoice_auditlog_platform_fee`).
- **Extensões**: só `pg_trgm` (`20260831000000_pesquisa_sem_acentos`). No Supabase
  ela pode viver no esquema `extensions`; no PostgreSQL próprio tem de ser criada
  em `public` antes do restore (o `03-restore-postgres.ps1` fá-lo).
- **Funções**: `kixima_normalizar`, `products_search_text`, `companies_search_text`
  (plpgsql/sql, pesquisa sem acentos). **Triggers**: `products_search_text_trg`,
  `companies_search_text_trg`. **Vistas**: nenhuma. **Sequences**: nenhuma
  (os contadores de referência `PO-2026-000123` são a tabela `reference_counters`,
  ver `scripts/migracao/sql/reference-counters.sql`).
- **SQL directo** (`$queryRaw`) em `utils/reference.js`, `faturacaoService.js`,
  `agtSeriesService.js`, `creditNoteService.js`, `prontidaoService.js`,
  `backupVerificacaoService.js`, `app.js` (`/ready`): SQL padrão, sem funções
  específicas do Supabase.
- **Java**: `spring.datasource` a partir de `DATABASE_URL_JDBC` ou da `DATABASE_URL`
  do Node (`config/DatabaseUrlEnvironmentPostProcessor`, que traduz
  `pgbouncer=true` → `prepareThreshold=0`); Flyway desligado (`FLYWAY_ENABLED=false`,
  o Prisma é dono do DDL).

### Código que "sabe" que a base é o Supabase (não parte, mas dá conselhos errados depois da migração)

| Ficheiro | O que faz | Depois da migração |
|---|---|---|
| `backend/src/services/prontidaoService.js` (32-84) | A página Prontidão inspecciona o URL: avisa se a porta não é 6543/`pgbouncer=true`, se o host é `db.<ref>.supabase.co`, e traduz erros de senha "depois de rodar a senha do Supabase" | Com `localhost:5432` sem pgbouncer vai mostrar avisos que deixam de fazer sentido — **ajustar no momento do cutover, não agora** |
| `backend-java/src/main/java/ao/kixima/admin/ProntidaoService.java` (159-182) | O mesmo, no Java (`prepareThreshold=0` como equivalente de `pgbouncer=true`) | idem |
| `backend/prisma/schema.prisma` (11-14), `backend/.env.example` (23-30), `DEPLOY.md`, `README.md`, `render.yaml`, `docs/migracao-java/M8-CUTOVER.md` | Comentários e instruções com os URLs do pooler | Actualizar a documentação e o `render.yaml` quando o destino passar a produção |
| `backend/scripts/backup.js`, `backend/src/jobs/backupJob.js`, `backend-java/.../backup/BackupService.java` | `pg_dump` pela `DIRECT_URL` (sessão) porque o pooler de transacção não serve; guardam a cópia no S3 (Supabase Storage) ou em disco | Continuam a funcionar (`DIRECT_URL` = a mesma ligação directa ao PostgreSQL próprio); o destino das cópias depende do Storage (§2) |
| `backend/src/services/backupVerificacaoService.js` | Nota que o Supabase não deixa criar bases pela API | No PostgreSQL próprio a verificação por restore numa base temporária passa a ser possível |
| `backend/scripts/restore-test.js` | Ensaio de restauro numa base descartável no mesmo servidor | Passa a ser executável contra o próprio servidor |
| `backend-java/.../config/ProducaoStartupGuard.java` (104) | Mensagem de erro que sugere "Configure o Supabase Storage (ou outro S3-compatível)" | Só texto |

### Variáveis de ambiente envolvidas

| Variável | Hoje (Supabase) | Depois |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres.<ref>:…@aws-0-<regiao>.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true` | `postgresql://<user>:…@<host>:5432/kixima` (+ `?sslmode=require` se o servidor tiver TLS); **sem** `pgbouncer=true` a não ser que se ponha um PgBouncer próprio à frente |
| `DIRECT_URL` | `…pooler.supabase.com:5432/postgres?sslmode=require` | a mesma ligação directa ao PostgreSQL próprio (é a que o `pg_dump` e o `prisma migrate` usam) |
| `DATABASE_URL_JDBC` / `DATABASE_USER` / `DATABASE_PASSWORD` (Java, opcionais) | derivadas | `jdbc:postgresql://<host>:5432/kixima` — ou deixar o Java derivar da `DATABASE_URL` |
| `DB_POOL_MAX` (Java) | 5, para não esgotar o pooler partilhado com o Node | pode subir (o servidor é próprio), mas só depois de medir |

## 2. Storage

A base de dados guarda **URLs** de ficheiros que vivem no Supabase Storage
(bucket público `product-images`, mais o bucket de cópias de segurança
`STORAGE_BACKUP_BUCKET`): colunas `image_url`, `file_url`, `document_url`,
`logo_url`, `avatar_url`, `proof_url`, `comprovativo_url`, `attachment_url`.
Um `pg_dump`/`pg_restore` copia os URLs, **não os ficheiros**. Enquanto o
Storage ficar no Supabase, a aplicação migrada continua a servir esses URLs
sem alteração; se o Storage também migrar, é um projecto à parte — ver
`STORAGE.md`.

Código envolvido: `backend/src/services/storageService.js` (SDK S3 da AWS
apontado ao endpoint S3 do Supabase), `backend/src/config/csp.js` (a CSP
autoriza imagens do host de `STORAGE_PUBLIC_URL`), `backend/scripts/storage-check.js`,
`backend-java/.../storage/StorageService.java`, testes `storage.test.js`,
`csp.test.js`, `StorageServiceS3Test`.

## 3. O que NÃO existe (confirmado por pesquisa em todo o repositório)

- Nenhuma ocorrência de `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE` nem de qualquer `SUPABASE_*`.
- Nenhuma dependência `@supabase/supabase-js`, `supabase-py` ou SDK Java.
- Nenhum uso de Supabase Auth (tabela `auth.users`, JWT do Supabase, RLS).
- Nenhum esquema além de `public` é usado pela aplicação.
- O serviço `kixima-integration-service` tem a sua própria base
  (`kixima_integration`, `.env.example`), fora deste plano.

## 4. Conclusão para a migração

Migrar a base de dados é **só** apontar `DATABASE_URL`/`DIRECT_URL` ao novo
servidor depois de restaurar o dump (esquema `public` completo, incluindo
`_prisma_migrations`, para o `migrate-boot.js` do Node e o Flyway do Java não
tentarem reaplicar nada). O Storage fica onde está até haver um plano próprio.
As únicas mudanças de código que a migração vai pedir são cosméticas e ficam
para o cutover: os avisos da página Prontidão sobre pooler/porta 6543 e a
documentação de deploy.
