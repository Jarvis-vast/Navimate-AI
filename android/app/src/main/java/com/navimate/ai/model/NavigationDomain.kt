package com.navimate.ai.model

enum class NavigationStatus {
    IDLE,
    ROUTE_PREVIEW,
    STARTING,
    NAVIGATING,
    REROUTING,
    ARRIVING,
    ARRIVED,
    GPS_LOST,
    NETWORK_LOST,
    ERROR
}

enum class NetworkNavigationState {
    ONLINE,
    DEGRADED_NETWORK,
    CACHED_NAVIGATION,
    OFFLINE
}

enum class ManeuverType {
    UNKNOWN,
    STRAIGHT,
    TURN_SLIGHT_LEFT,
    TURN_LEFT,
    TURN_SHARP_LEFT,
    TURN_SLIGHT_RIGHT,
    TURN_RIGHT,
    TURN_SHARP_RIGHT,
    U_TURN_LEFT,
    U_TURN_RIGHT,
    MERGE_LEFT,
    MERGE_RIGHT,
    ROUNDABOUT_ENTER,
    ROUNDABOUT_EXIT,
    FORK_LEFT,
    FORK_RIGHT,
    FERRY,
    DESTINATION
}

data class NavigationLocation(
    val latitude: Double,
    val longitude: Double,
    val bearing: Float?,
    val speedMetersPerSecond: Float?,
    val accuracyMeters: Float?,
    val timestampEpochMillis: Long,
    val isRoadSnapped: Boolean
)

data class NavigationStep(
    val instruction: String,
    val maneuver: ManeuverType,
    val distanceToStepMeters: Long,
    val durationSeconds: Long,
    val stepRoadName: String?,
    val exitNumber: String?,
    val lanes: List<LaneInfo> = emptyList()
)

data class LaneInfo(
    val laneIndex: Int,
    val isRecommended: Boolean,
    val directions: List<String>
)

data class FuelIntelligence(
    val estimatedRemainingRangeKm: Double,
    val tripRemainingDistanceKm: Double,
    val estimatedFuelRequiredLitres: Double,
    val estimatedTripFuelCost: Double,
    val isRefuelNeeded: Boolean,
    val warningMessage: String?,
    val isTelemetrySource: Boolean = false // Always false unless linked to genuine OBD-II/Vehicle CAN
)

data class SpeedState(
    val currentSpeedKmh: Double?,
    val postedSpeedLimitKmh: Double?, // NULL if speed limit provider is unavailable
    val isOverspeed: Boolean,
    val isSpeedLimitAvailable: Boolean
)

data class NavigationState(
    val status: NavigationStatus,
    val currentLocation: NavigationLocation?,
    val currentStep: NavigationStep?,
    val remainingDistanceMeters: Long?,
    val remainingDurationSeconds: Long?,
    val etaEpochMillis: Long?,
    val speedMetersPerSecond: Double?,
    val routeId: String?,
    val isRerouting: Boolean,
    val isSimulation: Boolean,
    val speedState: SpeedState? = null,
    val fuelIntelligence: FuelIntelligence? = null,
    val networkState: NetworkNavigationState = NetworkNavigationState.ONLINE
)

data class NavigationSession(
    val sessionId: String,
    val routeId: String?,
    val destination: String,
    val waypoints: List<String> = emptyList(),
    val navigationState: NavigationStatus,
    val vehicleId: String,
    val fuelState: Map<String, Any>,
    val selectedPreferences: Map<String, Any>,
    val startedAt: Long,
    val updatedAt: Long
)

enum class NavigationErrorCode {
    NAV_SDK_INIT_FAILED,
    ROUTE_TOKEN_INVALID,
    ROUTE_TOKEN_UNAVAILABLE,
    ROUTE_TOKEN_DESTINATION_MISMATCH,
    ROUTE_PROVIDER_UNAVAILABLE,
    ROUTE_COMPUTE_FAILED,
    GPS_PERMISSION_DENIED,
    GPS_UNAVAILABLE,
    NETWORK_UNAVAILABLE,
    VOICE_UNAVAILABLE,
    GEMINI_UNAVAILABLE,
    PLACES_UNAVAILABLE,
    HOTEL_PROVIDER_UNAVAILABLE,
    TRAFFIC_UNAVAILABLE
}

data class NavigationDomainError(
    val code: NavigationErrorCode,
    val technicalMessage: String,
    val driverReadableMessage: String
) {
    companion object {
        fun map(code: NavigationErrorCode, technicalMessage: String = ""): NavigationDomainError {
            val userMsg = when (code) {
                NavigationErrorCode.NAV_SDK_INIT_FAILED ->
                    "Unable to start Google Navigation. Please check your network connection and try again."
                NavigationErrorCode.ROUTE_TOKEN_INVALID ->
                    "Route session expired or invalid. Recalculating fresh route to your destination."
                NavigationErrorCode.ROUTE_TOKEN_UNAVAILABLE ->
                    "Navigation token unavailable. Calculating alternative driving route."
                NavigationErrorCode.ROUTE_TOKEN_DESTINATION_MISMATCH ->
                    "Route target mismatch detected. Re-aligning destination with route provider."
                NavigationErrorCode.ROUTE_PROVIDER_UNAVAILABLE ->
                    "Navigation routing service is currently unavailable. Check your connection."
                NavigationErrorCode.ROUTE_COMPUTE_FAILED ->
                    "Could not calculate driving route. Verify destination and network status."
                NavigationErrorCode.GPS_PERMISSION_DENIED ->
                    "Location permission is required for live road navigation."
                NavigationErrorCode.GPS_UNAVAILABLE ->
                    "GPS signal lost. Searching for satellites..."
                NavigationErrorCode.NETWORK_UNAVAILABLE ->
                    "Network offline. Continuing with on-device cached navigation."
                NavigationErrorCode.VOICE_UNAVAILABLE ->
                    "Voice copilot currently unavailable. Driving audio guidance will continue via on-device alerts."
                NavigationErrorCode.GEMINI_UNAVAILABLE ->
                    "Voice assistant service busy. Core driving directions remain fully active."
                NavigationErrorCode.PLACES_UNAVAILABLE ->
                    "Live nearby places search currently unavailable."
                NavigationErrorCode.HOTEL_PROVIDER_UNAVAILABLE ->
                    "Live hotel booking provider unavailable."
                NavigationErrorCode.TRAFFIC_UNAVAILABLE ->
                    "Live traffic data unavailable. Displaying standard corridor travel times."
            }
            return NavigationDomainError(code, technicalMessage, userMsg)
        }
    }
}

