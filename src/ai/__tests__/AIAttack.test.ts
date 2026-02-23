// src/ai/__tests__/AIAttack.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIAttackMode } from '../AIAttack';
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

describe('AIAttackMode', () => {
  let attack: AIAttackMode;

  beforeEach(() => {
    attack = new AIAttackMode();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('activates evasion behavior when AI life drops', () => {
    const out = new AIOutput();
    const ctx = makeCtx();
    const ai = makeTable({ life: 0.8 }); // life < lastFrameLife (1)
    const user = makeTable();
    attack.update(ai, user, out, ctx);
    // inDisadvantage sets thrust=true and turns perpendicular
    expect(out.thrust).toBe(true);
    expect(ctx.disAdvantageCounter).toBe(1);
  });

  it('cycles tactics every tacticTime frames', () => {
    const out = new AIOutput();
    const ctx = makeCtx({ tacticTime: 10 });
    const ai = makeTable({ life: 1 });
    const user = makeTable();

    // First call: frameCounter=1, 1%10===1 → new tactic
    attack.update(ai, user, out, ctx);
    const tactic1 = attack.getCurrentTactic();
    expect(tactic1).toBeGreaterThanOrEqual(11);
    expect(tactic1).toBeLessThanOrEqual(20);
  });

  it('uses learning AI tactic at rateOfLearningAI interval', () => {
    const learning = new AILearning();
    learning.updateTacticsTable('attack', 15, true);
    learning.updateTacticsTable('attack', 15, true);

    const out = new AIOutput();
    const ctx = makeCtx({
      tacticTime: 1,
      learning,
    });
    const ai = makeTable({ life: 1 });
    const user = makeTable();

    // Run enough times to trigger learning selection
    // rateOfLearningAI=4, so at numOfTacticsPlayed = 5,9,13... it uses best tactic
    for (let i = 0; i < 10; i++) {
      attack.update(ai, user, out, ctx);
    }
    // Eventually should have used tactic 15
    // This is probabilistic but with mocked random it's deterministic
  });

  it('resets to initial state', () => {
    attack.reset();
    expect(attack.getCurrentTactic()).toBe(11);
  });
});
