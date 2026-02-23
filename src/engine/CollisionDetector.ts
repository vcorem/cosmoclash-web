import { Entity, EntityType, CollisionSphere, Vec3 } from './Entity';
import { Bullet } from '@/game/Bullet';
import { Snot } from '@/game/Snot';
import { GameEventMgr } from './GameEventMgr';
import { CollisionEvent, BulletHitEvent, SunCollisionEvent, SnotHitEvent } from './GameEvent';

export interface SweepResult {
  hit: boolean;
  u0: number;
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/**
 * Sweep-sphere collision test. Port of C++ SphereSphereSweep().
 * Tests whether two moving spheres collide during the frame.
 * Returns hit=true and normalized collision time u0 in [0, 1].
 * Returns hit=true, u0=0 if already overlapping.
 */
export function sphereSphereSweep(
  ra: number, A0: Vec3, A1: Vec3,
  rb: number, B0: Vec3, B1: Vec3,
): SweepResult {
  const va = sub(A1, A0);
  const vb = sub(B1, B0);
  const AB = sub(B0, A0);
  const vab = sub(vb, va);
  const rab = ra + rb;

  const a = dot(vab, vab);
  const b = 2 * dot(vab, AB);
  const c = dot(AB, AB) - rab * rab;

  // Already overlapping
  if (c <= 0) {
    return { hit: true, u0: 0 };
  }

  // Both stationary and not overlapping
  if (a === 0) {
    return { hit: false, u0: 0 };
  }

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return { hit: false, u0: 0 };
  }

  const sqrtD = Math.sqrt(discriminant);
  let u0 = (-b - sqrtD) / (2 * a);
  let u1 = (-b + sqrtD) / (2 * a);

  if (u0 > u1) {
    const tmp = u0;
    u0 = u1;
    u1 = tmp;
  }

  if (u0 > 1 || u1 < 0) {
    return { hit: false, u0: 0 };
  }

  if (u0 < 0) {
    if (u1 >= 0 && u1 <= 1) {
      return { hit: true, u0: 0 };
    }
    return { hit: false, u0: 0 };
  }

  return { hit: true, u0 };
}

export class CollisionDetector {
  checkCollisions(entities: Entity[]): void {
    const mgr = GameEventMgr.getInstance();

    for (let i = 0; i < entities.length; i++) {
      const a = entities[i];
      if (!a.alive || a.collisionSpheres.length === 0) continue;

      for (let j = i + 1; j < entities.length; j++) {
        const b = entities[j];
        if (!b.alive || b.collisionSpheres.length === 0) continue;

        if (!this.shouldCheck(a, b)) continue;

        const result = this.testEntityPair(a, b);
        if (result.hit) {
          this.emitEvent(mgr, a, b, result.u0);
        }
      }
    }
  }

  private shouldCheck(a: Entity, b: Entity): boolean {
    const aIsBullet = a.entityType === EntityType.Bullet;
    const bIsBullet = b.entityType === EntityType.Bullet;
    const aIsSnot = a.entityType === EntityType.Snot;
    const bIsSnot = b.entityType === EntityType.Snot;

    // Bullets don't collide with bullets (matches C++ CBullet::VerifyCollision)
    if (aIsBullet && bIsBullet) return false;

    // Snots don't collide with snots or bullets
    if (aIsSnot && (bIsSnot || bIsBullet)) return false;
    if (bIsSnot && (aIsSnot || aIsBullet)) return false;

    // Attached snots skip collision entirely
    if (aIsSnot && (a as Snot).attached) return false;
    if (bIsSnot && (b as Snot).attached) return false;

    // Projectiles don't collide with their origin
    if (aIsBullet && (a as Bullet).originEntity === b) return false;
    if (bIsBullet && (b as Bullet).originEntity === a) return false;
    if (aIsSnot && (a as Snot).originEntity === b) return false;
    if (bIsSnot && (b as Snot).originEntity === a) return false;

    const aIsAsteroid = a.entityType === EntityType.Asteroid;
    const bIsAsteroid = b.entityType === EntityType.Asteroid;

    // Asteroids don't collide with asteroids
    if (aIsAsteroid && bIsAsteroid) return false;

    // Asteroids don't collide with snots
    if (aIsAsteroid && bIsSnot) return false;
    if (bIsAsteroid && aIsSnot) return false;

    // Asteroids don't collide with explosions
    if (aIsAsteroid && b.entityType === EntityType.Explosion) return false;
    if (bIsAsteroid && a.entityType === EntityType.Explosion) return false;

    return true;
  }

  private testEntityPair(a: Entity, b: Entity): SweepResult {
    for (const sa of a.collisionSpheres) {
      const aPos0 = this.worldSpherePos(a.previousPosition, sa);
      const aPos1 = this.worldSpherePos(a.position, sa);

      for (const sb of b.collisionSpheres) {
        const bPos0 = this.worldSpherePos(b.previousPosition, sb);
        const bPos1 = this.worldSpherePos(b.position, sb);

        const result = sphereSphereSweep(sa.radius, aPos0, aPos1, sb.radius, bPos0, bPos1);
        if (result.hit) return result;
      }
    }

    return { hit: false, u0: 0 };
  }

  private worldSpherePos(entityPos: Vec3, sphere: CollisionSphere): Vec3 {
    return {
      x: entityPos.x + sphere.offset.x,
      y: entityPos.y + sphere.offset.y,
      z: entityPos.z + sphere.offset.z,
    };
  }

  private emitEvent(mgr: GameEventMgr, a: Entity, b: Entity, u0: number): void {
    const aIsSnot = a.entityType === EntityType.Snot;
    const bIsSnot = b.entityType === EntityType.Snot;
    const aIsBullet = a.entityType === EntityType.Bullet;
    const bIsBullet = b.entityType === EntityType.Bullet;
    const aIsSun = a.entityType === EntityType.Sun;
    const bIsSun = b.entityType === EntityType.Sun;

    if (aIsSnot) {
      mgr.sendEvent(new SnotHitEvent(a, b));
    } else if (bIsSnot) {
      mgr.sendEvent(new SnotHitEvent(b, a));
    } else if (aIsBullet) {
      mgr.sendEvent(new BulletHitEvent(a, b));
    } else if (bIsBullet) {
      mgr.sendEvent(new BulletHitEvent(b, a));
    } else if (aIsSun) {
      mgr.sendEvent(new SunCollisionEvent(a, b));
    } else if (bIsSun) {
      mgr.sendEvent(new SunCollisionEvent(b, a));
    } else {
      mgr.sendEvent(new CollisionEvent(a, b, u0));
    }
  }
}
