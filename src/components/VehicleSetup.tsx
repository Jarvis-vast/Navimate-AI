import React, { useState } from 'react';
import { VehicleProfile } from '../types/navigation';
import {
  Car,
  Fuel,
  Zap,
  Gauge,
  DollarSign,
  CheckCircle2,
  X,
  Sparkles,
  Info,
  Settings,
} from 'lucide-react';

interface VehicleSetupProps {
  initialVehicle: VehicleProfile;
  onSave: (updatedVehicle: VehicleProfile) => void;
  onClose: () => void;
}

export const VehicleSetup: React.FC<VehicleSetupProps> = ({
  initialVehicle,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState(initialVehicle.name || 'My Vehicle');
  const [fuelType, setFuelType] = useState<VehicleProfile['fuelType']>(initialVehicle.fuelType || 'petrol');
  
  // Capacity and units
  const [capacityUnit, setCapacityUnit] = useState<'litres' | 'gallons' | 'kWh'>(
    initialVehicle.capacityUnit || (initialVehicle.fuelType === 'electric' ? 'kWh' : 'litres')
  );
  const [tankCapacity, setTankCapacity] = useState<number>(initialVehicle.tankCapacity || 50);

  // Consumption and units
  const [consumptionUnit, setConsumptionUnit] = useState<'L/100km' | 'mpg_us' | 'mpg_uk' | 'km/L' | 'kWh/100km'>(
    initialVehicle.consumptionUnit || (initialVehicle.fuelType === 'electric' ? 'kWh/100km' : 'L/100km')
  );
  const [avgConsumption, setAvgConsumption] = useState<number>(initialVehicle.avgConsumption || 6.8);

  // Current level (%)
  const [currentFuelLevel, setCurrentFuelLevel] = useState<number>(initialVehicle.currentFuelLevel ?? 70);

  // Price & Currency
  const [fuelPricePerUnit, setFuelPricePerUnit] = useState<number>(initialVehicle.fuelPricePerUnit || 98.5);
  const [currency, setCurrency] = useState<string>(initialVehicle.currency || '₹');

  // Convert normalized consumption to standard L/100km or kWh/100km for calculations
  const normalizedConsumptionL100km = React.useMemo(() => {
    if (consumptionUnit === 'L/100km' || consumptionUnit === 'kWh/100km') {
      return avgConsumption;
    }
    if (consumptionUnit === 'km/L') {
      return avgConsumption > 0 ? Number((100 / avgConsumption).toFixed(2)) : 0;
    }
    if (consumptionUnit === 'mpg_us') {
      return avgConsumption > 0 ? Number((235.215 / avgConsumption).toFixed(2)) : 0;
    }
    if (consumptionUnit === 'mpg_uk') {
      return avgConsumption > 0 ? Number((282.481 / avgConsumption).toFixed(2)) : 0;
    }
    return avgConsumption;
  }, [avgConsumption, consumptionUnit]);

  // Convert tank capacity to liters if gallons selected
  const normalizedCapacityLitres = React.useMemo(() => {
    if (capacityUnit === 'gallons') {
      return Number((tankCapacity * 3.78541).toFixed(1));
    }
    return tankCapacity;
  }, [tankCapacity, capacityUnit]);

  // Derived economic preview
  const estimatedFullRangeKm = React.useMemo(() => {
    if (normalizedConsumptionL100km <= 0) return 0;
    return Math.round((normalizedCapacityLitres / normalizedConsumptionL100km) * 100);
  }, [normalizedCapacityLitres, normalizedConsumptionL100km]);

  const currentRangeKm = React.useMemo(() => {
    return Math.round((estimatedFullRangeKm * currentFuelLevel) / 100);
  }, [estimatedFullRangeKm, currentFuelLevel]);

  const costPer100Km = React.useMemo(() => {
    return Math.round(normalizedConsumptionL100km * fuelPricePerUnit);
  }, [normalizedConsumptionL100km, fuelPricePerUnit]);

  // Presets handler
  const applyPreset = (preset: {
    name: string;
    fuelType: VehicleProfile['fuelType'];
    capacity: number;
    capUnit: 'litres' | 'gallons' | 'kWh';
    consumption: number;
    consUnit: 'L/100km' | 'mpg_us' | 'km/L' | 'kWh/100km';
    price: number;
  }) => {
    setName(preset.name);
    setFuelType(preset.fuelType);
    setTankCapacity(preset.capacity);
    setCapacityUnit(preset.capUnit);
    setAvgConsumption(preset.consumption);
    setConsumptionUnit(preset.consUnit);
    setFuelPricePerUnit(preset.price);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const updated: VehicleProfile = {
      ...initialVehicle,
      name: name.trim() || 'My Vehicle',
      fuelType,
      tankCapacity: Number(tankCapacity) || 50,
      capacityUnit,
      avgConsumption: normalizedConsumptionL100km,
      consumptionUnit,
      currentFuelLevel: Math.min(100, Math.max(0, Number(currentFuelLevel))),
      fuelPricePerUnit: Number(fuelPricePerUnit) || 98.5,
      currency: currency.trim() || '₹',
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Vehicle Profile Setup
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Fuel Intelligence
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Configure fuel specifications for real-time trip economics & consumption modeling
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto flex flex-col gap-5 text-slate-200">
          {/* Quick Presets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Quick Vehicle Presets
              </span>
              <span className="text-[11px] text-slate-500">Tap to autofill specs</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() =>
                  applyPreset({
                    name: 'Petrol Hatchback',
                    fuelType: 'petrol',
                    capacity: 42,
                    capUnit: 'litres',
                    consumption: 5.8,
                    consUnit: 'L/100km',
                    price: 98.5,
                  })
                }
                className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-left transition flex flex-col"
              >
                <span className="text-xs font-bold text-white">Petrol Compact</span>
                <span className="text-[10px] text-slate-400">42L · 5.8 L/100km</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  applyPreset({
                    name: 'Diesel Mid-SUV',
                    fuelType: 'diesel',
                    capacity: 55,
                    capUnit: 'litres',
                    consumption: 6.4,
                    consUnit: 'L/100km',
                    price: 89.2,
                  })
                }
                className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-left transition flex flex-col"
              >
                <span className="text-xs font-bold text-white">Diesel SUV</span>
                <span className="text-[10px] text-slate-400">55L · 6.4 L/100km</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  applyPreset({
                    name: 'Hybrid Sedan',
                    fuelType: 'hybrid',
                    capacity: 45,
                    capUnit: 'litres',
                    consumption: 4.1,
                    consUnit: 'L/100km',
                    price: 98.5,
                  })
                }
                className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-left transition flex flex-col"
              >
                <span className="text-xs font-bold text-white">Hybrid Car</span>
                <span className="text-[10px] text-slate-400">45L · 4.1 L/100km</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  applyPreset({
                    name: 'Electric EV',
                    fuelType: 'electric',
                    capacity: 65,
                    capUnit: 'kWh',
                    consumption: 16.2,
                    consUnit: 'kWh/100km',
                    price: 12.0,
                  })
                }
                className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-left transition flex flex-col"
              >
                <span className="text-xs font-bold text-white">Electric (EV)</span>
                <span className="text-[10px] text-slate-400">65 kWh · 16.2 kWh</span>
              </button>
            </div>
          </div>

          {/* Vehicle Name & Fuel Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Vehicle Name / Model
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Hyundai Creta 1.5L"
                required
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Fuel / Energy Type
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {(['petrol', 'diesel', 'electric', 'hybrid', 'cng'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setFuelType(type);
                      if (type === 'electric') {
                        setCapacityUnit('kWh');
                        setConsumptionUnit('kWh/100km');
                      } else if (capacityUnit === 'kWh') {
                        setCapacityUnit('litres');
                        setConsumptionUnit('L/100km');
                      }
                    }}
                    className={`py-2 px-1 rounded-xl text-xs font-bold capitalize transition border text-center ${
                      fuelType === type
                        ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/30'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {type === 'petrol' ? 'Gasoline' : type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tank Capacity & Unit */}
          <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Fuel className="w-3.5 h-3.5 text-blue-400" />
                  Tank / Battery Capacity
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Total maximum volume or battery size
                </p>
              </div>

              {/* Unit Switcher */}
              <div className="flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700">
                {fuelType === 'electric' ? (
                  <button
                    type="button"
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-600 text-white"
                  >
                    kWh
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setCapacityUnit('litres')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                        capacityUnit === 'litres'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Liters (L)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCapacityUnit('gallons')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                        capacityUnit === 'gallons'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Gallons (gal)
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.5"
                min="5"
                max="250"
                value={tankCapacity}
                onChange={(e) => setTankCapacity(Number(e.target.value))}
                className="w-32 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-blue-500 tabular-nums"
              />
              <span className="text-xs text-slate-300">
                {capacityUnit === 'litres' ? 'Liters' : capacityUnit === 'gallons' ? 'US Gallons' : 'Kilowatt-hours (kWh)'}
              </span>
              {capacityUnit === 'gallons' && (
                <span className="text-[11px] text-slate-500">
                  (≈ {normalizedCapacityLitres} L)
                </span>
              )}
            </div>
          </div>

          {/* Average Fuel Consumption & Unit */}
          <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                  Average Fuel / Energy Consumption
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Real-world combined driving fuel consumption
                </p>
              </div>

              {/* Unit Switcher */}
              <div className="flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700">
                {fuelType === 'electric' ? (
                  <button
                    type="button"
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white"
                  >
                    kWh/100km
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setConsumptionUnit('L/100km')}
                      className={`px-2 py-1 text-xs font-bold rounded-lg transition ${
                        consumptionUnit === 'L/100km'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      L/100km
                    </button>
                    <button
                      type="button"
                      onClick={() => setConsumptionUnit('km/L')}
                      className={`px-2 py-1 text-xs font-bold rounded-lg transition ${
                        consumptionUnit === 'km/L'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      km/L
                    </button>
                    <button
                      type="button"
                      onClick={() => setConsumptionUnit('mpg_us')}
                      className={`px-2 py-1 text-xs font-bold rounded-lg transition ${
                        consumptionUnit === 'mpg_us'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      MPG
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.1"
                min="1"
                max="100"
                value={avgConsumption}
                onChange={(e) => setAvgConsumption(Number(e.target.value))}
                className="w-32 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-emerald-500 tabular-nums"
              />
              <span className="text-xs text-slate-300 font-medium">
                {consumptionUnit}
              </span>
              {consumptionUnit !== 'L/100km' && consumptionUnit !== 'kWh/100km' && (
                <span className="text-[11px] text-slate-500">
                  (Normalized: {normalizedConsumptionL100km} L/100km)
                </span>
              )}
            </div>
          </div>

          {/* Current Fuel Level Slider */}
          <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 flex flex-col gap-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-white">Current Fuel / Battery Level</span>
              <span className="font-bold text-emerald-400 text-sm tabular-nums">
                {currentFuelLevel}%
              </span>
            </div>

            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={currentFuelLevel}
              onChange={(e) => setCurrentFuelLevel(Number(e.target.value))}
              className="w-full accent-emerald-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
            />

            <div className="flex justify-between text-[11px] text-slate-400">
              <button
                type="button"
                onClick={() => setCurrentFuelLevel(25)}
                className="hover:text-white underline decoration-slate-600"
              >
                1/4 Tank (25%)
              </button>
              <button
                type="button"
                onClick={() => setCurrentFuelLevel(50)}
                className="hover:text-white underline decoration-slate-600"
              >
                Half (50%)
              </button>
              <button
                type="button"
                onClick={() => setCurrentFuelLevel(75)}
                className="hover:text-white underline decoration-slate-600"
              >
                3/4 Tank (75%)
              </button>
              <button
                type="button"
                onClick={() => setCurrentFuelLevel(100)}
                className="hover:text-white underline decoration-slate-600"
              >
                Full (100%)
              </button>
            </div>
          </div>

          {/* Fuel Price & Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Fuel Price Per {capacityUnit === 'gallons' ? 'Gallon' : capacityUnit === 'kWh' ? 'kWh' : 'Litre'}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm font-bold">{currency}</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  value={fuelPricePerUnit}
                  onChange={(e) => setFuelPricePerUnit(Number(e.target.value))}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-blue-500 tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Currency Symbol
              </label>
              <div className="flex items-center gap-1.5">
                {['₹', '$', '€', '£'].map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => setCurrency(sym)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                      currency === sym
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live Trip Economics Impact Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 to-slate-900 border border-blue-900/40 flex flex-col gap-2">
            <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-400" />
              Calculated Driving Economics
            </span>
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Est. Full Range</span>
                <span className="text-sm font-bold text-white tabular-nums">
                  {estimatedFullRangeKm} km
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Current Range</span>
                <span className="text-sm font-bold text-emerald-400 tabular-nums">
                  {currentRangeKm} km
                </span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Cost / 100km</span>
                <span className="text-sm font-bold text-amber-400 tabular-nums">
                  {currency}{costPer100Km}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-[2] py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Save Vehicle Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
