// src/ai/AITactics.ts
// Ported from Tactics.lua + helper functions from calc_Methods.lua and Pzy_Methods.lua.
// All 16+ tactics with per-character branches (MichiGichi, Gondi, Sholev, others).

import { AIOutput } from './AIOutput';
import { PlayerTable, SunTable, getMaxDistanceOfShot, getMorphState } from './AIBridge';
import {
  getDistance, getVectorSize, getAngleBetweenTwoVectors, getAngleToXY,
  turnToAngleDecision, goodAim, realIsInRange,
} from './AICalc';
import { AILevelConstants, AI_ENTITY_TYPES } from './AIConstants';
import { AILearning } from './AILog';
import { MorphState } from '@/game/MichiGichiPlayer';
import { Entity } from '@/engine/Entity';
import { Bullet } from '@/game/Bullet';
import { Snot } from '@/game/Snot';
import { DifficultyLevel } from './AIConstants';

// ===================================================================
// AIContext — shared mutable state across all tactics in one AI frame
// ===================================================================

export interface AIContext {
  num: number;
  constants: AILevelConstants;
  sunTable: SunTable;
  out: AIOutput;
  learning: AILearning;
  level: DifficultyLevel;
  tacticTime: number;
  inDisAdvantage: boolean;
  // Pzy_Methods flags
  smallGitchiFlag: boolean;
  fireWeapon2Flag: boolean;
  thrustOnceFlag: boolean;
  energyFillFlag: boolean;
  // Tactic flags
  cowardReadyFlag: boolean;
  inLowEnergyAttack: boolean;
  slowDownSunFlag: boolean;
  // fire() state machine
  countShootTime: number;
  readyToFire: boolean;
  // flyInCircle
  rotAngle: number;
  // closeRange
  lastFrameCloseRange: number;
  closeRangeCounter: number;
  // inDisadvantage
  disAdvantageCounter: number;
  // turnAndShoot
  randomAngle: number;
  // Runtime-computed constants
  inAndOutdistance: number;
}

// ===================================================================
// onceMethod — handle one-shot flags from previous frame
// ===================================================================

/** Matches Pzy_Methods.lua:onceMethod() — called once per frame before tactics. */
export function onceMethod(out: AIOutput, ctx: AIContext): void {
  if (ctx.fireWeapon2Flag) {
    out.setFireSecondary(false);
    ctx.fireWeapon2Flag = false;
    ctx.smallGitchiFlag = !ctx.smallGitchiFlag;
  }
  if (ctx.thrustOnceFlag) {
    out.setThrust(false);
    ctx.thrustOnceFlag = false;
  }
}

// ===================================================================
// Helper functions (from calc_Methods.lua and Pzy_Methods.lua)
// ===================================================================

/** Turn to the desired angle. Returns true if reached (within ±1°). */
export function turnToAngle(table: PlayerTable, desiredAngle: number, out: AIOutput): boolean {
  const decision = turnToAngleDecision(table.angle, desiredAngle);
  if (decision.reached) {
    out.resetTurn();
    return true;
  }
  if (decision.right) {
    out.setTurnLeft(false);
    out.setTurnRight(true);
  } else {
    out.setTurnRight(false);
    out.setTurnLeft(true);
  }
  return false;
}

/** Turn away from opponent. */
export function turnAwayFromOp(table: PlayerTable, toOpponentAngle: number, out: AIOutput): void {
  const desiredAngle = (toOpponentAngle + 180) % 360;
  turnToAngle(table, desiredAngle, out);
}

/** Thrust up to a certain speed; when close to opponent (<250), throttle. */
export function playerThrustSpeed(table: PlayerTable, speed: number, out: AIOutput): void {
  const angle = table.angleToOp - table.VVAngle;
  const vVector = Math.cos(angle * Math.PI / 180) * table.speed;
  if (vVector < speed || table.distance > 250) {
    out.setThrust(true);
  } else {
    out.setThrust(false);
  }
}

/** Fire weapon2 once (for morph toggle or one-shot secondary). */
export function fireWeapon2Once(out: AIOutput, ctx: AIContext): void {
  out.setFireSecondary(true);
  ctx.fireWeapon2Flag = true;
}

/** Thrust once then release. */
export function playerThrustOnce(out: AIOutput, ctx: AIContext): void {
  out.setThrust(true);
  ctx.thrustOnceFlag = true;
}

/** Energy-aware primary fire. Stops shooting below minEnergy, resumes above resumeEnergy. */
export function fireWeapon1Energy(table: PlayerTable, out: AIOutput, ctx: AIContext): void {
  if (table.energy < ctx.constants.minEnergyLevel && !ctx.energyFillFlag) {
    out.setFirePrimary(false);
    ctx.energyFillFlag = true;
  } else if (table.energy > ctx.constants.resumeEnergyLevel || !ctx.energyFillFlag) {
    out.setFirePrimary(true);
    ctx.energyFillFlag = false;
  }
}

/** Energy-aware secondary fire. */
export function fireWeapon2Energy(table: PlayerTable, out: AIOutput, ctx: AIContext): void {
  if (table.energy < ctx.constants.minEnergyLevel) {
    out.setFireSecondary(false);
    ctx.energyFillFlag = true;
  } else if (table.energy > ctx.constants.resumeEnergyLevel || !ctx.energyFillFlag) {
    out.setFireSecondary(true);
    ctx.energyFillFlag = false;
  }
}

/** Stop firing a weapon. */
function fireStop(out: AIOutput, weapon: number): void {
  if (weapon === 1) {
    out.setFirePrimary(false);
  } else {
    out.setFireSecondary(false);
  }
}

/** Burst fire state machine. Matches calc_Methods.lua:fire(). */
export function fire(
  computer: PlayerTable, user: PlayerTable, weapon: number,
  shootTime: number, shootInterval: number, timeToRest: number,
  aim: boolean, out: AIOutput, ctx: AIContext,
): void {
  if (aim) {
    turnToAngle(computer, goodAim(computer, user, ctx.constants.goodAimProbability), out);
  }
  if (ctx.countShootTime <= shootTime && ctx.readyToFire) {
    if (shootInterval > 0 && ctx.countShootTime % shootInterval === 0) {
      if (weapon === 1) {
        if (realIsInRange(computer, user)) {
          out.setFirePrimary(true);
        }
      } else {
        out.setFireSecondary(true);
      }
    } else {
      fireStop(out, weapon);
    }
    ctx.countShootTime++;
  } else {
    fireStop(out, weapon);
    out.resetTurnAndThrust();
    ctx.countShootTime = 0;
    ctx.readyToFire = false;
    if (timeToRest > 0 && ctx.num % timeToRest === 0) {
      ctx.readyToFire = true;
    }
  }
}

/**
 * Slow down the spaceship. Returns true when speed is below howSlow.
 * Near the sun, forces distance from sun instead.
 */
export function slowDown(table: PlayerTable, howSlow: number, out: AIOutput, ctx: AIContext): boolean {
  if (getDistance(table, ctx.sunTable) < 250 || ctx.slowDownSunFlag) {
    ctx.slowDownSunFlag = true;
    stayAtADistanceFromSun(table, ctx.sunTable, 450, out, ctx);
    return false;
  }

  if (howSlow < 0.02) howSlow = 0.02;

  const dx = table.dxVector;
  const dy = table.dyVector;
  const speedSize = getVectorSize(0, 0, dx, dy);
  const relativeSpeed = table.maxSpeed > 0 ? speedSize / table.maxSpeed : 0;

  if (relativeSpeed > howSlow) {
    const v1 = { x: dx, y: dy, size: speedSize };
    const v2 = { x: 0, y: 1, size: 1 };
    const angleOfSpeed = getAngleBetweenTwoVectors(v1, v2);
    const reverseAngle = (angleOfSpeed + 180) % 360;

    if (Math.abs(table.angle - reverseAngle) > 2) {
      out.setThrust(false);
      turnToAngle(table, reverseAngle, out);
    } else {
      out.resetTurn();
      out.setThrust(true);
    }
    return false;
  }

  out.resetTurnAndThrust();
  return true;
}

/** Keep distance from the sun. Returns true if too close and evading. */
export function stayAtADistanceFromSun(
  computer: PlayerTable, sun: SunTable, distance: number,
  out: AIOutput, ctx: AIContext,
): boolean {
  const currentDistance = getDistance(computer, sun);
  if (currentDistance - distance < 0) {
    // Too close — morph to fast if MG slow
    if (computer.morphState === MorphState.MICHI) {
      fireWeapon2Once(out, ctx);
    }
    turnAwayFromOp(computer, computer.angleToSun, out);
    out.setThrust(true);
    return true;
  }
  out.resetTurnAndThrust();
  ctx.slowDownSunFlag = false;
  return false;
}

/** Maintain distance from opponent. Returns true if closer than distance. */
export function stayAtADistance(
  computer: PlayerTable, user: PlayerTable, distance: number, out: AIOutput,
): boolean {
  const currentDistance = getDistance(computer, user);
  if (currentDistance < distance) {
    turnAwayFromOp(computer, computer.angleToOp, out);
    out.setThrust(true);
    return true;
  }
  out.setThrust(false);
  return false;
}

/** Maintain distance from an entity at (entityX, entityY). */
export function stayAtADistanceFromEntity(
  computer: PlayerTable, entityX: number, entityY: number,
  distance: number, out: AIOutput,
): void {
  const dx = computer.x - entityX;
  const dy = computer.y - entityY;
  const currentDistance = Math.sqrt(dx * dx + dy * dy);
  if (currentDistance < distance) {
    const angle = getAngleToXY(entityX, entityY, computer.x, computer.y);
    turnAwayFromOp(computer, angle, out);
    out.setThrust(true);
  } else {
    out.resetTurnAndThrust();
  }
}

/** Fly to point (x, y). Returns true when within 100 units. */
export function flyToPoint(table: PlayerTable, x: number, y: number, out: AIOutput): boolean {
  const dx = table.x - x;
  const dy = table.y - y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angleToXY = getAngleToXY(x, y, table.x, table.y);

  if (dist < 100) {
    out.resetTurn();
    out.setThrust(false);
    return true;
  }
  turnToAngle(table, angleToXY, out);
  out.setThrust(true);
  return false;
}

/** Fly to point and stop. Returns true when arrived and stopped. */
export function flyToPointNStop(
  table: PlayerTable, x: number, y: number,
  out: AIOutput, ctx: AIContext,
): boolean {
  const dx = table.x - x;
  const dy = table.y - y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angleToXY = getAngleToXY(x, y, table.x, table.y);

  if (dist < 300) {
    if (table.speed > 0.1) {
      slowDown(table, 0, out, ctx);
    } else if (dist > 100) {
      if (turnToAngle(table, angleToXY, out)) {
        if (table.speed < 0.1) {
          out.setThrust(true);
        } else {
          out.setThrust(false);
        }
      }
    } else {
      slowDown(table, 0, out, ctx);
      return true;
    }
  } else {
    if (turnToAngle(table, angleToXY, out)) {
      out.setThrust(true);
    }
  }
  return false;
}

/** Fly in circle around user at given radius. */
export function flyInCircle(
  computer: PlayerTable, user: PlayerTable,
  radius: number, out: AIOutput, ctx: AIContext,
): void {
  const x = radius * Math.sin(ctx.rotAngle * Math.PI / 180) + user.x;
  const y = radius * Math.cos(ctx.rotAngle * Math.PI / 180) + user.y;
  if (flyToPoint(computer, x, y, out)) {
    ctx.rotAngle = (ctx.rotAngle + 46) % 360;
  }
}

// ===================================================================
// Entity query helpers
// ===================================================================

/** Number of active shots in the air for a player. */
export function numOfShotsInAir(table: PlayerTable): number {
  return table.shots.length;
}

/** Find closest plasma bullet to the computer. Returns {x,y} or null. */
export function getClosestPlasma(
  computer: PlayerTable, user: PlayerTable,
): { x: number; y: number } | null {
  if (user.entityType !== AI_ENTITY_TYPES.MITCHIGITCHI) return null;
  let closest: { x: number; y: number } | null = null;
  let minDist = 1000;
  for (const bullet of user.shots) {
    if (bullet.config.tracking) {
      const bx = bullet.position.x;
      const by = bullet.position.y;
      const dist = getDistance(computer, { x: bx, y: by });
      if (dist < minDist) {
        minDist = dist;
        closest = { x: bx, y: by };
      }
    }
  }
  return closest;
}

/** Find closest non-attached snot to the computer. Returns {x,y} or null. */
export function getClosestSnot(
  computer: PlayerTable, user: PlayerTable,
): { x: number; y: number } | null {
  if (user.entityType !== AI_ENTITY_TYPES.GONDI) return null;
  let closest: { x: number; y: number } | null = null;
  let minDist = 1000;
  for (const snot of user.snots) {
    if (!snot.attached) {
      const sx = snot.position.x;
      const sy = snot.position.y;
      const dist = getDistance(computer, { x: sx, y: sy });
      if (dist < minDist) {
        minDist = dist;
        closest = { x: sx, y: sy };
      }
    }
  }
  return closest;
}

/**
 * Check if Sholev's ice shield is active.
 * Returns TTL of ice shield if active, false otherwise.
 * TODO: Implement when Sholev character is added.
 */
export function isActiveIceShield(_table: PlayerTable): number | false {
  // Sholev not yet implemented — frost bullet detection will be added later
  return false;
}

/** Count snots fired by playerTable that are stuck on the opponent. */
export function getNumberOfSnotsStuck(table: PlayerTable): number {
  if (table.entityType !== AI_ENTITY_TYPES.GONDI) return 0;
  let count = 0;
  for (const snot of table.snots) {
    if (snot.attached) {
      count++;
    }
  }
  return count;
}

/** Returns true if user is facing AI and has shots in the air. */
export function facingAndShooting(
  computer: PlayerTable, user: PlayerTable, ctx: AIContext,
): boolean {
  const toAngle = goodAim(user, computer, ctx.constants.goodAimProbability);
  if (
    Math.abs(user.angle - toAngle) < 2 &&
    numOfShotsInAir(user) > 0 &&
    realIsInRange(user, computer)
  ) {
    return true;
  }
  return false;
}

// ===================================================================
// Avoidance tactics (return true if activated)
// ===================================================================

/** Avoid blue plasma bullets. Returns true if actively evading. */
export function avoidBluePlasma(
  computer: PlayerTable, user: PlayerTable,
  out: AIOutput, ctx: AIContext,
): boolean {
  const distance = ctx.constants.distanceToAvoidPlasma;
  if (user.entityType === AI_ENTITY_TYPES.MITCHIGITCHI) {
    const plasma = getClosestPlasma(computer, user);
    if (plasma) {
      const plasmaDist = getDistance(computer, plasma);
      if (plasmaDist < distance) {
        // If AI is MG in slow mode, morph to fast
        if (computer.entityType === AI_ENTITY_TYPES.MITCHIGITCHI &&
            computer.morphState === MorphState.MICHI) {
          fireWeapon2Once(out, ctx);
        }
        stayAtADistanceFromEntity(computer, plasma.x, plasma.y, distance, out);
        return true;
      }
    }
  }
  return false;
}

/** Avoid snot projectiles. Returns true if actively evading. */
export function avoidSnot(
  computer: PlayerTable, user: PlayerTable,
  out: AIOutput, ctx: AIContext,
): boolean {
  const distance = ctx.constants.distanceToAvoidSnot;
  if (user.entityType === AI_ENTITY_TYPES.GONDI) {
    const snot = getClosestSnot(computer, user);
    if (snot) {
      const snotDist = getDistance(computer, snot);
      if (snotDist < distance) {
        stayAtADistanceFromEntity(computer, snot.x, snot.y, distance, out);
        return true;
      }
    }
  }
  return false;
}

/** Avoid Sholev's ice shield. Returns true if actively evading. */
export function avoidIceSholev(
  computer: PlayerTable, user: PlayerTable,
  out: AIOutput, ctx: AIContext,
): boolean {
  const distance = ctx.constants.distanceToAvoidSholevIce;
  if (user.entityType === AI_ENTITY_TYPES.SHOLEV) {
    const ttl = isActiveIceShield(user);
    if (ttl !== false && user.distance < distance) {
      if (computer.entityType === AI_ENTITY_TYPES.MITCHIGITCHI) {
        if (computer.morphState === MorphState.MICHI) {
          out.setFirePrimary(true);
          fireWeapon2Once(out, ctx);
        } else if (computer.morphState === MorphState.GICHI) {
          inDisadvantage(computer, user, out, ctx);
        }
      } else if (computer.entityType === AI_ENTITY_TYPES.GONDI) {
        out.setFireSecondary(true);
        inDisadvantage(computer, user, out, ctx);
      } else if (computer.entityType === AI_ENTITY_TYPES.SHOLEV) {
        out.setFireSecondary(true);
        inDisadvantage(computer, user, out, ctx);
      }
      return true;
    }
  }
  return false;
}

/** Shoot when snots have slowed the opponent. Returns true if active. */
export function shootWhenSnotsActive(
  computer: PlayerTable, user: PlayerTable,
  out: AIOutput, ctx: AIContext,
): boolean {
  if (computer.entityType === AI_ENTITY_TYPES.GONDI) {
    if (user.maxSpeed < ctx.constants.BELOW_MAX_SPEED_TO_SHOOT) {
      out.setFireSecondary(false);
      if (turnToAngle(computer, goodAim(computer, user, ctx.constants.goodAimProbability), out)) {
        if (realIsInRange(computer, user)) {
          out.setFirePrimary(true);
          out.setThrust(false);
        } else {
          out.setFirePrimary(false);
          playerThrustSpeed(computer, 0.1, out);
        }
      }
      return true;
    } else if (
      getNumberOfSnotsStuck(computer) >= 2 &&
      (ctx.level === 2 || ctx.level === 3)
    ) {
      flyInCircle(computer, user, 200, out, ctx);
      out.setFirePrimary(false);
      out.setFireSecondary(true);
      return true;
    } else {
      out.resetShots();
      out.resetTurn();
    }
  }
  return false;
}

/** Action when snots are stuck on the AI spaceship. Returns true if active. */
export function snotsStuckOnAIAction(
  computer: PlayerTable, user: PlayerTable,
  out: AIOutput, ctx: AIContext,
): boolean {
  if (
    getNumberOfSnotsStuck(user) > 0 &&
    computer.maxSpeed <= ctx.constants.BELOW_MAX_SPEED_TO_SHOOT
  ) {
    if (computer.entityType === AI_ENTITY_TYPES.MITCHIGITCHI) {
      out.resetShots();
      if (computer.morphState === MorphState.GICHI) {
        fireWeapon2Once(out, ctx);
      }
      if (realIsInRange(user, user)) {
        out.setFirePrimary(true);
      } else {
        out.setFirePrimary(false);
      }
    } else if (computer.entityType === AI_ENTITY_TYPES.GONDI) {
      out.resetShots();
      if (realIsInRange(user, user)) {
        if (Math.abs(computer.angle - computer.angleToOp) < 10) {
          out.setFirePrimary(true);
        } else {
          out.setFirePrimary(false);
          out.setFireSecondary(true);
        }
      } else {
        out.resetShots();
      }
    } else if (computer.entityType === AI_ENTITY_TYPES.SHOLEV) {
      out.setFireSecondary(false);
      if (realIsInRange(user, computer)) {
        out.setThrust(true);
        out.setFireSecondary(true);
      } else {
        out.setFireSecondary(false);
        out.setThrust(false);
      }
    } else {
      // All other spaceships
      out.resetShots();
      if (realIsInRange(user, computer)) {
        if (Math.abs(computer.angle - computer.angleToOp) < 10) {
          out.setFirePrimary(true);
        } else {
          out.setFirePrimary(false);
          out.setFireSecondary(true);
        }
      } else {
        out.resetShots();
      }
    }
    return true;
  }
  return false;
}

// ===================================================================
// Attack/Defense Tactics
// ===================================================================

/** Super fast and shoot — per-character acceleration + firing. */
export function superFastAndShoot(
  computer: PlayerTable, user: PlayerTable,
  out: AIOutput, ctx: AIContext,
): void {
  if (computer.entityType === AI_ENTITY_TYPES.MITCHIGITCHI) {
    if (computer.speed < computer.maxSpeed) {
      if (computer.morphState === MorphState.MICHI) {
        fireWeapon2Once(out, ctx);
      } else {
        out.resetTurn();
        out.setFirePrimary(false);
        out.setThrust(true);
      }
    } else {
      out.setThrust(false);
      const toAngle = goodAim(computer, user, ctx.constants.goodAimProbability);
      turnToAngle(computer, toAngle, out);
      if (realIsInRange(computer, user)) {
        fireWeapon1Energy(computer, out, ctx);
      } else {
        out.setFirePrimary(false);
      }
      if (ctx.num % 250 === 1) {
        fireWeapon2Once(out, ctx);
      }
    }
  } else if (computer.entityType === AI_ENTITY_TYPES.GONDI) {
    if (computer.speed < computer.maxSpeed) {
      out.resetTurn();
      out.setThrust(true);
      out.setFireSecondary(false);
    } else {
      out.setThrust(false);
      const toAngle = goodAim(computer, user, ctx.constants.goodAimProbability);
      turnToAngle(computer, toAngle, out);
      fireWeapon2Energy(computer, out, ctx);
      if (realIsInRange(computer, user)) {
        out.setFirePrimary(true);
      } else {
        out.setFirePrimary(false);
      }
    }
  } else if (computer.entityType === AI_ENTITY_TYPES.SHOLEV) {
    if (computer.speed < computer.maxSpeed) {
      out.resetTurn();
      out.setFirePrimary(false);
      out.setThrust(true);
      fireWeapon2Once(out, ctx);
    } else {
      out.setThrust(false);
      const toAngle = goodAim(computer, user, ctx.constants.goodAimProbability);
      turnToAngle(computer, toAngle, out);
      if (realIsInRange(computer, user)) {
        fireWeapon1Energy(computer, out, ctx);
      } else {
        out.setFirePrimary(false);
      }
    }
  } else {
    // All other spaceships
    if (computer.speed < computer.maxSpeed) {
      out.resetTurn();
      out.setThrust(true);
      out.setFirePrimary(false);
    } else {
      out.setThrust(false);
      const toAngle = goodAim(computer, user, ctx.constants.goodAimProbability);
      turnToAngle(computer, toAngle, out);
      if (realIsInRange(computer, user)) {
        fireWeapon1Energy(computer, out, ctx);
      } else {
        out.setFirePrimary(false);
      }
    }
  }
}

/** Zigzag flight perpendicular to user's velocity vector. */
export function zigzag(
  computer: PlayerTable, user: PlayerTable,
  out: AIOutput, ctx: AIContext,
): void {
  const anglesToTurn = 45;
  const rateOfChange = 150;
  const userVelocityVector = user.VVAngle;
  out.setThrust(true);

  if (computer.entityType === AI_ENTITY_TYPES.MITCHIGITCHI) {
    if (computer.morphState === MorphState.MICHI) {
      fireWeapon2Once(out, ctx);
    }
    if (ctx.num % (rateOfChange * 2) < rateOfChange) {
      turnToAngle(computer, userVelocityVector + anglesToTurn, out);
    } else {
      turnToAngle(computer, userVelocityVector - anglesToTurn, out);
    }
  } else if (computer.entityType === AI_ENTITY_TYPES.GONDI) {
    if (!shootWhenSnotsActive(computer, user, out, ctx)) {
      const numberOfWeapon2 = 15;
      if (numOfShotsInAir(computer) < numberOfWeapon2) {
        fireWeapon2Energy(computer, out, ctx);
      } else {
        out.setFireSecondary(false);
      }
      if (ctx.num % (rateOfChange * 2) < rateOfChange) {
        turnToAngle(computer, userVelocityVector + anglesToTurn, out);
      } else {
        turnToAngle(computer, userVelocityVector - anglesToTurn, out);
      }
    }
  } else {
    // Sholev and all others
    if (ctx.num % (rateOfChange * 2) < rateOfChange) {
      turnToAngle(computer, userVelocityVector + anglesToTurn, out);
    } else {
      turnToAngle(computer, userVelocityVector - anglesToTurn, out);
    }
  }
}

/** Turn and shoot — maintain distance, random angle shots. */
export function turnAndShoot(
  computer: PlayerTable, user: PlayerTable,
  out: AIOutput, ctx: AIContext,
): void {
  if (ctx.num % 500 === 1) {
    ctx.randomAngle = Math.floor(Math.random() * 360);
  }
  const numberOfShots = numOfShotsInAir(computer);

  if (computer.entityType === AI_ENTITY_TYPES.MITCHIGITCHI) {
    const MGstate = computer.morphState;
    if (computer.distance > 350 && numberOfShots < 10 && computer.energy > 0.4) {
      if (numberOfShots < 5) {
        if (MGstate === MorphState.GICHI) {
          fireWeapon2Once(out, ctx);
        } else if (MGstate === MorphState.MICHI) {
          out.setThrust(false);
          const toAngle = goodAim(computer, user, ctx.constants.goodAimProbability);
          turnToAngle(computer, toAngle, out);
          if (realIsInRange(computer, user)) {
            out.setFirePrimary(true);
          } else {
            out.setFirePrimary(false);
          }
        }
      } else {
        if (MGstate === MorphState.MICHI) {
          fireWeapon2Once(out, ctx);
        } else if (MGstate === MorphState.GICHI) {
          out.setThrust(false);
          const toAngle = goodAim(computer, user, ctx.constants.goodAimProbability);
          turnToAngle(computer, toAngle, out);
          if (Math.abs(computer.angle - toAngle) < 5 &&
              MGstate !== MorphState.GICHI_TO_MICHI &&
              MGstate !== MorphState.MICHI_TO_GICHI) {
            if (realIsInRange(computer, user)) {
              out.setFirePrimary(true);
            } else {
              out.setFirePrimary(false);
            }
          }
        }
      }
    } else {
      out.resetShots();
      if (MGstate === MorphState.MICHI) {
        fireWeapon2Once(out, ctx);
      }
      turnToAngle(computer, ctx.randomAngle, out);
      out.setThrust(true);
    }
  } else if (computer.entityType === AI_ENTITY_TYPES.GONDI) {
    fireWeapon2Energy(computer, out, ctx);
    if (realIsInRange(computer, user)) {
      out.setFirePrimary(true);
    } else {
      out.setFirePrimary(false);
    }
    if (ctx.num % 250 < 125) {
      out.setThrust(false);
      const toAngle = goodAim(computer, user, ctx.constants.goodAimProbability);
      turnToAngle(computer, toAngle, out);
    } else {
      turnToAngle(computer, ctx.randomAngle, out);
      out.setThrust(true);
    }
  } else {
    // Sholev and all others
    if (computer.distance > 350 && numberOfShots < 10 && computer.energy > 0.4) {
      out.setThrust(false);
      const toAngle = goodAim(computer, user, ctx.constants.goodAimProbability);
      turnToAngle(computer, toAngle, out);
      if (Math.abs(computer.angle - toAngle) < 5) {
        if (realIsInRange(computer, user)) {
          out.setFirePrimary(true);
        } else {
          out.setFirePrimary(false);
        }
      }
    } else {
      out.resetShots();
      turnToAngle(computer, ctx.randomAngle, out);
      out.setThrust(true);
    }
  }
}

/** ZigZag shoot — zigzag aimed at opponent with optional slow-down. */
export function zigZagShoot(
  computer: PlayerTable, user: PlayerTable,
  stop: boolean, out: AIOutput, ctx: AIContext,
): void {
  let anglesToTurn = 15;
  let rateOfChange = 100;
  const toAngle = computer.angleToOp;

  const doZigZag = () => {
    if (ctx.num % 3 === 1) {
      if (ctx.num % (rateOfChange * 2) < rateOfChange) {
        turnToAngle(computer, toAngle + anglesToTurn, out);
      } else {
        turnToAngle(computer, toAngle - anglesToTurn, out);
      }
    } else {
      out.resetTurn();
    }
  };

  if (computer.entityType === AI_ENTITY_TYPES.MITCHIGITCHI) {
    if (computer.morphState === MorphState.MICHI) {
      fireWeapon2Once(out, ctx);
    }
    if (stop) {
      if (slowDown(computer, 0.2, out, ctx)) {
        doZigZag();
      }
    } else {
      doZigZag();
    }
  } else if (computer.entityType === AI_ENTITY_TYPES.GONDI) {
    rateOfChange = 50;
    anglesToTurn = 30;
    if (stop) {
      if (slowDown(computer, 0, out, ctx)) {
        if (realIsInRange(computer, user)) {
          doZigZag();
        }
      }
    } else {
      if (realIsInRange(computer, user)) {
        doZigZag();
      }
    }
  } else {
    // Sholev and all others
    if (stop) {
      if (slowDown(computer, 0, out, ctx)) {
        doZigZag();
      }
    } else {
      doZigZag();
    }
  }
  // Firing for all
  if (realIsInRange(computer, user)) {
    fireWeapon1Energy(computer, out, ctx);
  } else {
    out.setFirePrimary(false);
  }
}

/** Unique tactic — character-specific power play. */
export function uniqueTactic(
  computer: PlayerTable, user: PlayerTable,
  out: AIOutput, ctx: AIContext,
): void {
  if (computer.entityType === AI_ENTITY_TYPES.MITCHIGITCHI) {
    if (computer.morphState === MorphState.GICHI) {
      out.setFireSecondary(true);
    }
    turnToAngle(computer, computer.angleToOp, out);
    out.setFirePrimary(true);
    out.setThrust(true);
  } else if (computer.entityType === AI_ENTITY_TYPES.GONDI) {
    if (user.maxSpeed < ctx.constants.BELOW_MAX_SPEED_TO_SHOOT) {
      const toAngle = goodAim(computer, user, ctx.constants.goodAimProbability);
      turnToAngle(computer, toAngle, out);
      if (realIsInRange(computer, user)) {
        out.setFirePrimary(true);
        out.setThrust(false);
      } else {
        out.setThrust(true);
      }
    } else if (computer.distance < ctx.constants.holdingDistanceBeforeFly) {
      out.setFirePrimary(false);
      turnAwayFromOp(computer, computer.angleToOp, out);
      out.setThrust(true);
      if (numOfShotsInAir(user) !== 0) {
        zigzag(computer, user, out, ctx);
        fireWeapon2Energy(computer, out, ctx);
      }
    } else {
      out.setFirePrimary(false);
      out.setFireSecondary(false);
      slowDown(computer, 0.2, out, ctx);
    }
  } else if (computer.entityType === AI_ENTITY_TYPES.SHOLEV) {
    turnToAngle(computer, computer.angleToOp, out);
    out.setThrust(true);
    if (computer.distance < 500) {
      out.setFireSecondary(true);
      if (computer.distance < ctx.constants.distanceSholevToFreezeAim) {
        out.resetTurn();
      }
    } else {
      out.setFireSecondary(false);
    }
  }
  // Other spaceships: no unique tactic (empty in original)
}

/** Coward flying — safe distance + energy-based firing. */
export function cowardFlying(
  computer: PlayerTable, user: PlayerTable,
  out: AIOutput, ctx: AIContext,
): void {
  if (computer.entityType === AI_ENTITY_TYPES.GONDI) {
    fireWeapon2Energy(computer, out, ctx);
  }
  const AIRange = computer.weapon1Distance;
  let userRange = user.weapon1Distance;
  // If user is MG in slow mode, reduce range
  if (user.morphState === MorphState.MICHI) {
    userRange = AIRange;
  }
  // Morph MG to fast
  if (computer.entityType === AI_ENTITY_TYPES.MITCHIGITCHI &&
      computer.morphState === MorphState.MICHI) {
    fireWeapon2Once(out, ctx);
  }
  if (computer.energy < 0.1) {
    ctx.cowardReadyFlag = false;
  }
  if (computer.distance > userRange || ctx.cowardReadyFlag) {
    if (computer.energy > 0.75) {
      ctx.cowardReadyFlag = true;
    }
    if (slowDown(computer, 0, out, ctx) || realIsInRange(computer, user)) {
      const angle = goodAim(computer, user, ctx.constants.goodAimProbability);
      turnToAngle(computer, angle, out);
      if (computer.distance <= AIRange) {
        out.setFirePrimary(true);
      } else {
        out.setFirePrimary(false);
      }
    }
  } else {
    stayAtADistanceFromEntity(computer, user.x, user.y, userRange, out);
    out.setFirePrimary(false);
  }
}

/** Low energy attack — exploit when opponent energy is low. */
export function lowEnergyAttack(
  computer: PlayerTable, user: PlayerTable,
  out: AIOutput, ctx: AIContext,
): void {
  const AIRange = computer.weapon1Distance;
  let userRange = user.weapon1Distance;
  if (user.morphState === MorphState.MICHI) {
    userRange = AIRange;
  }
  if (computer.entityType === AI_ENTITY_TYPES.MITCHIGITCHI &&
      computer.morphState === MorphState.MICHI) {
    fireWeapon2Once(out, ctx);
  }
  if ((user.energy < 0.3 && computer.energy > 0.3) || ctx.inLowEnergyAttack) {
    out.setFireSecondary(false);
    ctx.inLowEnergyAttack = true;
    if (computer.energy < 0.05) {
      ctx.inLowEnergyAttack = false;
    }
    const toAngle = goodAim(computer, user, ctx.constants.goodAimProbability);
    turnToAngle(computer, toAngle, out);
    out.setThrust(true);
    if (realIsInRange(computer, user)) {
      out.setFirePrimary(true);
      out.setThrust(false);
    }
  } else {
    ctx.inLowEnergyAttack = false;
    out.setFirePrimary(false);
    stayAtADistanceFromEntity(computer, user.x, user.y, userRange, out);
  }
  if (computer.entityType === AI_ENTITY_TYPES.GONDI) {
    fireWeapon2Energy(computer, out, ctx);
  }
}

/** Close range attack — emergency melee response. */
export function closeRangeAttack(
  computer: PlayerTable, user: PlayerTable,
  out: AIOutput, ctx: AIContext,
): void {
  if (ctx.num - ctx.lastFrameCloseRange > 1) {
    ctx.closeRangeCounter = 0;
  } else {
    ctx.closeRangeCounter++;
  }
  ctx.lastFrameCloseRange = ctx.num;

  if (ctx.closeRangeCounter > 200) {
    out.setThrust(false);
    out.setFireSecondary(false);
    const toAngle = goodAim(computer, user, ctx.constants.goodAimProbability);
    turnToAngle(computer, toAngle, out);
    out.setFirePrimary(true);
  } else {
    turnToAngle(computer, (user.VVAngle + 135) % 360, out);
    out.setThrust(true);
    if (computer.entityType === AI_ENTITY_TYPES.GONDI) {
      out.setFireSecondary(true);
    }
  }
}

/** In disadvantage — reactive evasion when hit. */
export function inDisadvantage(
  computer: PlayerTable, user: PlayerTable,
  out: AIOutput, ctx: AIContext,
): void {
  ctx.disAdvantageCounter++;
  // MG slow → morph to fast
  if (computer.morphState === MorphState.MICHI) {
    fireWeapon2Once(out, ctx);
  }
  // Fire if facing opponent
  if (Math.abs(computer.angle - computer.angleToOp) < 15) {
    out.setFirePrimary(true);
  } else {
    out.setFirePrimary(false);
  }
  out.setThrust(true);
  if (ctx.num % 500 < 250) {
    turnToAngle(computer, user.VVAngle + 90, out);
  } else {
    turnToAngle(computer, user.VVAngle - 90, out);
  }
  if (ctx.disAdvantageCounter % 50 === 1) {
    ctx.inDisAdvantage = false;
  }
}

/** In and out — hit-and-run approach/retreat. */
export function inAndOut(
  computer: PlayerTable, user: PlayerTable,
  out: AIOutput, ctx: AIContext,
): void {
  const toAngle = goodAim(computer, user, ctx.constants.goodAimProbability);
  if (computer.distance < ctx.inAndOutdistance) {
    stayAtADistance(computer, user, ctx.inAndOutdistance, out);
    if (computer.entityType === AI_ENTITY_TYPES.GONDI) {
      fireWeapon2Energy(computer, out, ctx);
    }
  } else {
    out.setFireSecondary(false);
    out.setThrust(true);
    if (turnToAngle(computer, toAngle, out)) {
      zigZagShoot(computer, user, false, out, ctx);
    }
  }
}

/** Stationary attack — stop, aim, fire bursts. */
export function stationaryAttack(
  computer: PlayerTable, user: PlayerTable,
  out: AIOutput, ctx: AIContext,
): void {
  if (slowDown(computer, 0, out, ctx)) {
    turnToAngle(computer, computer.angleToOp, out);
    if (computer.entityType === AI_ENTITY_TYPES.GONDI) {
      if (realIsInRange(computer, user)) {
        out.setFirePrimary(true);
      } else {
        out.setFirePrimary(true);
        fireWeapon2Energy(computer, out, ctx);
      }
    } else {
      fire(computer, user, 1, 1000, 150, 10, true, out, ctx);
    }
  }
}

/** Kamikaze attack — all-in charge at opponent. */
export function kamikazeAttack(
  computer: PlayerTable, user: PlayerTable,
  out: AIOutput, ctx: AIContext,
): void {
  const toAngle = goodAim(computer, user, ctx.constants.goodAimProbability);
  // MG slow → morph to fast
  if (computer.morphState === MorphState.MICHI) {
    fireWeapon2Once(out, ctx);
  }
  turnToAngle(computer, toAngle, out);
  if (computer.distance > ctx.constants.KAMIKAZE_CLOSE_DIS) {
    out.setThrust(true);
  } else {
    out.resetTurnAndThrust();
  }
  if (computer.entityType === AI_ENTITY_TYPES.SHOLEV) {
    fireStop(out, 1);
    out.setFireSecondary(true);
  } else if (computer.entityType === AI_ENTITY_TYPES.GONDI) {
    if (computer.distance < computer.weapon1Distance + 200) {
      fire(computer, user, 1, 500, 25, 10, true, out, ctx);
    } else {
      fireWeapon2Energy(computer, out, ctx);
      out.setFirePrimary(false);
    }
  } else {
    // MG and all other spaceships
    if (realIsInRange(computer, user)) {
      out.setFirePrimary(true);
    } else {
      out.setFirePrimary(false);
    }
  }
}

/** Sit on tail — chase opponent and fire. */
export function sitOnTailAttack(
  computer: PlayerTable, user: PlayerTable,
  out: AIOutput, ctx: AIContext,
): void {
  const angle = computer.angleToOp;
  const dist = computer.distance;
  // MG slow → morph to fast
  if (computer.morphState === MorphState.MICHI) {
    fireWeapon2Once(out, ctx);
  }
  if (dist > user.weapon1Distance - 50) {
    out.setThrust(true);
  } else {
    out.setThrust(false);
  }
  // If user is close and facing AI, stay away
  if (dist < ctx.constants.distanceToStayAway &&
      Math.abs(user.angle - user.angleToOp) < 20) {
    stayAtADistanceFromEntity(computer, user.x, user.y, ctx.constants.distanceToStayAway, out);
  } else {
    turnToAngle(computer, angle, out);
  }
  if (realIsInRange(computer, user)) {
    out.setFirePrimary(true);
  } else {
    out.setFirePrimary(false);
  }
}
