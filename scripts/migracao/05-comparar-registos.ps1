<#
.SYNOPSIS
  Produz migration-manifest.csv: contagem de linhas origem × destino, tabela a tabela.

.DESCRIPTION
  A origem (Supabase) não é acedida por este script: as contagens vêm de um
  CSV que VOCÊ gera na origem com scripts\migracao\sql\contagens.sql:

    $env:PGPASSWORD = "<password do Supabase>"
    psql -X --csv -h aws-0-<regiao>.pooler.supabase.com -p 5432 -U postgres.<ref> -d postgres `
         -f scripts\migracao\sql\contagens.sql > backup\contagens-origem.csv

  (faça-o IMEDIATAMENTE antes do backup, ou com a aplicação parada, para as
  contagens corresponderem ao dump). O destino é contado ao vivo com o mesmo SQL.

  Saída: backup\migration-manifest.csv (e uma cópia com carimbo em
  backup\relatorios\<carimbo>\) com as colunas
    table_name, source_rows, target_rows, status, notes
  status: OK | DIFERENTE | SO_ORIGEM | SO_DESTINO

    .\scripts\migracao\05-comparar-registos.ps1 -Origem backup\contagens-origem.csv -User postgres
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Origem,
  [string]$Url = '',
  [string]$Servidor = 'localhost',
  [int]$Port = 5432,
  [string]$Database = 'kixima',
  [string]$User = '',
  [string]$PgBin = ''
)
. (Join-Path $PSScriptRoot 'comum.ps1')

if (-not (Test-Path $Origem)) { Write-Erro "Não existe: $Origem (gere-o na origem com sql\contagens.sql — ver cabeçalho)"; exit 2 }
$origem = @(Import-Csv $Origem)
if ($origem.Count -eq 0 -or -not ($origem[0].PSObject.Properties.Name -contains 'table_name') -or -not ($origem[0].PSObject.Properties.Name -contains 'row_count')) {
  Write-Erro 'O CSV da origem tem de ter as colunas table_name,row_count (saída de psql --csv com sql\contagens.sql).'
  exit 2
}

$lig = Get-LigacaoDestino -Url $Url -Servidor $Servidor -Port $Port -Database $Database -User $User
Write-Passo ("Contagens do destino " + (Format-LigacaoMascarada $lig))
$destino = @((Invoke-Psql -Ligacao $lig -Ficheiro (Join-Path $PSScriptRoot 'sql\contagens.sql') -Csv -PgBin $PgBin) | ConvertFrom-Csv)

$mo = @{}; foreach ($l in $origem) { $mo[$l.table_name] = [int64]$l.row_count }
$md = @{}; foreach ($l in $destino) { $md[$l.table_name] = [int64]$l.row_count }
$nomes = @(@($mo.Keys) + @($md.Keys) | Sort-Object -Unique)

$linhas = @()
$ok = 0; $dif = 0
foreach ($n in $nomes) {
  $s = if ($mo.ContainsKey($n)) { $mo[$n] } else { $null }
  $t = if ($md.ContainsKey($n)) { $md[$n] } else { $null }
  $status = 'OK'; $notas = ''
  if ($null -eq $s) { $status = 'SO_DESTINO'; $notas = 'tabela não está no CSV da origem' }
  elseif ($null -eq $t) { $status = 'SO_ORIGEM'; $notas = 'tabela não existe no destino' }
  elseif ($s -ne $t) { $status = 'DIFERENTE'; $notas = ("destino - origem = {0}" -f ($t - $s)); if ($n -in @('audit_logs', 'notifications')) { $notas += ' (tabela que cresce com a app a correr: confirme que a origem estava parada)' } }
  if ($status -eq 'OK') { $ok++ } else { $dif++ }
  $linhas += [pscustomobject]@{ table_name = $n; source_rows = $s; target_rows = $t; status = $status; notes = $notas }
}

$pastaBackup = Get-PastaBackup
$carimbo = New-Carimbo
$pastaRel = Join-Path $pastaBackup ("relatorios\" + $carimbo)
New-Item -ItemType Directory -Path $pastaRel -Force | Out-Null
$manifest = Join-Path $pastaBackup 'migration-manifest.csv'
$linhas | Export-Csv -Path $manifest -NoTypeInformation -Encoding UTF8
Copy-Item $manifest (Join-Path $pastaRel 'migration-manifest.csv')

Write-Passo 'Manifesto'
$linhas | ForEach-Object { Write-Host ("   {0,-32} {1,10} {2,10}  {3,-10} {4}" -f $_.table_name, $_.source_rows, $_.target_rows, $_.status, $_.notes) }
Write-Host ""
if ($dif -eq 0) { Write-Ok "$ok tabelas iguais. $manifest" } else { Write-Aviso "$ok iguais, $dif com diferença. $manifest" }
exit ([int]($dif -gt 0))
