package com.navimate.ai.navigation

import android.app.Service
import android.content.Intent
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.os.Message
import android.os.Messenger
import android.os.Process
import com.google.android.libraries.mapsplatform.turnbyturn.TurnByTurnManager
import com.google.android.libraries.mapsplatform.turnbyturn.model.NavInfo
import com.google.android.libraries.mapsplatform.turnbyturn.model.StepInfo
import com.navimate.ai.model.LaneInfo
import com.navimate.ai.model.ManeuverType
import com.navimate.ai.model.NavigationStep

/**
 * NavInfoReceivingService
 * Receives asynchronous Turn-by-Turn (TBT) guidance messages from Navigation SDK:
 * - Next maneuver step
 * - Distance to next turn
 * - Lane guidance
 * - Road names
 * Safely handles message processing off the main UI thread.
 */
class NavInfoReceivingService : Service() {

    private lateinit var incomingMessenger: Messenger
    private lateinit var handlerThread: HandlerThread

    companion object {
        val turnByTurnManager: TurnByTurnManager = TurnByTurnManager.createInstance()
    }

    override fun onCreate() {
        super.onCreate()
        handlerThread = HandlerThread("NavInfoServiceThread", Process.THREAD_PRIORITY_DEFAULT)
        handlerThread.start()
        incomingMessenger = Messenger(IncomingNavStepHandler(handlerThread.looper, this))
    }

    override fun onBind(intent: Intent?): IBinder? {
        return incomingMessenger.binder
    }

    override fun onUnbind(intent: Intent?): Boolean {
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        handlerThread.quitSafely()
        super.onDestroy()
    }

    private class IncomingNavStepHandler(
        looper: Looper,
        private val service: NavInfoReceivingService
    ) : Handler(looper) {
        override fun handleMessage(msg: Message) {
            if (TurnByTurnManager.MSG_NAV_INFO == msg.what) {
                val navInfo: NavInfo? = turnByTurnManager.readNavInfoFromBundle(msg.data)
                navInfo?.let { info ->
                    processNavInfo(info)
                }
            }
        }

        private fun processNavInfo(navInfo: NavInfo) {
            val stepInfo = navInfo.currentStep ?: return
            val stepInstruction = stepInfo.fullRoadName ?: "Continue on route"
            val distMeters = stepInfo.distanceToManeuverMeters
            val remainingMeters = navInfo.distanceToDestinationMeters
            val remainingSeconds = navInfo.timeToDestinationSeconds

            val step = NavigationStep(
                instruction = stepInstruction,
                maneuver = mapSdkManeuver(stepInfo.maneuver),
                distanceToStepMeters = distMeters,
                durationSeconds = stepInfo.timeToManeuverSeconds,
                stepRoadName = stepInfo.fullRoadName,
                exitNumber = stepInfo.exitNumber,
                lanes = emptyList()
            )

            NavigationCoreEngine.getInstance(service.applicationContext).updateManeuverStep(
                step = step,
                remainingMeters = remainingMeters,
                remainingSeconds = remainingSeconds
            )
        }

        private fun mapSdkManeuver(maneuverCode: Int): ManeuverType {
            return when (maneuverCode) {
                com.google.android.libraries.mapsplatform.turnbyturn.model.Maneuver.TURN_LEFT -> ManeuverType.TURN_LEFT
                com.google.android.libraries.mapsplatform.turnbyturn.model.Maneuver.TURN_RIGHT -> ManeuverType.TURN_RIGHT
                com.google.android.libraries.mapsplatform.turnbyturn.model.Maneuver.TURN_SLIGHT_LEFT -> ManeuverType.TURN_SLIGHT_LEFT
                com.google.android.libraries.mapsplatform.turnbyturn.model.Maneuver.TURN_SLIGHT_RIGHT -> ManeuverType.TURN_SLIGHT_RIGHT
                com.google.android.libraries.mapsplatform.turnbyturn.model.Maneuver.TURN_SHARP_LEFT -> ManeuverType.TURN_SHARP_LEFT
                com.google.android.libraries.mapsplatform.turnbyturn.model.Maneuver.TURN_SHARP_RIGHT -> ManeuverType.TURN_SHARP_RIGHT
                com.google.android.libraries.mapsplatform.turnbyturn.model.Maneuver.TURN_U_TURN_CLOCKWISE -> ManeuverType.U_TURN_RIGHT
                com.google.android.libraries.mapsplatform.turnbyturn.model.Maneuver.TURN_U_TURN_COUNTERCLOCKWISE -> ManeuverType.U_TURN_LEFT
                com.google.android.libraries.mapsplatform.turnbyturn.model.Maneuver.MERGE_LEFT -> ManeuverType.MERGE_LEFT
                com.google.android.libraries.mapsplatform.turnbyturn.model.Maneuver.MERGE_RIGHT -> ManeuverType.MERGE_RIGHT
                com.google.android.libraries.mapsplatform.turnbyturn.model.Maneuver.ROUNDABOUT_ENTER -> ManeuverType.ROUNDABOUT_ENTER
                com.google.android.libraries.mapsplatform.turnbyturn.model.Maneuver.ROUNDABOUT_EXIT -> ManeuverType.ROUNDABOUT_EXIT
                com.google.android.libraries.mapsplatform.turnbyturn.model.Maneuver.DESTINATION -> ManeuverType.DESTINATION
                else -> ManeuverType.STRAIGHT
            }
        }
    }
}
