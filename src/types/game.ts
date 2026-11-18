export type ParcelColor = 'red' | 'blue' | 'yellow' | 'green' | 'purple';

export type GameTheme = 'classic' | 'webslinger';

export type ParcelKind = 'normal' | 'taped' | 'mystery' | 'vip';

export type SymbolShape = 'star' | 'circle' | 'triangle' | 'diamond' | 'hexagon';

export interface Parcel {
  id: string;
  color: ParcelColor;
  kind: ParcelKind;
  /** For taped/crated parcels: true until first tap removes the tape/crate */
  taped: boolean;
  /** For mystery parcels: false until scanned by scanner arch or adjacent parcel cleared */
  revealed: boolean;
  /** Normalized position [0, 1) along the looping conveyor belt */
  beltOffset: number;
  /** For VIP/Express parcels: remaining loops (starts at 2.0) */
  loopsRemaining: number;
  /** Previous beltOffset for detecting loop wrap / scanner pass */
  prevBeltOffset: number;
  /** Animation timers (seconds) */
  justUntapedTimer: number;
  justRevealedTimer: number;
  tapSquashTimer: number;
  /** Index in initial belt spawn order for adjacent-reveal checks */
  orderIndex: number;
}

export type TruckState = 'entering' | 'parked' | 'leaving';

export interface Truck {
  id: string;
  color: ParcelColor;
  /** 3 cargo slots; null = empty, ParcelColor = filled */
  slots: (ParcelColor | null)[];
  /** Number of parcels currently in flight toward this truck */
  reservedSlots: number;
  state: TruckState;
  /** Dock bay index (0, 1, or 2) */
  bayIndex: number;
  /** Current visual X/Y in logical canvas coordinates */
  x: number;
  y: number;
  targetX: number;
  /** Wheel rotation angle (radians) */
  wheelAngle: number;
  /** Squash-and-stretch bounce timer */
  bounceTimer: number;
  /** Completion flash timer before departing */
  flashTimer: number;
  /** Individual slot pop timers */
  slotPopTimers: [number, number, number];
}

export interface BufferParcel {
  id: string;
  color: ParcelColor;
}

export interface BufferSlot {
  parcel: BufferParcel | null;
  /** Reserved by an incoming flying parcel */
  reserved: boolean;
  /** Locked by an expired VIP parcel */
  locked: boolean;
  bounceTimer: number;
  shakeTimer: number;
}

export interface FlyingParcel {
  id: string;
  color: ParcelColor;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  arcHeight: number;
  progress: number;
  duration: number;
  spin: number;
  targetType: 'truck' | 'buffer';
  targetIndex: number;
  targetTruckId?: string;
  targetSlotIndex?: number;
  trail: { x: number; y: number; alpha: number }[];
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  rotation: number;
  vRot: number;
  shape: 'circle' | 'rect' | 'star' | 'smoke';
  gravity: number;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export type GameStatus = 'playing' | 'won' | 'jammed';

export interface LevelParcelSpec {
  color: ParcelColor;
  kind: ParcelKind;
}

export interface LevelConfig {
  levelNumber: number;
  activeTruckCount: 2 | 3;
  colors: ParcelColor[];
  /** Ordered queue of truck colors to arrive */
  truckQueue: ParcelColor[];
  /** Ordered list of parcels placed around the belt */
  parcels: LevelParcelSpec[];
  /** Belt speed in loops per second */
  beltSpeed: number;
  /** Whether the scanner arch is active (Level 7+) */
  hasScanner: boolean;
  /** Feature badge for minimal HUD */
  mechanicTag?: string;
}

export interface GameSnapshot {
  levelNumber: number;
  status: GameStatus;
  trucksDispatched: number;
  totalTrucks: number;
  mechanicTag?: string;
  starsEarned: number;
  jamReason?: string;
  isEndless: boolean;
  combo: number;
  magnetTimer: number;
  freezeTimer: number;
  earnedMagnetCount: number;
  timeRemaining: number;
}
