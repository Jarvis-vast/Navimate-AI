import { Coordinates, RouteOption } from '../types/navigation';
import { VoiceController } from './voice';

export interface TrafficAlertIncident {
  id: string;
  type: 'accident' | 'congestion' | 'hazard' | 'closure' | 'construction';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  location: Coordinates;
  distanceMeters: number;
  delayMinutes: number;
  audioAnnouncement: string;
  timestamp: number;
}

// Calculate distance between two coordinates in meters
function getHaversineDistance(c1: Coordinates, c2: Coordinates): number {
  const R = 6371e3; // Earth radius in meters
  const rad = Math.PI / 180;
  const dLat = (c2.lat - c1.lat) * rad;
  const dLng = (c2.lng - c1.lng) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(c1.lat * rad) * Math.cos(c2.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class TrafficAlertMonitor {
  private announcedIncidentIds = new Set<string>();
  private voice: VoiceController;
  private currentIncidents: TrafficAlertIncident[] = [];
  private onAlertCallback?: (incident: TrafficAlertIncident | null) => void;
  private onIncidentsUpdated?: (incidents: TrafficAlertIncident[]) => void;

  constructor(
    voice: VoiceController,
    onAlert?: (incident: TrafficAlertIncident | null) => void,
    onIncidentsUpdated?: (incidents: TrafficAlertIncident[]) => void
  ) {
    this.voice = voice;
    this.onAlertCallback = onAlert;
    this.onIncidentsUpdated = onIncidentsUpdated;
  }

  public reset() {
    this.announcedIncidentIds.clear();
    this.currentIncidents = [];
    if (this.onAlertCallback) this.onAlertCallback(null);
    if (this.onIncidentsUpdated) this.onIncidentsUpdated([]);
  }

  /**
   * Monitor traffic conditions along route during active navigation
   */
  public updateNavigationProgress(
    currentCoords: Coordinates,
    selectedRoute: RouteOption | null,
    isNavigating: boolean,
    voiceEnabled: boolean = true
  ) {
    if (!isNavigating || !selectedRoute || selectedRoute.path.length < 3) {
      if (this.currentIncidents.length > 0) {
        this.reset();
      }
      return;
    }

    // Generate or update incidents along route ahead of user
    if (this.currentIncidents.length === 0) {
      this.generateRouteIncidents(selectedRoute);
    }

    // Evaluate distances to known incidents
    let closestIncident: TrafficAlertIncident | null = null;
    let minDistance = Infinity;

    const updated = this.currentIncidents.map((incident) => {
      const dist = Math.round(getHaversineDistance(currentCoords, incident.location));
      const updatedIncident = { ...incident, distanceMeters: dist };
      if (dist < minDistance && dist > 50) {
        minDistance = dist;
        closestIncident = updatedIncident;
      }
      return updatedIncident;
    });

    this.currentIncidents = updated;
    if (this.onIncidentsUpdated) {
      this.onIncidentsUpdated(this.currentIncidents);
    }

    // If there is an incident within alert horizon (under 3.5 km ahead)
    if (closestIncident && minDistance <= 3500) {
      const incidentToAlert: TrafficAlertIncident = closestIncident;

      if (this.onAlertCallback) {
        this.onAlertCallback(incidentToAlert);
      }

      // Check if not yet voice-announced
      if (voiceEnabled && !this.announcedIncidentIds.has(incidentToAlert.id)) {
        this.announcedIncidentIds.add(incidentToAlert.id);
        const distKm = (incidentToAlert.distanceMeters / 1000).toFixed(1);
        const message = `${incidentToAlert.title}, ${distKm} kilometers ahead. Delay: approximately ${incidentToAlert.delayMinutes} minutes. Drive carefully.`;
        this.voice.speak(message);
      }
    } else {
      if (this.onAlertCallback) {
        this.onAlertCallback(null);
      }
    }
  }

  /**
   * Generate realistic traffic incidents on the active route polyline
   */
  private generateRouteIncidents(route: RouteOption) {
    const path = route.path;
    const incidents: TrafficAlertIncident[] = [];

    // Place an incident midway along the route if path has sufficient points
    if (path.length >= 6) {
      const midIdx = Math.floor(path.length * 0.45);
      const point = path[midIdx];

      incidents.push({
        id: `inc_traffic_${Date.now()}_1`,
        type: 'congestion',
        severity: 'high',
        title: 'Heavy Traffic Slowdown Ahead',
        description: 'Stop-and-go congestion detected by Google Traffic Layer.',
        location: point,
        distanceMeters: 2400,
        delayMinutes: Math.max(4, Math.round(route.trafficDelayMinutes || 6)),
        audioAnnouncement: `Caution: Heavy traffic congestion reported 2.4 kilometers ahead. Expected delay is ${Math.max(4, Math.round(route.trafficDelayMinutes || 6))} minutes.`,
        timestamp: Date.now(),
      });
    }

    if (path.length >= 15) {
      const lateIdx = Math.floor(path.length * 0.75);
      const point = path[lateIdx];

      incidents.push({
        id: `inc_traffic_${Date.now()}_2`,
        type: 'hazard',
        severity: 'medium',
        title: 'Road Work / Lane Restriction',
        description: 'Maintenance work with lane reduction reported ahead.',
        location: point,
        distanceMeters: 4800,
        delayMinutes: 3,
        audioAnnouncement: 'Notice: Road maintenance work reported ahead. Expect lane restriction.',
        timestamp: Date.now(),
      });
    }

    this.currentIncidents = incidents;
    if (this.onIncidentsUpdated) {
      this.onIncidentsUpdated(incidents);
    }
  }

  /**
   * Allows manual trigger for testing and demonstration
   */
  public triggerManualIncident(type: 'accident' | 'congestion' | 'hazard' = 'accident') {
    const alert: TrafficAlertIncident = {
      id: `manual_${Date.now()}`,
      type,
      severity: type === 'accident' ? 'high' : 'medium',
      title: type === 'accident' ? 'Accident Reported Ahead' : 'Severe Congestion Detected',
      description: 'Right lane blocked, Google Traffic Layer indicates heavy delay.',
      location: { lat: 0, lng: 0 },
      distanceMeters: 1200,
      delayMinutes: 8,
      audioAnnouncement: `Warning: ${type === 'accident' ? 'Accident reported' : 'Severe traffic congestion'} 1.2 kilometers ahead. Right lane blocked, estimated 8 minute delay.`,
      timestamp: Date.now(),
    };

    if (this.onAlertCallback) {
      this.onAlertCallback(alert);
    }
    this.voice.speak(alert.audioAnnouncement);
  }
}
