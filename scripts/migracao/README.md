# scripts/migracao — Supabase PostgreSQL → PostgreSQL próprio

Ferramenta para copiar a base de dados do KIXIMA do Supabase para um PostgreSQL
próprio (`localhost:5432/kixima`), validar a cópia e alinhar contadores.
Windows PowerShell 5.1 ou superior, com o cliente PostgreSQL instalado
(`pg_dump`, `pg_restore`, `psql` — versão principal igual ou superior à do
servidor de destino; o Supabase corre 15 ou 17, use o cliente 17).

Nenhum script guarda credenciais: a connection string do Supabase vai em
`$env:SUPABASE_DATABASE_URL`, a password do destino em `$env:PGPASSWORD`
(ou é pedida sem eco), e a password nunca aparece no ecrã, nos logs nem na
linha de comandos (vai por `PGPASSWORD` ao processo filho).

| Script | O que faz | Toca em dados? |
|---|---|---|
| `01-backup-supabase.ps1` | `pg_dump` custom do esquema `public` → `backup/kixima-supabase-<data>.dump` + `.sha256` + `.log` | não (lê a origem) |
| `02-inspecionar-backup.ps1 -Dump …` | `pg_restore --list`: esquemas, tabelas, dados, sequences, índices, constraints, funções, triggers, tipos; compara com o schema.prisma | não |
| `03-restore-postgres.ps1 -Dump …` | `pg_restore --no-owner --no-acl` em `kixima`; cria `pg_trgm`; recusa se `public` já tiver objectos; `ANALYZE` | escreve no destino |
| `04-validar-migracao.ps1` | corre os SQL de `sql/` no destino → `backup/relatorios/<data>/*.csv` e um veredicto | não |
| `05-comparar-registos.ps1 -Origem …` | `migration-manifest.csv` (origem × destino, tabela a tabela) | não |
| `06-sincronizar-sequences.ps1 [-Aplicar]` | relatório de sequences e contadores; com `-Aplicar`, `setval` e contadores ≥ máximo | só com `-Aplicar` |

Nunca: `DROP DATABASE`, criar a base, alterar linhas das tabelas de negócio,
converter chaves para UUID (já o são).

## SQL em `sql/`

Todos só de leitura excepto os dois `*-sincronizar.sql`. Correm nos dois lados
com `psql -X --csv -f`: é assim que se obtêm os CSV da origem para o `04`
(`-Origem <pasta>`) e o `05` (`-Origem contagens-origem.csv`).

| Ficheiro | Conteúdo |
|---|---|
| `contagens.sql` | `count(*)` exacto de cada tabela (`table_name,row_count`) |
| `tabelas.sql` | tabelas, nº de colunas, PK, tamanho |
| `constraints.sql` | PK / FK / UNIQUE / CHECK com colunas, tabela referenciada e `ON DELETE` |
| `not-null.sql` | todas as colunas: tipo, `is_nullable`, omissão, precisão |
| `indices.sql` | índices com definição, `is_unique`, `is_valid` |
| `enums.sql` | 36 enums com os valores por ordem |
| `extensoes.sql` | extensões (`pg_trgm` obrigatória) |
| `funcoes-triggers.sql` | 3 funções + 2 triggers de pesquisa; vistas (nenhuma) |
| `integridade-fk.sql` | órfãos por FK (tem de dar 0) |
| `sequences-relatorio.sql` | sequence, tabela, coluna, `MAX`, `last_value`, próximo valor, estado |
| `sequences-sincronizar.sql` | `setval` de cada sequence para o `MAX` |
| `reference-counters.sql` | contadores `PO-2026`, `FAT-2026`… vs maior número usado |
| `reference-counters-sincronizar.sql` | sobe os contadores para o máximo (nunca desce) |
| `tabelas-esperadas.txt` | as 49 tabelas do `schema.prisma` + `_prisma_migrations` |

A sequência completa, com os comandos por ordem, está em
`docs/migracao-postgresql/M8-DATA-PLAN.md`.
