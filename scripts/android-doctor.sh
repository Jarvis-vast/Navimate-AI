#!/usr/bin/env bash
set -euo pipefail

echo "=================================================="
echo "          NaviMate AI — Android Doctor            "
echo "=================================================="

TOTAL_CHECKS=0
PASSED_CHECKS=0
MISSING_CHECKS=0
FAILED_CHECKS=0

check_status() {
    local label="$1"
    local status="$2"
    local detail="${3:-}"

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if [ "$status" = "PASS" ]; then
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        printf "  %-36s : \033[0;32m[%s]\033[0m %s\n" "$label" "$status" "$detail"
    elif [ "$status" = "MISSING" ]; then
        MISSING_CHECKS=$((MISSING_CHECKS + 1))
        printf "  %-36s : \033[0;33m[%s]\033[0m %s\n" "$label" "$status" "$detail"
    else
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        printf "  %-36s : \033[0;31m[%s]\033[0m %s\n" "$label" "$status" "$detail"
    fi
}

echo ""
echo "1. Host Operating System:"
OS_NAME="$(uname -s 2>/dev/null || echo "Unknown")"
ARCH_NAME="$(uname -m 2>/dev/null || echo "Unknown")"
check_status "Operating System" "PASS" "$OS_NAME ($ARCH_NAME)"

echo ""
echo "2. Java Development Kit (JDK):"
if command -v java >/dev/null 2>&1; then
    JAVA_VER="$(java -version 2>&1 | head -n 1)"
    if echo "$JAVA_VER" | grep -E -q '"(17|21)\.'; then
        check_status "Java JDK" "PASS" "$JAVA_VER"
    else
        check_status "Java JDK" "FAIL" "Found $JAVA_VER (Requires JDK 17 or JDK 21)"
    fi
else
    check_status "Java JDK" "MISSING" "No 'java' binary detected in PATH. (Install OpenJDK 17)"
fi

echo ""
echo "3. Gradle Wrapper:"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GRADLEW_PATH="$PROJECT_ROOT/android/gradlew"
GRADLE_WRAPPER_PROPS="$PROJECT_ROOT/android/gradle/wrapper/gradle-wrapper.properties"

if [ -f "$GRADLEW_PATH" ] && [ -x "$GRADLEW_PATH" ]; then
    check_status "Gradle Wrapper (gradlew)" "PASS" "Executable present at android/gradlew"
else
    if [ -f "$GRADLEW_PATH" ]; then
        check_status "Gradle Wrapper (gradlew)" "FAIL" "File exists but not marked executable (+x)"
    else
        check_status "Gradle Wrapper (gradlew)" "MISSING" "android/gradlew not found"
    fi
fi

if [ -f "$GRADLE_WRAPPER_PROPS" ]; then
    DIST_URL="$(grep "distributionUrl" "$GRADLE_WRAPPER_PROPS" 2>/dev/null || echo "")"
    check_status "Gradle Distribution Config" "PASS" "$DIST_URL"
else
    check_status "Gradle Distribution Config" "MISSING" "gradle-wrapper.properties missing"
fi

echo ""
echo "4. Android SDK & Environment:"
SDK_DIR="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [ -z "$SDK_DIR" ]; then
    if [ -d "$HOME/Android/Sdk" ]; then
        SDK_DIR="$HOME/Android/Sdk"
    elif [ -d "$HOME/Library/Android/sdk" ]; then
        SDK_DIR="$HOME/Library/Android/sdk"
    fi
fi

if [ -n "$SDK_DIR" ] && [ -d "$SDK_DIR" ]; then
    check_status "Android SDK Location" "PASS" "$SDK_DIR"

    # Check compileSdk 34 (platforms/android-34)
    if [ -d "$SDK_DIR/platforms/android-34" ]; then
        check_status "compileSdk (android-34)" "PASS" "Installed"
    else
        check_status "compileSdk (android-34)" "MISSING" "Run: sdkmanager 'platforms;android-34'"
    fi

    # Check build-tools
    BUILD_TOOLS_DIR="$SDK_DIR/build-tools"
    if [ -d "$BUILD_TOOLS_DIR" ] && [ "$(ls -A "$BUILD_TOOLS_DIR" 2>/dev/null)" ]; then
        LATEST_BT="$(ls -1 "$BUILD_TOOLS_DIR" | tail -n 1)"
        check_status "Android Build-Tools" "PASS" "$LATEST_BT"
    else
        check_status "Android Build-Tools" "MISSING" "Run: sdkmanager 'build-tools;34.0.0'"
    fi

    # Check platform-tools (adb)
    if [ -f "$SDK_DIR/platform-tools/adb" ] || command -v adb >/dev/null 2>&1; then
        ADB_BIN="$(command -v adb 2>/dev/null || echo "$SDK_DIR/platform-tools/adb")"
        check_status "Platform-Tools (adb)" "PASS" "$ADB_BIN"
    else
        check_status "Platform-Tools (adb)" "MISSING" "adb not found in SDK or PATH"
    fi

    # Check emulator
    if [ -f "$SDK_DIR/emulator/emulator" ] || command -v emulator >/dev/null 2>&1; then
        EMU_BIN="$(command -v emulator 2>/dev/null || echo "$SDK_DIR/emulator/emulator")"
        check_status "Android Emulator" "PASS" "$EMU_BIN"
    else
        check_status "Android Emulator" "MISSING" "Emulator binary not found"
    fi

    # Check Google APIs system images
    SYS_IMG_DIR="$SDK_DIR/system-images"
    if [ -d "$SYS_IMG_DIR" ] && [ "$(find "$SYS_IMG_DIR" -type d -name "google_apis*" 2>/dev/null)" ]; then
        check_status "Google APIs System Image" "PASS" "Installed"
    else
        check_status "Google APIs System Image" "MISSING" "Run: sdkmanager 'system-images;android-34;google_apis;x86_64'"
    fi
else
    check_status "Android SDK Location" "MISSING" "ANDROID_HOME / ANDROID_SDK_ROOT not set"
    check_status "compileSdk (android-34)" "MISSING" "Requires Android SDK"
    check_status "Android Build-Tools" "MISSING" "Requires Android SDK"
    check_status "Platform-Tools (adb)" "MISSING" "Requires Android SDK"
    check_status "Android Emulator" "MISSING" "Requires Android SDK"
    check_status "Google APIs System Image" "MISSING" "Requires Android SDK"
fi

echo ""
echo "5. Local Credentials & Secrets:"
LOCAL_PROPS="$PROJECT_ROOT/android/local.properties"
if [ -f "$LOCAL_PROPS" ]; then
    if grep -q "MAPS_API_KEY=" "$LOCAL_PROPS" && ! grep -q "MAPS_API_KEY=YOUR_" "$LOCAL_PROPS" && ! grep -q "MAPS_API_KEY=\"\"" "$LOCAL_PROPS"; then
        check_status "Google Maps API Key (local.properties)" "PASS" "Configured securely (not committed)"
    else
        check_status "Google Maps API Key (local.properties)" "FAIL" "Found template placeholder or empty key in local.properties"
    fi
else
    check_status "Google Maps API Key (local.properties)" "MISSING" "android/local.properties missing (copy from local.properties.example)"
fi

echo ""
echo "=================================================="
printf "Diagnostic Summary: %d Total | \033[0;32m%d PASS\033[0m | \033[0;33m%d MISSING\033[0m | \033[0;31m%d FAIL\033[0m\n" \
    "$TOTAL_CHECKS" "$PASSED_CHECKS" "$MISSING_CHECKS" "$FAILED_CHECKS"
echo "=================================================="

if [ "$FAILED_CHECKS" -gt 0 ] || [ "$MISSING_CHECKS" -gt 0 ]; then
    exit 1
fi
exit 0
