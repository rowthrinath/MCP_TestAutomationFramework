# PowerShell script to generate and launch LivingDoc report after tests complete

$ErrorActionPreference = "Stop"

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptPath

Set-Location $projectDir

Write-Host "📊 Generating LivingDoc report..." -ForegroundColor Cyan

# Paths
$binDir = Join-Path $projectDir "bin\Debug\net9.0"
$testAssembly = Join-Path $binDir "Tests.CSharp.dll"
$outputDir = Join-Path $projectDir "TestResults"
$livingDocFile = Join-Path $outputDir "LivingDoc.html"

# Create output directory if it doesn't exist
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

# Check if test execution file exists
$testExecutionJson = Join-Path $binDir "TestExecution.json"
if (-not (Test-Path $testExecutionJson)) {
    Write-Host "⚠️  TestExecution.json not found. Running tests first..." -ForegroundColor Yellow
    dotnet test Tests.CSharp.csproj --logger "trx;LogFileName=$(Join-Path $outputDir "results.trx")"
}

# Check if LivingDoc CLI is installed
$livingDocCmd = Get-Command livingdoc -ErrorAction SilentlyContinue
if (-not $livingDocCmd) {
    Write-Host "📦 Installing LivingDoc CLI tool..." -ForegroundColor Yellow
    dotnet tool install --global SpecFlow.Plus.LivingDoc.CLI --version 3.9.57
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Global installation failed. Trying local installation..." -ForegroundColor Yellow
        $toolsPath = Join-Path $projectDir ".tools"
        dotnet tool install SpecFlow.Plus.LivingDoc.CLI --tool-path $toolsPath --version 3.9.57
        $env:PATH = "$toolsPath;$env:PATH"
    }
}

# Generate LivingDoc report with screenshots support
Write-Host "Generating LivingDoc from test assembly..." -ForegroundColor Cyan
$screenshotsDir = Join-Path $outputDir "Screenshots"

try {
    # Include screenshots directory if it exists
    if (Test-Path $screenshotsDir) {
        Write-Host "Including screenshots from $screenshotsDir..." -ForegroundColor Cyan
        livingdoc test-assembly "$testAssembly" -t "$testExecutionJson" -o "$livingDocFile" --attachments "$screenshotsDir"
    } else {
        livingdoc test-assembly "$testAssembly" -t "$testExecutionJson" -o "$livingDocFile"
    }
} catch {
    Write-Host "⚠️  LivingDoc generation with attachments failed. Trying without attachments..." -ForegroundColor Yellow
    try {
        livingdoc test-assembly "$testAssembly" -t "$testExecutionJson" -o "$livingDocFile"
    } catch {
        Write-Host "⚠️  LivingDoc generation failed. Trying alternative method..." -ForegroundColor Yellow
        try {
            livingdoc test-assembly "$testAssembly" --output "$outputDir"
            $livingDocFile = Join-Path $outputDir "LivingDoc.html"
        } catch {
            Write-Host "⚠️  Could not generate LivingDoc report." -ForegroundColor Yellow
            Write-Host "Make sure you have SpecFlow+ LivingDoc installed or use the open-source LivingDoc CLI."
            exit 0
        }
    }
}

# Check if report was generated
if (Test-Path $livingDocFile) {
    Write-Host "✅ LivingDoc report generated successfully!" -ForegroundColor Green
    Write-Host "📄 Report location: $livingDocFile" -ForegroundColor Cyan
    Write-Host ""
    
    # Open the report in default browser
    Write-Host "🌐 Opening LivingDoc report..." -ForegroundColor Cyan
    Start-Process $livingDocFile
} else {
    Write-Host "⚠️  LivingDoc report file not found at expected location." -ForegroundColor Yellow
    exit 1
}

