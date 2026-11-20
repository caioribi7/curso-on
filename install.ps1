# Instala o painel `curso-on` no Windows.
#   irm https://raw.githubusercontent.com/caioribi7/curso-on/main/install.ps1 | iex
#
# Variaveis opcionais:
#   $env:CURSO_ON_VERSION      versao (ex.: v0.1.0). Padrao: a mais recente.
#   $env:CURSO_ON_INSTALL_DIR  pasta de instalacao. Padrao: %LOCALAPPDATA%\curso-on\bin
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

  Write-Host ''
  Write-Host 'OK Pronto! Rode: curso-on' -ForegroundColor Green
}
finally {
  Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}
