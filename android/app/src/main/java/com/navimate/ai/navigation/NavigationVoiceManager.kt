package com.navimate.ai.navigation

import android.content.Context
import android.speech.tts.TextToSpeech
import android.util.Log
import java.util.Locale

/**
 * Native Voice Navigation Manager
 * Handles safety-critical, concise spoken guidance:
 * - Turn announcements ("Turn left in 500 metres")
 * - Reroute announcements ("Recalculating")
 * - Arrival announcement ("You have arrived at your destination")
 * - Clear, safety-first speech with minimal driver distraction
 */
class NavigationVoiceManager private constructor(context: Context) {

    companion object {
        private const val TAG = "NavVoiceManager"

        @Volatile
        private var instance: NavigationVoiceManager? = null

        fun getInstance(context: Context): NavigationVoiceManager {
            return instance ?: synchronized(this) {
                instance ?: NavigationVoiceManager(context.applicationContext).also { instance = it }
            }
        }
    }

    private var tts: TextToSpeech? = null
    private var isInitialized = false
    private var lastSpokenInstruction: String? = null
    private var lastAnnouncementTime: Long = 0

    init {
        tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.let { engine ->
                    val result = engine.setLanguage(Locale.getDefault())
                    if (result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED) {
                        isInitialized = true
                    }
                }
            } else {
                Log.w(TAG, "TextToSpeech engine initialization failed")
            }
        }
    }

    fun speak(text: String, queueMode: Int = TextToSpeech.QUEUE_FLUSH) {
        if (!isInitialized || text.isBlank()) return
        tts?.speak(text, queueMode, null, "NaviMateVoice_${System.currentTimeMillis()}")
    }

    fun announceManeuver(instruction: String, distanceMeters: Long) {
        val now = System.currentTimeMillis()
        val formattedDist = formatDistanceForSpeech(distanceMeters)
        val phrase = when {
            distanceMeters <= 50 -> instruction
            else -> "In $formattedDist, $instruction"
        }

        // Avoid speaking repetitive instructions too quickly
        if (phrase == lastSpokenInstruction && (now - lastAnnouncementTime) < 10000) {
            return
        }

        lastSpokenInstruction = phrase
        lastAnnouncementTime = now
        speak(phrase)
    }

    fun speakReroute() {
        speak("Recalculating route.")
    }

    fun speakArrival() {
        speak("You have arrived at your destination.")
    }

    fun speakWarning(warning: String) {
        speak(warning)
    }

    private fun formatDistanceForSpeech(meters: Long): String {
        return when {
            meters >= 1000 -> {
                val km = (meters / 1000.0).let { Math.round(it * 10.0) / 10.0 }
                "$km kilometres"
            }
            meters >= 100 -> {
                val roundedHundreds = ((meters + 50) / 100) * 100
                "$roundedHundreds metres"
            }
            else -> "$meters metres"
        }
    }

    fun shutdown() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        isInitialized = false
    }
}
