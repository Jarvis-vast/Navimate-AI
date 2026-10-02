package com.navimate.ai

import android.app.Application
import android.content.pm.PackageManager
import android.util.Log
import com.google.android.libraries.navigation.NavigationApi

class NaviMateApplication : Application() {

    companion object {
        private var isApiKeyInitialized = false

        fun isApiKeyConfigured(): Boolean = isApiKeyInitialized
    }

    override fun onCreate() {
        super.onCreate()

        // 1. Mandatory internal usage attribution identifier (required for GMP integration tracking)
        try {
            NavigationApi.addInternalUsageAttributionId("gmp_git_agentskills_v1")
        } catch (e: Exception) {
            Log.w("NaviMateApp", "NavigationApi usage attribution setup warning: ${e.message}")
        }

        // 2. Authoritative API key setup - runs exactly once per Application lifecycle
        initializeNavigationApiKey()
    }

    private fun initializeNavigationApiKey() {
        if (isApiKeyInitialized) return

        var apiKey: String? = null
        try {
            val appInfo = packageManager.getApplicationInfo(packageName, PackageManager.GET_META_DATA)
            apiKey = appInfo.metaData?.getString("com.google.android.geo.API_KEY")
        } catch (e: Exception) {
            Log.e("NaviMateApp", "Could not retrieve API key from manifest: ${e.message}")
        }

        if (apiKey.isNullOrBlank() || apiKey.startsWith("YOUR_")) {
            Log.e(
                "NaviMateApp",
                "CRITICAL: Google Maps API key is missing or set to placeholder. " +
                "Configure MAPS_API_KEY in android/local.properties before running navigation."
            )
            return
        }

        try {
            // Navigation SDK 7.6+ requires setApiKey called once prior to any Navigator instantiation
            NavigationApi.setApiKey(apiKey)
            isApiKeyInitialized = true
            Log.i("NaviMateApp", "NavigationApi.setApiKey initialized successfully (Application.onCreate).")
        } catch (e: Exception) {
            Log.e("NaviMateApp", "Error calling NavigationApi.setApiKey: ${e.message}")
        }
    }
}
