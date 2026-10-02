/**
 * NaviMate AI — Platform Synchronization Service
 * Coordinates real-time SSE updates, device registry, vehicle sync,
 * saved places, trip dispatch, and live car navigation mirroring.
 */

import {
  Device,
  SharedVehicle,
  SavedPlaceEntity,
  Trip,
  LiveNavigationTelemetry,
  RealtimeMessage,
  PairingRequest,
} from '../types/platform';

export type RealtimeListener = (event: RealtimeMessage) => void;

class PlatformSyncService {
  private eventSource: EventSource | null = null;
  private listeners: Set<RealtimeListener> = new Set();
  private deviceId: string;
  private heartbeatTimer: any = null;
  private reconnectTimeout: any = null;
  private isConnected: boolean = false;
  private authToken: string = 'demo_token';
  private userId: string = 'usr_navimate_primary';

  constructor() {
    // Generate or retrieve persistent web client device ID
    let storedId = localStorage.getItem('navimate_web_device_id');
    if (!storedId) {
      storedId = `dev_web_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('navimate_web_device_id', storedId);
    }
    this.deviceId = storedId;
  }

  public setAuthToken(token: string, userId?: string) {
    this.authToken = token;
    if (userId) this.userId = userId;
  }

  public getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.authToken}`,
      'x-user-id': this.userId,
    };
  }

  public getDeviceId(): string {
    return this.deviceId;
  }

  // ----------------------------------------------------
  // SSE Realtime Stream Connection
  // ----------------------------------------------------
  public connect() {
    if (this.eventSource) return;

    try {
      this.eventSource = new EventSource('/api/realtime/stream');

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.registerCurrentDevice();
        this.startHeartbeat();
      };

      this.eventSource.onmessage = (event) => {
        try {
          const message: RealtimeMessage = JSON.parse(event.data);
          this.notifyListeners(message);
        } catch (e) {
          // ignore malformed ping or non-json message
        }
      };

      this.eventSource.onerror = () => {
        this.disconnect();
        // Exponential / delayed reconnection
        if (!this.reconnectTimeout) {
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
          }, 4000);
        }
      };
    } catch (e) {
      console.warn('Realtime SSE connection failed:', e);
    }
  }

  public disconnect() {
    this.isConnected = false;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  public subscribe(listener: RealtimeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(message: RealtimeMessage) {
    this.listeners.forEach((listener) => {
      try {
        listener(message);
      } catch (err) {
        console.warn('Listener error in platform sync:', err);
      }
    });
  }

  // ----------------------------------------------------
  // Device Registration & Heartbeat
  // ----------------------------------------------------
  public async registerCurrentDevice(): Promise<Device | null> {
    try {
      const res = await fetch('/api/devices/register', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          deviceId: this.deviceId,
          platform: 'WEB',
          name: 'NaviMate Web Dashboard',
          appVersion: '1.2.0',
          capabilities: ['MAP_PLANNER', 'VOICE_ASSISTANT', 'CAR_MIRROR', 'POI_DISCOVERY'],
          batteryPercent: 100,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.device;
      }
    } catch (e) {
      console.warn('Failed to register device:', e);
    }
    return null;
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(async () => {
      try {
        await fetch('/api/devices/heartbeat', {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ deviceId: this.deviceId, batteryPercent: 100 }),
        });
      } catch (e) {
        // silent heartbeat error
      }
    }, 30000);
  }

  public async getDevices(): Promise<Device[]> {
    try {
      const res = await fetch('/api/devices', {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        return data.devices || [];
      }
    } catch (e) {
      console.warn('Failed to fetch devices:', e);
    }
    return [];
  }

  public async unpairDevice(deviceId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/devices/${deviceId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch (e) {
      console.warn('Failed to unpair device:', e);
      return false;
    }
  }

  // ----------------------------------------------------
  // Device Pairing Flow
  // ----------------------------------------------------
  public async createPairingRequest(): Promise<PairingRequest | null> {
    try {
      const res = await fetch('/api/devices/pair/create', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ deviceId: this.deviceId }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Failed to create pairing request:', e);
    }
    return null;
  }

  public async simulateAndroidPair(pairingCode: string, deviceName = 'Pixel 8 Pro (In-Car Navigation)'): Promise<boolean> {
    try {
      const res = await fetch('/api/devices/pair/confirm', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          pairingCode,
          deviceId: `dev_android_${Date.now().toString(36)}`,
          deviceName,
          platform: 'ANDROID',
          appVersion: '2.4.0',
        }),
      });
      return res.ok;
    } catch (e) {
      console.warn('Failed to confirm pairing:', e);
      return false;
    }
  }

  // ----------------------------------------------------
  // Shared Vehicle Sync
  // ----------------------------------------------------
  public async getVehicle(): Promise<SharedVehicle | null> {
    try {
      const res = await fetch('/api/vehicle', {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        return data.vehicle;
      }
    } catch (e) {
      console.warn('Failed to fetch vehicle:', e);
    }
    return null;
  }

  public async updateVehicle(vehicle: Partial<SharedVehicle>): Promise<SharedVehicle | null> {
    try {
      const res = await fetch('/api/vehicle', {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(vehicle),
      });
      if (res.ok) {
        const data = await res.json();
        return data.vehicle;
      }
    } catch (e) {
      console.warn('Failed to update vehicle:', e);
    }
    return null;
  }

  // ----------------------------------------------------
  // Shared Saved Places Sync
  // ----------------------------------------------------
  public async getSavedPlaces(): Promise<SavedPlaceEntity[]> {
    try {
      const res = await fetch('/api/places/saved', {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        return data.places || [];
      }
    } catch (e) {
      console.warn('Failed to fetch saved places:', e);
    }
    return [];
  }

  public async savePlace(place: Partial<SavedPlaceEntity>): Promise<SavedPlaceEntity | null> {
    try {
      const res = await fetch('/api/places/saved', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(place),
      });
      if (res.ok) {
        const data = await res.json();
        return data.place;
      }
    } catch (e) {
      console.warn('Failed to save place:', e);
    }
    return null;
  }

  public async deleteSavedPlace(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/places/saved/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch (e) {
      console.warn('Failed to delete saved place:', e);
      return false;
    }
  }

  // ----------------------------------------------------
  // Shared Trips & Hand-off Flow
  // ----------------------------------------------------
  public async createTrip(tripData: Partial<Trip>): Promise<Trip | null> {
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(tripData),
      });
      if (res.ok) {
        const data = await res.json();
        return data.trip;
      }
    } catch (e) {
      console.warn('Failed to create trip:', e);
    }
    return null;
  }

  public async dispatchTripToAndroid(tripId: string, targetDeviceId?: string): Promise<{ success: boolean; message: string; trip?: Trip }> {
    try {
      const res = await fetch(`/api/trips/${tripId}/dispatch`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ targetDeviceId }),
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await res.json();
      return { success: false, message: err.error || 'Failed to dispatch trip' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Dispatch error' };
    }
  }

  public async getActiveTrip(): Promise<Trip | null> {
    try {
      const res = await fetch('/api/trips/active', {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        return data.trip;
      }
    } catch (e) {
      console.warn('Failed to fetch active trip:', e);
    }
    return null;
  }

  // ----------------------------------------------------
  // Live Telemetry & Car Mirroring
  // ----------------------------------------------------
  public async getActiveTelemetry(): Promise<LiveNavigationTelemetry | null> {
    try {
      const res = await fetch('/api/navigation/telemetry/active', {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        return data.telemetry;
      }
    } catch (e) {
      console.warn('Failed to fetch active telemetry:', e);
    }
    return null;
  }

  public async sendTelemetry(telemetry: Partial<LiveNavigationTelemetry>): Promise<boolean> {
    try {
      const res = await fetch('/api/navigation/telemetry', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(telemetry),
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }
}

export const platformSync = new PlatformSyncService();
