<#
.SYNOPSIS
  Backup do banco do Sistema de Gestão de Metas com pg_dump (P16, docs/deploy-windows.md).

.DESCRIPTION
  Gera <Destino>\metas-<data>-<motivo>.dump (formato custom, comprimido), confere que o arquivo
  pode ser lido pelo pg_restore e apaga os backups com mais de <Dias> dias. A senha vem do
  arquivo <Base>\config\pgpass.conf (formato do PostgreSQL), nunca da linha de comando.

  -Agendar cria a tarefa agendada diária (02:00, conta SYSTEM) que roda este script.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File D:\metas\scripts\backup.ps1
  powershell -ExecutionPolicy Bypass -File D:\metas\scripts\backup.ps1 -Agendar
#>
[CmdletBinding()]
param(
  [string]$Base = 'D:\metas',
  [string]$Destino = 'D:\metas-dados\backup',
  [string]$PgBin = 'C:\Program Files\PostgreSQL\17\bin',
  [string]$Banco = 'metas',
  [string]$Usuario = 'metas_owner',
  [string]$Servidor = 'localhost',
  [int]$Porta = 5432,
  [int]$Dias = 30,
  [string]$Motivo = 'diario',
  [switch]$Agendar
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($Agendar) {
  $acao = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument (
    '-NoProfile -ExecutionPolicy Bypass -File "{0}" -Base "{1}" -Destino "{2}" -PgBin "{3}"' -f
    (Join-Path $Base 'scripts\backup.ps1'), $Base, $Destino, $PgBin)
  $quando = New-ScheduledTaskTrigger -Daily -At '02:00'
  $conta = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  Register-ScheduledTask -TaskName 'Metas - backup diario' -Action $acao -Trigger $quando `
    -Principal $conta -Description 'pg_dump do banco metas, retenção de 30 dias (docs/deploy-windows.md)' -Force | Out-Null
  Write-Host 'Tarefa "Metas - backup diario" agendada para 02:00.' -ForegroundColor Green
  return
}

$log = Join-Path $Base 'logs\backup.log'
function Registrar([string]$texto) {
  $linha = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $texto
  Add-Content -Path $log -Value $linha -Encoding UTF8
  Write-Host $linha
}

$pgpass = Join-Path $Base 'config\pgpass.conf'
if (-not (Test-Path $pgpass)) { throw "Arquivo de senha não encontrado: $pgpass" }
$env:PGPASSFILE = $pgpass
New-Item -ItemType Directory -Force -Path $Destino, (Split-Path $log) | Out-Null

$motivoSeguro = $Motivo -replace '[^\w.-]', '_'
$arquivo = Join-Path $Destino ('metas-{0}-{1}.dump' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $motivoSeguro)

try {
  & (Join-Path $PgBin 'pg_dump.exe') --host=$Servidor --port=$Porta --username=$Usuario `
    --no-password --format=custom --compress=6 --file=$arquivo $Banco
  if ($LASTEXITCODE -ne 0) { throw "pg_dump terminou com código $LASTEXITCODE" }

  # Confere que o arquivo é um backup legível (lista o conteúdo sem restaurar).
  $itens = & (Join-Path $PgBin 'pg_restore.exe') --list $arquivo
  if ($LASTEXITCODE -ne 0 -or -not ($itens -match 'TABLE DATA public lancamento ')) {
    throw 'O backup gerado não pôde ser lido pelo pg_restore.'
  }
  $tamanho = [math]::Round((Get-Item $arquivo).Length / 1MB, 2)
  Registrar "OK $arquivo ($tamanho MB)"

  $limite = (Get-Date).AddDays(-$Dias)
  Get-ChildItem $Destino -Filter 'metas-*.dump' | Where-Object { $_.LastWriteTime -lt $limite } |
    ForEach-Object { Remove-Item $_.FullName; Registrar "Removido (mais de $Dias dias): $($_.Name)" }
} catch {
  Registrar "ERRO $($_.Exception.Message)"
  if (Test-Path $arquivo) { Remove-Item $arquivo }
  throw
} finally {
  Remove-Item env:PGPASSFILE -ErrorAction SilentlyContinue
}
