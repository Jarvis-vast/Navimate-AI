import { Router, Request, Response } from 'express';
import {
  User,
  Device,
  PairingRequest,
  SharedVehicle,
  SavedPlaceEntity,
  Trip,
  LiveNavigationTelemetry,
  RealtimeEventType,
  RealtimeMessage,
} from '../src/types/platform.js';

export const platformRouter = Router();

// Single authoritative user identity
const DEFAULT_USER: User = {
  userId: 'usr_navimate_primary',
  email: 'driver@navimate.ai',
  name: 'Alex Mercer',
  avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=faces',
  createdAt: '2026-09-01T08:00:00.000Z',
};

// In-memory data store for the platform coordination layer
const devices = new Map<string, Device>();
const pairingRequests = new Map<string, PairingRequest>();
const vehicles = new Map<string, SharedVehicle>();
const savedPlaces = new Map<string, SavedPlaceEntity[]>();
const trips = new Map<string, Trip>();
let activeTelemetry: LiveNavigationTelemetry | null = null;

// SSE connected clients
interface SseClient {
  id: string;
  userId: string;
  res: Response;
}
const sseClients = new Set<SseClient>();

// Seed initial state for default user
function seedInitialData() {
  const userId = DEFAULT_USER.userId;

  // Initial Web Device
  devices.set('dev_web_primary', {
    deviceId: 'dev_web_primary',
    userId,
    platform: 'WEB',
    name: 'NaviMate Web Dashboard',
    appVersion: '1.2.0',
    lastSeenAt: new Date().toISOString(),
    capabilities: ['MAP_PLANNER', 'VOICE_ASSISTANT', 'CAR_MIRROR', 'POI_DISCOVERY'],
    status: 'ONLINE',
    batteryPercent: 100,
  });

  // Seed default vehicle
  vehicles.set(userId, {
    vehicleId: 'veh_creta_primary',
    userId,
    make: 'Hyundai',
    model: 'Creta SX(O)',
    fuelType: 'PETROL',
    tankCapacityLitres: 50,
    averageConsumption: 6.8,
    currentFuelLevel: 65,
    preferredFuelPrice: 98.5,
    isTelemetryConnected: true,
    updatedAt: new Date().toISOString(),
  });

  // Seed saved places
  savedPlaces.set(userId, [
    {
      id: 'place_home',
      userId,
      name: 'Home',
      address: 'Skyline Residency, Baner, Pune',
      lat: 18.559,
      lng: 73.7868,
      category: 'home',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'place_work',
      userId,
      name: 'Tech IT Campus',
      address: 'Cybercity Magarpatta, Hadapsar, Pune',
      lat: 18.513,
      lng: 73.931,
      category: 'work',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'place_petrol',
      userId,
      name: 'Expressway Fuel Plaza',
      address: 'Mumbai-Pune Expressway, Urse Toll',
      lat: 18.7289,
      lng: 73.619,
      category: 'petrol_station',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'place_family',
      userId,
      name: 'Family Residence',
      address: 'North Main Road, Koregaon Park, Pune',
      lat: 18.5362,
      lng: 73.894,
      category: 'family',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'place_hotel',
      userId,
      name: 'The Orchid Highway Hotel',
      address: 'Bangalore-Pune Highway, Balewadi',
      lat: 18.575,
      lng: 73.768,
      category: 'hotel',
      updatedAt: new Date().toISOString(),
    },
  ]);
}

seedInitialData();

// Broadcast event to connected SSE clients
export function broadcastRealtimeEvent(type: RealtimeEventType, payload: any, targetUserId?: string) {
  const userId = targetUserId || DEFAULT_USER.userId;
  const message: RealtimeMessage = {
    type,
    payload,
    timestamp: Date.now(),
  };

  const payloadString = `event: message\ndata: ${JSON.stringify(message)}\n\n`;

  for (const client of sseClients) {
    if (!targetUserId || client.userId === userId) {
      try {
        client.res.write(payloadString);
      } catch (err) {
        sseClients.delete(client);
      }
    }
  }
}

// Server-side user resolver: never trust client-supplied userId directly
function resolveUser(req: Request): User {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token && token !== 'demo_token') {
      let uid = '';
      let email = 'driver@navimate.ai';
      let name = 'NaviMate Driver';

      // Parse JWT payload safely if present
      if (token.includes('.')) {
        try {
          const parts = token.split('.');
          if (parts[1]) {
            const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
            if (decoded.user_id || decoded.sub || decoded.uid) {
              uid = decoded.user_id || decoded.sub || decoded.uid;
            }
            if (decoded.email) email = decoded.email;
            if (decoded.name) name = decoded.name;
          }
        } catch (e) {
          // ignore parsing error
        }
      }

      if (!uid) {
        const customUid = req.headers['x-user-id'] as string;
        uid = customUid || `usr_${token.slice(0, 16)}`;
      }

      const user: User = {
        userId: uid,
        email,
        name,
        avatarUrl: DEFAULT_USER.avatarUrl,
        createdAt: new Date().toISOString(),
      };

      // Ensure per-user vehicle exists
      if (!vehicles.has(uid)) {
        vehicles.set(uid, {
          vehicleId: `veh_${uid.slice(0, 8)}`,
          userId: uid,
          make: 'Hyundai',
          model: 'Creta SX(O)',
          fuelType: 'PETROL',
          tankCapacityLitres: 50,
          averageConsumption: 6.8,
          currentFuelLevel: 75,
          preferredFuelPrice: 98.5,
          isTelemetryConnected: true,
          updatedAt: new Date().toISOString(),
        });
      }

      return user;
    }
  }
  return DEFAULT_USER;
}

// Compute dynamic device status based on last seen timestamp (online if seen in last 90 seconds)
function computeDeviceStatus(device: Device): Device {
  const lastSeenMs = new Date(device.lastSeenAt).getTime();
  const isOnline = Date.now() - lastSeenMs < 90000;
  return {
    ...device,
    status: isOnline ? 'ONLINE' : 'OFFLINE',
  };
}

// ----------------------------------------------------
// 1. Identity & Auth
// ----------------------------------------------------
platformRouter.get('/auth/me', (req: Request, res: Response) => {
  const user = resolveUser(req);
  const userDevices = Array.from(devices.values())
    .filter((d) => d.userId === user.userId)
    .map(computeDeviceStatus);
  const vehicle = vehicles.get(user.userId) || null;

  res.json({
    user,
    devices: userDevices,
    vehicle,
  });
});

// ----------------------------------------------------
// 2. Device Registry & Heartbeat
// ----------------------------------------------------
platformRouter.post('/devices/register', (req: Request, res: Response) => {
  const user = resolveUser(req);
  const { deviceId, platform, name, appVersion, capabilities, batteryPercent } = req.body;

  if (!deviceId || !platform) {
    return res.status(400).json({ error: 'deviceId and platform are required' });
  }

  const existing = devices.get(deviceId);
  const updatedDevice: Device = {
    deviceId,
    userId: user.userId,
    platform: platform === 'ANDROID' ? 'ANDROID' : 'WEB',
    name: name || existing?.name || (platform === 'ANDROID' ? 'Android Navigation Unit' : 'Web Browser Client'),
    appVersion: appVersion || existing?.appVersion || '1.0.0',
    capabilities: capabilities || existing?.capabilities || ['NAVIGATION', 'VOICE'],
    lastSeenAt: new Date().toISOString(),
    status: 'ONLINE',
    batteryPercent: typeof batteryPercent === 'number' ? batteryPercent : existing?.batteryPercent,
  };

  devices.set(deviceId, updatedDevice);
  broadcastRealtimeEvent('DEVICE_STATUS', updatedDevice, user.userId);

  res.json({ success: true, device: updatedDevice });
});

platformRouter.get('/devices', (req: Request, res: Response) => {
  const user = resolveUser(req);
  const list = Array.from(devices.values())
    .filter((d) => d.userId === user.userId)
    .map(computeDeviceStatus);

  res.json({ devices: list });
});

platformRouter.delete('/devices/:id', (req: Request, res: Response) => {
  const user = resolveUser(req);
  const deviceId = req.params.id;

  const device = devices.get(deviceId);
  if (!device || device.userId !== user.userId) {
    return res.status(404).json({ error: 'Device not found' });
  }

  devices.delete(deviceId);
  broadcastRealtimeEvent('DEVICE_UNPAIRED', { deviceId }, user.userId);

  res.json({ success: true, message: `Device ${deviceId} unlinked` });
});

platformRouter.post('/devices/heartbeat', (req: Request, res: Response) => {
  const user = resolveUser(req);
  const { deviceId, batteryPercent } = req.body;

  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId required' });
  }

  const device = devices.get(deviceId);
  if (device && device.userId === user.userId) {
    device.lastSeenAt = new Date().toISOString();
    device.status = 'ONLINE';
    if (typeof batteryPercent === 'number') {
      device.batteryPercent = batteryPercent;
    }
    devices.set(deviceId, device);
    return res.json({ success: true, status: 'ONLINE' });
  }

  res.status(404).json({ error: 'Device not registered' });
});

// ----------------------------------------------------
// 3. Secure Web <-> Android Device Pairing
// ----------------------------------------------------
platformRouter.post('/devices/pair/create', (req: Request, res: Response) => {
  const user = resolveUser(req);
  const { deviceId } = req.body;

  // Generate 6-digit numeric pairing code
  const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5-minute TTL

  const pairingRequest: PairingRequest = {
    pairingCode,
    qrPayload: JSON.stringify({
      type: 'NAVIMATE_PAIR',
      code: pairingCode,
      user: user.userId,
      exp: expiresAt,
    }),
    userId: user.userId,
    createdDeviceId: deviceId || 'web_client',
    expiresAt,
    status: 'PENDING',
  };

  pairingRequests.set(pairingCode, pairingRequest);

  res.json({
    pairingCode,
    qrPayload: pairingRequest.qrPayload,
    expiresAt,
    ttlSeconds: 300,
  });
});

platformRouter.post('/devices/pair/confirm', (req: Request, res: Response) => {
  const user = resolveUser(req);
  const { pairingCode, deviceId, deviceName, appVersion, platform = 'ANDROID' } = req.body;

  if (!pairingCode) {
    return res.status(400).json({ error: 'pairingCode is required' });
  }

  const request = pairingRequests.get(pairingCode.trim());
  if (!request) {
    return res.status(404).json({ error: 'Invalid pairing code' });
  }

  if (request.status !== 'PENDING') {
    return res.status(400).json({ error: 'Pairing code already used' });
  }

  if (Date.now() > request.expiresAt) {
    request.status = 'EXPIRED';
    return res.status(410).json({ error: 'Pairing code expired' });
  }

  // Consume the code
  request.status = 'CONSUMED';

  // Register the new linked device
  const targetDeviceId = deviceId || `dev_android_${Date.now().toString(36)}`;
  const pairedDevice: Device = {
    deviceId: targetDeviceId,
    userId: request.userId,
    platform: platform === 'WEB' ? 'WEB' : 'ANDROID',
    name: deviceName || 'Android Auto Navigation Device',
    appVersion: appVersion || '2.4.0',
    capabilities: ['NAVIGATION_SDK_7_6', 'VOICE_ASSISTANT', 'ROUTE_TOKEN', 'CAR_APP'],
    lastSeenAt: new Date().toISOString(),
    status: 'ONLINE',
    batteryPercent: 88,
  };

  devices.set(targetDeviceId, pairedDevice);

  // Notify Web client in real time
  broadcastRealtimeEvent('DEVICE_PAIRED', pairedDevice, request.userId);

  res.json({
    success: true,
    device: pairedDevice,
    user,
    message: 'Device successfully paired to NaviMate AI platform',
  });
});

// ----------------------------------------------------
// 4. Shared Vehicle Synchronization
// ----------------------------------------------------
platformRouter.get('/vehicle', (req: Request, res: Response) => {
  const user = resolveUser(req);
  const vehicle = vehicles.get(user.userId);
  if (!vehicle) {
    return res.status(404).json({ error: 'No vehicle profile configured' });
  }
  res.json({ vehicle });
});

platformRouter.put('/vehicle', (req: Request, res: Response) => {
  const user = resolveUser(req);
  const updates = req.body;

  const current = vehicles.get(user.userId) || {
    vehicleId: `veh_${Date.now()}`,
    userId: user.userId,
    make: 'Hyundai',
    model: 'Creta',
    fuelType: 'PETROL',
    tankCapacityLitres: 50,
    averageConsumption: 7.0,
    currentFuelLevel: 60,
    preferredFuelPrice: 98,
    isTelemetryConnected: false,
    updatedAt: new Date().toISOString(),
  };

  const updatedVehicle: SharedVehicle = {
    ...current,
    ...updates,
    userId: user.userId, // Never allow cross-user tampering
    updatedAt: new Date().toISOString(),
  };

  vehicles.set(user.userId, updatedVehicle);
  broadcastRealtimeEvent('VEHICLE_UPDATED', updatedVehicle, user.userId);

  res.json({ success: true, vehicle: updatedVehicle });
});

// ----------------------------------------------------
// 5. Shared Saved Places Synchronization
// ----------------------------------------------------
platformRouter.get('/places/saved', (req: Request, res: Response) => {
  const user = resolveUser(req);
  const list = savedPlaces.get(user.userId) || [];
  res.json({ places: list });
});

platformRouter.post('/places/saved', (req: Request, res: Response) => {
  const user = resolveUser(req);
  const { id, name, address, lat, lng, category } = req.body;

  if (!name || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'Name, lat, and lng are required' });
  }

  const userPlaces = savedPlaces.get(user.userId) || [];
  const placeId = id || `place_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const newPlace: SavedPlaceEntity = {
    id: placeId,
    userId: user.userId,
    name,
    address: address || '',
    lat: Number(lat),
    lng: Number(lng),
    category: category || 'favorite',
    updatedAt: new Date().toISOString(),
  };

  // Replace if exists, else append
  const idx = userPlaces.findIndex((p) => p.id === placeId);
  if (idx >= 0) {
    userPlaces[idx] = newPlace;
  } else {
    userPlaces.push(newPlace);
  }

  savedPlaces.set(user.userId, userPlaces);
  broadcastRealtimeEvent('SAVED_PLACES_UPDATED', userPlaces, user.userId);

  res.json({ success: true, place: newPlace, places: userPlaces });
});

platformRouter.delete('/places/saved/:id', (req: Request, res: Response) => {
  const user = resolveUser(req);
  const placeId = req.params.id;

  const userPlaces = savedPlaces.get(user.userId) || [];
  const filtered = userPlaces.filter((p) => p.id !== placeId);

  savedPlaces.set(user.userId, filtered);
  broadcastRealtimeEvent('SAVED_PLACES_UPDATED', filtered, user.userId);

  res.json({ success: true, message: `Place ${placeId} removed`, places: filtered });
});

// ----------------------------------------------------
// 6. Shared Trips & Hand-off Flow (Web -> Android)
// ----------------------------------------------------
platformRouter.get('/trips', (req: Request, res: Response) => {
  const user = resolveUser(req);
  const userTrips = Array.from(trips.values())
    .filter((t) => t.userId === user.userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({ trips: userTrips });
});

platformRouter.get('/trips/active', (req: Request, res: Response) => {
  const user = resolveUser(req);
  const activeTrip = Array.from(trips.values()).find(
    (t) => t.userId === user.userId && (t.status === 'ACTIVE' || t.status === 'PLANNED')
  );

  res.json({ trip: activeTrip || null });
});

platformRouter.post('/trips', (req: Request, res: Response) => {
  const user = resolveUser(req);
  const {
    origin,
    destination,
    waypoints = [],
    selectedRouteId,
    routeToken,
    estimatedDistanceMeters,
    estimatedDurationSeconds,
    estimatedFuelLitres,
    estimatedFuelCost,
  } = req.body;

  if (!origin || !destination) {
    return res.status(400).json({ error: 'Origin and destination are required' });
  }

  const tripId = `trip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newTrip: Trip = {
    tripId,
    userId: user.userId,
    origin,
    destination,
    waypoints,
    selectedRouteId,
    routeToken: routeToken || null,
    status: 'PLANNED',
    estimatedDistanceMeters,
    estimatedDurationSeconds,
    estimatedFuelLitres,
    estimatedFuelCost,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  trips.set(tripId, newTrip);
  broadcastRealtimeEvent('TRIP_UPDATED', newTrip, user.userId);

  res.json({ success: true, trip: newTrip });
});

platformRouter.post('/trips/:id/dispatch', (req: Request, res: Response) => {
  const user = resolveUser(req);
  const tripId = req.params.id;
  const { targetDeviceId } = req.body;

  const trip = trips.get(tripId);
  if (!trip || trip.userId !== user.userId) {
    return res.status(404).json({ error: 'Trip not found' });
  }

  // Find target Android device if not specified
  let deviceId = targetDeviceId;
  if (!deviceId) {
    const androidDevice = Array.from(devices.values()).find(
      (d) => d.userId === user.userId && d.platform === 'ANDROID' && d.status === 'ONLINE'
    ) || Array.from(devices.values()).find(
      (d) => d.userId === user.userId && d.platform === 'ANDROID'
    );
    deviceId = androidDevice?.deviceId || 'dev_android_vehicle';
  }

  trip.status = 'ACTIVE';
  trip.dispatchedToDeviceId = deviceId;
  trip.dispatchedAt = new Date().toISOString();
  trip.startedAt = new Date().toISOString();
  trip.updatedAt = new Date().toISOString();

  trips.set(tripId, trip);

  // Broadcast dispatch event to Android client and all listeners
  broadcastRealtimeEvent('TRIP_DISPATCHED', { trip, targetDeviceId: deviceId }, user.userId);

  res.json({
    success: true,
    message: `Trip dispatched to Android device ${deviceId}`,
    trip,
  });
});

platformRouter.patch('/trips/:id', (req: Request, res: Response) => {
  const user = resolveUser(req);
  const tripId = req.params.id;
  const updates = req.body;

  const trip = trips.get(tripId);
  if (!trip || trip.userId !== user.userId) {
    return res.status(404).json({ error: 'Trip not found' });
  }

  const updatedTrip: Trip = {
    ...trip,
    ...updates,
    tripId,
    userId: user.userId,
    updatedAt: new Date().toISOString(),
  };

  if (updates.status === 'COMPLETED') {
    updatedTrip.completedAt = new Date().toISOString();
  }

  trips.set(tripId, updatedTrip);
  broadcastRealtimeEvent('TRIP_UPDATED', updatedTrip, user.userId);

  res.json({ success: true, trip: updatedTrip });
});

// ----------------------------------------------------
// 7. Live Telemetry Mirroring (Android -> Backend -> Web)
// ----------------------------------------------------
platformRouter.post('/navigation/telemetry', (req: Request, res: Response) => {
  const user = resolveUser(req);
  const telemetryData: LiveNavigationTelemetry = {
    ...req.body,
    updatedAt: Date.now(),
  };

  activeTelemetry = telemetryData;

  // Broadcast to Web dashboard for real-time car mirroring
  broadcastRealtimeEvent('NAVIGATION_TELEMETRY', telemetryData, user.userId);

  res.json({ success: true });
});

platformRouter.get('/navigation/telemetry/active', (req: Request, res: Response) => {
  res.json({ telemetry: activeTelemetry });
});

platformRouter.delete('/navigation/telemetry/active', (req: Request, res: Response) => {
  activeTelemetry = null;
  broadcastRealtimeEvent('NAVIGATION_TELEMETRY', null, resolveUser(req).userId);
  res.json({ success: true });
});

// ----------------------------------------------------
// 7.5. Mock Speed Limit Telemetry API
// ----------------------------------------------------
platformRouter.get('/speed-limit', (req: Request, res: Response) => {
  const roadName = String(req.query.roadName || '').trim();
  const lat = Number(req.query.lat) || 18.5204;
  const lng = Number(req.query.lng) || 73.8567;
  const lowerRoad = roadName.toLowerCase();

  let speedLimitKmh = 50;
  let roadType = 'urban';
  let zoneDescription = 'Urban Commercial Sector';
  let bufferToleranceKmh = 3;
  let schoolZone = false;

  if (lowerRoad.includes('expressway') || lowerRoad.includes('tollway') || lowerRoad.includes('freeway')) {
    speedLimitKmh = 100;
    roadType = 'expressway';
    zoneDescription = 'National Access-Controlled Expressway';
    bufferToleranceKmh = 5;
  } else if (lowerRoad.includes('highway') || lowerRoad.includes('nh-') || lowerRoad.includes('bypass') || lowerRoad.includes('ring')) {
    speedLimitKmh = 80;
    roadType = 'highway';
    zoneDescription = 'State / National Highway Corridor';
    bufferToleranceKmh = 4;
  } else if (lowerRoad.includes('avenue') || lowerRoad.includes('boulevard') || lowerRoad.includes('flyover') || lowerRoad.includes('arterial')) {
    speedLimitKmh = 60;
    roadType = 'arterial';
    zoneDescription = 'Multi-lane City Arterial';
    bufferToleranceKmh = 3;
  } else if (lowerRoad.includes('school') || lowerRoad.includes('hospital') || lowerRoad.includes('residential') || lowerRoad.includes('society')) {
    speedLimitKmh = 30;
    roadType = 'school_zone';
    zoneDescription = 'Vulnerable Pedestrian & School Safety Zone';
    bufferToleranceKmh = 2;
    schoolZone = true;
  }

  res.json({
    speedLimitKmh,
    roadName: roadName || 'Sector Road Link',
    roadType,
    unit: 'km/h',
    source: 'Smart Corridor Municipal Telemetry API (Mock)',
    bufferToleranceKmh,
    schoolZone,
    zoneDescription,
    confidence: 0.96,
    lat,
    lng,
    timestamp: Date.now(),
  });
});

// ----------------------------------------------------
// 8. Server-Sent Events (SSE) Real-time Stream
// ----------------------------------------------------
platformRouter.get('/realtime/stream', (req: Request, res: Response) => {
  const user = resolveUser(req);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const clientObj: SseClient = { id: clientId, userId: user.userId, res };
  sseClients.add(clientObj);

  // Send initial welcome state
  const initialPayload: RealtimeMessage = {
    type: 'CONNECTED',
    payload: {
      userId: user.userId,
      devices: Array.from(devices.values())
        .filter((d) => d.userId === user.userId)
        .map(computeDeviceStatus),
      vehicle: vehicles.get(user.userId),
      activeTelemetry,
      activeTrip: Array.from(trips.values()).find(
        (t) => t.userId === user.userId && t.status === 'ACTIVE'
      ) || null,
    },
    timestamp: Date.now(),
  };

  res.write(`event: message\ndata: ${JSON.stringify(initialPayload)}\n\n`);

  // Heartbeat ping every 15 seconds to keep connection alive through proxies
  const interval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (e) {
      clearInterval(interval);
      sseClients.delete(clientObj);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(interval);
    sseClients.delete(clientObj);
  });
});
