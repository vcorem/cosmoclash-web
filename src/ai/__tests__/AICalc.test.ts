// src/ai/__tests__/AICalc.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getDistance,
  getVectorSize,
  getAngleBetweenTwoVectors,
  getAngleToXY,
  getVVAngle,
  turnToAngleDecision,
  goodAim,
  realIsInRange,
  isInFutureRange,
} from '../AICalc';
import { AI_ENTITY_TYPES } from '../AIConstants';
import type { PlayerTable } from '../AIBridge';

// Helper to create a minimal PlayerTable for testing
function makeTable(overrides: Partial<PlayerTable> = {}): PlayerTable {
  return {
    player: {} as any,
    x: 0,
    y: 0,
    angle: 0,
    speed: 0,
    maxSpeed: 1,
    dxVector: 0,
    dyVector: 0,
    life: 1,
    energy: 1,
    entityType: 0,
    distance: 0,
    angleToOp: 0,
    angleToSun: 0,
    weapon1Distance: 525,
    shots: [],
    snots: [],
    snotCount: 0,
    VVAngle: 0,
    ...overrides,
  };
}

describe('getDistance', () => {
  it('returns 0 for same point', () => {
    expect(getDistance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });

  it('returns correct distance for 3-4-5 triangle', () => {
    expect(getDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('works with negative coordinates', () => {
    expect(getDistance({ x: -3, y: 0 }, { x: 0, y: 4 })).toBe(5);
  });
});

describe('getVectorSize', () => {
  it('returns 0 for same point', () => {
    expect(getVectorSize(1, 1, 1, 1)).toBe(0);
  });

  it('returns correct magnitude', () => {
    expect(getVectorSize(3, 4, 0, 0)).toBe(5);
  });
});

describe('getAngleBetweenTwoVectors', () => {
  it('returns 0 for parallel vectors pointing up', () => {
    const v1 = { x: 0, y: 1, size: 1 };
    const v2 = { x: 0, y: 1, size: 1 };
    expect(getAngleBetweenTwoVectors(v1, v2)).toBeCloseTo(0, 5);
  });

  it('returns 90 for perpendicular vector to the right', () => {
    const v1 = { x: 1, y: 0, size: 1 };
    const v2 = { x: 0, y: 1, size: 1 };
    expect(getAngleBetweenTwoVectors(v1, v2)).toBeCloseTo(90, 5);
  });

  it('returns 270 for perpendicular vector to the left', () => {
    const v1 = { x: -1, y: 0, size: 1 };
    const v2 = { x: 0, y: 1, size: 1 };
    expect(getAngleBetweenTwoVectors(v1, v2)).toBeCloseTo(270, 5);
  });

  it('returns 180 for opposite vectors', () => {
    const v1 = { x: 0, y: -1, size: 1 };
    const v2 = { x: 0, y: 1, size: 1 };
    // x=0 so no 360-correction
    expect(getAngleBetweenTwoVectors(v1, v2)).toBeCloseTo(180, 5);
  });

  it('returns 0 for zero-length vector', () => {
    const v1 = { x: 0, y: 0, size: 0 };
    const v2 = { x: 0, y: 1, size: 1 };
    expect(getAngleBetweenTwoVectors(v1, v2)).toBe(0);
  });
});

describe('getAngleToXY', () => {
  it('returns 0 when target is directly above', () => {
    expect(getAngleToXY(0, 100, 0, 0)).toBeCloseTo(0, 5);
  });

  it('returns 90 when target is to the right', () => {
    expect(getAngleToXY(100, 0, 0, 0)).toBeCloseTo(90, 5);
  });

  it('returns 180 when target is directly below', () => {
    expect(getAngleToXY(0, -100, 0, 0)).toBeCloseTo(180, 5);
  });

  it('returns 270 when target is to the left', () => {
    expect(getAngleToXY(-100, 0, 0, 0)).toBeCloseTo(270, 5);
  });

  it('returns 45 for upper-right diagonal', () => {
    expect(getAngleToXY(100, 100, 0, 0)).toBeCloseTo(45, 5);
  });
});

describe('getVVAngle', () => {
  it('returns 0 for velocity pointing up', () => {
    expect(getVVAngle(0, 1)).toBeCloseTo(0, 5);
  });

  it('returns 90 for velocity pointing right', () => {
    expect(getVVAngle(1, 0)).toBeCloseTo(90, 5);
  });

  it('returns 0 for zero velocity', () => {
    expect(getVVAngle(0, 0)).toBe(0);
  });
});

describe('turnToAngleDecision', () => {
  it('returns reached when current equals desired', () => {
    const result = turnToAngleDecision(90, 90);
    expect(result.reached).toBe(true);
    expect(result.left).toBe(false);
    expect(result.right).toBe(false);
  });

  it('returns reached when within 1 degree', () => {
    const result = turnToAngleDecision(90, 91);
    expect(result.reached).toBe(true);
  });

  it('turns right when desired is slightly clockwise', () => {
    const result = turnToAngleDecision(10, 30);
    expect(result.right).toBe(true);
    expect(result.left).toBe(false);
    expect(result.reached).toBe(false);
  });

  it('turns left when desired is slightly counter-clockwise', () => {
    const result = turnToAngleDecision(30, 10);
    expect(result.left).toBe(true);
    expect(result.right).toBe(false);
    expect(result.reached).toBe(false);
  });

  it('turns left when going from 10 to 350 (shorter CCW)', () => {
    const result = turnToAngleDecision(10, 350);
    expect(result.left).toBe(true);
    expect(result.right).toBe(false);
  });

  it('turns right when going from 350 to 10 (shorter CW)', () => {
    const result = turnToAngleDecision(350, 10);
    expect(result.right).toBe(true);
    expect(result.left).toBe(false);
  });

  it('handles wrapping of desired angle > 360', () => {
    const result = turnToAngleDecision(10, 370); // 370 % 360 = 10
    expect(result.reached).toBe(true);
  });

  it('handles negative desired angle', () => {
    const result = turnToAngleDecision(10, -10); // (-10+360)%360 = 350
    expect(result.left).toBe(true);
  });
});

describe('goodAim', () => {
  let mathRandomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mathRandomSpy = vi.spyOn(Math, 'random');
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
  });

  it('returns corrected angle when random < probability', () => {
    mathRandomSpy.mockReturnValue(0.1); // 10 < 100 * 1.0
    const computer = makeTable({ x: 0, y: 0, angleToOp: 45 });
    const user = makeTable({ x: 100, y: 100, dxVector: 0, dyVector: 0 });
    const result = goodAim(computer, user, 1.0);
    // Should be the angle to (100,100) from (0,0) = 45 degrees
    expect(result).toBeCloseTo(45, 0);
  });

  it('returns angleToOp when random >= probability', () => {
    mathRandomSpy.mockReturnValue(0.9); // 90 >= 100 * 0.4
    const computer = makeTable({ x: 0, y: 0, angleToOp: 90 });
    const user = makeTable({ x: 100, y: 0, dxVector: 0, dyVector: 0 });
    const result = goodAim(computer, user, 0.4);
    expect(result).toBe(90);
  });

  it('accounts for opponent velocity in prediction', () => {
    mathRandomSpy.mockReturnValue(0); // Always accurate
    const computer = makeTable({ x: 0, y: 0 });
    // Opponent at (100, 0) moving up (+Y)
    const user = makeTable({ x: 100, y: 0, dxVector: 0, dyVector: 0.01 });
    const result = goodAim(computer, user, 1.0);
    // Future position will be above (100, 0), so angle should be between 0 and 90
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(90);
  });
});

describe('realIsInRange', () => {
  it('returns true when opponent is within weapon range (MichiGichi)', () => {
    const computer = makeTable({
      x: 0, y: 0,
      entityType: AI_ENTITY_TYPES.MITCHIGITCHI,
      weapon1Distance: 1000,
      morphState: 0, // MICHI
      dxVector: 0, dyVector: 0,
    });
    const user = makeTable({
      x: 100, y: 0,
      dxVector: 0, dyVector: 0,
    });
    expect(realIsInRange(computer, user)).toBe(true);
  });

  it('returns false when opponent is out of range', () => {
    const computer = makeTable({
      x: 0, y: 0,
      entityType: AI_ENTITY_TYPES.MITCHIGITCHI,
      weapon1Distance: 50,
      morphState: 0,
      dxVector: 0, dyVector: 0,
    });
    const user = makeTable({
      x: 1000, y: 0,
      dxVector: 0, dyVector: 0,
    });
    expect(realIsInRange(computer, user)).toBe(false);
  });

  it('Gondi accounts for ship velocity in bullet trajectory', () => {
    const computer = makeTable({
      x: 0, y: 0,
      entityType: AI_ENTITY_TYPES.GONDI,
      weapon1Distance: 200,
      dxVector: 0.01, dyVector: 0, // moving right
    });
    const user = makeTable({
      x: 100, y: 0,
      dxVector: 0.01, dyVector: 0, // also moving right
    });
    // Both moving at same speed → relative distance stays 100, < 200
    expect(realIsInRange(computer, user)).toBe(true);
  });
});

describe('isInFutureRange', () => {
  it('returns true when players converging', () => {
    const computer = makeTable({
      x: 0, y: 0,
      weapon1Distance: 200,
      dxVector: 0.01, dyVector: 0, // moving right
    });
    const user = makeTable({
      x: 500, y: 0,
      dxVector: -0.01, dyVector: 0, // moving left
    });
    // After 25000 frames: comp at 250, user at 250 → 0 apart < 200
    expect(isInFutureRange(computer, user, 25000)).toBe(true);
  });

  it('returns false when players diverging', () => {
    const computer = makeTable({
      x: 0, y: 0,
      weapon1Distance: 100,
      dxVector: -0.01, dyVector: 0,
    });
    const user = makeTable({
      x: 500, y: 0,
      dxVector: 0.01, dyVector: 0,
    });
    expect(isInFutureRange(computer, user, 1000)).toBe(false);
  });
});
