param(
  [string]$WebTag = "orbit-web:local",
  [string]$ApiTag = "orbit-api:local",
  [switch]$PullBase
)

$ErrorActionPreference = "Stop"

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Description,

    [Parameter(Mandatory = $true)]
    [scriptblock]$Command
  )

  Write-Host "==> $Description"
  & $Command

  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE"
  }
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
$PullArgs = @()
if ($PullBase) {
  $PullArgs += "--pull"
}

Write-Host "==> Note: the first bun install inside Docker can be quiet for a while before verbose package logs appear."

Invoke-CheckedCommand -Description "Building web image: $WebTag" -Command {
  docker build --progress plain @PullArgs -f "$RepoRoot/apps/web/Dockerfile" -t $WebTag $RepoRoot
}

Invoke-CheckedCommand -Description "Building api image: $ApiTag" -Command {
  docker build --progress plain @PullArgs -f "$RepoRoot/apps/api/Dockerfile" -t $ApiTag $RepoRoot
}

Write-Host "==> Done"
Write-Host "   Web: $WebTag"
Write-Host "   API: $ApiTag"
