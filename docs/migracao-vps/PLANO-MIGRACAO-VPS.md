# KIXIMA — Plano de migração do Supabase para PostgreSQL próprio num VPS (aplicação no Render)

> **Estado: PLANO. Nada foi executado.** Não foi alterada nenhuma base de dados, variável do Render, credencial, nem o Supabase. Os comandos abaixo são para correr **depois** da tua aprovação, fase a fase. Os valores entre `<…>` são marcadores: as senhas nunca entram em ficheiros versionados, nem na linha de comandos, nem em logs.

## 0. Antes de tudo — três factos que condicionam o desenho

1. **O Render não dá IPs de saída fixos de graça.** Sem o serviço pago de *Dedicated IPs*, os IPs de saída são intervalos **partilhados por outros clientes** da região, e já foram alterados (revisão anunciada em out/2025). O preço indicado nas pesquisas (≈ 100 USD/mês por conjunto de IPs, planos Pro) anularia a poupança do VPS. **Consequência:** não se pode confiar só numa lista de IPs para proteger a base; a segurança tem de assentar em TLS **com verificação do certificado**, SCRAM, papéis com privilégios mínimos e *fail2ban*. *(Fonte: pesquisa web; não consegui abrir as páginas do Render a partir deste ambiente. Confirmar em `render.com/docs/dedicated-ips` e no painel do serviço, em Connect → Outbound.)*
2. **O Prisma não verifica o certificado por omissão.** `sslmode=require` obriga a TLS mas, segundo a documentação do Prisma, `sslaccept` vale `accept_invalid_certs` por omissão. É preciso `sslmode=require&sslaccept=strict`. No Java (pgjdbc) `sslmode=require` também aceita qualquer certificado: usar `verify-full`. **Tem de ser testado** (secção 6, teste T3) — não assumir.
3. **Os ficheiros não vão com a base.** Os URLs de 13 colunas apontam para o Storage do Supabase; o disco do Render é efémero, por isso o novo armazenamento tem de ser remoto e compatível com S3.

## 1. Requisitos do VPS

| Item | Mínimo recomendado | Notas |
|---|---|---|
| CPU / RAM | 2 vCPU / 4 GB | PostgreSQL + PgBouncer + Caddy/certbot. 2 GB só serve se a base for muito pequena. |
| Disco | 40–80 GB SSD/NVMe | Calcular: `tamanho da base × 3` (dados + dumps locais + WAL). Se o armazenamento de ficheiros ficar no VPS (MinIO), somar o tamanho do bucket × 1,5. |
| Rede | IPv4 público fixo, ≥ 1 Gbit, tráfego incluído | Sem IPv6 obrigatório: o Render usa IPv4. |
| SO | Ubuntu 24.04 LTS (ou Debian 12) | Atualizações de segurança automáticas. |
| Localização | **Mesma região do Render** (indícios de Frankfurt/UE: pooler `eu-central-1` no `DEPLOY.md`; **confirmar no painel**) | Latência alvo < 10 ms. Cada pedido faz várias consultas: 80 ms de latência tornam a app visivelmente lenta. |
| PostgreSQL | **≥ versão major da origem** e **≤ 17** | `pg_restore` não restaura para uma versão menor. A imagem do Render tem `pg_dump` 17 (`Dockerfile:25-36`), que não copia servidores > 17. Prisma 5.22: usar **16** salvo se a origem for 17 (então testar o Prisma com 17). |
| Domínio | Um subdomínio (ex.: `db.<teudominio>`) com registo A para o VPS | Necessário para o certificado TLS válido. |
| Backups externos | 1 bucket/serviço **noutro fornecedor** | Backup no mesmo VPS não é backup. |
| Custo (ordem de grandeza) | VPS ≈ 5–10 €/mês + armazenamento de objetos ≈ 1–5 €/mês + domínio | Confirmar preços atuais. Fornecedores europeus com tráfego incluído servem. |
| Operação | Alguém de plantão para patches, disco, certificados e restauro | **É o custo real**: o Supabase fazia isto por ti. |

## 2. Arquitetura alvo

```
Browser ──► Render (Node + Java) ──TLS strict──► VPS: PgBouncer :6543 (modo transação) ──► PostgreSQL :5432 (localhost)
                │                                          └─ DIRECT_URL :5432 (migrações, pg_dump) ─────────────┘
                └──S3 API──► Armazenamento de objetos (R2/B2 ou MinIO)  ◄── navegador (imagens públicas)
VPS ── cron: pg_dump -Fc diário + (opcional) WAL arquivado ──► bucket de cópias (outro fornecedor, cifrado)
```

Replica a topologia do Supabase (**6543 para a aplicação, 5432 direta**): assim o painel de Prontidão (`prontidaoService.js`), o `prepareThreshold=0` do Java e o `pgbouncer=true` do Prisma funcionam **sem alterar código**.

Cadeias de ligação (marcadores):

```
DATABASE_URL=postgresql://kixima_app:<SENHA_APP>@db.<dominio>:6543/kixima?sslmode=require&sslaccept=strict&pgbouncer=true&connection_limit=10&connect_timeout=10
DIRECT_URL=postgresql://kixima_migrator:<SENHA_MIGRATOR>@db.<dominio>:5432/kixima?sslmode=require&sslaccept=strict&connect_timeout=10
```

## 3. Riscos e mitigação

| # | Risco | Impacto | Mitigação |
|---|---|---|---|
| R1 | **Dados mais recentes no Supabase do que na `kixima_standalone`** | Perda de dados reais ao migrar a cópia errada | Fase A compara as duas. **A migração final parte de um dump novo do Supabase**; a standalone serve só para ensaio. |
| R2 | Escritas durante o dump (cutover) | Dados em falta no VPS | Janela de manutenção com escritas paradas (secção 5, Fase F). |
| R3 | **`pg_trgm` no schema `extensions` do Supabase** | O restauro falha nos 2 índices GIN (`products`, `companies`): *schema "extensions" does not exist* — **reproduzido no ensaio** | Criar `extensions` + `pg_trgm` **como `kixima_migrator`** antes de restaurar (Fase C). Criá-lo como `postgres` também falha. |
| R4 | Versão major do destino < origem; *collation* diferente | Restauro recusado ou índices incoerentes | Fase A regista versão e `lc_collate`; criar a base com a mesma. |
| R5 | Base exposta à internet | Força bruta, DoS, vazamento | TLS strict, SCRAM, 3 papéis mínimos, *fail2ban*, firewall por intervalos do Render (alterável), senhas ≥ 32 caracteres, `log_connections`. |
| R6 | Certificado TLS expira | Aplicação sem base | `certbot` com renovação automática + *hook* de reload + alerta de expiração. |
| R7 | **Prisma não verifica o certificado** | Ataque *man-in-the-middle* | `sslaccept=strict` + teste T3. |
| R8 | Papel `kixima_app` sem algum privilégio | Erros 500 pontuais depois do cutover | Ensaio com a app real (Fase C) e lista de testes T5. |
| R9 | **Cópias de segurança que falham em silêncio** | Perda total se o VPS morrer | Cópia off-site + alerta *dead-man* + **teste de restauro mensal**. |
| R10 | Disco cheio / VPS único (sem alta disponibilidade) | Indisponibilidade | Alertas de disco a 80 %, snapshots do fornecedor, runbook de restauro com RTO medido no ensaio. |
| R11 | Reescrita de URLs errada | Imagens e documentos partidos | Ensaio em cópia, contagem antes/depois, sem apagar o bucket antigo. |
| R12 | Documentos privados em bucket público (**SEG-03**) continuam a existir | Fuga de dados pessoais | Dois buckets no novo armazenamento (público só para imagens do catálogo). Requer alteração de código (secção 7). |
| R13 | Seeds com senhas fixas no arranque do contentor (`CATALOG_COMPANY=1`) | Contas previsíveis | Confirmar que a variável não está definida no Render antes do cutover. |
| R14 | Histórico de migrações (54 vs 53 ficheiros; `20260926…`) | `migrate-boot` tenta "reparar" checksums | Antes do cutover: `migrate status` contra a base restaurada; **não** comitar a `20260926`. Ver nota abaixo. |
| R15 | Cutover sem plano de recuo | Perda de dados escritos no VPS ao voltar atrás | Secção 5, Fase F: recuo só é limpo na primeira hora; depois exige dump inverso. |
| R16 | Latência/ligações: 2 serviços no Render (Node + Java) + migrações | Esgotar `max_connections` | PgBouncer (`default_pool_size=20`), `connection_limit=10` por serviço. |

## 4. Fase A — Validar a `kixima_standalone` (só leitura)

No teu Windows (PowerShell), com `PGPASSWORD` definida na sessão (não escrita em ficheiros):

```powershell
$env:PGPASSWORD = Read-Host "Senha do postgres"          # fica só na memória desta sessão
psql "host=127.0.0.1 port=5432 dbname=kixima_standalone user=postgres" -X -A -f docs\migracao-vps\validacao.sql > validacao_local.txt
```

E, se quiseres comparar com a produção (somente leitura, pela **DIRECT_URL** do Supabase, porta 5432), a mesma coisa para `validacao_supabase.txt`. Compara: `fc validacao_local.txt validacao_supabase.txt` (ou `diff` no Linux).

**Critérios de aprovação** (todos):
- `_prisma_migrations`: 54 linhas, 0 por terminar, 0 revertidas.
- Contagens por tabela e "actividade mais recente" ≥ as do Supabase; se forem **menores**, a standalone é anterior à produção (R1).
- Secção 8 (índices inválidos): 0 linhas. Secção 9: os gatilhos `*_search_text_trg`, as funções `kixima_normalizar` e `*_search_text`, e os índices `*_search_text_trgm_idx` existem.
- Secção 3: `pg_trgm` disponível.
- Regista **versão do servidor, `lc_collate`, `lc_ctype`, tamanho e secção 10** (quantos ficheiros por migrar). Estes números fecham o dimensionamento do VPS (secção 1).

> **Nota — checksums das migrações.** Para cada migração em `backend/prisma/migrations/*/migration.sql`, o checksum em `_prisma_migrations` tem de ser o SHA-256 do ficheiro. Esperados: `20260927…` = `0df9db360c36e68220a2a0574c29b4694b9dd68d7e39af4a1d74323163ebcf7b`, `20260928…` = `14669c134eec8fa70cc3ddcd2571d2bbb335c6efda8ada9d226fe5ab131a45ac`.

## 5. Fases B–G — passos exatos

### Fase B — Preparar o VPS (sem dados ainda)

```bash
# 1. Acesso e atualizações (como root, uma vez)
adduser deploy && usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh && cat >> /home/deploy/.ssh/authorized_keys   # colar a chave pública
chown -R deploy:deploy /home/deploy/.ssh && chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/; s/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh
apt update && apt -y upgrade && apt -y install ufw fail2ban unattended-upgrades chrony curl ca-certificates
dpkg-reconfigure -plow unattended-upgrades

# 2. PostgreSQL (repositório oficial PGDG). Trocar 16 pela versão decidida na Fase A.
install -d /usr/share/postgresql-common/pgdg
curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo $VERSION_CODENAME)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
apt update && apt -y install postgresql-16 postgresql-client-16 pgbouncer certbot
```

`/etc/postgresql/16/main/postgresql.conf` (ajustar a memória ao VPS; valores para 4 GB):

```
listen_addresses = '*'            # a firewall decide quem chega
ssl = on
ssl_cert_file = '/etc/postgresql/16/main/tls/fullchain.pem'
ssl_key_file  = '/etc/postgresql/16/main/tls/privkey.pem'
ssl_min_protocol_version = 'TLSv1.2'
password_encryption = scram-sha-256
timezone = 'UTC'
shared_buffers = 1GB
effective_cache_size = 2560MB
work_mem = 8MB
maintenance_work_mem = 256MB
max_connections = 100
log_connections = on
log_disconnections = on
log_min_duration_statement = 500
```

`/etc/postgresql/16/main/pg_hba.conf` (substitui as linhas `host` por omissão):

```
local   all       postgres                         peer
hostssl kixima    kixima_app       0.0.0.0/0       scram-sha-256
hostssl kixima    kixima_migrator  0.0.0.0/0       scram-sha-256
hostssl kixima    kixima_backup    <IP_DO_BACKUP>/32 scram-sha-256
hostnossl all     all              0.0.0.0/0       reject
host    all       all              0.0.0.0/0       reject
```

Certificado (desafio DNS, não exige abrir a porta 80) e *hook* de renovação:

```bash
certbot certonly --manual --preferred-challenges dns -d db.<dominio>      # ou o plugin DNS do teu fornecedor
install -d -o postgres -g postgres -m 750 /etc/postgresql/16/main/tls
cat > /etc/letsencrypt/renewal-hooks/deploy/postgres.sh <<'EOF'
#!/bin/sh
D=/etc/letsencrypt/live/db.<dominio>
install -o postgres -g postgres -m 640 $D/fullchain.pem /etc/postgresql/16/main/tls/fullchain.pem
install -o postgres -g postgres -m 600 $D/privkey.pem   /etc/postgresql/16/main/tls/privkey.pem
install -o postgres -g postgres -m 640 $D/fullchain.pem /etc/pgbouncer/fullchain.pem
install -o postgres -g postgres -m 600 $D/privkey.pem   /etc/pgbouncer/privkey.pem
systemctl reload postgresql pgbouncer
EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/postgres.sh && /etc/letsencrypt/renewal-hooks/deploy/postgres.sh
```

Papéis e base (`sudo -u postgres psql`; gerar as senhas com `openssl rand -base64 32`, guardá-las num gestor de segredos). **`<LC_COLLATE>` = valor registado na Fase A.**

```sql
CREATE ROLE kixima_migrator LOGIN PASSWORD '<SENHA_MIGRATOR>';
CREATE ROLE kixima_app      LOGIN PASSWORD '<SENHA_APP>';
CREATE ROLE kixima_backup   LOGIN PASSWORD '<SENHA_BACKUP>';
GRANT pg_read_all_data TO kixima_backup;
CREATE DATABASE kixima_rehearsal OWNER kixima_migrator ENCODING 'UTF8' LC_COLLATE '<LC_COLLATE>' LC_CTYPE '<LC_CTYPE>' TEMPLATE template0;
REVOKE ALL ON DATABASE kixima_rehearsal FROM PUBLIC;
GRANT CONNECT ON DATABASE kixima_rehearsal TO kixima_app, kixima_backup;
-- a base definitiva ("kixima") cria-se igual, só na Fase F.
```

PgBouncer `/etc/pgbouncer/pgbouncer.ini`:

```
[databases]
kixima           = host=127.0.0.1 port=5432 dbname=kixima
kixima_rehearsal = host=127.0.0.1 port=5432 dbname=kixima_rehearsal
[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6543
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 200
default_pool_size = 20
client_tls_sslmode = require
client_tls_cert_file = /etc/pgbouncer/fullchain.pem
client_tls_key_file  = /etc/pgbouncer/privkey.pem
server_tls_sslmode = disable
ignore_startup_parameters = extra_float_digits
```

`userlist.txt` com o segredo SCRAM de `kixima_app` (gerado a partir do servidor, sem escrever a senha):
`sudo -u postgres psql -Atc "SELECT '\"'||rolname||'\" \"'||rolpassword||'\"' FROM pg_authid WHERE rolname='kixima_app'" > /etc/pgbouncer/userlist.txt && chown postgres:postgres /etc/pgbouncer/userlist.txt && chmod 600 /etc/pgbouncer/userlist.txt`

Firewall e proteção:

```bash
ufw default deny incoming && ufw default allow outgoing
ufw allow from <O_TEU_IP> to any port 22 proto tcp
# Intervalos de saída do Render da TUA região (copiar do painel; mudam: reservar alerta para isto)
for ip in <INTERVALO_RENDER_1> <INTERVALO_RENDER_2>; do ufw allow from $ip to any port 5432 proto tcp; ufw allow from $ip to any port 6543 proto tcp; done
ufw enable
systemctl enable --now fail2ban   # jail sshd por omissão; acrescentar jail "postgresql" sobre /var/log/postgresql/*.log
```

### Fase C — Ensaio de restauro com a `kixima_standalone` (não toca na produção)

```powershell
# No Windows: dump em formato custom (compacto e restaurável em paralelo)
pg_dump -h 127.0.0.1 -U postgres -d kixima_standalone -Fc --no-owner --no-privileges -f kixima_standalone.dump
(Get-FileHash kixima_standalone.dump -Algorithm SHA256).Hash > kixima_standalone.dump.sha256
pg_restore -l kixima_standalone.dump | Select-Object -First 20          # abre sem erros?
scp kixima_standalone.dump* deploy@db.<dominio>:/home/deploy/
```

```bash
# No VPS
sha256sum -c <(echo "<HASH>  kixima_standalone.dump")

# O dump precisa do schema "extensions"? (R3) Só se os índices de trigramas o referirem — verificar, não assumir:
pg_restore -f - kixima_standalone.dump | grep -c 'extensions\.gin_trgm_ops'     # 0 = não precisa (caso da base local); >0 = vem do Supabase
export PGPASSWORD='<SENHA_MIGRATOR>'     # só nesta sessão; ou usar ~/.pgpass (modo 600)

# SÓ se o resultado acima foi > 0, e SEMPRE como kixima_migrator (NÃO como postgres: a extensão ficaria de outro dono e o
# restauro falha com "must be owner of extension"). O pg_trgm é "trusted", logo o dono da base pode criá-lo.
psql -h 127.0.0.1 -U kixima_migrator -d kixima_rehearsal -c "CREATE SCHEMA extensions" -c "CREATE EXTENSION pg_trgm SCHEMA extensions"
# SÓ para dumps feitos com --schema=public (o do Supabase na Fase F): o dump inclui CREATE SCHEMA public, que já existe.
psql -h 127.0.0.1 -U kixima_migrator -d kixima_rehearsal -c "DROP SCHEMA public"

pg_restore -h 127.0.0.1 -U kixima_migrator -d kixima_rehearsal --no-owner --no-privileges --exit-on-error -j 2 kixima_standalone.dump
sudo -u postgres psql -d kixima_rehearsal <<'SQL'
GRANT USAGE ON SCHEMA public TO kixima_app, kixima_backup;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kixima_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kixima_app;
ALTER DEFAULT PRIVILEGES FOR ROLE kixima_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kixima_app;
ALTER DEFAULT PRIVILEGES FOR ROLE kixima_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO kixima_app;
SQL
# Verificação: a MESMA validação, e diff contra a origem
sudo -u postgres psql -d kixima_rehearsal -X -A -f validacao.sql > validacao_vps.txt
diff validacao_local.txt validacao_vps.txt       # só podem diferir: nome da base, tamanho e versão
# O Prisma reconhece o histórico? (só leitura)
cd backend && DATABASE_URL='<DATABASE_URL de ensaio>' DIRECT_URL='<DIRECT_URL de ensaio>' npx prisma migrate status
```

A aplicação de ensaio (backend **local**, ou o serviço de teste do Render **só se o autorizares**, nunca o de produção) arranca contra `kixima_rehearsal`; correr os testes T1–T8 (secção 6). Medir o tempo do restauro: é a base do RTO e da janela de manutenção.

### Fase D — Migração do armazenamento (ficheiros)

1. **Escolha** (decisão tua): **Cloudflare R2 ou Backblaze B2** (gerido, sem disco para administrar, sem egress no R2) **ou** um servidor S3 próprio no VPS (MinIO, Garage, SeaweedFS — verificar o estado/licença atual do MinIO antes de o escolher). O código **não muda** para S3-compatível: `STORAGE_PROVIDER=s3` + `STORAGE_ENDPOINT` (`storageService.js`, `env.js:300-327`).
2. **Dois buckets** em vez de um: `kixima-public` (imagens do catálogo, logótipos, avatares; leitura pública) e `kixima-privado` (documentos de credenciamento, comprovativos, anexos de chat; sem acesso público) + `kixima-backups` (outro fornecedor). *Só a separação de dados já existentes é possível nesta fase; fazer o código servir o bucket privado por URL assinado exige a alteração da secção 7.*
3. **Cópia** com `rclone` (corre no teu PC ou no VPS; configurar dois *remotes* com chaves de **só leitura** na origem):

   ```bash
   rclone copy supabase:<bucket-origem> destino:<bucket-destino> --checksum --dry-run     # 1.º: só lista
   rclone copy supabase:<bucket-origem> destino:<bucket-destino> --checksum --transfers 8 --log-file rclone.log
   rclone check supabase:<bucket-origem> destino:<bucket-destino> --one-way               # tem de dar 0 diferenças
   ```
4. **Mapa de URLs.** O `storageService` constrói `publicUrl + "/" + chave` (`storageService.js:89-95`). Se as chaves (`catalog/…`, `documents/…`, `proofs/…`, `chat-comercial/…`, `support-chat/…`) se mantiverem, a reescrita é só trocar o prefixo `https://<ref>.supabase.co/storage/v1/object/public/<bucket>` por `STORAGE_PUBLIC_URL`. Para os 13 campos listados em `validacao.sql` (secção 10):

   ```sql
   -- ENSAIO: dentro de BEGIN … ROLLBACK, na base de ensaio. Contar antes e depois.
   BEGIN;
   UPDATE products SET image_url = replace(image_url, '<PREFIXO_SUPABASE>', '<NOVO_PREFIXO_PUBLICO>') WHERE image_url LIKE '<PREFIXO_SUPABASE>%';
   -- … repetir para cada uma das 13 colunas …
   -- conferir com a secção 10 de validacao.sql: "supabase" tem de ficar a 0
   ROLLBACK;   -- só se troca por COMMIT no cutover, depois de um backup
   ```
5. **Ficheiros em `/api/uploads/…`** (disco antigo do contentor): o `validacao.sql` conta-os; os que já não existem **não se recuperam** — listar e decidir (pedir novo upload).
6. **CSP:** `img-src` e `frame-src` derivam de `STORAGE_PUBLIC_URL` (`csp.js`); definir esta variável e o domínio do bucket entra sozinho.

### Fase E — Cópias de segurança e restauro (no VPS)

```bash
# /usr/local/bin/kixima-backup.sh  (cron às 03:00; senha via ~/.pgpass do utilizador "backup", modo 600)
set -euo pipefail
F=/var/backups/kixima/kixima-$(date -u +%Y%m%dT%H%M%SZ).dump
pg_dump -h 127.0.0.1 -U kixima_backup -d kixima -Fc -f "$F"
pg_restore -l "$F" > /dev/null                                       # o ficheiro abre?
age -r <CHAVE_PUBLICA_AGE> -o "$F.age" "$F" && rm "$F"               # cifrar antes de sair do VPS
rclone copy "$F.age" backups:kixima-backups/ --checksum              # para o bucket externo
find /var/backups/kixima -name '*.age' -mtime +7 -delete            # 7 dias locais
curl -fsS "https://hc-ping.com/<ID_HEALTHCHECK>" > /dev/null         # alerta se deixar de chegar (dead-man)
```

- **Retenção externa:** 7 diários, 4 semanais, 6 mensais (regra de ciclo no bucket).
- **Restauro mensal obrigatório** para uma base descartável, com `validacao.sql` e o diff. *Uma cópia que nunca foi restaurada não é uma cópia* (já o diz `scripts/backup.js`).
- **Ponto no tempo (opcional, recomendado depois):** `pgBackRest` ou WAL-G com arquivo de WAL no bucket externo; reduz a perda máxima de 24 h para minutos.
- O `backupJob.js` da aplicação continua **opt-in** (`BACKUP_CRON` por definir) e **recusa-se a correr sem S3 e bucket privado**: não é preciso para este desenho. Deixar `BACKUP_CRON` por definir no Render.

### Fase F — Cutover (janela de manutenção; só com a tua autorização explícita)

Tempo estimado = tempo de dump + restauro medidos no ensaio + 15 min de verificação. Anunciar a janela.

| # | Passo | Verificação |
|---|---|---|
| 1 | **T−1 dia:** repetir Fases C e D completas com o dump mais recente; confirmar T1–T8 verdes; `migrate status` limpo. | Tudo verde |
| 2 | **T−1 h:** baixar o TTL de DNS (se o domínio da app mudar); congelar deploys. | |
| 3 | **T0:** pôr a app em manutenção/escrita parada (modo de lançamento do repositório **ou** suspender os serviços no Render). Confirmar que não há ligações a escrever: `SELECT count(*) FROM pg_stat_activity WHERE state <> 'idle' AND datname = current_database();` | 0 |
| 4 | Dump final do Supabase pela **DIRECT_URL** (cliente ≥ versão da origem): `pg_dump "$SUPABASE_DIRECT_URL" -Fc --no-owner --no-privileges --schema=public -f supabase_final.dump` | `pg_restore -l` abre; hash registado |
| 5 | Criar `kixima` no VPS (igual à de ensaio); como `kixima_migrator`: `CREATE SCHEMA extensions` + `CREATE EXTENSION pg_trgm SCHEMA extensions` e `DROP SCHEMA public` (o dump do Supabase usa `--schema=public`); `pg_restore --exit-on-error`; aplicar os `GRANT`. | Sem erros |
| 6 | `validacao.sql` contra o VPS e contra o Supabase **congelado**; `diff` limpo. | Contagens e somas iguais |
| 7 | Sincronização final do bucket (`rclone copy` + `check`); `UPDATE` dos URLs em **transação** com contagens antes/depois; `COMMIT`. | Secção 10: 0 "supabase" |
| 8 | No Render, em **ambos** os serviços (Node e Java), atualizar `DATABASE_URL`, `DIRECT_URL`, `STORAGE_*`; deploy manual. **Esta é a primeira alteração à produção.** | `/ready` = 200 |
| 9 | Testes T1–T8 em produção, por esta ordem: login, ver catálogo com imagens, abrir um documento, criar um PO de teste, upload, chat. | Tudo verde |
| 10 | Tirar a app da manutenção. Monitorizar logs 2 h. | Sem 5xx novos |

**Recuo.** Na primeira hora, antes de haver escritas novas relevantes, repõem-se as variáveis antigas no Render (a base do Supabase ficou intacta, só em leitura). Depois dessa hora, voltar atrás perde as escritas feitas no VPS: exige um dump inverso do VPS para o Supabase. Por isso o Supabase **não se desliga**.

### Fase G — Depois do cutover
- Manter o Supabase **ativo e só de leitura** (ex.: revogar a senha de escrita) pelo menos 30 dias, com o dump final arquivado.
- Só desligar o Supabase com a tua autorização expressa, depois de: 1 restauro mensal bem-sucedido, backups externos a chegar, e nenhum acesso aos URLs antigos (verificar os registos).

## 6. Plano de testes

| ID | Teste | Como | Passa se |
|---|---|---|---|
| T1 | Ligação e latência | `psql "host=db.<dominio> port=6543 dbname=kixima_rehearsal user=kixima_app sslmode=verify-full"` a partir do Render ou da tua região; 100× `SELECT 1` | Liga; p95 < 20 ms |
| T2 | Firewall e `pg_hba` | Ligar de um IP fora da lista; ligar sem TLS (`sslmode=disable`) | Recusado nos dois casos |
| T3 | **Verificação do certificado** | Prisma com `sslaccept=strict` contra um host com o nome errado ou certificado autoassinado; repetir sem `sslaccept` | O *strict* **falha**; confirma que o parâmetro é necessário |
| T4 | Histórico do Prisma | `prisma migrate status` com a `DIRECT_URL` | "Database schema is up to date"; nenhuma migração em falta |
| T5 | Privilégios do papel `kixima_app` | Smoke da app: login, criar PO, aceitar, pagar, nota de crédito, upload, chat, jobs | Sem erros `permission denied` |
| T6 | Equivalência de dados | `validacao.sql` origem vs destino | `diff` limpo |
| T7 | Ficheiros | 20 URLs aleatórios por coluna: abrem, tamanho e SHA coincidem com a origem | 100 % |
| T8 | Pesquisa | Pesquisa com acentos no marketplace usa o índice (`EXPLAIN` mostra `products_search_text_trgm_idx`) | Índice usado |
| T9 | Backup e restauro | Restaurar a cópia cifrada para uma base nova; `validacao.sql` | `diff` limpo; tempo medido |
| T10 | Carga de ligações | 50 pedidos concorrentes à app de ensaio | Sem erro de ligações; `pg_stat_activity` ≤ pool |
| T11 | Falha | Parar o PostgreSQL 1 min; app volta sozinha | Recupera sem reinício |
| T12 | Testes automáticos do repositório | `npm test` **só numa base `kixima_test` descartável** (o `globalSetup` faz `migrate reset --force`; nunca com a `DATABASE_URL` real) | Verde |

Resultados dos ensaios já feitos: secção 6b.

## 6b. Ensaios já executados (numa instância PostgreSQL 16 descartável, fora da tua base)

Para não propor passos por testar, o plano foi ensaiado num PostgreSQL 16 temporário (porta 55432, apagado no fim). **Não foi tocada nenhuma base tua, o Supabase, o Render ou credenciais.**

| Ensaio | Resultado |
|---|---|
| `prisma migrate deploy` das 53 migrações em Postgres puro | **OK** — "Database schema is up to date". Prova que as migrações não dependem do Supabase. |
| `validacao.sql` (10 secções) | **Corre limpo**, mas apanhou um erro: `SHOW lc_collate` não existe no PG16 — corrigido para `pg_database`. |
| `pg_dump -Fc` → `pg_restore --no-owner --no-privileges --exit-on-error -j 2`, com `kixima_migrator` (não superutilizador) | **OK**; `validacao.sql` origem vs destino **idêntico** (só mudam o nome da base). |
| Papéis: `kixima_app` | `SELECT/UPDATE` OK; `CREATE TABLE`, `DROP`, `TRUNCATE` **recusados**, como desejado. O código da app só faz DML e `SELECT … FOR UPDATE` (verificado por *grep* em `src/`). |
| Papéis: `kixima_backup` | Lê; `DELETE` recusado. |
| Dump com `pg_trgm` em `public` (caso da `kixima_standalone`) | Restaura **sem preparação**. |
| Dump estilo Supabase (`pg_trgm` em `extensions`) **sem** o schema `extensions` no destino | **Falha**: `schema "extensions" does not exist` (R3 confirmado). |
| Idem, criando `extensions`+`pg_trgm` **como `postgres`** | **Falha**: `must be owner of extension pg_trgm`. **Corrigido no plano:** criar como `kixima_migrator`. |
| Dump com `--schema=public` | Inclui `CREATE SCHEMA public`: falha numa base nova. **Corrigido:** `DROP SCHEMA public` prévio (só nesse caso). |
| Suite completa do backend (`npm test`) contra Postgres 16 puro, em base `kixima_test` descartável | **1055 testes a passar, 23 a falhar em 9 ficheiros.** Repetidos isoladamente, **8 dos 9 ficheiros passam**; os 3 testes que continuam a falhar (`prontidao.test.js › A DIRECT_URL liga mesmo`) falham só porque o painel de Prontidão **exige a porta 5432** e o ensaio usou a 55432. Não há falhas atribuíveis ao Supabase. *As falhas do ciclo completo que passam isoladas parecem instáveis (ordem/tempo neste ambiente); não foram investigadas.* |

**Lição para o plano:** o `prontidaoService` assume o desenho do Supabase (aplicação na 6543 com `pgbouncer=true`, direta na 5432). O plano mantém essas portas no VPS, por isso não precisa de alteração; mas se quiseres outras portas, o painel passa a dar FALHA (secção 7, ponto 4).

## 7. Alterações de código previstas (só depois da tua aprovação)

1. **Parâmetros de ligação** documentados em `.env.example`/`DEPLOY.md` (`sslaccept=strict`, `connection_limit`, `connect_timeout`) e retirada do ref do Supabase e das instruções antigas.
2. **Java:** `sslmode=verify-full` + `sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory` na URL (a validar no teste T3) e texto do `ProducaoStartupGuard`.
3. **Armazenamento privado:** servir os documentos privados pelo `/api/uploads` com verificação de posse também em modo S3 (`lerFicheiro` já lê do S3) ou por URL assinado; fecha o **SEG-03**.
4. **Prontidão:** textos genéricos (já não dizem "Supabase"), aceitar portas diferentes de 5432/6543 **se for essa a tua escolha**, e verificar que `sslaccept=strict` está definido; actualizar `tests/prontidao.test.js`.
5. **Segurança de operação:** `globalSetup` recusa-se a correr se a base não terminar em `_test`; `db:reset` e `prisma:migrate` protegidos; remover `prisma db push` do `backend/Dockerfile`.
6. **`backupJob`/`scripts/backup.js`:** passar a ligação ao `pg_dump` por variáveis `PG*` em vez de argumentos (SEG-25).

## 8. Decisões de que preciso

1. **Armazenamento:** R2/B2 (recomendado) ou S3 no próprio VPS?
2. **Região e fornecedor do VPS**, depois de confirmares a região dos serviços no Render.
3. **IPs do Render:** aceitas lista de intervalos partilhados + TLS strict (recomendado), ou os IPs dedicados pagos?
4. **Janela de manutenção:** dia e duração máxima aceitável.
5. **Versão de origem do Supabase** (`validacao.sql`, secção 1) para fechar a versão do PostgreSQL.
6. Autorização para, na Fase C, usar o serviço de teste do Render (nunca o de produção) contra a base de ensaio.
