#!/usr/bin/env pwsh
[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string]$Target,

  [Parameter(Mandatory = $false)]
  [ValidateSet('project', 'source', 'dist')]
  [string]$Mode = 'project',

  [Parameter(Mandatory = $false)]
  [string]$OutRoot,

  [Parameter(Mandatory = $false)]
  [string]$User,

  [Parameter(Mandatory = $false)]
  [int]$Port = 22,

  [Parameter(Mandatory = $false)]
  [string]$IdentityFile,

  [Parameter(Mandatory = $false)]
  [switch]$NoTransfer,

  [Parameter(Mandatory = $false)]
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Invoke-Robocopy {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Source,

    [Parameter(Mandatory = $true)]
    [string]$Destination,

    [Parameter(Mandatory = $true)]
    [string[]]$Args,

    [Parameter(Mandatory = $false)]
    [switch]$DryRun
  )

  New-Item -ItemType Directory -Force -Path $Destination | Out-Null

  if ($DryRun) {
    $pretty = (@('robocopy', "`"$Source`"", "`"$Destination`"") + $Args) -join ' '
    Write-Host $pretty
    return 0
  }

  & robocopy $Source $Destination @Args | Out-Null
  $exitCode = $LASTEXITCODE

  if ($exitCode -ge 8) {
    throw "robocopy failed (exit code $exitCode)"
  }

  return $exitCode
}

function Quote-ShSingle {
  param([Parameter(Mandatory = $true)][string]$Value)
  return "'" + ($Value -replace "'", "'\\''") + "'"
}

function Is-LocalPath {
  param([Parameter(Mandatory = $true)][string]$Value)
  if ($Value -match '^[a-zA-Z]:[\\/].*') { return $true }
  if ($Value -match '^[\\\\]{2}[^\\\\]+') { return $true }
  return $false
}

function Normalize-ScpTarget {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RawTarget,

    [Parameter(Mandatory = $false)]
    [string]$User
  )

  $t = $RawTarget.Trim()

  $m = [regex]::Match($t, '^[\\/]{1,2}(?<host>\d{1,3}(?:\.\d{1,3}){3})(?<path>/.*)$')
  if ($m.Success) {
    $t = "$($m.Groups['host'].Value):$($m.Groups['path'].Value)"
  } elseif ($t -notlike '*:*') {
    $m2 = [regex]::Match($t, '^(?<host>\d{1,3}(?:\.\d{1,3}){3})(?<path>/.*)$')
    if ($m2.Success) {
      $t = "$($m2.Groups['host'].Value):$($m2.Groups['path'].Value)"
    }
  }

  if ($User) {
    if ($t -notmatch '^[^:]+@') {
      $parts = $t.Split(':', 2)
      if ($parts.Length -eq 2) {
        $t = "$User@$($parts[0]):$($parts[1])"
      }
    }
  }

  return $t
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectName = Split-Path $repoRoot -Leaf
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'

if (-not $OutRoot) {
  $OutRoot = Join-Path $env:TEMP 'pishare-export'
}

$stageDir = Join-Path $OutRoot "$projectName-$timestamp"

Write-Host "Repo     : $repoRoot"
Write-Host "Mode     : $Mode"
Write-Host "Staging  : $stageDir"

New-Item -ItemType Directory -Force -Path $stageDir | Out-Null

if ($Mode -eq 'dist') {
  $distSrc = Join-Path $repoRoot 'dist'
  if (-not (Test-Path $distSrc)) {
    throw "Missing `dist/` at $distSrc (run `npm run build` first)."
  }

  $null = Invoke-Robocopy -Source $distSrc -Destination (Join-Path $stageDir 'dist') -Args @('/E') -DryRun:$DryRun

  $adminDistSrc = Join-Path $repoRoot 'apps\\admin\\dist'
  if (Test-Path $adminDistSrc) {
    $null = Invoke-Robocopy -Source $adminDistSrc -Destination (Join-Path $stageDir 'apps\\admin\\dist') -Args @('/E') -DryRun:$DryRun
  }
} else {
  $excludeDirs = @(
    '.git',
    'node_modules',
    '.vscode',
    'apps\\admin\\node_modules'
  )

  if ($Mode -eq 'source') {
    $excludeDirs += @('dist', 'apps\\admin\\dist')
  }

  $excludeFiles = @(
    '*.log',
    '*.err.log',
    '*.out.log',
    'tmp_*',
    '.env',
    '.env.local',
    '.env.production',
    '.env.development',
    '.env.test'
  )

  $args = @(
    '/E',
    '/XJ',
    '/R:2',
    '/W:2',
    '/NFL',
    '/NDL',
    '/NJH',
    '/NJS',
    '/NP',
    '/XD'
  ) + $excludeDirs + @('/XF') + $excludeFiles

  $null = Invoke-Robocopy -Source $repoRoot -Destination $stageDir -Args $args -DryRun:$DryRun
}

Write-Host "Staged   : $stageDir"

if ($NoTransfer -or -not $Target) {
  exit 0
}

if ((Is-LocalPath $Target) -or (Test-Path $Target)) {
  $localDest = Join-Path $Target (Split-Path $stageDir -Leaf)
  $null = Invoke-Robocopy -Source $stageDir -Destination $localDest -Args @('/E', '/R:2', '/W:2') -DryRun:$DryRun
  Write-Host "Copied   : $localDest"
  exit 0
}

$scpTarget = Normalize-ScpTarget -RawTarget $Target -User $User
Write-Host "SCP dest : $scpTarget"

if ($IdentityFile -and -not (Test-Path $IdentityFile)) {
  throw "IdentityFile not found: $IdentityFile"
}

$sshArgs = @('-p', "$Port", '-o', 'ConnectTimeout=10')
$scpArgs = @('-r', '-p', '-P', "$Port", '-o', 'ConnectTimeout=10')
if ($IdentityFile) {
  $sshArgs += @('-i', $IdentityFile)
  $scpArgs += @('-i', $IdentityFile)
}

$parts = $scpTarget.Split(':', 2)
if ($parts.Length -ne 2) {
  throw "Invalid scp target: $scpTarget"
}

$hostPart = $parts[0]
$remoteBase = $parts[1]
if (-not $remoteBase.StartsWith('/')) { $remoteBase = "/$remoteBase" }

$mkdirCmd = 'mkdir -p ' + (Quote-ShSingle $remoteBase)

if ($DryRun) {
  Write-Host ('ssh ' + (($sshArgs + @($hostPart, $mkdirCmd)) -join ' '))
  Write-Host ('scp ' + (($scpArgs + @("`"$stageDir`"", $scpTarget)) -join ' '))
  exit 0
}

& ssh @sshArgs $hostPart $mkdirCmd | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "ssh mkdir failed (exit code $LASTEXITCODE)"
}

& scp @scpArgs $stageDir $scpTarget | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "scp failed (exit code $LASTEXITCODE)"
}

Write-Host "Transferred: $stageDir -> $scpTarget"
