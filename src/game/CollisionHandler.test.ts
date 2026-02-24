import { describe, it, expect, beforeEach } from 'vitest';
import { CollisionHandler, enforceMinimumDistance } from './CollisionHandler';
import { Entity, EntityType } from '@/engine/Entity';
import { Bullet, FLAME_BULLET_CONFIG, PLASMA_BULLET_CONFIG, FROST_SHIELD_CONFIG } from './Bullet';
import { Asteroid } from './Asteroid';
import { Snot } from './Snot';
import { Player, GONDI_STATS } from './Player';
import { GameEventMgr } from '@/engine/GameEventMgr';
import { GameEventType, GameEvent, BulletHitEvent, CollisionEvent, SunCollisionEvent, SnotHitEvent, ExplosionEvent } from '@/engine/GameEvent';

describe('CollisionHandler', () => {
  let handler: CollisionHandler;

  beforeEach(() => {
    GameEventMgr.reset();
    handler = new CollisionHandler();
    GameEventMgr.getInstance().addListener(handler, GameEventType.BulletHit);
    GameEventMgr.getInstance().addListener(handler, GameEventType.Collision);
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

    it('destroys bullet on sun hit but does not damage sun', () => {
      const sun = new Entity();
      sun.entityType = EntityType.Sun;
      sun.health = 1;
      sun.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 65 }];

      const bullet = new Bullet(FLAME_BULLET_CONFIG, new Entity());
      const evt = new BulletHitEvent(bullet, sun);

      handler.onGameEvent(evt);

      expect(bullet.alive).toBe(false);
      expect(sun.health).toBe(1); // sun takes no damage
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

  describe('snot hit', () => {
    it('attaches snot to target player', () => {
      const origin = new Player(GONDI_STATS);
      const target = new Player(GONDI_STATS);
      const snot = new Snot(origin, target);

      const evt = new SnotHitEvent(snot, target);
      handler.onGameEvent(evt);

      expect(snot.attached).toBe(true);
      expect(snot.victim).toBe(target);
    });

    it('increments target snotCount', () => {
      const origin = new Player(GONDI_STATS);
      const target = new Player(GONDI_STATS);
      const snot = new Snot(origin, target);

      const evt = new SnotHitEvent(snot, target);
      handler.onGameEvent(evt);

      expect(target.snotCount).toBe(1);
    });

    it('destroys snot when target is not a player', () => {
      const origin = new Player(GONDI_STATS);
      const target = new Player(GONDI_STATS);
      const snot = new Snot(origin, target);

      const sun = new Entity();
      sun.entityType = EntityType.Sun;

      const evt = new SnotHitEvent(snot, sun);
      handler.onGameEvent(evt);

      expect(snot.alive).toBe(false);
      expect(snot.attached).toBe(false);
    });

    it('keeps snot alive when attaching to player', () => {
      const origin = new Player(GONDI_STATS);
      const target = new Player(GONDI_STATS);
      const snot = new Snot(origin, target);

      const evt = new SnotHitEvent(snot, target);
      handler.onGameEvent(evt);

      expect(snot.alive).toBe(true);
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

  describe('asteroid-bullet', () => {
    it('destroys asteroid on any bullet hit (one-shot kill)', () => {
      const asteroid = new Asteroid(0);
      asteroid.health = 1;

      const shooter = new Entity();
      const bullet = new Bullet(FLAME_BULLET_CONFIG, shooter);

      const event = new BulletHitEvent(bullet, asteroid);
      handler.onGameEvent(event);

      expect(asteroid.alive).toBe(false);
      expect(bullet.alive).toBe(false);
    });

    it('emits ExplosionEvent when asteroid is destroyed by bullet', () => {
      const asteroid = new Asteroid(0);
      const shooter = new Entity();
      const bullet = new Bullet(FLAME_BULLET_CONFIG, shooter);

      const explosionEvents: GameEvent[] = [];
      GameEventMgr.getInstance().addListener(
        { onGameEvent: (e) => explosionEvents.push(e) },
        GameEventType.Explosion,
      );

      const event = new BulletHitEvent(bullet, asteroid);
      handler.onGameEvent(event);

      expect(explosionEvents).toHaveLength(1);
      expect(explosionEvents[0]).toBeInstanceOf(ExplosionEvent);
      expect((explosionEvents[0] as ExplosionEvent).entity).toBe(asteroid);
    });
  });

  describe('asteroid-player collision', () => {
    it('does NOT deal damage to either entity', () => {
      const asteroid = new Asteroid(0);
      asteroid.position = { x: 0, y: 0, z: 0 };
      asteroid.previousPosition = { x: 0, y: 0, z: 0 };
      asteroid.health = 1;

      const player = new Player(GONDI_STATS);
      player.position = { x: 5, y: 0, z: 0 };
      player.previousPosition = { x: 5, y: 0, z: 0 };
      player.health = 1;
      player.accelVec = { x: -1, y: 0, z: 0 };

      const event = new CollisionEvent(asteroid, player, 0.5);
      handler.onGameEvent(event);

      expect(asteroid.health).toBe(1);
      expect(player.health).toBe(1);
      expect(asteroid.alive).toBe(true);
      expect(player.alive).toBe(true);
    });

    it('still applies bounce physics (velocity deflection)', () => {
      const asteroid = new Asteroid(0);
      asteroid.position = { x: 0, y: 0, z: 0 };
      asteroid.previousPosition = { x: -5, y: 0, z: 0 };
      asteroid.accelVec = { x: 0.1, y: 0, z: 0 };

      const player = new Player(GONDI_STATS);
      player.position = { x: 5, y: 0, z: 0 };
      player.previousPosition = { x: 10, y: 0, z: 0 };
      player.accelVec = { x: -0.5, y: 0, z: 0 };

      const event = new CollisionEvent(asteroid, player, 0.5);
      handler.onGameEvent(event);

      // After bounce, asteroid should move away from player (negative x)
      expect(asteroid.accelVec.x).toBeLessThan(0);
      // Player should move away from asteroid (positive x)
      expect(player.accelVec.x).toBeGreaterThan(0);
    });
  });

  describe('plasma bullet damage decay', () => {
    it('uses decaying damage from plasma bullet', () => {
      const bullet = new Bullet(PLASMA_BULLET_CONFIG);
      bullet.update(5000); // Half TTL elapsed
      const target = new Player(GONDI_STATS);
      target.health -= bullet.getCurrentDamage();
      expect(target.health).toBeCloseTo(1 - 0.15);
    });

    it('applies full damage from fresh plasma bullet via handler', () => {
      const shooter = new Entity();
      const bullet = new Bullet(PLASMA_BULLET_CONFIG, shooter);
      const target = new Player(GONDI_STATS);
      target.health = 1;

      const event = new BulletHitEvent(bullet, target);
      handler.onGameEvent(event);

      expect(target.health).toBeCloseTo(1 - 0.3);
    });

    it('applies reduced damage from aged plasma bullet via handler', () => {
      const shooter = new Entity();
      const bullet = new Bullet(PLASMA_BULLET_CONFIG, shooter);
      bullet.update(5000); // Half TTL elapsed
      const target = new Player(GONDI_STATS);
      target.health = 1;

      const event = new BulletHitEvent(bullet, target);
      handler.onGameEvent(event);

      expect(target.health).toBeCloseTo(1 - 0.15);
    });
  });

  describe('persistent bullet (frost shield)', () => {
    it('applies damage but does not destroy the bullet', () => {
      const bullet = new Bullet(FROST_SHIELD_CONFIG);
      bullet.originEntity = new Entity();
      const target = new Player(GONDI_STATS);
      target.health = 1.0;

      handler.onGameEvent(new BulletHitEvent(bullet, target));

      expect(target.health).toBeCloseTo(0.5); // 1.0 - 0.5
      expect(bullet.alive).toBe(true); // NOT destroyed
    });

    it('sets damageCooldown from hitRateLimit after hit', () => {
      const bullet = new Bullet(FROST_SHIELD_CONFIG);
      bullet.originEntity = new Entity();
      const target = new Player(GONDI_STATS);

      handler.onGameEvent(new BulletHitEvent(bullet, target));

      expect(bullet.damageCooldown).toBe(500);
    });

    it('skips damage when damageCooldown > 0', () => {
      const bullet = new Bullet(FROST_SHIELD_CONFIG);
      bullet.originEntity = new Entity();
      bullet.damageCooldown = 100;
      const target = new Player(GONDI_STATS);
      target.health = 1.0;

      handler.onGameEvent(new BulletHitEvent(bullet, target));

      expect(target.health).toBe(1.0); // no damage applied
      expect(bullet.alive).toBe(true);
    });

    it('still destroys non-persistent bullets normally', () => {
      const bullet = new Bullet(FLAME_BULLET_CONFIG);
      bullet.originEntity = new Entity();
      const target = new Player(GONDI_STATS);

      handler.onGameEvent(new BulletHitEvent(bullet, target));

      expect(bullet.alive).toBe(false); // destroyed as usual
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
