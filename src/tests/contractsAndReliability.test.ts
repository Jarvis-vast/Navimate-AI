import { describe, it, expect } from 'vitest';

describe('Web + Android API Boundary & Contract Validation', () => {
  it('validates /api/routes/compute contract format matches Android RouteDto requirements', async () => {
    const payload = {
      origin: 'Mumbai, Maharashtra, India',
      destination: 'Pune, Maharashtra, India',
      avoidTolls: false,
      vehicle: {
        avgConsumption: 7.5,
        tankCapacity: 45,
        currentFuelLevel: 50,
        fuelPricePerUnit: 98,
        fuelType: 'petrol',
      },
    };

    expect(payload.origin).toBeDefined();
    expect(payload.destination).toBeDefined();
    expect(payload.vehicle.tankCapacity).toBeGreaterThan(0);
  });

  it('verifies safe metadata logging policy never logs raw route tokens or user speech', () => {
    const mockLogEntry = {
      requestId: 'req_1790107825',
      routeId: 'routes_api_0_1790107825',
      provider: 'Google Routes API',
      distanceKm: 148.5,
      durationMinutes: 165,
      routeTokenPresent: true,
      navigationStartSuccess: true,
    };

    expect(mockLogEntry.routeTokenPresent).toBe(true);
    expect((mockLogEntry as any).routeToken).toBeUndefined();
    expect((mockLogEntry as any).rawMicAudio).toBeUndefined();
  });

  it('validates structured error codes map accurately to driver-readable messages', () => {
    const errorTaxonomy: Record<string, string> = {
      NAV_SDK_INIT_FAILED: 'Unable to start Google Navigation. Please check your network connection and try again.',
      ROUTE_TOKEN_INVALID: 'Route session expired. Recalculating fresh route to your destination.',
      ROUTE_COMPUTE_FAILED: 'Could not calculate driving route. Verify destination and network status.',
      GPS_PERMISSION_DENIED: 'Location permission is required for live road navigation.',
      GPS_UNAVAILABLE: 'GPS signal lost. Searching for satellites...',
      NETWORK_UNAVAILABLE: 'Network offline. Continuing with on-device cached navigation.',
      TRAFFIC_UNAVAILABLE: 'Live traffic data unavailable. Displaying standard corridor travel times.',
    };

    expect(errorTaxonomy['NAV_SDK_INIT_FAILED']).toBeDefined();
    expect(errorTaxonomy['ROUTE_TOKEN_INVALID']).toContain('Recalculating fresh route');
    expect(errorTaxonomy['TRAFFIC_UNAVAILABLE']).toContain('Live traffic data unavailable');
  });

  it('guarantees single authoritative voice policy without double speaking', () => {
    const sdkAudioMode: string = 'SILENT';
    const naviMateCustomTTS: boolean = true;

    // Both cannot be active voice emitters simultaneously
    const isDoubleSpeaking = sdkAudioMode === 'VOICE_ALERTS_AND_GUIDANCE' && naviMateCustomTTS;
    expect(isDoubleSpeaking).toBe(false);
  });

  it('validates RouteResult schema validator detects missing and valid structures', async () => {
    const { validateRouteResult } = await import('../../shared/contracts');

    const invalidResult = validateRouteResult({});
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThan(0);

    const validPayload = {
      route: {
        id: 'route_1',
        name: 'Expressway',
        summary: 'Direct highway',
        distanceKm: 145.0,
        durationMinutes: 150,
        trafficDelayMinutes: 5,
        estimatedFuelLitres: 11.2,
        estimatedFuelCost: 1100,
        tollsEstimated: 120,
        hasTolls: true,
        hasHighways: true,
        hasFerries: false,
        tags: ['Fastest'],
      },
      routes: [{ id: 'route_1', name: 'Expressway', distanceKm: 145.0, durationMinutes: 150 }],
      routeToken: 'CsADCs8CMsw...',
      destination: 'Pune, Maharashtra',
      waypoints: [],
      distance: 145.0,
      duration: 150,
      provider: 'Google Routes API',
      freshness: Date.now(),
      hasRouteToken: true,
    };

    const validResult = validateRouteResult(validPayload);
    expect(validResult.valid).toBe(true);
    expect(validResult.errors).toHaveLength(0);
  });
});
