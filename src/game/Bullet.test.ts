import { describe, it, expect } from 'vitest';
import { Bullet, FLAME_BULLET_CONFIG, PLASMA_BULLET_CONFIG, SUN_BULLET_CONFIG, ICE_BULLET_CONFIG, FROST_SHIELD_CONFIG } from './Bullet';
import { Entity, EntityType } from '@/engine/Entity';
import { SoundEffect } from '@/audio/SoundEffect';

describe('Bullet', () => {
  describe('FLAME_BULLET_CONFIG', () => {
    it('has correct Gondi flame values', () => {
      expect(FLAME_BULLET_CONFIG.speedMaxScaler).toBe(0.3);
      expect(FLAME_BULLET_CONFIG.maxTtl).toBe(700);
      expect(FLAME_BULLET_CONFIG.damage).toBe(0.05);
      expect(FLAME_BULLET_CONFIG.collisionRadius).toBe(10);
    });

    it('has flame shot sound', () => {
      expect(FLAME_BULLET_CONFIG.sound).toBe(SoundEffect.FlameShot);
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

    it('has plasma shot sound', () => {
      expect(PLASMA_BULLET_CONFIG.sound).toBe(SoundEffect.PlasmaShot);
    });
  });

  describe('SUN_BULLET_CONFIG', () => {
    it('has correct sun bullet values', () => {
      expect(SUN_BULLET_CONFIG.speedMaxScaler).toBe(1.5);
      expect(SUN_BULLET_CONFIG.maxTtl).toBe(1000);
      expect(SUN_BULLET_CONFIG.damage).toBe(0.1);
      expect(SUN_BULLET_CONFIG.collisionRadius).toBe(2);
    });

    it('has sun shot sound', () => {
      expect(SUN_BULLET_CONFIG.sound).toBe(SoundEffect.SunShot);
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

  describe('ICE_BULLET_CONFIG', () => {
    it('has correct ice shard values from C++', () => {
      expect(ICE_BULLET_CONFIG.speedMaxScaler).toBe(1.5);
      expect(ICE_BULLET_CONFIG.maxTtl).toBe(700);
      expect(ICE_BULLET_CONFIG.damage).toBe(0.03);
      expect(ICE_BULLET_CONFIG.collisionRadius).toBe(1);
      expect(ICE_BULLET_CONFIG.sound).toBe(SoundEffect.IceShot);
    });
  });

  describe('FROST_SHIELD_CONFIG', () => {
    it('has correct frost shield values from C++', () => {
      expect(FROST_SHIELD_CONFIG.speedMaxScaler).toBe(0);
      expect(FROST_SHIELD_CONFIG.maxTtl).toBe(500000);
      expect(FROST_SHIELD_CONFIG.damage).toBe(0.3);
      expect(FROST_SHIELD_CONFIG.collisionRadius).toBe(11);
      expect(FROST_SHIELD_CONFIG.attached).toBe(true);
      expect(FROST_SHIELD_CONFIG.persistent).toBe(true);
      expect(FROST_SHIELD_CONFIG.hitRateLimit).toBe(500);
      expect(FROST_SHIELD_CONFIG.sound).toBe(SoundEffect.FrostShot);
    });
  });

  describe('damageCooldown', () => {
    it('initializes to 0', () => {
      const b = new Bullet(FROST_SHIELD_CONFIG);
      expect(b.damageCooldown).toBe(0);
    });

    it('decrements in update for attached bullet', () => {
      const b = new Bullet(FROST_SHIELD_CONFIG);
      b.damageCooldown = 500;
      const origin = new Entity();
      origin.alive = true;
      origin.position = { x: 0, y: 0, z: 0 };
      origin.angle = 0;
      b.originEntity = origin;
      b.update(100);
      expect(b.damageCooldown).toBe(400);
    });

    it('does not go below 0', () => {
      const b = new Bullet(FROST_SHIELD_CONFIG);
      b.damageCooldown = 50;
      const origin = new Entity();
      origin.alive = true;
      origin.position = { x: 0, y: 0, z: 0 };
      origin.angle = 0;
      b.originEntity = origin;
      b.update(100);
      expect(b.damageCooldown).toBe(0);
    });

    it('resets on Bullet.reset()', () => {
      const b = new Bullet(FROST_SHIELD_CONFIG);
      b.damageCooldown = 500;
      b.reset(FROST_SHIELD_CONFIG, null);
      expect(b.damageCooldown).toBe(0);
    });
  });
});
