<#
.SYNOPSIS
  Valida o PostgreSQL de destino depois do restore (só leitura).

.DESCRIPTION
  Corre os SQL de scripts/migracao/sql contra o destino e grava um relatório
  por consulta em backup\relatorios\<carimbo>\*.csv:
    tabelas, contagens, constraints (PK/FK/UNIQUE/CHECK), not-null, índices,
    sequences (MAX/last_value/próximo), reference-counters, enums, extensões,
    funções/triggers/vistas e integridade das FKs (órfãos).
  No fim compara com o que o repositório espera e imprime OK / ATENÇÃO.

  Se receber -Origem (CSVs gerados na origem com os MESMOS ficheiros SQL:
  not-null.sql, enums.sql, indices.sql, constraints.sql — ver README), compara
  também o esquema coluna a coluna.

    $env:PGPASSWORD = "..."
    .\scripts\migracao\04-validar-migracao.ps1 -User postgres
    .\scripts\migracao\04-validar-migracao.ps1 -User postgres -Origem backup\origem   # pasta com os CSV da origem
#>
[CmdletBinding()]
param(
  [string]$Url = '',
  [string]$Servidor = 'localhost',
  [int]$Port = 5432,
  [string]$Database = 'kixima',
  [string]$User = '',
  [string]$PgBin = '',
  [string]$Origem = ''
)
. (Join-Path $PSScriptRoot 'comum.ps1')

$lig = Get-LigacaoDestino -Url $Url -Servidor $Servidor -Port $Port -Database $Database -User $User
$sqlDir = Join-Path $PSScriptRoot 'sql'
$carimbo = New-Carimbo
$pasta = Join-Path (Get-PastaBackup) ("relatorios\" + $carimbo)
New-Item -ItemType Directory -Path $pasta -Force | Out-Null
Write-Passo ("Validação de " + (Format-LigacaoMascarada $lig) + " → " + $pasta)

$consultas = @('tabelas', 'contagens', 'constraints', 'not-null', 'indices', 'sequences-relatorio', 'reference-counters', 'enums', 'extensoes', 'funcoes-triggers', 'integridade-fk')
$dados = @{}
foreach ($c in $consultas) {
  $csv = Invoke-Psql -Ligacao $lig -Ficheiro (Join-Path $sqlDir "$c.sql") -Csv -PgBin $PgBin
  $destino = Join-Path $pasta "$c.csv"
  Write-Utf8SemBom $destino ($csv + "`n")
  $dados[$c] = @($csv | ConvertFrom-Csv)
  Write-Host ("   {0,-22} {1,5} linhas" -f "$c.csv", $dados[$c].Count)
}

$problemas = 0
function Verifica([bool]$Cond, [string]$Ok, [string]$Mal) {
  if ($Cond) { Write-Ok $Ok } else { Write-Aviso $Mal; $script:problemas++ }
}

Write-Passo 'Esquema'
$esperadas = @(Get-Content (Join-Path $sqlDir 'tabelas-esperadas.txt') | Where-Object { $_ -and -not $_.StartsWith('#') })
$existentes = @($dados['tabelas'] | ForEach-Object { $_.table_name })
$faltam = @($esperadas | Where-Object { $existentes -notcontains $_ })
$aMais  = @($existentes | Where-Object { $esperadas -notcontains $_ })
Verifica ($faltam.Count -eq 0) ("as {0} tabelas esperadas existem" -f $esperadas.Count) ("tabelas em falta: " + ($faltam -join ', '))
if ($aMais.Count -gt 0) { Write-Aviso ("tabelas que o schema.prisma não conhece: " + ($aMais -join ', ')) }
$semPk = @($dados['tabelas'] | Where-Object { -not $_.primary_key })
Verifica ($semPk.Count -eq 0) 'todas as tabelas têm chave primária' ("sem PK: " + (($semPk | ForEach-Object { $_.table_name }) -join ', '))
$fks = @($dados['constraints'] | Where-Object { $_.constraint_type -eq 'FOREIGN KEY' })
$uniq = @($dados['constraints'] | Where-Object { $_.constraint_type -eq 'UNIQUE' })
$naoValidadas = @($dados['constraints'] | Where-Object { $_.validated -eq 'f' -or $_.validated -eq 'false' })
Write-Host ("   PK {0} · FK {1} · UNIQUE {2} · CHECK {3}" -f @($dados['constraints'] | Where-Object { $_.constraint_type -eq 'PRIMARY KEY' }).Count, $fks.Count, $uniq.Count, @($dados['constraints'] | Where-Object { $_.constraint_type -eq 'CHECK' }).Count)
Verifica ($naoValidadas.Count -eq 0) 'todas as constraints estão validadas' ("constraints NOT VALID: " + (($naoValidadas | ForEach-Object { $_.constraint_name }) -join ', '))
$indInvalidos = @($dados['indices'] | Where-Object { $_.is_valid -eq 'f' -or $_.is_valid -eq 'false' })
Verifica ($indInvalidos.Count -eq 0) ("{0} índices, todos válidos" -f $dados['indices'].Count) ("índices inválidos: " + (($indInvalidos | ForEach-Object { $_.index_name }) -join ', '))
Verifica ($dados['enums'].Count -ge 36) ("{0} enums (esperados 36)" -f $dados['enums'].Count) ("{0} enums — o schema.prisma declara 36" -f $dados['enums'].Count)
Verifica (@($dados['extensoes'] | Where-Object { $_.extension -eq 'pg_trgm' }).Count -eq 1) 'extensão pg_trgm instalada' 'pg_trgm NÃO instalada — as funções de pesquisa e os índices GIN dependem dela'
$funcs = @($dados['funcoes-triggers'] | Where-Object { $_.kind -eq 'FUNCTION' -and $_.name -in @('kixima_normalizar', 'products_search_text', 'companies_search_text') })
$trigs = @($dados['funcoes-triggers'] | Where-Object { $_.kind -eq 'TRIGGER' -and $_.name -match 'search_text_trg' })
Verifica ($funcs.Count -eq 3) 'as 3 funções de pesquisa existem' ("funções de pesquisa encontradas: {0} de 3" -f $funcs.Count)
Verifica ($trigs.Count -eq 2) 'os 2 triggers de search_text existem' ("triggers de search_text encontrados: {0} de 2" -f $trigs.Count)
$vistas = @($dados['funcoes-triggers'] | Where-Object { $_.kind -eq 'VIEW' })
if ($vistas.Count -gt 0) { Write-Aviso ("vistas presentes (o schema não define nenhuma): " + (($vistas | ForEach-Object { $_.name }) -join ', ')) }

Write-Passo 'Dados'
$total = 0; foreach ($l in $dados['contagens']) { $total += [int64]$l.row_count }
Write-Host ("   {0:N0} linhas em {1} tabelas" -f $total, $dados['contagens'].Count)
$mig = @($dados['contagens'] | Where-Object { $_.table_name -eq '_prisma_migrations' })
Verifica ($mig.Count -eq 1 -and [int]$mig[0].row_count -ge 55) ("_prisma_migrations com {0} migrações (esperadas 55)" -f $mig[0].row_count) '_prisma_migrations ausente ou incompleta — o migrate-boot do Node/Flyway do Java podem tentar reaplicar migrações'
$orfaos = @($dados['integridade-fk'] | Where-Object { [int64]$_.orphan_rows -gt 0 })
Verifica ($orfaos.Count -eq 0) ("integridade referencial: 0 órfãos em {0} FKs verificadas" -f $dados['integridade-fk'].Count) ("FKs com órfãos: " + (($orfaos | ForEach-Object { "$($_.table_name).$($_.columns)=$($_.orphan_rows)" }) -join ', '))

Write-Passo 'Sequences e contadores'
$seqs = $dados['sequences-relatorio']
if ($seqs.Count -eq 0) { Write-Ok 'sem sequences no esquema public (chaves UUID) — nada a alinhar' }
else {
  $seqs | ForEach-Object { Write-Host ("   {0,-40} {1}.{2} MAX={3} last={4} next={5} {6}" -f $_.sequence_name, $_.table_name, $_.column_name, $_.max_id, $_.last_value, $_.next_value, $_.status) }
  $desal = @($seqs | Where-Object { $_.status -ne 'OK' })
  Verifica ($desal.Count -eq 0) 'todas as sequences alinhadas' ("sequences desalinhadas: {0} — corra 06-sincronizar-sequences.ps1 -Aplicar" -f $desal.Count)
}
$contadores = $dados['reference-counters']
$contadores | ForEach-Object { Write-Host ("   {0,-12} {1,-24} max={2,-8} contador={3,-8} {4}" -f $_.counter_key, $_.table_name, $_.max_in_table, $_.counter_value, $_.status) }
$maus = @($contadores | Where-Object { $_.status -like 'DESALINHADO*' })
Verifica ($maus.Count -eq 0) 'contadores de referência >= ao maior número usado' ("contadores desalinhados: " + (($maus | ForEach-Object { $_.counter_key }) -join ', ') + " — corra 06-sincronizar-sequences.ps1 -Aplicar")

if ($Origem) {
  Write-Passo "Comparação de esquema com a origem ($Origem)"
  foreach ($c in @('not-null', 'enums', 'indices', 'constraints')) {
    $fo = Join-Path $Origem "$c.csv"
    if (-not (Test-Path $fo)) { Write-Aviso "sem $fo na origem — salto"; continue }
    $o = @(Import-Csv $fo)
    $d = $dados[$c]
    $chave = switch ($c) { 'not-null' { { param($x) "$($x.table_name).$($x.column_name)" } } 'enums' { { param($x) $x.enum_name } } 'indices' { { param($x) $x.index_name } } 'constraints' { { param($x) "$($x.table_name).$($x.constraint_name)" } } }
    $mo = @{}; foreach ($x in $o) { $mo[(& $chave $x)] = $x }
    $md = @{}; foreach ($x in $d) { $md[(& $chave $x)] = $x }
    $soOrigem = @($mo.Keys | Where-Object { -not $md.ContainsKey($_) })
    $soDestino = @($md.Keys | Where-Object { -not $mo.ContainsKey($_) })
    $diferentes = @()
    foreach ($k in $mo.Keys) {
      if ($md.ContainsKey($k)) {
        $a = $mo[$k]; $b = $md[$k]
        foreach ($p in $a.PSObject.Properties.Name) {
          if ($p -in @('definition', 'estimated_rows', 'total_size')) { continue }
          if ("$($a.$p)" -ne "$($b.$p)") { $diferentes += "$k.$p ($($a.$p) → $($b.$p))" }
        }
      }
    }
    Verifica ($soOrigem.Count -eq 0 -and $soDestino.Count -eq 0 -and $diferentes.Count -eq 0) "$c igual à origem" ("$c difere — só na origem: {0}; só no destino: {1}; diferentes: {2}" -f $soOrigem.Count, $soDestino.Count, $diferentes.Count)
    ($soOrigem | Select-Object -First 10) | ForEach-Object { Write-Host "      só na origem: $_" }
    ($soDestino | Select-Object -First 10) | ForEach-Object { Write-Host "      só no destino: $_" }
    ($diferentes | Select-Object -First 10) | ForEach-Object { Write-Host "      diferente: $_" }
  }
}

Write-Passo 'Resultado'
if ($problemas -eq 0) { Write-Ok "sem problemas. Relatórios em $pasta" } else { Write-Aviso "$problemas ponto(s) a rever. Relatórios em $pasta" }
exit ([int]($problemas -gt 0))
