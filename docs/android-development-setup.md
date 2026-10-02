# NaviMate AI — Android Development Setup Guide

This document defines the exact prerequisites and configuration required to build, test, and run the native NaviMate AI Android application.

---

## 1. Prerequisites Matrix

| Component | Required Version | Verification Command | Notes |
|---|---|---|---|
| **OS** | Linux (Ubuntu 22.04+), macOS (13+), or Windows 11 | `uname -a` | KVM hardware acceleration required for Android emulator |
| **JDK** | OpenJDK 17 LTS | `java -version` | Gradle 8.7 & AGP 8.5.2 require JDK 17 |
| **Android SDK** | API Level 34 (Android 14) | `sdkmanager --list` | Path exported to `$ANDROID_HOME` |
| **Android Build Tools** | 34.0.0 | `ls $ANDROID_HOME/build-tools` | |
| **Gradle** | 8.7 (via Gradle Wrapper) | `./gradlew --version` | Do NOT use system gradle |
| **Kotlin** | 2.0.0 (Compose Compiler 2.0.0) | Checked in `build.gradle.kts` | |
| **Google Navigation SDK** | 7.6.0+ | Checked in `app/build.gradle.kts` | Provided via Google Maven |
| **Play Services Location** | 21.3.0 | Checked in `app/build.gradle.kts` | Fused Location Provider |

---

## 2. Environment Variables

Add to your shell configuration (`~/.bashrc`, `~/.zshrc`, or Windows System Properties):

```bash
export JAVA_HOME="/path/to/jdk-17"
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

---

## 3. SDK Installation (Headless / CLI)

If setting up on a workstation or Linux CI server without Android Studio:

```bash
# Install command-line tools
sdkmanager --install "cmdline-tools;latest"
sdkmanager --install "platforms;android-34"
sdkmanager --install "build-tools;34.0.0"
sdkmanager --install "platform-tools"
sdkmanager --install "system-images;android-34;google_apis;x86_64"
```

Accept licenses:
```bash
yes | sdkmanager --licenses
```

---

## 4. API Key Configuration (Secrets)

1. Copy the template:
   ```bash
   cp android/local.properties.example android/local.properties
   ```
2. Edit `android/local.properties`:
   ```properties
   MAPS_API_KEY=AIzaSyYourRestrictedGoogleMapsKeyHere
   ```
3. Ensure the key has permissions enabled in Google Cloud Console:
   - Maps SDK for Android
   - Navigation SDK for Android
   - Routes API

*Note*: Server-side Gemini API keys (`GEMINI_API_KEY`) are managed strictly on the backend and are **never** included in `local.properties` or bundled into client APKs.

---

## 5. Doctor Diagnostic

Run the automated diagnostic tool to verify all components:

```bash
# On Linux / macOS
bash scripts/android-doctor.sh

# On Windows (PowerShell)
.\scripts\android-doctor.ps1
```
