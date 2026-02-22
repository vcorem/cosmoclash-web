import { describe, it, expect, beforeEach } from 'vitest';
import { sphereSphereSweep, CollisionDetector } from './CollisionDetector';
import { Entity, EntityType } from './Entity';
import { Bullet, FLAME_BULLET_CONFIG } from '@/game/Bullet';
import { Snot } from '@/game/Snot';
import { Asteroid } from '@/game/Asteroid';
import { Player, GONDI_STATS } from '@/game/Player';
import { GameEventMgr } from './GameEventMgr';
import { GameEventType, GameEvent, CollisionEvent, BulletHitEvent, SunCollisionEvent, SnotHitEvent } from './GameEvent';

describe('sphereSphereSweep', () => {
  it('detects head-on collision between two moving spheres', () => {
    const result = sphereSphereSweep(
      5, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 },
      5, { x: 20, y: 0, z: 0 }, { x: 10, y: 0, z: 0 },
    );
    expect(result.hit).toBe(true);
    expect(result.u0).toBeGreaterThan(0);
    expect(result.u0).toBeLessThanOrEqual(1);
  });

  it('detects stationary overlapping spheres', () => {
    const result = sphereSphereSweep(
      10, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 },
      10, { x: 5, y: 0, z: 0 }, { x: 5, y: 0, z: 0 },
    );
    expect(result.hit).toBe(true);
    expect(result.u0).toBe(0);
  });

  it('returns no hit for spheres moving apart', () => {
    const result = sphereSphereSweep(
      5, { x: 0, y: 0, z: 0 }, { x: -10, y: 0, z: 0 },
      5, { x: 20, y: 0, z: 0 }, { x: 30, y: 0, z: 0 },
    );
    expect(result.hit).toBe(false);
  });

  it('returns no hit for parallel paths that never touch', () => {
    const result = sphereSphereSweep(
      2, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 },
      2, { x: 0, y: 100, z: 0 }, { x: 10, y: 100, z: 0 },
    );
    expect(result.hit).toBe(false);
  });

  it('returns no hit when collision would occur outside frame (u > 1)', () => {
    const result = sphereSphereSweep(
      1, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
      1, { x: 100, y: 0, z: 0 }, { x: 99, y: 0, z: 0 },
    );
    expect(result.hit).toBe(false);
  });

  it('detects collision at exact frame boundary (u = 1)', () => {
    const result = sphereSphereSweep(
      5, { x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 },
      5, { x: 20, y: 0, z: 0 }, { x: 15, y: 0, z: 0 },
    );
    expect(result.hit).toBe(true);
    expect(result.u0).toBeCloseTo(1, 5);
  });

  it('handles one stationary and one moving sphere', () => {
    const result = sphereSphereSweep(
      5, { x: 0, y: 0, z: 0 }, { x: 15, y: 0, z: 0 },
      5, { x: 20, y: 0, z: 0 }, { x: 20, y: 0, z: 0 },
    );
    expect(result.hit).toBe(true);
    expect(result.u0).toBeCloseTo(0.667, 2);
  });

  it('handles both spheres stationary and not overlapping', () => {
    const result = sphereSphereSweep(
      5, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 },
      5, { x: 100, y: 0, z: 0 }, { x: 100, y: 0, z: 0 },
    );
    expect(result.hit).toBe(false);
  });
});

describe('CollisionDetector', () => {
  let detector: CollisionDetector;

  beforeEach(() => {
    GameEventMgr.reset();
    detector = new CollisionDetector();
  });

  it('fires BulletHitEvent when bullet hits non-origin entity', () => {
    const target = new Entity();
    target.entityType = EntityType.Player;
    target.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];
    target.position = { x: 50, y: 0, z: 0 };
    target.previousPosition = { x: 50, y: 0, z: 0 };

    const shooter = new Entity();
    shooter.entityType = EntityType.Player;

    const bullet = new Bullet(FLAME_BULLET_CONFIG, shooter);
    bullet.position = { x: 50, y: 0, z: 0 };
    bullet.previousPosition = { x: 40, y: 0, z: 0 };

    const events: GameEvent[] = [];
    GameEventMgr.getInstance().addListener(
      { onGameEvent: (e) => events.push(e) },
      GameEventType.BulletHit,
    );

    detector.checkCollisions([target, bullet]);

    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(BulletHitEvent);
    const hit = events[0] as BulletHitEvent;
    expect(hit.bullet).toBe(bullet);
    expect(hit.target).toBe(target);
  });

  it('does NOT fire event when bullet hits its origin entity', () => {
    const shooter = new Entity();
    shooter.entityType = EntityType.Player;
    shooter.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];
    shooter.position = { x: 50, y: 0, z: 0 };
    shooter.previousPosition = { x: 50, y: 0, z: 0 };

    const bullet = new Bullet(FLAME_BULLET_CONFIG, shooter);
    bullet.position = { x: 50, y: 0, z: 0 };
    bullet.previousPosition = { x: 40, y: 0, z: 0 };

    const events: GameEvent[] = [];
    GameEventMgr.getInstance().addListener(
      { onGameEvent: (e) => events.push(e) },
      GameEventType.BulletHit,
    );

    detector.checkCollisions([shooter, bullet]);

    expect(events).toHaveLength(0);
  });

  it('does NOT fire event for bullet-bullet collision', () => {
    const shooter = new Entity();
    const b1 = new Bullet(FLAME_BULLET_CONFIG, shooter);
    b1.position = { x: 50, y: 0, z: 0 };
    b1.previousPosition = { x: 50, y: 0, z: 0 };

    const b2 = new Bullet(FLAME_BULLET_CONFIG, shooter);
    b2.position = { x: 50, y: 0, z: 0 };
    b2.previousPosition = { x: 50, y: 0, z: 0 };

    const events: GameEvent[] = [];
    GameEventMgr.getInstance().addListener(
      { onGameEvent: (e) => events.push(e) },
      GameEventType.BulletHit,
    );
    GameEventMgr.getInstance().addListener(
      { onGameEvent: (e) => events.push(e) },
      GameEventType.Collision,
    );

    detector.checkCollisions([b1, b2]);

    expect(events).toHaveLength(0);
  });

  it('fires CollisionEvent for player-player collision', () => {
    const p1 = new Entity();
    p1.entityType = EntityType.Player;
    p1.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];
    p1.position = { x: 0, y: 0, z: 0 };
    p1.previousPosition = { x: 0, y: 0, z: 0 };

    const p2 = new Entity();
    p2.entityType = EntityType.Player;
    p2.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];
    p2.position = { x: 10, y: 0, z: 0 };
    p2.previousPosition = { x: 10, y: 0, z: 0 };

    const events: GameEvent[] = [];
    GameEventMgr.getInstance().addListener(
      { onGameEvent: (e) => events.push(e) },
      GameEventType.Collision,
    );

    detector.checkCollisions([p1, p2]);

    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(CollisionEvent);
  });

  it('skips dead entities', () => {
    const target = new Entity();
    target.entityType = EntityType.Player;
    target.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];
    target.position = { x: 50, y: 0, z: 0 };
    target.previousPosition = { x: 50, y: 0, z: 0 };
    target.alive = false;

    const bullet = new Bullet(FLAME_BULLET_CONFIG, new Entity());
    bullet.position = { x: 50, y: 0, z: 0 };
    bullet.previousPosition = { x: 40, y: 0, z: 0 };

    const events: GameEvent[] = [];
    GameEventMgr.getInstance().addListener(
      { onGameEvent: (e) => events.push(e) },
      GameEventType.BulletHit,
    );

    detector.checkCollisions([target, bullet]);

    expect(events).toHaveLength(0);
  });

  it('does not check same pair twice', () => {
    const p1 = new Entity();
    p1.entityType = EntityType.Player;
    p1.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];
    p1.position = { x: 0, y: 0, z: 0 };
    p1.previousPosition = { x: 0, y: 0, z: 0 };

    const p2 = new Entity();
    p2.entityType = EntityType.Player;
    p2.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];
    p2.position = { x: 10, y: 0, z: 0 };
    p2.previousPosition = { x: 10, y: 0, z: 0 };

    const events: GameEvent[] = [];
    GameEventMgr.getInstance().addListener(
      { onGameEvent: (e) => events.push(e) },
      GameEventType.Collision,
    );

    detector.checkCollisions([p1, p2]);

    expect(events).toHaveLength(1);
  });

  it('fires SunCollisionEvent when player collides with sun', () => {
    const sun = new Entity();
    sun.entityType = EntityType.Sun;
    sun.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 65 }];
    sun.position = { x: 0, y: 0, z: 0 };
    sun.previousPosition = { x: 0, y: 0, z: 0 };

    const player = new Entity();
    player.entityType = EntityType.Player;
    player.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];
    player.position = { x: 50, y: 0, z: 0 };
    player.previousPosition = { x: 50, y: 0, z: 0 };

    const events: GameEvent[] = [];
    GameEventMgr.getInstance().addListener(
      { onGameEvent: (e) => events.push(e) },
      GameEventType.SunCollision,
    );

    detector.checkCollisions([sun, player]);

    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(SunCollisionEvent);
    const evt = events[0] as SunCollisionEvent;
    expect(evt.sun).toBe(sun);
    expect(evt.other).toBe(player);
  });

  it('fires BulletHitEvent (not SunCollision) when bullet hits sun', () => {
    const sun = new Entity();
    sun.entityType = EntityType.Sun;
    sun.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 65 }];
    sun.position = { x: 0, y: 0, z: 0 };
    sun.previousPosition = { x: 0, y: 0, z: 0 };

    const shooter = new Entity();
    shooter.entityType = EntityType.Player;

    const bullet = new Bullet(FLAME_BULLET_CONFIG, shooter);
    bullet.position = { x: 50, y: 0, z: 0 };
    bullet.previousPosition = { x: 60, y: 0, z: 0 };

    const sunEvents: GameEvent[] = [];
    const bulletEvents: GameEvent[] = [];
    GameEventMgr.getInstance().addListener(
      { onGameEvent: (e) => sunEvents.push(e) },
      GameEventType.SunCollision,
    );
    GameEventMgr.getInstance().addListener(
      { onGameEvent: (e) => bulletEvents.push(e) },
      GameEventType.BulletHit,
    );

    detector.checkCollisions([sun, bullet]);

    expect(sunEvents).toHaveLength(0);
    expect(bulletEvents).toHaveLength(1);
    const hit = bulletEvents[0] as BulletHitEvent;
    expect(hit.bullet).toBe(bullet);
    expect(hit.target).toBe(sun);
  });

  describe('snot collision', () => {
    it('emits SnotHitEvent when snot hits a player', () => {
      const events: GameEvent[] = [];
      const listener = { onGameEvent: (e: GameEvent) => events.push(e) };
      GameEventMgr.getInstance().addListener(listener, GameEventType.SnotHit);

      const origin = new Player(GONDI_STATS);
      origin.position = { x: -100, y: 0, z: 0 };
      origin.previousPosition = { x: -100, y: 0, z: 0 };

      const target = new Player(GONDI_STATS);
      target.position = { x: 5, y: 0, z: 0 };
      target.previousPosition = { x: 5, y: 0, z: 0 };

      const snot = new Snot(origin, target);
      snot.position = { x: 4, y: 0, z: 0 };
      snot.previousPosition = { x: 3, y: 0, z: 0 };

      const detector = new CollisionDetector();
      detector.checkCollisions([snot, target]);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe(GameEventType.SnotHit);

      GameEventMgr.getInstance().removeListener(listener, GameEventType.SnotHit);
    });

    it('does not collide snot with its origin player', () => {
      const events: GameEvent[] = [];
      const listener = { onGameEvent: (e: GameEvent) => events.push(e) };
      GameEventMgr.getInstance().addListener(listener, GameEventType.SnotHit);

      const origin = new Player(GONDI_STATS);
      origin.position = { x: 0, y: 0, z: 0 };
      origin.previousPosition = { x: 0, y: 0, z: 0 };

      const target = new Player(GONDI_STATS);
      target.position = { x: 200, y: 0, z: 0 };

      const snot = new Snot(origin, target);
      snot.position = { x: 0, y: 0, z: 0 };
      snot.previousPosition = { x: 0, y: 0, z: 0 };

      const detector = new CollisionDetector();
      detector.checkCollisions([snot, origin]);

      expect(events.length).toBe(0);

      GameEventMgr.getInstance().removeListener(listener, GameEventType.SnotHit);
    });

    it('skips attached snots in collision detection', () => {
      const events: GameEvent[] = [];
      const listener = { onGameEvent: (e: GameEvent) => events.push(e) };
      GameEventMgr.getInstance().addListener(listener, GameEventType.SnotHit);

      const origin = new Player(GONDI_STATS);
      const target = new Player(GONDI_STATS);
      target.position = { x: 5, y: 0, z: 0 };
      target.previousPosition = { x: 5, y: 0, z: 0 };

      const snot = new Snot(origin, target);
      snot.attached = true;
      snot.position = { x: 5, y: 0, z: 0 };
      snot.previousPosition = { x: 5, y: 0, z: 0 };

      const detector = new CollisionDetector();
      detector.checkCollisions([snot, target]);

      expect(events.length).toBe(0);

      GameEventMgr.getInstance().removeListener(listener, GameEventType.SnotHit);
    });

    it('does not collide snot with another snot', () => {
      const events: GameEvent[] = [];
      const listener = { onGameEvent: (e: GameEvent) => events.push(e) };
      GameEventMgr.getInstance().addListener(listener, GameEventType.SnotHit);

      const origin = new Player(GONDI_STATS);
      const target = new Player(GONDI_STATS);

      const s1 = new Snot(origin, target);
      s1.position = { x: 0, y: 0, z: 0 };
      s1.previousPosition = { x: 0, y: 0, z: 0 };

      const s2 = new Snot(origin, target);
      s2.position = { x: 0, y: 0, z: 0 };
      s2.previousPosition = { x: 0, y: 0, z: 0 };

      const detector = new CollisionDetector();
      detector.checkCollisions([s1, s2]);

      expect(events.length).toBe(0);

      GameEventMgr.getInstance().removeListener(listener, GameEventType.SnotHit);
    });
  });

  describe('asteroid collision rules', () => {
    it('skips asteroid-asteroid collision', () => {
      const a1 = new Asteroid(0);
      a1.position = { x: 0, y: 0, z: 0 };
      a1.previousPosition = { x: 0, y: 0, z: 0 };

      const a2 = new Asteroid(1);
      a2.position = { x: 5, y: 0, z: 0 };
      a2.previousPosition = { x: 5, y: 0, z: 0 };

      const events: GameEvent[] = [];
      GameEventMgr.getInstance().addListener(
        { onGameEvent: (e) => events.push(e) },
        GameEventType.Collision,
      );

      detector.checkCollisions([a1, a2]);
      expect(events).toHaveLength(0);
    });

    it('skips asteroid-snot collision', () => {
      const asteroid = new Asteroid(0);
      asteroid.position = { x: 0, y: 0, z: 0 };
      asteroid.previousPosition = { x: 0, y: 0, z: 0 };

      const origin = new Player(GONDI_STATS);
      const target = new Player(GONDI_STATS);
      const snot = new Snot(origin, target);
      snot.position = { x: 0, y: 0, z: 0 };
      snot.previousPosition = { x: 0, y: 0, z: 0 };

      const events: GameEvent[] = [];
      GameEventMgr.getInstance().addListener(
        { onGameEvent: (e) => events.push(e) },
        GameEventType.SnotHit,
      );
      GameEventMgr.getInstance().addListener(
        { onGameEvent: (e) => events.push(e) },
        GameEventType.Collision,
      );

      detector.checkCollisions([asteroid, snot]);
      expect(events).toHaveLength(0);
    });

    it('allows asteroid-bullet collision (emits BulletHitEvent)', () => {
      const asteroid = new Asteroid(1);
      asteroid.position = { x: 50, y: 0, z: 0 };
      asteroid.previousPosition = { x: 50, y: 0, z: 0 };

      const shooter = new Entity();
      shooter.entityType = EntityType.Player;

      const bullet = new Bullet(FLAME_BULLET_CONFIG, shooter);
      bullet.position = { x: 50, y: 0, z: 0 };
      bullet.previousPosition = { x: 40, y: 0, z: 0 };

      const events: GameEvent[] = [];
      GameEventMgr.getInstance().addListener(
        { onGameEvent: (e) => events.push(e) },
        GameEventType.BulletHit,
      );

      detector.checkCollisions([asteroid, bullet]);
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(BulletHitEvent);
      const hit = events[0] as BulletHitEvent;
      expect(hit.bullet).toBe(bullet);
      expect(hit.target).toBe(asteroid);
    });

    it('allows asteroid-player collision (emits CollisionEvent)', () => {
      const asteroid = new Asteroid(0);
      asteroid.position = { x: 0, y: 0, z: 0 };
      asteroid.previousPosition = { x: 0, y: 0, z: 0 };

      const player = new Player(GONDI_STATS);
      player.position = { x: 5, y: 0, z: 0 };
      player.previousPosition = { x: 5, y: 0, z: 0 };

      const events: GameEvent[] = [];
      GameEventMgr.getInstance().addListener(
        { onGameEvent: (e) => events.push(e) },
        GameEventType.Collision,
      );

      detector.checkCollisions([asteroid, player]);
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(CollisionEvent);
    });
  });
});
