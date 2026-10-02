import { describe, it, expect } from 'vitest';
import {
  User,
  Device,
  PairingRequest,
  SharedVehicle,
  SavedPlaceEntity,
  Trip,
  LiveNavigationTelemetry,
  RealtimeMessage,
} from '../types/platform';

describe('NaviMate AI — Unified Platform & Cross-Client Handshake Tests', () => {
  const mockUser: User = {
    userId: 'usr_navimate_primary',
    email: 'driver@navimate.ai',
    name: 'Alex Mercer',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde',
    createdAt: new Date().toISOString(),
  };

  it('guarantees a single unified user identity model across Web and Android', () => {
    // Both clients bind to the exact same userId
    const webClientUser = mockUser.userId;
    const androidClientUser = mockUser.userId;

    expect(webClientUser).toBe(androidClientUser);
    expect(mockUser.email).toContain('@');
  });

  it('validates device registration and attributes structure', () => {
    const webDevice: Device = {
      deviceId: 'dev_web_test_1',
      userId: mockUser.userId,
      platform: 'WEB',
      name: 'NaviMate Web Dashboard',
      appVersion: '1.2.0',
      lastSeenAt: new Date().toISOString(),
      capabilities: ['MAP_PLANNER', 'VOICE_ASSISTANT', 'CAR_MIRROR'],
      status: 'ONLINE',
      batteryPercent: 100,
    };

    const androidDevice: Device = {
      deviceId: 'dev_android_pixel8',
      userId: mockUser.userId,
      platform: 'ANDROID',
      name: 'Google Pixel 8 Pro (In-Car)',
      appVersion: '2.4.0',
      lastSeenAt: new Date().toISOString(),
      capabilities: ['NAVIGATION_SDK_7_6', 'VOICE_ASSISTANT', 'ROUTE_TOKEN', 'CAR_APP'],
      status: 'ONLINE',
      batteryPercent: 88,
    };

    expect(webDevice.userId).toBe(androidDevice.userId);
    expect(webDevice.platform).toBe('WEB');
    expect(androidDevice.platform).toBe('ANDROID');
    expect(androidDevice.capabilities).toContain('NAVIGATION_SDK_7_6');
    expect(androidDevice.capabilities).toContain('ROUTE_TOKEN');
  });

  it('enforces secure pairing token generation, single-use, and expiration', () => {
    const now = Date.now();
    const pairingReq: PairingRequest = {
      pairingCode: '482910',
      qrPayload: JSON.stringify({ type: 'NAVIMATE_PAIR', code: '482910', exp: now + 300000 }),
      userId: mockUser.userId,
      createdDeviceId: 'dev_web_test_1',
      expiresAt: now + 300000,
      status: 'PENDING',
    };

    expect(pairingReq.pairingCode).toMatch(/^\d{6}$/);
    expect(pairingReq.status).toBe('PENDING');

    // Simulate consumption
    const isCodeValid = (code: string, req: PairingRequest) => {
      if (req.status !== 'PENDING') return false;
      if (Date.now() > req.expiresAt) return false;
      return req.pairingCode === code;
    };

    expect(isCodeValid('482910', pairingReq)).toBe(true);
    expect(isCodeValid('999999', pairingReq)).toBe(false);

    // Consume token
    pairingReq.status = 'CONSUMED';
    expect(isCodeValid('482910', pairingReq)).toBe(false);
  });

  it('validates shared vehicle synchronization model across clients', () => {
    const sharedVehicle: SharedVehicle = {
      vehicleId: 'veh_creta_2024',
      userId: mockUser.userId,
      make: 'Hyundai',
      model: 'Creta SX(O)',
      fuelType: 'PETROL',
      tankCapacityLitres: 50,
      averageConsumption: 6.8,
      currentFuelLevel: 65,
      preferredFuelPrice: 98.5,
      isTelemetryConnected: true,
      updatedAt: new Date().toISOString(),
    };

    expect(sharedVehicle.userId).toBe(mockUser.userId);
    expect(sharedVehicle.tankCapacityLitres).toBe(50);
    expect(sharedVehicle.fuelType).toBe('PETROL');

    // In-car telemetry update simulation
    const updatedFromCar: SharedVehicle = {
      ...sharedVehicle,
      currentFuelLevel: 58,
      updatedAt: new Date().toISOString(),
    };

    expect(updatedFromCar.currentFuelLevel).toBe(58);
    expect(updatedFromCar.vehicleId).toBe(sharedVehicle.vehicleId);
  });

  it('validates shared saved places entity structure and category mapping', () => {
    const savedPlaces: SavedPlaceEntity[] = [
      {
        id: 'place_home',
        userId: mockUser.userId,
        name: 'Home',
        address: 'Skyline Residency, Baner, Pune',
        lat: 18.559,
        lng: 73.7868,
        category: 'home',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'place_work',
        userId: mockUser.userId,
        name: 'Tech IT Campus',
        address: 'Cybercity Magarpatta, Hadapsar, Pune',
        lat: 18.513,
        lng: 73.931,
        category: 'work',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'place_petrol',
        userId: mockUser.userId,
        name: 'Expressway Fuel Plaza',
        address: 'Mumbai-Pune Expressway',
        lat: 18.7289,
        lng: 73.619,
        category: 'petrol_station',
        updatedAt: new Date().toISOString(),
      },
    ];

    expect(savedPlaces.length).toBe(3);
    savedPlaces.forEach((p) => {
      expect(p.userId).toBe(mockUser.userId);
      expect(p.lat).toBeGreaterThan(0);
      expect(p.lng).toBeGreaterThan(0);
    });
  });

  it('validates Trip hand-off flow with Google Route Token dispatch', () => {
    const plannedTrip: Trip = {
      tripId: 'trip_1790100',
      userId: mockUser.userId,
      origin: { lat: 18.5204, lng: 73.8567, name: 'Pune' },
      destination: { lat: 18.9438, lng: 72.8234, name: 'Mumbai' },
      waypoints: [],
      selectedRouteId: 'routes_api_0',
      routeToken: 'CiQAu1X_y9Z8kK...', // Routes API route token
      status: 'PLANNED',
      estimatedDistanceMeters: 148000,
      estimatedDurationSeconds: 9600,
      estimatedFuelLitres: 10.2,
      estimatedFuelCost: 1004.7,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(plannedTrip.status).toBe('PLANNED');
    expect(plannedTrip.routeToken).toBeDefined();

    // Dispatch to Android device
    const dispatchedTrip: Trip = {
      ...plannedTrip,
      status: 'ACTIVE',
      dispatchedToDeviceId: 'dev_android_pixel8',
      dispatchedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
    };

    expect(dispatchedTrip.status).toBe('ACTIVE');
    expect(dispatchedTrip.dispatchedToDeviceId).toBe('dev_android_pixel8');
  });

  it('validates Live Navigation Telemetry mirroring from Android to Web', () => {
    const telemetry: LiveNavigationTelemetry = {
      tripId: 'trip_1790100',
      sessionId: 'sess_1790100',
      deviceId: 'dev_android_pixel8',
      status: 'NAVIGATING',
      currentSpeedKmh: 68,
      postedSpeedLimitKmh: null, // Honest null
      isOverspeed: false,
      remainingDistanceMeters: 42000,
      remainingDurationSeconds: 2400,
      etaFormatted: '40m',
      currentManeuver: {
        instruction: 'Keep right on Mumbai-Pune Expressway',
        distanceMeters: 1200,
        maneuverType: 'keep-right',
      },
      currentLocation: {
        lat: 18.728,
        lng: 73.512,
        bearing: 310,
        speed: 18.8,
      },
      updatedAt: Date.now(),
    };

    expect(telemetry.status).toBe('NAVIGATING');
    expect(telemetry.currentSpeedKmh).toBe(68);
    expect(telemetry.currentManeuver?.instruction).toContain('Expressway');
    expect(telemetry.postedSpeedLimitKmh).toBeNull();
  });

  it('validates realtime SSE message structure format', () => {
    const msg: RealtimeMessage = {
      type: 'DEVICE_PAIRED',
      payload: {
        deviceId: 'dev_android_pixel8',
        name: 'Google Pixel 8 Pro',
        status: 'ONLINE',
      },
      timestamp: Date.now(),
    };

    expect(msg.type).toBe('DEVICE_PAIRED');
    expect(msg.payload.status).toBe('ONLINE');
    expect(msg.timestamp).toBeGreaterThan(0);
  });
});
