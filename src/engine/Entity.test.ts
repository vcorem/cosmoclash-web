import { describe, it, expect } from 'vitest';
import { Entity } from './Entity';

describe('Entity', () => {
  describe('constructor', () => {
    it('initializes with default values', () => {
      const e = new Entity();
      expect(e.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(e.accelVec).toEqual({ x: 0, y: 0, z: 0 });
      expect(e.angle).toBe(0);
      expect(e.alive).toBe(true);
      expect(e.autoWrap).toBe(true);
    });
  });

  describe('update', () => {
    it('applies acceleration to position using time scaler', () => {
      const e = new Entity();
      e.accelVec = { x: 1, y: 0.5, z: 0 };
      e.update(100); // 100ms frame
      // position += accelVec * (dt * 0.35)
      expect(e.position.x).toBeCloseTo(1 * 100 * 0.35);
      expect(e.position.y).toBeCloseTo(0.5 * 100 * 0.35);
      expect(e.position.z).toBe(0);
    });

    it('accumulates position over multiple frames', () => {
      const e = new Entity();
      e.accelVec = { x: 0.5, y: 0, z: 0 };
      e.update(100);
      e.update(100);
      expect(e.position.x).toBeCloseTo(0.5 * 100 * 0.35 * 2);
    });

    it('stores previous position before updating', () => {
      const e = new Entity();
      e.position = { x: 10, y: 20, z: 0 };
      e.accelVec = { x: 1, y: 0, z: 0 };
      e.update(100);
      expect(e.previousPosition).toEqual({ x: 10, y: 20, z: 0 });
    });
  });

  describe('correctAngle', () => {
    it('wraps angle >= 360 back to 0-360 range', () => {
      const e = new Entity();
      e.angle = 370;
      e.correctAngle();
      expect(e.angle).toBe(10);
    });

    it('wraps negative angle to positive', () => {
      const e = new Entity();
      e.angle = -10;
      e.correctAngle();
      expect(e.angle).toBe(350);
    });

    it('leaves valid angle unchanged', () => {
      const e = new Entity();
      e.angle = 180;
      e.correctAngle();
      expect(e.angle).toBe(180);
    });
  });

  describe('handleWrapAround', () => {
    it('wraps entity to opposite side when exceeding +X bound', () => {
      const e = new Entity();
      const camCenter = { x: 0, y: 0, z: -500 };
      e.position = { x: 1600, y: 0, z: 0 };
      e.handleWrapAround(camCenter);
      // delta.X = 1600, overshoot = 1600 - 1500 = 100
      // newX = camCenter.X - 1500 + 100 = -1400
      expect(e.position.x).toBeCloseTo(-1400);
    });

    it('wraps entity to opposite side when exceeding -X bound', () => {
      const e = new Entity();
      const camCenter = { x: 0, y: 0, z: -500 };
      e.position = { x: -1600, y: 0, z: 0 };
      e.handleWrapAround(camCenter);
      // delta.X = -1600, overshoot = -1600 + 1500 = -100
      // newX = camCenter.X + 1500 + (-100) = 1400
      expect(e.position.x).toBeCloseTo(1400);
    });

    it('wraps entity on Y axis', () => {
      const e = new Entity();
      const camCenter = { x: 0, y: 0, z: -500 };
      e.position = { x: 0, y: 1100, z: 0 };
      e.handleWrapAround(camCenter);
      // delta.Y = 1100, overshoot = 1100 - 1050 = 50
      // newY = camCenter.Y - 1050 + 50 = -1000
      expect(e.position.y).toBeCloseTo(-1000);
    });

    it('does not wrap entity within bounds', () => {
      const e = new Entity();
      const camCenter = { x: 0, y: 0, z: -500 };
      e.position = { x: 500, y: 300, z: 0 };
      e.handleWrapAround(camCenter);
      expect(e.position.x).toBe(500);
      expect(e.position.y).toBe(300);
    });

    it('wraps relative to camera center, not origin', () => {
      const e = new Entity();
      const camCenter = { x: 1000, y: 0, z: -500 };
      e.position = { x: 2600, y: 0, z: 0 };
      e.handleWrapAround(camCenter);
      // delta.X = 2600 - 1000 = 1600, overshoot = 1600 - 1500 = 100
      // newX = 1000 - 1500 + 100 = -400
      expect(e.position.x).toBeCloseTo(-400);
    });

    it('skips wrap when autoWrap is false', () => {
      const e = new Entity();
      e.autoWrap = false;
      const camCenter = { x: 0, y: 0, z: -500 };
      e.position = { x: 2000, y: 0, z: 0 };
      e.handleWrapAround(camCenter);
      expect(e.position.x).toBe(2000);
    });
  });

  describe('destroy', () => {
    it('marks entity as not alive', () => {
      const e = new Entity();
      e.destroy();
      expect(e.alive).toBe(false);
    });
  });

  describe('getFullSpeedVec', () => {
    it('returns correct speed vector at angle 0 (pointing up)', () => {
      const e = new Entity();
      e.angle = 0;
      const vec = e.getFullSpeedVec(1.0);
      expect(vec.x).toBeCloseTo(0);
      expect(vec.y).toBeCloseTo(1.0);
    });

    it('returns correct speed vector at angle 90 (pointing left)', () => {
      const e = new Entity();
      e.angle = 90;
      const vec = e.getFullSpeedVec(1.0);
      expect(vec.x).toBeCloseTo(-1.0);
      expect(vec.y).toBeCloseTo(0, 5);
    });

    it('returns correct speed vector at angle 180 (pointing down)', () => {
      const e = new Entity();
      e.angle = 180;
      const vec = e.getFullSpeedVec(1.0);
      expect(vec.x).toBeCloseTo(0, 5);
      expect(vec.y).toBeCloseTo(-1.0);
    });

    it('scales by speedScaler', () => {
      const e = new Entity();
      e.angle = 0;
      const vec = e.getFullSpeedVec(0.5);
      expect(vec.y).toBeCloseTo(0.5);
    });
  });
});
