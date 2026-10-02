package com.navimate.ai.speech

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.navimate.ai.api.ChatMessageRequest
import com.navimate.ai.api.NaviMateApiService
import com.navimate.ai.model.NavigationDomain
import com.navimate.ai.model.NavigationState
import com.navimate.ai.navigation.NavigationCoreEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.Locale

/**
 * Native Voice Command Controller
 * Architecture:
 * Speech Input -> Android SpeechRecognizer -> Backend /api/chat (Gemini AI Orchestrator) -> Action Execution -> Voice feedback
 */
class VoiceCommandController(
    private val context: Context,
    backendBaseUrl: String = "http://10.0.2.2:3000"
) {

    private var speechRecognizer: SpeechRecognizer? = null
    private val scope = CoroutineScope(Dispatchers.Main)
    private val navEngine = NavigationCoreEngine.getInstance(context)

    private val apiService: NaviMateApiService = Retrofit.Builder()
        .baseUrl(backendBaseUrl)
        .addConverterFactory(GsonConverterFactory.create())
        .build()
        .create(NaviMateApiService::class.java)

    private val _isListening = MutableStateFlow(false)
    val isListening: StateFlow<Boolean> = _isListening.asStateFlow()

    private val _lastTranscript = MutableStateFlow("")
    val lastTranscript: StateFlow<String> = _lastTranscript.asStateFlow()

    fun startListening(onCommandRecognized: (String) -> Unit, onError: (String) -> Unit) {
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            onError("Speech recognition not available on this device")
            return
        }

        speechRecognizer?.destroy()
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
            setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    _isListening.value = true
                }

                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {
                    _isListening.value = false
                }

                override fun onError(error: Int) {
                    _isListening.value = false
                    val errorMsg = when (error) {
                        SpeechRecognizer.ERROR_NO_MATCH -> "No speech recognized."
                        SpeechRecognizer.ERROR_NETWORK -> "Network error during speech recognition."
                        SpeechRecognizer.ERROR_AUDIO -> "Audio recording error."
                        else -> "Speech recognition error: $error"
                    }
                    onError(errorMsg)
                }

                override fun onResults(results: Bundle?) {
                    _isListening.value = false
                    val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    if (!matches.isNullOrEmpty()) {
                        val spokenText = matches[0]
                        _lastTranscript.value = spokenText
                        onCommandRecognized(spokenText)
                        dispatchCommandToGeminiBackend(spokenText)
                    }
                }

                override fun onPartialResults(partialResults: Bundle?) {}
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
        }

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }

        speechRecognizer?.startListening(intent)
    }

    /**
     * Sends structured driving context to Gemini Backend
     */
    private fun dispatchCommandToGeminiBackend(command: String) {
        val currentState = navEngine.navigationState.value

        val contextPayload = mapOf(
            "navigationStatus" to currentState.status.name,
            "remainingDistanceMeters" to (currentState.remainingDistanceMeters ?: 0L),
            "remainingDurationSeconds" to (currentState.remainingDurationSeconds ?: 0L),
            "nextManeuver" to (currentState.currentStep?.maneuver?.name ?: "NONE"),
            "fuelRangeKm" to (currentState.fuelIntelligence?.estimatedRemainingRangeKm ?: 250.0),
            "isSimulation" to currentState.isSimulation
        )

        scope.launch(Dispatchers.IO) {
            try {
                val response = apiService.postChatMessage(
                    ChatMessageRequest(
                        message = command,
                        context = contextPayload
                    )
                )

                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    handleToolCalls(body.toolCalls)
                }
            } catch (e: Exception) {
                // Log without failing navigation
            }
        }
    }

    private fun handleToolCalls(toolCalls: List<com.navimate.ai.api.ToolCallDto>) {
        for (tool in toolCalls) {
            when (tool.name) {
                "start_navigation" -> {
                    val destination = tool.params?.get("destination")?.toString() ?: "Pune"
                    navEngine.startNavigationWithDestination(
                        placeId = "ChIJR3_LUvy_wjsRskUXjg8vlqw",
                        destinationName = destination
                    )
                }
                "stop_navigation" -> {
                    navEngine.stopNavigation()
                }
                "reroute" -> {
                    // Triggers reroute event
                }
            }
        }
    }

    fun stopListening() {
        speechRecognizer?.stopListening()
        _isListening.value = false
    }

    fun destroy() {
        speechRecognizer?.destroy()
        speechRecognizer = null
    }
}
