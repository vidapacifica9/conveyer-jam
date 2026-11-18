import { ALL_COLORS } from './colors';
import { LevelConfig, LevelParcelSpec, ParcelColor, ParcelKind } from '../types/game';

/** Deterministic seeded PRNG (Mulberry32) */
function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithRng<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Validates that a level is mathematically solvable:
 * 1. Exact 3-to-1 parcel-to-truck ratio for every color.
 * 2. Simulates a greedy-lookahead playout with the 5-slot buffer to confirm
 *    all trucks can be dispatched without ever deadlocking the 5-slot buffer.
 */
export function isLevelSolvable(config: LevelConfig): boolean {
  const parcelCounts: Record<string, number> = {};
  const truckCounts: Record<string, number> = {};

  for (const p of config.parcels) {
    parcelCounts[p.color] = (parcelCounts[p.color] || 0) + 1;
  }
  for (const t of config.truckQueue) {
    truckCounts[t] = (truckCounts[t] || 0) + 1;
  }

  for (const color of new Set([...Object.keys(parcelCounts), ...Object.keys(truckCounts)])) {
    if ((parcelCounts[color] || 0) !== (truckCounts[color] || 0) * 3) {
      return false;
    }
  }

  // Forward simulation with 5-slot holding buffer
  const queue = [...config.truckQueue];
  const activeTrucks: { color: ParcelColor; needed: number }[] = [];
  for (let i = 0; i < config.activeTruckCount && queue.length > 0; i++) {
    activeTrucks.push({ color: queue.shift()!, needed: 3 });
  }

  const remainingParcels = config.parcels.map((p) => p.color);
  const buffer: ParcelColor[] = [];
  const maxBuffer = 5;

  const flushBufferToTrucks = () => {
    let moved = true;
    while (moved) {
      moved = false;
      for (let b = buffer.length - 1; b >= 0; b--) {
        const bColor = buffer[b];
        const truck = activeTrucks.find((t) => t.color === bColor && t.needed > 0);
        if (truck) {
          buffer.splice(b, 1);
          truck.needed--;
          moved = true;
          if (truck.needed === 0) {
            const idx = activeTrucks.indexOf(truck);
            if (queue.length > 0) {
              activeTrucks[idx] = { color: queue.shift()!, needed: 3 };
            } else {
              activeTrucks.splice(idx, 1);
            }
          }
        }
      }
    }
  };

  let safety = 0;
  while ((activeTrucks.length > 0 || remainingParcels.length > 0) && safety < 500) {
    safety++;
    flushBufferToTrucks();

    if (activeTrucks.length === 0 && remainingParcels.length === 0) {
      return true;
    }

    // Prefer tapping a parcel that matches an active truck directly
    let tappedIndex = remainingParcels.findIndex((c) =>
      activeTrucks.some((t) => t.color === c && t.needed > 0)
    );

    if (tappedIndex !== -1) {
      const color = remainingParcels.splice(tappedIndex, 1)[0];
      const truck = activeTrucks.find((t) => t.color === color && t.needed > 0)!;
      truck.needed--;
      if (truck.needed === 0) {
        const idx = activeTrucks.indexOf(truck);
        if (queue.length > 0) {
          activeTrucks[idx] = { color: queue.shift()!, needed: 3 };
        } else {
          activeTrucks.splice(idx, 1);
        }
      }
      continue;
    }

    // Otherwise, we must buffer a parcel
    if (buffer.length >= maxBuffer || remainingParcels.length === 0) {
      return false;
    }
    buffer.push(remainingParcels.shift()!);
  }

  return activeTrucks.length === 0 && remainingParcels.length === 0;
}

interface LevelRecipe {
  activeTruckCount: 2 | 3;
  colorCount: number;
  totalTrucks: number;
  beltSpeed: number;
  tapedRatio: number;
  mysteryRatio: number;
  vipCount: number;
  hasScanner: boolean;
  mechanicTag?: string;
}

function getLevelRecipe(levelNumber: number): LevelRecipe {
  switch (levelNumber) {
    case 1:
      return {
        activeTruckCount: 2,
        colorCount: 3,
        totalTrucks: 5,
        beltSpeed: 0.068,
        tapedRatio: 0,
        mysteryRatio: 0,
        vipCount: 0,
        hasScanner: false,
      };
    case 2:
      return {
        activeTruckCount: 2,
        colorCount: 4,
        totalTrucks: 7,
        beltSpeed: 0.078,
        tapedRatio: 0,
        mysteryRatio: 0,
        vipCount: 0,
        hasScanner: false,
        mechanicTag: '4 COLORS',
      };
    case 3:
      return {
        activeTruckCount: 2,
        colorCount: 4,
        totalTrucks: 8,
        beltSpeed: 0.084,
        tapedRatio: 0.32,
        mysteryRatio: 0,
        vipCount: 0,
        hasScanner: false,
        mechanicTag: 'CRATES',
      };
    case 4:
      return {
        activeTruckCount: 2,
        colorCount: 5,
        totalTrucks: 9,
        beltSpeed: 0.088,
        tapedRatio: 0.35,
        mysteryRatio: 0,
        vipCount: 0,
        hasScanner: false,
        mechanicTag: '5 COLORS',
      };
    case 5:
      return {
        activeTruckCount: 3,
        colorCount: 5,
        totalTrucks: 9,
        beltSpeed: 0.09,
        tapedRatio: 0.25,
        mysteryRatio: 0.35,
        vipCount: 0,
        hasScanner: true,
        mechanicTag: 'SCANNER',
      };
    case 6:
      return {
        activeTruckCount: 3,
        colorCount: 5,
        totalTrucks: 10,
        beltSpeed: 0.095,
        tapedRatio: 0.35,
        mysteryRatio: 0.38,
        vipCount: 0,
        hasScanner: true,
        mechanicTag: 'SCANNER',
      };
    case 7:
      return {
        activeTruckCount: 3,
        colorCount: 5,
        totalTrucks: 10,
        beltSpeed: 0.096,
        tapedRatio: 0.28,
        mysteryRatio: 0.3,
        vipCount: 2,
        hasScanner: true,
        mechanicTag: 'EXPRESS',
      };
    case 8:
      return {
        activeTruckCount: 3,
        colorCount: 5,
        totalTrucks: 11,
        beltSpeed: 0.102,
        tapedRatio: 0.32,
        mysteryRatio: 0.32,
        vipCount: 3,
        hasScanner: true,
        mechanicTag: 'EXPRESS',
      };
    case 9:
      return {
        activeTruckCount: 3,
        colorCount: 5,
        totalTrucks: 12,
        beltSpeed: 0.108,
        tapedRatio: 0.35,
        mysteryRatio: 0.3,
        vipCount: 4,
        hasScanner: true,
        mechanicTag: 'RUSH',
      };
    case 10:
      return {
        activeTruckCount: 3,
        colorCount: 5,
        totalTrucks: 13,
        beltSpeed: 0.114,
        tapedRatio: 0.35,
        mysteryRatio: 0.35,
        vipCount: 5,
        hasScanner: true,
        mechanicTag: 'FINALE',
      };
    default: {
      // Endless procedural scaling for Level 11+
      const extra = levelNumber - 10;
      return {
        activeTruckCount: 3,
        colorCount: 5,
        totalTrucks: Math.min(18, 12 + Math.floor(extra / 2)),
        beltSpeed: Math.min(0.14, 0.112 + extra * 0.003),
        tapedRatio: Math.min(0.4, 0.3 + extra * 0.015),
        mysteryRatio: Math.min(0.4, 0.3 + extra * 0.015),
        vipCount: Math.min(6, 4 + Math.floor(extra / 2)),
        hasScanner: true,
        mechanicTag: 'ENDLESS',
      };
    }
  }
}

export function generateLevel(levelNumber: number): LevelConfig {
  const recipe = getLevelRecipe(levelNumber);
  const colors = ALL_COLORS.slice(0, recipe.colorCount);

  // Try deterministic seeds until we get a verified solvable configuration
  for (let attempt = 0; attempt < 25; attempt++) {
    const rng = createRng(levelNumber * 7919 + attempt * 104729 + 31337);

    // Build balanced truck queue (ensure each color appears at least once)
    const truckQueue: ParcelColor[] = [];
    for (let i = 0; i < recipe.totalTrucks; i++) {
      if (i < colors.length) {
        truckQueue.push(colors[i]);
      } else {
        truckQueue.push(colors[Math.floor(rng() * colors.length)]);
      }
    }
    const shuffledTrucks = shuffleWithRng(truckQueue, rng);

    // Build exact 3x parcels per truck
    const rawColors: ParcelColor[] = [];
    for (const tColor of shuffledTrucks) {
      rawColors.push(tColor, tColor, tColor);
    }
    const shuffledParcels = shuffleWithRng(rawColors, rng);

    // Assign parcel kinds
    const parcels: LevelParcelSpec[] = shuffledParcels.map((color) => ({
      color,
      kind: 'normal' as ParcelKind,
    }));

    // Assign VIPs first (preferring colors that appear early in the truck queue so they're fair)
    const earlyTruckColors = new Set(shuffledTrucks.slice(0, recipe.activeTruckCount + 2));
    let vipAssigned = 0;
    const indices = shuffleWithRng(
      parcels.map((_, i) => i),
      rng
    );

    for (const idx of indices) {
      if (vipAssigned >= recipe.vipCount) break;
      if (earlyTruckColors.has(parcels[idx].color)) {
        parcels[idx].kind = 'vip';
        vipAssigned++;
      }
    }

    // Assign taped and mystery parcels
    for (const idx of indices) {
      if (parcels[idx].kind !== 'normal') continue;
      const roll = rng();
      if (roll < recipe.tapedRatio) {
        parcels[idx].kind = 'taped';
      } else if (roll < recipe.tapedRatio + recipe.mysteryRatio) {
        parcels[idx].kind = 'mystery';
      }
    }

    const config: LevelConfig = {
      levelNumber,
      activeTruckCount: recipe.activeTruckCount,
      colors,
      truckQueue: shuffledTrucks,
      parcels,
      beltSpeed: recipe.beltSpeed,
      hasScanner: recipe.hasScanner,
      mechanicTag: recipe.mechanicTag,
    };

    if (isLevelSolvable(config)) {
      return config;
    }
  }

  // Fallback guaranteed solvable config
  const fallbackTrucks: ParcelColor[] = [];
  for (let i = 0; i < recipe.totalTrucks; i++) {
    fallbackTrucks.push(colors[i % colors.length]);
  }
  const fallbackParcels: LevelParcelSpec[] = [];
  for (const c of fallbackTrucks) {
    fallbackParcels.push({ color: c, kind: 'normal' }, { color: c, kind: 'normal' }, { color: c, kind: 'normal' });
  }
  return {
    levelNumber,
    activeTruckCount: recipe.activeTruckCount,
    colors,
    truckQueue: fallbackTrucks,
    parcels: fallbackParcels,
    beltSpeed: recipe.beltSpeed,
    hasScanner: recipe.hasScanner,
    mechanicTag: recipe.mechanicTag,
  };
}
