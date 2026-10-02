package com.navimate.ai.api

import com.google.gson.annotations.SerializedName
import retrofit2.Response
import retrofit2.http.*

data class LatLngDto(
    @SerializedName("lat") val lat: Double,
    @SerializedName("lng") val lng: Double
)

data class VehicleDto(
    @SerializedName("avgConsumption") val avgConsumption: Double = 7.5,
    @SerializedName("tankCapacity") val tankCapacity: Double = 45.0,
    @SerializedName("currentFuelLevel") val currentFuelLevel: Double = 50.0,
    @SerializedName("fuelPricePerUnit") val fuelPricePerUnit: Double = 98.0,
    @SerializedName("fuelType") val fuelType: String = "petrol"
)

data class RouteComputeRequest(
    @SerializedName("origin") val origin: Any, // String or LatLngDto
    @SerializedName("destination") val destination: Any, // String or LatLngDto
    @SerializedName("waypoints") val waypoints: List<Any>? = null,
    @SerializedName("avoidTolls") val avoidTolls: Boolean = false,
    @SerializedName("avoidHighways") val avoidHighways: Boolean = false,
    @SerializedName("avoidFerries") val avoidFerries: Boolean = false,
    @SerializedName("vehicle") val vehicle: VehicleDto? = null
)

data class RouteDto(
    @SerializedName("id") val id: String,
    @SerializedName("routeToken") val routeToken: String?,
    @SerializedName("name") val name: String,
    @SerializedName("summary") val summary: String,
    @SerializedName("distanceKm") val distanceKm: Double,
    @SerializedName("durationMinutes") val durationMinutes: Int,
    @SerializedName("trafficDelayMinutes") val trafficDelayMinutes: Int,
    @SerializedName("estimatedFuelLitres") val estimatedFuelLitres: Double,
    @SerializedName("estimatedFuelCost") val estimatedFuelCost: Double,
    @SerializedName("tollsEstimated") val tollsEstimated: Double,
    @SerializedName("hasTolls") val hasTolls: Boolean,
    @SerializedName("hasHighways") val hasHighways: Boolean,
    @SerializedName("hasFerries") val hasFerries: Boolean,
    @SerializedName("encodedPolyline") val encodedPolyline: String?,
    @SerializedName("tags") val tags: List<String> = emptyList()
)

data class RouteComputeResponse(
    @SerializedName("routes") val routes: List<RouteDto>,
    @SerializedName("route") val route: RouteDto? = null,
    @SerializedName("routeToken") val routeToken: String? = null,
    @SerializedName("destination") val destination: String? = null,
    @SerializedName("waypoints") val waypoints: List<String>? = null,
    @SerializedName("distance") val distance: Double? = null,
    @SerializedName("duration") val duration: Int? = null,
    @SerializedName("provider") val provider: String,
    @SerializedName("freshness") val freshness: Long? = null,
    @SerializedName("hasRouteToken") val hasRouteToken: Boolean
)

data class ChatMessageRequest(
    @SerializedName("message") val message: String,
    @SerializedName("context") val context: Map<String, Any>? = null
)

data class ChatMessageResponse(
    @SerializedName("text") val text: String,
    @SerializedName("toolCalls") val toolCalls: List<ToolCallDto> = emptyList(),
    @SerializedName("modelUsed") val modelUsed: String? = null
)

data class ToolCallDto(
    @SerializedName("name") val name: String,
    @SerializedName("params") val params: Map<String, Any>? = null,
    @SerializedName("status") val status: String
)

data class SessionSyncRequest(
    @SerializedName("sessionId") val sessionId: String,
    @SerializedName("destination") val destination: String?,
    @SerializedName("routeId") val routeId: String?,
    @SerializedName("navigationState") val navigationState: String?,
    @SerializedName("vehicleId") val vehicleId: String?,
    @SerializedName("fuelState") val fuelState: Map<String, Any>?,
    @SerializedName("preferences") val preferences: Map<String, Any>?
)

data class SessionSyncResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("session") val session: Map<String, Any>
)

// ----------------------------------------------------
// Unified NaviMate Platform DTOs (Web + Android Connected)
// ----------------------------------------------------

data class DeviceDto(
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("userId") val userId: String,
    @SerializedName("platform") val platform: String, // "ANDROID" | "WEB"
    @SerializedName("name") val name: String?,
    @SerializedName("appVersion") val appVersion: String?,
    @SerializedName("lastSeenAt") val lastSeenAt: String,
    @SerializedName("capabilities") val capabilities: List<String>?,
    @SerializedName("status") val status: String, // "ONLINE" | "OFFLINE"
    @SerializedName("batteryPercent") val batteryPercent: Int?
)

data class DeviceRegistrationRequest(
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("platform") val platform: String = "ANDROID",
    @SerializedName("name") val name: String = "Android In-Car Unit",
    @SerializedName("appVersion") val appVersion: String = "2.4.0",
    @SerializedName("capabilities") val capabilities: List<String> = listOf("NAVIGATION_SDK_7_6", "VOICE_ASSISTANT", "ROUTE_TOKEN", "CAR_APP"),
    @SerializedName("batteryPercent") val batteryPercent: Int? = null
)

data class DevicePairConfirmRequest(
    @SerializedName("pairingCode") val pairingCode: String,
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("deviceName") val deviceName: String = "Android In-Car Navigation",
    @SerializedName("appVersion") val appVersion: String = "2.4.0",
    @SerializedName("platform") val platform: String = "ANDROID"
)

data class DevicePairConfirmResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("device") val device: DeviceDto?,
    @SerializedName("message") val message: String?
)

data class SharedVehicleDto(
    @SerializedName("vehicleId") val vehicleId: String,
    @SerializedName("userId") val userId: String,
    @SerializedName("make") val make: String?,
    @SerializedName("model") val model: String?,
    @SerializedName("fuelType") val fuelType: String,
    @SerializedName("tankCapacityLitres") val tankCapacityLitres: Double?,
    @SerializedName("averageConsumption") val averageConsumption: Double?,
    @SerializedName("currentFuelLevel") val currentFuelLevel: Double?,
    @SerializedName("preferredFuelPrice") val preferredFuelPrice: Double?,
    @SerializedName("isTelemetryConnected") val isTelemetryConnected: Boolean,
    @SerializedName("updatedAt") val updatedAt: String
)

data class VehicleResponse(
    @SerializedName("vehicle") val vehicle: SharedVehicleDto
)

data class SavedPlaceDto(
    @SerializedName("id") val id: String,
    @SerializedName("userId") val userId: String,
    @SerializedName("name") val name: String,
    @SerializedName("address") val address: String,
    @SerializedName("lat") val lat: Double,
    @SerializedName("lng") val lng: Double,
    @SerializedName("category") val category: String,
    @SerializedName("updatedAt") val updatedAt: String
)

data class SavedPlacesResponse(
    @SerializedName("places") val places: List<SavedPlaceDto>
)

data class TripPointDto(
    @SerializedName("lat") val lat: Double,
    @SerializedName("lng") val lng: Double,
    @SerializedName("name") val name: String? = null,
    @SerializedName("address") val address: String? = null
)

data class TripDto(
    @SerializedName("tripId") val tripId: String,
    @SerializedName("userId") val userId: String,
    @SerializedName("origin") val origin: TripPointDto,
    @SerializedName("destination") val destination: TripPointDto,
    @SerializedName("selectedRouteId") val selectedRouteId: String?,
    @SerializedName("routeToken") val routeToken: String?,
    @SerializedName("status") val status: String, // "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED"
    @SerializedName("dispatchedToDeviceId") val dispatchedToDeviceId: String?,
    @SerializedName("dispatchedAt") val dispatchedAt: String?,
    @SerializedName("estimatedDistanceMeters") val estimatedDistanceMeters: Long?,
    @SerializedName("estimatedDurationSeconds") val estimatedDurationSeconds: Long?,
    @SerializedName("estimatedFuelLitres") val estimatedFuelLitres: Double?,
    @SerializedName("estimatedFuelCost") val estimatedFuelCost: Double?,
    @SerializedName("createdAt") val createdAt: String,
    @SerializedName("updatedAt") val updatedAt: String
)

data class ActiveTripResponse(
    @SerializedName("trip") val trip: TripDto?
)

data class TelemetryPushRequest(
    @SerializedName("tripId") val tripId: String?,
    @SerializedName("sessionId") val sessionId: String,
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("status") val status: String,
    @SerializedName("currentSpeedKmh") val currentSpeedKmh: Double,
    @SerializedName("postedSpeedLimitKmh") val postedSpeedLimitKmh: Double?,
    @SerializedName("isOverspeed") val isOverspeed: Boolean,
    @SerializedName("remainingDistanceMeters") val remainingDistanceMeters: Long,
    @SerializedName("remainingDurationSeconds") val remainingDurationSeconds: Long,
    @SerializedName("etaFormatted") val etaFormatted: String,
    @SerializedName("currentLocation") val currentLocation: LatLngDto?,
    @SerializedName("currentManeuver") val currentManeuver: Map<String, Any>?
)

interface NaviMateApiService {
    @POST("/api/routes/compute")
    suspend fun computeRoutes(@Body request: RouteComputeRequest): Response<RouteComputeResponse>

    @POST("/api/chat")
    suspend fun postChatMessage(@Body request: ChatMessageRequest): Response<ChatMessageResponse>

    @POST("/api/navigation/session")
    suspend fun syncNavigationSession(@Body request: SessionSyncRequest): Response<SessionSyncResponse>

    @GET("/api/navigation/session/{sessionId}")
    suspend fun getNavigationSession(@Path("sessionId") sessionId: String): Response<SessionSyncResponse>

    // --- Unified Platform Endpoints ---

    @POST("/api/devices/register")
    suspend fun registerDevice(@Body request: DeviceRegistrationRequest): Response<Map<String, Any>>

    @POST("/api/devices/pair/confirm")
    suspend fun confirmDevicePairing(@Body request: DevicePairConfirmRequest): Response<DevicePairConfirmResponse>

    @GET("/api/devices")
    suspend fun getDevices(): Response<Map<String, List<DeviceDto>>>

    @GET("/api/vehicle")
    suspend fun getSharedVehicle(): Response<VehicleResponse>

    @PUT("/api/vehicle")
    suspend fun updateSharedVehicle(@Body vehicle: SharedVehicleDto): Response<VehicleResponse>

    @GET("/api/places/saved")
    suspend fun getSavedPlaces(): Response<SavedPlacesResponse>

    @POST("/api/places/saved")
    suspend fun savePlace(@Body place: SavedPlaceDto): Response<Map<String, Any>>

    @DELETE("/api/places/saved/{id}")
    suspend fun deleteSavedPlace(@Path("id") placeId: String): Response<Map<String, Any>>

    @GET("/api/trips/active")
    suspend fun getActiveTrip(): Response<ActiveTripResponse>

    @PATCH("/api/trips/{id}")
    suspend fun updateTripStatus(@Path("id") tripId: String, @Body updates: Map<String, String>): Response<Map<String, Any>>

    @POST("/api/navigation/telemetry")
    suspend fun postNavigationTelemetry(@Body telemetry: TelemetryPushRequest): Response<Map<String, Any>>
}
