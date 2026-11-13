<#
.SYNOPSIS
  Gera o pacote de instalação do Sistema de Gestão de Metas (P16, docs/deploy-windows.md).

.DESCRIPTION
  Roda na máquina de desenvolvimento, na raiz do repositório. Confere o código (pnpm verify),
  compila tudo, monta a API e o serviço de jobs com as dependências de produção (node_modules
  plano, sem links),
  junta a web, as migrações e os scripts do servidor, e gera pacotes\metas-<versão>.zip.
  O servidor não precisa de pnpm nem de acesso ao registro npm.

.PARAMETER ArquivoWeb
  Variáveis VITE_* de produção (ver deploy\producao-web.env.example).

.PARAMETER PularVerificacao
  Não roda o pnpm verify (só para testar o empacotamento; nunca para produção).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File deploy\empacotar.ps1
#>
[CmdletBinding()]
param(
  [string]$ArquivoWeb = 'deploy\producao-web.env',
  [switch]$PularVerificacao,
  [switch]$PermitirAlteracoes
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz
$tar = Join-Path $env:SystemRoot 'System32\tar.exe'

function Executar([string]$descricao, [scriptblock]$comando) {
  Write-Host "==> $descricao" -ForegroundColor Cyan
  & $comando
  if ($LASTEXITCODE -ne 0) { throw "Falhou: $descricao (código $LASTEXITCODE)" }
}

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

# --- 1. Estado do repositório e versão ----------------------------------------------------------
$alteracoes = git status --porcelain --untracked-files=no
if ($alteracoes -and -not $PermitirAlteracoes) {
  throw "Há alterações não commitadas. Faça o commit antes de empacotar (ou use -PermitirAlteracoes para um teste)."
}
$commit = (git rev-parse --short HEAD).Trim()
$versao = '{0}-{1}' -f (Get-Date -Format 'yyyy.MM.dd-HHmm'), $commit
Write-Host "Versão: $versao" -ForegroundColor Green

# --- 2. Variáveis do front-end ------------------------------------------------------------------
if (-not (Test-Path -LiteralPath $ArquivoWeb)) {
  throw "Arquivo $ArquivoWeb não encontrado. Copie deploy\producao-web.env.example e preencha."
}
$web = Ler-Env $ArquivoWeb
foreach ($chave in 'VITE_ENTRA_CLIENT_ID', 'VITE_ENTRA_TENANT_ID', 'VITE_API_SCOPE') {
  if (-not $web.ContainsKey($chave) -or $web[$chave] -eq '') { throw "$chave vazia em $ArquivoWeb." }
  Set-Item -Path "env:$chave" -Value $web[$chave]
}
# A API fica no mesmo endereço do site (IIS). Explícito: no Windows, variável vazia é apagada e o
# Vite usaria o VITE_API_URL do .env de desenvolvimento. Modo DEV nunca vai para produção.
$env:VITE_API_URL = '/api/v1'
$env:VITE_AUTH_DEV = 'false'

# --- 3. Conferência e build ---------------------------------------------------------------------
Executar 'Instalando dependências (lockfile congelado)' { pnpm install --frozen-lockfile }
if (-not $PularVerificacao) { Executar 'pnpm verify' { pnpm verify } }
Executar 'Compilando todos os pacotes' { pnpm build }

# --- 4. Montagem ----------------------------------------------------------------------------------
$saida = Join-Path $raiz 'pacotes'
$montagem = Join-Path $saida "metas-$versao"
if (Test-Path $montagem) { Remove-Item -Recurse -Force $montagem }
New-Item -ItemType Directory -Force -Path $montagem | Out-Null
# A pasta de montagem sai sempre, mesmo se algo falhar no meio.
try {

  # API com node_modules plano (sem links do pnpm, que não sobrevivem ao .zip).
  Executar 'Montando a API (dependências de produção)' {
    pnpm --config.node-linker=hoisted --filter '@metas/api' deploy --prod --legacy (Join-Path $montagem 'api')
  }
  foreach ($sobra in 'src', 'test', 'tsconfig.json', 'tsconfig.build.json', 'vitest.config.mts', 'nest-cli.json') {
    $caminho = Join-Path $montagem "api\$sobra"
    if (Test-Path $caminho) { Remove-Item -Recurse -Force $caminho }
  }
  if (-not (Test-Path (Join-Path $montagem 'api\node_modules\prisma\build\index.js'))) {
    throw 'Prisma CLI ausente do pacote da API: as migrações não rodariam no servidor.'
  }

  # Serviço de jobs (P22), montado do mesmo jeito.
  Executar 'Montando o serviço de jobs (dependências de produção)' {
    pnpm --config.node-linker=hoisted --filter '@metas/jobs' deploy --prod --legacy (Join-Path $montagem 'jobs')
  }
  foreach ($sobra in 'src', 'test', 'tsconfig.json', 'tsconfig.build.json', 'vitest.config.mts') {
    $caminho = Join-Path $montagem "jobs\$sobra"
    if (Test-Path $caminho) { Remove-Item -Recurse -Force $caminho }
  }
  if (-not (Test-Path (Join-Path $montagem 'jobs\dist\main.js'))) {
    throw 'Build do serviço de jobs ausente do pacote.'
  }

  # Migrações (o Prisma CLI vem do pacote da API).
  $banco = New-Item -ItemType Directory -Force -Path (Join-Path $montagem 'banco')
  Copy-Item 'prisma\schema.prisma' $banco
  Copy-Item -Recurse 'prisma\migrations' $banco
  Copy-Item 'deploy\servidor\banco\*' $banco

  # Web estática + web.config do IIS.
  $pastaWeb = Join-Path $montagem 'web'
  Copy-Item -Recurse 'apps\web\dist' $pastaWeb
  Copy-Item 'deploy\servidor\web.config' $pastaWeb

  # O build de produção não pode levar endereço de desenvolvimento nem o modo DEV.
  $js = Get-ChildItem -Recurse -Path $pastaWeb -Filter '*.js' | Get-Content -Raw
  foreach ($proibido in 'localhost:3000', 'localhost:5173', 'X-Usuario-Dev') {
    if ($js -match [regex]::Escape($proibido)) { throw "O build da web contém '$proibido'. Confira as variáveis VITE_*." }
  }

  # Scripts do servidor.
  $scripts = New-Item -ItemType Directory -Force -Path (Join-Path $montagem 'servidor')
  Copy-Item 'deploy\servidor\*.ps1', 'deploy\servidor\api.env.example' $scripts
  Copy-Item -Recurse 'deploy\servidor\sql' $scripts

  @{
    versao     = $versao
    commit     = (git rev-parse HEAD).Trim()
    geradoEm   = (Get-Date).ToString('o')
    node       = (node --version).Trim()
  } | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $montagem 'versao.json')

  # --- 5. Compactação -------------------------------------------------------------------------------
  $zip = Join-Path $saida "metas-$versao.zip"
  Executar "Compactando $zip" { & $tar -a -c -f $zip -C $montagem . }
} finally {
  if (Test-Path $montagem) { Remove-Item -Recurse -Force $montagem }
}

$tamanho = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host ""
Write-Host "Pacote pronto: $zip ($tamanho MB)" -ForegroundColor Green
Write-Host "Copie para o servidor e rode: servidor\publicar.ps1 -Pacote <caminho do zip>"
