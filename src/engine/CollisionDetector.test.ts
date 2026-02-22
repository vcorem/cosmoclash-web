import { describe, it, expect, beforeEach } from 'vitest';
import { sphereSphereSweep, CollisionDetector } from './CollisionDetector';
import { Entity, EntityType } from './Entity';
import { Bullet, FLAME_BULLET_CONFIG } from '@/game/Bullet';
import { GameEventMgr } from './GameEventMgr';
import { GameEventType, GameEvent, CollisionEvent, BulletHitEvent } from './GameEvent';

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
});
