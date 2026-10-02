# NaviMate AI — Single Command Android Audit (PowerShell)
$ErrorActionPreference = "Continue"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "      NaviMate AI — Comprehensive Android Audit    " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

$TotalSteps = 0
$PassedSteps = 0
$SkippedSteps = 0
$FailedSteps = 0

function Report-Step {
    param(
        [string]$Name,
        [string]$Status,
        [string]$Notes = ""
    )
    $script:TotalSteps++
    $PadName = $Name.PadRight(32)
    if ($Status -eq "PASS") {
        $script:PassedSteps++
        Write-Host "  $PadName : " -NoNewline
        Write-Host "[$Status] " -ForegroundColor Green -NoNewline
        Write-Host "$Notes"
    } elseif ($Status -eq "NOT RUN" -or $Status -eq "SKIPPED") {
        $script:SkippedSteps++
        Write-Host "  $PadName : " -NoNewline
        Write-Host "[$Status] " -ForegroundColor Yellow -NoNewline
        Write-Host "$Notes"
    } else {
        $script:FailedSteps++
        Write-Host "  $PadName : " -NoNewline
        Write-Host "[$Status] " -ForegroundColor Red -NoNewline
        Write-Host "$Notes"
    }
}

Write-Host "`n--- STEP 1: Environment Diagnostic (Doctor) ---"
& "$ScriptDir\android-doctor.ps1"
if ($LASTEXITCODE -eq 0) {
    Report-Step "Environment Doctor" "PASS" "Toolchain ready"
    $CanBuild = $true
} else {
    Report-Step "Environment Doctor" "SKIPPED" "Incomplete Android toolchain on host"
    $CanBuild = $false
}

Write-Host "`n--- STEP 2: Contract Tests ---"
npm test
if ($LASTEXITCODE -eq 0) {
    Report-Step "Shared Route Contracts" "PASS" "Contract tests passed"
} else {
    Report-Step "Shared Route Contracts" "FAIL" "Contract tests failed"
}

Write-Host "`n--- STEP 3: Android Unit Tests ---"
if ($CanBuild) {
    Push-Location "$ProjectRoot\android"
    & .\gradlew.bat :app:test
    Pop-Location
    if ($LASTEXITCODE -eq 0) {
        Report-Step "Android Unit Tests" "PASS" "Tests passed"
    } else {
        Report-Step "Android Unit Tests" "FAIL" "Tests failed"
    }
} else {
    Report-Step "Android Unit Tests" "NOT RUN" "Requires JDK and Android SDK"
}

Write-Host "`n--- STEP 4: Android Debug Build ---"
if ($CanBuild) {
    Push-Location "$ProjectRoot\android"
    & .\gradlew.bat :app:assembleDebug
    Pop-Location
    if ($LASTEXITCODE -eq 0) {
        Report-Step "Android Debug Build" "PASS" "Debug APK compiled"
    } else {
        Report-Step "Android Debug Build" "FAIL" "Build failed"
    }
} else {
    Report-Step "Android Debug Build" "NOT RUN" "Requires JDK and Android SDK"
}

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "Audit Summary: $TotalSteps Total | $PassedSteps PASS | $SkippedSteps NOT RUN | $FailedSteps FAIL"
Write-Host "==================================================" -ForegroundColor Cyan
