import { describe, it, expect } from 'vitest';
import { Player, GONDI_STATS } from './Player';
import { FLAME_BULLET_CONFIG } from './Bullet';

describe('Player', () => {
  describe('Gondi stats', () => {
    it('has correct Gondi parameters', () => {
      expect(GONDI_STATS.speedMaxScaler).toBe(1.2);
      expect(GONDI_STATS.acceleration).toBe(0.004);
      expect(GONDI_STATS.rotationSpeed).toBe(0.5);
      expect(GONDI_STATS.primaryEnergyCost).toBe(0.12);
      expect(GONDI_STATS.primaryWeaponDelay).toBe(100);
      expect(GONDI_STATS.primaryWeaponFillRate).toBe(0.0002);
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

  describe('energy system', () => {
    it('starts with full energy and zero cooldown', () => {
      const p = new Player(GONDI_STATS);
      expect(p.energy).toBe(1);
      expect(p.primaryCooldown).toBe(0);
    });

    it('regenerates energy over time', () => {
      const p = new Player(GONDI_STATS);
      p.energy = 0.5;
      p.updateEnergy(100);
      // energy += 0.0002 * 100 = 0.02
      expect(p.energy).toBeCloseTo(0.52);
    });

    it('caps energy at 1', () => {
      const p = new Player(GONDI_STATS);
      p.energy = 0.999;
      p.updateEnergy(100);
      expect(p.energy).toBe(1);
    });

    it('decrements cooldown over time', () => {
      const p = new Player(GONDI_STATS);
      p.primaryCooldown = 100;
      p.updateEnergy(60);
      expect(p.primaryCooldown).toBe(40);
    });

    it('clamps cooldown at zero', () => {
      const p = new Player(GONDI_STATS);
      p.primaryCooldown = 50;
      p.updateEnergy(100);
      expect(p.primaryCooldown).toBe(0);
    });
  });

  describe('firePrimary', () => {
    it('creates a bullet when fired', () => {
      const p = new Player(GONDI_STATS);
      const bullet = p.firePrimary();
      expect(bullet).not.toBeNull();
      expect(bullet!.alive).toBe(true);
    });

    it('deducts energy on fire', () => {
      const p = new Player(GONDI_STATS);
      p.firePrimary();
      expect(p.energy).toBeCloseTo(1 - 0.12);
    });

    it('sets cooldown on fire', () => {
      const p = new Player(GONDI_STATS);
      p.firePrimary();
      expect(p.primaryCooldown).toBe(100);
    });

    it('returns null when cooldown is active', () => {
      const p = new Player(GONDI_STATS);
      p.primaryCooldown = 50;
      expect(p.firePrimary()).toBeNull();
    });

    it('returns null when energy is too low (uses <= check)', () => {
      const p = new Player(GONDI_STATS);
      p.energy = 0.12; // exactly equal to cost — should block
      expect(p.firePrimary()).toBeNull();
    });

    it('fires when energy is just above cost', () => {
      const p = new Player(GONDI_STATS);
      p.energy = 0.13;
      expect(p.firePrimary()).not.toBeNull();
    });

    it('spawns bullet 25 units ahead at angle 0 (pointing up)', () => {
      const p = new Player(GONDI_STATS);
      p.position = { x: 100, y: 200, z: 0 };
      p.angle = 0;
      const bullet = p.firePrimary()!;
      expect(bullet.position.x).toBeCloseTo(100);
      expect(bullet.position.y).toBeCloseTo(225);
    });

    it('spawns bullet 25 units ahead at angle 90 (pointing left)', () => {
      const p = new Player(GONDI_STATS);
      p.position = { x: 100, y: 200, z: 0 };
      p.angle = 90;
      const bullet = p.firePrimary()!;
      expect(bullet.position.x).toBeCloseTo(75);
      expect(bullet.position.y).toBeCloseTo(200);
    });

    it('sets bullet angle to player angle', () => {
      const p = new Player(GONDI_STATS);
      p.angle = 45;
      const bullet = p.firePrimary()!;
      expect(bullet.angle).toBe(45);
    });

    it('sets bullet velocity to full speed immediately', () => {
      const p = new Player(GONDI_STATS);
      p.angle = 0;
      const bullet = p.firePrimary()!;
      // Full speed at angle 0: (0, 0.3, 0)
      expect(bullet.accelVec.x).toBeCloseTo(0);
      expect(bullet.accelVec.y).toBeCloseTo(0.3);
    });

    it('sets origin entity reference', () => {
      const p = new Player(GONDI_STATS);
      const bullet = p.firePrimary()!;
      expect(bullet.originEntity).toBe(p);
    });

    it('can fire again after cooldown clears', () => {
      const p = new Player(GONDI_STATS);
      p.firePrimary();
      expect(p.firePrimary()).toBeNull(); // blocked by cooldown
      p.updateEnergy(100); // clear cooldown
      expect(p.firePrimary()).not.toBeNull();
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
