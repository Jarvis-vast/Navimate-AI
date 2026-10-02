import React, { useState } from 'react';
import { RouteManeuver, NavigationState } from '../types/navigation';
import { TrafficAlertIncident } from '../services/trafficAlerts';
import { compareSpeedAgainstLimit, SpeedLimitComparisonResult } from '../services/speedLimit';
import {
  ArrowUp,
  ArrowUpRight,
  ArrowUpLeft,
  CornerUpRight,
  CornerUpLeft,
  Navigation,
  AlertTriangle,
  XCircle,
  Play,
  Volume2,
  Radio,
  ShieldAlert,
  Gauge,
  Sliders,
  ChevronDown,
  ChevronUp,
  AlertOctagon,
} from 'lucide-react';

interface ActiveNavigationOverlayProps {
  navState: NavigationState;
  trafficAlert?: TrafficAlertIncident | null;
  isSimulated?: boolean;
  onEndRoute: () => void;
  onSimulateMove?: () => void;
  onTestTrafficAlert?: () => void;
  onDismissAlert?: () => void;
  onSetSpeedLimit?: (limit: number | null) => void;
  onSetVehicleSpeed?: (speedKmh: number) => void;
}

export const ActiveNavigationOverlay: React.FC<ActiveNavigationOverlayProps> = ({
  navState,
  trafficAlert,
  isSimulated = false,
  onEndRoute,
  onSimulateMove,
  onTestTrafficAlert,
  onDismissAlert,
  onSetSpeedLimit,
  onSetVehicleSpeed,
}) => {
  const [showSpeedControls, setShowSpeedControls] = useState(false);
  const [speedAlertMuted, setSpeedAlertMuted] = useState(false);

  const maneuver = navState.nextManeuver;

  // Execute core comparison function
  const speedAnalysis: SpeedLimitComparisonResult = compareSpeedAgainstLimit(
    navState.currentSpeedKmh,
    navState.detectedSpeedLimitKmh,
    3 // 3 km/h buffer
  );

  const isOverspeed = speedAnalysis.isOverspeed;

  const renderManeuverIcon = (type: RouteManeuver['maneuverType']) => {
    switch (type) {
      case 'turn-left':
        return <CornerUpLeft className="w-8 h-8 text-white stroke-[2.5]" />;
      case 'turn-right':
        return <CornerUpRight className="w-8 h-8 text-white stroke-[2.5]" />;
      case 'keep-left':
        return <ArrowUpLeft className="w-8 h-8 text-white stroke-[2.5]" />;
      case 'keep-right':
        return <ArrowUpRight className="w-8 h-8 text-white stroke-[2.5]" />;
      case 'destination':
        return <Navigation className="w-8 h-8 text-red-400 stroke-[2.5]" />;
      default:
        return <ArrowUp className="w-8 h-8 text-white stroke-[2.5]" />;
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-20">
      {/* Top Section: Turn-by-Turn Maneuver, Traffic & Speed Limit UI Alerts */}
      <div className="pointer-events-auto w-full max-w-lg mx-auto flex flex-col gap-2">
        {/* Simulation Warning Banner */}
        {isSimulated && (
          <div className="w-full bg-amber-500/90 text-slate-950 font-black px-3 py-1.5 rounded-xl text-center text-xs tracking-wider shadow-lg flex items-center justify-center gap-2">
            <span>⚠️ SIMULATION / DEMO NAVIGATION ACTIVE</span>
          </div>
        )}

        {/* HIGH-PRIORITY VISUAL SPEED LIMIT EXCEEDED ALERT BANNER */}
        {isOverspeed && !speedAlertMuted && (
          <div
            className={`w-full rounded-3xl p-4 shadow-2xl backdrop-blur-2xl border transition-all animate-bounce-short ${
              speedAnalysis.severity === 'critical'
                ? 'bg-rose-950/95 border-rose-500 ring-4 ring-rose-600/50 text-rose-100 shadow-rose-950/60'
                : speedAnalysis.severity === 'warning'
                ? 'bg-rose-950/90 border-rose-500 ring-2 ring-rose-500/40 text-rose-100'
                : 'bg-amber-950/90 border-amber-500 ring-2 ring-amber-500/40 text-amber-100'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                  speedAnalysis.severity === 'critical'
                    ? 'bg-rose-600 text-white shadow-rose-600/50 animate-pulse'
                    : speedAnalysis.severity === 'warning'
                    ? 'bg-rose-600 text-white shadow-rose-600/40'
                    : 'bg-amber-600 text-white shadow-amber-600/40'
                }`}
              >
                {speedAnalysis.severity === 'critical' ? (
                  <AlertOctagon className="w-7 h-7 animate-spin-slow" />
                ) : (
                  <Gauge className="w-7 h-7" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-black uppercase tracking-wider ${
                        speedAnalysis.severity === 'caution' ? 'text-amber-300' : 'text-rose-300'
                      }`}
                    >
                      {speedAnalysis.alertTitle}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-black/40 text-slate-300 font-semibold">
                      <Volume2 className="w-3 h-3 text-emerald-400" /> Voice Active
                    </span>
                  </div>
                  <button
                    onClick={() => setSpeedAlertMuted(true)}
                    className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded-lg bg-black/30 transition active:scale-95"
                  >
                    Acknowledge
                  </button>
                </div>

                <div className="flex items-baseline gap-2 mt-1">
                  <h4 className="text-xl font-black text-white tabular-nums tracking-tight">
                    {speedAnalysis.currentSpeedKmh} <span className="text-xs font-normal text-slate-300">km/h</span>
                  </h4>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-black/40 text-rose-300 border border-rose-500/30">
                    +{speedAnalysis.excessSpeedKmh} km/h OVER
                  </span>
                  <span className="text-xs text-slate-300 font-medium">
                    (Limit: {speedAnalysis.postedLimitKmh} km/h)
                  </span>
                </div>

                <p className="text-xs text-slate-200 mt-1 leading-snug font-medium">
                  {speedAnalysis.recommendedAction}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* REAL-TIME TRAFFIC INCIDENT ALERT (VOICE & VISUAL) */}
        {trafficAlert && (
          <div
            className={`w-full rounded-3xl p-4 shadow-2xl backdrop-blur-2xl border transition-all animate-bounce-short ${
              trafficAlert.type === 'accident'
                ? 'bg-rose-950/95 border-rose-500 ring-2 ring-rose-500/50 text-rose-100'
                : 'bg-amber-950/95 border-amber-500 ring-2 ring-amber-500/50 text-amber-100'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  trafficAlert.type === 'accident'
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/40'
                    : 'bg-amber-600 text-white shadow-lg shadow-amber-600/40'
                }`}
              >
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-rose-300">
                      Live Traffic Alert
                    </span>
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-black/40 text-slate-300 font-semibold">
                      <Volume2 className="w-3 h-3 text-emerald-400" /> Voice Alert
                    </span>
                  </div>
                  {onDismissAlert && (
                    <button
                      onClick={onDismissAlert}
                      className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded-lg bg-black/30"
                    >
                      Dismiss
                    </button>
                  )}
                </div>

                <h4 className="text-base font-bold text-white mt-0.5 truncate">
                  {trafficAlert.title}
                </h4>

                <p className="text-xs text-slate-200 mt-1 leading-snug">
                  {trafficAlert.description}
                </p>

                <div className="flex items-center gap-3 mt-2 text-xs font-semibold">
                  <span className="px-2 py-0.5 rounded-md bg-black/30 text-amber-300">
                    {(trafficAlert.distanceMeters / 1000).toFixed(1)} km ahead
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-black/30 text-rose-300">
                    +{trafficAlert.delayMinutes} min delay
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Standard Maneuver Card */}
        <div className="bg-slate-900/95 border border-slate-700/80 rounded-3xl p-4 shadow-2xl backdrop-blur-xl flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-600/40">
            {renderManeuverIcon(maneuver?.maneuverType || 'straight')}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-white tabular-nums">
                {navState.distanceToNextManeuverMeters >= 1000
                  ? `${(navState.distanceToNextManeuverMeters / 1000).toFixed(1)} km`
                  : `${navState.distanceToNextManeuverMeters} m`}
              </span>
              {maneuver?.exitNumber && (
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold">
                  Exit {maneuver.exitNumber}
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-slate-200 truncate mt-0.5">
              {maneuver?.instruction || 'Continue straight on route'}
            </p>
          </div>
        </div>

        {/* Hazard or Secondary Alert Toast (if no active overspeed or traffic alert) */}
        {!trafficAlert && !isOverspeed && navState.activeAlert && (
          <div
            className={`w-full rounded-2xl p-3 shadow-xl backdrop-blur-xl flex items-center gap-3 border transition-all ${
              navState.activeAlert.type === 'speed'
                ? 'bg-rose-950/90 border-rose-600 text-rose-200'
                : 'bg-amber-950/90 border-amber-600 text-amber-200'
            }`}
          >
            <AlertTriangle className="w-5 h-5 shrink-0 text-white" />
            <p className="text-xs font-semibold flex-1 leading-snug">
              {navState.activeAlert.message}
            </p>
          </div>
        )}
      </div>

      {/* Floating Speedometer, Speed Limit Sign & Test Controls (Bottom-Left & Center) */}
      <div className="pointer-events-auto flex flex-col gap-2 w-full max-w-lg mx-auto mb-2">
        {/* Speed Testing Drawer (Interactive Toggle) */}
        {showSpeedControls && (
          <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl p-3 shadow-2xl backdrop-blur-xl text-xs space-y-2">
            <div className="flex items-center justify-between font-bold text-slate-200">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-400" />
                <span>Speed & Limit Testing Panel</span>
              </span>
              <span className="text-[10px] text-slate-400">Mock API Integration</span>
            </div>

            {/* Simulated Speed Quick Buttons */}
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">Set Current GPS Speed:</span>
              <div className="grid grid-cols-5 gap-1.5">
                {[35, 50, 65, 80, 105].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => {
                      if (onSetVehicleSpeed) onSetVehicleSpeed(spd);
                      setSpeedAlertMuted(false);
                    }}
                    className={`py-1 rounded-lg border font-bold text-center transition ${
                      Math.round(navState.currentSpeedKmh) === spd
                        ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {spd} km/h
                  </button>
                ))}
              </div>
            </div>

            {/* Posted Speed Limit Corridor Buttons */}
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">Set Posted Corridor Speed Limit:</span>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { label: '30 Zone', limit: 30 },
                  { label: '50 Urban', limit: 50 },
                  { label: '60 Arterial', limit: 60 },
                  { label: '80 Hwy', limit: 80 },
                  { label: '100 Exp', limit: 100 },
                ].map((item) => (
                  <button
                    key={item.limit}
                    onClick={() => {
                      if (onSetSpeedLimit) onSetSpeedLimit(item.limit);
                      setSpeedAlertMuted(false);
                    }}
                    className={`py-1 px-1 rounded-lg border text-[11px] font-semibold text-center transition ${
                      navState.detectedSpeedLimitKmh === item.limit
                        ? 'bg-emerald-600 border-emerald-400 text-white shadow-md'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-end justify-between w-full">
          <div className="flex items-center gap-2.5">
            {/* Speedometer with dynamic overspeed warning states */}
            <div
              className={`relative rounded-2xl flex flex-col items-center justify-center shadow-xl border backdrop-blur-xl transition-all duration-300 p-2 min-w-[76px] min-h-[76px] ${
                isOverspeed
                  ? 'bg-rose-950/95 border-rose-500 ring-4 ring-rose-500/50 shadow-rose-950/80 animate-pulse'
                  : 'bg-slate-900/90 border-slate-700/80'
              }`}
            >
              {/* Floating Delta Badge */}
              {isOverspeed && (
                <div className="absolute -top-2.5 bg-rose-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded-full shadow-md uppercase tracking-wider animate-bounce-short">
                  +{speedAnalysis.excessSpeedKmh} OVER
                </div>
              )}

              <span
                className={`text-2xl font-black tabular-nums transition-colors ${
                  isOverspeed ? 'text-rose-400' : 'text-white'
                }`}
              >
                {Number.isFinite(navState.currentSpeedKmh) ? Math.round(navState.currentSpeedKmh) : 0}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase -mt-0.5">km/h</span>
            </div>

            {/* Official Circular Speed Limit Sign */}
            {navState.detectedSpeedLimitKmh !== null ? (
              <div
                className={`w-14 h-14 rounded-full bg-white flex flex-col items-center justify-center shadow-xl transition-all ${
                  isOverspeed
                    ? 'border-[5px] border-rose-600 ring-4 ring-rose-600/40 scale-105'
                    : 'border-[4px] border-red-600'
                }`}
              >
                <span className="text-base font-black text-slate-950 tabular-nums leading-none">
                  {navState.detectedSpeedLimitKmh}
                </span>
                <span className="text-[8px] font-black tracking-tighter text-slate-600 uppercase">
                  LIMIT
                </span>
              </div>
            ) : (
              <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[10px] text-slate-400 font-medium">
                Speed limit: N/A
              </div>
            )}
          </div>

          {/* Controls: Speed Limit Simulator, Traffic Test, Step */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowSpeedControls(!showSpeedControls)}
              title="Toggle speed limit and vehicle speed testing controls"
              className={`px-2.5 py-2 rounded-xl border text-xs font-semibold shadow-lg backdrop-blur-md active:scale-95 transition flex items-center gap-1 cursor-pointer ${
                showSpeedControls
                  ? 'bg-blue-600 text-white border-blue-400'
                  : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              <Gauge className="w-3.5 h-3.5 text-blue-400" />
              <span>Speed Test</span>
              {showSpeedControls ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {onTestTrafficAlert && (
              <button
                onClick={onTestTrafficAlert}
                title="Test real-time incident detection & voice announcement"
                className="px-2.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/40 text-xs font-semibold text-rose-200 shadow-lg backdrop-blur-md active:scale-95 transition flex items-center gap-1 cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                <span>Alert</span>
              </button>
            )}

            {onSimulateMove && (
              <button
                onClick={onSimulateMove}
                className="px-2.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-semibold text-amber-300 shadow-lg backdrop-blur-md active:scale-95 transition flex items-center gap-1 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-amber-300" />
                <span>Step</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom ETA & Trip Overview Card */}
      <div className="pointer-events-auto w-full max-w-lg mx-auto">
        <div className="bg-slate-900/95 border border-slate-700/80 rounded-3xl p-4 shadow-2xl backdrop-blur-xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-2xl font-bold text-emerald-400 tabular-nums">
                {navState.remainingDurationMinutes} <span className="text-sm font-normal text-slate-400">min</span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span>{navState.remainingDistanceKm} km left</span>
                <span>·</span>
                <span>ETA {navState.etaTimeFormatted}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onEndRoute}
            className="px-5 py-2.5 rounded-2xl bg-rose-600/90 hover:bg-rose-600 text-white font-bold text-sm shadow-lg shadow-rose-600/25 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
            End Route
          </button>
        </div>
      </div>
    </div>
  );
};
