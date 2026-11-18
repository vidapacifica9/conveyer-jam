import React, { useEffect, useState } from 'react';
import { Tv, X, Gift } from 'lucide-react';
import { AdRequest } from '../services/adService';

interface AdOverlayProps {
  request: AdRequest;
}

export const AdOverlay: React.FC<AdOverlayProps> = ({ request }) => {
  const [secondsLeft, setSecondsLeft] = useState(request.durationSeconds);

  useEffect(() => {
    setSecondsLeft(request.durationSeconds);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [request]);

  const canClose = secondsLeft === 0;

  return (
    <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-between p-6">
      {/* Top Bar */}
      <div
        style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}
        className="w-full flex items-center justify-between"
      >
        <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
          {request.type === 'rewarded' ? 'Rewarded Ad' : 'Sponsored Break'}
        </span>

        {canClose ? (
          <button
            onClick={() => request.resolve(true)}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-600 flex items-center justify-center text-white cursor-pointer transition active:scale-90"
            aria-label="Close Ad"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <div className="px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-xs font-bold text-slate-300 tabular-nums">
            {secondsLeft}s
          </div>
        )}
      </div>

      {/* Ad Preview Card */}
      <div className="w-full max-w-xs bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-3xl p-6 text-center shadow-2xl">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center">
          {request.type === 'rewarded' ? (
            <Gift className="w-8 h-8 text-sky-400" />
          ) : (
            <Tv className="w-8 h-8 text-sky-400" />
          )}
        </div>
        <h3 className="text-lg font-black text-white mb-1">
          {request.type === 'rewarded' ? 'Unlocking Reward...' : 'AdMob Interstitial'}
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Placement: <span className="text-slate-200 font-semibold">{request.placement}</span>
        </p>
        <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
          <div
            className="h-full bg-sky-400 transition-all duration-1000 ease-linear"
            style={{
              width: `${((request.durationSeconds - secondsLeft) / request.durationSeconds) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Bottom Action */}
      <div className="w-full max-w-xs pb-4">
        {canClose ? (
          <button
            onClick={() => request.resolve(true)}
            className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-base transition cursor-pointer shadow-lg shadow-emerald-500/25"
          >
            {request.type === 'rewarded' ? 'Claim Reward & Continue' : 'Continue'}
          </button>
        ) : (
          request.type === 'rewarded' && (
            <button
              onClick={() => request.resolve(false)}
              className="w-full py-2.5 rounded-2xl bg-slate-900 border border-slate-700 text-slate-400 font-bold text-xs cursor-pointer hover:text-slate-200 transition"
            >
              Skip (No Reward)
            </button>
          )
        )}
      </div>
    </div>
  );
};
