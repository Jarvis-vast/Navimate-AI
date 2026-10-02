package com.navimate.ai.auto

import android.content.Intent
import androidx.car.app.CarAppService
import androidx.car.app.R
import androidx.car.app.Screen
import androidx.car.app.Session
import androidx.car.app.validation.HostValidator

/**
 * Android Auto CarAppService for NaviMate AI
 * Complies with Android for Cars App Library and Android Auto guidelines:
 * - Driver safety first
 * - Navigation category declaration
 * - No arbitrary chatbot transcripts or long textual explanations
 * - Dedicated navigation template session
 */
class NaviMateCarAppService : CarAppService() {

    override fun createHostValidator(): HostValidator {
        return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR
    }

    override fun onCreateSession(): Session {
        return NaviMateCarSession()
    }
}

class NaviMateCarSession : Session() {
    override fun onCreateScreen(intent: Intent): Screen {
        return NaviMateAutoNavigationScreen(carContext)
    }
}
