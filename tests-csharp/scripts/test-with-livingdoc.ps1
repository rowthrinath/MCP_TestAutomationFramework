# PowerShell script to run tests and automatically generate/launch LivingDoc report

$ErrorActionPreference = "Stop"

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptPath

Set-Location $projectDir

Write-Host "🧪 Running tests..." -ForegroundColor Cyan
Write-Host ""

# Run tests with LivingDoc plugin
dotnet test Tests.CSharp.csproj --logger "trx;LogFileName=TestResults/results.trx" $args

Write-Host ""
Write-Host "✅ Tests completed. Generating LivingDoc report..." -ForegroundColor Green
Write-Host ""

# Generate and launch LivingDoc
& (Join-Path $scriptPath "generate-livingdoc.ps1")

