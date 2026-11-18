import React from 'react';
import { X, Star, Flag, Lock } from 'lucide-react';

interface LevelSelectModalProps {
  currentLevel: number;
  highestUnlocked: number;
  starsByLevel: Record<number, number>;
  onSelectLevel: (level: number) => void;
  onClose: () => void;
}

export function getCheckpointForLevel(level: number): number {
  if (level <= 1) return 1;
  if (level < 5) return 1;
  return Math.floor(level / 5) * 5;
}

export const LevelSelectModal: React.FC<LevelSelectModalProps> = ({
  currentLevel,
  highestUnlocked,
  starsByLevel,
  onSelectLevel,
  onClose,
}) => {
  const totalShown = Math.max(12, Math.ceil((highestUnlocked + 2) / 4) * 4);
  const levels = Array.from({ length: totalShown }, (_, i) => i + 1);

  return (
    <div className="absolute inset-0 z-40 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-5">
      <div className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded-3xl p-5 shadow-2xl animate-pop-in max-h-[82dvh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-black text-white">Select Level</h2>
            <p className="text-[11px] text-slate-400">Checkpoints at Lv 1, 5, 10, 15...</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2.5 overflow-y-auto pr-1 pb-1">
          {levels.map((lvl) => {
            const unlocked = lvl <= highestUnlocked;
            const isCurrent = lvl === currentLevel;
            const isCheckpoint = lvl === 1 || lvl % 5 === 0;
            const stars = starsByLevel[lvl] || 0;

            return (
              <button
                key={lvl}
                disabled={!unlocked}
                onClick={() => onSelectLevel(lvl)}
                className={`relative rounded-2xl p-2.5 flex flex-col items-center justify-center border transition ${
                  isCurrent
                    ? 'bg-sky-500/20 border-sky-400 text-white shadow-md shadow-sky-500/15'
                    : unlocked
                    ? 'bg-slate-800/90 border-slate-700 text-slate-100 hover:bg-slate-800 active:scale-95 cursor-pointer'
                    : 'bg-slate-950/60 border-slate-800/60 text-slate-600 cursor-not-allowed'
                }`}
              >
                {isCheckpoint && unlocked && (
                  <Flag className="w-2.5 h-2.5 text-amber-400 absolute top-1.5 right-1.5" />
                )}
                {unlocked ? (
                  <>
                    <span className="text-sm font-black tabular-nums">{lvl}</span>
                    <div className="flex gap-0.5 mt-1">
                      {[1, 2, 3].map((s) => (
                        <Star
                          key={s}
                          className={`w-2.5 h-2.5 ${
                            s <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-slate-700'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <Lock className="w-4 h-4 my-1.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
