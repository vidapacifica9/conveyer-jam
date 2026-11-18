import { soundEngine } from '../audio/soundEngine';
import { PARCEL_COLORS } from './colors';
import { generateLevel } from './levelGenerator';
import { computeLayout, LayoutMetrics } from './trackGeometry';
import {
  BufferSlot,
  FloatingText,
  FlyingParcel,
  GameSnapshot,
  GameStatus,
  GameTheme,
  LevelConfig,
  Parcel,
  ParcelColor,
  Particle,
  Truck,
} from '../types/game';

export class ConveyorGameEngine {
  public config: LevelConfig;
  public layout: LayoutMetrics;
  public theme: GameTheme = 'classic';

  public status: GameStatus = 'playing';
  public trucks: Truck[] = [];
  public truckQueue: ParcelColor[] = [];
  public totalTrucks: number = 0;
  public trucksDispatched: number = 0;

  public buffer: BufferSlot[] = [];
  public parcels: Parcel[] = [];
  public flyingParcels: FlyingParcel[] = [];
  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];

  public beltScrollPhase: number = 0;
  public scannerFlashTimer: number = 0;
  public screenShake: number = 0;
  public elapsedTime: number = 0;
  public jamReason: string | undefined;

  // Power-ups & Achievement Streak
  public combo: number = 0;
  public magnetTimer: number = 0;
  public freezeTimer: number = 0;
  public earnedMagnetCount: number = 0;
  public timeRemaining: number = 60;
  private powerupEmitAccum: number = 0;
  private lastEmittedSecond: number = 60;

  private nextId = 1;
  private onSnapshotChange?: (snap: GameSnapshot) => void;
  private vipWarnedIds = new Set<string>();

  constructor(
    levelNumber: number,
    width: number,
    height: number,
    onSnapshotChange?: (snap: GameSnapshot) => void
  ) {
    this.onSnapshotChange = onSnapshotChange;
    this.layout = computeLayout(width, height);
    this.config = generateLevel(levelNumber);
    this.initFromConfig();
  }

  private uid(prefix: string): string {
    return `${prefix}_${this.nextId++}`;
  }

  public resize(width: number, height: number): void {
    this.layout = computeLayout(width, height);
    // Update truck target positions
    for (const truck of this.trucks) {
      const targetX = this.layout.getTruckBayX(truck.bayIndex, this.config.activeTruckCount);
      truck.targetX = targetX;
      if (truck.state === 'parked') {
        truck.x = targetX;
      }
      truck.y = this.layout.dockY + this.layout.dockHeight * 0.5;
    }
  }

  public loadLevel(levelNumber: number): void {
    this.config = generateLevel(levelNumber);
    this.initFromConfig();
    this.emitSnapshot();
  }

  public setTheme(theme: GameTheme): void {
    this.theme = theme;
  }

  private initFromConfig(): void {
    this.status = 'playing';
    this.trucks = [];
    this.truckQueue = [...this.config.truckQueue];
    this.totalTrucks = this.config.truckQueue.length;
    this.trucksDispatched = 0;
    this.flyingParcels = [];
    this.particles = [];
    this.floatingTexts = [];
    this.beltScrollPhase = 0;
    this.scannerFlashTimer = 0;
    this.screenShake = 0;
    this.elapsedTime = 0;
    this.jamReason = undefined;
    this.combo = 0;
    this.magnetTimer = 0;
    this.freezeTimer = 0;
    this.earnedMagnetCount = 0;
    this.powerupEmitAccum = 0;
    this.timeRemaining = Math.round(28 + this.totalTrucks * 4.5);
    this.lastEmittedSecond = Math.ceil(this.timeRemaining);
    this.vipWarnedIds.clear();

    // 5-slot holding buffer
    this.buffer = Array.from({ length: 5 }, () => ({
      parcel: null,
      reserved: false,
      locked: false,
      bounceTimer: 0,
      shakeTimer: 0,
    }));

    // Spawn initial active trucks
    for (let bay = 0; bay < this.config.activeTruckCount; bay++) {
      this.spawnTruckInBay(bay, bay * 0.08);
    }

    // Place parcels evenly around the looping belt
    const count = this.config.parcels.length;
    this.parcels = this.config.parcels.map((spec, idx) => {
      const offset = idx / count;
      return {
        id: this.uid('p'),
        color: spec.color,
        kind: spec.kind,
        taped: spec.kind === 'taped',
        revealed: spec.kind !== 'mystery',
        beltOffset: offset,
        prevBeltOffset: offset,
        loopsRemaining: spec.kind === 'vip' ? 1.6 : 99,
        justUntapedTimer: 0,
        justRevealedTimer: 0,
        tapSquashTimer: 0,
        orderIndex: idx,
      };
    });

    this.emitSnapshot();
  }

  private spawnTruckInBay(bayIndex: number, staggerOffset = 0): void {
    const nextColor = this.truckQueue.shift();
    if (!nextColor) return;

    const targetX = this.layout.getTruckBayX(bayIndex, this.config.activeTruckCount);
    const y = this.layout.dockY + this.layout.dockHeight * 0.5;
    const startX = this.layout.width + this.layout.truckWidth + staggerOffset * 400;

    this.trucks.push({
      id: this.uid('t'),
      color: nextColor,
      slots: [null, null, null],
      reservedSlots: 0,
      state: 'entering',
      bayIndex,
      x: startX,
      y,
      targetX,
      wheelAngle: 0,
      bounceTimer: 0,
      flashTimer: 0,
      slotPopTimers: [0, 0, 0],
    });
  }

  public getSnapshot(): GameSnapshot {
    const lockedCount = this.buffer.filter((s) => s.locked).length;
    const starsEarned = this.status === 'won' ? Math.max(1, 3 - lockedCount) : 0;
    return {
      levelNumber: this.config.levelNumber,
      status: this.status,
      trucksDispatched: this.trucksDispatched,
      totalTrucks: this.totalTrucks,
      mechanicTag: this.config.mechanicTag,
      starsEarned,
      jamReason: this.jamReason,
      isEndless: this.config.levelNumber > 10,
      combo: this.combo,
      magnetTimer: this.magnetTimer,
      freezeTimer: this.freezeTimer,
      earnedMagnetCount: this.earnedMagnetCount,
      timeRemaining: this.timeRemaining,
    };
  }

  public addBonusTime(seconds: number): void {
    this.timeRemaining += seconds;
    this.lastEmittedSecond = Math.ceil(this.timeRemaining);
    this.status = 'playing';
    this.jamReason = undefined;
    this.addFloatingText(this.layout.beltCenterX, this.layout.beltCenterY, `+${seconds}s!`, '#4ADE80');
    soundEngine.playScan();
    this.emitSnapshot();
  }

  public activateMagnet(duration = 6): void {
    if (this.status !== 'playing') return;
    this.magnetTimer = Math.max(this.magnetTimer, duration);
    this.addFloatingText(this.layout.beltCenterX, this.layout.beltCenterY, 'GRAB ANYWHERE!', '#C084FC');
    soundEngine.playScan();
    soundEngine.vibrate([12, 20, 12]);
    this.emitSnapshot();
  }

  public activateFreeze(duration = 5): void {
    if (this.status !== 'playing') return;
    this.freezeTimer = Math.max(this.freezeTimer, duration);
    this.addFloatingText(this.layout.beltCenterX, this.layout.beltCenterY, 'BELT FROZEN!', '#38BDF8');
    soundEngine.playScan();
    soundEngine.vibrate([12, 20, 12]);
    this.emitSnapshot();
  }

  private emitSnapshot(): void {
    this.onSnapshotChange?.(this.getSnapshot());
  }

  public update(dt: number): void {
    const clampedDt = Math.min(dt, 0.05);
    this.elapsedTime += clampedDt;

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - clampedDt * 28);
    }
    if (this.scannerFlashTimer > 0) {
      this.scannerFlashTimer = Math.max(0, this.scannerFlashTimer - clampedDt);
    }

    // Update particles & floating texts even on win/jam for juicy aftermath
    this.updateParticles(clampedDt);
    this.updateFloatingTexts(clampedDt);

    if (this.status !== 'playing') {
      return;
    }

    // Power-up timers
    let powerupTicked = false;
    if (this.magnetTimer > 0) {
      this.magnetTimer = Math.max(0, this.magnetTimer - clampedDt);
      powerupTicked = true;
    }
    if (this.freezeTimer > 0) {
      this.freezeTimer = Math.max(0, this.freezeTimer - clampedDt);
      powerupTicked = true;
    }
    if (powerupTicked) {
      this.powerupEmitAccum += clampedDt;
      if (this.powerupEmitAccum >= 0.2 || (this.magnetTimer === 0 && this.freezeTimer === 0)) {
        this.powerupEmitAccum = 0;
        this.emitSnapshot();
      }
    }

    // Level countdown timer (paused while Freeze power-up is active)
    if (this.freezeTimer <= 0) {
      this.timeRemaining = Math.max(0, this.timeRemaining - clampedDt);
      const sec = Math.ceil(this.timeRemaining);
      if (sec !== this.lastEmittedSecond) {
        this.lastEmittedSecond = sec;
        this.emitSnapshot();
      }
      if (this.timeRemaining <= 0) {
        this.triggerJam("Time's up!");
        return;
      }
    }

    // 1. Scroll conveyor belt (paused while Freeze power-up is active)
    const beltDelta = this.freezeTimer > 0 ? 0 : this.config.beltSpeed * clampedDt;
    this.beltScrollPhase = (this.beltScrollPhase + beltDelta) % 1;

    for (const parcel of this.parcels) {
      parcel.prevBeltOffset = parcel.beltOffset;
      parcel.beltOffset = (parcel.beltOffset + beltDelta) % 1;

      if (parcel.justUntapedTimer > 0) {
        parcel.justUntapedTimer = Math.max(0, parcel.justUntapedTimer - clampedDt);
      }
      if (parcel.justRevealedTimer > 0) {
        parcel.justRevealedTimer = Math.max(0, parcel.justRevealedTimer - clampedDt);
      }
      if (parcel.tapSquashTimer > 0) {
        parcel.tapSquashTimer = Math.max(0, parcel.tapSquashTimer - clampedDt);
      }

      // Scanner Arch check (Level 7+)
      if (this.config.hasScanner && !parcel.revealed) {
        if (this.crossedOffset(parcel.prevBeltOffset, parcel.beltOffset, this.layout.scannerOffset)) {
          parcel.revealed = true;
          parcel.justRevealedTimer = 0.45;
          this.scannerFlashTimer = 0.25;
          const pt = this.layout.getBeltPoint(parcel.beltOffset);
          this.spawnSparkles(pt.x, pt.y, '#38BDF8', 8);
          this.addFloatingText(pt.x, pt.y - 20, 'SCANNED!', '#38BDF8');
          soundEngine.playScan();
        }
      }

      // VIP Express countdown (Level 9+)
      if (parcel.kind === 'vip') {
        parcel.loopsRemaining -= beltDelta;
        if (parcel.loopsRemaining <= 0.65 && !this.vipWarnedIds.has(parcel.id)) {
          this.vipWarnedIds.add(parcel.id);
          soundEngine.playVipWarning();
        }
        if (parcel.loopsRemaining <= 0) {
          this.handleVipExpired(parcel);
        }
      }
    }

    // 2. Update trucks (slide in/out, bounce, completion flash)
    this.updateTrucks(clampedDt);

    // 3. Update buffer slot animations
    for (const slot of this.buffer) {
      if (slot.bounceTimer > 0) slot.bounceTimer = Math.max(0, slot.bounceTimer - clampedDt);
      if (slot.shakeTimer > 0) slot.shakeTimer = Math.max(0, slot.shakeTimer - clampedDt);
    }

    // 4. Update flying parcels
    this.updateFlyingParcels(clampedDt);

    // 4b. Guarantee any parked truck with open slots pulls matching parcels from the buffer
    for (const truck of this.trucks) {
      if (truck.state === 'parked' && truck.flashTimer <= 0) {
        this.flushBufferToTruck(truck);
      }
    }

    // 5. Check win condition
    if (
      this.trucksDispatched === this.totalTrucks &&
      this.trucks.length === 0 &&
      this.flyingParcels.length === 0
    ) {
      this.status = 'won';
      soundEngine.playWin();
      soundEngine.vibrate([15, 40, 25]);
      this.spawnConfetti(this.layout.width / 2, this.layout.height * 0.35, 42);
      this.emitSnapshot();
    }
  }

  private crossedOffset(prev: number, curr: number, target: number): boolean {
    if (curr >= prev) {
      return prev < target && curr >= target;
    }
    // Wrapped around 1.0 -> 0.0
    return prev < target || curr >= target;
  }

  private handleVipExpired(parcel: Parcel): void {
    // Convert to normal so parcel count remains 3x per truck, but lock 1 open buffer slot as penalty!
    parcel.kind = 'normal';
    parcel.loopsRemaining = 99;

    const pt = this.layout.getBeltPoint(parcel.beltOffset);
    this.spawnSparkles(pt.x, pt.y, '#EF4444', 12);

    const openSlot = this.buffer.find((s) => !s.locked && !s.parcel && !s.reserved);
    if (openSlot) {
      openSlot.locked = true;
      openSlot.shakeTimer = 0.4;
      this.screenShake = 6;
      this.addFloatingText(pt.x, pt.y - 22, 'SLOT LOCKED!', '#F87171');
      soundEngine.playJam();
      soundEngine.vibrate([20, 30, 20]);
    } else {
      // No open buffer slot to lock -> Belt Jammed!
      this.triggerJam('Express parcel expired with no buffer space!');
    }
  }

  private updateTrucks(dt: number): void {
    const toRemove: string[] = [];

    for (const truck of this.trucks) {
      if (truck.bounceTimer > 0) truck.bounceTimer = Math.max(0, truck.bounceTimer - dt);
      for (let i = 0; i < 3; i++) {
        if (truck.slotPopTimers[i] > 0) {
          truck.slotPopTimers[i] = Math.max(0, truck.slotPopTimers[i] - dt);
        }
      }

      if (truck.state === 'entering') {
        const dx = truck.targetX - truck.x;
        const step = Math.min(Math.abs(dx), 680 * dt);
        truck.x += Math.sign(dx) * step;
        truck.wheelAngle -= step * 0.08;

        if (Math.abs(truck.targetX - truck.x) < 1.5) {
          truck.x = truck.targetX;
          truck.state = 'parked';
          truck.bounceTimer = 0.16;
          // Auto-flush any matching parcels from the 5-slot Holding Buffer!
          this.flushBufferToTruck(truck);
        }
      } else if (truck.state === 'parked') {
        if (truck.flashTimer > 0) {
          truck.flashTimer -= dt;
          if (truck.flashTimer <= 0) {
            truck.state = 'leaving';
            const bay = truck.bayIndex;
            this.trucksDispatched++;
            this.emitSnapshot();
            if (this.truckQueue.length > 0) {
              this.spawnTruckInBay(bay, 0.12);
            }
          }
        }
      } else if (truck.state === 'leaving') {
        const speed = 740 * dt;
        truck.x -= speed;
        truck.wheelAngle -= speed * 0.1;

        // Exhaust puffs
        if (Math.random() < 0.45) {
          this.particles.push({
            x: truck.x + this.layout.truckWidth * 0.46,
            y: truck.y + this.layout.truckHeight * 0.25,
            vx: 40 + Math.random() * 35,
            vy: -15 - Math.random() * 20,
            size: 6 + Math.random() * 6,
            color: '#94A3B8',
            alpha: 0.65,
            life: 0,
            maxLife: 0.42,
            rotation: 0,
            vRot: 0,
            shape: 'smoke',
            gravity: -15,
          });
        }

        if (truck.x < -this.layout.truckWidth - 40) {
          toRemove.push(truck.id);
        }
      }
    }

    if (toRemove.length > 0) {
      this.trucks = this.trucks.filter((t) => !toRemove.includes(t.id));
    }
  }

  private flushBufferToTruck(truck: Truck): void {
    const filledCount = truck.slots.filter((s) => s !== null).length;
    let available = 3 - filledCount - truck.reservedSlots;
    if (available <= 0) return;

    for (let i = 0; i < this.buffer.length && available > 0; i++) {
      const slot = this.buffer[i];
      if (slot.parcel && slot.parcel.color === truck.color) {
        const bp = slot.parcel;
        slot.parcel = null;
        slot.bounceTimer = 0.2;

        const targetSlotIdx = filledCount + truck.reservedSlots;
        truck.reservedSlots++;
        available--;

        const startPos = this.layout.getBufferSlotPos(i);
        const endPos = this.layout.getTruckSlotPos(truck.targetX, truck.y, targetSlotIdx);

        this.flyingParcels.push({
          id: bp.id,
          color: bp.color,
          startX: startPos.x,
          startY: startPos.y,
          endX: endPos.x,
          endY: endPos.y,
          arcHeight: 45,
          progress: 0,
          duration: 0.24,
          spin: (Math.random() - 0.5) * 0.6,
          targetType: 'truck',
          targetIndex: this.trucks.indexOf(truck),
          targetTruckId: truck.id,
          targetSlotIndex: targetSlotIdx,
          trail: [],
        });

        soundEngine.playBufferToTruck();
      }
    }
  }

  private updateFlyingParcels(dt: number): void {
    const remaining: FlyingParcel[] = [];

    for (const fp of this.flyingParcels) {
      fp.progress += dt / fp.duration;

      // Record trail
      const t = Math.min(1, fp.progress);
      const curX = fp.startX + (fp.endX - fp.startX) * t;
      const curY =
        fp.startY + (fp.endY - fp.startY) * t - Math.sin(t * Math.PI) * fp.arcHeight;
      fp.trail.push({ x: curX, y: curY, alpha: 0.55 });
      if (fp.trail.length > 6) fp.trail.shift();
      for (const tr of fp.trail) tr.alpha *= 0.84;

      if (fp.progress >= 1) {
        this.onFlyingParcelArrived(fp);
      } else {
        remaining.push(fp);
      }
    }

    this.flyingParcels = remaining;
  }

  private onFlyingParcelArrived(fp: FlyingParcel): void {
    if (fp.targetType === 'truck') {
      const truck =
        (fp.targetTruckId ? this.trucks.find((t) => t.id === fp.targetTruckId) : undefined) ??
        this.trucks.find((t) => t.color === fp.color && t.reservedSlots > 0 && t.state !== 'leaving');

      if (!truck) return;

      truck.reservedSlots = Math.max(0, truck.reservedSlots - 1);
      const slotIdx = truck.slots.findIndex((s) => s === null);
      if (slotIdx !== -1) {
        truck.slots[slotIdx] = fp.color;
        truck.slotPopTimers[slotIdx] = 0.28;
        truck.bounceTimer = 0.22;
        this.screenShake = Math.max(this.screenShake, 2.5);

        const pos = this.layout.getTruckSlotPos(truck.x, truck.y, slotIdx);
        this.spawnSparkles(pos.x, pos.y, PARCEL_COLORS[fp.color].light, 7);
        soundEngine.playSlotFill(slotIdx);

        // Check if truck is now 3/3!
        if (truck.slots.every((s) => s !== null)) {
          truck.flashTimer = 0.26;
          truck.bounceTimer = 0.34;
          this.screenShake = 5;
          this.spawnConfetti(truck.x, truck.y - 10, 22);
          this.addFloatingText(truck.x, truck.y - this.layout.truckHeight * 0.55, 'FULL!', '#4ADE80');
          soundEngine.playTruckDepart();
          soundEngine.vibrate([12, 25, 16]);
        }
      }
    } else {
      const slot = this.buffer[fp.targetIndex];
      if (slot) {
        slot.reserved = false;
        slot.parcel = { id: fp.id, color: fp.color };
        slot.bounceTimer = 0.22;
        soundEngine.playBufferDrop();

        // Check if any parked truck wants this color right now (race condition guard)
        const matchingTruck = this.trucks.find(
          (t) =>
            t.state === 'parked' &&
            t.color === fp.color &&
            t.slots.filter((s) => s !== null).length + t.reservedSlots < 3
        );
        if (matchingTruck) {
          this.flushBufferToTruck(matchingTruck);
        } else {
          this.checkPostBufferJam();
        }
      }
    }
  }

  private checkPostBufferJam(): void {
    const allOccupiedOrLocked = this.buffer.every((s) => s.locked || s.parcel !== null || s.reserved);
    if (!allOccupiedOrLocked) return;

    // If any flying parcel is still in flight or any truck is entering/leaving, wait
    if (this.flyingParcels.length > 0) return;
    if (this.trucks.some((t) => t.state !== 'parked' || t.flashTimer > 0)) return;

    // Check if any parcel on the belt matches any parked truck
    const activeColors = new Set(
      this.trucks
        .filter((t) => t.state === 'parked' && t.slots.some((s) => s === null))
        .map((t) => t.color)
    );

    const anyBeltMatch = this.parcels.some((p) => activeColors.has(p.color));
    const anyBufferMatch = this.buffer.some((s) => s.parcel && activeColors.has(s.parcel.color));

    if (!anyBeltMatch && !anyBufferMatch && this.parcels.length > 0) {
      this.triggerJam('Holding tray is full with no matching trucks!');
    }
  }

  private triggerJam(reason: string): void {
    if (this.status !== 'playing') return;
    this.status = 'jammed';
    this.jamReason = reason;
    this.screenShake = 11;
    for (const s of this.buffer) s.shakeTimer = 0.45;
    soundEngine.playJam();
    soundEngine.vibrate([30, 40, 50]);
    this.emitSnapshot();
  }

  /** Handle tap/click at logical canvas coordinates (x, y) */
  public handleTap(x: number, y: number): void {
    if (this.status !== 'playing') return;

    const hitRadius = this.layout.parcelSize * 0.78;
    let bestParcel: Parcel | null = null;
    let bestDist = Infinity;

    for (const parcel of this.parcels) {
      const pt = this.layout.getBeltPoint(parcel.beltOffset);
      const dist = Math.hypot(pt.x - x, pt.y - y);
      if (dist <= hitRadius && dist < bestDist) {
        bestDist = dist;
        bestParcel = parcel;
      }
    }

    if (!bestParcel) return;

    const pt = this.layout.getBeltPoint(bestParcel.beltOffset);

    // Must be inside the active Pickup Zone unless Magnet (Grab Anywhere) is active
    if (this.magnetTimer <= 0 && !this.layout.isInPickupZone(bestParcel.beltOffset)) {
      bestParcel.tapSquashTimer = 0.2;
      this.addFloatingText(pt.x, pt.y - 20, 'WAIT!', '#94A3B8');
      soundEngine.playBufferDrop();
      return;
    }

    // 1. Taped / Crated parcel: first tap removes the tape/crate (or web in Web-Slinger theme)
    if (bestParcel.taped) {
      bestParcel.taped = false;
      bestParcel.justUntapedTimer = 0.3;
      bestParcel.tapSquashTimer = 0.22;
      if (this.theme === 'webslinger') {
        this.spawnSparkles(pt.x, pt.y, '#F8FAFC', 10);
        this.addFloatingText(pt.x, pt.y - 22, 'UNWEBBED!', '#38BDF8');
      } else {
        this.spawnWoodSplinters(pt.x, pt.y);
        this.addFloatingText(pt.x, pt.y - 22, 'OPENED!', '#FDE047');
      }
      soundEngine.playUntape();
      soundEngine.vibrate(10);
      return;
    }

    // Reveal mystery parcel if tapped directly
    if (!bestParcel.revealed) {
      bestParcel.revealed = true;
      bestParcel.justRevealedTimer = 0.35;
    }

    soundEngine.playTap();
    soundEngine.vibrate(10);

    // 2. Check if an active (parked or entering) truck matches this color and has space
    const matchingTruckIdx = this.trucks.findIndex((t) => {
      if (t.state === 'leaving' || t.flashTimer > 0) return false;
      if (t.color !== bestParcel!.color) return false;
      const filled = t.slots.filter((s) => s !== null).length;
      return filled + t.reservedSlots < 3;
    });

    if (matchingTruckIdx !== -1) {
      const truck = this.trucks[matchingTruckIdx];
      const filled = truck.slots.filter((s) => s !== null).length;
      const targetSlotIdx = filled + truck.reservedSlots;
      truck.reservedSlots++;

      this.removeParcelFromBelt(bestParcel);
      const endPos = this.layout.getTruckSlotPos(truck.targetX, truck.y, targetSlotIdx);

      // Direct-load combo streak achievement: 4 direct loads in a row earns +1 Magnet!
      this.combo++;
      if (this.combo >= 4) {
        this.combo = 0;
        this.earnedMagnetCount++;
        this.addFloatingText(pt.x, pt.y - 26, '+1 MAGNET!', '#C084FC');
        soundEngine.playScan();
      }
      this.emitSnapshot();

      this.flyingParcels.push({
        id: bestParcel.id,
        color: bestParcel.color,
        startX: pt.x,
        startY: pt.y,
        endX: endPos.x,
        endY: endPos.y,
        arcHeight: 65,
        progress: 0,
        duration: 0.3,
        spin: (Math.random() - 0.5) * 1.4,
        targetType: 'truck',
        targetIndex: matchingTruckIdx,
        targetTruckId: truck.id,
        targetSlotIndex: targetSlotIdx,
        trail: [],
      });
      return;
    }

    // 3. Otherwise, send to first open slot in the 5-slot Holding Buffer
    const openBufferIdx = this.buffer.findIndex((s) => !s.locked && !s.parcel && !s.reserved);
    if (openBufferIdx !== -1) {
      const slot = this.buffer[openBufferIdx];
      slot.reserved = true;
      if (this.combo > 0) {
        this.combo = 0;
        this.emitSnapshot();
      }
      this.removeParcelFromBelt(bestParcel);
      const endPos = this.layout.getBufferSlotPos(openBufferIdx);

      this.flyingParcels.push({
        id: bestParcel.id,
        color: bestParcel.color,
        startX: pt.x,
        startY: pt.y,
        endX: endPos.x,
        endY: endPos.y,
        arcHeight: 42,
        progress: 0,
        duration: 0.24,
        spin: (Math.random() - 0.5) * 0.9,
        targetType: 'buffer',
        targetIndex: openBufferIdx,
        trail: [],
      });
      return;
    }

    // 4. Nowhere to go -> Belt Jammed!
    this.triggerJam('No open slots left in the Holding Tray!');
  }

  private removeParcelFromBelt(parcel: Parcel): void {
    this.parcels = this.parcels.filter((p) => p.id !== parcel.id);

    // Reveal adjacent mystery parcels on the belt
    for (const other of this.parcels) {
      if (!other.revealed && Math.abs(other.orderIndex - parcel.orderIndex) === 1) {
        other.revealed = true;
        other.justRevealedTimer = 0.45;
        const pt = this.layout.getBeltPoint(other.beltOffset);
        this.spawnSparkles(pt.x, pt.y, '#38BDF8', 8);
        soundEngine.playScan();
      }
    }
  }

  private spawnSparkles(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 55 + Math.random() * 95;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 3.5,
        color,
        alpha: 1,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.2,
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 8,
        shape: 'star',
        gravity: 120,
      });
    }
  }

  private spawnWoodSplinters(x: number, y: number): void {
    const colors = ['#D97706', '#F59E0B', '#FDE68A', '#92400E'];
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI + Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 110;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        size: 4 + Math.random() * 4,
        color: colors[i % colors.length],
        alpha: 1,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.18,
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 14,
        shape: 'rect',
        gravity: 340,
      });
    }
  }

  private spawnConfetti(x: number, y: number, count: number): void {
    const palette = ['#EF4444', '#3B82F6', '#FACC15', '#22C55E', '#A855F7', '#FFFFFF'];
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const speed = 110 + Math.random() * 190;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        size: 4 + Math.random() * 4.5,
        color: palette[i % palette.length],
        alpha: 1,
        life: 0,
        maxLife: 0.75 + Math.random() * 0.45,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 12,
        shape: i % 2 === 0 ? 'rect' : 'circle',
        gravity: 320,
      });
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string): void {
    this.floatingTexts.push({
      x,
      y,
      vy: -42,
      text,
      color,
      life: 0,
      maxLife: 0.72,
      scale: 1,
    });
  }

  private updateParticles(dt: number): void {
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.life += dt;
      if (p.life >= p.maxLife) continue;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.vRot * dt;
      p.alpha = 1 - p.life / p.maxLife;
      alive.push(p);
    }
    this.particles = alive;
  }

  private updateFloatingTexts(dt: number): void {
    const alive: FloatingText[] = [];
    for (const ft of this.floatingTexts) {
      ft.life += dt;
      if (ft.life >= ft.maxLife) continue;
      ft.y += ft.vy * dt;
      alive.push(ft);
    }
    this.floatingTexts = alive;
  }
}
