<#
.SYNOPSIS
  Volta os serviços da API e dos jobs e o site do IIS para uma versão já extraída em <Base>\versoes.

.DESCRIPTION
  Não mexe no banco: migrações aplicadas pela versão mais nova continuam. As migrações do
  sistema só acrescentam, então a versão anterior costuma funcionar; se a versão nova mudou o
  significado de algum dado, restaure o backup feito antes da publicação (docs/deploy-windows.md).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File D:\metas\scripts\voltar-versao.ps1 -Versao 2026.12.15-1030-abc1234
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string]$Versao,
  [string]$Base = 'D:\metas',
  [string]$Nssm = 'C:\Program Files\nssm\nssm.exe',
  [string]$Site = 'metas',
  [string]$Servico = 'metas-api',
  [string]$ServicoJobs = 'metas-jobs',
  [int]$PortaApi = 3000
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Import-Module WebAdministration

$pasta = Join-Path $Base "versoes\$Versao"
if (-not (Test-Path (Join-Path $pasta 'api\dist\main.js'))) { throw "Versão não encontrada: $pasta" }

& $Nssm stop $ServicoJobs | Out-Null
& $Nssm stop $Servico | Out-Null
& $Nssm set $Servico AppDirectory (Join-Path $pasta 'api') | Out-Null
& $Nssm set $Servico AppParameters ('--env-file="{0}" "{1}"' -f (Join-Path $Base 'config\api.env'), (Join-Path $pasta 'api\dist\main.js')) | Out-Null
Set-ItemProperty "IIS:\Sites\$Site" -Name physicalPath -Value (Join-Path $pasta 'web')
& $Nssm start $Servico | Out-Null
# Versões de antes do P22 não têm o serviço de jobs: ele fica parado.
$mainJobs = Join-Path $pasta 'jobs\dist\main.js'
if (Test-Path $mainJobs) {
  & $Nssm set $ServicoJobs AppDirectory (Join-Path $pasta 'jobs') | Out-Null
  & $Nssm set $ServicoJobs AppParameters ('--env-file="{0}" "{1}"' -f (Join-Path $Base 'config\api.env'), $mainJobs) | Out-Null
  & $Nssm start $ServicoJobs | Out-Null
}

Start-Sleep -Seconds 5
$r = Invoke-RestMethod -Uri "http://127.0.0.1:$PortaApi/api/v1/saude" -TimeoutSec 10
Set-Content -Path (Join-Path $Base 'atual.txt') -Value $Versao -Encoding ASCII
Write-Host "No ar: $Versao (saúde: $($r.status))" -ForegroundColor Green
