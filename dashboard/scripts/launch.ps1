# Zmanei Nezach usage dashboard launcher.
# Mirrors the canonical ~/.claude/skills/secrets-via-bws/examples/launch.ps1:
# pull BWS_ACCESS_TOKEN from Windows Credential Manager, then let `bws run`
# inject the project's secrets as environment variables. No secret is ever
# written to a file in this repo.
#
# The reader is named credman-read.ps1 rather than the canonical get-token.ps1
# because .gitignore's `*token*` guard — which exists to stop real secrets
# being committed — also swallowed this file, and a launcher whose helper is
# missing from a fresh clone is a launcher that does not run.

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir    = Split-Path -Parent $scriptDir
$projectId = '1babe053-e4d5-4536-a578-b448014c8956'  # personal-dev

$bws = Get-Command bws -ErrorAction SilentlyContinue
if (-not $bws) {
    Write-Host "ERROR: bws CLI not found on PATH." -ForegroundColor Red
    Write-Host "Expected location: C:\Users\USER\.local\bin\bws.exe" -ForegroundColor Yellow
    exit 1
}

$token = & (Join-Path $scriptDir 'credman-read.ps1')
if (-not $token) {
    Write-Host "ERROR: BWS_ACCESS_TOKEN missing from Credential Manager." -ForegroundColor Red
    Write-Host "Run ~\.claude\skills\secrets-via-bws\examples\save-bws-token.ps1 to store it." -ForegroundColor Yellow
    exit 1
}
$env:BWS_ACCESS_TOKEN = $token

Set-Location $appDir
& bws run --project-id $projectId -- node refresh.mjs $args
exit $LASTEXITCODE
