# NaviMate AI — Android Doctor (PowerShell)
$ErrorActionPreference = "Continue"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "          NaviMate AI — Android Doctor            " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$TotalChecks = 0
$PassedChecks = 0
$MissingChecks = 0
$FailedChecks = 0

function Report-Status {
    param(
        [string]$Label,
        [string]$Status,
        [string]$Detail = ""
    )
    $script:TotalChecks++
    $PadLabel = $Label.PadRight(36)
    if ($Status -eq "PASS") {
        $script:PassedChecks++
        Write-Host "  $PadLabel : " -NoNewline
        Write-Host "[$Status] " -ForegroundColor Green -NoNewline
        Write-Host "$Detail"
    } elseif ($Status -eq "MISSING") {
        $script:MissingChecks++
        Write-Host "  $PadLabel : " -NoNewline
        Write-Host "[$Status] " -ForegroundColor Yellow -NoNewline
        Write-Host "$Detail"
    } else {
        $script:FailedChecks++
        Write-Host "  $PadLabel : " -NoNewline
        Write-Host "[$Status] " -ForegroundColor Red -NoNewline
        Write-Host "$Detail"
    }
}

Write-Host "`n1. Host Operating System:"
$OsDesc = [System.Runtime.InteropServices.RuntimeInformation]::OSDescription
Report-Status "Operating System" "PASS" "$OsDesc"

Write-Host "`n2. Java Development Kit (JDK):"
$JavaCmd = Get-Command java -ErrorAction SilentlyContinue
if ($JavaCmd) {
    $JavaVer = & java -version 2>&1 | Select-Object -First 1
    if ($JavaVer -match '"(17|21)\.') {
        Report-Status "Java JDK" "PASS" "$JavaVer"
    } else {
        Report-Status "Java JDK" "FAIL" "Found $JavaVer (Requires JDK 17 or 21)"
    }
} else {
    Report-Status "Java JDK" "MISSING" "No 'java' command in PATH. Install OpenJDK 17."
}

Write-Host "`n3. Gradle Wrapper:"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$GradlewBat = Join-Path $ProjectRoot "android\gradlew.bat"
$GradleProps = Join-Path $ProjectRoot "android\gradle\wrapper\gradle-wrapper.properties"

if (Test-Path $GradlewBat) {
    Report-Status "Gradle Wrapper (gradlew.bat)" "PASS" "Found at android\gradlew.bat"
} else {
    Report-Status "Gradle Wrapper (gradlew.bat)" "MISSING" "android\gradlew.bat not found"
}

if (Test-Path $GradleProps) {
    $DistUrl = Get-Content $GradleProps | Where-Object { $_ -match "distributionUrl" }
    Report-Status "Gradle Distribution Config" "PASS" "$DistUrl"
} else {
    Report-Status "Gradle Distribution Config" "MISSING" "gradle-wrapper.properties missing"
}

Write-Host "`n4. Android SDK & Environment:"
$SdkDir = $env:ANDROID_HOME
if (-not $SdkDir) { $SdkDir = $env:ANDROID_SDK_ROOT }
if (-not $SdkDir -and (Test-Path "$env:LOCALAPPDATA\Android\Sdk")) {
    $SdkDir = "$env:LOCALAPPDATA\Android\Sdk"
}

if ($SdkDir -and (Test-Path $SdkDir)) {
    Report-Status "Android SDK Location" "PASS" "$SdkDir"

    if (Test-Path "$SdkDir\platforms\android-34") {
        Report-Status "compileSdk (android-34)" "PASS" "Installed"
    } else {
        Report-Status "compileSdk (android-34)" "MISSING" "Run: sdkmanager 'platforms;android-34'"
    }

    $BtDir = "$SdkDir\build-tools"
    if ((Test-Path $BtDir) -and (Get-ChildItem $BtDir)) {
        $LatestBt = (Get-ChildItem $BtDir | Sort-Object Name -Descending | Select-Object -First 1).Name
        Report-Status "Android Build-Tools" "PASS" "$LatestBt"
    } else {
        Report-Status "Android Build-Tools" "MISSING" "Run: sdkmanager 'build-tools;34.0.0'"
    }

    $AdbCmd = Get-Command adb -ErrorAction SilentlyContinue
    if ($AdbCmd -or (Test-Path "$SdkDir\platform-tools\adb.exe")) {
        Report-Status "Platform-Tools (adb)" "PASS" "Available"
    } else {
        Report-Status "Platform-Tools (adb)" "MISSING" "adb.exe not found"
    }

    $EmuCmd = Get-Command emulator -ErrorAction SilentlyContinue
    if ($EmuCmd -or (Test-Path "$SdkDir\emulator\emulator.exe")) {
        Report-Status "Android Emulator" "PASS" "Available"
    } else {
        Report-Status "Android Emulator" "MISSING" "emulator.exe not found"
    }
} else {
    Report-Status "Android SDK Location" "MISSING" "ANDROID_HOME not set and default location empty"
    Report-Status "compileSdk (android-34)" "MISSING" "Requires Android SDK"
    Report-Status "Android Build-Tools" "MISSING" "Requires Android SDK"
    Report-Status "Platform-Tools (adb)" "MISSING" "Requires Android SDK"
    Report-Status "Android Emulator" "MISSING" "Requires Android SDK"
}

Write-Host "`n5. Local Credentials & Secrets:"
$LocalProps = Join-Path $ProjectRoot "android\local.properties"
if (Test-Path $LocalProps) {
    $KeyLine = Get-Content $LocalProps | Where-Object { $_ -match "MAPS_API_KEY=" -and $_ -notmatch "YOUR_" }
    if ($KeyLine) {
        Report-Status "Google Maps API Key (local.properties)" "PASS" "Configured securely"
    } else {
        Report-Status "Google Maps API Key (local.properties)" "FAIL" "Template placeholder or empty in local.properties"
    }
} else {
    Report-Status "Google Maps API Key (local.properties)" "MISSING" "android\local.properties missing"
}

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "Diagnostic Summary: $TotalChecks Total | $PassedChecks PASS | $MissingChecks MISSING | $FailedChecks FAIL"
Write-Host "==================================================" -ForegroundColor Cyan
