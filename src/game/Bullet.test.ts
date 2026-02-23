import { describe, it, expect } from 'vitest';
import { Bullet, FLAME_BULLET_CONFIG, PLASMA_BULLET_CONFIG, SUN_BULLET_CONFIG } from './Bullet';
import { Entity, EntityType } from '@/engine/Entity';

describe('Bullet', () => {
  describe('FLAME_BULLET_CONFIG', () => {
    it('has correct Gondi flame values', () => {
      expect(FLAME_BULLET_CONFIG.speedMaxScaler).toBe(0.3);
      expect(FLAME_BULLET_CONFIG.maxTtl).toBe(700);
      expect(FLAME_BULLET_CONFIG.damage).toBe(0.05);
      expect(FLAME_BULLET_CONFIG.collisionRadius).toBe(10);
    });
  });

  describe('PLASMA_BULLET_CONFIG', () => {
    it('has correct plasma values', () => {
      expect(PLASMA_BULLET_CONFIG.speedMaxScaler).toBe(0.3);
      expect(PLASMA_BULLET_CONFIG.maxTtl).toBe(10000);
      expect(PLASMA_BULLET_CONFIG.damage).toBe(0.3);
      expect(PLASMA_BULLET_CONFIG.collisionRadius).toBe(0);
      expect(PLASMA_BULLET_CONFIG.tracking).toBe(true);
      expect(PLASMA_BULLET_CONFIG.expandingRadius).toEqual({ min: 0, max: 70 });
      expect(PLASMA_BULLET_CONFIG.decayingDamage).toEqual({ initial: 0.3 });
    });
  });

  describe('SUN_BULLET_CONFIG', () => {
    it('has correct sun bullet values', () => {
      expect(SUN_BULLET_CONFIG.speedMaxScaler).toBe(1.5);
      expect(SUN_BULLET_CONFIG.maxTtl).toBe(1000);
      expect(SUN_BULLET_CONFIG.damage).toBe(0.1);
      expect(SUN_BULLET_CONFIG.collisionRadius).toBe(2);
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

  describe('collision setup', () => {
    it('has entityType Bullet', () => {
      const b = new Bullet(FLAME_BULLET_CONFIG);
      expect(b.entityType).toBe(EntityType.Bullet);
    });

    it('has one collision sphere at origin with radius from config', () => {
      const b = new Bullet(FLAME_BULLET_CONFIG);
      expect(b.collisionSpheres).toHaveLength(1);
      expect(b.collisionSpheres[0].offset).toEqual({ x: 0, y: 0, z: 0 });
      expect(b.collisionSpheres[0].radius).toBe(10);
    });
  });

  describe('dynamic update behaviors', () => {
    describe('expanding collision radius', () => {
      it('expands collision sphere from min to max over TTL', () => {
        const b = new Bullet(PLASMA_BULLET_CONFIG);
        expect(b.collisionSpheres[0].radius).toBe(0);
        b.update(5000);
        expect(b.collisionSpheres[0].radius).toBeCloseTo(35);
      });

      it('reaches max radius at end of TTL', () => {
        const b = new Bullet(PLASMA_BULLET_CONFIG);
        b.update(9999);
        expect(b.collisionSpheres[0].radius).toBeCloseTo(70, 0);
      });
    });

    describe('decaying damage', () => {
      it('starts at initial damage', () => {
        const b = new Bullet(PLASMA_BULLET_CONFIG);
        expect(b.getCurrentDamage()).toBeCloseTo(0.3);
      });

      it('decays linearly to zero over TTL', () => {
        const b = new Bullet(PLASMA_BULLET_CONFIG);
        b.update(5000);
        expect(b.getCurrentDamage()).toBeCloseTo(0.15);
      });

      it('returns zero when TTL expired', () => {
        const b = new Bullet(PLASMA_BULLET_CONFIG);
        b.update(10000);
        expect(b.getCurrentDamage()).toBe(0);
      });
    });

    describe('tracking', () => {
      it('steers toward target entity each update', () => {
        const b = new Bullet(PLASMA_BULLET_CONFIG);
        const target = new Entity();
        target.position = { x: 100, y: 0, z: 0 };
        b.trackingTarget = target;
        b.position = { x: 0, y: 0, z: 0 };
        b.accelVec = { x: 0, y: 0.3, z: 0 };
        b.update(100);
        expect(b.accelVec.x).toBeGreaterThan(0);
      });

      it('does not track when target is null', () => {
        const b = new Bullet(PLASMA_BULLET_CONFIG);
        b.accelVec = { x: 0, y: 0.3, z: 0 };
        b.update(100);
        expect(b.accelVec.x).toBeCloseTo(0);
      });
    });
  });
});
