$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [string]$File,
    [string[]]$Arguments = @()
  )

  & $File @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$File $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
  }
}

function Stop-RunningPackagedApp {
  $appDir = [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot "release\win-unpacked"))
  if (!(Test-Path $appDir)) {
    return
  }

  Get-Process -Name "Local Vault" -ErrorAction SilentlyContinue | ForEach-Object {
    $processPath = $null
    try {
      $processPath = $_.Path
    } catch {
      $processPath = $null
    }

    if ($processPath -and $processPath.StartsWith($appDir, [System.StringComparison]::OrdinalIgnoreCase)) {
      Write-Host "Stopping running packaged app: $($_.Id) $processPath"
      Stop-Process -Id $_.Id -Force
    }
  }
}

function Get-BuilderCacheRoot {
  if (![string]::IsNullOrWhiteSpace($env:ELECTRON_BUILDER_CACHE)) {
    return [System.IO.Path]::GetFullPath($env:ELECTRON_BUILDER_CACHE)
  }

  if (![string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    return (Join-Path $env:LOCALAPPDATA "electron-builder\Cache")
  }

  return (Join-Path $env:TEMP "electron-builder-cache")
}

function Find-CacheDirectory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Root,
    [Parameter(Mandatory = $true)]
    [string]$Pattern
  )

  if (!(Test-Path $Root)) {
    return $null
  }

  $directory = Get-ChildItem $Root -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like $Pattern } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if ($directory) {
    return $directory.FullName
  }

  return $null
}

function Set-BuilderBinaryCacheEnv {
  $nsisRoot = Join-Path (Get-BuilderCacheRoot) "nsis"
  $nsisDir = Find-CacheDirectory -Root $nsisRoot -Pattern "nsis-3.0.4.1-nsis-3.0.4.1"
  $nsisResourcesDir = Find-CacheDirectory -Root $nsisRoot -Pattern "nsis-resources-3.4.1-nsis-resources-3.4.1"

  if ($nsisDir) {
    $env:ELECTRON_BUILDER_NSIS_DIR = $nsisDir
    Write-Host "Using NSIS cache: $nsisDir"
  }

  if ($nsisResourcesDir) {
    $env:ELECTRON_BUILDER_NSIS_RESOURCES_DIR = $nsisResourcesDir
    Write-Host "Using NSIS resources cache: $nsisResourcesDir"
  }

  return [bool]($nsisDir -and $nsisResourcesDir)
}

Remove-Item Env:DEBUG -ErrorAction SilentlyContinue
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

$builder = Join-Path $ProjectRoot "node_modules\.bin\electron-builder.cmd"
if (!(Test-Path $builder)) {
  throw "electron-builder.cmd was not found. Run npm install first."
}

Stop-RunningPackagedApp

Write-Host "Building renderer, preload, and main bundles..."
Invoke-Checked "npm.cmd" @("run", "build")

$maxAttempts = 3
for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
  Write-Host "Packaging Windows installer, attempt $attempt of $maxAttempts..."
  $hasBinaryCache = Set-BuilderBinaryCacheEnv
  if (!$hasBinaryCache) {
    Write-Host "NSIS cache is incomplete. electron-builder may download binaries during this attempt."
  }

  try {
    Invoke-Checked $builder @("--win", "--publish", "never")

    $installer = Get-ChildItem (Join-Path $ProjectRoot "release") -Filter "*.exe" -File -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -notlike "*.__uninstaller.exe" } |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1

    if ($installer) {
      Write-Host "Installer created: $($installer.FullName)"
    }
    exit 0
  } catch {
    if ($attempt -eq $maxAttempts) {
      throw
    }

    Write-Warning "Packaging attempt $attempt failed. Retrying after refreshing electron-builder cache paths."
    Start-Sleep -Seconds 2
  }
}
