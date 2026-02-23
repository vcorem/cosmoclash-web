// src/ai/__tests__/AILog.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { AILearning } from '../AILog';

describe('AILearning', () => {
  let learning: AILearning;

  beforeEach(() => {
    learning = new AILearning();
  });

  it('starts with all tables zeroed', () => {
    expect(learning.hittingInAttackTable.every((v) => v === 0)).toBe(true);
    expect(learning.hittingInDefenseTable.every((v) => v === 0)).toBe(true);
    expect(learning.gotHitInAttackTable.every((v) => v === 0)).toBe(true);
    expect(learning.gotHitInDefenseTable.every((v) => v === 0)).toBe(true);
    expect(learning.attackMaxTactic).toBe(0);
    expect(learning.attackMax).toBe(0);
    expect(learning.defenseMaxTactic).toBe(0);
    expect(learning.defenseMax).toBe(0);
  });

  it('increments hittingInAttackTable when AI hits in attack mode', () => {
    learning.updateTacticsTable('attack', 5, true);
    expect(learning.hittingInAttackTable[5]).toBe(1);
    learning.updateTacticsTable('attack', 5, true);
    expect(learning.hittingInAttackTable[5]).toBe(2);
  });

  it('increments hittingInDefenseTable when AI hits in defense mode', () => {
    learning.updateTacticsTable('defense', 3, true);
    expect(learning.hittingInDefenseTable[3]).toBe(1);
  });

  it('increments gotHitInAttackTable when AI gets hit in attack mode', () => {
    learning.updateTacticsTable('attack', 7, false);
    expect(learning.gotHitInAttackTable[7]).toBe(1);
  });

  it('increments gotHitInDefenseTable when AI gets hit in defense mode', () => {
    learning.updateTacticsTable('defense', 2, false);
    expect(learning.gotHitInDefenseTable[2]).toBe(1);
  });

  it('tracks the best attack tactic (most hits)', () => {
    learning.updateTacticsTable('attack', 11, true);
    learning.updateTacticsTable('attack', 11, true);
    learning.updateTacticsTable('attack', 11, true);
    learning.updateTacticsTable('attack', 15, true);
    learning.updateTacticsTable('attack', 15, true);
    expect(learning.attackMaxTactic).toBe(11);
    expect(learning.attackMax).toBe(3);
  });

  it('updates best tactic when a different one surpasses the current max', () => {
    learning.updateTacticsTable('attack', 11, true);
    learning.updateTacticsTable('attack', 11, true);
    expect(learning.attackMaxTactic).toBe(11);

    learning.updateTacticsTable('attack', 15, true);
    learning.updateTacticsTable('attack', 15, true);
    learning.updateTacticsTable('attack', 15, true);
    expect(learning.attackMaxTactic).toBe(15);
    expect(learning.attackMax).toBe(3);
  });

  it('tracks the best defense tactic independently', () => {
    learning.updateTacticsTable('defense', 1, true);
    learning.updateTacticsTable('defense', 1, true);
    learning.updateTacticsTable('attack', 11, true);
    learning.updateTacticsTable('attack', 11, true);
    learning.updateTacticsTable('attack', 11, true);
    expect(learning.defenseMaxTactic).toBe(1);
    expect(learning.defenseMax).toBe(2);
    expect(learning.attackMaxTactic).toBe(11);
    expect(learning.attackMax).toBe(3);
  });

  it('gotHit tables do not affect max tactic tracking', () => {
    learning.updateTacticsTable('attack', 5, false);
    learning.updateTacticsTable('attack', 5, false);
    learning.updateTacticsTable('attack', 5, false);
    expect(learning.attackMaxTactic).toBe(0);
    expect(learning.attackMax).toBe(0);
  });

  it('tables have 21 slots (indices 0-20)', () => {
    expect(learning.hittingInAttackTable.length).toBe(21);
    expect(learning.hittingInDefenseTable.length).toBe(21);
    expect(learning.gotHitInAttackTable.length).toBe(21);
    expect(learning.gotHitInDefenseTable.length).toBe(21);
  });
});
