<#
.SYNOPSIS
  Instalação única no servidor: pastas, permissões, proxy do ARR, site do IIS e serviços da API e dos jobs
  (P16, docs/deploy-windows.md, passo 5).

.DESCRIPTION
  - Pastas em <Base>: versoes, config (só Administradores e SYSTEM; o serviço lê só o api.env),
    logs e scripts; backups em <PastaBackup>.
  - Liga o proxy do ARR no servidor (necessário para a regra /api do web.config).
  - Cria o pool "metas" (sem .NET) e o site "metas" com HTTPS no <Endereco> (certificado pela
    impressão digital) e HTTP só para redirecionar.
  - Cria os serviços "metas-api" e "metas-jobs" (P22) no NSSM com a conta LOCAL SERVICE (sem
    privilégios), início automático atrasado, reinício em caso de falha e logs com rotação. Os
    serviços só sobem na primeira publicação (publicar.ps1). Os dois leem o mesmo api.env.

  Pode ser rodado de novo: o que já existe é ajustado, não duplicado.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\instalar-servico.ps1 -Endereco metas.ectas.local -Certificado 0A1B2C...
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string]$Endereco,
  [string]$Certificado,
  [string]$Base = 'D:\metas',
  [string]$PastaBackup = 'D:\metas-dados\backup',
  [string]$NodeExe = 'C:\Program Files\nodejs\node.exe',
  [string]$Nssm = 'C:\Program Files\nssm\nssm.exe',
  [string]$Site = 'metas',
  [string]$Servico = 'metas-api',
  [string]$ServicoJobs = 'metas-jobs'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Passo([string]$texto) { Write-Host "==> $texto" -ForegroundColor Cyan }

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { throw 'Rode este script como Administrador.' }
foreach ($arquivo in $NodeExe, $Nssm) {
  if (-not (Test-Path -LiteralPath $arquivo)) { throw "Não encontrado: $arquivo" }
}
Import-Module WebAdministration
if (-not (Get-WebConfiguration -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter 'system.webServer/rewrite' -ErrorAction SilentlyContinue)) {
  throw 'URL Rewrite não está instalado (docs/deploy-windows.md, passo 2).'
}

# SIDs em vez de nomes: funcionam em Windows em português ou inglês.
$ADMINS = '*S-1-5-32-544'
$SYSTEM = '*S-1-5-18'
$SERVICO_LOCAL = '*S-1-5-19'
$IIS_USUARIOS = '*S-1-5-32-568'

# --- Pastas e permissões --------------------------------------------------------------------------
Passo "Pastas em $Base"
$pastas = 'versoes', 'config', 'logs', 'scripts' | ForEach-Object { Join-Path $Base $_ }
New-Item -ItemType Directory -Force -Path ($pastas + $PastaBackup) | Out-Null

function Permissoes([string]$pasta, [string[]]$regras) {
  & icacls $pasta /inheritance:r /grant:r @regras | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "icacls falhou em $pasta" }
}
# Raiz e versões: Administradores e SYSTEM controlam; serviço e IIS só leem.
Permissoes $Base @("${ADMINS}:(OI)(CI)F", "${SYSTEM}:(OI)(CI)F", "${SERVICO_LOCAL}:(OI)(CI)RX", "${IIS_USUARIOS}:(OI)(CI)RX")
# Config: segredos. Só Administradores e SYSTEM; o serviço ganha leitura apenas do api.env
# (publicar.ps1), nunca do migracao.env e do pgpass.conf (senha do dono do banco).
Permissoes (Join-Path $Base 'config') @("${ADMINS}:(OI)(CI)F", "${SYSTEM}:(OI)(CI)F")
# Logs: o serviço escreve.
Permissoes (Join-Path $Base 'logs') @("${ADMINS}:(OI)(CI)F", "${SYSTEM}:(OI)(CI)F", "${SERVICO_LOCAL}:(OI)(CI)M")
# Backups: só Administradores e SYSTEM (a tarefa agendada roda como SYSTEM).
Permissoes $PastaBackup @("${ADMINS}:(OI)(CI)F", "${SYSTEM}:(OI)(CI)F")

# --- ARR: proxy ligado ----------------------------------------------------------------------------
Passo 'Ligando o proxy do ARR'
$proxy = Get-WebConfiguration -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter 'system.webServer/proxy' -ErrorAction SilentlyContinue
if (-not $proxy) { throw 'ARR (Application Request Routing) não está instalado (docs/deploy-windows.md, passo 2).' }
Set-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter 'system.webServer/proxy' -Name 'enabled' -Value 'True'
# Importação de Excel (P24) pode levar alguns segundos: 2 minutos de limite.
Set-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter 'system.webServer/proxy' -Name 'timeout' -Value '00:02:00'
# IP real do cliente para a API (limite de taxa por IP e auditoria): X-Forwarded-For só com o IP.
# Por padrão o ARR inclui a porta ("10.0.0.5:51234"), e cada conexão pareceria um cliente diferente.
Set-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter 'system.webServer/proxy' -Name 'xForwardedForHeaderName' -Value 'X-Forwarded-For'
Set-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter 'system.webServer/proxy' -Name 'includePortInXForwardedFor' -Value 'False'

# --- IIS: pool e site -----------------------------------------------------------------------------
Passo "Site $Site em https://$Endereco"
$vazio = Join-Path $Base 'versoes\_vazio'
New-Item -ItemType Directory -Force -Path $vazio | Out-Null
if (-not (Test-Path "IIS:\AppPools\$Site")) { New-WebAppPool -Name $Site | Out-Null }
Set-ItemProperty "IIS:\AppPools\$Site" -Name managedRuntimeVersion -Value ''
if (-not (Test-Path "IIS:\Sites\$Site")) {
  New-Website -Name $Site -PhysicalPath $vazio -ApplicationPool $Site -HostHeader $Endereco -Port 80 | Out-Null
}
if ($Certificado) {
  $Certificado = $Certificado -replace '\s', ''
  if (-not (Test-Path "Cert:\LocalMachine\My\$Certificado")) {
    throw "Certificado $Certificado não está em Computador Local > Pessoal."
  }
  if (-not (Get-WebBinding -Name $Site -Protocol https -HostHeader $Endereco)) {
    New-WebBinding -Name $Site -Protocol https -Port 443 -HostHeader $Endereco -SslFlags 1
  }
  (Get-WebBinding -Name $Site -Protocol https -HostHeader $Endereco).AddSslCertificate($Certificado, 'My')
} else {
  Write-Warning 'Sem certificado: o site fica só em HTTP, e o login Microsoft não funciona assim. Rode de novo com -Certificado.'
}

# --- Serviços da API e dos jobs (NSSM) ------------------------------------------------------------
$logs = Join-Path $Base 'logs'

function Configurar-Servico([string]$nome, [string]$titulo, [string]$descricao, [string]$log, [string]$paradaMs) {
  Passo "Serviço $nome"
  $existe = Get-Service -Name $nome -ErrorAction SilentlyContinue
  if (-not $existe) { & $Nssm install $nome $NodeExe | Out-Null }
  $config = @(
    @('Application', $NodeExe),
    @('DisplayName', $titulo),
    @('Description', $descricao),
    @('Start', 'SERVICE_DELAYED_AUTO_START'),
    @('AppStdout', (Join-Path $logs "$log.log")),
    @('AppStderr', (Join-Path $logs "$log-erros.log")),
    @('AppRotateFiles', '1'),
    @('AppRotateOnline', '1'),
    @('AppRotateBytes', '10485760'),
    @('AppExit', 'Default', 'Restart'),
    @('AppRestartDelay', '5000'),
    # Ctrl+C (SIGINT) e espera antes de encerrar à força.
    @('AppStopMethodConsole', $paradaMs),
    @('AppEnvironmentExtra', 'TZ=America/Sao_Paulo')
  )
  foreach ($item in $config) {
    & $Nssm set $nome @item | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "nssm set $nome $($item -join ' ') falhou" }
  }
  & $Nssm set $nome ObjectName 'NT AUTHORITY\LocalService' '' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Não foi possível definir a conta LOCAL SERVICE no serviço $nome." }
}

Configurar-Servico $Servico 'Metas - API' `
  'API do Sistema de Gestão de Metas (Node). Publicado por D:\metas\scripts\publicar.ps1.' 'api' '15000'
# A rotina diária pode estar no meio de um dia: 35 s para terminar (o serviço espera até 30 s).
Configurar-Servico $ServicoJobs 'Metas - Jobs' `
  'Rotina diária do fechamento às 00h05 (pg-boss). Publicado por D:\metas\scripts\publicar.ps1.' 'jobs' '35000'

Write-Host ''
Write-Host 'Instalação concluída.' -ForegroundColor Green
Write-Host "Próximos passos: preencher $Base\config (api.env, migracao.env, pgpass.conf) e rodar publicar.ps1."
