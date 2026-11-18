import { PARCEL_COLORS } from './colors';
import { ConveyorGameEngine } from './gameEngine';
import { Parcel, ParcelColor, SymbolShape, Truck } from '../types/game';

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawSymbol(
  ctx: CanvasRenderingContext2D,
  shape: SymbolShape,
  cx: number,
  cy: number,
  radius: number,
  fillStyle: string
) {
  ctx.save();
  ctx.fillStyle = fillStyle;
  ctx.beginPath();

  switch (shape) {
    case 'circle': {
      ctx.arc(cx, cy, radius * 0.85, 0, Math.PI * 2);
      break;
    }
    case 'triangle': {
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
        const px = cx + Math.cos(a) * radius;
        const py = cy + Math.sin(a) * radius + radius * 0.12;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'diamond': {
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx + radius * 0.85, cy);
      ctx.lineTo(cx, cy + radius);
      ctx.lineTo(cx - radius * 0.85, cy);
      ctx.closePath();
      break;
    }
    case 'hexagon': {
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 6 + (i * Math.PI) / 3;
        const px = cx + Math.cos(a) * radius * 0.92;
        const py = cy + Math.sin(a) * radius * 0.92;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'star': {
      const spikes = 5;
      const outer = radius * 1.02;
      const inner = radius * 0.45;
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = -Math.PI / 2 + (i * Math.PI) / spikes;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
  }

  ctx.fill();
  ctx.restore();
}

function drawParcelBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: ParcelColor,
  options: {
    taped?: boolean;
    revealed?: boolean;
    isVip?: boolean;
    vipLoops?: number;
    scaleX?: number;
    scaleY?: number;
    rotation?: number;
    elapsed?: number;
    webslinger?: boolean;
  } = {}
) {
  const {
    taped = false,
    revealed = true,
    isVip = false,
    vipLoops = 2,
    scaleX = 1,
    scaleY = 1,
    rotation = 0,
    elapsed = 0,
    webslinger = false,
  } = options;

  ctx.save();
  ctx.translate(x, y);
  if (rotation !== 0) ctx.rotate(rotation);
  ctx.scale(scaleX, scaleY);

  const half = size / 2;

  // Drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  drawRoundedRect(ctx, -half + 1, -half + 4, size, size, 9);
  ctx.fill();

  if (!revealed) {
    // Mystery wrapped parcel
    const grad = ctx.createLinearGradient(-half, -half, half, half);
    grad.addColorStop(0, '#475569');
    grad.addColorStop(0.5, '#64748B');
    grad.addColorStop(1, '#334155');
    ctx.fillStyle = grad;
    drawRoundedRect(ctx, -half, -half, size, size, 9);
    ctx.fill();

    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Diagonal mystery ribbon
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-half + 5, half - 5);
    ctx.lineTo(half - 5, -half + 5);
    ctx.stroke();

    // Bold '?'
    ctx.fillStyle = '#E2E8F0';
    ctx.font = `900 ${Math.round(size * 0.52)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, 2);

    ctx.restore();
    return;
  }

  const theme = PARCEL_COLORS[color];

  // VIP outer pulsing aura
  if (isVip) {
    const urgency = vipLoops < 0.65 ? 10 : 4;
    const pulse = 0.6 + 0.4 * Math.sin(elapsed * urgency);
    ctx.shadowColor = vipLoops < 0.65 ? '#EF4444' : '#FACC15';
    ctx.shadowBlur = 10 + pulse * 8;
  }

  // Main parcel body
  ctx.fillStyle = theme.fill;
  drawRoundedRect(ctx, -half, -half, size, size, 9);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Top glossy highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
  drawRoundedRect(ctx, -half + 3, -half + 2.5, size - 6, size * 0.34, 6);
  ctx.fill();

  // Bottom bevel
  ctx.fillStyle = theme.dark;
  drawRoundedRect(ctx, -half + 2, half - 6, size - 4, 4.5, 3);
  ctx.fill();

  // Outer crisp border
  ctx.strokeStyle = isVip ? '#FDE047' : theme.border;
  ctx.lineWidth = isVip ? 2.5 : 1.75;
  drawRoundedRect(ctx, -half, -half, size, size, 9);
  ctx.stroke();

  // Colorblind symbol
  drawSymbol(ctx, theme.shape, 0, -0.5, size * 0.25, theme.text);

  // Taped / Crated (or Webbed in Web-Slinger theme) overlay
  if (taped) {
    if (webslinger) {
      // Translucent web tint
      ctx.fillStyle = 'rgba(241, 245, 249, 0.28)';
      drawRoundedRect(ctx, -half - 1, -half - 1, size + 2, size + 2, 9);
      ctx.fill();

      // Spider-web radial strands
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.92)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * (half + 1), Math.sin(a) * (half + 1));
      }
      ctx.stroke();

      // Concentric web rings
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, half * 0.42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, half * 0.78, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Wooden crate frame
      ctx.fillStyle = 'rgba(180, 118, 48, 0.88)';
      drawRoundedRect(ctx, -half - 1, -half - 1, size + 2, size + 2, 9);
      ctx.fill();

      // Crate slats
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, -half - 1, -half - 1, size + 2, size + 2, 9);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-half + 4, -half + 4);
      ctx.lineTo(half - 4, half - 4);
      ctx.moveTo(half - 4, -half + 4);
      ctx.lineTo(-half + 4, half - 4);
      ctx.strokeStyle = 'rgba(120, 53, 15, 0.65)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Tan packing tape strip across center
      ctx.fillStyle = '#FDE68A';
      drawRoundedRect(ctx, -half - 1, -5, size + 2, 10, 2);
      ctx.fill();
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Peek dot of underlying color in center
      ctx.fillStyle = theme.fill;
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // VIP radial countdown ring + Express lightning badge (Level 7+)
  if (isVip) {
    const ratio = Math.max(0, Math.min(1, vipLoops / 1.6));
    const isUrgent = vipLoops < 0.65;
    const ringR = half + 5;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(0, 0, ringR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = isUrgent ? '#EF4444' : '#FACC15';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Top-right Express lightning badge
    const bx = half - 2;
    const by = -half + 2;
    ctx.fillStyle = isUrgent ? '#EF4444' : '#FACC15';
    ctx.beginPath();
    ctx.arc(bx, by, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Lightning bolt icon inside badge
    ctx.fillStyle = isUrgent ? '#FFFFFF' : '#0F172A';
    ctx.beginPath();
    ctx.moveTo(bx + 1, by - 4.5);
    ctx.lineTo(bx - 3, by + 0.5);
    ctx.lineTo(bx, by + 0.5);
    ctx.lineTo(bx - 1, by + 4.5);
    ctx.lineTo(bx + 3, by - 0.5);
    ctx.lineTo(bx, by - 0.5);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawTruck(
  ctx: CanvasRenderingContext2D,
  truck: Truck,
  w: number,
  h: number,
  engine: ConveyorGameEngine
) {
  const theme = PARCEL_COLORS[truck.color];

  // Squash-and-stretch curve on impact
  let sx = 1;
  let sy = 1;
  if (truck.bounceTimer > 0) {
    const t = truck.bounceTimer / 0.25;
    const wave = Math.sin(t * Math.PI * 2) * 0.08 * t;
    sx = 1 + wave;
    sy = 1 - wave;
  }

  ctx.save();
  ctx.translate(truck.x, truck.y);
  ctx.scale(sx, sy);

  const left = -w / 2;
  const top = -h / 2;

  // Shadow underneath truck
  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  drawRoundedRect(ctx, left + 4, h / 2 - 6, w - 6, 10, 5);
  ctx.fill();

  const cabW = w * 0.24;
  const trailerW = w * 0.74;
  const trailerX = left + cabW + 2;
  const trailerH = h * 0.72;
  const trailerY = top + 6;

  // Cab (left-facing)
  ctx.fillStyle = theme.dark;
  drawRoundedRect(ctx, left, top + h * 0.22, cabW + 4, h * 0.56, 7);
  ctx.fill();

  // Windshield
  ctx.fillStyle = '#BAE6FD';
  drawRoundedRect(ctx, left + 3, top + h * 0.27, cabW * 0.65, h * 0.22, 4);
  ctx.fill();

  // Headlight glow when leaving
  if (truck.state === 'leaving') {
    ctx.fillStyle = 'rgba(254, 240, 138, 0.75)';
    ctx.beginPath();
    ctx.moveTo(left, top + h * 0.62);
    ctx.lineTo(left - 28, top + h * 0.48);
    ctx.lineTo(left - 28, top + h * 0.78);
    ctx.closePath();
    ctx.fill();
  }

  // Cargo Trailer
  ctx.fillStyle = truck.flashTimer > 0 ? '#FEF08A' : theme.fill;
  drawRoundedRect(ctx, trailerX, trailerY, trailerW, trailerH, 9);
  ctx.fill();

  ctx.strokeStyle = truck.flashTimer > 0 ? '#FFFFFF' : theme.border;
  ctx.lineWidth = 2;
  strokeRoundedRect(ctx, trailerX, trailerY, trailerW, trailerH, 9);

  // Colorblind badge on top of trailer
  const badgeR = 9;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
  ctx.beginPath();
  ctx.arc(trailerX + trailerW / 2, trailerY + 12, badgeR, 0, Math.PI * 2);
  ctx.fill();
  drawSymbol(ctx, theme.shape, trailerX + trailerW / 2, trailerY + 12, 5.5, '#FFFFFF');

  // 3 Cargo Slots inside trailer
  const slotSize = Math.min(24, (trailerW - 16) / 3);
  const slotGap = 3;
  const slotsTotalW = 3 * slotSize + 2 * slotGap;
  const slotsStartX = trailerX + (trailerW - slotsTotalW) / 2;
  const slotY = trailerY + trailerH - slotSize - 7;

  for (let i = 0; i < 3; i++) {
    const sxPos = slotsStartX + i * (slotSize + slotGap);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    drawRoundedRect(ctx, sxPos, slotY, slotSize, slotSize, 5);
    ctx.fill();

    const filledColor = truck.slots[i];
    if (filledColor) {
      const pop = truck.slotPopTimers[i];
      const scale = pop > 0 ? 1 + Math.sin((pop / 0.28) * Math.PI) * 0.28 : 1;
      drawParcelBox(ctx, sxPos + slotSize / 2, slotY + slotSize / 2, slotSize - 2, filledColor, {
        scaleX: scale,
        scaleY: scale,
        elapsed: engine.elapsedTime,
      });
    }
  }

  // Wheels
  const wheelY = top + h * 0.78;
  const wheelPositions = [left + cabW * 0.55, trailerX + trailerW * 0.25, trailerX + trailerW * 0.78];
  for (const wx of wheelPositions) {
    ctx.save();
    ctx.translate(wx, wheelY);
    ctx.rotate(truck.wheelAngle);
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#94A3B8';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function strokeRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  drawRoundedRect(ctx, x, y, w, h, r);
  ctx.stroke();
}

export function renderGame(ctx: CanvasRenderingContext2D, engine: ConveyorGameEngine): void {
  const { layout } = engine;
  const { width, height } = layout;

  ctx.save();

  // Subtle screen shake on impact
  if (engine.screenShake > 0.1) {
    const dx = (Math.random() - 0.5) * engine.screenShake;
    const dy = (Math.random() - 0.5) * engine.screenShake;
    ctx.translate(dx, dy);
  }

  // 1. Background
  const isWeb = engine.theme === 'webslinger';
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  if (isWeb) {
    bgGrad.addColorStop(0, '#1E113A');
    bgGrad.addColorStop(0.5, '#130B29');
    bgGrad.addColorStop(1, '#090616');
  } else {
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(1, '#020617');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Web-Slinger City skyline silhouette
  if (isWeb) {
    ctx.fillStyle = 'rgba(15, 10, 36, 0.72)';
    const buildings = [
      { x: 0, w: 46, h: 120 },
      { x: 44, w: 38, h: 165 },
      { x: 80, w: 52, h: 110 },
      { x: 130, w: 44, h: 185 },
      { x: 172, w: 56, h: 135 },
      { x: 226, w: 42, h: 175 },
      { x: 266, w: 54, h: 125 },
      { x: 318, w: 48, h: 160 },
      { x: 364, w: 80, h: 130 },
    ];
    const baseLine = height * 0.43;
    for (let bi = 0; bi < buildings.length; bi++) {
      const b = buildings[bi];
      ctx.fillRect(b.x, baseLine - b.h, b.w, b.h);
      // Lit comic skyscraper windows
      ctx.fillStyle = bi % 2 === 0 ? 'rgba(250, 204, 21, 0.28)' : 'rgba(56, 189, 248, 0.25)';
      for (let wy = baseLine - b.h + 12; wy < baseLine - 18; wy += 16) {
        for (let wx = b.x + 8; wx < b.x + b.w - 10; wx += 12) {
          if ((wx + wy + bi) % 3 !== 0) {
            ctx.fillRect(wx, wy, 5, 7);
          }
        }
      }
      ctx.fillStyle = 'rgba(15, 10, 36, 0.72)';
    }
    // Spider-web corner motif in top-left & top-right sky
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.14)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 4; i++) {
      const a = (i * Math.PI) / 8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 110, Math.sin(a) * 110);
      ctx.stroke();
    }
    // Subtle comic skyline accent line
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, baseLine);
    ctx.lineTo(width, baseLine);
    ctx.stroke();
  }

  // Subtle industrial floor grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.04)';
  ctx.lineWidth = 1;
  const gridSize = 28;
  for (let gx = 0; gx < width; gx += gridSize) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, height);
    ctx.stroke();
  }
  for (let gy = 0; gy < height; gy += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(width, gy);
    ctx.stroke();
  }

  // 2. Loading Dock Bays (Top)
  for (let bay = 0; bay < engine.config.activeTruckCount; bay++) {
    const bx = layout.getTruckBayX(bay, engine.config.activeTruckCount);
    const by = layout.dockY + layout.dockHeight * 0.5;
    ctx.save();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    strokeRoundedRect(
      ctx,
      bx - layout.truckWidth / 2 - 3,
      by - layout.truckHeight / 2 - 3,
      layout.truckWidth + 6,
      layout.truckHeight + 6,
      10
    );
    ctx.restore();
  }

  // Draw Trucks
  for (const truck of engine.trucks) {
    drawTruck(ctx, truck, layout.truckWidth, layout.truckHeight, engine);
  }

  // 3. Holding Buffer Tray (Middle)
  const occupiedCount = engine.buffer.filter((s) => s.parcel !== null || s.locked).length;
  const isDanger = occupiedCount >= 4;
  const trayPad = 10;
  const firstPos = layout.getBufferSlotPos(0);
  const lastPos = layout.getBufferSlotPos(4);
  const trayX = firstPos.x - layout.bufferSlotSize / 2 - trayPad;
  const trayY = layout.bufferY + layout.bufferHeight / 2 - layout.bufferSlotSize / 2 - trayPad;
  const trayW = lastPos.x - firstPos.x + layout.bufferSlotSize + trayPad * 2;
  const trayH = layout.bufferSlotSize + trayPad * 2;

  ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
  drawRoundedRect(ctx, trayX, trayY, trayW, trayH, 16);
  ctx.fill();

  ctx.strokeStyle = isDanger
    ? `rgba(239, 68, 68, ${0.55 + 0.35 * Math.sin(engine.elapsedTime * 8)})`
    : 'rgba(148, 163, 184, 0.25)';
  ctx.lineWidth = isDanger ? 2.5 : 1.5;
  strokeRoundedRect(ctx, trayX, trayY, trayW, trayH, 16);

  // Buffer Slots
  const hasUrgentVip = engine.parcels.some((p) => p.kind === 'vip' && p.loopsRemaining < 0.65);
  const firstOpenIdx = engine.buffer.findIndex((s) => !s.locked && !s.parcel && !s.reserved);

  for (let i = 0; i < 5; i++) {
    const slot = engine.buffer[i];
    const pos = layout.getBufferSlotPos(i);
    const sSize = layout.bufferSlotSize;
    const shakeX = slot.shakeTimer > 0 ? Math.sin(slot.shakeTimer * 45) * 4 : 0;
    const isVipTarget = hasUrgentVip && i === firstOpenIdx;

    ctx.save();
    ctx.translate(pos.x + shakeX, pos.y);

    ctx.fillStyle = slot.locked ? 'rgba(127, 29, 29, 0.5)' : 'rgba(15, 23, 42, 0.85)';
    drawRoundedRect(ctx, -sSize / 2, -sSize / 2, sSize, sSize, 10);
    ctx.fill();

    ctx.strokeStyle = slot.locked
      ? '#EF4444'
      : isVipTarget
      ? `rgba(239, 68, 68, ${0.45 + 0.45 * Math.sin(engine.elapsedTime * 12)})`
      : 'rgba(71, 85, 105, 0.6)';
    ctx.lineWidth = isVipTarget ? 2.5 : 1.5;
    strokeRoundedRect(ctx, -sSize / 2, -sSize / 2, sSize, sSize, 10);

    if (slot.locked) {
      // Lock icon
      ctx.fillStyle = '#FCA5A5';
      ctx.fillRect(-7, -2, 14, 11);
      ctx.strokeStyle = '#FCA5A5';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, -3, 5, Math.PI, 0);
      ctx.stroke();
    } else if (slot.parcel) {
      const bScale =
        slot.bounceTimer > 0 ? 1 + Math.sin((slot.bounceTimer / 0.22) * Math.PI) * 0.2 : 1;
      drawParcelBox(ctx, 0, 0, sSize - 10, slot.parcel.color, {
        scaleX: bScale,
        scaleY: bScale,
        elapsed: engine.elapsedTime,
      });
    }

    ctx.restore();
  }

  // 4. Conveyor Belt Loop (Bottom)
  const beltX = layout.beltCenterX - layout.beltWidth / 2;
  const beltY = layout.beltCenterY - layout.beltHeight / 2;

  // Outer belt housing (glows violet on Magnet, icy cyan on Freeze, Spider-Red in Web-Slinger)
  const magnetOn = engine.magnetTimer > 0;
  const freezeOn = engine.freezeTimer > 0;
  ctx.fillStyle = freezeOn
    ? '#162A3E'
    : magnetOn
    ? '#24183B'
    : isWeb
    ? '#1B1438'
    : '#1E293B';
  drawRoundedRect(ctx, beltX, beltY, layout.beltWidth, layout.beltHeight, layout.beltCornerRadius);
  ctx.fill();
  ctx.strokeStyle = freezeOn
    ? '#38BDF8'
    : magnetOn
    ? '#C084FC'
    : isWeb
    ? '#EF4444'
    : '#475569';
  ctx.lineWidth = freezeOn || magnetOn || isWeb ? 3.5 : 3;
  strokeRoundedRect(ctx, beltX, beltY, layout.beltWidth, layout.beltHeight, layout.beltCornerRadius);

  // Inner cutout (center island)
  const innerPad = layout.beltTrackWidth;
  const innerW = layout.beltWidth - innerPad * 2;
  const innerH = layout.beltHeight - innerPad * 2;
  if (innerW > 10 && innerH > 10) {
    ctx.fillStyle = '#0B1120';
    drawRoundedRect(
      ctx,
      beltX + innerPad,
      beltY + innerPad,
      innerW,
      innerH,
      Math.max(12, layout.beltCornerRadius - innerPad)
    );
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.5;
    strokeRoundedRect(
      ctx,
      beltX + innerPad,
      beltY + innerPad,
      innerW,
      innerH,
      Math.max(12, layout.beltCornerRadius - innerPad)
    );
  }

  // Animated conveyor belt slats along the centerline
  const slatCount = 34;
  for (let i = 0; i < slatCount; i++) {
    const off = (i / slatCount + engine.beltScrollPhase) % 1;
    const pt = layout.getBeltPoint(off);
    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.rotate(pt.angle);
    ctx.fillStyle = layout.isInPickupZone(off)
      ? 'rgba(52, 211, 153, 0.28)'
      : 'rgba(148, 163, 184, 0.14)';
    ctx.fillRect(-2, -layout.beltTrackWidth * 0.38, 4, layout.beltTrackWidth * 0.76);
    ctx.restore();
  }

  // Active Pickup Zone highlight along top straight of belt
  const zonePad = 14;
  const zoneW = Math.max(80, layout.beltWidth - layout.beltCornerRadius * 1.4);
  const zoneX = layout.beltCenterX - zoneW / 2;
  const zoneY = beltY - 3;
  const zoneH = layout.beltTrackWidth + 6;
  ctx.save();
  ctx.fillStyle = 'rgba(16, 185, 129, 0.09)';
  drawRoundedRect(ctx, zoneX - zonePad, zoneY, zoneW + zonePad * 2, zoneH, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.6)';
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 5]);
  strokeRoundedRect(ctx, zoneX - zonePad, zoneY, zoneW + zonePad * 2, zoneH, 14);
  ctx.restore();

  // Scanner Arch (Level 7+)
  if (engine.config.hasScanner) {
    const scanPt = layout.getBeltPoint(layout.scannerOffset);
    ctx.save();
    ctx.translate(scanPt.x, scanPt.y);
    ctx.rotate(scanPt.angle);

    // Laser beam across track
    const flash = engine.scannerFlashTimer > 0;
    ctx.strokeStyle = flash ? '#FFFFFF' : 'rgba(56, 189, 248, 0.75)';
    ctx.lineWidth = flash ? 4 : 2;
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = flash ? 18 : 10;
    ctx.beginPath();
    ctx.moveTo(0, -layout.beltTrackWidth * 0.52);
    ctx.lineTo(0, layout.beltTrackWidth * 0.52);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Arch pillars
    ctx.fillStyle = '#0EA5E9';
    drawRoundedRect(ctx, -7, -layout.beltTrackWidth * 0.62, 14, 10, 3);
    ctx.fill();
    drawRoundedRect(ctx, -7, layout.beltTrackWidth * 0.62 - 10, 14, 10, 3);
    ctx.fill();

    ctx.restore();
  }

  // Parcels on the belt
  for (const parcel of engine.parcels) {
    drawBeltParcel(ctx, parcel, engine);
  }

  // 5. Flying Parcels (parabolic arc + trail)
  for (const fp of engine.flyingParcels) {
    const t = Math.min(1, fp.progress);
    const easeT = 1 - Math.pow(1 - t, 2);
    const curX = fp.startX + (fp.endX - fp.startX) * easeT;
    const curY =
      fp.startY + (fp.endY - fp.startY) * easeT - Math.sin(t * Math.PI) * fp.arcHeight;

    // Web-Slinger theme: shoot a glowing white web-line from parcel to target!
    if (isWeb) {
      ctx.save();
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.8)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(curX, curY);
      ctx.lineTo(fp.endX, fp.endY);
      ctx.stroke();
      ctx.restore();
    }

    // Motion trail
    for (let i = 0; i < fp.trail.length; i++) {
      const tr = fp.trail[i];
      ctx.fillStyle = PARCEL_COLORS[fp.color].light;
      ctx.globalAlpha = tr.alpha * 0.35;
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, 4 + i * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const arcScale = 1 + Math.sin(t * Math.PI) * 0.28;
    drawParcelBox(ctx, curX, curY, layout.parcelSize * 0.92, fp.color, {
      scaleX: arcScale,
      scaleY: arcScale,
      rotation: fp.spin * t,
      elapsed: engine.elapsedTime,
    });
  }

  // 6. Particles
  for (const p of engine.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;

    if (p.shape === 'rect') {
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
    } else if (p.shape === 'star') {
      drawSymbol(ctx, 'star', 0, 0, p.size, p.color);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 7. Floating Text
  for (const ft of engine.floatingTexts) {
    const t = ft.life / ft.maxLife;
    const alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.font = '900 15px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }

  ctx.restore();
}

function drawBeltParcel(
  ctx: CanvasRenderingContext2D,
  parcel: Parcel,
  engine: ConveyorGameEngine
) {
  const pt = engine.layout.getBeltPoint(parcel.beltOffset);
  const inZone = engine.magnetTimer > 0 || engine.layout.isInPickupZone(parcel.beltOffset);
  let scaleX = inZone ? 1.06 : 0.94;
  let scaleY = inZone ? 1.06 : 0.94;

  if (parcel.justUntapedTimer > 0) {
    const t = parcel.justUntapedTimer / 0.3;
    scaleX *= 1 + Math.sin(t * Math.PI) * 0.25;
    scaleY *= 1 - Math.sin(t * Math.PI) * 0.18;
  } else if (parcel.justRevealedTimer > 0) {
    const t = parcel.justRevealedTimer / 0.45;
    scaleX *= Math.abs(Math.cos(t * Math.PI));
    scaleY *= 1 + Math.sin(t * Math.PI) * 0.2;
  } else if (parcel.tapSquashTimer > 0) {
    const t = parcel.tapSquashTimer / 0.2;
    scaleX *= 1 + Math.sin(t * Math.PI * 2) * 0.12;
    scaleY *= 1 - Math.sin(t * Math.PI * 2) * 0.12;
  }

  ctx.save();
  if (!inZone) {
    ctx.globalAlpha = 0.62;
  }

  drawParcelBox(ctx, pt.x, pt.y, engine.layout.parcelSize, parcel.color, {
    taped: parcel.taped,
    revealed: parcel.revealed,
    isVip: parcel.kind === 'vip',
    vipLoops: parcel.loopsRemaining,
    scaleX,
    scaleY,
    elapsed: engine.elapsedTime,
    webslinger: engine.theme === 'webslinger',
  });

  ctx.restore();
}
