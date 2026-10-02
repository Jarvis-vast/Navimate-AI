import { Coordinates, RouteManeuver } from '../types/navigation';

export type RoadType =
  | 'highway'
  | 'expressway'
  | 'arterial'
  | 'urban'
  | 'residential'
  | 'school_zone'
  | 'rural';

export interface PostedSpeedLimitInfo {
  speedLimitKmh: number;
  roadName: string;
  roadType: RoadType;
  unit: 'km/h';
  source: string;
  bufferToleranceKmh: number;
  schoolZone: boolean;
  zoneDescription: string;
  confidence: number;
  timestamp: number;
}

export type OverspeedSeverity = 'normal' | 'caution' | 'warning' | 'critical';

export interface SpeedLimitComparisonResult {
  currentSpeedKmh: number;
  postedLimitKmh: number;
  excessSpeedKmh: number;
  isOverspeed: boolean;
  severity: OverspeedSeverity;
  percentageOver: number;
  alertTitle: string;
  alertMessage: string;
  recommendedAction: string;
  colorClass: string;
  badgeClass: string;
  soundAlert: boolean;
}

/**
 * Pure comparison function that evaluates current vehicle speed against the posted speed limit.
 *
 * @param currentSpeedKmh Current GPS / telemetry vehicle speed in km/h
 * @param postedLimitKmh Current posted legal speed limit for the roadway (or null if unavailable)
 * @param toleranceBufferKmh Acceptable calibration / minor variance buffer in km/h (default: 3)
 */
export function compareSpeedAgainstLimit(
  currentSpeedKmh: number,
  postedLimitKmh: number | null,
  toleranceBufferKmh: number = 3
): SpeedLimitComparisonResult {
  const speed = Math.max(0, Math.round(Number.isFinite(currentSpeedKmh) ? currentSpeedKmh : 0));

  if (postedLimitKmh === null || !Number.isFinite(postedLimitKmh) || postedLimitKmh <= 0) {
    return {
      currentSpeedKmh: speed,
      postedLimitKmh: 0,
      excessSpeedKmh: 0,
      isOverspeed: false,
      severity: 'normal',
      percentageOver: 0,
      alertTitle: 'Speed Monitoring Normal',
      alertMessage: 'Posted speed limit unavailable for this road corridor.',
      recommendedAction: 'Drive according to prevailing road, weather, and traffic conditions.',
      colorClass: 'text-slate-200',
      badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
      soundAlert: false,
    };
  }

  const limit = Math.round(postedLimitKmh);
  const diff = speed - limit;
  const percentageOver = diff > 0 ? Math.round((diff / limit) * 100) : 0;

  // Safe / Legal speed
  if (diff <= 0) {
    return {
      currentSpeedKmh: speed,
      postedLimitKmh: limit,
      excessSpeedKmh: 0,
      isOverspeed: false,
      severity: 'normal',
      percentageOver: 0,
      alertTitle: 'Speed Within Limit',
      alertMessage: `Cruising at ${speed} km/h (Limit: ${limit} km/h)`,
      recommendedAction: 'Maintain current speed and follow safe headway interval.',
      colorClass: 'text-emerald-400',
      badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-600',
      soundAlert: false,
    };
  }

  // Caution buffer: 1 to toleranceBufferKmh (e.g. 1-3 km/h over)
  if (diff <= toleranceBufferKmh) {
    return {
      currentSpeedKmh: speed,
      postedLimitKmh: limit,
      excessSpeedKmh: diff,
      isOverspeed: true,
      severity: 'caution',
      percentageOver,
      alertTitle: 'Speed Warning: Approaching Threshold',
      alertMessage: `Vehicle traveling at ${speed} km/h (+${diff} km/h over ${limit} km/h limit)`,
      recommendedAction: 'Ease off the accelerator to maintain compliance.',
      colorClass: 'text-amber-400',
      badgeClass: 'bg-amber-950/90 text-amber-200 border-amber-500',
      soundAlert: false,
    };
  }

  // Warning zone: 4 to 15 km/h over
  if (diff <= 15) {
    return {
      currentSpeedKmh: speed,
      postedLimitKmh: limit,
      excessSpeedKmh: diff,
      isOverspeed: true,
      severity: 'warning',
      percentageOver,
      alertTitle: 'Speed Limit Exceeded',
      alertMessage: `Vehicle speed ${speed} km/h is +${diff} km/h over the posted ${limit} km/h limit`,
      recommendedAction: 'Slow down. Automated speed enforcement cameras may be operating on this corridor.',
      colorClass: 'text-rose-400',
      badgeClass: 'bg-rose-950/95 text-rose-100 border-rose-500 ring-2 ring-rose-500/40',
      soundAlert: true,
    };
  }

  // Critical hazard zone: > 15 km/h over
  return {
    currentSpeedKmh: speed,
    postedLimitKmh: limit,
    excessSpeedKmh: diff,
    isOverspeed: true,
    severity: 'critical',
    percentageOver,
    alertTitle: 'Critical Overspeed Hazard!',
    alertMessage: `High speed alert! Traveling ${speed} km/h (+${diff} km/h over ${limit} km/h limit)`,
    recommendedAction: 'Brake smoothly now to reduce speed and prevent hazardous loss of vehicle control.',
    colorClass: 'text-rose-500',
    badgeClass: 'bg-rose-950 text-white border-rose-500 ring-4 ring-rose-500/70',
    soundAlert: true,
  };
}

/**
 * Client service interacting with the Mock Speed Limit API
 * Provides corridor speed limit lookup, local caching, and simulation controls.
 */
class SpeedLimitService {
  private manualOverrideLimit: number | null = null;
  private cache = new Map<string, PostedSpeedLimitInfo>();

  /**
   * Set a manual override for testing / simulation (null clears override)
   */
  public setManualOverride(limit: number | null) {
    this.manualOverrideLimit = limit;
  }

  public getManualOverride(): number | null {
    return this.manualOverrideLimit;
  }

  /**
   * Fetch the posted speed limit for a given road coordinate and name
   */
  public async fetchPostedSpeedLimit(
    coords?: Coordinates,
    roadName?: string,
    maneuver?: RouteManeuver | null
  ): Promise<PostedSpeedLimitInfo> {
    // 1. Honor manual override if set
    if (this.manualOverrideLimit !== null) {
      return {
        speedLimitKmh: this.manualOverrideLimit,
        roadName: roadName || 'Simulated Test Corridor',
        roadType: this.manualOverrideLimit >= 100 ? 'expressway' : this.manualOverrideLimit >= 80 ? 'highway' : 'urban',
        unit: 'km/h',
        source: 'Manual Simulator Override',
        bufferToleranceKmh: 3,
        schoolZone: this.manualOverrideLimit <= 30,
        zoneDescription: 'Manual Testing Zone',
        confidence: 1.0,
        timestamp: Date.now(),
      };
    }

    const lat = coords?.lat ?? 18.5204;
    const lng = coords?.lng ?? 73.8567;
    const road = roadName || maneuver?.instruction || '';
    const cacheKey = `${lat.toFixed(3)}_${lng.toFixed(3)}_${road.toLowerCase()}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // 2. Query Mock API endpoint
    try {
      const url = new URL('/api/speed-limit', window.location.origin);
      url.searchParams.set('lat', lat.toString());
      url.searchParams.set('lng', lng.toString());
      if (road) url.searchParams.set('roadName', road);

      const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
      });

      if (res.ok) {
        const data: PostedSpeedLimitInfo = await res.json();
        this.cache.set(cacheKey, data);
        return data;
      }
    } catch (err) {
      // Graceful fallback to client heuristic
    }

    // 3. Fallback client-side mock heuristic
    const fallback = this.deriveSpeedLimitFromContext(road);
    this.cache.set(cacheKey, fallback);
    return fallback;
  }

  /**
   * Derive realistic speed limits based on road naming conventions
   */
  public deriveSpeedLimitFromContext(roadName: string = ''): PostedSpeedLimitInfo {
    const lower = roadName.toLowerCase();

    if (lower.includes('expressway') || lower.includes('tollway') || lower.includes('freeway')) {
      return {
        speedLimitKmh: 100,
        roadName: roadName || 'Expressway Corridor',
        roadType: 'expressway',
        unit: 'km/h',
        source: 'OpenGIS Speed Matrix (Mock)',
        bufferToleranceKmh: 5,
        schoolZone: false,
        zoneDescription: 'Multi-lane Divided Expressway',
        confidence: 0.95,
        timestamp: Date.now(),
      };
    }

    if (lower.includes('highway') || lower.includes('nh-') || lower.includes('national') || lower.includes('bypass')) {
      return {
        speedLimitKmh: 80,
        roadName: roadName || 'National Highway Corridor',
        roadType: 'highway',
        unit: 'km/h',
        source: 'Highway Authority GIS (Mock)',
        bufferToleranceKmh: 4,
        schoolZone: false,
        zoneDescription: 'Arterial Highway Link',
        confidence: 0.92,
        timestamp: Date.now(),
      };
    }

    if (lower.includes('ring road') || lower.includes('boulevard') || lower.includes('avenue') || lower.includes('flyover')) {
      return {
        speedLimitKmh: 60,
        roadName: roadName || 'City Ring Road',
        roadType: 'arterial',
        unit: 'km/h',
        source: 'Traffic Management Center (Mock)',
        bufferToleranceKmh: 3,
        schoolZone: false,
        zoneDescription: 'Urban Arterial Road',
        confidence: 0.9,
        timestamp: Date.now(),
      };
    }

    if (lower.includes('school') || lower.includes('hospital') || lower.includes('residential') || lower.includes('gali') || lower.includes('lane')) {
      return {
        speedLimitKmh: 30,
        roadName: roadName || 'School & Residential Zone',
        roadType: 'school_zone',
        unit: 'km/h',
        source: 'Municipal Traffic Safety Zone (Mock)',
        bufferToleranceKmh: 2,
        schoolZone: true,
        zoneDescription: 'Vulnerable Road User Safety Zone',
        confidence: 0.98,
        timestamp: Date.now(),
      };
    }

    // Standard urban street default
    return {
      speedLimitKmh: 50,
      roadName: roadName || 'City Sector Road',
      roadType: 'urban',
      unit: 'km/h',
      source: 'Municipal Speed Limits Feed (Mock)',
      bufferToleranceKmh: 3,
      schoolZone: false,
      zoneDescription: 'Commercial Urban Corridor',
      confidence: 0.88,
      timestamp: Date.now(),
    };
  }
}

export const speedLimitService = new SpeedLimitService();
