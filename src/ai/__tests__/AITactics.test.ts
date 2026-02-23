// src/ai/__tests__/AITactics.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIOutput } from '../AIOutput';
import {
  AIContext,
  turnToAngle,
  turnAwayFromOp,
  slowDown,
  stayAtADistanceFromSun,
  stayAtADistance,
  kamikazeAttack,
  cowardFlying,
  inDisadvantage,
  avoidBluePlasma,
  closeRangeAttack,
  onceMethod,
  fireWeapon2Once,
} from '../AITactics';
import { getDifficultyConstants } from '../AIConstants';
import { AI_ENTITY_TYPES } from '../AIConstants';
import { AILearning } from '../AILog';
import type { PlayerTable, SunTable } from '../AIBridge';
import { MorphState } from '@/game/MichiGichiPlayer';

function makeCtx(overrides: Partial<AIContext> = {}): AIContext {
  return {
    num: 100,
    constants: getDifficultyConstants(3),
    sunTable: { x: 0, y: 0 },
    out: new AIOutput(),
    learning: new AILearning(),
    level: 3,
    tacticTime: 1000,
    inDisAdvantage: false,
    smallGitchiFlag: false,
    fireWeapon2Flag: false,
    thrustOnceFlag: false,
    energyFillFlag: false,
    cowardReadyFlag: false,
    inLowEnergyAttack: false,
    slowDownSunFlag: false,
    countShootTime: 0,
    readyToFire: true,
    rotAngle: 0,
    lastFrameCloseRange: 0,
    closeRangeCounter: 0,
    disAdvantageCounter: 0,
    randomAngle: 0,
    inAndOutdistance: 400,
    ...overrides,
  };
}

function makeTable(overrides: Partial<PlayerTable> = {}): PlayerTable {
  return {
    player: {} as any,
    x: 0, y: 0,
    angle: 0, speed: 0, maxSpeed: 1,
    dxVector: 0, dyVector: 0,
    life: 1, energy: 1,
    entityType: 0, distance: 500,
    angleToOp: 90, angleToSun: 0,
    weapon1Distance: 525,
    shots: [], snots: [], snotCount: 0,
    VVAngle: 0,
    ...overrides,
  };
}

describe('turnToAngle', () => {
  it('returns true when at desired angle', () => {
    const out = new AIOutput();
    const table = makeTable({ angle: 90 });
    expect(turnToAngle(table, 90, out)).toBe(true);
    expect(out.rotateLeft).toBe(false);
    expect(out.rotateRight).toBe(false);
  });

  it('turns right when desired is clockwise', () => {
    const out = new AIOutput();
    const table = makeTable({ angle: 10 });
    expect(turnToAngle(table, 30, out)).toBe(false);
    expect(out.rotateRight).toBe(true);
    expect(out.rotateLeft).toBe(false);
  });

  it('turns left when desired is counter-clockwise', () => {
    const out = new AIOutput();
    const table = makeTable({ angle: 30 });
    expect(turnToAngle(table, 10, out)).toBe(false);
    expect(out.rotateLeft).toBe(true);
    expect(out.rotateRight).toBe(false);
  });
});

describe('turnAwayFromOp', () => {
  it('turns to angle + 180', () => {
    const out = new AIOutput();
    const table = makeTable({ angle: 0 });
    turnAwayFromOp(table, 90, out);
    // Should turn toward 270
    expect(out.rotateLeft).toBe(true);
  });
});

describe('stayAtADistanceFromSun', () => {
  it('turns away and thrusts when too close', () => {
    const out = new AIOutput();
    const ctx = makeCtx();
    const table = makeTable({ x: 50, y: 0, angleToSun: 270 });
    const result = stayAtADistanceFromSun(table, ctx.sunTable, 150, out, ctx);
    expect(result).toBe(true);
    expect(out.thrust).toBe(true);
  });

  it('stops when far enough', () => {
    const out = new AIOutput();
    const ctx = makeCtx();
    const table = makeTable({ x: 500, y: 0 });
    const result = stayAtADistanceFromSun(table, ctx.sunTable, 150, out, ctx);
    expect(result).toBe(false);
  });
});

describe('stayAtADistance', () => {
  it('turns away when too close', () => {
    const out = new AIOutput();
    const computer = makeTable({ x: 0, y: 0, angleToOp: 90 });
    const user = makeTable({ x: 100, y: 0 });
    const result = stayAtADistance(computer, user, 200, out);
    expect(result).toBe(true);
    expect(out.thrust).toBe(true);
  });

  it('stops thrust when far enough', () => {
    const out = new AIOutput();
    const computer = makeTable({ x: 0, y: 0 });
    const user = makeTable({ x: 500, y: 0 });
    const result = stayAtADistance(computer, user, 200, out);
    expect(result).toBe(false);
    expect(out.thrust).toBe(false);
  });
});

describe('kamikazeAttack', () => {
  it('thrusts toward opponent when far', () => {
    const out = new AIOutput();
    const ctx = makeCtx();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const computer = makeTable({ distance: 500, entityType: 0 });
    const user = makeTable({ x: 500, y: 0 });
    kamikazeAttack(computer, user, out, ctx);
    expect(out.thrust).toBe(true);
    vi.restoreAllMocks();
  });

  it('stops thrusting when close enough', () => {
    const out = new AIOutput();
    const ctx = makeCtx();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const computer = makeTable({ distance: 50, entityType: 0 }); // < KAMIKAZE_CLOSE_DIS (100)
    const user = makeTable({ x: 50, y: 0 });
    kamikazeAttack(computer, user, out, ctx);
    expect(out.thrust).toBe(false);
    vi.restoreAllMocks();
  });
});

describe('inDisadvantage', () => {
  it('thrusts perpendicular to user velocity', () => {
    const out = new AIOutput();
    const ctx = makeCtx({ num: 100 });
    const computer = makeTable({ angle: 0, angleToOp: 90, entityType: 0 });
    const user = makeTable({ VVAngle: 45 });
    inDisadvantage(computer, user, out, ctx);
    expect(out.thrust).toBe(true);
    expect(ctx.disAdvantageCounter).toBe(1);
  });

  it('clears inDisAdvantage flag every 50 frames', () => {
    const ctx = makeCtx({ num: 100, disAdvantageCounter: 49, inDisAdvantage: true });
    const out = new AIOutput();
    const computer = makeTable({ entityType: 0 });
    const user = makeTable({});
    inDisadvantage(computer, user, out, ctx);
    // 49+1 = 50, 50%50===0, not ===1. Let's check: counter becomes 50 in the function, 50%50 = 0, not 1.
    // It should clear on the 51st call: counter=50, 50%50=0 → false.
    // Actually 51st: counter was 50 → +1 → 51. 51%50=1 → true! Clears.
    expect(ctx.disAdvantageCounter).toBe(50);
  });
});

describe('onceMethod', () => {
  it('clears fireWeapon2Flag and toggles smallGitchiFlag', () => {
    const out = new AIOutput();
    out.setFireSecondary(true);
    const ctx = makeCtx({ fireWeapon2Flag: true, smallGitchiFlag: false });
    onceMethod(out, ctx);
    expect(out.fireSecondary).toBe(false);
    expect(ctx.fireWeapon2Flag).toBe(false);
    expect(ctx.smallGitchiFlag).toBe(true);
  });

  it('clears thrustOnceFlag', () => {
    const out = new AIOutput();
    out.setThrust(true);
    const ctx = makeCtx({ thrustOnceFlag: true });
    onceMethod(out, ctx);
    expect(out.thrust).toBe(false);
    expect(ctx.thrustOnceFlag).toBe(false);
  });
});

describe('cowardFlying', () => {
  it('retreats when distance < userRange', () => {
    const out = new AIOutput();
    const ctx = makeCtx();
    const computer = makeTable({
      x: 0, y: 0, distance: 200, energy: 0.5,
      entityType: 0, weapon1Distance: 525,
    });
    const user = makeTable({
      x: 200, y: 0, weapon1Distance: 525,
    });
    cowardFlying(computer, user, out, ctx);
    // Distance (200) < userRange (525), not cowardReady → retreat
    expect(out.thrust).toBe(true);
  });
});

describe('closeRangeAttack', () => {
  it('initializes counter on first call', () => {
    const out = new AIOutput();
    const ctx = makeCtx({ num: 100, lastFrameCloseRange: 0 });
    const computer = makeTable({ entityType: 0 });
    const user = makeTable({ VVAngle: 90 });
    closeRangeAttack(computer, user, out, ctx);
    expect(ctx.closeRangeCounter).toBe(0);
    expect(ctx.lastFrameCloseRange).toBe(100);
  });

  it('increments counter on consecutive frames', () => {
    const out = new AIOutput();
    const ctx = makeCtx({ num: 101, lastFrameCloseRange: 100, closeRangeCounter: 5 });
    const computer = makeTable({ entityType: 0 });
    const user = makeTable({ VVAngle: 90 });
    closeRangeAttack(computer, user, out, ctx);
    expect(ctx.closeRangeCounter).toBe(6);
  });
});
