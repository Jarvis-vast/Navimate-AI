# NaviMate AI — Android Build Reproducibility Specification

This document provides a deterministic guide for any engineer or automated build pipeline to reproduce NaviMate AI Android artifacts without ambiguity.

---

## 1. Exact Toolchain Specification

- **Java Development Kit (JDK)**: Eclipse Temurin OpenJDK 17.0.10+7 (LTS)
- **Gradle Wrapper**: 8.7 (`android/gradle/wrapper/gradle-wrapper.properties`)
- **Android Gradle Plugin (AGP)**: 8.5.2
- **Kotlin Version**: 2.0.0
- **Jetpack Compose Compiler**: 2.0.0 (Kotlin 2.0 Compose compiler plugin)
- **Jetpack Compose BOM**: 2024.06.00
- **Compile SDK**: 34 (Android 14)
- **Target SDK**: 34
- **Min SDK**: 26 (Android 8.0 Oreo)
- **Google Navigation SDK**: `com.google.android.libraries.navigation:navigation:7.6.0`
- **Google Play Services Location**: `com.google.android.gms:play-services-location:21.3.0`
- **Android for Cars App Library**: `androidx.car.app:app:1.4.0` & `androidx.car.app:app-projected:1.4.0`
- **Retrofit**: 2.11.0
- **Gson**: 2.11.0

---

## 2. Source Repositories

Configured in `android/settings.gradle.kts`:
- `google()`: Official Google Maven repository hosting Google Navigation SDK and Play Services
- `mavenCentral()`: OSS libraries (Retrofit, Gson, Coroutines)
- `gradlePluginPortal()`: Gradle build plugins

No private Maven authentication is required; Navigation SDK 7.6.0+ is distributed via standard Google Maven.

---

## 3. Build Commands

All commands are invoked from the `android/` directory using the authoritative Gradle wrapper (`./gradlew` or `gradlew.bat`):

### Unit Tests
```bash
cd android
./gradlew :app:test
```

### Debug Build
```bash
cd android
./gradlew :app:assembleDebug
```
Artifact output location:
`android/app/build/outputs/apk/debug/app-debug.apk`

### Release Compilation (Unsigned)
```bash
cd android
./gradlew :app:assembleRelease
```
Artifact output location:
`android/app/build/outputs/apk/release/app-release-unsigned.apk`

*Simulation Safety in Release*:
In `buildTypes.release`, `buildConfigField("boolean", "ALLOW_SIMULATION", "false")` is enforced at compile time. Release builds strip simulation controls and reject simulated GPS locations.

---

## 4. Single-Command Validation

To audit the full pipeline:
```bash
bash scripts/validate-android.sh
```
