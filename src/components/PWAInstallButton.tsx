import React, { useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 border border-emerald-400/40 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-400/25 transition whitespace-nowrap"
        title="Install AD78 App"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Install App</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[#101a2f] border border-cyan-500/40 p-5 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Install AD78 on Phone</h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {isIOS ? (
              <p className="text-xs leading-relaxed text-slate-200">
                1. Tap the <strong>Share</strong> icon in Safari.<br />
                2. Tap <strong>Add to Home Screen</strong> → <strong>Add</strong>.
              </p>
            ) : (
              <p className="text-xs leading-relaxed text-slate-200">
                1. Open this link in <strong>Chrome</strong> on your phone.<br />
                2. Tap the <strong>⋮ (3 dots)</strong> menu at top-right.<br />
                3. Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.<br />
                4. AD78 will install directly on your home screen like an APK.
              </p>
            )}
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full rounded-xl bg-cyan-400 py-2.5 text-xs font-bold text-slate-950"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
