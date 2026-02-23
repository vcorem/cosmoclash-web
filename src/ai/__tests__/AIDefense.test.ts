// src/ai/__tests__/AIDefense.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIDefenseMode } from '../AIDefense';
import { AIOutput } from '../AIOutput';
import { AILearning } from '../AILog';
import { getDifficultyConstants } from '../AIConstants';
import type { AIContext } from '../AITactics';
import type { PlayerTable } from '../AIBridge';

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
    angle: 0, speed: 0.5, maxSpeed: 1,
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

describe('AIDefenseMode', () => {
  let defense: AIDefenseMode;

  beforeEach(() => {
    defense = new AIDefenseMode();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('triggers closeRangeAttack when distance < 250', () => {
    const out = new AIOutput();
    const ctx = makeCtx();
    const ai = makeTable({ distance: 100, life: 1 });
    const user = makeTable({ VVAngle: 0 });
    defense.update(ai, user, out, ctx);
    // closeRangeAttack should have set thrust and turn
    expect(out.thrust).toBe(true);
  });

  it('activates evasion behavior when AI life drops', () => {
    const out = new AIOutput();
    const ctx = makeCtx();
    const ai = makeTable({ life: 0.8, distance: 500 });
    const user = makeTable();
    defense.update(ai, user, out, ctx);
    // inDisadvantage sets thrust=true and turns perpendicular
    expect(out.thrust).toBe(true);
    expect(ctx.disAdvantageCounter).toBe(1);
  });

  it('cycles defense tactics (1-10)', () => {
    const out = new AIOutput();
    const ctx = makeCtx({ tacticTime: 10 });
    const ai = makeTable({ life: 1, distance: 500 });
    const user = makeTable();
    defense.update(ai, user, out, ctx);
    const tactic = defense.getCurrentTactic();
    expect(tactic).toBeGreaterThanOrEqual(1);
    expect(tactic).toBeLessThanOrEqual(10);
  });

  it('resets to initial state', () => {
    defense.reset();
    expect(defense.getCurrentTactic()).toBe(2);
  });
});
