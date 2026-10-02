export type ConsumptionUnit = 'L/100km' | 'mpg_us' | 'mpg_uk' | 'km/L' | 'kWh/100km';
export type CapacityUnit = 'litres' | 'gallons' | 'kWh';

/**
 * Standardize any consumption metric to metric units:
 * - Internal standard: Litres per 100 km (or kWh/100km for electric vehicles)
 */
export function normalizeConsumptionToL100km(value: number, unit?: ConsumptionUnit): number {
  if (!Number.isFinite(value) || value <= 0) return 0;

  switch (unit) {
    case 'km/L':
      // 1 km/L = 100 / (km/L) L/100km
      return 100 / value;
    case 'mpg_us':
      // 1 US MPG = 235.214583 / MPG L/100km
      return 235.215 / value;
    case 'mpg_uk':
      // 1 UK MPG = 282.481 / MPG L/100km
      return 282.481 / value;
    case 'kWh/100km':
    case 'L/100km':
    default:
      return value;
  }
}

/**
 * Convert standard L/100km to target display unit
 */
export function convertFromStandardConsumption(valueL100km: number, targetUnit: ConsumptionUnit): number {
  if (!Number.isFinite(valueL100km) || valueL100km <= 0) return 0;

  switch (targetUnit) {
    case 'km/L':
      return Number((100 / valueL100km).toFixed(1));
    case 'mpg_us':
      return Number((235.215 / valueL100km).toFixed(1));
    case 'mpg_uk':
      return Number((282.481 / valueL100km).toFixed(1));
    case 'kWh/100km':
    case 'L/100km':
    default:
      return Number(valueL100km.toFixed(1));
  }
}

/**
 * Safe fuel calculation metrics
 */
export interface SafeFuelCalculation {
  unitsRequired: number; // Litres or kWh
  estimatedCost: number;
  costPerKm: number;
  remainingRangeKm: number;
  tankPercentageNeeded: number;
  isRefuelNeeded: boolean;
  unitLabel: string;
}

export function computeSafeFuelMetrics(params: {
  distanceKm: number;
  avgConsumption: number;
  consumptionUnit?: ConsumptionUnit;
  tankCapacity: number;
  capacityUnit?: CapacityUnit;
  currentFuelLevelPercent: number;
  fuelPricePerUnit: number;
  fuelType?: string;
}): SafeFuelCalculation {
  const {
    distanceKm = 0,
    avgConsumption = 7.5,
    consumptionUnit = 'L/100km',
    tankCapacity = 45,
    currentFuelLevelPercent = 50,
    fuelPricePerUnit = 98,
    fuelType = 'petrol',
  } = params;

  const isElectric = fuelType === 'electric';
  const unitLabel = isElectric ? 'kWh' : 'L';

  // Guard against invalid inputs
  const safeDistance = Math.max(0, Number.isFinite(distanceKm) ? distanceKm : 0);
  const normalizedConsumption = normalizeConsumptionToL100km(avgConsumption, consumptionUnit);
  const safeCapacity = Math.max(0.1, Number.isFinite(tankCapacity) ? tankCapacity : 45);
  const safeLevelPercent = Math.min(100, Math.max(0, Number.isFinite(currentFuelLevelPercent) ? currentFuelLevelPercent : 0));
  const safePrice = Math.max(0, Number.isFinite(fuelPricePerUnit) ? fuelPricePerUnit : 0);

  // 1. Units required (L or kWh)
  const unitsRequired = safeDistance > 0 && normalizedConsumption > 0
    ? Number(((safeDistance * normalizedConsumption) / 100).toFixed(2))
    : 0;

  // 2. Estimated cost
  const estimatedCost = Math.round(unitsRequired * safePrice);

  // 3. Cost per km
  const costPerKm = safeDistance > 0 && estimatedCost > 0
    ? Number((estimatedCost / safeDistance).toFixed(2))
    : 0;

  // 4. Current fuel available in tank/battery
  const currentUnitsAvailable = (safeCapacity * safeLevelPercent) / 100;

  // 5. Remaining range in km
  const remainingRangeKm = normalizedConsumption > 0
    ? Math.round((currentUnitsAvailable / normalizedConsumption) * 100)
    : 0;

  // 6. Tank percentage needed for this trip
  const tankPercentageNeeded = safeCapacity > 0
    ? Math.min(100, Math.round((unitsRequired / safeCapacity) * 100))
    : 0;

  // 7. Refuel required check (with 15% reserve buffer)
  const isRefuelNeeded = remainingRangeKm < safeDistance * 1.15;

  return {
    unitsRequired,
    estimatedCost,
    costPerKm,
    remainingRangeKm,
    tankPercentageNeeded,
    isRefuelNeeded,
    unitLabel,
  };
}
