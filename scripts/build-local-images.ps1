param(
  [string]$ImageTag = "orbit:local",
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

Invoke-CheckedCommand -Description "Building image: $ImageTag" -Command {
  docker build --progress plain @PullArgs -f "$RepoRoot/apps/web/Dockerfile" -t $ImageTag $RepoRoot
}

Write-Host "==> Done"
Write-Host "   Image: $ImageTag"
