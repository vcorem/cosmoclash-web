export const SEGMENT_COUNT = 40;

export interface RGB {
  r: number;
  g: number;
  b: number;
}

// Original C++ colors from PlayerPanel.cpp
export const HEALTH_COLOR_FULL: RGB = { r: 250, g: 50, b: 50 };
export const HEALTH_COLOR_EMPTY: RGB = { r: 120, g: 10, b: 10 };
export const ENERGY_COLOR_FULL: RGB = { r: 250, g: 40, b: 0 };
export const ENERGY_COLOR_EMPTY: RGB = { r: 250, g: 200, b: 0 };
export const SEGMENT_INACTIVE_COLOR: RGB = { r: 40, g: 40, b: 40 };

export function computeActiveSegments(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return Math.round(clamped * SEGMENT_COUNT);
}

export function computeSegmentColor(index: number, full: RGB, empty: RGB): RGB {
  const t = index / (SEGMENT_COUNT - 1);
  return {
    r: Math.round(full.r + (empty.r - full.r) * t),
    g: Math.round(full.g + (empty.g - full.g) * t),
    b: Math.round(full.b + (empty.b - full.b) * t),
  };
}
