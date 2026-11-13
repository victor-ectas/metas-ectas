<#
.SYNOPSIS
  Publica uma versão do Sistema de Gestão de Metas no servidor (P16, docs/deploy-windows.md).

.DESCRIPTION
  1. Extrai o pacote em <Base>\versoes\<versão>.
  2. Faz backup do banco (backup.ps1).
  3. Para o serviço da API e aplica as migrações pendentes (prisma migrate deploy).
  4. Aponta o serviço e o site do IIS para a versão nova e sobe a API.
  5. Confere /api/v1/saude. Se a API não responder, volta o serviço e o site para a versão
     anterior (as migrações já aplicadas ficam; elas só acrescentam).
  6. Atualiza os scripts em <Base>\scripts e guarda as 5 versões mais recentes.

  Rode como Administrador, no PowerShell do servidor.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File D:\metas\scripts\publicar.ps1 -Pacote C:\temp\metas-2026.12.15-1030-abc1234.zip
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string]$Pacote,
  [string]$Base = 'D:\metas',
  [string]$PgBin = 'C:\Program Files\PostgreSQL\17\bin',
  [string]$NodeExe = 'C:\Program Files\nodejs\node.exe',
  [string]$Nssm = 'C:\Program Files\nssm\nssm.exe',
  [string]$Site = 'metas',
  [string]$Servico = 'metas-api',
  [int]$PortaApi = 3000,
  [int]$VersoesGuardadas = 5,
  [switch]$PularBackup
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Passo([string]$texto) { Write-Host "==> $texto" -ForegroundColor Cyan }

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { throw 'Rode este script como Administrador.' }
foreach ($arquivo in $Pacote, $NodeExe, $Nssm) {
  if (-not (Test-Path -LiteralPath $arquivo)) { throw "Não encontrado: $arquivo" }
}
Import-Module WebAdministration

$tar = Join-Path $env:SystemRoot 'System32\tar.exe'
$versoes = Join-Path $Base 'versoes'
$config = Join-Path $Base 'config'
$arquivoAtual = Join-Path $Base 'atual.txt'
$anterior = if (Test-Path $arquivoAtual) { (Get-Content $arquivoAtual -Raw).Trim() } else { $null }

function Ler-Env([string]$arquivo) {
  $valores = @{}
  foreach ($linha in Get-Content -LiteralPath $arquivo -Encoding UTF8) {
    $texto = $linha.Trim()
    if ($texto -eq '' -or $texto.StartsWith('#')) { continue }
    $partes = $texto.Split('=', 2)
    if ($partes.Count -eq 2) { $valores[$partes[0].Trim()] = $partes[1].Trim() }
  }
  return $valores
}

function Apontar-Para([string]$versao) {
  $pasta = Join-Path $versoes $versao
  & $Nssm set $Servico AppDirectory (Join-Path $pasta 'api') | Out-Null
  & $Nssm set $Servico AppParameters ('--env-file="{0}" "{1}"' -f (Join-Path $config 'api.env'), (Join-Path $pasta 'api\dist\main.js')) | Out-Null
  Set-ItemProperty "IIS:\Sites\$Site" -Name physicalPath -Value (Join-Path $pasta 'web')
}

function Saude-Ok {
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 2
    try {
      $r = Invoke-RestMethod -Uri "http://127.0.0.1:$PortaApi/api/v1/saude" -TimeoutSec 5
      if ($r.status -eq 'ok') { return $true }
    } catch { }
  }
  return $false
}

# --- 1. Extração --------------------------------------------------------------------------------
$versao = [IO.Path]::GetFileNameWithoutExtension($Pacote) -replace '^metas-', ''
$destino = Join-Path $versoes $versao
if ($versao -eq $anterior) { throw "A versão $versao já é a publicada." }
if (Test-Path $destino) { Remove-Item -Recurse -Force $destino }
New-Item -ItemType Directory -Force -Path $destino | Out-Null
Passo "Extraindo $versao"
& $tar -x -f $Pacote -C $destino
if ($LASTEXITCODE -ne 0) { throw 'Falha ao extrair o pacote.' }
$info = Get-Content (Join-Path $destino 'versao.json') -Raw | ConvertFrom-Json
Write-Host "Versão $($info.versao), commit $($info.commit), gerada em $($info.geradoEm)"

# --- 2. Backup ----------------------------------------------------------------------------------
if (-not $PularBackup) {
  Passo 'Backup antes da publicação'
  # Se o backup falhar, o script para aqui (ErrorActionPreference = Stop) e nada muda.
  & (Join-Path $destino 'servidor\backup.ps1') -Base $Base -PgBin $PgBin -Motivo "antes-de-$versao"
}

# --- 3. Migrações -------------------------------------------------------------------------------
Passo "Parando o serviço $Servico"
& $Nssm stop $Servico | Out-Null

$migracao = Ler-Env (Join-Path $config 'migracao.env')
if (-not $migracao.ContainsKey('DATABASE_URL_MIGRACAO')) { throw 'DATABASE_URL_MIGRACAO ausente em config\migracao.env.' }
Passo 'Aplicando migrações pendentes'
$env:DATABASE_URL_MIGRACAO = $migracao['DATABASE_URL_MIGRACAO']
try {
  & $NodeExe (Join-Path $destino 'banco\migrar.mjs') deploy
  $okMigracao = $LASTEXITCODE -eq 0
} finally {
  Remove-Item env:DATABASE_URL_MIGRACAO -ErrorAction SilentlyContinue
}
if (-not $okMigracao) {
  if ($anterior) { & $Nssm start $Servico | Out-Null }
  throw 'Migração falhou: a versão anterior continua no ar. Veja a mensagem acima.'
}

# --- 4 e 5. Troca de versão e conferência -------------------------------------------------------
# A conta do serviço (LOCAL SERVICE) lê só o api.env; o resto da pasta config continua fechado.
$apiEnv = Join-Path $config 'api.env'
if (-not (Test-Path $apiEnv)) { throw "Configuração da API não encontrada: $apiEnv" }
& icacls $apiEnv /grant '*S-1-5-19:R' | Out-Null

Passo "Apontando serviço e site para $versao"
Apontar-Para $versao
& $Nssm start $Servico | Out-Null
Passo 'Conferindo /api/v1/saude'
if (-not (Saude-Ok)) {
  Write-Warning "A API da versão $versao não respondeu. Veja $Base\logs\api-erros.log."
  if ($anterior) {
    & $Nssm stop $Servico | Out-Null
    Apontar-Para $anterior
    & $Nssm start $Servico | Out-Null
    throw "Publicação desfeita: serviço e site voltaram para $anterior (as migrações aplicadas ficam)."
  }
  throw 'Primeira publicação sem resposta da API: confira config\api.env e os logs.'
}
Set-Content -Path $arquivoAtual -Value $versao -Encoding ASCII

# --- 6. Scripts e limpeza -----------------------------------------------------------------------
$scripts = Join-Path $Base 'scripts'
New-Item -ItemType Directory -Force -Path $scripts | Out-Null
Copy-Item -Recurse -Force (Join-Path $destino 'servidor\*') $scripts

$manter = @($versao, $anterior) | Where-Object { $_ }
Get-ChildItem $versoes -Directory | Sort-Object CreationTime -Descending |
  Select-Object -Skip $VersoesGuardadas |
  Where-Object { $manter -notcontains $_.Name } |
  ForEach-Object { Remove-Item -Recurse -Force $_.FullName }

Write-Host ''
Write-Host "Publicada a versão $versao." -ForegroundColor Green
if ($anterior) { Write-Host "Para voltar à versão anterior: $scripts\voltar-versao.ps1 -Versao $anterior" }
