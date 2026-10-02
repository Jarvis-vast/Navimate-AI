/**
 * NaviMate AI — Shared Platform Data Models
 * Authoritative shared contracts between Web Client, Android Client, and Backend Control Plane.
 */

export interface User {
  userId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
}

export type PlatformType = 'WEB' | 'ANDROID';
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export interface Device {
  deviceId: string;
  userId: string;
  platform: PlatformType;
  name?: string;
  appVersion?: string;
  lastSeenAt: string;
  capabilities?: string[];
  status: DeviceStatus;
  batteryPercent?: number;
  isCurrentDevice?: boolean;
}

export interface PairingRequest {
  pairingCode: string; // 6-digit numeric pairing code
  qrPayload: string;   // Structured payload with verification token
  userId: string;
  createdDeviceId: string;
  expiresAt: number;   // Epoch millis, 5-minute TTL
  status: 'PENDING' | 'CONSUMED' | 'EXPIRED';
}

export type SharedFuelType = 'PETROL' | 'DIESEL' | 'CNG' | 'EV' | 'HYBRID';

export interface SharedVehicle {
  vehicleId: string;
  userId: string;
  make?: string;
  model?: string;
  fuelType: SharedFuelType;
  tankCapacityLitres?: number;
  averageConsumption?: number; // L/100km or equivalent
  currentFuelLevel?: number;   // Percentage 0-100
  preferredFuelPrice?: number;
  isTelemetryConnected: boolean;
  updatedAt: string;
}

export interface SavedPlaceEntity {
  id: string;
  userId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: 'home' | 'work' | 'family' | 'petrol_station' | 'hotel' | 'favorite' | 'recent';
  updatedAt: string;
}

export interface LocationPoint {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
}

export interface WaypointPoint {
  id: string;
  lat: number;
  lng: number;
  name?: string;
  stopDurationMinutes?: number;
}

export type TripStatus = 'PLANNED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export interface Trip {
  tripId: string;
  userId: string;
  vehicleId?: string;
  origin: LocationPoint;
  destination: LocationPoint;
  waypoints: WaypointPoint[];
  selectedRouteId?: string;
  routeToken?: string | null;
  status: TripStatus;
  dispatchedToDeviceId?: string | null;
  dispatchedAt?: string | null;
  estimatedDistanceMeters?: number;
  estimatedDurationSeconds?: number;
  estimatedFuelLitres?: number;
  estimatedFuelCost?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LiveNavigationTelemetry {
  tripId?: string;
  sessionId: string;
  deviceId: string;
  status:
    | 'IDLE'
    | 'ROUTE_PREVIEW'
    | 'STARTING'
    | 'NAVIGATING'
    | 'REROUTING'
    | 'ARRIVING'
    | 'ARRIVED'
    | 'GPS_LOST'
    | 'OFFLINE';
  currentSpeedKmh: number;
  postedSpeedLimitKmh: number | null;
  isOverspeed: boolean;
  remainingDistanceMeters: number;
  remainingDurationSeconds: number;
  etaFormatted: string;
  currentManeuver?: {
    instruction: string;
    distanceMeters: number;
    maneuverType: string;
  } | null;
  currentLocation?: {
    lat: number;
    lng: number;
    bearing?: number;
    speed?: number;
  } | null;
  trafficStatus?: 'clear' | 'moderate' | 'heavy' | 'rerouting';
  updatedAt: number;
}

export type RealtimeEventType =
  | 'CONNECTED'
  | 'HEARTBEAT'
  | 'DEVICE_PAIRED'
  | 'DEVICE_UNPAIRED'
  | 'DEVICE_STATUS'
  | 'TRIP_DISPATCHED'
  | 'TRIP_UPDATED'
  | 'NAVIGATION_TELEMETRY'
  | 'VEHICLE_UPDATED'
  | 'SAVED_PLACES_UPDATED';

export interface RealtimeMessage {
  type: RealtimeEventType;
  payload: any;
  timestamp: number;
}
