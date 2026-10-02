package com.navimate.ai.api

import android.os.Build
import android.util.Log
import com.navimate.ai.model.NavigationState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * SharedPlatformRepository
 * Authoritative client coordination layer connecting the Android client
 * to the NaviMate AI platform control plane.
 */
class SharedPlatformRepository(
    private val apiService: NaviMateApiService,
    val deviceId: String = "dev_android_${Build.MODEL.replace(" ", "_").lowercase()}"
) {
    companion object {
        private const val TAG = "NaviMatePlatformRepo"
    }

    private var cachedVehicle: SharedVehicleDto? = null
    private var cachedSavedPlaces: List<SavedPlaceDto> = emptyList()

    /**
     * Register Android device with the backend control plane upon initialization.
     */
    suspend fun registerDevice(): Boolean = withContext(Dispatchers.IO) {
        try {
            val req = DeviceRegistrationRequest(
                deviceId = deviceId,
                platform = "ANDROID",
                name = "${Build.MANUFACTURER} ${Build.MODEL} (In-Car Navigation)",
                appVersion = "2.4.0",
                capabilities = listOf("NAVIGATION_SDK_7_6", "VOICE_ASSISTANT", "ROUTE_TOKEN", "CAR_APP"),
                batteryPercent = 85
            )
            val res = apiService.registerDevice(req)
            if (res.isSuccessful) {
                Log.i(TAG, "Android device $deviceId successfully registered to control plane.")
                return@withContext true
            }
        } catch (e: Exception) {
            Log.w(TAG, "Device registration failed: ${e.message}")
        }
        false
    }

    /**
     * Confirm device pairing using a short-lived 6-digit PIN code displayed on the Web dashboard.
     */
    suspend fun pairWithWeb(pairingCode: String): Result<DeviceDto> = withContext(Dispatchers.IO) {
        try {
            val req = DevicePairConfirmRequest(
                pairingCode = pairingCode.trim(),
                deviceId = deviceId,
                deviceName = "${Build.MANUFACTURER} ${Build.MODEL} (In-Car Unit)",
                appVersion = "2.4.0",
                platform = "ANDROID"
            )
            val res = apiService.confirmDevicePairing(req)
            if (res.isSuccessful && res.body()?.success == true) {
                val dev = res.body()?.device
                if (dev != null) {
                    return@withContext Result.success(dev)
                }
            }
            Result.failure(Exception(res.body()?.message ?: "Invalid or expired pairing code"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Retrieve shared vehicle profile synchronized across Web and Android.
     */
    suspend fun getVehicle(): SharedVehicleDto? = withContext(Dispatchers.IO) {
        try {
            val res = apiService.getSharedVehicle()
            if (res.isSuccessful && res.body()?.vehicle != null) {
                cachedVehicle = res.body()!!.vehicle
                return@withContext cachedVehicle
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to fetch vehicle profile: ${e.message}")
        }
        cachedVehicle
    }

    /**
     * Update vehicle profile from in-car telemetry.
     */
    suspend fun updateVehicleFuelLevel(currentFuelLevel: Double): Boolean = withContext(Dispatchers.IO) {
        val current = cachedVehicle ?: return@withContext false
        try {
            val updated = current.copy(
                currentFuelLevel = currentFuelLevel,
                updatedAt = System.currentTimeMillis().toString()
            )
            val res = apiService.updateSharedVehicle(updated)
            if (res.isSuccessful && res.body()?.vehicle != null) {
                cachedVehicle = res.body()!!.vehicle
                return@withContext true
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to update vehicle telemetry: ${e.message}")
        }
        false
    }

    /**
     * Fetch synchronized saved places (Home, Work, Family, Fuel Stations).
     */
    suspend fun getSavedPlaces(): List<SavedPlaceDto> = withContext(Dispatchers.IO) {
        try {
            val res = apiService.getSavedPlaces()
            if (res.isSuccessful && res.body()?.places != null) {
                cachedSavedPlaces = res.body()!!.places
                return@withContext cachedSavedPlaces
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to fetch saved places: ${e.message}")
        }
        cachedSavedPlaces
    }

    /**
     * Check for any active trip dispatched from the Web dashboard to this vehicle.
     */
    suspend fun checkDispatchedTrip(): TripDto? = withContext(Dispatchers.IO) {
        try {
            val res = apiService.getActiveTrip()
            if (res.isSuccessful && res.body()?.trip != null) {
                val trip = res.body()!!.trip
                if (trip?.dispatchedToDeviceId == null || trip.dispatchedToDeviceId == deviceId) {
                    return@withContext trip
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to check active dispatched trip: ${e.message}")
        }
        null
    }

    /**
     * Stream live navigation telemetry back to backend control plane for real-time Web mirroring.
     */
    suspend fun streamTelemetry(
        tripId: String?,
        sessionId: String,
        state: NavigationState
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val req = TelemetryPushRequest(
                tripId = tripId,
                sessionId = sessionId,
                deviceId = deviceId,
                status = state.status.name,
                currentSpeedKmh = state.speedState?.currentSpeedKmh ?: 0.0,
                postedSpeedLimitKmh = state.speedState?.postedSpeedLimitKmh,
                isOverspeed = state.speedState?.isOverspeed ?: false,
                remainingDistanceMeters = state.remainingDistanceMeters ?: 0L,
                remainingDurationSeconds = state.remainingDurationSeconds ?: 0L,
                etaFormatted = formatEta(state.remainingDurationSeconds),
                currentLocation = state.currentLocation?.let {
                    LatLngDto(it.latitude, it.longitude)
                },
                currentManeuver = state.currentStep?.let { step ->
                    mapOf(
                        "instruction" to step.instruction,
                        "maneuverType" to step.maneuver.name,
                        "distanceMeters" to step.distanceToStepMeters
                    )
                }
            )

            val res = apiService.postNavigationTelemetry(req)
            return@withContext res.isSuccessful
        } catch (e: Exception) {
            Log.w(TAG, "Failed to stream live telemetry: ${e.message}")
            false
        }
    }

    private fun formatEta(seconds: Long?): String {
        if (seconds == null || seconds <= 0) return "--:--"
        val minutes = seconds / 60
        return if (minutes >= 60) {
            "${minutes / 60}h ${minutes % 60}m"
        } else {
            "${minutes}m"
        }
    }
}
