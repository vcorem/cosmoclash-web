// src/ai/AICalc.ts
// Ported from calc_Methods.lua — pure math/geometry functions.
// All functions are stateless (pure) unless noted.

import { PlayerTable } from './AIBridge';
import { AI_ENTITY_TYPES } from './AIConstants';

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

// ---------- Distance functions ----------

/** Euclidean distance between two points (tables with x,y). */
export function getDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Magnitude of vector from (x2,y2) to (x1,y1). */
export function getVectorSize(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

// ---------- Angle functions ----------

/**
 * Angle between two vectors using acos of dot product.
 * If vector1.x < 0, angle = 360 - angle.
 * Matches calc_Methods.lua:getAngleBetweenTwoVectors().
 */
export function getAngleBetweenTwoVectors(
  v1: { x: number; y: number; size: number },
  v2: { x: number; y: number; size: number },
): number {
  if (v1.size < 0.0001 || v2.size < 0.0001) return 0;
  const dot = (v1.x * v2.x + v1.y * v2.y) / (v1.size * v2.size);
  const clamped = Math.max(-1, Math.min(1, dot));
  let angle = Math.acos(clamped) * RAD_TO_DEG;
  if (v1.x < 0) {
    angle = 360 - angle;
  }
  return angle;
}

/**
 * Angle from (fromX, fromY) to (toX, toY) relative to Y-axis up.
 * Matches calc_Methods.lua:getAngleToXY().
 */
export function getAngleToXY(
  toX: number, toY: number,
  fromX: number, fromY: number,
): number {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const size = Math.sqrt(dx * dx + dy * dy);
  if (size < 0.0001) return 0;
  const v1 = { x: dx, y: dy, size };
  const v2 = { x: 0, y: 1, size: 1 };
  return getAngleBetweenTwoVectors(v1, v2);
}

/**
 * Angle of the velocity vector (dxVector, dyVector) relative to Y-axis.
 * Matches calc_Methods.lua:getVVAngle().
 */
export function getVVAngle(dxVector: number, dyVector: number): number {
  const size = Math.sqrt(dxVector * dxVector + dyVector * dyVector);
  if (size < 0.0001) return 0;
  const v1 = { x: dxVector, y: dyVector, size };
  const v2 = { x: 0, y: 1, size: 1 };
  return getAngleBetweenTwoVectors(v1, v2);
}

// ---------- Turning decision ----------

/**
 * Determines which direction to turn to reach desiredAngle from currentAngle.
 * Returns { left, right, reached }.
 * Matches calc_Methods.lua:turnToAngle() logic (but returns decision, no side effects).
 */
export function turnToAngleDecision(
  currentAngle: number,
  desiredAngle: number,
): { left: boolean; right: boolean; reached: boolean } {
  const current = Math.floor(currentAngle);
  const desired = ((desiredAngle % 360) + 360) % 360;

  // Within ±1 degree = reached
  if (Math.abs(current - desired) <= 1 || Math.abs(current - desired) >= 359) {
    return { left: false, right: false, reached: true };
  }

  const plusOneEighty = (current + 180) % 360;
  let inRight: boolean;

  if (current < plusOneEighty) {
    // Right half of the circle
    if (desired >= current && desired <= plusOneEighty) {
      inRight = true;
    } else {
      inRight = false;
    }
  } else {
    // Left half
    if (desired < current && desired > plusOneEighty) {
      inRight = false;
    } else {
      inRight = true;
    }
  }

  return {
    left: !inRight,
    right: inRight,
    reached: false,
  };
}

// ---------- Aiming ----------

/**
 * Predictive aiming — returns the angle the AI should face to hit a moving opponent.
 * Uses goodAimProbability to sometimes return the direct angle (less accurate).
 * Matches calc_Methods.lua:goodAim().
 */
export function goodAim(
  computer: PlayerTable,
  user: PlayerTable,
  probability: number,
): number {
  const distance = getDistance(computer, user);
  const framesToHit = distance * 1.5;
  const futureX = user.x + user.dxVector * framesToHit;
  const futureY = user.y + user.dyVector * framesToHit;
  const correctedAngle = getAngleToXY(futureX, futureY, computer.x, computer.y);

  const random100 = Math.random() * 100;
  if (random100 < 100 * probability) {
    return correctedAngle;
  }
  return computer.angleToOp;
}

// ---------- Range checks ----------

/**
 * Movement-aware range check.
 * For MichiGichi/Sholev: bullet independent of ship velocity.
 * For Gondi: ship momentum transfers to bullet.
 * For others: same as MichiGichi/Sholev.
 * Matches calc_Methods.lua:realIsInRange().
 */
export function realIsInRange(computer: PlayerTable, user: PlayerTable): boolean {
  const numFrames = getMaxTtlOfShotFromTable(computer);

  if (
    computer.entityType === AI_ENTITY_TYPES.GONDI
  ) {
    // Gondi: bullet inherits ship velocity
    const shotFutureX = computer.x + computer.dxVector * numFrames;
    const shotFutureY = computer.y + computer.dyVector * numFrames;
    const userFutureX = user.x + user.dxVector * numFrames;
    const userFutureY = user.y + user.dyVector * numFrames;
    const dx = shotFutureX - userFutureX;
    const dy = shotFutureY - userFutureY;
    const futureDistance = Math.sqrt(dx * dx + dy * dy);
    return futureDistance < computer.weapon1Distance;
  }

  // MichiGichi, Sholev, and others: bullet independent of ship velocity
  const shotInitX = computer.x;
  const shotInitY = computer.y;
  const userFutureX = user.x + user.dxVector * numFrames;
  const userFutureY = user.y + user.dyVector * numFrames;
  const dx = shotInitX - userFutureX;
  const dy = shotInitY - userFutureY;
  const futureDistance = Math.sqrt(dx * dx + dy * dy);
  return futureDistance < computer.weapon1Distance;
}

/**
 * Future range check — will the players be in range in numFrames?
 * Matches calc_Methods.lua:isInFutureRange().
 */
export function isInFutureRange(
  computer: PlayerTable,
  user: PlayerTable,
  numFrames: number,
): boolean {
  const futureCompX = computer.x + computer.dxVector * numFrames;
  const futureCompY = computer.y + computer.dyVector * numFrames;
  const futureUserX = user.x + user.dxVector * numFrames;
  const futureUserY = user.y + user.dyVector * numFrames;
  const dx = futureCompX - futureUserX;
  const dy = futureCompY - futureUserY;
  const futureDistance = Math.sqrt(dx * dx + dy * dy);
  return futureDistance < computer.weapon1Distance;
}

// ---------- Helpers ----------

/** Convenience: get max TTL from a PlayerTable (uses the imported AIBridge function). */
function getMaxTtlOfShotFromTable(table: PlayerTable): number {
  // Inline to avoid circular dependency — replicates AIBridge.getMaxTtlOfShot logic
  const { entityType, morphState } = table;
  if (entityType === AI_ENTITY_TYPES.MITCHIGITCHI) {
    if (morphState === 0 /* MICHI */ || morphState === 3 /* GICHI_TO_MICHI */) {
      return 5000;
    }
    return 1000;
  }
  if (entityType === AI_ENTITY_TYPES.GONDI) return 700;
  if (entityType === AI_ENTITY_TYPES.SHOLEV) return 700;
  return 1000;
}
