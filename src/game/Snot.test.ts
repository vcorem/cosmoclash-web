import { describe, it, expect } from 'vitest';
import { Snot, SNOT_CONFIG } from './Snot';
import { Player, GONDI_STATS } from './Player';
import { EntityType } from '@/engine/Entity';
import { ARENA } from './Arena';

describe('Snot', () => {
  describe('SNOT_CONFIG', () => {
    it('has correct values from design', () => {
      expect(SNOT_CONFIG.speedMaxScaler).toBe(0.2);
      expect(SNOT_CONFIG.maxTtl).toBe(10000);
      expect(SNOT_CONFIG.damage).toBe(0);
      expect(SNOT_CONFIG.collisionRadius).toBe(2);
    });
  });

  describe('constructor', () => {
    it('sets entityType to Snot', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      expect(s.entityType).toBe(EntityType.Snot);
    });

    it('stores target reference', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      expect(s.target).toBe(target);
    });

    it('starts unattached', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      expect(s.attached).toBe(false);
      expect(s.victim).toBeNull();
    });

    it('has collision sphere with radius 2', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      expect(s.collisionSpheres[0].radius).toBe(2);
    });
  });

  describe('tracking', () => {
    it('adjusts angle toward target each update', () => {
      const target = new Player(GONDI_STATS);
      target.position = { x: 100, y: 0, z: 0 };
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.position = { x: 0, y: 0, z: 0 };
      s.angle = 0;

      s.update(16);

      const speed = Math.sqrt(s.accelVec.x ** 2 + s.accelVec.y ** 2);
      expect(speed).toBeGreaterThan(0);
    });

    it('does not track when attached', () => {
      const target = new Player(GONDI_STATS);
      target.position = { x: 100, y: 0, z: 0 };
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.position = { x: 0, y: 0, z: 0 };
      s.attached = true;
      s.victim = target;

      const angleBefore = s.angle;
      s.update(16);

      expect(s.angle).toBe(angleBefore);
    });
  });

  describe('attachment', () => {
    it('attaches to victim and resets TTL', () => {
      const target = new Player(GONDI_STATS);
      target.position = { x: 50, y: 50, z: 0 };
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.ttl = 5000;

      s.attachTo(target);

      expect(s.attached).toBe(true);
      expect(s.victim).toBe(target);
      expect(s.ttl).toBe(SNOT_CONFIG.maxTtl);
    });

    it('follows victim position with offset when attached', () => {
      const target = new Player(GONDI_STATS);
      target.position = { x: 100, y: 200, z: 0 };
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.attachTo(target);

      s.update(16);

      const dx = s.position.x - target.position.x;
      const dy = s.position.y - target.position.y;
      const dz = s.position.z - target.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      expect(dist).toBeCloseTo(42.4, 0);
    });

    it('orbit offset rotates over time', () => {
      const target = new Player(GONDI_STATS);
      target.position = { x: 0, y: 0, z: 0 };
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.attachTo(target);

      s.update(16);
      const pos1 = { ...s.position };

      s.update(500);
      const pos2 = { ...s.position };

      const moved = pos1.x !== pos2.x || pos1.y !== pos2.y || pos1.z !== pos2.z;
      expect(moved).toBe(true);
    });
  });

  describe('TTL and expiry', () => {
    it('decrements TTL each frame', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.update(100);
      expect(s.ttl).toBe(9900);
    });

    it('destroys when TTL expires while flying', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.update(10001);
      expect(s.alive).toBe(false);
    });

    it('destroys when TTL expires while attached', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.attachTo(target);
      s.update(10001);
      expect(s.alive).toBe(false);
    });
  });

  describe('animation', () => {
    it('starts at frame 0', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      expect(s.currentFrame).toBe(0);
    });

    it('advances frame based on animSpeed * dt', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.update(100);
      expect(s.currentFrame).toBeCloseTo(3);
    });

    it('loops at frame 55 when TTL > 2000', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.ttl = 5000;
      s.currentFrame = 54;
      s.update(100);
      expect(s.currentFrame).toBeCloseTo(2);
    });

    it('freezes at frame 116 when TTL <= 2000', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.ttl = 1500;
      s.currentFrame = 115;
      s.update(100);
      expect(s.currentFrame).toBe(116);
    });
  });

  describe('expiry removes debuff', () => {
    it('decrements victim snotCount when attached snot expires', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.attachTo(target);
      target.addSnot();

      expect(target.snotCount).toBe(1);

      s.update(10001);

      expect(s.alive).toBe(false);
      expect(target.snotCount).toBe(0);
    });
  });
});
