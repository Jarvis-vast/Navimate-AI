import { describe, it, expect, vi } from 'vitest';
import { computeTripAnalytics, TripRecord } from '../services/tripHistory';
import { TrafficAlertMonitor } from '../services/trafficAlerts';

describe('Trip History Analytics & Firestore Models', () => {
  const sampleTrips: TripRecord[] = [
    {
      tripId: 'trip_1',
      userId: 'usr_test_1',
      originName: 'Point A',
      destinationName: 'Point B',
      distanceMeters: 50000, // 50 km
      durationSeconds: 3600, // 1 hr
      fuelConsumedLitres: 3.5,
      fuelCost: 350,
      averageSpeedKmh: 50,
      fuelType: 'PETROL',
      currency: '₹',
      status: 'COMPLETED',
      createdAt: '2026-10-01T08:00:00Z',
      completedAt: '2026-10-01T09:00:00Z',
      routeSummary: 'Route 1',
    },
    {
      tripId: 'trip_2',
      userId: 'usr_test_1',
      originName: 'Point B',
      destinationName: 'Point C',
      distanceMeters: 100000, // 100 km
      durationSeconds: 7200, // 2 hr
      fuelConsumedLitres: 6.5,
      fuelCost: 650,
      averageSpeedKmh: 50,
      fuelType: 'PETROL',
      currency: '₹',
      status: 'COMPLETED',
      createdAt: '2026-10-02T10:00:00Z',
      completedAt: '2026-10-02T12:00:00Z',
      routeSummary: 'Route 2',
    },
    {
      tripId: 'trip_cancelled',
      userId: 'usr_test_1',
      originName: 'Point C',
      destinationName: 'Point D',
      distanceMeters: 20000,
      durationSeconds: 1200,
      fuelConsumedLitres: 1.5,
      fuelCost: 150,
      averageSpeedKmh: 60,
      fuelType: 'PETROL',
      currency: '₹',
      status: 'CANCELLED',
      createdAt: '2026-10-02T14:00:00Z',
      completedAt: '2026-10-02T14:20:00Z',
      routeSummary: 'Cancelled Route',
    },
  ];

  it('correctly aggregates total distance, driving hours, fuel, and trip costs for completed trips', () => {
    const analytics = computeTripAnalytics(sampleTrips);

    // Cancelled trip should be excluded from completed analytics
    expect(analytics.totalTrips).toBe(2);
    expect(analytics.totalDistanceKm).toBe(150); // 50 + 100 km
    expect(analytics.totalDurationHours).toBe(3); // 1 + 2 hrs
    expect(analytics.totalFuelLitres).toBe(10); // 3.5 + 6.5 L
    expect(analytics.totalTripCost).toBe(1000); // 350 + 650
    // Average economy = (10 L * 100) / 150 km = 6.67 L/100km
    expect(analytics.averageFuelEconomyL100km).toBe(6.67);
  });

  it('handles empty trip history gracefully without division by zero', () => {
    const analytics = computeTripAnalytics([]);
    expect(analytics.totalTrips).toBe(0);
    expect(analytics.totalDistanceKm).toBe(0);
    expect(analytics.averageFuelEconomyL100km).toBe(0);
    expect(analytics.totalTripCost).toBe(0);
  });
});

describe('Real-Time Traffic Alerts & Voice Announcements', () => {
  it('triggers voice alert and visual alert on traffic incident detection', () => {
    const mockSpeak = vi.fn();
    const mockVoice: any = {
      speak: mockSpeak,
    };

    let alertedIncident: any = null;
    let incidentsList: any[] = [];

    const monitor = new TrafficAlertMonitor(
      mockVoice,
      (alert) => {
        alertedIncident = alert;
      },
      (incidents) => {
        incidentsList = incidents;
      }
    );

    // Trigger manual incident
    monitor.triggerManualIncident('accident');

    expect(alertedIncident).not.toBeNull();
    expect(alertedIncident.type).toBe('accident');
    expect(alertedIncident.title).toContain('Accident');
    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(mockSpeak.mock.calls[0][0]).toContain('Warning');
  });

  it('resets alerts and incidents cleanly', () => {
    const mockVoice: any = { speak: vi.fn() };
    let alertedIncident: any = { id: 'temp' };

    const monitor = new TrafficAlertMonitor(mockVoice, (alert) => {
      alertedIncident = alert;
    });

    monitor.reset();
    expect(alertedIncident).toBeNull();
  });
});
