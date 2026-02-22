import { describe, it, expect } from 'vitest';
import { Bullet, FLAME_BULLET_CONFIG } from './Bullet';
import { Entity } from '@/engine/Entity';

describe('Bullet', () => {
  describe('FLAME_BULLET_CONFIG', () => {
    it('has correct Gondi flame values', () => {
      expect(FLAME_BULLET_CONFIG.speedMaxScaler).toBe(0.3);
      expect(FLAME_BULLET_CONFIG.maxTtl).toBe(700);
      expect(FLAME_BULLET_CONFIG.damage).toBe(0.05);
      expect(FLAME_BULLET_CONFIG.collisionRadius).toBe(10);
    });
  });

  describe('constructor', () => {
    it('initializes with config and TTL', () => {
      const b = new Bullet(FLAME_BULLET_CONFIG);
      expect(b.config).toBe(FLAME_BULLET_CONFIG);
      expect(b.ttl).toBe(700);
      expect(b.originEntity).toBeNull();
      expect(b.alive).toBe(true);
    });

    it('stores origin entity reference', () => {
      const origin = new Entity();
      const b = new Bullet(FLAME_BULLET_CONFIG, origin);
      expect(b.originEntity).toBe(origin);
    });
  });

  describe('update', () => {
    it('moves according to accelVec (via Entity.update)', () => {
      const b = new Bullet(FLAME_BULLET_CONFIG);
      b.accelVec = { x: 1, y: 0, z: 0 };
      b.update(100);
      // position += accelVec * (dt * 0.35)
      expect(b.position.x).toBeCloseTo(1 * 100 * 0.35);
    });

    it('decrements TTL by raw dt (not time-scaled)', () => {
      const b = new Bullet(FLAME_BULLET_CONFIG);
      b.update(100);
      expect(b.ttl).toBe(600);
    });

    it('destroys when TTL reaches zero', () => {
      const b = new Bullet(FLAME_BULLET_CONFIG);
      b.update(700);
      expect(b.ttl).toBe(0);
      expect(b.alive).toBe(false);
    });

    it('destroys when TTL goes negative', () => {
      const b = new Bullet(FLAME_BULLET_CONFIG);
      b.update(800);
      expect(b.ttl).toBe(-100);
      expect(b.alive).toBe(false);
    });

    it('stays alive while TTL > 0', () => {
      const b = new Bullet(FLAME_BULLET_CONFIG);
      b.update(699);
      expect(b.ttl).toBe(1);
      expect(b.alive).toBe(true);
    });
  });
});
