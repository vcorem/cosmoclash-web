import { describe, it, expect } from 'vitest';
import { Player, GONDI_STATS } from './Player';

describe('Player', () => {
  describe('Gondi stats', () => {
    it('has correct Gondi parameters', () => {
      expect(GONDI_STATS.speedMaxScaler).toBe(1.2);
      expect(GONDI_STATS.acceleration).toBe(0.004);
      expect(GONDI_STATS.rotationSpeed).toBe(0.5);
    });
  });

  describe('rotation', () => {
    it('increases angle when rotating left', () => {
      const p = new Player(GONDI_STATS);
      p.rotate(1, 100);
      // angle += rotationSpeed * (dt * timeScaler)
      // angle += 0.5 * (100 * 0.35) = 17.5
      expect(p.angle).toBeCloseTo(17.5);
    });

    it('decreases angle when rotating right', () => {
      const p = new Player(GONDI_STATS);
      p.angle = 90;
      p.rotate(-1, 100);
      expect(p.angle).toBeCloseTo(90 - 17.5);
    });

    it('wraps angle after rotation', () => {
      const p = new Player(GONDI_STATS);
      p.angle = 355;
      p.rotate(1, 100);
      // 355 + 17.5 = 372.5 -> wraps to 12.5
      expect(p.angle).toBeCloseTo(12.5);
    });

    it('updates roll angle during rotation', () => {
      const p = new Player(GONDI_STATS);
      p.rotate(1, 100);
      // rollAngle += 0.6 * rotSpeed * (dt * timeScaler)
      // rollAngle += 0.6 * 0.5 * 35 = 10.5
      expect(p.rollAngle).toBeCloseTo(10.5);
    });

    it('clamps roll angle at max', () => {
      const p = new Player(GONDI_STATS);
      // Rotate many times to exceed 70 degree max
      for (let i = 0; i < 20; i++) {
        p.rotate(1, 100);
      }
      expect(p.rollAngle).toBe(70);
    });

    it('decays roll angle when not rotating', () => {
      const p = new Player(GONDI_STATS);
      p.rotate(1, 100); // Build up some roll
      const rollBefore = p.rollAngle;
      p.resetRoll(100); // Decay roll
      expect(p.rollAngle).toBeLessThan(rollBefore);
    });
  });

  describe('thrust', () => {
    it('accelerates toward full speed vector', () => {
      const p = new Player(GONDI_STATS);
      p.angle = 0; // Pointing up: fullSpeed = (0, 1.2, 0)
      p.thrust(100);
      // accelAdd = 0.004 * (100 * 0.35) = 0.14
      // accelVec moves toward (0, 1.2, 0) by up to 0.14 per axis
      expect(p.accelVec.y).toBeCloseTo(0.14);
      expect(p.accelVec.x).toBeCloseTo(0);
    });

    it('does not overshoot target speed', () => {
      const p = new Player(GONDI_STATS);
      p.angle = 0;
      // Thrust many times to reach max speed
      for (let i = 0; i < 100; i++) {
        p.thrust(100);
      }
      expect(p.accelVec.y).toBeCloseTo(1.2, 1);
    });

    it('changes direction when angle changes', () => {
      const p = new Player(GONDI_STATS);
      p.angle = 0;
      p.thrust(100); // Build some upward velocity
      p.angle = 90; // Now pointing left
      p.thrust(100);
      // X should start moving negative (leftward)
      expect(p.accelVec.x).toBeLessThan(0);
    });
  });

  describe('getFullSpeedVec with Gondi scaler', () => {
    it('uses speedMaxScaler for full speed', () => {
      const p = new Player(GONDI_STATS);
      p.angle = 0;
      const vec = p.getFullSpeedVec(GONDI_STATS.speedMaxScaler);
      expect(vec.y).toBeCloseTo(1.2);
    });
  });
});
