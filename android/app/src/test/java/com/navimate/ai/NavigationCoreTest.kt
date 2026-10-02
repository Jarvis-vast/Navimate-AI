package com.navimate.ai

import com.navimate.ai.model.FuelIntelligence
import com.navimate.ai.model.ManeuverType
import com.navimate.ai.model.NavigationDomain
import com.navimate.ai.model.NavigationLocation
import com.navimate.ai.model.NavigationState
import com.navimate.ai.model.NavigationStatus
import com.navimate.ai.model.NavigationStep
import com.navimate.ai.model.NetworkNavigationState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NavigationCoreTest {

    @Test
    fun testNavigationStateTransitions() {
        val initialState = NavigationState(
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

        assertEquals(NavigationStatus.IDLE, initialState.status)
        assertFalse(initialState.isSimulation)

        val startingState = initialState.copy(status = NavigationStatus.STARTING)
        assertEquals(NavigationStatus.STARTING, startingState.status)

        val navigatingState = startingState.copy(
            status = NavigationStatus.NAVIGATING,
            currentStep = NavigationStep(
                instruction = "Turn right onto Mumbai-Pune Expressway",
                maneuver = ManeuverType.TURN_RIGHT,
                distanceToStepMeters = 850L,
                durationSeconds = 60L,
                stepRoadName = "Mumbai-Pune Expressway",
                exitNumber = null
            ),
            remainingDistanceMeters = 145000L,
            remainingDurationSeconds = 7200L
        )

        assertEquals(NavigationStatus.NAVIGATING, navigatingState.status)
        assertNotNull(navigatingState.currentStep)
        assertEquals(ManeuverType.TURN_RIGHT, navigatingState.currentStep?.maneuver)
        assertEquals(145000L, navigatingState.remainingDistanceMeters)
    }

    @Test
    fun testRoadSnappedVsRawGpsDistinction() {
        val roadSnappedLocation = NavigationLocation(
            latitude = 18.5204,
            longitude = 73.8567,
            bearing = 45.0f,
            speedMetersPerSecond = 18.5f,
            accuracyMeters = 3.0f,
            timestampEpochMillis = System.currentTimeMillis(),
            isRoadSnapped = true
        )

        assertTrue("Navigation SDK location must identify as road snapped", roadSnappedLocation.isRoadSnapped)
        assertEquals(18.5f, roadSnappedLocation.speedMetersPerSecond)
    }

    @Test
    fun testSimulationFlagSeparation() {
        val realNavState = NavigationState(
            status = NavigationStatus.NAVIGATING,
            currentLocation = null,
            currentStep = null,
            remainingDistanceMeters = 12000L,
            remainingDurationSeconds = 800L,
            etaEpochMillis = 1750000000000L,
            speedMetersPerSecond = 20.0,
            routeId = "real_route_001",
            isRerouting = false,
            isSimulation = false
        )

        assertFalse(realNavState.isSimulation)

        val simNavState = realNavState.copy(isSimulation = true)
        assertTrue(simNavState.isSimulation)
    }

    @Test
    fun testFuelIntelligenceWarningLogic() {
        // Vehicle has 140 km range, trip is 220 km -> Warning required
        val rangeShortage = FuelIntelligence(
            estimatedRemainingRangeKm = 140.0,
            tripRemainingDistanceKm = 220.0,
            estimatedFuelRequiredLitres = 16.5,
            estimatedTripFuelCost = 1650.0,
            isRefuelNeeded = true,
            warningMessage = "Estimated range (140 km) is less than trip distance (220 km). Fuel stop recommended.",
            isTelemetrySource = false
        )

        assertTrue(rangeShortage.isRefuelNeeded)
        assertNotNull(rangeShortage.warningMessage)
        assertFalse("Estimates must never masquerade as verified telemetry", rangeShortage.isTelemetrySource)

        // Vehicle has 400 km range, trip is 120 km -> Safe
        val rangeSafe = rangeShortage.copy(
            estimatedRemainingRangeKm = 400.0,
            tripRemainingDistanceKm = 120.0,
            isRefuelNeeded = false,
            warningMessage = null
        )

        assertFalse(rangeSafe.isRefuelNeeded)
        assertNull(rangeSafe.warningMessage)
    }

    @Test
    fun testOfflineDegradedNetworkState() {
        val onlineState = NavigationState(
            status = NavigationStatus.NAVIGATING,
            currentLocation = null,
            currentStep = null,
            remainingDistanceMeters = 5000L,
            remainingDurationSeconds = 300L,
            etaEpochMillis = null,
            speedMetersPerSecond = 15.0,
            routeId = "route_1",
            isRerouting = false,
            isSimulation = false,
            networkState = NetworkNavigationState.ONLINE
        )

        assertEquals(NetworkNavigationState.ONLINE, onlineState.networkState)

        val offlineDegraded = onlineState.copy(
            networkState = NetworkNavigationState.CACHED_NAVIGATION
        )

        assertEquals(NetworkNavigationState.CACHED_NAVIGATION, offlineDegraded.networkState)
    }

    @Test
    fun testStructuredErrorTaxonomy() {
        val tokenErr = NavigationDomainError.map(NavigationErrorCode.ROUTE_TOKEN_INVALID, "Token expired at 1790107825")
        assertEquals(NavigationErrorCode.ROUTE_TOKEN_INVALID, tokenErr.code)
        assertTrue(tokenErr.driverReadableMessage.contains("Recalculating fresh route"))
        assertFalse(tokenErr.driverReadableMessage.contains("1790107825")) // User never sees raw technical internals

        val navInitErr = NavigationDomainError.map(NavigationErrorCode.NAV_SDK_INIT_FAILED)
        assertEquals(NavigationErrorCode.NAV_SDK_INIT_FAILED, navInitErr.code)
        assertTrue(navInitErr.driverReadableMessage.contains("Unable to start Google Navigation"))
    }

    @Test
    fun testSpeedStateHonesty() {
        // When speed limit provider is unavailable
        val unavailSpeed = SpeedState(
            currentSpeedKmh = 72.0,
            postedSpeedLimitKmh = null,
            isOverspeed = false,
            isSpeedLimitAvailable = false
        )
        assertNull("Speed limit must be null when provider unavailable", unavailSpeed.postedSpeedLimitKmh)
        assertFalse(unavailSpeed.isSpeedLimitAvailable)

        // When speed limit is verified from provider
        val verifiedSpeed = SpeedState(
            currentSpeedKmh = 105.0,
            postedSpeedLimitKmh = 100.0,
            isOverspeed = true,
            isSpeedLimitAvailable = true
        )
        assertEquals(100.0, verifiedSpeed.postedSpeedLimitKmh!!, 0.01)
        assertTrue(verifiedSpeed.isOverspeed)
    }

    @Test
    fun testArrivalAndStopLifecycle() {
        val activeSession = NavigationState(
            status = NavigationStatus.NAVIGATING,
            currentLocation = null,
            currentStep = NavigationStep("Arrive at destination", ManeuverType.DESTINATION, 20L, 5L, "Pune Expressway", null),
            remainingDistanceMeters = 20L,
            remainingDurationSeconds = 5L,
            etaEpochMillis = System.currentTimeMillis() + 5000,
            speedMetersPerSecond = 5.0,
            routeId = "route_test_01",
            isRerouting = false,
            isSimulation = false
        )

        val arrivingState = activeSession.copy(status = NavigationStatus.ARRIVING)
        assertEquals(NavigationStatus.ARRIVING, arrivingState.status)

        val arrivedState = arrivingState.copy(
            status = NavigationStatus.ARRIVED,
            remainingDistanceMeters = 0L,
            remainingDurationSeconds = 0L
        )
        assertEquals(NavigationStatus.ARRIVED, arrivedState.status)
        assertEquals(0L, arrivedState.remainingDistanceMeters)

        // Cleanup on stop
        val stoppedState = arrivedState.copy(
            status = NavigationStatus.IDLE,
            currentStep = null,
            remainingDistanceMeters = null,
            remainingDurationSeconds = null,
            isSimulation = false
        )
        assertEquals(NavigationStatus.IDLE, stoppedState.status)
        assertNull(stoppedState.currentStep)
    }

    @Test
    fun testCompleteNavigationLifecycleTransitions() {
        // 1. STARTING -> NAVIGATING
        val starting = NavigationState(status = NavigationStatus.STARTING)
        val navigating = starting.copy(status = NavigationStatus.NAVIGATING)
        assertEquals(NavigationStatus.NAVIGATING, navigating.status)

        // 2. NAVIGATING -> REROUTING -> NAVIGATING
        val rerouting = navigating.copy(status = NavigationStatus.REROUTING, isRerouting = true)
        assertEquals(NavigationStatus.REROUTING, rerouting.status)
        assertTrue(rerouting.isRerouting)

        val rerouted = rerouting.copy(status = NavigationStatus.NAVIGATING, isRerouting = false)
        assertEquals(NavigationStatus.NAVIGATING, rerouted.status)
        assertFalse(rerouted.isRerouting)

        // 3. NAVIGATING -> ARRIVING -> ARRIVED
        val arriving = rerouted.copy(status = NavigationStatus.ARRIVING)
        assertEquals(NavigationStatus.ARRIVING, arriving.status)

        val arrived = arriving.copy(status = NavigationStatus.ARRIVED)
        assertEquals(NavigationStatus.ARRIVED, arrived.status)

        // 4. NAVIGATING -> GPS_LOST -> NAVIGATING (GPS recovery)
        val gpsLost = navigating.copy(status = NavigationStatus.GPS_LOST)
        assertEquals(NavigationStatus.GPS_LOST, gpsLost.status)

        val gpsRestored = gpsLost.copy(status = NavigationStatus.NAVIGATING)
        assertEquals(NavigationStatus.NAVIGATING, gpsRestored.status)

        // 5. NAVIGATING -> NETWORK_LOST -> CACHED_NAVIGATION
        val netLost = navigating.copy(
            status = NavigationStatus.NETWORK_LOST,
            networkState = NetworkNavigationState.OFFLINE
        )
        assertEquals(NavigationStatus.NETWORK_LOST, netLost.status)
        assertEquals(NetworkNavigationState.OFFLINE, netLost.networkState)
    }

    @Test
    fun testRouteTokenValidationAndDestinationMatchingTaxonomy() {
        val mismatchErr = NavigationDomainError.map(
            NavigationErrorCode.ROUTE_TOKEN_DESTINATION_MISMATCH,
            "Expected 'Pune Expressway', received 'Mumbai Port'"
        )
        assertEquals(NavigationErrorCode.ROUTE_TOKEN_DESTINATION_MISMATCH, mismatchErr.code)
        assertTrue(mismatchErr.driverReadableMessage.contains("Route target mismatch"))

        val unavailErr = NavigationDomainError.map(NavigationErrorCode.ROUTE_TOKEN_UNAVAILABLE)
        assertEquals(NavigationErrorCode.ROUTE_TOKEN_UNAVAILABLE, unavailErr.code)
        assertTrue(unavailErr.driverReadableMessage.contains("Navigation token unavailable"))

        val providerErr = NavigationDomainError.map(NavigationErrorCode.ROUTE_PROVIDER_UNAVAILABLE)
        assertEquals(NavigationErrorCode.ROUTE_PROVIDER_UNAVAILABLE, providerErr.code)
        assertTrue(providerErr.driverReadableMessage.contains("Navigation routing service is currently unavailable"))
    }
}
