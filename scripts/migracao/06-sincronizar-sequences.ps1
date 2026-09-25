<#
.SYNOPSIS
  Relatório (e, com -Aplicar, correcção) das sequences e dos contadores de referência.

.DESCRIPTION
  Sem -Aplicar é só leitura: para cada sequence do esquema public mostra
  sequence_name, tabela, coluna, MAX(coluna), last_value, próximo valor e o
  estado; e para cada contador de reference_counters (PO-2026, FAT-2026, …)
  o maior número já usado na tabela e o valor do contador.

  Com -Aplicar:
    - setval de cada sequence para o MAX da coluna (sql\sequences-sincronizar.sql);
    - sobe cada contador para o maior número usado, nunca o desce
      (sql\reference-counters-sincronizar.sql).
  Não converte chaves para UUID nem altera linhas das tabelas de negócio.

  Nota KIXIMA: todas as chaves são UUID (schema.prisma) — o relatório de
  sequences costuma vir vazio, e é isso que se quer confirmar.

    .\scripts\migracao\06-sincronizar-sequences.ps1 -User postgres
    .\scripts\migracao\06-sincronizar-sequences.ps1 -User postgres -Aplicar
#>
[CmdletBinding()]
param(
  [string]$Url = '',
  [string]$Servidor = 'localhost',
  [int]$Port = 5432,
  [string]$Database = 'kixima',
  [string]$User = '',
  [string]$PgBin = '',
  [switch]$Aplicar
)
. (Join-Path $PSScriptRoot 'comum.ps1')

$lig = Get-LigacaoDestino -Url $Url -Servidor $Servidor -Port $Port -Database $Database -User $User
$sqlDir = Join-Path $PSScriptRoot 'sql'

function Relatorio {
  Write-Passo ("Sequences em " + (Format-LigacaoMascarada $lig))
  $seqs = @((Invoke-Psql -Ligacao $lig -Ficheiro (Join-Path $sqlDir 'sequences-relatorio.sql') -Csv -PgBin $PgBin) | ConvertFrom-Csv)
  if ($seqs.Count -eq 0) { Write-Ok 'nenhuma sequence no esquema public (chaves UUID)' }
  else {
    Write-Host ("   {0,-36} {1,-28} {2,-10} {3,-10} {4,-10} {5}" -f 'sequence', 'tabela.coluna', 'MAX', 'last', 'próximo', 'estado')
    $seqs | ForEach-Object { Write-Host ("   {0,-36} {1,-28} {2,-10} {3,-10} {4,-10} {5}" -f $_.sequence_name, "$($_.table_name).$($_.column_name)", $_.max_id, $_.last_value, $_.next_value, $_.status) }
  }
  Write-Passo 'Contadores de referência (reference_counters)'
  $cont = @((Invoke-Psql -Ligacao $lig -Ficheiro (Join-Path $sqlDir 'reference-counters.sql') -Csv -PgBin $PgBin) | ConvertFrom-Csv)
  if ($cont.Count -eq 0) { Write-Host '   (sem referências emitidas ainda)' }
  $cont | ForEach-Object { Write-Host ("   {0,-12} {1,-24} max={2,-8} contador={3,-8} {4}" -f $_.counter_key, $_.table_name, $_.max_in_table, $_.counter_value, $_.status) }
  return @{ seqs = $seqs; cont = $cont }
}

$antes = Relatorio
$desal = @($antes.seqs | Where-Object { $_.status -eq 'DESALINHADA' }).Count + @($antes.cont | Where-Object { $_.status -like 'DESALINHADO*' }).Count

if (-not $Aplicar) {
  if ($desal -eq 0) { Write-Ok 'nada a corrigir' } else { Write-Aviso "$desal item(ns) desalinhado(s): volte a correr com -Aplicar" }
  exit 0
}

Write-Passo 'A aplicar (setval das sequences + contadores >= máximo usado)'
$saida = Invoke-Psql -Ligacao $lig -Ficheiro (Join-Path $sqlDir 'sequences-sincronizar.sql') -PgBin $PgBin
if ($saida) { $saida -split "`n" | ForEach-Object { Write-Host ('   ' + $_) } }
$saida = Invoke-Psql -Ligacao $lig -Ficheiro (Join-Path $sqlDir 'reference-counters-sincronizar.sql') -PgBin $PgBin
if ($saida) { $saida -split "`n" | ForEach-Object { Write-Host ('   ' + $_) } }
Write-Ok 'aplicado'
$depois = Relatorio
$restam = @($depois.seqs | Where-Object { $_.status -eq 'DESALINHADA' }).Count + @($depois.cont | Where-Object { $_.status -like 'DESALINHADO*' }).Count
if ($restam -eq 0) { Write-Ok 'tudo alinhado' } else { Write-Erro "$restam item(ns) continuam desalinhados — veja o relatório acima"; exit 1 }
