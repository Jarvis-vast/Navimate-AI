import { VehicleProfile, RouteOption } from '../types/navigation';
import { computeSafeFuelMetrics, SafeFuelCalculation } from '../utils/fuelMath';

export interface FuelMetrics {
  litresRequired: number;
  estimatedCost: number;
  costPerKm: number;
  remainingRangeKm: number;
  tankPercentageNeeded: number;
  isRefuelNeeded: boolean;
  unitLabel?: string;
}

/**
 * Calculates estimated fuel/energy consumption and economics based on vehicle profile.
 * Employs unit-safe conversions with zero-guard and NaN protection.
 */
export function calculateFuelMetrics(
  distanceKm: number,
  vehicle: VehicleProfile
): FuelMetrics {
  const result: SafeFuelCalculation = computeSafeFuelMetrics({
    distanceKm,
    avgConsumption: vehicle?.avgConsumption || 7.5,
    consumptionUnit: vehicle?.consumptionUnit || 'L/100km',
    tankCapacity: vehicle?.tankCapacity || 45,
    capacityUnit: vehicle?.capacityUnit || 'litres',
    currentFuelLevelPercent: vehicle?.currentFuelLevel ?? 50,
    fuelPricePerUnit: vehicle?.fuelPricePerUnit ?? 98,
    fuelType: vehicle?.fuelType || 'petrol',
  });

  return {
    litresRequired: result.unitsRequired,
    estimatedCost: result.estimatedCost,
    costPerKm: result.costPerKm,
    remainingRangeKm: result.remainingRangeKm,
    tankPercentageNeeded: result.tankPercentageNeeded,
    isRefuelNeeded: result.isRefuelNeeded,
    unitLabel: result.unitLabel,
  };
}

/**
 * Compare two route options economically
 */
export function compareRouteEconomics(
  routeA: RouteOption,
  routeB: RouteOption
): {
  fuelDiffCost: number;
  timeDiffMinutes: number;
  cheaperRouteId: string;
  fasterRouteId: string;
} {
  const costA = Number.isFinite(routeA?.estimatedFuelCost) ? routeA.estimatedFuelCost : 0;
  const costB = Number.isFinite(routeB?.estimatedFuelCost) ? routeB.estimatedFuelCost : 0;
  const timeA = Number.isFinite(routeA?.durationMinutes) ? routeA.durationMinutes : 0;
  const timeB = Number.isFinite(routeB?.durationMinutes) ? routeB.durationMinutes : 0;

  const fuelDiffCost = costA - costB;
  const timeDiffMinutes = timeA - timeB;

  return {
    fuelDiffCost: Math.abs(fuelDiffCost),
    timeDiffMinutes: Math.abs(timeDiffMinutes),
    cheaperRouteId: costA <= costB ? routeA.id : routeB.id,
    fasterRouteId: timeA <= timeB ? routeA.id : routeB.id,
  };
}
