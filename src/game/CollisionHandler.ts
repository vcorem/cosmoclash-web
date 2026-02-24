import { GameEventListener, GameEventMgr } from '@/engine/GameEventMgr';
import { GameEvent, GameEventType, BulletHitEvent, CollisionEvent, SunCollisionEvent, SnotHitEvent, ExplosionEvent } from '@/engine/GameEvent';
import { Entity, EntityType } from '@/engine/Entity';
import { ARENA } from './Arena';
import { Bullet } from './Bullet';
import { Snot } from './Snot';
import { Player } from './Player';

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
    } else if (event.type === GameEventType.SunCollision) {
      this.handleSunCollision(event as SunCollisionEvent);
    } else if (event.type === GameEventType.SnotHit) {
      this.handleSnotHit(event as SnotHitEvent);
    }
  }

  private handleBulletHit(event: BulletHitEvent): void {
    const bullet = event.bullet as Bullet;
    const target = event.target;

    // Persistent bullets (frost shield): skip entirely while on cooldown
    if (bullet.config.persistent && bullet.damageCooldown > 0) {
      return;
    }

    // Sun is indestructible — bullets die on contact but deal no damage
    if (target.entityType === EntityType.Sun) {
      // no damage
    } else if (target.entityType === EntityType.Asteroid) {
      // Asteroids are one-shot killed by any bullet (matches C++)
      target.destroy();
      GameEventMgr.getInstance().sendEvent(new ExplosionEvent(target));
    } else {
      target.health -= bullet.getCurrentDamage();
      if (target.health <= 0) {
        target.destroy();
        if (target.entityType === EntityType.Player) {
          GameEventMgr.getInstance().sendEvent(new ExplosionEvent(target));
        }
      }
    }

    if (bullet.config.persistent) {
      // Persistent bullets survive hits — set cooldown instead of destroying
      bullet.damageCooldown = bullet.config.hitRateLimit ?? 0;
    } else {
      bullet.destroy();
    }
  }

  private handleShipCollision(event: CollisionEvent): void {
    const a = event.entityA;
    const b = event.entityB;

    // Asteroid-player: bounce only, no damage (matches C++)
    const hasAsteroid =
      a.entityType === EntityType.Asteroid ||
      b.entityType === EntityType.Asteroid;

    if (hasAsteroid) {
      // Simple velocity redirect matching original C++ CEntity::HandleCollision:
      // Just redirect accelVec to point away from collision partner, preserving speed.
      // No position push, no margin — the original doesn't do any of that.
      let nx = b.position.x - a.position.x;
      let ny = b.position.y - a.position.y;
      const dist = Math.sqrt(nx * nx + ny * ny);
      if (dist > 0.001) {
        nx /= dist;
        ny /= dist;
      } else {
        nx = 1; ny = 0;
      }

      const aSpeed = Math.sqrt(a.accelVec.x * a.accelVec.x + a.accelVec.y * a.accelVec.y);
      const bSpeed = Math.sqrt(b.accelVec.x * b.accelVec.x + b.accelVec.y * b.accelVec.y);
      // A deflects away from B
      a.accelVec = { x: -nx * aSpeed, y: -ny * aSpeed, z: 0 };
      // B deflects away from A
      b.accelVec = { x: nx * bSpeed, y: ny * bSpeed, z: 0 };
      return;
    }

    // --- Player-player: Damage based on relative velocity ---
    const rvx = a.accelVec.x - b.accelVec.x;
    const rvy = a.accelVec.y - b.accelVec.y;
    const rvz = a.accelVec.z - b.accelVec.z;
    const relSpeed = Math.sqrt(rvx * rvx + rvy * rvy + rvz * rvz);
    const damage = Math.min(relSpeed * COLLISION_DAMAGE_SCALE, 0.3);

    a.health -= damage;
    b.health -= damage;

    if (a.health <= 0) {
      a.destroy();
      if (a.entityType === EntityType.Player) {
        GameEventMgr.getInstance().sendEvent(new ExplosionEvent(a));
      }
    }
    if (b.health <= 0) {
      b.destroy();
      if (b.entityType === EntityType.Player) {
        GameEventMgr.getInstance().sendEvent(new ExplosionEvent(b));
      }
    }

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

  private handleSunCollision(event: SunCollisionEvent): void {
    const sun = event.sun;
    const other = event.other;

    // Damage the non-sun entity
    other.health -= ARENA.SUN_DAMAGE;
    if (other.health <= 0) {
      other.destroy();
      if (other.entityType === EntityType.Player) {
        GameEventMgr.getInstance().sendEvent(new ExplosionEvent(other));
      }
    }

    // Compute collision normal (sun → other)
    const radiusSun = sun.collisionSpheres[0]?.radius ?? 0;
    const radiusOther = other.collisionSpheres[0]?.radius ?? 0;

    let nx = other.position.x - sun.position.x;
    let ny = other.position.y - sun.position.y;
    let dist = Math.sqrt(nx * nx + ny * ny);

    if (dist < 0.001) {
      nx = 1; ny = 0; dist = 0;
    } else {
      nx /= dist;
      ny /= dist;
    }

    // Push other entity outside sun collision radius
    const targetDist = radiusSun + radiusOther + 8;
    if (dist < targetDist) {
      other.position.x = sun.position.x + nx * targetDist;
      other.position.y = sun.position.y + ny * targetDist;
    }

    other.previousPosition = { ...other.position };

    // Bounce: redirect velocity away from sun
    const speed = Math.sqrt(
      other.accelVec.x * other.accelVec.x +
      other.accelVec.y * other.accelVec.y +
      other.accelVec.z * other.accelVec.z,
    );
    const bounce = Math.max(speed, MIN_BOUNCE_SPEED);
    other.accelVec = { x: nx * bounce, y: ny * bounce, z: 0 };
  }

  private handleSnotHit(event: SnotHitEvent): void {
    const snot = event.snot as Snot;
    const target = event.target;

    if (target.entityType === EntityType.Player) {
      snot.attachTo(target as Player);
      (target as Player).addSnot();
    } else {
      snot.destroy();
    }
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
