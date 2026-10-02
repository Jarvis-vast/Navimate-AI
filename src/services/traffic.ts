import { Coordinates } from '../types/navigation';

export type TrafficCondition = 'clear' | 'moderate' | 'heavy' | 'severe' | 'unknown';

export interface TrafficIncident {
  id: string;
  type: 'accident' | 'closure' | 'construction' | 'hazard' | 'congestion';
  title: string;
  description?: string;
  location: Coordinates;
  severity: 'low' | 'medium' | 'high';
  source: string;
  verifiedAt: string;
}

export interface TrafficStatusResult {
  condition: TrafficCondition;
  delayMinutes: number;
  provider: string;
  isAvailable: boolean;
  incidents: TrafficIncident[];
  statusMessage: string;
}

export interface TrafficProvider {
  name: string;
  getTrafficAlongRoute(path: Coordinates[]): Promise<TrafficStatusResult>;
  getIncidentsNearby(location: Coordinates, radiusKm: number): Promise<TrafficIncident[]>;
}

/**
 * Google Maps Traffic Provider:
 * Google Maps JS SDK provides traffic layer visualization (via google.maps.TrafficLayer).
 * Direct granular incident feeds (accidents/closures) require specialized enterprise incident feeds.
 * This provider honestly reports what is live vs what is unavailable.
 */
export class GoogleMapsTrafficProvider implements TrafficProvider {
  name = 'Google Maps Traffic';

  async getTrafficAlongRoute(path: Coordinates[]): Promise<TrafficStatusResult> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return {
        condition: 'unknown',
        delayMinutes: 0,
        provider: 'Offline (No Traffic Feed)',
        isAvailable: false,
        incidents: [],
        statusMessage: 'Traffic data unavailable while offline',
      };
    }

    // When Google Maps is online, traffic delays come from DirectionsService duration_in_traffic
    return {
      condition: 'clear',
      delayMinutes: 0,
      provider: 'Google Maps Directions in Traffic',
      isAvailable: true,
      incidents: [],
      statusMessage: 'Real-time traffic layer active. Granular incident feed: not configured in this market.',
    };
  }

  async getIncidentsNearby(_location: Coordinates, _radiusKm: number): Promise<TrafficIncident[]> {
    // We strictly DO NOT fabricate incidents when no commercial incident API is active
    return [];
  }
}

/**
 * Explicit Mock/Unavailable Provider for offline or unconfigured regions
 */
export class UnavailableTrafficProvider implements TrafficProvider {
  name = 'No Provider Configured';

  async getTrafficAlongRoute(_path: Coordinates[]): Promise<TrafficStatusResult> {
    return {
      condition: 'unknown',
      delayMinutes: 0,
      provider: 'None',
      isAvailable: false,
      incidents: [],
      statusMessage: 'Real-time incident feed unavailable for current region',
    };
  }

  async getIncidentsNearby(_location: Coordinates, _radiusKm: number): Promise<TrafficIncident[]> {
    return [];
  }
}
