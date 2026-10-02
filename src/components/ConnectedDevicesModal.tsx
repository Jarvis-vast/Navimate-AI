import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Laptop,
  Car,
  QrCode,
  ShieldCheck,
  RefreshCw,
  Trash2,
  X,
  Battery,
  Clock,
  Radio,
  Copy,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Device, PairingRequest } from '../types/platform';
import { platformSync } from '../services/platformSync';

interface ConnectedDevicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: Device[];
  onDevicesChange: () => void;
}

export const ConnectedDevicesModal: React.FC<ConnectedDevicesModalProps> = ({
  isOpen,
  onClose,
  devices,
  onDevicesChange,
}) => {
  const [pairingRequest, setPairingRequest] = useState<PairingRequest | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isPairingSimulated, setIsPairingSimulated] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300);

  useEffect(() => {
    if (!isOpen) {
      setPairingRequest(null);
      return;
    }
  }, [isOpen]);

  // Countdown timer for pairing code TTL
  useEffect(() => {
    if (!pairingRequest) return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((pairingRequest.expiresAt - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining === 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [pairingRequest]);

  const handleStartPairing = async () => {
    setIsGenerating(true);
    try {
      const req = await platformSync.createPairingRequest();
      if (req) {
        setPairingRequest(req);
        setSecondsRemaining(Math.max(0, Math.floor((req.expiresAt - Date.now()) / 1000)));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSimulateAndroidConfirm = async () => {
    if (!pairingRequest) return;
    setIsPairingSimulated(true);
    try {
      const ok = await platformSync.simulateAndroidPair(pairingRequest.pairingCode);
      if (ok) {
        setPairingRequest(null);
        onDevicesChange();
      }
    } finally {
      setIsPairingSimulated(false);
    }
  };

  const handleCopyCode = () => {
    if (!pairingRequest) return;
    navigator.clipboard?.writeText(pairingRequest.pairingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleUnpair = async (deviceId: string) => {
    const confirmed = window.confirm('Unpair this device from your NaviMate AI account?');
    if (confirmed) {
      await platformSync.unpairDevice(deviceId);
      onDevicesChange();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Connected Devices & In-Car Units
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                  One NaviMate AI Platform
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Synchronize routes, live telemetry, vehicle telemetry, and voice intelligence between Web and Android.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 flex-1">
          {/* Active Devices List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                Active Registered Devices ({devices.length})
              </h3>
              {!pairingRequest && (
                <button
                  onClick={handleStartPairing}
                  disabled={isGenerating}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  {isGenerating ? 'Generating Code...' : 'Pair Android Device'}
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {devices.length === 0 ? (
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 text-center text-slate-400 text-sm">
                  No devices currently linked. Click &apos;Pair Android Device&apos; to link your smartphone or in-car unit.
                </div>
              ) : (
                devices.map((device) => {
                  const isOnline = device.status === 'ONLINE';
                  const isWeb = device.platform === 'WEB';

                  return (
                    <div
                      key={device.deviceId}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2.5 rounded-xl border ${
                            isWeb
                              ? 'bg-purple-950/40 text-purple-400 border-purple-800/40'
                              : 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                          }`}
                        >
                          {isWeb ? <Laptop className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-200">{device.name}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                                isOnline
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {isOnline ? 'ONLINE' : 'OFFLINE'}
                            </span>
                            {isWeb && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 font-medium">
                                Current Client
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                            <span>v{device.appVersion || '1.0.0'}</span>
                            {device.batteryPercent !== undefined && (
                              <span className="flex items-center gap-1">
                                <Battery className="w-3 h-3 text-slate-400" />
                                {device.batteryPercent}%
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(device.lastSeenAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isWeb && (
                          <button
                            onClick={() => handleUnpair(device.deviceId)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                            title="Unpair Device"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Device Pairing Panel (When Active) */}
          {pairingRequest && (
            <div className="p-5 rounded-2xl border-2 border-blue-500/40 bg-blue-950/20 space-y-5 animate-fade-in">
              <div className="flex items-center justify-between border-b border-blue-800/30 pb-3">
                <div className="flex items-center gap-2 text-blue-400">
                  <QrCode className="w-5 h-5" />
                  <span className="font-bold text-sm text-white">Pair Android Phone / In-Car Head Unit</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-900/40 text-blue-300 border border-blue-700/50">
                  <Clock className="w-3 h-3 animate-spin" />
                  Expires in {Math.floor(secondsRemaining / 60)}:
                  {(secondsRemaining % 60).toString().padStart(2, '0')}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* Visual QR Code Card */}
                <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-lg border border-slate-200 text-slate-900">
                  <div className="relative p-2 bg-white">
                    {/* High-contrast generated SVG QR code mockup representation */}
                    <svg
                      viewBox="0 0 160 160"
                      className="w-36 h-36"
                      shapeRendering="crispEdges"
                    >
                      {/* Outer corner finders */}
                      <rect x="0" y="0" width="40" height="40" fill="#0f172a" />
                      <rect x="6" y="6" width="28" height="28" fill="#ffffff" />
                      <rect x="12" y="12" width="16" height="16" fill="#0f172a" />

                      <rect x="120" y="0" width="40" height="40" fill="#0f172a" />
                      <rect x="126" y="6" width="28" height="28" fill="#ffffff" />
                      <rect x="132" y="12" width="16" height="16" fill="#0f172a" />

                      <rect x="0" y="120" width="40" height="40" fill="#0f172a" />
                      <rect x="6" y="126" width="28" height="28" fill="#ffffff" />
                      <rect x="12" y="132" width="16" height="16" fill="#0f172a" />

                      {/* Data dots pattern */}
                      <rect x="50" y="10" width="10" height="10" fill="#0f172a" />
                      <rect x="70" y="20" width="10" height="10" fill="#0f172a" />
                      <rect x="90" y="10" width="10" height="10" fill="#0f172a" />
                      <rect x="50" y="50" width="20" height="20" fill="#0f172a" />
                      <rect x="80" y="60" width="10" height="20" fill="#0f172a" />
                      <rect x="100" y="50" width="20" height="10" fill="#0f172a" />
                      <rect x="130" y="60" width="20" height="20" fill="#0f172a" />
                      <rect x="20" y="60" width="10" height="20" fill="#0f172a" />
                      <rect x="60" y="90" width="30" height="10" fill="#0f172a" />
                      <rect x="100" y="80" width="10" height="20" fill="#0f172a" />
                      <rect x="120" y="100" width="20" height="10" fill="#0f172a" />
                      <rect x="50" y="120" width="20" height="20" fill="#0f172a" />
                      <rect x="80" y="130" width="30" height="10" fill="#0f172a" />
                      <rect x="120" y="120" width="10" height="30" fill="#0f172a" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="p-1.5 bg-blue-600 text-white rounded-lg shadow">
                        <Car className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600 mt-2 uppercase tracking-wide">
                    Scan with Android NaviMate App
                  </span>
                </div>

                {/* 6-Digit Code & Manual Entry */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">
                      Or Enter 6-Digit Pairing PIN on Android:
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-950 border-2 border-blue-500/50 rounded-xl px-4 py-3 text-center tracking-[0.4em] font-mono text-2xl font-black text-blue-300 shadow-inner">
                        {pairingRequest.pairingCode.slice(0, 3)} {pairingRequest.pairingCode.slice(3)}
                      </div>
                      <button
                        onClick={handleCopyCode}
                        className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition"
                        title="Copy PIN Code"
                      >
                        {copiedCode ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Copy className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 space-y-1">
                    <p className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Secure Zero-Trust Handshake:
                    </p>
                    <p>• One-time token expires automatically after 5 minutes.</p>
                    <p>• Links directly to your authenticated NaviMate profile.</p>
                  </div>

                  {/* Browser Simulation Quick Action for Testing */}
                  <div className="pt-2">
                    <button
                      onClick={handleSimulateAndroidConfirm}
                      disabled={isPairingSimulated}
                      className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg transition"
                    >
                      <Sparkles className="w-4 h-4" />
                      {isPairingSimulated
                        ? 'Connecting Android Device...'
                        : 'Simulate Android In-Car Device Pairing (Quick Test)'}
                    </button>
                    <p className="text-[11px] text-center text-slate-500 mt-1">
                      Instantly links a test Pixel 8 Pro In-Car Unit to preview two-way sync.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setPairingRequest(null)}
                  className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition"
                >
                  Cancel Pairing
                </button>
              </div>
            </div>
          )}

          {/* Unified Platform Architecture Notice */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-400 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200">Unified Architecture Guarantee:</span>
              <p className="mt-0.5 leading-relaxed">
                Routes planned on this Web dashboard can be dispatched directly to your vehicle with native Google Routes API
                Route Tokens. Live Android GPS movements, speed, and maneuvers synchronize back to this screen in real-time.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Control Plane Realtime Stream Active
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
