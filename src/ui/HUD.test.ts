import { describe, it, expect } from 'vitest';
import { computeActiveSegments, computeSegmentColor, HEALTH_COLOR_FULL, HEALTH_COLOR_EMPTY, ENERGY_COLOR_FULL, ENERGY_COLOR_EMPTY, SEGMENT_COUNT } from './HUD';

describe('HUD segment calculations', () => {
  describe('computeActiveSegments', () => {
    it('returns 40 for full health (1.0)', () => {
      expect(computeActiveSegments(1.0)).toBe(40);
    });

    it('returns 0 for zero health', () => {
      expect(computeActiveSegments(0)).toBe(0);
    });

    it('returns 20 for half health', () => {
      expect(computeActiveSegments(0.5)).toBe(20);
    });

    it('clamps to 0-40 range', () => {
      expect(computeActiveSegments(-0.1)).toBe(0);
      expect(computeActiveSegments(1.5)).toBe(40);
    });
  });

  describe('computeSegmentColor', () => {
    it('returns full color at index 0', () => {
      const c = computeSegmentColor(0, HEALTH_COLOR_FULL, HEALTH_COLOR_EMPTY);
      expect(c).toEqual(HEALTH_COLOR_FULL);
    });

    it('returns empty color at last index', () => {
      const c = computeSegmentColor(SEGMENT_COUNT - 1, HEALTH_COLOR_FULL, HEALTH_COLOR_EMPTY);
      expect(c).toEqual(HEALTH_COLOR_EMPTY);
    });

    it('interpolates between full and empty', () => {
      const c = computeSegmentColor(20, ENERGY_COLOR_FULL, ENERGY_COLOR_EMPTY);
      // Midpoint between (250,40,0) and (250,200,0) -> (250,~122,0)
      expect(c.r).toBe(250);
      expect(c.g).toBeCloseTo(122, 0); // 40 + (200-40) * 20/39 ≈ 122
      expect(c.b).toBe(0);
    });
  });
});
