import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RotateCcw,
  Volume2,
  VolumeX,
  Truck as TruckIcon,
  Star,
  Play,
  AlertTriangle,
  Heart,
  ChevronDown,
  Tv,
  Flag,
  Magnet,
  Snowflake,
  Sparkles,
  Clock,
} from 'lucide-react';
import { GameCanvas, GameCanvasHandle } from './components/GameCanvas';
import { LevelSelectModal, getCheckpointForLevel } from './components/LevelSelectModal';
import { AdOverlay } from './components/AdOverlay';
import { soundEngine } from './audio/soundEngine';
import { adService, AdRequest } from './services/adService';
import { GameSnapshot, GameTheme } from './types/game';

const MAX_LIVES = 3;

function readStorageNumber(key: string, fallback: number): number {
  try {
    const val = localStorage.getItem(key);
    if (val === null) return fallback;
    const num = Number(val);
    return Number.isFinite(num) ? num : fallback;
  } catch {
    return fallback;
  }
}

function readStarsMap(): Record<number, number> {
  try {
    const raw = localStorage.getItem('conveyor-jam-stars');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function App() {
  const [levelNumber, setLevelNumber] = useState<number>(() =>
    Math.max(1, readStorageNumber('conveyor-jam-level', 1))
  );
  const [highestUnlocked, setHighestUnlocked] = useState<number>(() =>
    Math.max(1, readStorageNumber('conveyor-jam-highest', 1))
  );
  const [lives, setLives] = useState<number>(() =>
    Math.min(MAX_LIVES, Math.max(0, readStorageNumber('conveyor-jam-lives', MAX_LIVES)))
  );
  const [starsByLevel, setStarsByLevel] = useState<Record<number, number>>(readStarsMap);
  const [magnetCount, setMagnetCount] = useState<number>(() =>
    Math.max(0, readStorageNumber('conveyor-jam-magnets', 1))
  );
  const [freezeCount, setFreezeCount] = useState<number>(() =>
    Math.max(0, readStorageNumber('conveyor-jam-freezes', 1))
  );

  const [resetToken, setResetToken] = useState(0);
  const [muted, setMuted] = useState(() => soundEngine.isMuted());
  const [theme, setTheme] = useState<GameTheme>(() => {
    try {
      return localStorage.getItem('conveyor-jam-theme') === 'webslinger' ? 'webslinger' : 'classic';
    } catch {
      return 'classic';
    }
  });
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [activeAd, setActiveAd] = useState<AdRequest | null>(null);

  const [snapshot, setSnapshot] = useState<GameSnapshot>({
    levelNumber: 1,
    status: 'playing',
    trucksDispatched: 0,
    totalTrucks: 5,
    starsEarned: 0,
    isEndless: false,
    combo: 0,
    magnetTimer: 0,
    freezeTimer: 0,
    earnedMagnetCount: 0,
    timeRemaining: 51,
  });

  const canvasRef = useRef<GameCanvasHandle>(null);
  const prevStatusRef = useRef<GameSnapshot['status']>('playing');
  const prevEarnedMagnetsRef = useRef<number>(0);

  // Subscribe to ad requests
  useEffect(() => {
    return adService.subscribe(setActiveAd);
  }, []);

  // Persist level, highestUnlocked, lives, stars
  useEffect(() => {
    try {
      localStorage.setItem('conveyor-jam-level', String(levelNumber));
      localStorage.setItem('conveyor-jam-highest', String(highestUnlocked));
      localStorage.setItem('conveyor-jam-lives', String(lives));
      localStorage.setItem('conveyor-jam-stars', JSON.stringify(starsByLevel));
      localStorage.setItem('conveyor-jam-magnets', String(magnetCount));
      localStorage.setItem('conveyor-jam-freezes', String(freezeCount));
    } catch {
      // ignore
    }
  }, [levelNumber, highestUnlocked, lives, starsByLevel, magnetCount, freezeCount]);

  // Achievement: 4 direct truck loads in a row grants +1 Magnet
  useEffect(() => {
    if (snapshot.earnedMagnetCount > prevEarnedMagnetsRef.current) {
      const diff = snapshot.earnedMagnetCount - prevEarnedMagnetsRef.current;
      setMagnetCount((c) => c + diff);
    }
    prevEarnedMagnetsRef.current = snapshot.earnedMagnetCount;
  }, [snapshot.earnedMagnetCount]);

  // React to win/jam state transitions
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = snapshot.status;

    if (prev !== 'jammed' && snapshot.status === 'jammed') {
      setLives((l) => Math.max(0, l - 1));
    }

    if (prev !== 'won' && snapshot.status === 'won') {
      setHighestUnlocked((h) => Math.max(h, snapshot.levelNumber + 1));
      if (snapshot.starsEarned === 3) {
        // Achievement: 3-star clear grants +1 Freeze
        setFreezeCount((f) => f + 1);
      }
      setStarsByLevel((prevStars) => ({
        ...prevStars,
        [snapshot.levelNumber]: Math.max(
          prevStars[snapshot.levelNumber] || 0,
          snapshot.starsEarned
        ),
      }));
    }
  }, [snapshot.status, snapshot.levelNumber, snapshot.starsEarned]);

  const handleSnapshotChange = useCallback((snap: GameSnapshot) => {
    setSnapshot(snap);
  }, []);

  const handleRestart = () => {
    // Restarting mid-level also costs 1 life if currently playing and has >0 lives
    if (snapshot.status === 'playing' && snapshot.trucksDispatched > 0) {
      if (lives <= 1) {
        // Drop to checkpoint if out of lives
        const cp = getCheckpointForLevel(levelNumber);
        setLives(MAX_LIVES);
        setLevelNumber(cp);
        setResetToken((t) => t + 1);
        return;
      }
      setLives((l) => Math.max(0, l - 1));
    }
    if (lives === 0) {
      const cp = getCheckpointForLevel(levelNumber);
      setLives(MAX_LIVES);
      setLevelNumber(cp);
    }
    setResetToken((t) => t + 1);
  };

  const handleNextLevel = async () => {
    await adService.maybeShowInterstitialOnLevelClear(levelNumber);
    const next = levelNumber + 1;
    setLevelNumber(next);
    setHighestUnlocked((h) => Math.max(h, next));
  };

  const handleWatchAdForLife = async (andRetry: boolean) => {
    const placement = andRetry ? 'Jam Rescue (+1 Life)' : 'Bonus Life (+1 Life)';
    const rewarded = await adService.showRewardedAd(placement);
    if (rewarded) {
      setLives((l) => Math.min(MAX_LIVES, l + 1));
      if (andRetry) {
        setResetToken((t) => t + 1);
      }
    }
  };

  const handleWatchAdForTime = async () => {
    const rewarded = await adService.showRewardedAd('Timeout Rescue (+20s)');
    if (rewarded) {
      setLives((l) => Math.min(MAX_LIVES, l + 1));
      canvasRef.current?.addBonusTime(20);
    }
  };

  const handleBackToCheckpoint = () => {
    const cp = getCheckpointForLevel(levelNumber);
    setLives(MAX_LIVES);
    setLevelNumber(cp);
    setResetToken((t) => t + 1);
  };

  const handleSelectLevel = (lvl: number) => {
    setShowLevelSelect(false);
    setLevelNumber(lvl);
    setResetToken((t) => t + 1);
  };

  const handleUseMagnet = () => {
    if (magnetCount <= 0 || snapshot.status !== 'playing' || snapshot.magnetTimer > 0) return;
    setMagnetCount((c) => Math.max(0, c - 1));
    canvasRef.current?.activateMagnet();
  };

  const handleUseFreeze = () => {
    if (freezeCount <= 0 || snapshot.status !== 'playing' || snapshot.freezeTimer > 0) return;
    setFreezeCount((c) => Math.max(0, c - 1));
    canvasRef.current?.activateFreeze();
  };

  const handleToggleMute = () => {
    setMuted(soundEngine.toggleMute());
  };

  const handleToggleTheme = () => {
    setTheme((prev) => {
      const next: GameTheme = prev === 'classic' ? 'webslinger' : 'classic';
      try {
        localStorage.setItem('conveyor-jam-theme', next);
      } catch {
        // ignore
      }
      return next;
    });
  };

  const trucksRemaining = Math.max(0, snapshot.totalTrucks - snapshot.trucksDispatched);
  const checkpointLevel = getCheckpointForLevel(levelNumber);
  const secsLeft = Math.max(0, Math.ceil(snapshot.timeRemaining));
  const timeStr = `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, '0')}`;
  const isTimeLow = secsLeft <= 10 && snapshot.freezeTimer <= 0 && snapshot.status === 'playing';
  const isTimeout = snapshot.jamReason === "Time's up!";

  return (
    <div className="w-full h-[100dvh] bg-slate-950 flex items-center justify-center overflow-hidden">
      {/* Mobile-first portrait container */}
      <div className="relative w-full h-full max-w-[440px] max-h-[900px] sm:h-[94dvh] sm:rounded-3xl sm:border sm:border-slate-800 sm:shadow-2xl overflow-hidden bg-slate-950">
        {/* Minimal Floating HUD (2-row safe-area layout so nothing ever clips on iPhone) */}
        <header
          style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}
          className="absolute top-0 left-0 right-0 z-20 px-3.5 pb-1 flex flex-col gap-1.5 pointer-events-none"
        >
          {/* Row 1: Level Selector + Action Buttons */}
          <div className="w-full flex items-center justify-between gap-2">
            <button
              onClick={() => setShowLevelSelect(true)}
              className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-700/70 hover:border-sky-500/50 rounded-2xl px-3 py-1.5 flex items-center gap-1.5 shadow-lg cursor-pointer active:scale-95 transition whitespace-nowrap"
            >
              <span className="text-xs font-extrabold uppercase tracking-wider text-sky-400">
                {snapshot.isEndless ? `Endless ${snapshot.levelNumber}` : `Level ${snapshot.levelNumber}`}
              </span>
              {snapshot.mechanicTag && !snapshot.isEndless && (
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  {snapshot.mechanicTag}
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <div className="flex items-center gap-1.5 pointer-events-auto shrink-0">
              <button
                onClick={handleToggleTheme}
                aria-label="Switch Theme"
                className={`h-9 px-2.5 rounded-2xl backdrop-blur-md border flex items-center gap-1 text-[11px] font-black uppercase tracking-wider active:scale-90 transition cursor-pointer shadow-lg ${
                  theme === 'webslinger'
                    ? 'bg-gradient-to-r from-rose-500/30 to-sky-500/30 border-rose-400 text-white shadow-rose-500/20'
                    : 'bg-slate-900/90 border-amber-400/50 text-amber-300 hover:bg-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{theme === 'webslinger' ? 'Hero' : 'Theme'}</span>
              </button>
              <button
                onClick={handleRestart}
                aria-label="Restart Level"
                className="w-9 h-9 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/70 flex items-center justify-center text-slate-200 hover:bg-slate-800 active:scale-90 transition cursor-pointer shadow-lg"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={handleToggleMute}
                aria-label={muted ? 'Unmute' : 'Mute'}
                className="w-9 h-9 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/70 flex items-center justify-center text-slate-200 hover:bg-slate-800 active:scale-90 transition cursor-pointer shadow-lg"
              >
                {muted ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-sky-400" />
                )}
              </button>
            </div>
          </div>

          {/* Row 2: Trucks Remaining + Timer + Lives */}
          <div className="w-full flex items-center justify-between gap-2 pointer-events-auto">
            <div className="flex items-center gap-1.5">
              <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/70 rounded-2xl px-2.5 py-1 flex items-center gap-1.5 shadow-lg">
                <TruckIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-bold text-slate-100 tabular-nums">
                  {trucksRemaining} left
                </span>
              </div>

              <div
                className={`backdrop-blur-md border rounded-2xl px-2.5 py-1 flex items-center gap-1 shadow-lg transition ${
                  snapshot.freezeTimer > 0
                    ? 'bg-sky-500/20 border-sky-400/60 text-sky-300'
                    : isTimeLow
                    ? 'bg-rose-500/25 border-rose-400 text-rose-300 animate-pulse'
                    : 'bg-slate-900/90 border-slate-700/70 text-slate-100'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span className="text-xs font-bold tabular-nums">{timeStr}</span>
              </div>
            </div>

            <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/70 rounded-2xl px-2.5 py-1 flex items-center gap-1 shadow-lg">
              {[1, 2, 3].map((i) => (
                <Heart
                  key={i}
                  className={`w-3.5 h-3.5 transition-all ${
                    i <= lives
                      ? 'text-rose-500 fill-rose-500 drop-shadow-[0_0_6px_rgba(244,63,94,0.5)]'
                      : 'text-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </header>

        {/* Main Game Canvas */}
        <GameCanvas
          ref={canvasRef}
          levelNumber={levelNumber}
          resetToken={resetToken}
          theme={theme}
          onSnapshotChange={handleSnapshotChange}
        />

        {/* Bottom Power-Up & Streak Bar */}
        <footer
          style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
          className="absolute bottom-0 left-0 right-0 z-20 px-4 pt-1 flex items-center justify-between pointer-events-none"
        >
          {/* Combo Streak Dots (4 direct loads -> +1 Magnet) */}
          <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/60 rounded-2xl px-3 py-2 flex items-center gap-1.5 pointer-events-auto shadow-lg">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-300 mr-0.5">
              Streak
            </span>
            {[1, 2, 3, 4].map((dot) => (
              <span
                key={dot}
                className={`w-2 h-2 rounded-full transition-all ${
                  dot <= snapshot.combo
                    ? 'bg-purple-400 scale-110 shadow-[0_0_6px_rgba(192,132,252,0.8)]'
                    : 'bg-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Power-up Buttons */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={handleUseMagnet}
              disabled={magnetCount <= 0 && snapshot.magnetTimer <= 0}
              className={`relative rounded-2xl px-3 py-2 border flex items-center gap-1.5 text-xs font-extrabold transition shadow-lg ${
                snapshot.magnetTimer > 0
                  ? 'bg-purple-500/30 border-purple-400 text-purple-200 animate-pulse'
                  : magnetCount > 0
                  ? 'bg-slate-900/90 border-purple-500/40 text-purple-300 hover:bg-slate-800 active:scale-95 cursor-pointer'
                  : 'bg-slate-950/60 border-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              <Magnet className="w-4 h-4" />
              <span>
                {snapshot.magnetTimer > 0
                  ? `${Math.ceil(snapshot.magnetTimer)}s`
                  : `Grab (${magnetCount})`}
              </span>
            </button>

            <button
              onClick={handleUseFreeze}
              disabled={freezeCount <= 0 && snapshot.freezeTimer <= 0}
              className={`relative rounded-2xl px-3 py-2 border flex items-center gap-1.5 text-xs font-extrabold transition shadow-lg ${
                snapshot.freezeTimer > 0
                  ? 'bg-sky-500/30 border-sky-400 text-sky-200 animate-pulse'
                  : freezeCount > 0
                  ? 'bg-slate-900/90 border-sky-500/40 text-sky-300 hover:bg-slate-800 active:scale-95 cursor-pointer'
                  : 'bg-slate-950/60 border-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              <Snowflake className="w-4 h-4" />
              <span>
                {snapshot.freezeTimer > 0
                  ? `${Math.ceil(snapshot.freezeTimer)}s`
                  : `Freeze (${freezeCount})`}
              </span>
            </button>
          </div>
        </footer>

        {/* Win Overlay */}
        {snapshot.status === 'won' && (
          <div className="absolute inset-0 z-30 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded-3xl p-6 text-center shadow-2xl animate-pop-in">
              <div className="flex justify-center gap-2 mb-3">
                {[1, 2, 3].map((s) => (
                  <Star
                    key={s}
                    className={`w-9 h-9 transition-transform ${
                      s <= snapshot.starsEarned
                        ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)] scale-110'
                        : 'text-slate-700'
                    }`}
                  />
                ))}
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white mb-1">
                Dock Cleared!
              </h2>
              <p className="text-sm text-slate-400 mb-5">
                All {snapshot.totalTrucks} trucks dispatched
              </p>
              <button
                onClick={handleNextLevel}
                className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-base tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                Next Level
              </button>

              {lives < MAX_LIVES && (
                <button
                  onClick={() => handleWatchAdForLife(false)}
                  className="w-full mt-2.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 border border-sky-500/40 text-sky-300 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Tv className="w-4 h-4" />
                  Watch Ad for +1 ♥
                </button>
              )}
            </div>
          </div>
        )}

        {/* Jammed / Out of Lives Overlay */}
        {snapshot.status === 'jammed' && (
          <div className="absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="w-full max-w-xs bg-slate-900 border border-rose-500/40 rounded-3xl p-6 text-center shadow-2xl animate-pop-in">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-rose-400" />
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white mb-1">
                {isTimeout ? "Time's Up!" : lives > 0 ? 'Belt Jammed!' : 'Out of Lives!'}
              </h2>
              <p className="text-sm text-slate-400 mb-3">
                {lives > 0
                  ? snapshot.jamReason || 'Holding tray is full'
                  : `Return to Checkpoint (Level ${checkpointLevel}) or watch an ad to rescue your run.`}
              </p>

              {/* Hearts indicator */}
              <div className="flex items-center justify-center gap-2 mb-5">
                {[1, 2, 3].map((i) => (
                  <Heart
                    key={i}
                    className={`w-6 h-6 ${
                      i <= lives ? 'text-rose-500 fill-rose-500' : 'text-slate-700'
                    }`}
                  />
                ))}
              </div>

              {isTimeout ? (
                <div className="space-y-2.5">
                  <button
                    onClick={handleWatchAdForTime}
                    className="w-full py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-400 active:scale-95 text-slate-950 font-black text-base tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 transition cursor-pointer"
                  >
                    <Tv className="w-5 h-5" />
                    Watch Ad (+20s & Continue)
                  </button>
                  {lives > 0 ? (
                    <button
                      onClick={() => setResetToken((t) => t + 1)}
                      className="w-full py-3 rounded-2xl bg-rose-500 hover:bg-rose-400 active:scale-95 text-white font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Retry Level
                    </button>
                  ) : (
                    <button
                      onClick={handleBackToCheckpoint}
                      className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Flag className="w-4 h-4 text-amber-400" />
                      Checkpoint (Level {checkpointLevel})
                    </button>
                  )}
                </div>
              ) : lives > 0 ? (
                <div className="space-y-2.5">
                  <button
                    onClick={() => setResetToken((t) => t + 1)}
                    className="w-full py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-400 active:scale-95 text-white font-black text-base tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-rose-500/25 transition cursor-pointer"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Retry Level
                  </button>
                  {lives < MAX_LIVES && (
                    <button
                      onClick={() => handleWatchAdForLife(true)}
                      className="w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 border border-sky-500/40 text-sky-300 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Tv className="w-4 h-4" />
                      Watch Ad (+1 ♥ & Retry)
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  <button
                    onClick={() => handleWatchAdForLife(true)}
                    className="w-full py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-400 active:scale-95 text-slate-950 font-black text-base tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 transition cursor-pointer"
                  >
                    <Tv className="w-5 h-5" />
                    Watch Ad (+1 ♥ & Retry)
                  </button>
                  <button
                    onClick={handleBackToCheckpoint}
                    className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Flag className="w-4 h-4 text-amber-400" />
                    Checkpoint (Level {checkpointLevel})
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Level Select Modal */}
        {showLevelSelect && (
          <LevelSelectModal
            currentLevel={levelNumber}
            highestUnlocked={highestUnlocked}
            starsByLevel={starsByLevel}
            onSelectLevel={handleSelectLevel}
            onClose={() => setShowLevelSelect(false)}
          />
        )}

        {/* AdMob / Preview Overlay */}
        {activeAd && <AdOverlay request={activeAd} />}
      </div>
    </div>
  );
}

export default App;
