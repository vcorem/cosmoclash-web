import { describe, it, expect, beforeEach } from 'vitest';
import { Asteroid } from './Asteroid';
import { EntityType } from '@/engine/Entity';
import { ARENA } from './Arena';

describe('Asteroid', () => {
  describe('constructor', () => {
    it('sets entityType to Asteroid', () => {
      const a = new Asteroid(0);
      expect(a.entityType).toBe(EntityType.Asteroid);
    });

    it('sets collision sphere radius based on type 0', () => {
      const a = new Asteroid(0);
      expect(a.collisionSpheres).toHaveLength(1);
      expect(a.collisionSpheres[0].radius).toBe(ARENA.ASTEROID_COLLISION_RADII[0]);
    });

    it('sets collision sphere radius based on type 1', () => {
      const a = new Asteroid(1);
      expect(a.collisionSpheres[0].radius).toBe(ARENA.ASTEROID_COLLISION_RADII[1]);
    });

    it('sets collision sphere radius based on type 2', () => {
      const a = new Asteroid(2);
      expect(a.collisionSpheres[0].radius).toBe(ARENA.ASTEROID_COLLISION_RADII[2]);
    });

    it('stores asteroidType', () => {
      const a = new Asteroid(1);
      expect(a.asteroidType).toBe(1);
    });

    it('enables autoWrap', () => {
      const a = new Asteroid(0);
      expect(a.autoWrap).toBe(true);
    });

    it('initializes rotation angles between 0 and 360', () => {
      const a = new Asteroid(0);
      expect(a.curXAngle).toBeGreaterThanOrEqual(0);
      expect(a.curXAngle).toBeLessThan(360);
      expect(a.curYAngle).toBeGreaterThanOrEqual(0);
      expect(a.curYAngle).toBeLessThan(360);
    });

    it('sets initial accelVec based on random heading', () => {
      const a = new Asteroid(0);
      const speed = Math.sqrt(
        a.accelVec.x * a.accelVec.x +
        a.accelVec.y * a.accelVec.y +
        a.accelVec.z * a.accelVec.z,
      );
      expect(speed).toBeCloseTo(ARENA.ASTEROID_SPEED_MAX_SCALER, 5);
    });
  });

  describe('update', () => {
    it('advances rotation angles by dt * rotationSpeed', () => {
      const a = new Asteroid(0);
      a.curXAngle = 10;
      a.curYAngle = 20;
      a.update(100);
      expect(a.curXAngle).toBeCloseTo(10 + 100 * ARENA.ASTEROID_ROTATION_SPEED);
      expect(a.curYAngle).toBeCloseTo(20 + 100 * ARENA.ASTEROID_ROTATION_SPEED);
    });

    it('wraps rotation angles at 360', () => {
      const a = new Asteroid(0);
      a.curXAngle = 359;
      a.curYAngle = 359;
      a.update(100); // 359 + 10 = 369 -> wraps to 9
      expect(a.curXAngle).toBeCloseTo(369 - 360);
      expect(a.curYAngle).toBeCloseTo(369 - 360);
    });

    it('applies physics via super.update (moves position by accelVec)', () => {
      const a = new Asteroid(0);
      a.position = { x: 100, y: 200, z: 0 };
      a.accelVec = { x: 1, y: 0, z: 0 };
      a.update(10);
      // super.update: position.x += accelVec.x * dt * TIME_SCALER
      expect(a.position.x).toBeCloseTo(100 + 1 * 10 * ARENA.TIME_SCALER);
    });
  });

  describe('reset', () => {
    it('resets position and velocity', () => {
      const a = new Asteroid(0);
      a.position = { x: 999, y: 999, z: 999 };
      a.accelVec = { x: 5, y: 5, z: 5 };
      a.health = 0;
      a.alive = false;
      a.reset(2);
      expect(a.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(a.health).toBe(1);
      expect(a.alive).toBe(true);
      expect(a.asteroidType).toBe(2);
      expect(a.collisionSpheres[0].radius).toBe(ARENA.ASTEROID_COLLISION_RADII[2]);
    });

    it('randomizes rotation angles on reset', () => {
      const a = new Asteroid(0);
      a.curXAngle = 0;
      a.curYAngle = 0;
      // Reset multiple times — at least one should differ from 0
      const angles: number[] = [];
      for (let i = 0; i < 10; i++) {
        a.reset(0);
        angles.push(a.curXAngle);
      }
      const allZero = angles.every((v) => v === 0);
      expect(allZero).toBe(false);
    });

    it('sets a new random accelVec direction', () => {
      const a = new Asteroid(0);
      a.reset(0);
      const speed = Math.sqrt(
        a.accelVec.x * a.accelVec.x +
        a.accelVec.y * a.accelVec.y +
        a.accelVec.z * a.accelVec.z,
      );
      expect(speed).toBeCloseTo(ARENA.ASTEROID_SPEED_MAX_SCALER, 5);
    });
  });
});
