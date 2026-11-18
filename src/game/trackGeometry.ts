export interface LayoutMetrics {
  width: number;
  height: number;
  // Dock (Top)
  dockY: number;
  dockHeight: number;
  truckWidth: number;
  truckHeight: number;
  getTruckBayX: (bayIndex: number, activeCount: number) => number;
  getTruckSlotPos: (truckX: number, truckY: number, slotIndex: number) => { x: number; y: number };
  // Buffer (Middle)
  bufferY: number;
  bufferHeight: number;
  bufferSlotSize: number;
  getBufferSlotPos: (slotIndex: number) => { x: number; y: number };
  // Conveyor Belt (Bottom)
  beltCenterX: number;
  beltCenterY: number;
  beltWidth: number;
  beltHeight: number;
  beltCornerRadius: number;
  beltTrackWidth: number;
  parcelSize: number;
  scannerOffset: number;
  pickupZoneStart: number;
  pickupZoneEnd: number;
  isInPickupZone: (offset: number) => boolean;
  getBeltPoint: (offset: number) => { x: number; y: number; angle: number };
}

export function computeLayout(width: number, height: number): LayoutMetrics {
  const safeW = Math.max(300, width);
  const safeH = Math.max(500, height);

  // Proportional vertical zones (with extra top clearance for iPhone Dynamic Island / safe-area HUD)
  const dockY = safeH * 0.165;
  const dockHeight = safeH * 0.21;

  const bufferY = safeH * 0.415;
  const bufferHeight = safeH * 0.11;

  const beltTop = safeH * 0.545;
  const beltBottom = safeH * 0.885;
  const beltHeight = beltBottom - beltTop;
  const beltWidth = Math.min(safeW - 36, 390);
  const beltCenterX = safeW / 2;
  const beltCenterY = (beltTop + beltBottom) / 2;
  const beltTrackWidth = Math.min(54, Math.max(40, beltHeight * 0.22));
  const beltCornerRadius = Math.min(beltHeight / 2 - 4, beltWidth * 0.28, 72);

  const parcelSize = Math.min(44, Math.max(34, beltTrackWidth * 0.78));

  // Trucks
  const truckWidth = Math.min(116, (safeW - 44) / 3);
  const truckHeight = Math.min(96, dockHeight * 0.78);

  const getTruckBayX = (bayIndex: number, activeCount: number): number => {
    const gap = activeCount === 2 ? 22 : 12;
    const totalW = activeCount * truckWidth + (activeCount - 1) * gap;
    const startX = (safeW - totalW) / 2 + truckWidth / 2;
    return startX + bayIndex * (truckWidth + gap);
  };

  const getTruckSlotPos = (truckX: number, truckY: number, slotIndex: number) => {
    const slotW = (truckWidth - 18) / 3;
    const startX = truckX - slotW;
    return {
      x: startX + slotIndex * slotW,
      y: truckY + 4,
    };
  };

  // Buffer 5 slots
  const bufferSlotSize = Math.min(54, (safeW - 56) / 5);
  const bufferGap = 8;
  const getBufferSlotPos = (slotIndex: number) => {
    const totalW = 5 * bufferSlotSize + 4 * bufferGap;
    const startX = (safeW - totalW) / 2 + bufferSlotSize / 2;
    return {
      x: startX + slotIndex * (bufferSlotSize + bufferGap),
      y: bufferY + bufferHeight / 2,
    };
  };

  // Rounded-rectangle perimeter parameterization for the conveyor belt centerline
  const rx = beltWidth / 2 - beltTrackWidth / 2;
  const ry = beltHeight / 2 - beltTrackWidth / 2;
  const r = Math.max(12, Math.min(beltCornerRadius - beltTrackWidth / 2, rx - 4, ry - 4));

  const straightH = Math.max(0, 2 * (rx - r));
  const straightV = Math.max(0, 2 * (ry - r));
  const arcLen = (Math.PI / 2) * r;
  const perimeter = 2 * straightH + 2 * straightV + 4 * arcLen;

  // Top-left to top-right clockwise
  const getBeltPoint = (rawOffset: number): { x: number; y: number; angle: number } => {
    const offset = ((rawOffset % 1) + 1) % 1;
    let d = offset * perimeter;

    const leftX = beltCenterX - rx;
    const rightX = beltCenterX + rx;
    const topY = beltCenterY - ry;
    const bottomY = beltCenterY + ry;

    // 1. Top straight (left -> right)
    if (d <= straightH) {
      return {
        x: leftX + r + d,
        y: topY,
        angle: 0,
      };
    }
    d -= straightH;

    // 2. Top-right corner
    if (d <= arcLen) {
      const theta = -Math.PI / 2 + (d / arcLen) * (Math.PI / 2);
      return {
        x: rightX - r + Math.cos(theta) * r,
        y: topY + r + Math.sin(theta) * r,
        angle: theta + Math.PI / 2,
      };
    }
    d -= arcLen;

    // 3. Right straight (top -> bottom)
    if (d <= straightV) {
      return {
        x: rightX,
        y: topY + r + d,
        angle: Math.PI / 2,
      };
    }
    d -= straightV;

    // 4. Bottom-right corner
    if (d <= arcLen) {
      const theta = (d / arcLen) * (Math.PI / 2);
      return {
        x: rightX - r + Math.cos(theta) * r,
        y: bottomY - r + Math.sin(theta) * r,
        angle: theta + Math.PI / 2,
      };
    }
    d -= arcLen;

    // 5. Bottom straight (right -> left)
    if (d <= straightH) {
      return {
        x: rightX - r - d,
        y: bottomY,
        angle: Math.PI,
      };
    }
    d -= straightH;

    // 6. Bottom-left corner
    if (d <= arcLen) {
      const theta = Math.PI / 2 + (d / arcLen) * (Math.PI / 2);
      return {
        x: leftX + r + Math.cos(theta) * r,
        y: bottomY - r + Math.sin(theta) * r,
        angle: theta + Math.PI / 2,
      };
    }
    d -= arcLen;

    // 7. Left straight (bottom -> top)
    if (d <= straightV) {
      return {
        x: leftX,
        y: bottomY - r - d,
        angle: -Math.PI / 2,
      };
    }
    d -= straightV;

    // 8. Top-left corner
    const theta = Math.PI + (d / arcLen) * (Math.PI / 2);
    return {
      x: leftX + r + Math.cos(theta) * r,
      y: topY + r + Math.sin(theta) * r,
      angle: theta + Math.PI / 2,
    };
  };

  const pickupZoneStart = 0.96; // wraps around 0.0
  const pickupZoneEnd = Math.min(0.42, straightH / perimeter + 0.04);

  const isInPickupZone = (rawOffset: number): boolean => {
    const off = ((rawOffset % 1) + 1) % 1;
    return off >= pickupZoneStart || off <= pickupZoneEnd;
  };

  return {
    width: safeW,
    height: safeH,
    dockY,
    dockHeight,
    truckWidth,
    truckHeight,
    getTruckBayX,
    getTruckSlotPos,
    bufferY,
    bufferHeight,
    bufferSlotSize,
    getBufferSlotPos,
    beltCenterX,
    beltCenterY,
    beltWidth,
    beltHeight,
    beltCornerRadius,
    beltTrackWidth,
    parcelSize,
    scannerOffset: 0.015,
    pickupZoneStart,
    pickupZoneEnd,
    isInPickupZone,
    getBeltPoint,
  };
}
