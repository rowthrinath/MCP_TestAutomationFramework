# PowerShell script to run SpecFlow tests in parallel across multiple browsers
# Similar to Playwright's project-based parallel execution

$ErrorActionPreference = "Stop"

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptPath

Set-Location $projectDir

Write-Host "🚀 Running tests in parallel across browsers..." -ForegroundColor Cyan
Write-Host ""

# Function to run tests for a specific browser
function Run-BrowserTests {
    param(
        [string]$Browser,
        [string]$BrowserName
    )
    
    Write-Host "Starting tests for $BrowserName..." -ForegroundColor Blue
    
    $env:BROWSER = $Browser
    $env:HEADLESS = "true"
    
    $logFile = "test-output-$Browser.log"
    $resultFile = "test-results-$Browser.trx"
    
    Start-Job -ScriptBlock {
        param($Browser, $BrowserName, $ProjectDir, $LogFile, $ResultFile)
        
        Set-Location $ProjectDir
        $env:BROWSER = $Browser
        $env:HEADLESS = "true"
        
        dotnet test Tests.CSharp.csproj `
            --logger "console;verbosity=minimal" `
            --logger "trx;LogFileName=$ResultFile" `
            > $LogFile 2>&1
        
        return $LASTEXITCODE
    } -ArgumentList $Browser, $BrowserName, $projectDir, $logFile, $resultFile | Out-Null
}

Write-Host "📱 Desktop Browsers:" -ForegroundColor Green

# Run tests for each browser in parallel
$jobs = @(
    (Start-Job -ScriptBlock { 
        param($browser, $name, $dir)
        Set-Location $dir
        $env:BROWSER = $browser
        $env:HEADLESS = "true"
        dotnet test Tests.CSharp.csproj --logger "console;verbosity=minimal" --logger "trx;LogFileName=test-results-$browser.trx"
        return $LASTEXITCODE
    } -ArgumentList "chromium", "Chromium", $projectDir),
    
    (Start-Job -ScriptBlock { 
        param($browser, $name, $dir)
        Set-Location $dir
        $env:BROWSER = $browser
        $env:HEADLESS = "true"
        dotnet test Tests.CSharp.csproj --logger "console;verbosity=minimal" --logger "trx;LogFileName=test-results-$browser.trx"
        return $LASTEXITCODE
    } -ArgumentList "firefox", "Firefox", $projectDir),
    
    (Start-Job -ScriptBlock { 
        param($browser, $name, $dir)
        Set-Location $dir
        $env:BROWSER = $browser
        $env:HEADLESS = "true"
        dotnet test Tests.CSharp.csproj --logger "console;verbosity=minimal" --logger "trx;LogFileName=test-results-$browser.trx"
        return $LASTEXITCODE
    } -ArgumentList "webkit", "WebKit", $projectDir)
)

Write-Host ""
Write-Host "⏳ Waiting for all browser tests to complete..." -ForegroundColor Yellow
Write-Host ""

# Wait for all jobs and collect results
$failed = $false
foreach ($job in $jobs) {
    $result = Receive-Job -Job $job -Wait
    Remove-Job -Job $job
    
    if ($job.State -eq "Failed" -or $result -ne 0) {
        Write-Host "✗ Browser test job failed" -ForegroundColor Red
        $failed = $true
    } else {
        Write-Host "✓ Browser test job completed successfully" -ForegroundColor Green
    }
}

Write-Host ""

if (-not $failed) {
    Write-Host "✅ All browser tests completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Test results are available in:" -ForegroundColor Cyan
    Write-Host "  - test-results-chromium.trx"
    Write-Host "  - test-results-firefox.trx"
    Write-Host "  - test-results-webkit.trx"
} else {
    Write-Host "❌ Some browser tests failed. Check logs:" -ForegroundColor Red
    Write-Host "  - test-output-chromium.log"
    Write-Host "  - test-output-firefox.log"
    Write-Host "  - test-output-webkit.log"
    exit 1
}

