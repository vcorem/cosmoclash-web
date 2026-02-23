// src/ai/AIBridge.ts
// Ported from Pzy_Methods.lua — entity type detection, state query helpers,
// and the PlayerTable / SunTable interfaces that mirror the Lua tables.

import { Player } from '@/game/Player';
import { MichiGichiPlayer, MorphState } from '@/game/MichiGichiPlayer';
import { Bullet } from '@/game/Bullet';
import { Snot } from '@/game/Snot';
import { EntityPool } from '@/engine/EntityPool';
import { CharacterDef } from '@/game/CharacterRegistry';
import { ARENA } from '@/game/Arena';
import { AI_ENTITY_TYPES } from './AIConstants';

// ---------- Entity type detection ----------

/**
 * Returns the AI entity type constant for a player, matching original Lua pzy_enttype().
 * Uses charDef.id to identify character type (matches original C++ EntityName enum).
 */
export function getAIEntityType(charDef: CharacterDef): number {
  if (charDef.isMichiGichi) return AI_ENTITY_TYPES.MITCHIGITCHI;
  if (charDef.id === 'gondi') return AI_ENTITY_TYPES.GONDI;
  if (charDef.id === 'sholev') return AI_ENTITY_TYPES.SHOLEV;
  // All others (neo, orca, ptera, lepid, tiktok, phyto) use default sun bullet
  return 0;
}

// ---------- Bullet speed/TTL/distance lookups ----------

/**
 * Returns the speed of a player's bullet, matching Pzy_Methods.lua:getSpeedOfShot().
 * For MichiGichi, depends on morph state (MICHI=slow plasma, GICHI=fast sun).
 */
export function getSpeedOfShot(entityType: number, morphState?: MorphState): number {
  if (entityType === AI_ENTITY_TYPES.MITCHIGITCHI) {
    if (morphState === MorphState.MICHI || morphState === MorphState.GICHI_TO_MICHI) {
      return 0.2; // plasma bullet
    }
    return 0.525; // sun bullet
  }
  if (entityType === AI_ENTITY_TYPES.GONDI) return 0.18; // flame bullet
  if (entityType === AI_ENTITY_TYPES.SHOLEV) return 0.6; // ice cones
  return 0.525; // sun bullet (default for all others)
}

/**
 * Returns the max TTL of a player's bullet, matching Pzy_Methods.lua:getMaxTtlOfShot().
 */
export function getMaxTtlOfShot(entityType: number, morphState?: MorphState): number {
  if (entityType === AI_ENTITY_TYPES.MITCHIGITCHI) {
    if (morphState === MorphState.MICHI || morphState === MorphState.GICHI_TO_MICHI) {
      return 5000; // plasma bullet
    }
    return 1000; // sun bullet
  }
  if (entityType === AI_ENTITY_TYPES.GONDI) return 700; // flame bullet
  if (entityType === AI_ENTITY_TYPES.SHOLEV) return 700; // ice cones
  return 1000; // sun bullet (default)
}

/**
 * Returns the max distance a bullet can travel, matching Pzy_Methods.lua:getMaxDistanceOfShot().
 */
export function getMaxDistanceOfShot(entityType: number, morphState?: MorphState): number {
  return getMaxTtlOfShot(entityType, morphState) * getSpeedOfShot(entityType, morphState);
}

// ---------- MichiGichi state helper ----------

/**
 * Returns MorphState if the player is a MichiGichiPlayer, undefined otherwise.
 * Matches Pzy_Methods.lua:getMitchiGitchiState().
 */
export function getMorphState(player: Player): MorphState | undefined {
  if (player instanceof MichiGichiPlayer) {
    return player.morphState;
  }
  return undefined;
}

// ---------- PlayerTable and SunTable ----------

/** Mirrors the Lua player table built each frame by init() in turtle.lua */
export interface PlayerTable {
  /** Reference to the Player entity */
  player: Player;
  /** X position */
  x: number;
  /** Y position */
  y: number;
  /** Current heading angle (0-360) */
  angle: number;
  /** Current speed (magnitude of velocity vector) */
  speed: number;
  /** Current max speed (accounting for snotCount) */
  maxSpeed: number;
  /** Velocity X component × TIME_SCALER (matches Lua dxVector) */
  dxVector: number;
  /** Velocity Y component × TIME_SCALER (matches Lua dyVector) */
  dyVector: number;
  /** Health 0-1 */
  life: number;
  /** Energy 0-1 */
  energy: number;
  /** AI entity type constant */
  entityType: number;
  /** Distance to opponent */
  distance: number;
  /** Angle from this player to opponent */
  angleToOp: number;
  /** Angle from this player to sun */
  angleToSun: number;
  /** Max distance of primary weapon */
  weapon1Distance: number;
  /** Active bullets fired by this player */
  shots: Bullet[];
  /** Active snots fired by this player (Gondi only) */
  snots: Snot[];
  /** Number of snots attached to this player */
  snotCount: number;
  /** MorphState if MichiGichi, undefined otherwise */
  morphState?: MorphState;
}

/** Sun position table */
export interface SunTable {
  x: number;
  y: number;
}

// ---------- Angle calculation (matching Lua getAngle) ----------

/**
 * The original Lua getAngle does (-pzy_entangle(player)+360)%360.
 * Our Entity.angle is already corrected to 0-360.
 * In the original C++, pzy_entangle returns the raw angle which increases
 * counter-clockwise. Our angle increases clockwise (right turn = +angle).
 * The Lua negation + 360 converts from CCW to CW.
 * Since our Entity.angle already stores CW angle, we use it directly.
 */
function getAngle(player: Player): number {
  return player.angle;
}

/**
 * Computes the angle from one position to another (relative to Y-axis up).
 * Matches the Lua getAngleToXY / getAngleToPlayer pattern.
 */
function getAngleToXY(toX: number, toY: number, fromX: number, fromY: number): number {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const size = Math.sqrt(dx * dx + dy * dy);
  if (size < 0.0001) return 0;
  // dot product with (0,1) = dy, cross-like check on x
  const cosAngle = dy / size;
  const clamped = Math.max(-1, Math.min(1, cosAngle));
  let angle = Math.acos(clamped) * (180 / Math.PI);
  if (dx < 0) {
    angle = 360 - angle;
  }
  return angle;
}

// ---------- Build player table ----------

/**
 * Builds a PlayerTable from live game state, matching turtle.lua:init().
 * Called once per frame for both AI and user players.
 */
export function buildPlayerTable(
  player: Player,
  opponent: Player,
  charDef: CharacterDef,
  bulletPool: EntityPool<Bullet>,
  snotPool: EntityPool<Snot>,
): PlayerTable {
  const x = player.position.x;
  const y = player.position.y;
  const oppX = opponent.position.x;
  const oppY = opponent.position.y;
  const sunX = ARENA.SUN_POSITION.x;
  const sunY = ARENA.SUN_POSITION.y;

  const entityType = getAIEntityType(charDef);
  const morphState = getMorphState(player);

  const dxVector = player.accelVec.x * ARENA.TIME_SCALER;
  const dyVector = player.accelVec.y * ARENA.TIME_SCALER;
  const speed = Math.sqrt(dxVector * dxVector + dyVector * dyVector);
  const maxSpeed = player.getEffectiveMaxSpeed();

  // Distance to opponent
  const dx = Math.abs(x - oppX);
  const dy = Math.abs(y - oppY);
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Angle to opponent
  const angleToOp = getAngleToXY(oppX, oppY, x, y);

  // Angle to sun
  const angleToSun = getAngleToXY(sunX, sunY, x, y);

  // Weapon1 distance (max range)
  const weapon1Distance = getMaxDistanceOfShot(entityType, morphState);

  // Collect active bullets fired by this player
  const shots: Bullet[] = [];
  bulletPool.forEachActive((bullet) => {
    if (bullet.originEntity === player) {
      shots.push(bullet);
    }
  });

  // Collect active snots fired by this player
  const snots: Snot[] = [];
  snotPool.forEachActive((snot) => {
    if (snot.originEntity === player) {
      snots.push(snot);
    }
  });

  return {
    player,
    x,
    y,
    angle: getAngle(player),
    speed,
    maxSpeed,
    dxVector,
    dyVector,
    life: player.health,
    energy: player.energy,
    entityType,
    distance,
    angleToOp,
    angleToSun,
    weapon1Distance,
    shots,
    snots,
    snotCount: player.snotCount,
    morphState,
  };
}
