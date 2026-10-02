import React, { useState } from 'react';
import { UserPreferences } from '../types/navigation';
import { clearAllLocalData } from '../services/storage';
import {
  Settings,
  Volume2,
  Moon,
  Battery,
  Shield,
  Download,
  Trash2,
  CheckCircle,
  HelpCircle,
  Car,
  Layers,
  ChevronRight,
  User,
  History,
} from 'lucide-react';

interface SettingsModalProps {
  preferences: UserPreferences;
  onUpdatePreferences: (updated: Partial<UserPreferences>) => void;
  onClose: () => void;
  onOpenVehicleSetup?: () => void;
  onOpenOfflineMaps?: () => void;
  onOpenAuth?: () => void;
  onOpenTripHistory?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  preferences,
  onUpdatePreferences,
  onClose,
  onOpenVehicleSetup,
  onOpenOfflineMaps,
  onOpenAuth,
  onOpenTripHistory,
}) => {
  const [dataCleared, setDataCleared] = useState(false);

  const handleExportData = () => {
    const backup = {
      preferences,
      exportedAt: new Date().toISOString(),
      appName: 'NaviMate AI',
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `navimate_data_${Date.now()}.json`;
    a.click();
  };

  const handleClearData = async () => {
    if (window.confirm('Delete all offline cached maps, routes, and local fuel logs?')) {
      await clearAllLocalData();
      setDataCleared(true);
      setTimeout(() => setDataCleared(false), 3000);
    }
  };

  return (
    <div className="w-full bg-slate-900/95 border border-slate-800 rounded-3xl p-5 shadow-2xl backdrop-blur-2xl flex flex-col gap-5 max-h-[82vh] overflow-y-auto">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-400" />
          <h3 className="text-base font-bold text-white">System Settings</h3>
        </div>
        <button
          onClick={onClose}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
        >
          Done
        </button>
      </div>

      {/* Vehicle & Offline Map Shortcuts */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Vehicle & Maps Management
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {onOpenVehicleSetup && (
            <button
              onClick={onOpenVehicleSetup}
              className="p-3 rounded-2xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-left transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <Car className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white group-hover:text-blue-300 transition">
                    Vehicle Profile Setup
                  </p>
                  <p className="text-[10px] text-slate-400">Fuel type, tank & consumption</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
            </button>
          )}

          {onOpenTripHistory && (
            <button
              onClick={onOpenTripHistory}
              className="p-3 rounded-2xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-left transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white group-hover:text-purple-300 transition">
                    Trip History & Analytics
                  </p>
                  <p className="text-[10px] text-slate-400">Cloud Firestore records & costs</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
            </button>
          )}

          {onOpenAuth && (
            <button
              onClick={onOpenAuth}
              className="p-3 rounded-2xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-left transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white group-hover:text-indigo-300 transition">
                    Driver Profile & Auth
                  </p>
                  <p className="text-[10px] text-slate-400">Firebase sign-in & cross-device sync</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
            </button>
          )}

          {onOpenOfflineMaps && (
            <button
              onClick={onOpenOfflineMaps}
              className="p-3 rounded-2xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-left transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white group-hover:text-emerald-300 transition">
                    Offline Map Regions
                  </p>
                  <p className="text-[10px] text-slate-400">IndexedDB & PWA download cache</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
            </button>
          )}
        </div>
      </div>

      {/* Voice & Guidance */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Voice Guidance
        </span>
        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <Volume2 className="w-4 h-4 text-blue-400" />
            <div>
              <p className="text-xs font-bold text-white">Spoken Turn-by-Turn</p>
              <p className="text-[11px] text-slate-400">Spoken maneuvers and hazard alerts</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={preferences.voiceEnabled}
            onChange={(e) => onUpdatePreferences({ voiceEnabled: e.target.checked })}
            className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Power & Data Saver Mode */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Performance & Power
        </span>
        <div className="grid grid-cols-3 gap-2">
          {(['normal', 'data-saver', 'battery-saver'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onUpdatePreferences({ dataSaver: mode })}
              className={`p-2.5 rounded-xl border text-xs font-semibold capitalize transition ${
                preferences.dataSaver === mode
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {mode.replace('-', ' ')}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400">
          {preferences.dataSaver === 'battery-saver'
            ? 'Battery Saver optimizes location sampling while maintaining driving safety.'
            : preferences.dataSaver === 'data-saver'
            ? 'Data Saver prioritizes cached offline vectors & minimizes network calls.'
            : 'Standard continuous GPS updates and live traffic streaming.'}
        </p>
      </div>

      {/* Privacy & Storage Control */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Privacy & Offline Data
        </span>
        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="text-xs font-bold text-white">Save Trip & Fuel History</p>
              <p className="text-[11px] text-slate-400">Stored strictly in local client memory</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={preferences.locationHistoryConsent}
            onChange={(e) => onUpdatePreferences({ locationHistoryConsent: e.target.checked })}
            className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
          />
        </div>

        <div className="flex gap-2 mt-1">
          <button
            onClick={handleExportData}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center justify-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" /> Export Data
          </button>

          <button
            onClick={handleClearData}
            className="flex-1 py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-xs font-semibold text-rose-300 border border-rose-800/60 flex items-center justify-center gap-1.5 transition"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear All Data
          </button>
        </div>

        {dataCleared && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <CheckCircle className="w-3.5 h-3.5" /> Cache and local storage erased successfully.
          </div>
        )}
      </div>

      {/* About & Compliance info */}
      <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500">
        <p>NaviMate AI v1.0.0 · Production-oriented architecture</p>
        <p>Google Maps Platform Routes & Places API Client SDK</p>
      </div>
    </div>
  );
};
