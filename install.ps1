# Instala o painel `curso-on` no Windows.
#   irm https://raw.githubusercontent.com/caioribi7/curso-on/main/install.ps1 | iex
#
# Variaveis opcionais:
#   $env:CURSO_ON_VERSION      versao (ex.: v0.1.0). Padrao: a mais recente.
#   $env:CURSO_ON_INSTALL_DIR  pasta de instalacao. Padrao: %LOCALAPPDATA%\curso-on\bin
#   $env:CURSO_ON_NO_CLONE=1   nao baixa o projeto (so instala o painel)
#   $env:CURSO_ON_NO_OPEN=1    nao abre o painel no fim
$ErrorActionPreference = 'Stop'

$Repo = 'caioribi7/curso-on'
$Version = if ($env:CURSO_ON_VERSION) { $env:CURSO_ON_VERSION } else { 'latest' }
$Dir = if ($env:CURSO_ON_INSTALL_DIR) { $env:CURSO_ON_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'curso-on\bin' }
$Asset = 'curso-on-windows-x86_64.exe'

if (-not [Environment]::Is64BitOperatingSystem) { throw 'O curso-on precisa do Windows 64 bits.' }

$Base = if ($Version -eq 'latest') { "https://github.com/$Repo/releases/latest/download" } else { "https://github.com/$Repo/releases/download/$Version" }
$Tmp = Join-Path ([IO.Path]::GetTempPath()) ("curso-on-" + [Guid]::NewGuid())
New-Item -ItemType Directory -Force $Tmp | Out-Null

try {
  Write-Host "> Baixando $Asset ($Version)..." -ForegroundColor Cyan
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -UseBasicParsing "$Base/$Asset" -OutFile (Join-Path $Tmp 'curso-on.exe')
  Invoke-WebRequest -UseBasicParsing "$Base/SHA256SUMS" -OutFile (Join-Path $Tmp 'SHA256SUMS')

  $line = Get-Content (Join-Path $Tmp 'SHA256SUMS') | Where-Object { $_ -match " $([regex]::Escape($Asset))$" } | Select-Object -First 1
  if (-not $line) { throw "Checksum de $Asset nao encontrado." }
  $expected = ($line -split ' ')[0].ToLower()
  $actual = (Get-FileHash (Join-Path $Tmp 'curso-on.exe') -Algorithm SHA256).Hash.ToLower()
  if ($expected -ne $actual) { throw 'O arquivo baixado nao confere com o checksum. Nada foi instalado.' }

  New-Item -ItemType Directory -Force $Dir | Out-Null
  Copy-Item (Join-Path $Tmp 'curso-on.exe') (Join-Path $Dir 'curso-on.exe') -Force
  Write-Host "> Instalado em $Dir\curso-on.exe" -ForegroundColor Cyan

  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not (($userPath -split ';') -contains $Dir)) {
    $newPath = if ($userPath) { "$userPath;$Dir" } else { $Dir }
    [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
    $env:Path = "$env:Path;$Dir"
    Write-Host "> Adicionei $Dir ao seu PATH. Abra um terminal novo se o comando nao for encontrado." -ForegroundColor Cyan
  }

}
finally {
  Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}

# Baixa o projeto em .\curso-on (se ainda nao estiver aqui) e abre o painel.
$Project = $null
if ((Test-Path 'package.json') -and ((Get-Content 'package.json' -Raw) -match '"name": "curso-on"')) {
  $Project = '.'
} elseif (Test-Path 'curso-on\.git') {
  $Project = 'curso-on'
} elseif (-not $env:CURSO_ON_NO_CLONE) {
  if (Get-Command git -ErrorAction SilentlyContinue) {
    Write-Host "> Baixando o projeto em $(Join-Path (Get-Location) 'curso-on')..." -ForegroundColor Cyan
    git clone --quiet "https://github.com/$Repo.git" curso-on
    if ($LASTEXITCODE -eq 0) { $Project = 'curso-on' }
  } else {
    Write-Host '> Sem git: o painel baixa o projeto depois (Configurar > Baixar o Curso On).' -ForegroundColor Cyan
  }
}

Write-Host ''
Write-Host 'OK Pronto! Para abrir o painel: curso-on' -ForegroundColor Green

if (-not $env:CURSO_ON_NO_OPEN -and [Environment]::UserInteractive -and -not [Console]::IsOutputRedirected) {
  Write-Host '> Abrindo o painel...' -ForegroundColor Cyan
  if ($Project) { Push-Location $Project }
  try { & (Join-Path $Dir 'curso-on.exe') } finally { if ($Project) { Pop-Location } }
}
