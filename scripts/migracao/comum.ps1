# scripts/migracao/comum.ps1
# Funções partilhadas pelos scripts de migração Supabase → PostgreSQL próprio.
# Carregado com ". $PSScriptRoot\comum.ps1" por cada script. Windows PowerShell 5.1+.
#
# Regras que todos os scripts cumprem:
#   - a connection string chega por variável de ambiente ou parâmetro, nunca fica
#     no código nem em ficheiros do repositório;
#   - a password NUNCA é escrita no ecrã nem nos relatórios (só a forma mascarada);
#   - a password vai às ferramentas do Postgres por PGPASSWORD no processo filho,
#     nunca na linha de comandos (visível no Gestor de Tarefas).

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$env:PGCLIENTENCODING = 'UTF8'

function Get-RaizRepo {
  # scripts/migracao/ → raiz do repositório.
  return (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}

function Get-PastaBackup {
  $pasta = Join-Path (Get-RaizRepo) 'backup'
  if (-not (Test-Path $pasta)) { New-Item -ItemType Directory -Path $pasta | Out-Null }
  return $pasta
}

function New-Carimbo {
  return (Get-Date).ToString('yyyyMMdd-HHmmss')
}

function Write-Passo([string]$Texto) { Write-Host ("`n== " + $Texto) -ForegroundColor Cyan }
function Write-Ok([string]$Texto)    { Write-Host ("   OK  " + $Texto) -ForegroundColor Green }
function Write-Aviso([string]$Texto) { Write-Host ("   !!  " + $Texto) -ForegroundColor Yellow }
function Write-Erro([string]$Texto)  { Write-Host ("   XX  " + $Texto) -ForegroundColor Red }

function Resolve-PgTool {
  # Encontra pg_dump/pg_restore/psql: parâmetro -PgBin, variável PG_BIN, PATH,
  # ou a instalação por omissão do Windows (C:\Program Files\PostgreSQL\<versão>\bin).
  param([Parameter(Mandatory)][string]$Nome, [string]$PgBin = '')
  $exe = if ($env:OS -eq 'Windows_NT') { "$Nome.exe" } else { $Nome }
  $candidatos = @()
  if ($PgBin) { $candidatos += (Join-Path $PgBin $exe) }
  if ($env:PG_BIN) { $candidatos += (Join-Path $env:PG_BIN $exe) }
  $noPath = Get-Command $Nome -ErrorAction SilentlyContinue
  if ($noPath) { $candidatos += $noPath.Source }
  $pf = 'C:\Program Files\PostgreSQL'
  if (Test-Path $pf) {
    Get-ChildItem $pf -Directory | Sort-Object { [int]($_.Name -replace '\D', '0') } -Descending | ForEach-Object {
      $candidatos += (Join-Path $_.FullName ("bin\" + $exe))
    }
  }
  foreach ($c in $candidatos) { if ($c -and (Test-Path $c)) { return $c } }
  throw "Não encontrei '$Nome'. Instale o cliente PostgreSQL (mesma versão principal do servidor de destino ou superior) e use -PgBin 'C:\Program Files\PostgreSQL\16\bin' ou defina `$env:PG_BIN."
}

function ConvertFrom-PgUrl {
  # postgresql://utilizador:password@host:porta/base?sslmode=require&pgbouncer=true
  # Devolve um objecto com as partes já descodificadas (a password pode vir
  # percent-encoded: '%40' → '@').
  param([Parameter(Mandatory)][string]$Url)
  $u = $Url.Trim().Trim('"').Trim("'")
  $m = [regex]::Match($u, '^(?<esquema>postgres(ql)?)://(?:(?<user>[^:@/]+)(?::(?<pass>[^@]*))?@)?(?<host>[^:/?]+)(?::(?<port>\d+))?/(?<db>[^?]+)(?:\?(?<query>.*))?$')
  if (-not $m.Success) { throw 'A connection string não tem o formato postgresql://utilizador:password@host:porta/base?parametros' }
  $query = @{}
  if ($m.Groups['query'].Value) {
    foreach ($par in $m.Groups['query'].Value -split '&') {
      if ($par -match '^([^=]+)=(.*)$') { $query[$Matches[1]] = [Uri]::UnescapeDataString($Matches[2]) }
    }
  }
  $porta = if ($m.Groups['port'].Value) { [int]$m.Groups['port'].Value } else { 5432 }
  return [pscustomobject]@{
    Host      = $m.Groups['host'].Value
    Port      = $porta
    User      = [Uri]::UnescapeDataString($m.Groups['user'].Value)
    Password  = [Uri]::UnescapeDataString($m.Groups['pass'].Value)
    Database  = [Uri]::UnescapeDataString($m.Groups['db'].Value)
    Query     = $query
    SslMode   = $query['sslmode']
    Pgbouncer = ($query['pgbouncer'] -eq 'true')
  }
}

function Format-LigacaoMascarada($Lig) {
  # Para logs e relatórios: nunca a password.
  return ('{0}@{1}:{2}/{3}' -f $Lig.User, $Lig.Host, $Lig.Port, $Lig.Database)
}

function Get-LigacaoDestino {
  # Destino por omissão: localhost:5432/kixima. Aceita KIXIMA_DATABASE_URL
  # (connection string completa) ou os parâmetros soltos; a password vem de
  # PGPASSWORD ou é pedida sem eco.
  param([string]$Url = '', [string]$Servidor = 'localhost', [int]$Port = 5432, [string]$Database = 'kixima', [string]$User = '')
  if (-not $Url -and $env:KIXIMA_DATABASE_URL) { $Url = $env:KIXIMA_DATABASE_URL }
  if ($Url) { return (ConvertFrom-PgUrl $Url) }
  if (-not $User) { $User = if ($env:PGUSER) { $env:PGUSER } else { 'postgres' } }
  $pass = $env:PGPASSWORD
  if (-not $pass) {
    $seguro = Read-Host -AsSecureString ("Password de $User@$Servidor`:$Port/$Database (não fica gravada)")
    $pass = (New-Object System.Net.NetworkCredential('', $seguro)).Password
  }
  return [pscustomobject]@{ Host = $Servidor; Port = $Port; User = $User; Password = $pass; Database = $Database; Query = @{}; SslMode = $null; Pgbouncer = $false }
}

function Invoke-PgTool {
  # Corre uma ferramenta do Postgres com a password em PGPASSWORD (só no
  # processo filho) e devolve o código de saída. A saída vai para o ecrã e,
  # se pedido, para um ficheiro de log.
  param(
    [Parameter(Mandatory)][string]$Exe,
    [Parameter(Mandatory)][string[]]$Argumentos,
    [Parameter(Mandatory)]$Ligacao,
    [string]$Log = ''
  )
  $anterior = @{ PGPASSWORD = $env:PGPASSWORD; PGSSLMODE = $env:PGSSLMODE }
  try {
    $env:PGPASSWORD = $Ligacao.Password
    if ($Ligacao.SslMode) { $env:PGSSLMODE = $Ligacao.SslMode }
    if ($Log) {
      & $Exe @Argumentos 2>&1 | Tee-Object -FilePath $Log -Append | Out-Host
    } else {
      & $Exe @Argumentos 2>&1 | Out-Host
    }
    return $LASTEXITCODE
  } finally {
    $env:PGPASSWORD = $anterior.PGPASSWORD
    $env:PGSSLMODE = $anterior.PGSSLMODE
  }
}

function Invoke-Psql {
  # psql -X -q -v ON_ERROR_STOP=1 … devolve a saída como texto (CSV quando -Csv).
  param(
    [Parameter(Mandatory)]$Ligacao,
    [string]$Sql = '',
    [string]$Ficheiro = '',
    [switch]$Csv,
    [string]$PgBin = ''
  )
  $psql = Resolve-PgTool -Nome psql -PgBin $PgBin
  $argumentos = @('-X', '-q', '-v', 'ON_ERROR_STOP=1', '-h', $Ligacao.Host, '-p', $Ligacao.Port, '-U', $Ligacao.User, '-d', $Ligacao.Database)
  if ($Csv) { $argumentos += '--csv' } else { $argumentos += @('-A', '-t') }
  if ($Ficheiro) { $argumentos += @('-f', $Ficheiro) } else { $argumentos += @('-c', $Sql) }
  $anterior = @{ PGPASSWORD = $env:PGPASSWORD; PGSSLMODE = $env:PGSSLMODE }
  try {
    $env:PGPASSWORD = $Ligacao.Password
    if ($Ligacao.SslMode) { $env:PGSSLMODE = $Ligacao.SslMode }
    $saida = & $psql @argumentos 2>&1
    if ($LASTEXITCODE -ne 0) { throw ("psql falhou (código $LASTEXITCODE): " + ($saida -join "`n")) }
    return ($saida -join "`n")
  } finally {
    $env:PGPASSWORD = $anterior.PGPASSWORD
    $env:PGSSLMODE = $anterior.PGSSLMODE
  }
}

function Write-Utf8SemBom([string]$Caminho, [string]$Texto) {
  [IO.File]::WriteAllText($Caminho, $Texto, (New-Object System.Text.UTF8Encoding($false)))
}

function Get-Sha256([string]$Caminho) {
  return (Get-FileHash -Algorithm SHA256 -Path $Caminho).Hash.ToLower()
}
