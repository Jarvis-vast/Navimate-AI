export interface Coordinates {
  lat: number;
  lng: number;
}

export interface UserPreferences {
  units: 'km' | 'mi';
  theme: 'system' | 'dark' | 'light';
  voiceEnabled: boolean;
  voiceVolume: number;
  dataSaver: 'normal' | 'data-saver' | 'battery-saver';
  locationHistoryConsent: boolean;
  autoReroute: boolean;
  speedLimitAlerts: boolean;
}

export interface VehicleProfile {
  id: string;
  name: string;
  fuelType: 'petrol' | 'diesel' | 'electric' | 'hybrid' | 'cng';
  tankCapacity: number; // Litres or Gallons or kWh
  avgConsumption: number; // L/100km or MPG or kWh/100km
  consumptionUnit?: 'L/100km' | 'mpg_us' | 'mpg_uk' | 'km/L' | 'kWh/100km';
  capacityUnit?: 'litres' | 'gallons' | 'kWh';
  currentFuelLevel: number; // percentage 0 - 100
  fuelPricePerUnit: number; // e.g., ₹/L or $/gal or ₹/kWh
  currency: string;
}

export interface HotelFilters {
  maxPrice?: number;
  minRating?: number;
  maxDistanceKm?: number;
}

export interface OfflineRegion {
  id: string;
  name: string;
  description: string;
  center: Coordinates;
  radiusKm: number;
  bounds: { north: number; south: number; east: number; west: number };
  sizeMb: number;
  tileCount: number;
  downloadedAt: number;
  status: 'downloaded' | 'downloading' | 'available';
  downloadProgress?: number;
  features: string[];
}

export interface FuelLog {
  id: string;
  vehicleId: string;
  date: string;
  odometer: number;
  litres: number;
  cost: number;
  pricePerLitre: number;
  notes?: string;
  locationName?: string;
}

export interface SavedPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: 'home' | 'work' | 'favorite' | 'recent';
  timestamp?: number;
}

export interface RouteManeuver {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuverType: 'turn-left' | 'turn-right' | 'straight' | 'merge' | 'roundabout' | 'destination' | 'exit' | 'keep-left' | 'keep-right';
  laneGuidance?: string;
  exitNumber?: string;
  location: Coordinates;
}

export interface RouteOption {
  id: string;
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
  path: Coordinates[];
  maneuvers: RouteManeuver[];
  tags: string[]; // e.g. "Fastest", "Fuel Saver", "Toll Free"
}

export interface POIItem {
  id: string;
  name: string;
  category: 'fuel' | 'food' | 'charging' | 'rest_area' | 'hospital';
  lat: number;
  lng: number;
  distanceKm: number;
  detourMinutes?: number;
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  fuelPrice?: number;
  openNow?: boolean;
  address?: string;
}

export interface HotelItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  pricePerNight: number;
  currency: string;
  rating: number;
  reviewCount: number;
  distanceFromRouteKm: number;
  provider: string;
  bookingUrl: string;
  amenities: string[];
  imageUrl?: string;
}

export interface NavigationState {
  isActive: boolean;
  currentStepIndex: number;
  currentSpeedKmh: number;
  detectedSpeedLimitKmh: number | null;
  isOverspeed: boolean;
  nextManeuver: RouteManeuver | null;
  distanceToNextManeuverMeters: number;
  remainingDistanceKm: number;
  remainingDurationMinutes: number;
  etaTimeFormatted: string;
  trafficStatus: 'clear' | 'moderate' | 'heavy' | 'rerouting';
  activeAlert?: {
    type: 'speed' | 'traffic' | 'hazard' | 'reroute';
    message: string;
  } | null;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
  toolCalls?: Array<{
    name: string;
    params: any;
    result?: any;
    status: 'pending' | 'success' | 'failed';
  }>;
  quickActions?: Array<{
    label: string;
    action: () => void;
  }>;
}

export interface Waypoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
}
