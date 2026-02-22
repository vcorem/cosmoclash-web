import { GameEventListener } from '@/engine/GameEventMgr';
import { GameEvent, GameEventType, BulletHitEvent, CollisionEvent } from '@/engine/GameEvent';
import { Entity } from '@/engine/Entity';
import { Bullet } from './Bullet';

const COLLISION_DAMAGE_SCALE = 0.2;

// Minimum outward speed after a collision event. Prevents low-energy
// orbiting where the ship barely bounces and thrust brings it right back.
// Only applied in handleShipCollision (event-based), NOT in the per-frame
// enforceMinimumDistance constraint (which would cause constant drift).
const MIN_BOUNCE_SPEED = 0.4;


export class CollisionHandler implements GameEventListener {
  onGameEvent(event: GameEvent): void {
    if (event.type === GameEventType.BulletHit) {
      this.handleBulletHit(event as BulletHitEvent);
    } else if (event.type === GameEventType.Collision) {
      this.handleShipCollision(event as CollisionEvent);
    }
  }

  private handleBulletHit(event: BulletHitEvent): void {
    const bullet = event.bullet as Bullet;
    const target = event.target;

    target.health -= bullet.config.damage;
    bullet.destroy();

    if (target.health <= 0) {
      target.destroy();
    }
  }

  private handleShipCollision(event: CollisionEvent): void {
    const a = event.entityA;
    const b = event.entityB;

    // --- Damage based on relative velocity ---
    const rvx = a.accelVec.x - b.accelVec.x;
    const rvy = a.accelVec.y - b.accelVec.y;
    const rvz = a.accelVec.z - b.accelVec.z;
    const relSpeed = Math.sqrt(rvx * rvx + rvy * rvy + rvz * rvz);
    const damage = Math.min(relSpeed * COLLISION_DAMAGE_SCALE, 0.3);

    a.health -= damage;
    b.health -= damage;

    if (a.health <= 0) a.destroy();
    if (b.health <= 0) b.destroy();

    // --- Position separation along collision normal ---
    // Port of C++ SceneMelee::OnGameEvent GAMEEVENT_COLLISION handler.
    // Calculates overlap and pushes entities apart, then deflects velocities.

    const radiusA = a.collisionSpheres[0]?.radius ?? 0;
    const radiusB = b.collisionSpheres[0]?.radius ?? 0;

    let nx = b.position.x - a.position.x;
    let ny = b.position.y - a.position.y;
    let dist = Math.sqrt(nx * nx + ny * ny);

    if (dist < 0.001) {
      // Positions coincide — use relative travel as fallback
      nx = (a.position.x - a.previousPosition.x) - (b.position.x - b.previousPosition.x);
      ny = (a.position.y - a.previousPosition.y) - (b.position.y - b.previousPosition.y);
      const relLen = Math.sqrt(nx * nx + ny * ny);
      if (relLen > 0.001) {
        nx = -nx / relLen;
        ny = -ny / relLen;
      } else {
        nx = 1; ny = 0;
      }
      dist = 0;
    } else {
      nx /= dist;
      ny /= dist;
    }

    // Push entities apart to minDist + margin.
    // Large margin prevents low-velocity orbiting at the contact boundary.
    const targetDist = radiusA + radiusB + 8;
    if (dist < targetDist) {
      const push = (targetDist - dist) / 2;
      a.position.x -= nx * push;
      a.position.y -= ny * push;
      b.position.x += nx * push;
      b.position.y += ny * push;
    }

    // Snap previousPosition so sweep detection on the next frame starts
    // from the separated positions.
    a.previousPosition = { ...a.position };
    b.previousPosition = { ...b.position };

    // --- Velocity deflection (port of C++ CEntity::HandleCollision) ---
    // Redirect each entity's accelVec to point AWAY from the other entity
    // along the collision normal, preserving its speed magnitude.
    // This is idempotent: applying it every frame while overlapping just
    // keeps the velocity pointing away — no oscillation like negation.
    const aSpeed = Math.sqrt(
      a.accelVec.x * a.accelVec.x +
      a.accelVec.y * a.accelVec.y +
      a.accelVec.z * a.accelVec.z,
    );
    const bSpeed = Math.sqrt(
      b.accelVec.x * b.accelVec.x +
      b.accelVec.y * b.accelVec.y +
      b.accelVec.z * b.accelVec.z,
    );

    // Ensure meaningful bounce — prevents low-speed orbiting at boundary
    const aBounce = Math.max(aSpeed, MIN_BOUNCE_SPEED);
    const bBounce = Math.max(bSpeed, MIN_BOUNCE_SPEED);

    // A deflects away from B (opposite to normal direction A→B)
    a.accelVec = { x: -nx * aBounce, y: -ny * aBounce, z: 0 };
    // B deflects away from A (along normal direction A→B)
    b.accelVec = { x: nx * bBounce, y: ny * bBounce, z: 0 };

  }
}

// Buffer zone width beyond collision radii. Within this zone, toward-velocity
// is cancelled every frame, preventing ships from accelerating back toward
// each other after a bounce. Must match the push target in handleShipCollision.
const BUFFER_MARGIN = 8;

/**
 * Per-frame contact constraint with buffer zone.
 *
 * - If overlapping (dist < minDist): pushes apart to minDist + BUFFER_MARGIN
 * - If in buffer zone (dist < minDist + BUFFER_MARGIN): cancels velocity
 *   component pointing toward the other entity, preventing re-approach
 * - If outside buffer zone: no action
 */
export function enforceMinimumDistance(a: Entity, b: Entity): void {
  const radiusA = a.collisionSpheres[0]?.radius ?? 0;
  const radiusB = b.collisionSpheres[0]?.radius ?? 0;
  if (radiusA === 0 && radiusB === 0) return;

  const minDist = radiusA + radiusB;
  const bufferDist = minDist + BUFFER_MARGIN;

  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist >= bufferDist) return; // outside enforcement zone

  // Compute collision normal (A → B)
  let nx: number, ny: number;
  if (dist < 0.001) {
    nx = 1; ny = 0;
  } else {
    nx = dx / dist;
    ny = dy / dist;
  }

  // Position push only when actually overlapping
  if (dist < minDist) {
    const push = (bufferDist - dist) / 2;
    a.position.x -= nx * push;
    a.position.y -= ny * push;
    b.position.x += nx * push;
    b.position.y += ny * push;
  }

  // Cancel velocity components pointing toward the other entity.
  // This applies in the ENTIRE buffer zone, not just when overlapping.
  // Prevents ships from accelerating back toward each other after a bounce.
  const aDotN = a.accelVec.x * nx + a.accelVec.y * ny;
  if (aDotN > 0) {
    a.accelVec.x -= aDotN * nx;
    a.accelVec.y -= aDotN * ny;
  }

  const bDotN = b.accelVec.x * nx + b.accelVec.y * ny;
  if (bDotN < 0) {
    b.accelVec.x -= bDotN * nx;
    b.accelVec.y -= bDotN * ny;
  }
}
