# M8 — Plano de migração de dados: Supabase → PostgreSQL próprio

Sequência para mover a base de dados do KIXIMA do Supabase para um
PostgreSQL próprio, com os scripts de `scripts/migracao/` (Windows
PowerShell 5.1+, cliente PostgreSQL 17 instalado). Destino nesta etapa:
`localhost:5432`, base `kixima`, que **já existe e não é apagada nem
recriada** por nenhum passo.

Regras que os scripts cumprem e que quem executa também cumpre:

- nenhuma credencial fica em ficheiros do repositório: connection string em
  `$env:SUPABASE_DATABASE_URL`, password do destino em `$env:PGPASSWORD`
  (ou pedida sem eco); a password nunca aparece no ecrã, em logs nem na
  linha de comandos;
- nada de `DROP DATABASE`; nada de alterar linhas das tabelas de negócio;
  chaves continuam UUID (não há IDs sequenciais para converter);
- Storage não é migrado aqui (`STORAGE.md`): a base restaurada continua a
  apontar aos ficheiros do Supabase Storage.

O que o repositório espera encontrar (inventário em
`SUPABASE-DEPENDENCIES.md`): 49 tabelas + `_prisma_migrations` (55 migrações),
36 enums, `pg_trgm`, 3 funções e 2 triggers de pesquisa, nenhuma vista nem
sequence; contadores de referência na tabela `reference_counters`.

## Informação que tem de fornecer (nunca a escreva no repositório)

| O quê | Onde se usa | Onde a obtém |
|---|---|---|
| Connection string de **sessão** do Supabase (porta **5432**, `?sslmode=require`) | `$env:SUPABASE_DATABASE_URL` (passos 1 e 2) | Supabase → Project Settings → Database → Connection string → *Session pooler*. É o valor que o projecto chama `DIRECT_URL`. **Não** a de transacção (6543) nem o host `db.<ref>.supabase.co` |
| Utilizador e password do PostgreSQL próprio | `-User …` + `$env:PGPASSWORD` (passos 5 a 9) | quem administra o servidor; o utilizador precisa de poder criar objectos em `kixima` e `CREATE EXTENSION pg_trgm` (extensão *trusted*: o dono da base chega) |
| Pasta do cliente PostgreSQL, se não estiver no PATH | `-PgBin 'C:\Program Files\PostgreSQL\17\bin'` ou `$env:PG_BIN` | instalação do PostgreSQL |
| Janela de manutenção | passos 1-2 | a aplicação **parada** (ou só leitura) durante o backup, para as contagens e o dump coincidirem |

## Sequência

Todos os comandos a partir da raiz do repositório, em PowerShell.

### 1. Backup do Supabase

```powershell
$env:SUPABASE_DATABASE_URL = "postgresql://postgres.<ref>:<password>@aws-0-<regiao>.pooler.supabase.com:5432/postgres?sslmode=require"
.\scripts\migracao\01-backup-supabase.ps1            # -PgBin 'C:\Program Files\PostgreSQL\17\bin' se preciso
```

Produz `backup\kixima-supabase-AAAAMMDD-HHMMSS.dump`, `.sha256` e `.log`.
Ainda com a aplicação parada, exporte as contagens da origem (o `05` precisa
delas) e, opcionalmente, o esquema da origem para o `04` comparar:

```powershell
$env:PGPASSWORD = "<password do Supabase>"
$o = @{ h = 'aws-0-<regiao>.pooler.supabase.com'; p = 5432; U = 'postgres.<ref>'; d = 'postgres' }
psql -X --csv -h $o.h -p $o.p -U $o.U -d $o.d -f scripts\migracao\sql\contagens.sql   > backup\contagens-origem.csv
New-Item -ItemType Directory backup\origem -Force | Out-Null
foreach ($f in 'not-null','enums','indices','constraints') {
  psql -X --csv -h $o.h -p $o.p -U $o.U -d $o.d -f "scripts\migracao\sql\$f.sql" > "backup\origem\$f.csv"
}
Remove-Item Env:PGPASSWORD
```

### 2. Verificar o backup

```powershell
.\scripts\migracao\02-inspecionar-backup.ps1 -Dump backup\kixima-supabase-<data>.dump
```

Confirma o SHA-256 e mostra o índice do dump: tem de listar as 50 tabelas
esperadas, 36 tipos, as 3 funções e os 2 triggers. Um aviso sobre `pg_trgm`
ausente é normal (no Supabase vive fora de `public`).

### 3. Auditar o backup

Leia `backup\<dump>.toc.txt` e `backup\<dump>.inventario.csv` gerados no
passo 2. Guarde o `.dump`, o `.sha256` e o `contagens-origem.csv` fora da
máquina de trabalho antes de continuar.

### 4. Preparar o PostgreSQL de destino

- Servidor PostgreSQL 15+ (recomendado 17, a versão do Supabase) com a base
  `kixima` criada e vazia (`SELECT count(*) FROM information_schema.tables WHERE table_schema='public'` = 0).
  O script 3 recusa se houver objectos.
- Utilizador com permissão para criar objectos em `kixima` e a extensão
  `pg_trgm` (o script cria-a: `CREATE EXTENSION IF NOT EXISTS pg_trgm`).
- Se o servidor exigir TLS, acrescente `?sslmode=require` na `KIXIMA_DATABASE_URL`.

### 5. Restore

```powershell
$env:PGPASSWORD = "<password do destino>"
.\scripts\migracao\03-restore-postgres.ps1 -Dump backup\kixima-supabase-<data>.dump -User <utilizador> -SoSimular   # mostra o comando
.\scripts\migracao\03-restore-postgres.ps1 -Dump backup\kixima-supabase-<data>.dump -User <utilizador>
```

`pg_restore --no-owner --no-acl --no-privileges --schema=public --jobs 2`,
seguido de `ANALYZE`. O log fica em `backup\<dump>.restore-<data>.log`.
Erros "role … does not exist" são normais num dump do Supabase; erros em
`TABLE DATA` ou `CONSTRAINT` não são — pare e corrija antes de seguir.
Se precisar de repetir o restore na mesma base, a única forma é
`-LimparObjectos` (apaga e recria os objectos de `public`, pede confirmação
escrita) — ou restaurar para uma base nova criada por si.

### 6. Corrigir sequences e contadores

```powershell
.\scripts\migracao\06-sincronizar-sequences.ps1 -User <utilizador>            # relatório
.\scripts\migracao\06-sincronizar-sequences.ps1 -User <utilizador> -Aplicar   # só se houver "DESALINHADA"/"DESALINHADO"
```

Para cada sequence: nome, tabela, coluna, `MAX`, `last_value`, próximo valor.
No KIXIMA o relatório de sequences deve vir vazio (chaves UUID); o dos
contadores `reference_counters` deve dar `OK` em todas as chaves, porque a
tabela vem inteira no dump.

### 7. Validar o esquema

```powershell
.\scripts\migracao\04-validar-migracao.ps1 -User <utilizador> -Origem backup\origem
```

Tabelas, PK/FK/UNIQUE/CHECK, NOT NULL, índices, enums, extensões, funções e
triggers — comparados com o que o repositório espera e, com `-Origem`, com
os CSV exportados da origem. Relatórios em `backup\relatorios\<data>\`.

### 8. Comparar registos

```powershell
.\scripts\migracao\05-comparar-registos.ps1 -Origem backup\contagens-origem.csv -User <utilizador>
```

Gera `backup\migration-manifest.csv` (`table_name, source_rows, target_rows,
status, notes`). Tudo `OK` é a condição para continuar; `DIFERENTE` em
`audit_logs`/`notifications` costuma significar que a origem não estava
parada quando as contagens foram tiradas.

### 9. Validar integridade

Já incluído no passo 7 (`integridade-fk.sql`: 0 órfãos em todas as FKs;
constraints todas validadas; índices todos válidos). Repita o 04 depois de
qualquer correcção.

### 10. Apontar o Java (e o Node) ao PostgreSQL próprio

Variáveis, sem alterar código:

```
DATABASE_URL=postgresql://<utilizador>:<password>@<host>:5432/kixima
DIRECT_URL=postgresql://<utilizador>:<password>@<host>:5432/kixima
```

Sem `pgbouncer=true` (o Java deixa de acrescentar `prepareThreshold=0`).
`DATABASE_URL_JDBC`/`DATABASE_USER`/`DATABASE_PASSWORD` continuam opcionais
no Java. `DB_POOL_MAX` pode subir depois de medir. `STORAGE_*` **não muda**.

### 11. Executar os testes

Contra uma cópia da base migrada (nunca contra a própria `kixima` — a suite
Node faz `prisma migrate reset`):

```powershell
# backend Node (usa a sua própria base de testes; confirma o código, não os dados)
cd backend; npm test; cd ..
# backend Java, apontado à cópia
cd backend-java; mvn -q test; cd ..
```

E, apontado à base migrada, `GET /ready` nos dois backends (`SELECT 1` com
tecto de 3 s) e a página Prontidão do Admin do Sistema — que vai avisar
sobre porta/pgbouncer porque ainda "pensa" em Supabase; é esperado até o
cutover ajustar esses avisos (`SUPABASE-DEPENDENCIES.md` §1).

### 12. Smoke test

Com a aplicação apontada ao PostgreSQL próprio, uma vez por domínio:
login de cada persona; catálogo e pesquisa (exercita `pg_trgm` e os triggers
de `search_text`); criar uma PO de teste e aprová-la; emitir e ver uma
factura (referência nova `FAT-<ano>-…` sem colisão — prova os contadores);
uma imagem de produto a carregar no browser (prova que os URLs do Storage
continuam válidos); `npm run backup` contra o novo servidor.

### 13. Cutover

Aplicar no ambiente de produção as variáveis do passo 10, com o Supabase
ainda intacto como caminho de recuo durante a janela combinada
(`docs/migracao-java/M8-CUTOVER.md` §4 aplica-se igual: recuar é voltar a
apontar as variáveis ao Supabase). Só no fim da janela desligar a base do
Supabase — o Storage fica até ter o seu próprio plano (`STORAGE.md`).

## Depois da migração (não faz parte desta etapa)

- Ajustar os avisos da página Prontidão (Node e Java) que assumem pooler
  Supabase, e a documentação de deploy (`DEPLOY.md`, `README.md`,
  `render.yaml`, `backend/.env.example`).
- Decidir a migração do Storage (`STORAGE.md`).
- Cópias de segurança: `backend/scripts/backup.js` continua a funcionar com a
  nova `DIRECT_URL`; o ensaio `npm run backup:restore-test` passa a poder
  correr no próprio servidor.
