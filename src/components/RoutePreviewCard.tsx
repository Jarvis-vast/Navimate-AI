import React, { useState } from 'react';
import { RouteOption } from '../types/navigation';
import { Navigation, Clock, Fuel, ShieldCheck, ArrowRight, Zap, X, Car, CheckCircle2, Smartphone } from 'lucide-react';

interface RoutePreviewCardProps {
  routes: RouteOption[];
  selectedRouteId: string;
  onSelectRoute: (id: string) => void;
  onStartNavigation: () => void;
  onClose: () => void;
  avoidTolls: boolean;
  onToggleAvoidTolls: () => void;
  avoidHighways: boolean;
  onToggleAvoidHighways: () => void;
  onSendToCar?: () => Promise<void> | void;
  isSendingToCar?: boolean;
  sendToCarSuccess?: boolean;
}

export const RoutePreviewCard: React.FC<RoutePreviewCardProps> = ({
  routes,
  selectedRouteId,
  onSelectRoute,
  onStartNavigation,
  onClose,
  avoidTolls,
  onToggleAvoidTolls,
  avoidHighways,
  onToggleAvoidHighways,
  onSendToCar,
  isSendingToCar = false,
  sendToCarSuccess = false,
}) => {
  const activeRoute = routes.find(r => r.id === selectedRouteId) || routes[0];

  if (!activeRoute) return null;

  return (
    <div className="w-full bg-slate-900/95 border border-slate-800 rounded-3xl p-5 shadow-2xl backdrop-blur-2xl flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">Route Options</span>
            {activeRoute.trafficDelayMinutes > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                +{activeRoute.trafficDelayMinutes}m delay
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-white mt-0.5">{activeRoute.summary}</h2>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Alternative Route Selectors */}
      <div className="grid grid-cols-2 gap-2">
        {routes.map((r, idx) => {
          const isSelected = r.id === selectedRouteId;
          return (
            <button
              key={r.id}
              onClick={() => onSelectRoute(r.id)}
              className={`p-3 rounded-2xl text-left border transition flex flex-col justify-between ${
                isSelected
                  ? 'bg-blue-600/15 border-blue-500 text-white ring-1 ring-blue-500'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-semibold text-blue-400">Option {idx + 1}</span>
                <span className="text-[11px] text-slate-400">{r.distanceKm} km</span>
              </div>
              <div className="mt-1">
                <div className="text-base font-bold text-white tabular-nums">
                  {Math.floor(r.durationMinutes / 60) > 0 ? `${Math.floor(r.durationMinutes / 60)}h ` : ''}
                  {r.durationMinutes % 60}m
                </div>
                <div className="text-xs text-emerald-400 font-medium mt-0.5">
                  ₹{r.estimatedFuelCost} fuel · {r.estimatedFuelLitres}L
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Route Economics Breakdown */}
      <div className="grid grid-cols-3 gap-2 bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50 text-center">
        <div>
          <span className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" /> Travel Time
          </span>
          <p className="text-sm font-semibold text-white mt-1 tabular-nums">
            {activeRoute.durationMinutes} mins
          </p>
        </div>
        <div>
          <span className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
            <Fuel className="w-3 h-3 text-emerald-400" /> Est. Fuel Cost
          </span>
          <p className="text-sm font-semibold text-emerald-400 mt-1 tabular-nums">
            ₹{activeRoute.estimatedFuelCost}
          </p>
        </div>
        <div>
          <span className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3 text-blue-400" /> Tolls
          </span>
          <p className="text-sm font-semibold text-white mt-1 tabular-nums">
            {activeRoute.hasTolls ? `₹${activeRoute.tollsEstimated}` : 'None'}
          </p>
        </div>
      </div>

      {/* Avoidance Toggles */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onToggleAvoidTolls}
          className={`flex-1 py-2 px-3 rounded-xl border text-xs font-medium transition ${
            avoidTolls
              ? 'bg-blue-600/20 border-blue-500 text-blue-300'
              : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          {avoidTolls ? '✓ Avoid Tolls' : 'Avoid Tolls'}
        </button>

        <button
          onClick={onToggleAvoidHighways}
          className={`flex-1 py-2 px-3 rounded-xl border text-xs font-medium transition ${
            avoidHighways
              ? 'bg-blue-600/20 border-blue-500 text-blue-300'
              : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          {avoidHighways ? '✓ Avoid Highways' : 'Avoid Highways'}
        </button>
      </div>

      {/* Primary Action Buttons */}
      <div className="flex flex-col gap-2 pt-1">
        <button
          onClick={onStartNavigation}
          className="w-full h-12 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-blue-600/30 active:scale-[0.98] transition cursor-pointer"
        >
          <Navigation className="w-4 h-4 fill-current" />
          Start Navigation on Web
        </button>

        {onSendToCar && (
          <button
            onClick={onSendToCar}
            disabled={isSendingToCar || sendToCarSuccess}
            className={`w-full h-12 py-2.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border transition cursor-pointer ${
              sendToCarSuccess
                ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-200 hover:text-white'
            }`}
          >
            {sendToCarSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Dispatched to In-Car Android Device!</span>
              </>
            ) : isSendingToCar ? (
              <>
                <Car className="w-4 h-4 animate-bounce text-blue-400" />
                <span>Sending Route Token to In-Car Device...</span>
              </>
            ) : (
              <>
                <Car className="w-4 h-4 text-emerald-400" />
                <span>Send Route to Android / In-Car Device</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
