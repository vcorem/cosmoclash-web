// src/ai/AIConstants.ts
// Ported from turtle.lua expertLevel() and Tactics.lua
// All values are exact matches from the original Lua AI scripts.

/** Difficulty levels: 1 = Beginner, 2 = Medium, 3 = Expert */
export type DifficultyLevel = 1 | 2 | 3;

/**
 * All difficulty-dependent constants used by the AI.
 * Field names preserve the original Lua naming (including the intentional
 * misspelling "DEFAULT_SHOOT_INETRVAL").
 */
export interface AILevelConstants {
  /** Distance at which the AI avoids plasma bullets */
  readonly distanceToAvoidPlasma: number;
  /** Distance at which the AI avoids snot projectiles */
  readonly distanceToAvoidSnot: number;
  /** Distance to stay away from the sun (and used in tail attack) */
  readonly distanceToStayAway: number;
  /** Distance at which Sholev stops adjusting aim angle for weapon2 */
  readonly distanceSholevToFreezeAim: number;
  /** Distance at which AI starts evading Sholev's ice shield */
  readonly distanceToAvoidSholevIce: number;
  /** Below this speed the AI will turn and shoot (used for snot-slowed targets) */
  readonly BELOW_MAX_SPEED_TO_SHOOT: number;
  /** Probability of an accurate aim at the user spaceship (0-1) */
  readonly goodAimProbability: number;
  /** Minimum energy level; below this the AI stops shooting */
  readonly minEnergyLevel: number;
  /** Energy level above which the AI resumes shooting */
  readonly resumeEnergyLevel: number;
  /** Rate at which learning AI tactic is chosen (every N tactics) */
  readonly rateOfLearningAI: number;
  /** Distance to maintain in the in-and-out tactic (0 = computed at runtime from weapon1Distance) */
  readonly inAndOutdistance: number;
  /** Distance at which Gondi starts to fly in uniqueAttack */
  readonly holdingDistanceBeforeFly: number;
  /** Distance at which kamikaze stops aiming and coasts in */
  readonly KAMIKAZE_CLOSE_DIS: number;
  /** Distance at which sit-on-tail stops thrusting */
  readonly SIT_ON_TAIL_DIS: number;
  /** Period of fire bursts in the fire method (ms / frames) */
  readonly DEFAULT_SHOOT_TIME: number;
  /** Time between shots in the fire method (ms / frames). Intentional misspelling from original. */
  readonly DEFAULT_SHOOT_INETRVAL: number;
  /** Time to rest between bursts in the fire method (ms / frames) */
  readonly DEFAULT_TIME_TO_REST: number;
}

// Pre-built constant objects for each difficulty level, frozen for immutability.

const LEVEL_1: AILevelConstants = Object.freeze({
  distanceToAvoidPlasma: 50,
  distanceToAvoidSnot: 50,
  distanceToStayAway: 150,
  distanceSholevToFreezeAim: 200,
  distanceToAvoidSholevIce: 300,
  BELOW_MAX_SPEED_TO_SHOOT: 0.05,
  goodAimProbability: 0.4,
  minEnergyLevel: 0.01,
  resumeEnergyLevel: 0.8,
  rateOfLearningAI: 6,
  inAndOutdistance: 100,
  holdingDistanceBeforeFly: 400,
  KAMIKAZE_CLOSE_DIS: 200,
  SIT_ON_TAIL_DIS: 400,
  DEFAULT_SHOOT_TIME: 1000,
  DEFAULT_SHOOT_INETRVAL: 100,
  DEFAULT_TIME_TO_REST: 500,
});

const LEVEL_2: AILevelConstants = Object.freeze({
  distanceToAvoidPlasma: 175,
  distanceToAvoidSnot: 100,
  distanceToStayAway: 300,
  distanceSholevToFreezeAim: 100,
  distanceToAvoidSholevIce: 400,
  BELOW_MAX_SPEED_TO_SHOOT: 0.06,
  goodAimProbability: 0.7,
  minEnergyLevel: 0.01,
  resumeEnergyLevel: 0.5,
  rateOfLearningAI: 5,
  inAndOutdistance: 0, // computed at runtime from weapon1Distance
  holdingDistanceBeforeFly: 450,
  KAMIKAZE_CLOSE_DIS: 150,
  SIT_ON_TAIL_DIS: 300,
  DEFAULT_SHOOT_TIME: 1000,
  DEFAULT_SHOOT_INETRVAL: 50,
  DEFAULT_TIME_TO_REST: 250,
});

const LEVEL_3: AILevelConstants = Object.freeze({
  distanceToAvoidPlasma: 250,
  distanceToAvoidSnot: 150,
  distanceToStayAway: 350,
  distanceSholevToFreezeAim: 50,
  distanceToAvoidSholevIce: 500,
  BELOW_MAX_SPEED_TO_SHOOT: 0.069, // just smaller than MichiGichi speed
  goodAimProbability: 1.0,
  minEnergyLevel: 0.01,
  resumeEnergyLevel: 0.4,
  rateOfLearningAI: 4,
  inAndOutdistance: 0, // computed at runtime from weapon1Distance
  holdingDistanceBeforeFly: 500,
  KAMIKAZE_CLOSE_DIS: 100,
  SIT_ON_TAIL_DIS: 200,
  DEFAULT_SHOOT_TIME: 1000,
  DEFAULT_SHOOT_INETRVAL: 25,
  DEFAULT_TIME_TO_REST: 100,
});

const LEVELS: Record<DifficultyLevel, AILevelConstants> = {
  1: LEVEL_1,
  2: LEVEL_2,
  3: LEVEL_3,
};

/**
 * Returns all difficulty-based constants for the given level.
 * Returns a frozen (immutable) object; the same reference is returned
 * on repeated calls for the same level.
 */
export function getDifficultyConstants(level: DifficultyLevel): AILevelConstants {
  return LEVELS[level];
}

/**
 * Tactic duration constants (in frames) from Tactics.lua.
 * Each value is the number of frames a tactic is "played" before switching.
 */
export const TACTIC_TIMES = Object.freeze({
  DEFAULT_TIME_FOR_TACTICS: 1000,
  simpleAttack: 1000,
  sitOnTailAttack: 2000,
  kamikazeAttack: 1500,
  stationaryAttack: 1000,
  superFastAndShoot: 1000,
  zigzag: 500,
  turnAndShoot: 3000,
  uniqueTactic: 1000,
  cowardFlying: 4000,
  lowEnergyAttack: 2000,
  inAndOut: 2000,
});

/**
 * Entity type constants matching the original Lua / C++ enum EntityName.
 * Only the types referenced by AI decision-making are included here.
 */
export const AI_ENTITY_TYPES = Object.freeze({
  MITCHIGITCHI: 1,
  GONDI: 4,
  SHOLEV: 8,
  PLASMA: 14,
  SNOT: 16,
});
