package com.navimate.ai.auto

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ActionStrip
import androidx.car.app.model.CarColor
import androidx.car.app.model.CarIcon
import androidx.car.app.model.DateTimeWithZone
import androidx.car.app.model.Distance
import androidx.car.app.model.Template
import androidx.car.app.navigation.model.Destination
import androidx.car.app.navigation.model.Lane
import androidx.car.app.navigation.model.LaneDirection
import androidx.car.app.navigation.model.Maneuver
import androidx.car.app.navigation.model.NavigationTemplate
import androidx.car.app.navigation.model.RoutingInfo
import androidx.car.app.navigation.model.Step
import androidx.car.app.navigation.model.TravelEstimate
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.navimate.ai.model.ManeuverType
import com.navimate.ai.model.NavigationState
import com.navimate.ai.model.NavigationStatus
import com.navimate.ai.navigation.NavigationCoreEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.util.TimeZone
import java.util.concurrent.TimeUnit

/**
 * Android Auto Turn-by-Turn Driving Screen
 * Provides clean, distraction-free vehicle display:
 * - Next maneuver instruction and icon
 * - Distance to next turn
 * - ETA and remaining distance
 * - Approved driver controls (Stop route / Recalculate)
 * - Zero long AI chat transcripts or unapproved forms
 */
class NaviMateAutoNavigationScreen(carContext: CarContext) : Screen(carContext) {

    private val navEngine = NavigationCoreEngine.getInstance(carContext)
    private val scope = CoroutineScope(Dispatchers.Main)
    private var stateJob: Job? = null
    private var currentState: NavigationState = navEngine.navigationState.value

    init {
        lifecycle.addObserver(LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_START -> {
                    stateJob = scope.launch {
                        navEngine.navigationState.collect { state ->
                            currentState = state
                            invalidate()
                        }
                    }
                }
                Lifecycle.Event.ON_STOP -> {
                    stateJob?.cancel()
                }
                else -> {}
            }
        })
    }

    override fun onGetTemplate(): Template {
        val actionStrip = ActionStrip.Builder()
            .addAction(
                Action.Builder()
                    .setTitle("Stop")
                    .setOnClickListener {
                        navEngine.stopNavigation()
                    }
                    .build()
            )
            .build()

        val builder = NavigationTemplate.Builder()
            .setActionStrip(actionStrip)

        val activeStep = currentState.currentStep
        val remainingDist = currentState.remainingDistanceMeters ?: 0L
        val remainingSec = currentState.remainingDurationSeconds ?: 0L

        if (currentState.status == NavigationStatus.NAVIGATING && activeStep != null) {
            // Build maneuver step for car display
            val autoManeuverType = mapToAutoManeuver(activeStep.maneuver)
            val maneuver = Maneuver.Builder(autoManeuverType).build()

            val step = Step.Builder(activeStep.instruction)
                .setManeuver(maneuver)
                .build()

            val distance = Distance.create(
                activeStep.distanceToStepMeters.toDouble(),
                Distance.UNIT_METERS
            )

            val routingInfo = RoutingInfo.Builder()
                .setCurrentStep(step, distance)
                .build()

            val remainingDistanceObj = Distance.create(
                (remainingDist / 1000.0),
                Distance.UNIT_KILOMETERS
            )

            val etaMillis = System.currentTimeMillis() + (remainingSec * 1000)
            val etaDateTime = DateTimeWithZone.create(
                etaMillis,
                TimeZone.getDefault()
            )

            val travelEstimate = TravelEstimate.Builder(remainingDistanceObj, etaDateTime)
                .setRemainingTimeSeconds(remainingSec)
                .build()

            val destination = Destination.Builder()
                .setName("Active Route")
                .build()

            builder.setNavigationInfo(routingInfo)
                .setDestinationTravelEstimate(travelEstimate)
        }

        return builder.build()
    }

    private fun mapToAutoManeuver(type: ManeuverType): Int {
        return when (type) {
            ManeuverType.TURN_LEFT -> Maneuver.TYPE_TURN_NORMAL_LEFT
            ManeuverType.TURN_RIGHT -> Maneuver.TYPE_TURN_NORMAL_RIGHT
            ManeuverType.TURN_SLIGHT_LEFT -> Maneuver.TYPE_TURN_SLIGHT_LEFT
            ManeuverType.TURN_SLIGHT_RIGHT -> Maneuver.TYPE_TURN_SLIGHT_RIGHT
            ManeuverType.TURN_SHARP_LEFT -> Maneuver.TYPE_TURN_SHARP_LEFT
            ManeuverType.TURN_SHARP_RIGHT -> Maneuver.TYPE_TURN_SHARP_RIGHT
            ManeuverType.U_TURN_LEFT -> Maneuver.TYPE_U_TURN_LEFT
            ManeuverType.U_TURN_RIGHT -> Maneuver.TYPE_U_TURN_RIGHT
            ManeuverType.ROUNDABOUT_ENTER -> Maneuver.TYPE_ROUNDABOUT_ENTER_CW
            ManeuverType.ROUNDABOUT_EXIT -> Maneuver.TYPE_ROUNDABOUT_EXIT_CW
            ManeuverType.DESTINATION -> Maneuver.TYPE_DESTINATION
            else -> Maneuver.TYPE_STRAIGHT
        }
    }
}
