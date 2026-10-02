plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.android.libraries.mapsplatform.secrets-gradle-plugin")
}

android {
    namespace = "com.navimate.ai"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.navimate.ai"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }

        // Build flags for simulation safety
        buildConfigField("boolean", "ALLOW_SIMULATION", "true")
        buildConfigField("String", "BACKEND_BASE_URL", "\"http://10.0.2.2:3000\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            // Simulation is strictly disabled in production builds
            buildConfigField("boolean", "ALLOW_SIMULATION", "false")
            buildConfigField("String", "ENVIRONMENT", "\"release\"")
        }
        staging {
            initWith(getByName("debug"))
            matchingFallbacks += listOf("debug")
            buildConfigField("boolean", "ALLOW_SIMULATION", "true")
            buildConfigField("String", "ENVIRONMENT", "\"staging\"")
        }
        debug {
            buildConfigField("boolean", "ALLOW_SIMULATION", "true")
            buildConfigField("String", "ENVIRONMENT", "\"debug\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    // AndroidX & Core
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.activity:activity-compose:1.9.1")

    // Jetpack Compose
    implementation(platform("androidx.compose:compose-bom:2024.06.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    // Google Navigation SDK for Android (requires 7.6.0+ for modern setApiKey and CustomRoutesOptions)
    implementation("com.google.android.libraries.navigation:navigation:7.6.0")

    // Google Play Services Location
    implementation("com.google.android.gms:play-services-location:21.3.0")

    // Android Auto / Android for Cars App Library
    implementation("androidx.car.app:app:1.4.0")
    implementation("androidx.car.app:app-projected:1.4.0")

    // Networking & Serialization
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("com.google.code.gson:gson:2.11.0")

    // Testing
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}
