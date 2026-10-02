package com.navimate.ai.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.navimate.ai.model.ManeuverType
import com.navimate.ai.model.NavigationState
import com.navimate.ai.model.NavigationStatus
import com.navimate.ai.navigation.NavigationCoreEngine
import com.navimate.ai.speech.VoiceCommandController
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : ComponentActivity() {

    private lateinit var navEngine: NavigationCoreEngine
    private lateinit var voiceController: VoiceCommandController

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val locationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
        if (locationGranted) {
            initNavigation()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        navEngine = NavigationCoreEngine.getInstance(this)
        voiceController = VoiceCommandController(this)

        checkAndRequestPermissions()

        setContent {
            NaviMateTheme {
                val state by navEngine.navigationState.collectAsState()
                val isListening by voiceController.isListening.collectAsState()
                val lastSpoken by voiceController.lastTranscript.collectAsState()

                NavigationDrivingScreen(
                    state = state,
                    isListening = isListening,
                    lastVoiceTranscript = lastSpoken,
                    onStartDrive = { isSim ->
                        navEngine.startNavigationWithDestination(
                            placeId = "ChIJR3_LUvy_wjsRskUXjg8vlqw",
                            destinationName = "Pune Express Corridor",
                            isSimulation = isSim
                        )
                    },
                    onStopDrive = {
                        navEngine.stopNavigation()
                    },
                    onMicClicked = {
                        if (isListening) {
                            voiceController.stopListening()
                        } else {
                            voiceController.startListening(
                                onCommandRecognized = {},
                                onError = {}
                            )
                        }
                    }
                )
            }
        }
    }

    private fun checkAndRequestPermissions() {
        val permissions = arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.RECORD_AUDIO
        )

        val needed = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (needed.isNotEmpty()) {
            permissionLauncher.launch(needed.toTypedArray())
        } else {
            initNavigation()
        }
    }

    private fun initNavigation() {
        navEngine.initialize(
            onReady = {},
            onError = {}
        )
    }

    override fun onDestroy() {
        voiceController.destroy()
        navEngine.cleanup()
        super.onDestroy()
    }
}

@Composable
fun NaviMateTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Color(0xFF22C55E),
            background = Color(0xFF0F172A),
            surface = Color(0xFF1E293B),
            onPrimary = Color.White,
            onSurface = Color(0xFFF8FAFC)
        ),
        content = content
    )
}

@Composable
fun NavigationDrivingScreen(
    state: NavigationState,
    isListening: Boolean,
    lastVoiceTranscript: String,
    onStartDrive: (isSim: Boolean) -> Unit,
    onStopDrive: () -> Unit,
    onMicClicked: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0F172A))
    ) {
        // Active Navigation HUD or Route Preview
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // TOP: Top Guidance Area & Simulation Alert
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (state.isSimulation) {
                    SimulationBanner()
                }

                if (state.status == NavigationStatus.NAVIGATING && state.currentStep != null) {
                    TopGuidanceBanner(state = state)
                } else {
                    PreviewTopHeader()
                }
            }

            // MIDDLE: Interactive Map Canvas Container placeholder / Live guidance info
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(vertical = 12.dp)
                    .background(Color(0xFF1E293B), RoundedCornerShape(16.dp)),
                contentAlignment = Alignment.Center
            ) {
                if (state.status == NavigationStatus.NAVIGATING) {
                    ActiveNavigationMapPlaceholder(state)
                } else {
                    PreviewRouteInformation()
                }
            }

            // BOTTOM: Navigation Card & Approved Controls
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (state.status == NavigationStatus.NAVIGATING) {
                    BottomNavigationCard(state = state, onStop = onStopDrive)
                } else {
                    PreviewActionControls(onStart = onStartDrive)
                }

                // Voice floating status & mic control
                VoiceControlStrip(
                    isListening = isListening,
                    transcript = lastVoiceTranscript,
                    onMicClicked = onMicClicked
                )
            }
        }
    }
}

@Composable
fun SimulationBanner() {
    Surface(
        color = Color(0xFFDC2626),
        shape = RoundedCornerShape(8.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Icon(Icons.Default.Warning, contentDescription = "Simulation", tint = Color.White)
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "⚠ SIMULATION MODE (NOT REAL DRIVING)",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp
            )
        }
    }
}

@Composable
fun TopGuidanceBanner(state: NavigationState) {
    val step = state.currentStep ?: return
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = when (step.maneuver) {
                    ManeuverType.TURN_LEFT, ManeuverType.TURN_SHARP_LEFT, ManeuverType.TURN_SLIGHT_LEFT -> Icons.Default.TurnLeft
                    ManeuverType.TURN_RIGHT, ManeuverType.TURN_SHARP_RIGHT, ManeuverType.TURN_SLIGHT_RIGHT -> Icons.Default.TurnRight
                    ManeuverType.DESTINATION -> Icons.Default.Place
                    else -> Icons.Default.Straight
                },
                contentDescription = "Maneuver",
                tint = Color(0xFF22C55E),
                modifier = Modifier.size(48.dp)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "${step.distanceToStepMeters} m",
                    color = Color.White,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = step.instruction,
                    color = Color(0xFFCBD5E1),
                    fontSize = 16.sp
                )
            }
        }
    }
}

@Composable
fun PreviewTopHeader() {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Route Preview: Pune Corridor",
                color = Color.White,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Distance: 148 km • ETA: 2h 45m • Tolls: ₹150",
                color = Color(0xFF94A3B8),
                fontSize = 14.sp
            )
        }
    }
}

@Composable
fun ActiveNavigationMapPlaceholder(state: NavigationState) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(Icons.Default.Navigation, contentDescription = null, tint = Color(0xFF22C55E), modifier = Modifier.size(48.dp))
        Spacer(modifier = Modifier.height(8.dp))
        Text("Navigation SDK Road-Snapped Session Active", color = Color.White, fontWeight = FontWeight.SemiBold)
        state.currentLocation?.let {
            Text(
                text = "Snapped GPS: ${"%.4f".format(it.latitude)}, ${"%.4f".format(it.longitude)}",
                color = Color(0xFF94A3B8),
                fontSize = 12.sp
            )
        }
    }
}

@Composable
fun PreviewRouteInformation() {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier.padding(16.dp)
    ) {
        Icon(Icons.Default.Map, contentDescription = null, tint = Color(0xFF38BDF8), modifier = Modifier.size(56.dp))
        Spacer(modifier = Modifier.height(12.dp))
        Text("Google Navigation SDK Native Engine", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        Spacer(modifier = Modifier.height(4.dp))
        Text("Ready to start native road-snapped turn-by-turn guidance", color = Color(0xFF94A3B8), fontSize = 13.sp)
    }
}

@Composable
fun BottomNavigationCard(state: NavigationState, onStop: () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    val remainingKm = ((state.remainingDistanceMeters ?: 0L) / 1000.0)
                    Text(
                        text = "${"%.1f".format(remainingKm)} km remaining",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    val etaFormatted = SimpleDateFormat("h:mm a", Locale.getDefault()).format(
                        Date(state.etaEpochMillis ?: System.currentTimeMillis())
                    )
                    Text(
                        text = "Estimated Arrival: $etaFormatted",
                        color = Color(0xFF22C55E),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium
                    )
                }

                Button(
                    onClick = onStop,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626))
                ) {
                    Icon(Icons.Default.Close, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Exit")
                }
            }

            // Speed Limit & Fuel Estimates Notice
            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider(color = Color(0xFF334155))
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = state.speedState?.postedSpeedLimitKmh?.let { "Speed Limit: $it km/h" }
                        ?: "Speed limit unavailable",
                    color = Color(0xFF94A3B8),
                    fontSize = 12.sp
                )
                Text(
                    text = "Fuel range: ~210 km (estimate)",
                    color = Color(0xFF94A3B8),
                    fontSize = 12.sp
                )
            }
        }
    }
}

@Composable
fun PreviewActionControls(onStart: (isSim: Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Button(
            onClick = { onStart(false) },
            modifier = Modifier.weight(1f).height(52.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF22C55E)),
            shape = RoundedCornerShape(12.dp)
        ) {
            Icon(Icons.Default.Navigation, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("START NAVIGATION", fontWeight = FontWeight.Bold)
        }

        OutlinedButton(
            onClick = { onStart(true) },
            modifier = Modifier.height(52.dp),
            shape = RoundedCornerShape(12.dp)
        ) {
            Icon(Icons.Default.PlayArrow, contentDescription = null)
            Spacer(modifier = Modifier.width(4.dp))
            Text("SIMULATE")
        }
    }
}

@Composable
fun VoiceControlStrip(
    isListening: Boolean,
    transcript: String,
    onMicClicked: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = if (isListening) Color(0xFF1E3A8A) else Color(0xFF1E293B)
        ),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = onMicClicked,
                colors = IconButtonDefaults.iconButtonColors(
                    containerColor = if (isListening) Color(0xFF3B82F6) else Color(0xFF334155)
                )
            ) {
                Icon(
                    imageVector = if (isListening) Icons.Default.Mic else Icons.Default.MicNone,
                    contentDescription = "Voice Copilot",
                    tint = Color.White
                )
            }
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = if (isListening) "Listening... say 'Find petrol pump' or 'Reroute'"
                else if (transcript.isNotEmpty()) "\"$transcript\""
                else "Tap mic for Gemini voice commands",
                color = Color.White,
                fontSize = 13.sp,
                modifier = Modifier.weight(1f)
            )
        }
    }
}
