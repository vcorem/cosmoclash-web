// src/ai/__tests__/AIConstants.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import {
  getDifficultyConstants,
  DifficultyLevel,
  AILevelConstants,
  TACTIC_TIMES,
  AI_ENTITY_TYPES,
} from '../AIConstants';

describe('getDifficultyConstants', () => {
  it('returns constants for all three levels', () => {
    for (const level of [1, 2, 3] as DifficultyLevel[]) {
      const c = getDifficultyConstants(level);
      expect(c).toBeDefined();
      expect(typeof c.distanceToAvoidPlasma).toBe('number');
    }
  });

  describe('Level 1 (Beginner)', () => {
    let c: AILevelConstants;
    beforeAll(() => {
      c = getDifficultyConstants(1);
    });

    it('distanceToAvoidPlasma = 50', () => expect(c.distanceToAvoidPlasma).toBe(50));
    it('distanceToAvoidSnot = 50', () => expect(c.distanceToAvoidSnot).toBe(50));
    it('distanceToStayAway = 150', () => expect(c.distanceToStayAway).toBe(150));
    it('distanceSholevToFreezeAim = 200', () => expect(c.distanceSholevToFreezeAim).toBe(200));
    it('distanceToAvoidSholevIce = 300', () => expect(c.distanceToAvoidSholevIce).toBe(300));
    it('BELOW_MAX_SPEED_TO_SHOOT = 0.05', () => expect(c.BELOW_MAX_SPEED_TO_SHOOT).toBe(0.05));
    it('goodAimProbability = 0.4', () => expect(c.goodAimProbability).toBe(0.4));
    it('minEnergyLevel = 0.01', () => expect(c.minEnergyLevel).toBe(0.01));
    it('resumeEnergyLevel = 0.8', () => expect(c.resumeEnergyLevel).toBe(0.8));
    it('rateOfLearningAI = 6', () => expect(c.rateOfLearningAI).toBe(6));
    it('inAndOutdistance = 100', () => expect(c.inAndOutdistance).toBe(100));
    it('holdingDistanceBeforeFly = 400', () => expect(c.holdingDistanceBeforeFly).toBe(400));
    it('KAMIKAZE_CLOSE_DIS = 200', () => expect(c.KAMIKAZE_CLOSE_DIS).toBe(200));
    it('SIT_ON_TAIL_DIS = 400', () => expect(c.SIT_ON_TAIL_DIS).toBe(400));
    it('DEFAULT_SHOOT_TIME = 1000', () => expect(c.DEFAULT_SHOOT_TIME).toBe(1000));
    it('DEFAULT_SHOOT_INETRVAL = 100', () => expect(c.DEFAULT_SHOOT_INETRVAL).toBe(100));
    it('DEFAULT_TIME_TO_REST = 500', () => expect(c.DEFAULT_TIME_TO_REST).toBe(500));
  });

  describe('Level 2 (Medium)', () => {
    let c: AILevelConstants;
    beforeAll(() => {
      c = getDifficultyConstants(2);
    });

    it('distanceToAvoidPlasma = 175', () => expect(c.distanceToAvoidPlasma).toBe(175));
    it('distanceToAvoidSnot = 100', () => expect(c.distanceToAvoidSnot).toBe(100));
    it('distanceToStayAway = 300', () => expect(c.distanceToStayAway).toBe(300));
    it('distanceSholevToFreezeAim = 100', () => expect(c.distanceSholevToFreezeAim).toBe(100));
    it('distanceToAvoidSholevIce = 400', () => expect(c.distanceToAvoidSholevIce).toBe(400));
    it('BELOW_MAX_SPEED_TO_SHOOT = 0.06', () => expect(c.BELOW_MAX_SPEED_TO_SHOOT).toBe(0.06));
    it('goodAimProbability = 0.7', () => expect(c.goodAimProbability).toBe(0.7));
    it('minEnergyLevel = 0.01', () => expect(c.minEnergyLevel).toBe(0.01));
    it('resumeEnergyLevel = 0.5', () => expect(c.resumeEnergyLevel).toBe(0.5));
    it('rateOfLearningAI = 5', () => expect(c.rateOfLearningAI).toBe(5));
    it('inAndOutdistance = 0 (computed at runtime)', () => expect(c.inAndOutdistance).toBe(0));
    it('holdingDistanceBeforeFly = 450', () => expect(c.holdingDistanceBeforeFly).toBe(450));
    it('KAMIKAZE_CLOSE_DIS = 150', () => expect(c.KAMIKAZE_CLOSE_DIS).toBe(150));
    it('SIT_ON_TAIL_DIS = 300', () => expect(c.SIT_ON_TAIL_DIS).toBe(300));
    it('DEFAULT_SHOOT_TIME = 1000', () => expect(c.DEFAULT_SHOOT_TIME).toBe(1000));
    it('DEFAULT_SHOOT_INETRVAL = 50', () => expect(c.DEFAULT_SHOOT_INETRVAL).toBe(50));
    it('DEFAULT_TIME_TO_REST = 250', () => expect(c.DEFAULT_TIME_TO_REST).toBe(250));
  });

  describe('Level 3 (Expert)', () => {
    let c: AILevelConstants;
    beforeAll(() => {
      c = getDifficultyConstants(3);
    });

    it('distanceToAvoidPlasma = 250', () => expect(c.distanceToAvoidPlasma).toBe(250));
    it('distanceToAvoidSnot = 150', () => expect(c.distanceToAvoidSnot).toBe(150));
    it('distanceToStayAway = 350', () => expect(c.distanceToStayAway).toBe(350));
    it('distanceSholevToFreezeAim = 50', () => expect(c.distanceSholevToFreezeAim).toBe(50));
    it('distanceToAvoidSholevIce = 500', () => expect(c.distanceToAvoidSholevIce).toBe(500));
    it('BELOW_MAX_SPEED_TO_SHOOT = 0.069', () => expect(c.BELOW_MAX_SPEED_TO_SHOOT).toBe(0.069));
    it('goodAimProbability = 1.0', () => expect(c.goodAimProbability).toBe(1.0));
    it('minEnergyLevel = 0.01', () => expect(c.minEnergyLevel).toBe(0.01));
    it('resumeEnergyLevel = 0.4', () => expect(c.resumeEnergyLevel).toBe(0.4));
    it('rateOfLearningAI = 4', () => expect(c.rateOfLearningAI).toBe(4));
    it('inAndOutdistance = 0 (computed at runtime)', () => expect(c.inAndOutdistance).toBe(0));
    it('holdingDistanceBeforeFly = 500', () => expect(c.holdingDistanceBeforeFly).toBe(500));
    it('KAMIKAZE_CLOSE_DIS = 100', () => expect(c.KAMIKAZE_CLOSE_DIS).toBe(100));
    it('SIT_ON_TAIL_DIS = 200', () => expect(c.SIT_ON_TAIL_DIS).toBe(200));
    it('DEFAULT_SHOOT_TIME = 1000', () => expect(c.DEFAULT_SHOOT_TIME).toBe(1000));
    it('DEFAULT_SHOOT_INETRVAL = 25', () => expect(c.DEFAULT_SHOOT_INETRVAL).toBe(25));
    it('DEFAULT_TIME_TO_REST = 100', () => expect(c.DEFAULT_TIME_TO_REST).toBe(100));
  });

  it('returns a frozen object (immutable)', () => {
    const c = getDifficultyConstants(3);
    expect(Object.isFrozen(c)).toBe(true);
  });

  it('returns the same object on repeated calls (cached)', () => {
    const a = getDifficultyConstants(2);
    const b = getDifficultyConstants(2);
    expect(a).toBe(b);
  });
});

describe('TACTIC_TIMES', () => {
  it('DEFAULT_TIME_FOR_TACTICS = 1000', () => expect(TACTIC_TIMES.DEFAULT_TIME_FOR_TACTICS).toBe(1000));
  it('simpleAttack = 1000', () => expect(TACTIC_TIMES.simpleAttack).toBe(1000));
  it('sitOnTailAttack = 2000', () => expect(TACTIC_TIMES.sitOnTailAttack).toBe(2000));
  it('kamikazeAttack = 1500', () => expect(TACTIC_TIMES.kamikazeAttack).toBe(1500));
  it('stationaryAttack = 1000', () => expect(TACTIC_TIMES.stationaryAttack).toBe(1000));
  it('superFastAndShoot = 1000', () => expect(TACTIC_TIMES.superFastAndShoot).toBe(1000));
  it('zigzag = 500', () => expect(TACTIC_TIMES.zigzag).toBe(500));
  it('turnAndShoot = 3000', () => expect(TACTIC_TIMES.turnAndShoot).toBe(3000));
  it('uniqueTactic = 1000', () => expect(TACTIC_TIMES.uniqueTactic).toBe(1000));
  it('cowardFlying = 4000', () => expect(TACTIC_TIMES.cowardFlying).toBe(4000));
  it('lowEnergyAttack = 2000', () => expect(TACTIC_TIMES.lowEnergyAttack).toBe(2000));
  it('inAndOut = 2000', () => expect(TACTIC_TIMES.inAndOut).toBe(2000));

  it('is frozen', () => {
    expect(Object.isFrozen(TACTIC_TIMES)).toBe(true);
  });
});

describe('AI_ENTITY_TYPES', () => {
  it('MITCHIGITCHI = 1', () => expect(AI_ENTITY_TYPES.MITCHIGITCHI).toBe(1));
  it('GONDI = 4', () => expect(AI_ENTITY_TYPES.GONDI).toBe(4));
  it('SHOLEV = 8', () => expect(AI_ENTITY_TYPES.SHOLEV).toBe(8));
  it('PLASMA = 14', () => expect(AI_ENTITY_TYPES.PLASMA).toBe(14));
  it('SNOT = 16', () => expect(AI_ENTITY_TYPES.SNOT).toBe(16));

  it('is frozen', () => {
    expect(Object.isFrozen(AI_ENTITY_TYPES)).toBe(true);
  });
});
