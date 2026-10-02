import { describe, it, expect } from 'vitest';
import { computeSafeFuelMetrics, normalizeConsumptionToL100km } from '../utils/fuelMath';

describe('Fuel Mathematics & Safety Logic', () => {
  it('correctly calculates fuel required and remaining range', () => {
    const result = computeSafeFuelMetrics({
      distanceKm: 200,
      avgConsumption: 10, // 10 L/100km
      tankCapacity: 50,
      currentFuelLevelPercent: 50, // 25L in tank -> 250 km range
      fuelPricePerUnit: 100,
    });

    expect(result.unitsRequired).toBe(20);
    expect(result.estimatedCost).toBe(2000);
    expect(result.remainingRangeKm).toBe(250);
    expect(result.isRefuelNeeded).toBe(false); // 250km range > 200km trip
  });

  it('triggers refuel warning when trip exceeds estimated range', () => {
    const result = computeSafeFuelMetrics({
      distanceKm: 300,
      avgConsumption: 10,
      tankCapacity: 50,
      currentFuelLevelPercent: 20, // 10L in tank -> 100 km range
      fuelPricePerUnit: 100,
    });

    expect(result.unitsRequired).toBe(30);
    expect(result.remainingRangeKm).toBe(100);
    expect(result.isRefuelNeeded).toBe(true);
  });

  it('normalizes units correctly', () => {
    expect(normalizeConsumptionToL100km(10, 'km/L')).toBeCloseTo(10);
    expect(normalizeConsumptionToL100km(23.5215, 'mpg_us')).toBeCloseTo(10);
  });
});
