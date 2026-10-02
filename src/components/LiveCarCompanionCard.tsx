import React from 'react';
import {
  Car,
  Navigation,
  Gauge,
  Clock,
  Compass,
  MapPin,
  AlertTriangle,
  Play,
  RotateCcw,
} from 'lucide-react';
import { LiveNavigationTelemetry } from '../types/platform';
import { platformSync } from '../services/platformSync';

interface LiveCarCompanionCardProps {
  telemetry: LiveNavigationTelemetry;
  onFocusCarLocation?: (coords: { lat: number; lng: number }) => void;
}

export const LiveCarCompanionCard: React.FC<LiveCarCompanionCardProps> = ({
  telemetry,
  onFocusCarLocation,
}) => {
  const isNavigating = telemetry.status === 'NAVIGATING' || telemetry.status === 'STARTING';

  const handleSimulateCarAdvance = async () => {
    // Advances simulated car progress by incrementing speed and advancing remaining distance
    const currentDist = telemetry.remainingDistanceMeters || 12000;
    const newDist = Math.max(500, currentDist - 1200);
    const simulatedSpeed = Math.floor(55 + Math.random() * 25);
    const newLat = telemetry.currentLocation ? telemetry.currentLocation.lat + 0.005 : 18.5304;
    const newLng = telemetry.currentLocation ? telemetry.currentLocation.lng + 0.005 : 73.8667;

    await platformSync.sendTelemetry({
      ...telemetry,
      status: 'NAVIGATING',
      currentSpeedKmh: simulatedSpeed,
      remainingDistanceMeters: newDist,
      remainingDurationSeconds: Math.max(60, Math.round((newDist / 1000) * 80)),
      currentLocation: {
        lat: newLat,
        lng: newLng,
        bearing: 45,
        speed: simulatedSpeed / 3.6,
      },
      currentManeuver: {
        instruction: newDist > 5000 ? 'Continue on National Highway 48 for 4.2 km' : 'Take exit 12 toward University Road in 600m',
        distanceMeters: Math.min(800, newDist),
        maneuverType: newDist > 5000 ? 'straight' : 'exit',
      },
    });
  };

  const handleClearTelemetry = async () => {
    await fetch('/api/navigation/telemetry/active', { method: 'DELETE' });
  };

  return (
    <div className="bg-slate-900/95 border-2 border-emerald-500/60 rounded-2xl shadow-2xl p-4 text-slate-100 backdrop-blur-md animate-fade-in w-full max-w-md">
      {/* Top Banner */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 animate-pulse">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">In-Car Live Navigation Mirror</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <p className="text-[11px] text-slate-400">
              Synchronized from Android Device • {telemetry.deviceId || 'Android Vehicle Unit'}
            </p>
          </div>
        </div>

        <button
          onClick={handleClearTelemetry}
          className="text-[10px] text-slate-400 hover:text-red-400 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition"
          title="Dismiss Live Companion"
        >
          Dismiss
        </button>
      </div>

      {/* Maneuver Instruction */}
      <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center gap-3 mb-3">
        <div className="p-2.5 bg-blue-600 text-white rounded-lg shadow-md shrink-0">
          <Navigation className="w-6 h-6 rotate-45" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-blue-400 font-semibold uppercase tracking-wider">
            Next Maneuver in {Math.round((telemetry.currentManeuver?.distanceMeters || 650) / 10) * 10}m
          </p>
          <p className="text-sm font-bold text-white truncate">
            {telemetry.currentManeuver?.instruction || 'Proceed along designated route corridor'}
          </p>
        </div>
      </div>

      {/* Speed & Distance Metrics Grid */}
      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <div className="p-2.5 bg-slate-950/50 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1 mb-0.5">
            <Gauge className="w-3 h-3 text-slate-400" />
            Car Speed
          </div>
          <div className="text-lg font-black text-emerald-400 font-mono">
            {Math.round(telemetry.currentSpeedKmh || 0)}{' '}
            <span className="text-[10px] font-normal text-slate-400">km/h</span>
          </div>
        </div>

        <div className="p-2.5 bg-slate-950/50 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1 mb-0.5">
            <MapPin className="w-3 h-3 text-slate-400" />
            Remaining
          </div>
          <div className="text-lg font-black text-white font-mono">
            {((telemetry.remainingDistanceMeters || 0) / 1000).toFixed(1)}{' '}
            <span className="text-[10px] font-normal text-slate-400">km</span>
          </div>
        </div>

        <div className="p-2.5 bg-slate-950/50 rounded-xl border border-slate-800">
          <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1 mb-0.5">
            <Clock className="w-3 h-3 text-slate-400" />
            ETA
          </div>
          <div className="text-lg font-black text-blue-400 font-mono">
            {telemetry.etaFormatted ||
              `${Math.max(1, Math.round((telemetry.remainingDurationSeconds || 0) / 60))}m`}
          </div>
        </div>
      </div>

      {/* Footer Controls & Live Companion Simulation Button */}
      <div className="flex items-center gap-2 pt-1">
        {telemetry.currentLocation && onFocusCarLocation && (
          <button
            onClick={() => onFocusCarLocation(telemetry.currentLocation!)}
            className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow"
          >
            <Compass className="w-3.5 h-3.5" />
            Track Vehicle on Map
          </button>
        )}

        <button
          onClick={handleSimulateCarAdvance}
          className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition"
          title="Simulate In-Car Progress for testing"
        >
          <Play className="w-3.5 h-3.5 text-emerald-400" />
          Advance Car Step
        </button>
      </div>
    </div>
  );
};
