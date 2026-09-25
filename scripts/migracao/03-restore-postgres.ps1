<#
.SYNOPSIS
  Restaura o dump do Supabase no PostgreSQL próprio (localhost:5432/kixima).

.DESCRIPTION
  Estratégia para migração entre servidores PostgreSQL diferentes:
    pg_restore --no-owner --no-acl --no-privileges --schema=public
  (os donos/roles do Supabase não existem aqui; os objectos ficam do utilizador
  que restaura). Antes do restore garante a extensão pg_trgm (idempotente:
  CREATE EXTENSION IF NOT EXISTS), porque no Supabase ela vive fora de public e
  não vem no dump.

  NUNCA faz DROP DATABASE nem cria a base: a base `kixima` tem de existir.
  Se o esquema public já tiver tabelas, o script RECUSA e explica as opções.
  A única forma de remover objectos é -LimparObjectos, que pede confirmação
  escrita e usa pg_restore --clean --if-exists (objecto a objecto, dentro da
  base, nunca a base).

  Destino: $env:KIXIMA_DATABASE_URL, ou -Host/-Port/-Database/-User com a
  password em $env:PGPASSWORD (ou pedida sem eco).

    $env:PGPASSWORD = "..."
    .\scripts\migracao\03-restore-postgres.ps1 -Dump backup\kixima-supabase-....dump -User postgres

.PARAMETER Jobs
  Trabalhos paralelos do pg_restore (formato custom permite). 1 = sequencial.
.PARAMETER SoSimular
  Mostra o que faria (comando completo, sem password) e sai.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Dump,
  [string]$Url = '',
  [string]$Servidor = 'localhost',
  [int]$Port = 5432,
  [string]$Database = 'kixima',
  [string]$User = '',
  [string]$PgBin = '',
  [int]$Jobs = 2,
  [switch]$LimparObjectos,
  [switch]$SoSimular
)
. (Join-Path $PSScriptRoot 'comum.ps1')

if (-not (Test-Path $Dump)) { Write-Erro "Não existe: $Dump"; exit 2 }
$pgrestore = Resolve-PgTool -Nome pg_restore -PgBin $PgBin
$lig = Get-LigacaoDestino -Url $Url -Servidor $Servidor -Port $Port -Database $Database -User $User
$log = "$Dump.restore-$(New-Carimbo).log"

Write-Passo ("Destino: " + (Format-LigacaoMascarada $lig))
if ($lig.Database -ne 'kixima') { Write-Aviso "A base de destino é '$($lig.Database)', não 'kixima'." }

Write-Passo 'Estado do destino'
$versao = Invoke-Psql -Ligacao $lig -Sql 'select version();' -PgBin $PgBin
Write-Host ("   " + $versao.Trim())
$nTabelas = [int](Invoke-Psql -Ligacao $lig -Sql "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';" -PgBin $PgBin).Trim()
$nTipos   = [int](Invoke-Psql -Ligacao $lig -Sql "select count(*) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e';" -PgBin $PgBin).Trim()
Write-Host "   tabelas em public: $nTabelas · enums: $nTipos"

if (($nTabelas -gt 0 -or $nTipos -gt 0) -and -not $LimparObjectos) {
  Write-Erro "A base '$($lig.Database)' já tem objectos no esquema public. Este script não apaga nada por si."
  Write-Host  '   Opções:'
  Write-Host  '     a) restaurar para uma base nova criada por si (CREATE DATABASE kixima_migracao …) e passar -Database kixima_migracao;'
  Write-Host  '     b) -LimparObjectos: pg_restore --clean --if-exists (apaga e recria objecto a objecto DENTRO da base; pede confirmação).'
  exit 3
}
if ($LimparObjectos) {
  Write-Aviso "-LimparObjectos vai apagar e recriar as tabelas/tipos/funções do esquema public de '$($lig.Database)' em $($lig.Host):$($lig.Port)."
  $conf = Read-Host '   Escreva SIM para continuar'
  if ($conf -ne 'SIM') { Write-Host '   cancelado.'; exit 4 }
}

$argumentos = @(
  '-h', $lig.Host, '-p', $lig.Port, '-U', $lig.User, '-d', $lig.Database,
  '--format=custom', '--schema=public',
  '--no-owner', '--no-acl', '--no-privileges', '--no-security-labels',
  '--jobs', $Jobs
)
if ($LimparObjectos) { $argumentos += @('--clean', '--if-exists') }
$argumentos += $Dump

if ($SoSimular) {
  Write-Passo 'Simulação (não executa)'
  Write-Host ("   CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- em " + (Format-LigacaoMascarada $lig))
  Write-Host ("   " + $pgrestore + ' ' + ($argumentos -join ' '))
  exit 0
}

Write-Passo 'Preparar o destino: extensão pg_trgm (idempotente)'
Invoke-Psql -Ligacao $lig -Sql 'CREATE EXTENSION IF NOT EXISTS pg_trgm;' -PgBin $PgBin | Out-Null
Write-Ok 'pg_trgm disponível'

Write-Passo "Restore (log em $log)"
$inicio = Get-Date
$codigo = Invoke-PgTool -Exe $pgrestore -Argumentos $argumentos -Ligacao $lig -Log $log
$erros = @(Get-Content $log | Where-Object { $_ -match 'pg_restore: (error|erro)' })
Write-Host ("   terminou em {0:N0}s com código {1}; {2} linhas de erro no log" -f ((Get-Date) - $inicio).TotalSeconds, $codigo, $erros.Count)
if ($codigo -ne 0 -or $erros.Count -gt 0) {
  Write-Aviso 'Reveja o log. Erros de "role … does not exist"/"must be owner" são típicos de dumps do Supabase e inofensivos com --no-owner; qualquer erro em TABLE DATA ou CONSTRAINT NÃO é.'
  $erros | Select-Object -First 15 | ForEach-Object { Write-Host ('   ' + $_) }
}

Write-Passo 'Depois do restore'
$nTabelas2 = [int](Invoke-Psql -Ligacao $lig -Sql "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';" -PgBin $PgBin).Trim()
$migracoes = (Invoke-Psql -Ligacao $lig -Sql "select count(*) || ' aplicadas, ' || coalesce(max(migration_name),'-') as m from _prisma_migrations;" -PgBin $PgBin).Trim()
Write-Host "   tabelas em public: $nTabelas2 (esperadas 50 = 49 + _prisma_migrations)"
Write-Host "   _prisma_migrations: $migracoes (esperadas 55, a última 20260928000000_indices_invoice_auditlog_platform_fee)"
Invoke-Psql -Ligacao $lig -Sql 'ANALYZE;' -PgBin $PgBin | Out-Null
Write-Ok 'ANALYZE feito (estatísticas para o planeador)'

Write-Host "`nPróximos passos:"
Write-Host "   .\scripts\migracao\06-sincronizar-sequences.ps1            (relatório; -Aplicar só se houver sequences desalinhadas)"
Write-Host "   .\scripts\migracao\04-validar-migracao.ps1"
Write-Host "   .\scripts\migracao\05-comparar-registos.ps1 -Origem backup\contagens-origem.csv"
