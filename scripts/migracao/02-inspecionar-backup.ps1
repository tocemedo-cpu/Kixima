<#
.SYNOPSIS
  Inspecciona um dump custom (pg_restore --list) sem tocar em nenhuma base.

.DESCRIPTION
  Mostra e grava (<dump>.toc.txt e <dump>.inventario.csv) o que o ficheiro
  contém: esquemas, tabelas, dados por tabela, sequences, índices, constraints
  (PK/UNIQUE/CHECK) e FKs, funções, triggers, tipos (enums), extensões, vistas.
  Compara com o que o repositório espera (49 tabelas do schema.prisma +
  _prisma_migrations, 36 enums, 3 funções, 2 triggers, pg_trgm).

    .\scripts\migracao\02-inspecionar-backup.ps1 -Dump backup\kixima-supabase-20260925-120000.dump
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Dump,
  [string]$PgBin = ''
)
. (Join-Path $PSScriptRoot 'comum.ps1')

if (-not (Test-Path $Dump)) { Write-Erro "Não existe: $Dump"; exit 2 }
$pgrestore = Resolve-PgTool -Nome pg_restore -PgBin $PgBin

Write-Passo "Inspecção de $Dump"
if (Test-Path "$Dump.sha256") {
  $esperado = (Get-Content "$Dump.sha256" | Select-Object -First 1) -split '\s+' | Select-Object -First 1
  $real = Get-Sha256 $Dump
  if ($esperado -eq $real) { Write-Ok 'SHA-256 confere com o .sha256 gravado no backup' } else { Write-Erro 'SHA-256 NÃO confere: o ficheiro foi alterado ou está corrompido.'; exit 1 }
}

$toc = & $pgrestore --list $Dump 2>&1
if ($LASTEXITCODE -ne 0) { Write-Erro 'pg_restore --list falhou: o ficheiro não é um dump custom legível.'; exit 1 }
Write-Utf8SemBom "$Dump.toc.txt" (($toc -join "`n") + "`n")

# Cabeçalho do dump: versões e data.
$toc | Where-Object { $_ -match '^;\s+(Archive created|dbname|Dumped from|Dumped by|TOC Entries|Format|Compression)' } | ForEach-Object { Write-Host ('   ' + $_.TrimStart('; ')) }

# Entradas: "<id>; <catalog> <oid> <TIPO> <esquema> <nome> <dono>"
$tipos = 'EXTENSION|SCHEMA|TYPE|DOMAIN|FUNCTION|PROCEDURE|AGGREGATE|TABLE DATA|TABLE|SEQUENCE SET|SEQUENCE|INDEX|FK CONSTRAINT|CONSTRAINT|TRIGGER|MATERIALIZED VIEW|VIEW|COMMENT|ACL|DEFAULT ACL|DEFAULT|POLICY|PUBLICATION|SUBSCRIPTION|EVENT TRIGGER|COLLATION|CAST|OPERATOR CLASS|OPERATOR FAMILY|OPERATOR|ACCESS METHOD|SERVER|FOREIGN DATA WRAPPER|LARGE OBJECT|BLOBS?|STATISTICS|RULE'
$re = [regex]("^(?<id>\d+);\s+\d+\s+\d+\s+(?<tipo>$tipos)\s+(?<esquema>\S+)\s+(?<nome>.+?)\s+(?<dono>\S+)\s*$")
$entradas = @()
foreach ($linha in $toc) {
  $m = $re.Match($linha)
  if ($m.Success) {
    $entradas += [pscustomobject]@{ tipo = $m.Groups['tipo'].Value; esquema = $m.Groups['esquema'].Value; nome = $m.Groups['nome'].Value; dono = $m.Groups['dono'].Value }
  }
}
if ($entradas.Count -eq 0) { Write-Erro 'Não consegui interpretar nenhuma entrada do índice do dump.'; exit 1 }

$entradas | Export-Csv -Path "$Dump.inventario.csv" -NoTypeInformation -Encoding UTF8

Write-Passo 'Resumo por tipo'
$entradas | Group-Object tipo | Sort-Object Name | ForEach-Object { Write-Host ("   {0,-18} {1,5}" -f $_.Name, $_.Count) }

function Lista([string]$Tipo, [int]$Max = 200) {
  $itens = @($entradas | Where-Object { $_.tipo -eq $Tipo } | Sort-Object nome)
  Write-Passo ("{0} ({1})" -f $Tipo, $itens.Count)
  $itens | Select-Object -First $Max | ForEach-Object { Write-Host ("   {0}.{1}" -f $_.esquema, $_.nome) }
  if ($itens.Count -gt $Max) { Write-Host ("   … mais {0} (ver {1}.inventario.csv)" -f ($itens.Count - $Max), $Dump) }
  return $itens
}

$esquemas   = Lista 'SCHEMA'
$extensoes  = Lista 'EXTENSION'
$tipos_     = Lista 'TYPE'
$tabelas    = Lista 'TABLE'
$sequences  = Lista 'SEQUENCE'
$indices    = Lista 'INDEX' 60
$constr     = Lista 'CONSTRAINT' 60
$fks        = Lista 'FK CONSTRAINT' 60
$funcoes    = Lista 'FUNCTION'
$triggers   = Lista 'TRIGGER'
$vistas     = Lista 'VIEW'
$dados      = @($entradas | Where-Object { $_.tipo -eq 'TABLE DATA' })

Write-Passo 'Contra o que o repositório espera'
$esperadas = Get-Content (Join-Path $PSScriptRoot 'sql\tabelas-esperadas.txt') | Where-Object { $_ -and -not $_.StartsWith('#') }
$nomesTab = @($tabelas | ForEach-Object { $_.nome })
$faltam = @($esperadas | Where-Object { $nomesTab -notcontains $_ })
$aMais  = @($nomesTab | Where-Object { $esperadas -notcontains $_ })
if ($faltam.Count -eq 0) { Write-Ok ("as {0} tabelas esperadas estão no dump" -f $esperadas.Count) } else { Write-Aviso ("faltam no dump: " + ($faltam -join ', ')) }
if ($aMais.Count -gt 0) { Write-Aviso ("tabelas no dump que o schema.prisma não conhece: " + ($aMais -join ', ')) }
if ($dados.Count -ne $tabelas.Count) { Write-Aviso ("{0} tabelas mas {1} blocos de dados — tabelas sem dados são normais (vazias)" -f $tabelas.Count, $dados.Count) }
if (@($tipos_).Count -ge 36) { Write-Ok ("{0} tipos (enums) — esperados 36" -f @($tipos_).Count) } else { Write-Aviso ("{0} tipos (enums) — esperados 36" -f @($tipos_).Count) }
if (@($funcoes | Where-Object { $_.nome -match '^(kixima_normalizar|products_search_text|companies_search_text)\(' }).Count -eq 3) { Write-Ok 'as 3 funções de pesquisa (kixima_normalizar, products_search_text, companies_search_text)' } else { Write-Aviso 'não encontrei as 3 funções de pesquisa das migrações' }
if (@($triggers | Where-Object { $_.nome -match 'search_text_trg' }).Count -eq 2) { Write-Ok 'os 2 triggers de search_text' } else { Write-Aviso 'não encontrei os 2 triggers de search_text' }
if (@($extensoes | Where-Object { $_.nome -eq 'pg_trgm' }).Count -eq 1) { Write-Ok 'extensão pg_trgm no dump' } else { Write-Aviso 'pg_trgm NÃO está no dump (no Supabase costuma viver no esquema "extensions", fora de public) — o 03-restore cria-a no destino antes do restore.' }
if (@($sequences).Count -eq 0) { Write-Ok 'sem sequences no dump (o KIXIMA usa UUID; os contadores de referência são a tabela reference_counters)' }
if (@($esquemas | Where-Object { $_.nome -ne 'public' }).Count -gt 0) { Write-Aviso 'há esquemas além de public no dump' }

Write-Host "`nÍndice completo: $Dump.toc.txt · inventário CSV: $Dump.inventario.csv"
Write-Host "Próximo passo: .\scripts\migracao\03-restore-postgres.ps1 -Dump `"$Dump`""
