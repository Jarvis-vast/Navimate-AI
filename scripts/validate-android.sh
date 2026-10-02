#!/usr/bin/env bash
set -uo pipefail

echo "=================================================="
echo "      NaviMate AI — Comprehensive Android Audit    "
echo "=================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TOTAL_STEPS=0
PASSED_STEPS=0
SKIPPED_STEPS=0
FAILED_STEPS=0

report_step() {
    local name="$1"
    local status="$2"
    local notes="${3:-}"

    TOTAL_STEPS=$((TOTAL_STEPS + 1))
    if [ "$status" = "PASS" ]; then
        PASSED_STEPS=$((PASSED_STEPS + 1))
        printf "  %-32s : \033[0;32m[%s]\033[0m %s\n" "$name" "$status" "$notes"
    elif [ "$status" = "NOT RUN" ] || [ "$status" = "SKIPPED" ]; then
        SKIPPED_STEPS=$((SKIPPED_STEPS + 1))
        printf "  %-32s : \033[0;33m[%s]\033[0m %s\n" "$name" "$status" "$notes"
    else
        FAILED_STEPS=$((FAILED_STEPS + 1))
        printf "  %-32s : \033[0;31m[%s]\033[0m %s\n" "$name" "$status" "$notes"
    fi
}

echo ""
echo "--- STEP 1: Environment Diagnostic (Doctor) ---"
if bash "$SCRIPT_DIR/android-doctor.sh"; then
    report_step "Environment Doctor" "PASS" "All required toolchain elements present"
    CAN_BUILD=true
else
    report_step "Environment Doctor" "SKIPPED" "Incomplete Android toolchain in current container environment"
    CAN_BUILD=false
fi

echo ""
echo "--- STEP 2: Security & Credential Scan ---"
if bash "$SCRIPT_DIR/security-scan.sh"; then
    report_step "Security Scan" "PASS" "Zero committed secrets or leaked route tokens"
else
    report_step "Security Scan" "FAIL" "Credential violations detected"
fi

echo ""
echo "--- STEP 3: Route Contract & Backend Verification ---"
if npm test; then
    report_step "Shared Route Contracts" "PASS" "RouteResult & fuel math tests verified"
else
    report_step "Shared Route Contracts" "FAIL" "Contract tests failed"
fi

echo ""
echo "--- STEP 4: Android Unit Tests & Architecture ---"
if [ "$CAN_BUILD" = true ] && [ -x "$PROJECT_ROOT/android/gradlew" ]; then
    echo "Running Gradle unit tests..."
    if (cd "$PROJECT_ROOT/android" && ./gradlew :app:test); then
        report_step "Android Unit Tests" "PASS" "Lifecycle & NavigationCoreTest passed"
    else
        report_step "Android Unit Tests" "FAIL" "Gradle unit tests failed"
    fi
else
    report_step "Android Unit Tests" "NOT RUN" "Requires host JDK & Android SDK"
fi

echo ""
echo "--- STEP 5: Android Debug APK Compilation ---"
if [ "$CAN_BUILD" = true ] && [ -x "$PROJECT_ROOT/android/gradlew" ]; then
    echo "Assembling debug APK..."
    if (cd "$PROJECT_ROOT/android" && ./gradlew :app:assembleDebug); then
        report_step "Android Debug Build" "PASS" "assembleDebug succeeded"
    else
        report_step "Android Debug Build" "FAIL" "assembleDebug failed"
    fi
else
    report_step "Android Debug Build" "NOT RUN" "Requires host JDK & Android SDK"
fi

echo ""
echo "--- STEP 6: Android Release Compile Verification ---"
if [ "$CAN_BUILD" = true ] && [ -x "$PROJECT_ROOT/android/gradlew" ]; then
    echo "Assembling release compile..."
    if (cd "$PROJECT_ROOT/android" && ./gradlew :app:assembleRelease); then
        report_step "Android Release Compile" "PASS" "assembleRelease compiled cleanly"
    else
        report_step "Android Release Compile" "FAIL" "assembleRelease failed"
    fi
else
    report_step "Android Release Compile" "NOT RUN" "Requires host JDK & Android SDK"
fi

echo ""
echo "--- STEP 7: Android Connected Emulator / Hardware Test ---"
if command -v adb >/dev/null 2>&1 && [ -n "$(adb devices 2>/dev/null | grep -w "device")" ]; then
    echo "Active device/emulator detected via adb. Running instrumentation..."
    if (cd "$PROJECT_ROOT/android" && ./gradlew :app:connectedDebugAndroidTest); then
        report_step "Connected Emulator Test" "PASS" "Instrumentation passed"
    else
        report_step "Connected Emulator Test" "FAIL" "Instrumentation failed"
    fi
else
    report_step "Connected Emulator Test" "NOT RUN" "No active Android device or emulator connected"
fi

echo ""
echo "=================================================="
echo "Audit Summary:"
printf "  Total Checks : %d\n" "$TOTAL_STEPS"
printf "  \033[0;32mPassed\033[0m       : %d\n" "$PASSED_STEPS"
printf "  \033[0;33mNot Run/Skip\033[0m : %d\n" "$SKIPPED_STEPS"
printf "  \033[0;31mFailed\033[0m       : %d\n" "$FAILED_STEPS"
echo "=================================================="

if [ "$FAILED_STEPS" -gt 0 ]; then
    exit 1
fi
exit 0
