/**
 * NaviMate Shared Domain Contracts
 * Single source of truth across Web, Server, and Native Android.
 * 
 * Kotlin Mapping Reference:
 * - RouteRequest        -> com.navimate.ai.api.RouteComputeRequest
 * - RouteResult         -> com.navimate.ai.api.RouteComputeResponse
 * - RouteOption         -> com.navimate.ai.api.RouteOptionDto
 * - RouteWaypoint       -> com.navimate.ai.api.RouteWaypointDto
 * - RouteTokenPayload   -> com.navimate.ai.api.RouteTokenPayload
 * - ProviderStatus      -> com.navimate.ai.model.NetworkNavigationState
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteWaypoint {
  name?: string;
  placeId?: string;
  location?: LatLng;
  isVia?: boolean;
}

export interface SharedVehicleProfile {
  id?: string;
  name?: string;
  fuelType: 'petrol' | 'diesel' | 'electric' | 'hybrid' | 'cng';
  tankCapacity: number;
  avgConsumption: number;
  currentFuelLevel: number;
  fuelPricePerUnit: number;
  currency?: string;
}

export interface RouteRequest {
  origin: string | LatLng;
  destination: string | LatLng;
  waypoints?: (string | LatLng | RouteWaypoint)[];
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
  vehicle?: SharedVehicleProfile;
}

export interface RouteOption {
  id: string;
  routeToken?: string | null;
  name: string;
  summary: string;
  distanceKm: number;
  durationMinutes: number;
  trafficDelayMinutes: number;
  estimatedFuelLitres: number;
  estimatedFuelCost: number;
  tollsEstimated: number;
  hasTolls: boolean;
  hasHighways: boolean;
  hasFerries: boolean;
  encodedPolyline?: string | null;
  tags: string[];
}

export type ProviderStatus = 'ONLINE' | 'DEGRADED_NETWORK' | 'CACHED_NAVIGATION' | 'OFFLINE';

export interface RouteTokenPayload {
  routeToken: string;
  destinationPlaceId?: string;
  destinationTitle?: string;
  expiresAt?: number;
}

export interface RouteResult {
  route: RouteOption;
  routes: RouteOption[];
  routeToken: string | null;
  destination: string;
  waypoints: string[];
  distance: number;
  duration: number;
  provider: string;
  freshness: number;
  hasRouteToken: boolean;
  providerStatus?: ProviderStatus;
}

export interface SharedNavigationSession {
  sessionId: string;
  routeId?: string | null;
  destination: string;
  waypoints: string[];
  navigationState: string;
  vehicleId: string;
  fuelState: Record<string, any>;
  selectedPreferences: Record<string, any>;
  startedAt: number;
  updatedAt: number;
}

export enum SharedNavigationErrorCode {
  NAV_SDK_INIT_FAILED = 'NAV_SDK_INIT_FAILED',
  ROUTE_TOKEN_INVALID = 'ROUTE_TOKEN_INVALID',
  ROUTE_TOKEN_UNAVAILABLE = 'ROUTE_TOKEN_UNAVAILABLE',
  ROUTE_TOKEN_DESTINATION_MISMATCH = 'ROUTE_TOKEN_DESTINATION_MISMATCH',
  ROUTE_PROVIDER_UNAVAILABLE = 'ROUTE_PROVIDER_UNAVAILABLE',
  ROUTE_COMPUTE_FAILED = 'ROUTE_COMPUTE_FAILED',
  GPS_PERMISSION_DENIED = 'GPS_PERMISSION_DENIED',
  GPS_UNAVAILABLE = 'GPS_UNAVAILABLE',
  NETWORK_UNAVAILABLE = 'NETWORK_UNAVAILABLE',
  VOICE_UNAVAILABLE = 'VOICE_UNAVAILABLE',
  GEMINI_UNAVAILABLE = 'GEMINI_UNAVAILABLE',
  PLACES_UNAVAILABLE = 'PLACES_UNAVAILABLE',
  HOTEL_PROVIDER_UNAVAILABLE = 'HOTEL_PROVIDER_UNAVAILABLE',
  TRAFFIC_UNAVAILABLE = 'TRAFFIC_UNAVAILABLE',
}

export interface ErrorEnvelope {
  code: SharedNavigationErrorCode;
  technicalMessage: string;
  driverReadableMessage: string;
  retryable: boolean;
}

/**
 * Validates a route result payload to ensure it conforms to the RouteResult schema.
 */
export function validateRouteResult(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Response is not an object'] };
  }
  if (!Array.isArray(data.routes) || data.routes.length === 0) {
    errors.push('Response must contain non-empty routes array');
  }
  if (!data.destination || typeof data.destination !== 'string') {
    errors.push('Response must contain destination string');
  }
  if (typeof data.distance !== 'number' || data.distance < 0) {
    errors.push('Response must contain valid numeric distance');
  }
  if (typeof data.duration !== 'number' || data.duration < 0) {
    errors.push('Response must contain valid numeric duration');
  }
  if (!data.provider || typeof data.provider !== 'string') {
    errors.push('Response must identify provider string');
  }
  if (typeof data.freshness !== 'number') {
    errors.push('Response must contain timestamp freshness');
  }
  return { valid: errors.length === 0, errors };
}
