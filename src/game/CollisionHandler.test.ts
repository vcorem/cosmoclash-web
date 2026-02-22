import { describe, it, expect, beforeEach } from 'vitest';
import { CollisionHandler, enforceMinimumDistance } from './CollisionHandler';
import { Entity, EntityType } from '@/engine/Entity';
import { Bullet, FLAME_BULLET_CONFIG } from './Bullet';
import { BulletHitEvent, CollisionEvent, SunCollisionEvent } from '@/engine/GameEvent';

describe('CollisionHandler', () => {
  let handler: CollisionHandler;

  beforeEach(() => {
    handler = new CollisionHandler();
  });

  describe('bullet hit', () => {
    it('applies bullet damage to target', () => {
      const target = new Entity();
      target.health = 1;
      const bullet = new Bullet(FLAME_BULLET_CONFIG, new Entity());
      const evt = new BulletHitEvent(bullet, target);

      handler.onGameEvent(evt);

      expect(target.health).toBeCloseTo(1 - 0.05);
    });

    it('destroys bullet on hit', () => {
      const target = new Entity();
      const bullet = new Bullet(FLAME_BULLET_CONFIG, new Entity());
      const evt = new BulletHitEvent(bullet, target);

      handler.onGameEvent(evt);

      expect(bullet.alive).toBe(false);
    });

    it('destroys target when health reaches 0', () => {
      const target = new Entity();
      target.health = 0.03;
      const bullet = new Bullet(FLAME_BULLET_CONFIG, new Entity());
      const evt = new BulletHitEvent(bullet, target);

      handler.onGameEvent(evt);

      expect(target.health).toBeLessThanOrEqual(0);
      expect(target.alive).toBe(false);
    });

    it('does not destroy target if health remains above 0', () => {
      const target = new Entity();
      target.health = 1;
      const bullet = new Bullet(FLAME_BULLET_CONFIG, new Entity());
      const evt = new BulletHitEvent(bullet, target);

      handler.onGameEvent(evt);

      expect(target.alive).toBe(true);
    });
  });

  describe('ship-ship collision', () => {
    it('applies mutual damage based on relative velocity', () => {
      const p1 = new Entity();
      p1.health = 1;
      p1.accelVec = { x: 0.5, y: 0, z: 0 };

      const p2 = new Entity();
      p2.health = 1;
      p2.accelVec = { x: -0.5, y: 0, z: 0 };

      const evt = new CollisionEvent(p1, p2, 0.5);
      handler.onGameEvent(evt);

      expect(p1.health).toBeLessThan(1);
      expect(p2.health).toBeLessThan(1);
    });

    it('deflects velocity away from other entity along collision normal', () => {
      const p1 = new Entity();
      p1.position = { x: 0, y: 0, z: 0 };
      p1.accelVec = { x: 0.5, y: 0, z: 0 }; // moving right toward p2

      const p2 = new Entity();
      p2.position = { x: 10, y: 0, z: 0 };
      p2.accelVec = { x: -0.5, y: 0, z: 0 }; // moving left toward p1

      const evt = new CollisionEvent(p1, p2, 0.5);
      handler.onGameEvent(evt);

      // P1's velocity should now point away from P2 (leftward)
      expect(p1.accelVec.x).toBeLessThan(0);
      // P2's velocity should now point away from P1 (rightward)
      expect(p2.accelVec.x).toBeGreaterThan(0);
    });

    it('preserves speed magnitude after deflection', () => {
      const p1 = new Entity();
      p1.position = { x: 0, y: 0, z: 0 };
      p1.accelVec = { x: 3, y: 4, z: 0 }; // speed = 5

      const p2 = new Entity();
      p2.position = { x: 10, y: 0, z: 0 };
      p2.accelVec = { x: -2, y: 0, z: 0 }; // speed = 2

      const evt = new CollisionEvent(p1, p2, 0);
      handler.onGameEvent(evt);

      const p1Speed = Math.sqrt(
        p1.accelVec.x ** 2 + p1.accelVec.y ** 2 + p1.accelVec.z ** 2,
      );
      const p2Speed = Math.sqrt(
        p2.accelVec.x ** 2 + p2.accelVec.y ** 2 + p2.accelVec.z ** 2,
      );

      expect(p1Speed).toBeCloseTo(5);
      expect(p2Speed).toBeCloseTo(2);
    });

    it('separates overlapping entities along collision normal', () => {
      const p1 = new Entity();
      p1.position = { x: -3, y: 0, z: 0 };
      p1.accelVec = { x: 0.5, y: 0, z: 0 };
      p1.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const p2 = new Entity();
      p2.position = { x: 3, y: 0, z: 0 };
      p2.accelVec = { x: -0.5, y: 0, z: 0 };
      p2.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const evt = new CollisionEvent(p1, p2, 0);
      handler.onGameEvent(evt);

      // P1 pushed left, P2 pushed right
      expect(p1.position.x).toBeLessThan(-3);
      expect(p2.position.x).toBeGreaterThan(3);

      // After separation they should be at least radiusA + radiusB apart
      const newDist = Math.abs(p2.position.x - p1.position.x);
      expect(newDist).toBeGreaterThanOrEqual(36);
    });

    it('separates same-direction travel (both going right)', () => {
      const p1 = new Entity();
      p1.previousPosition = { x: -5, y: 0, z: 0 };
      p1.position = { x: 0, y: 0, z: 0 };
      p1.accelVec = { x: 1, y: 0, z: 0 };
      p1.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const p2 = new Entity();
      p2.previousPosition = { x: 0, y: 0, z: 0 };
      p2.position = { x: 5, y: 0, z: 0 };
      p2.accelVec = { x: 1, y: 0, z: 0 };
      p2.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const evt = new CollisionEvent(p1, p2, 0);
      handler.onGameEvent(evt);

      // Must actually separate (collision normal is along X)
      const newDist = Math.abs(p2.position.x - p1.position.x);
      expect(newDist).toBeGreaterThanOrEqual(36);
    });

    it('handles exact same position (uses relative travel fallback)', () => {
      const p1 = new Entity();
      p1.previousPosition = { x: -5, y: 0, z: 0 };
      p1.position = { x: 0, y: 0, z: 0 };
      p1.accelVec = { x: 0.5, y: 0, z: 0 };
      p1.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const p2 = new Entity();
      p2.previousPosition = { x: 5, y: 0, z: 0 };
      p2.position = { x: 0, y: 0, z: 0 };
      p2.accelVec = { x: -0.5, y: 0, z: 0 };
      p2.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const evt = new CollisionEvent(p1, p2, 0);
      handler.onGameEvent(evt);

      // Pushed apart
      const newDist = Math.sqrt(
        (p2.position.x - p1.position.x) ** 2 +
        (p2.position.y - p1.position.y) ** 2,
      );
      expect(newDist).toBeGreaterThanOrEqual(36);
    });

    it('snaps previousPosition after separation', () => {
      const p1 = new Entity();
      p1.position = { x: -2, y: 0, z: 0 };
      p1.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const p2 = new Entity();
      p2.position = { x: 2, y: 0, z: 0 };
      p2.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const evt = new CollisionEvent(p1, p2, 0);
      handler.onGameEvent(evt);

      expect(p1.previousPosition).toEqual(p1.position);
      expect(p2.previousPosition).toEqual(p2.position);
    });

    it('is idempotent — repeated calls keep velocity pointing away', () => {
      const p1 = new Entity();
      p1.position = { x: 0, y: 0, z: 0 };
      p1.accelVec = { x: 5, y: 0, z: 0 };
      p1.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const p2 = new Entity();
      p2.position = { x: 3, y: 0, z: 0 };
      p2.accelVec = { x: -5, y: 0, z: 0 };
      p2.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      // First collision
      handler.onGameEvent(new CollisionEvent(p1, p2, 0));
      const p1VelAfterFirst = { ...p1.accelVec };

      // Simulate player thrusting back: add rightward velocity to p1
      p1.accelVec.x += 3;
      // Move p1 back into p2's zone
      p1.position = { x: p2.position.x - 3, y: 0, z: 0 };

      // Second collision
      handler.onGameEvent(new CollisionEvent(p1, p2, 0));

      // P1's velocity should still point away from P2 (leftward)
      expect(p1.accelVec.x).toBeLessThan(0);
      // No oscillation — direction consistent
    });
  });

  describe('enforceMinimumDistance (contact constraint)', () => {
    it('pushes overlapping entities apart', () => {
      const a = new Entity();
      a.position = { x: -5, y: 0, z: 0 };
      a.accelVec = { x: 0, y: 0, z: 0 };
      a.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const b = new Entity();
      b.position = { x: 5, y: 0, z: 0 };
      b.accelVec = { x: 0, y: 0, z: 0 };
      b.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      enforceMinimumDistance(a, b);

      const dist = Math.abs(b.position.x - a.position.x);
      expect(dist).toBeGreaterThanOrEqual(36);
    });

    it('cancels velocity component toward other entity', () => {
      const a = new Entity();
      a.position = { x: -5, y: 0, z: 0 };
      a.accelVec = { x: 1, y: 0.5, z: 0 }; // moving right (toward b) + up
      a.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const b = new Entity();
      b.position = { x: 5, y: 0, z: 0 };
      b.accelVec = { x: 0, y: 0, z: 0 };
      b.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      enforceMinimumDistance(a, b);

      // Toward-component (x) should be cancelled, perpendicular (y) preserved
      expect(a.accelVec.x).toBeCloseTo(0);
      expect(a.accelVec.y).toBeCloseTo(0.5);
    });

    it('does not add velocity to stationary entities', () => {
      const a = new Entity();
      a.position = { x: -5, y: 0, z: 0 };
      a.accelVec = { x: 0, y: 0, z: 0 };
      a.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const b = new Entity();
      b.position = { x: 5, y: 0, z: 0 };
      b.accelVec = { x: 0, y: 0, z: 0 };
      b.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      enforceMinimumDistance(a, b);

      // No velocity added — just position push
      expect(a.accelVec.x).toBe(0);
      expect(a.accelVec.y).toBe(0);
      expect(b.accelVec.x).toBe(0);
      expect(b.accelVec.y).toBe(0);
    });

    it('preserves velocity moving away from other entity', () => {
      const a = new Entity();
      a.position = { x: -5, y: 0, z: 0 };
      a.accelVec = { x: -1, y: 0, z: 0 }; // already moving away from b
      a.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const b = new Entity();
      b.position = { x: 5, y: 0, z: 0 };
      b.accelVec = { x: 1, y: 0, z: 0 }; // already moving away from a
      b.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      enforceMinimumDistance(a, b);

      // Velocities already pointing away — should be unchanged
      expect(a.accelVec.x).toBeCloseTo(-1);
      expect(b.accelVec.x).toBeCloseTo(1);
    });

    it('cancels toward-velocity in buffer zone (not overlapping)', () => {
      const a = new Entity();
      a.position = { x: -15, y: 0, z: 0 }; // dist=30, in buffer (28-36) but not overlapping
      a.accelVec = { x: 0.8, y: 0.3, z: 0 }; // moving toward b
      a.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const b = new Entity();
      b.position = { x: 15, y: 0, z: 0 };
      b.accelVec = { x: 0, y: 0, z: 0 };
      b.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      enforceMinimumDistance(a, b);

      // Toward-component (x) cancelled, perpendicular (y) preserved
      // Positions should NOT be pushed (dist > minDist)
      expect(a.position.x).toBe(-15);
      expect(a.accelVec.x).toBeCloseTo(0);
      expect(a.accelVec.y).toBeCloseTo(0.3);
    });

    it('does nothing when entities are far apart', () => {
      const a = new Entity();
      a.position = { x: -100, y: 0, z: 0 };
      a.accelVec = { x: 1, y: 0, z: 0 };
      a.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const b = new Entity();
      b.position = { x: 100, y: 0, z: 0 };
      b.accelVec = { x: -1, y: 0, z: 0 };
      b.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      enforceMinimumDistance(a, b);

      expect(a.accelVec.x).toBe(1);
      expect(b.accelVec.x).toBe(-1);
    });
  });

  describe('sun collision', () => {
    it('applies SUN_DAMAGE to the non-sun entity', () => {
      const sun = new Entity();
      sun.entityType = EntityType.Sun;
      sun.position = { x: 0, y: 0, z: 0 };
      sun.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 65 }];

      const player = new Entity();
      player.health = 1;
      player.position = { x: 60, y: 0, z: 0 };
      player.accelVec = { x: -0.5, y: 0, z: 0 };
      player.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const evt = new SunCollisionEvent(sun, player);
      handler.onGameEvent(evt);

      expect(player.health).toBeCloseTo(1 - 0.02);
    });

    it('does not damage the sun', () => {
      const sun = new Entity();
      sun.entityType = EntityType.Sun;
      sun.health = 1;
      sun.position = { x: 0, y: 0, z: 0 };
      sun.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 65 }];

      const player = new Entity();
      player.position = { x: 60, y: 0, z: 0 };
      player.accelVec = { x: -0.5, y: 0, z: 0 };
      player.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const evt = new SunCollisionEvent(sun, player);
      handler.onGameEvent(evt);

      expect(sun.health).toBe(1);
    });

    it('bounces the player away from the sun', () => {
      const sun = new Entity();
      sun.entityType = EntityType.Sun;
      sun.position = { x: 0, y: 0, z: 0 };
      sun.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 65 }];

      const player = new Entity();
      player.position = { x: 60, y: 0, z: 0 };
      player.accelVec = { x: -0.5, y: 0, z: 0 }; // moving toward sun
      player.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const evt = new SunCollisionEvent(sun, player);
      handler.onGameEvent(evt);

      // Player velocity should now point away from sun (positive X)
      expect(player.accelVec.x).toBeGreaterThan(0);
    });

    it('does not move the sun', () => {
      const sun = new Entity();
      sun.entityType = EntityType.Sun;
      sun.position = { x: 0, y: 0, z: 0 };
      sun.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 65 }];

      const player = new Entity();
      player.position = { x: 60, y: 0, z: 0 };
      player.accelVec = { x: -0.5, y: 0, z: 0 };
      player.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const evt = new SunCollisionEvent(sun, player);
      handler.onGameEvent(evt);

      expect(sun.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(sun.accelVec).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('pushes the player outside the sun collision radius', () => {
      const sun = new Entity();
      sun.entityType = EntityType.Sun;
      sun.position = { x: 0, y: 0, z: 0 };
      sun.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 65 }];

      const player = new Entity();
      player.position = { x: 50, y: 0, z: 0 }; // inside sun radius
      player.accelVec = { x: -0.5, y: 0, z: 0 };
      player.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const evt = new SunCollisionEvent(sun, player);
      handler.onGameEvent(evt);

      const dist = Math.sqrt(player.position.x ** 2 + player.position.y ** 2);
      expect(dist).toBeGreaterThanOrEqual(65 + 14);
    });

    it('destroys the player if health reaches 0', () => {
      const sun = new Entity();
      sun.entityType = EntityType.Sun;
      sun.position = { x: 0, y: 0, z: 0 };
      sun.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 65 }];

      const player = new Entity();
      player.health = 0.01;
      player.position = { x: 60, y: 0, z: 0 };
      player.accelVec = { x: -0.5, y: 0, z: 0 };
      player.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const evt = new SunCollisionEvent(sun, player);
      handler.onGameEvent(evt);

      expect(player.health).toBeLessThanOrEqual(0);
      expect(player.alive).toBe(false);
    });
  });
});
