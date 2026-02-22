import { describe, it, expect, beforeEach } from 'vitest';
import { CollisionHandler } from './CollisionHandler';
import { Entity, EntityType } from '@/engine/Entity';
import { Bullet, FLAME_BULLET_CONFIG } from './Bullet';
import { BulletHitEvent, CollisionEvent } from '@/engine/GameEvent';

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

    it('reflects velocity vectors apart (separation force)', () => {
      const p1 = new Entity();
      p1.position = { x: 0, y: 0, z: 0 };
      p1.accelVec = { x: 0.5, y: 0, z: 0 };

      const p2 = new Entity();
      p2.position = { x: 10, y: 0, z: 0 };
      p2.accelVec = { x: -0.5, y: 0, z: 0 };

      const evt = new CollisionEvent(p1, p2, 0.5);
      handler.onGameEvent(evt);

      expect(p1.accelVec.x).toBeLessThan(0);
      expect(p2.accelVec.x).toBeGreaterThan(0);
    });
  });
});
