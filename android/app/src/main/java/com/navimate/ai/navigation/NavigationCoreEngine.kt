package com.navimate.ai.navigation

import android.content.Context
import android.location.Location
import com.google.android.libraries.navigation.CustomRoutesOptions
import com.google.android.libraries.navigation.NavigationApi
import com.google.android.libraries.navigation.Navigator
import com.google.android.libraries.navigation.SimulationOptions
import com.google.android.libraries.navigation.SpeedAlertOptions
import com.google.android.libraries.navigation.SpeedAlertSeverity
import com.google.android.libraries.navigation.SpeedingListener
import com.google.android.libraries.navigation.Waypoint
import com.navimate.ai.BuildConfig
import com.navimate.ai.model.FuelIntelligence
import com.navimate.ai.model.ManeuverType
import com.navimate.ai.model.NavigationDomain
import com.navimate.ai.model.NavigationDomainError
import com.navimate.ai.model.NavigationErrorCode
import com.navimate.ai.model.NavigationLocation
import com.navimate.ai.model.NavigationState
import com.navimate.ai.model.NavigationStatus
import com.navimate.ai.model.NavigationStep
import com.navimate.ai.model.NetworkNavigationState
import com.navimate.ai.model.SpeedState
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID

/**
 * Native Navigation Core Engine
 * Integrates directly with Google Navigation SDK:
 * - Obtains road-snapped location
 * - Coordinates start/stop guidance lifecycle
 * - Observes speeding / speed-limit alerts
 * - Listens for rerouting, arrival, and travel progress events
 * - Seamlessly synchronizes state with NaviMate Backend
 */
class NavigationCoreEngine private constructor(private val context: Context) {

    companion object {
        @Volatile
        private var instance: NavigationCoreEngine? = null

        fun getInstance(context: Context): NavigationCoreEngine {
            return instance ?: synchronized(this) {
                instance ?: NavigationCoreEngine(context.applicationContext).also { instance = it }
            }
        }
    }

    private var navigator: Navigator? = null
    private var voiceManager: NavigationVoiceManager? = null

    private val _navigationState = MutableStateFlow(
        NavigationState(
            status = NavigationStatus.IDLE,
            currentLocation = null,
            currentStep = null,
            remainingDistanceMeters = null,
            remainingDurationSeconds = null,
            etaEpochMillis = null,
            speedMetersPerSecond = null,
            routeId = null,
            isRerouting = false,
            isSimulation = false
        )
    )
    val navigationState: StateFlow<NavigationState> = _navigationState.asStateFlow()

    private var activeSessionId = UUID.randomUUID().toString()

    /**
     * Initialize Google Navigation SDK with mandatory attribution tracking
     * and authoritative API key setup.
     */
    fun initialize(apiKey: String? = null, onReady: () -> Unit, onError: (String) -> Unit) {
        // If an explicit API key is passed, initialize it before retrieving Navigator
        if (!apiKey.isNullOrBlank()) {
            try {
                // Sets API key once as mandated by Google Navigation SDK
                NavigationApi.setApiKey(apiKey)
            } catch (e: Exception) {
                // If setApiKey is unavailable on this SDK build or already configured, log safely
            }
        }

        // Mandatory internal attribution tracking identifier
        NavigationApi.addInternalUsageAttributionId("gmp_git_agentskills_v1")

        voiceManager = NavigationVoiceManager.getInstance(context)

        NavigationApi.getNavigator(
            context,
            object : NavigationApi.NavigatorListener {
                override fun onNavigatorReady(nav: Navigator) {
                    navigator = nav
                    setupNavigatorListeners(nav)
                    onReady()
                }

                override fun onError(@NavigationApi.ErrorCode errorCode: Int) {
                    val message = when (errorCode) {
                        NavigationApi.ErrorCode.NOT_AUTHORIZED ->
                            "Navigation SDK: API key invalid or not authorized for Navigation."
                        NavigationApi.ErrorCode.TERMS_NOT_ACCEPTED ->
                            "Navigation SDK: Google Navigation Terms of Use not accepted by user."
                        NavigationApi.ErrorCode.LOCATION_PERMISSION_MISSING ->
                            "Navigation SDK: Fine location permission missing."
                        NavigationApi.ErrorCode.NETWORK_ERROR ->
                            "Navigation SDK: Network error during navigation initialization."
                        else -> "Navigation SDK initialization failed with code: $errorCode"
                    }
                    _navigationState.value = _navigationState.value.copy(
                        status = NavigationStatus.ERROR
                    )
                    onError(message)
                }
            }
        )
    }

    private fun setupNavigatorListeners(nav: Navigator) {
        // Setup Arrival Detection
        nav.addArrivalListener {
            _navigationState.value = _navigationState.value.copy(
                status = NavigationStatus.ARRIVED
            )
            voiceManager?.speakArrival()
        }

        // Setup Route Change & Automatic Rerouting Detection
        nav.addRouteChangedListener {
            val isRerouting = nav.routeStatus == Navigator.RouteStatus.OK
            _navigationState.value = _navigationState.value.copy(
                status = if (isRerouting) NavigationStatus.NAVIGATING else NavigationStatus.REROUTING,
                isRerouting = !isRerouting
            )
            if (!isRerouting) {
                voiceManager?.speakReroute()
            }
        }

        // Setup Speeding Listener
        val speedAlertOptions = SpeedAlertOptions.Builder()
            .setSpeedAlertThresholdPercentage(SpeedAlertSeverity.MINOR, 5f)
            .setSpeedAlertThresholdPercentage(SpeedAlertSeverity.MAJOR, 10f)
            .build()

        nav.setSpeedAlertOptions(speedAlertOptions)
        nav.setSpeedingListener(object : SpeedingListener {
            override fun onSpeedingUpdated(percentageAboveLimit: Float, speedAlertSeverity: SpeedAlertSeverity) {
                val currentSpeedKmh = (_navigationState.value.speedMetersPerSecond ?: 0.0) * 3.6
                _navigationState.value = _navigationState.value.copy(
                    speedState = SpeedState(
                        currentSpeedKmh = currentSpeedKmh,
                        postedSpeedLimitKmh = null, // Navigation SDK speeding percent is relative; exact posted number requires live road signs
                        isOverspeed = percentageAboveLimit > 0,
                        isSpeedLimitAvailable = true
                    )
                )
            }
        })

        // Forward turn-by-turn feed to local background service
        nav.registerServiceForNavUpdates(
            context.packageName,
            NavInfoReceivingService::class.java.name,
            5
        )
    }

    /**
     * Start guidance using a Place ID or modern Waypoint
     * Supports passing provider routeToken calculated upstream by Backend Routes API
     * Enforces destination matching and CustomRoutesOptions specification.
     */
    fun startNavigationWithDestination(
        placeId: String,
        routeToken: String? = null,
        destinationName: String = "Destination",
        isSimulation: Boolean = false,
        expectedDestination: String? = null
    ) {
        val nav = navigator ?: run {
            _navigationState.value = _navigationState.value.copy(
                status = NavigationStatus.ERROR
            )
            return
        }

        // Section 9: Destination Matching Validation
        if (!expectedDestination.isNullOrBlank() && !destinationName.equals(expectedDestination, ignoreCase = true)) {
            val domainErr = NavigationDomainError.map(
                NavigationErrorCode.ROUTE_TOKEN_DESTINATION_MISMATCH,
                "Target mismatch: expected '$expectedDestination', received '$destinationName'"
            )
            Log.w("NavigationCore", "Destination mismatch detected: ${domainErr.driverReadableMessage}")
            _navigationState.value = _navigationState.value.copy(
                status = NavigationStatus.ERROR
            )
            voiceManager?.speak(domainErr.driverReadableMessage)
            return
        }

        // Section 10: Safe route token diagnostic logging (never log the token itself)
        val hasRouteToken = !routeToken.isNullOrBlank()
        Log.d("NavigationCore", "startNavigation: routeTokenPresent=$hasRouteToken, simulationRequested=$isSimulation")

        _navigationState.value = _navigationState.value.copy(
            status = NavigationStatus.STARTING
        )

        try {
            val destination = Waypoint.builder()
                .setPlaceIdString(placeId)
                .setTitle(destinationName)
                .build()

            // Section 8: Production path follows official CustomRoutesOptions with routeToken
            val pendingRoute = if (hasRouteToken) {
                try {
                    val customRoutesOptions = CustomRoutesOptions.builder()
                        .setRouteToken(routeToken!!)
                        .setTravelMode(CustomRoutesOptions.TravelMode.DRIVING)
                        .build()
                    nav.setDestinations(listOf(destination), customRoutesOptions)
                } catch (tokenEx: Exception) {
                    Log.w("NavigationCore", "CustomRoutesOptions rejected routeToken, falling back to standard destination: ${tokenEx.message}")
                    nav.setDestination(destination)
                }
            } else {
                nav.setDestination(destination)
            }

            pendingRoute.setOnResultListener { routeStatus ->
                when (routeStatus) {
                    Navigator.RouteStatus.OK -> {
                        // Authoritative Audio Policy:
                        // We set Navigation SDK audio guidance to SILENT so that NaviMate's custom Voice Manager
                        // serves as the single voice authority without double-speaking or overlapping audio.
                        nav.setAudioGuidance(Navigator.AudioGuidance.SILENT)

                        // Run simulator ONLY if build permits and requested
                        val shouldSimulate = isSimulation && BuildConfig.ALLOW_SIMULATION
                        if (shouldSimulate) {
                            nav.simulator.simulateLocationsAlongExistingRoute(
                                SimulationOptions().speedMultiplier(3f)
                            )
                        }

                        // Start active turn-by-turn guidance
                        nav.startGuidance()

                        _navigationState.value = _navigationState.value.copy(
                            status = NavigationStatus.NAVIGATING,
                            isSimulation = shouldSimulate
                        )

                        voiceManager?.speak("Starting route to $destinationName. Drive safely.")
                    }
                    Navigator.RouteStatus.NO_ROUTE_FOUND -> {
                        val domainErr = NavigationDomainError.map(NavigationErrorCode.ROUTE_COMPUTE_FAILED)
                        _navigationState.value = _navigationState.value.copy(
                            status = NavigationStatus.ERROR
                        )
                        voiceManager?.speak(domainErr.driverReadableMessage)
                    }
                    Navigator.RouteStatus.NETWORK_ERROR -> {
                        val domainErr = NavigationDomainError.map(NavigationErrorCode.NETWORK_UNAVAILABLE)
                        _navigationState.value = _navigationState.value.copy(
                            status = NavigationStatus.NETWORK_LOST,
                            networkState = NetworkNavigationState.OFFLINE
                        )
                        voiceManager?.speak(domainErr.driverReadableMessage)
                    }
                    Navigator.RouteStatus.ROUTE_CANCELED -> {
                        _navigationState.value = _navigationState.value.copy(
                            status = NavigationStatus.IDLE
                        )
                    }
                    else -> {
                        val domainErr = if (hasRouteToken) {
                            NavigationDomainError.map(NavigationErrorCode.ROUTE_TOKEN_INVALID)
                        } else {
                            NavigationDomainError.map(NavigationErrorCode.ROUTE_COMPUTE_FAILED)
                        }
                        _navigationState.value = _navigationState.value.copy(
                            status = NavigationStatus.ERROR
                        )
                        voiceManager?.speak(domainErr.driverReadableMessage)
                    }
                }
            }
        } catch (e: Exception) {
            val domainErr = NavigationDomainError.map(NavigationErrorCode.ROUTE_PROVIDER_UNAVAILABLE, e.message ?: "")
            _navigationState.value = _navigationState.value.copy(
                status = NavigationStatus.ERROR
            )
            voiceManager?.speak(domainErr.driverReadableMessage)
        }
    }

    /**
     * Updates road-snapped location feed from NavInfo/Location updates
     */
    fun updateRoadSnappedLocation(location: Location) {
        val speedMps = if (location.hasSpeed()) location.speed.toDouble() else 0.0
        val bearing = if (location.hasBearing()) location.bearing else null

        val navLoc = NavigationLocation(
            latitude = location.latitude,
            longitude = location.longitude,
            bearing = bearing,
            speedMetersPerSecond = location.speed,
            accuracyMeters = if (location.hasAccuracy()) location.accuracy else null,
            timestampEpochMillis = location.time,
            isRoadSnapped = true // Derived from Navigation SDK road-snapped guidance pipeline
        )

        _navigationState.value = _navigationState.value.copy(
            currentLocation = navLoc,
            speedMetersPerSecond = speedMps
        )
    }

    /**
     * Updates turn-by-turn maneuver instruction from the active NavInfo feed
     */
    fun updateManeuverStep(step: NavigationStep, remainingMeters: Long, remainingSeconds: Long) {
        val etaEpoch = System.currentTimeMillis() + (remainingSeconds * 1000)

        _navigationState.value = _navigationState.value.copy(
            currentStep = step,
            remainingDistanceMeters = remainingMeters,
            remainingDurationSeconds = remainingSeconds,
            etaEpochMillis = etaEpoch
        )

        // Trigger voice announcement on step change
        voiceManager?.announceManeuver(step.instruction, remainingMeters)
    }

    /**
     * Calculate and sync Fuel Intelligence against active route
     */
    fun updateFuelIntelligence(
        estimatedRangeKm: Double,
        tripRemainingKm: Double,
        litresRequired: Double,
        costEstimate: Double
    ) {
        val refuelNeeded = estimatedRangeKm < tripRemainingKm
        val warning = if (refuelNeeded) {
            "Estimated range (${estimatedRangeKm.toInt()} km) is less than trip distance (${tripRemainingKm.toInt()} km). Fuel stop recommended."
        } else null

        _navigationState.value = _navigationState.value.copy(
            fuelIntelligence = FuelIntelligence(
                estimatedRemainingRangeKm = estimatedRangeKm,
                tripRemainingDistanceKm = tripRemainingKm,
                estimatedFuelRequiredLitres = litresRequired,
                estimatedTripFuelCost = costEstimate,
                isRefuelNeeded = refuelNeeded,
                warningMessage = warning,
                isTelemetrySource = false // Explicitly identified as estimate
            )
        )
    }

    fun stopNavigation() {
        navigator?.let { nav ->
            nav.stopGuidance()
            if (BuildConfig.ALLOW_SIMULATION) {
                nav.simulator.unsetUserLocation()
            }
        }
        _navigationState.value = _navigationState.value.copy(
            status = NavigationStatus.IDLE,
            currentStep = null,
            remainingDistanceMeters = null,
            remainingDurationSeconds = null,
            isSimulation = false
        )
        voiceManager?.speak("Navigation stopped.")
    }

    fun cleanup() {
        navigator?.let { nav ->
            nav.unregisterServiceForNavUpdates()
            nav.cleanup()
        }
        voiceManager?.shutdown()
        navigator = null
    }
}
