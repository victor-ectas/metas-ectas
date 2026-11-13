<#
.SYNOPSIS
  Testa a restauração do backup mais recente num banco temporário (P16, docs/deploy-windows.md).

.DESCRIPTION
  Restaura o último backup em `metas_restauracao`, compara a quantidade de linhas das tabelas
  principais com o banco em uso e apaga o banco temporário. Pede a senha do superusuário
  `postgres` (só ele cria e apaga bancos). Rode uma vez na instalação e depois a cada mês.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File D:\metas\scripts\testar-restauracao.ps1
#>
[CmdletBinding()]
param(
  [string]$Destino = 'D:\metas-dados\backup',
  [string]$PgBin = 'C:\Program Files\PostgreSQL\17\bin',
  [string]$Arquivo,
  [string]$Servidor = 'localhost',
  [int]$Porta = 5432
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$temporario = 'metas_restauracao'
$tabelas = 'usuario', 'setor', 'ciclo', 'variavel', 'meta', 'lancamento', 'lancamento_historico', 'auditoria'

if (-not $Arquivo) {
  $ultimo = Get-ChildItem $Destino -Filter 'metas-*.dump' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $ultimo) { throw "Nenhum backup em $Destino." }
  $Arquivo = $ultimo.FullName
}
Write-Host "Backup: $Arquivo" -ForegroundColor Cyan

# Senha do postgres: pedida na hora (nunca na linha de comando). Se PGPASSWORD já estiver
# definida na sessão, é usada.
if (-not $env:PGPASSWORD) {
  $senha = Read-Host 'Senha do usuário postgres' -AsSecureString
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($senha))
}
# Sem os avisos (NOTICE) do PostgreSQL, que o PowerShell mostra como erro.
$env:PGOPTIONS = '-c client_min_messages=warning'

function Psql([string]$banco, [string]$sql) {
  $saida = & (Join-Path $PgBin 'psql.exe') --host=$Servidor --port=$Porta --username=postgres `
    --dbname=$banco --no-password --tuples-only --no-align -v ON_ERROR_STOP=1 --command=$sql
  if ($LASTEXITCODE -ne 0) { throw "psql falhou: $sql" }
  return $saida
}

function Contagens([string]$banco) {
  $resultado = [ordered]@{}
  foreach ($t in $tabelas) { $resultado[$t] = [int64](Psql $banco "SELECT count(*) FROM public.$t") }
  return $resultado
}

try {
  Psql 'postgres' "DROP DATABASE IF EXISTS $temporario" | Out-Null
  Psql 'postgres' "CREATE DATABASE $temporario OWNER metas_owner" | Out-Null
  & (Join-Path $PgBin 'pg_restore.exe') --host=$Servidor --port=$Porta --username=postgres `
    --no-password --dbname=$temporario --exit-on-error $Arquivo
  if ($LASTEXITCODE -ne 0) { throw "pg_restore terminou com código $LASTEXITCODE" }

  $restaurado = Contagens $temporario
  $atual = Contagens 'metas'
  $linhas = foreach ($t in $tabelas) {
    [pscustomobject]@{ Tabela = $t; Backup = $restaurado[$t]; 'Banco atual' = $atual[$t] }
  }
  $linhas | Format-Table -AutoSize
  Write-Host 'Restauração OK. Diferenças são esperadas se houve lançamentos depois do backup.' -ForegroundColor Green
} finally {
  try { Psql 'postgres' "DROP DATABASE IF EXISTS $temporario" | Out-Null } catch { Write-Warning $_ }
  Remove-Item env:PGPASSWORD, env:PGOPTIONS -ErrorAction SilentlyContinue
}
