<#
.SYNOPSIS
  Cópia completa da base de dados KIXIMA no Supabase (pg_dump, formato custom).

.DESCRIPTION
  Gera backup/kixima-supabase-AAAAMMDD-HHMMSS.dump (+ .sha256 e .log) com o
  esquema public inteiro: tabelas, dados, enums, índices, constraints, funções,
  triggers e a tabela _prisma_migrations (para o histórico do Prisma seguir
  intacto para o destino).

  A connection string chega por variável ou parâmetro — nunca fica no código:

    $env:SUPABASE_DATABASE_URL = "postgresql://postgres.<ref>:<password>@aws-0-<regiao>.pooler.supabase.com:5432/postgres?sslmode=require"
    .\scripts\migracao\01-backup-supabase.ps1

  USE A LIGAÇÃO DE SESSÃO (porta 5432, a mesma que o projecto chama DIRECT_URL).
  O pooler de transacção (porta 6543, pgbouncer=true) não serve para pg_dump:
  o script avisa e recusa, a não ser que se passe -IgnorarAvisoPooler.
  O host directo db.<ref>.supabase.co só resolve em IPv6 — se falhar a ligar,
  use o pooler de sessão.

  Só o esquema public é copiado: os esquemas auth, storage, realtime,
  extensions, vault… são do Supabase e não existem no PostgreSQL próprio.
  --no-owner/--no-acl: os donos e permissões do Supabase (postgres,
  supabase_admin, anon, authenticated…) não existem no destino.

.PARAMETER Url
  Connection string; se omitida usa $env:SUPABASE_DATABASE_URL.
.PARAMETER PgBin
  Pasta do cliente PostgreSQL (ex.: 'C:\Program Files\PostgreSQL\16\bin').
.PARAMETER Pasta
  Pasta de saída (por omissão: backup/ na raiz do repositório).
.PARAMETER Paralelo
  Não usado no formato custom (fica para um futuro -Fd); mantido por clareza.
#>
[CmdletBinding()]
param(
  [string]$Url = '',
  [string]$PgBin = '',
  [string]$Pasta = '',
  [switch]$IgnorarAvisoPooler,
  [switch]$Verboso
)
. (Join-Path $PSScriptRoot 'comum.ps1')

Write-Passo 'Backup do Supabase (pg_dump)'
if (-not $Url) { $Url = $env:SUPABASE_DATABASE_URL }
if (-not $Url) {
  Write-Erro 'Defina $env:SUPABASE_DATABASE_URL (ou -Url) com a connection string de SESSÃO do Supabase (porta 5432).'
  exit 2
}
$lig = ConvertFrom-PgUrl $Url
Write-Host ("   origem: " + (Format-LigacaoMascarada $lig))

if (($lig.Port -eq 6543 -or $lig.Pgbouncer) -and -not $IgnorarAvisoPooler) {
  Write-Erro 'Esta é a ligação do pooler de TRANSACÇÃO (porta 6543 / pgbouncer=true). O pg_dump precisa de uma sessão estável: use a ligação de sessão (porta 5432, a DIRECT_URL do projecto). Para forçar: -IgnorarAvisoPooler.'
  exit 2
}
if ($lig.Host -match '^db\..*\.supabase\.co$') {
  Write-Aviso 'Host directo db.<ref>.supabase.co: só resolve em IPv6. Se a ligação falhar, use aws-0-<regiao>.pooler.supabase.com:5432.'
}
if (-not $lig.SslMode) { $lig.SslMode = 'require'; Write-Aviso 'sslmode não indicado: a usar require.' }

$pgdump    = Resolve-PgTool -Nome pg_dump -PgBin $PgBin
$pgrestore = Resolve-PgTool -Nome pg_restore -PgBin $PgBin
Write-Host ("   pg_dump: " + $pgdump)
& $pgdump --version | Out-Host

if (-not $Pasta) { $Pasta = Get-PastaBackup }
if (-not (Test-Path $Pasta)) { New-Item -ItemType Directory -Path $Pasta | Out-Null }
$carimbo = New-Carimbo
$dump = Join-Path $Pasta ("kixima-supabase-{0}.dump" -f $carimbo)
$log  = "$dump.log"

$argumentos = @(
  '-h', $lig.Host, '-p', $lig.Port, '-U', $lig.User, '-d', $lig.Database,
  '--format=custom', '--compress=6',
  '--schema=public',
  '--no-owner', '--no-acl', '--no-privileges', '--no-security-labels',
  '--file', $dump
)
if ($Verboso) { $argumentos += '--verbose' }

Write-Passo 'A copiar (pode demorar; a password vai por PGPASSWORD, nunca no ecrã)'
$inicio = Get-Date
$codigo = Invoke-PgTool -Exe $pgdump -Argumentos $argumentos -Ligacao $lig -Log $log
if ($codigo -ne 0 -or -not (Test-Path $dump)) {
  Write-Erro "pg_dump terminou com código $codigo. Veja $log."
  exit 1
}
$tamanho = (Get-Item $dump).Length
Write-Ok ("{0} ({1:N1} MB em {2:N0}s)" -f $dump, ($tamanho / 1MB), ((Get-Date) - $inicio).TotalSeconds)

Write-Passo 'Verificação rápida do ficheiro (pg_restore --list)'
$toc = & $pgrestore --list $dump 2>&1
if ($LASTEXITCODE -ne 0) { Write-Erro 'O ficheiro não é um dump custom legível.'; exit 1 }
$tabelas = @($toc | Where-Object { $_ -match '\sTABLE\s+public\s' }).Count
$dados   = @($toc | Where-Object { $_ -match '\sTABLE DATA\s+public\s' }).Count
Write-Ok "$tabelas tabelas, $dados blocos de dados no dump"
if ($tabelas -lt 49) { Write-Aviso "Esperava 49 tabelas (schema.prisma) + _prisma_migrations; conte com o 02-inspecionar-backup.ps1." }

$sha = Get-Sha256 $dump
Write-Utf8SemBom "$dump.sha256" ("{0}  {1}`n" -f $sha, (Split-Path $dump -Leaf))
Write-Ok "SHA-256: $sha (guardado em $dump.sha256)"

Write-Host "`nPróximo passo: .\scripts\migracao\02-inspecionar-backup.ps1 -Dump `"$dump`""
