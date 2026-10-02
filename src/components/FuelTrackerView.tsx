import React, { useState } from 'react';
import { FuelLog, VehicleProfile } from '../types/navigation';
import { Fuel, Plus, TrendingUp, Calendar, MapPin, Trash2, CheckCircle2, Settings2, Sliders } from 'lucide-react';

interface FuelTrackerViewProps {
  vehicle: VehicleProfile;
  fuelLogs: FuelLog[];
  onAddLog: (log: Omit<FuelLog, 'id'>) => void;
  onDeleteLog: (id: string) => void;
  onEditVehicle?: () => void;
}

export const FuelTrackerView: React.FC<FuelTrackerViewProps> = ({
  vehicle,
  fuelLogs,
  onAddLog,
  onDeleteLog,
  onEditVehicle,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [odometer, setOdometer] = useState('');
  const [litres, setLitres] = useState('');
  const [cost, setCost] = useState('');
  const [pricePerLitre, setPricePerLitre] = useState(vehicle.fuelPricePerUnit.toString());
  const [notes, setNotes] = useState('');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!litres || !cost) return;

    onAddLog({
      vehicleId: vehicle.id,
      date: new Date().toISOString().split('T')[0],
      odometer: Number(odometer) || 45200,
      litres: Number(litres),
      cost: Number(cost),
      pricePerLitre: Number(pricePerLitre) || 98.5,
      notes: notes.trim() || undefined,
    });

    setOdometer('');
    setLitres('');
    setCost('');
    setNotes('');
    setShowAddForm(false);
  };

  // Fuel analytics calculations
  const totalLitres = fuelLogs.reduce((acc, curr) => acc + curr.litres, 0);
  const totalSpend = fuelLogs.reduce((acc, curr) => acc + curr.cost, 0);
  const avgCostPerLitre = totalLitres > 0 ? (totalSpend / totalLitres).toFixed(1) : vehicle.fuelPricePerUnit;

  return (
    <div className="w-full flex flex-col gap-4 text-slate-100 max-h-[82vh] overflow-y-auto pr-1">
      {/* Vehicle Profile Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                Active Vehicle
              </span>
              {onEditVehicle && (
                <button
                  onClick={onEditVehicle}
                  className="px-2 py-0.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-[10px] font-semibold border border-blue-500/30 transition flex items-center gap-1"
                >
                  <Settings2 className="w-2.5 h-2.5" /> Edit Profile
                </button>
              )}
            </div>
            <h3 className="text-lg font-bold text-white mt-0.5">{vehicle.name}</h3>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
              <span className="capitalize">{vehicle.fuelType}</span>
              <span>·</span>
              <span>
                Tank: {vehicle.tankCapacity}
                {vehicle.capacityUnit === 'gallons' ? ' gal' : vehicle.capacityUnit === 'kWh' ? ' kWh' : 'L'}
              </span>
              <span>·</span>
              <span>
                Avg: {vehicle.avgConsumption}{' '}
                {vehicle.consumptionUnit || (vehicle.fuelType === 'electric' ? 'kWh/100km' : 'L/100km')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Fuel className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
        </div>

        {/* Level Indicator */}
        <div className="mt-4 pt-3 border-t border-slate-800">
          <div className="flex justify-between text-xs font-medium text-slate-300 mb-1.5">
            <span>Estimated Fuel Level</span>
            <span className="text-emerald-400 font-bold">{vehicle.currentFuelLevel}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${vehicle.currentFuelLevel}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-1 italic">
            *Estimated based on distance driven & user logs. Not vehicle OBD-II telemetry.
          </p>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5">
          <span className="text-xs text-slate-400">Total Recorded Fill-ups</span>
          <p className="text-xl font-bold text-white mt-1">{fuelLogs.length} logs</p>
          <span className="text-xs text-emerald-400 font-medium">
            {totalLitres.toFixed(1)} Litres logged
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5">
          <span className="text-xs text-slate-400">Total Fuel Spend</span>
          <p className="text-xl font-bold text-white mt-1">₹{totalSpend.toLocaleString()}</p>
          <span className="text-xs text-blue-400 font-medium">
            Avg: ₹{avgCostPerLitre}/L
          </span>
        </div>
      </div>

      {/* Add Fill-up Button / Form */}
      {showAddForm ? (
        <form
          onSubmit={handleFormSubmit}
          className="bg-slate-900/95 border border-slate-700/80 rounded-3xl p-5 shadow-2xl flex flex-col gap-3"
        >
          <h4 className="text-sm font-bold text-white">Log Fuel Fill-Up</h4>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Litres Filled</label>
              <input
                type="number"
                step="0.1"
                required
                value={litres}
                onChange={(e) => setLitres(e.target.value)}
                placeholder="e.g. 35.5"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Total Cost (₹)</label>
              <input
                type="number"
                step="1"
                required
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="e.g. 3500"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Odometer (km)</label>
              <input
                type="number"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                placeholder="e.g. 45200"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Rate / Litre</label>
              <input
                type="number"
                step="0.1"
                value={pricePerLitre}
                onChange={(e) => setPricePerLitre(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-2">
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs active:scale-95 transition"
            >
              Save Fill-up
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full py-3 rounded-2xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-bold flex items-center justify-center gap-2 active:scale-98 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Log Fuel Fill-Up
        </button>
      )}

      {/* Fuel History List */}
      <div className="flex flex-col gap-2 mt-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
          Recent Fill-Up History
        </h4>

        {fuelLogs.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
            No fill-up logs yet. Tap 'Log Fuel Fill-Up' to start tracking.
          </div>
        ) : (
          fuelLogs.map((log) => (
            <div
              key={log.id}
              className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    {log.litres} Litres
                  </span>
                  <span className="text-xs text-emerald-400 font-semibold">
                    ₹{log.cost}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span>{log.date}</span>
                  <span>·</span>
                  <span>{log.odometer.toLocaleString()} km</span>
                </div>
              </div>

              <button
                onClick={() => onDeleteLog(log.id)}
                className="w-8 h-8 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
