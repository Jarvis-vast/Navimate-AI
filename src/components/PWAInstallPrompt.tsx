import React from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X } from 'lucide-react';

export const PWAInstallPrompt: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = React.useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 active:scale-95 transition"
      >
        <Download className="w-3.5 h-3.5" />
        Install App
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 active:scale-95 transition"
        >
          <Smartphone className="w-3.5 h-3.5 text-blue-400" />
          Install on iOS
        </button>

        {showIOSModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-bold text-white">Install NaviMate AI</h4>
                <button
                  onClick={() => setShowIOSModal(false)}
                  className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                1. Tap the <strong className="text-blue-400">Share</strong> icon in the Safari navigation bar.<br />
                2. Scroll down and select <strong className="text-blue-400">Add to Home Screen</strong>.<br />
                3. Enjoy full-screen driving navigation!
              </p>
              <button
                onClick={() => setShowIOSModal(false)}
                className="mt-5 w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold transition hover:bg-blue-500"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
