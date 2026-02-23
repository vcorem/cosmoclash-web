import { describe, it, expect } from 'vitest';
import { Player, GONDI_STATS } from './Player';
import { FLAME_BULLET_CONFIG } from './Bullet';
import { Snot, SNOT_CONFIG } from './Snot';
import { EntityType } from '@/engine/Entity';

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

  describe('snot debuff', () => {
    it('starts with zero snotCount', () => {
      const p = new Player(GONDI_STATS);
      expect(p.snotCount).toBe(0);
    });

    it('addSnot increments count', () => {
      const p = new Player(GONDI_STATS);
      p.addSnot();
      expect(p.snotCount).toBe(1);
      p.addSnot();
      expect(p.snotCount).toBe(2);
    });

    it('removeSnot decrements count', () => {
      const p = new Player(GONDI_STATS);
      p.addSnot();
      p.addSnot();
      p.removeSnot();
      expect(p.snotCount).toBe(1);
    });

    it('getEffectiveMaxSpeed returns base / (snotCount + 1)', () => {
      const p = new Player(GONDI_STATS);
      expect(p.getEffectiveMaxSpeed()).toBeCloseTo(1.2);
      p.addSnot();
      expect(p.getEffectiveMaxSpeed()).toBeCloseTo(0.6);
      p.addSnot();
      expect(p.getEffectiveMaxSpeed()).toBeCloseTo(0.4);
      p.addSnot();
      expect(p.getEffectiveMaxSpeed()).toBeCloseTo(0.3);
    });

    it('getEffectiveRotSpeed returns base / (floor(snotCount/3) + 1)', () => {
      const p = new Player(GONDI_STATS);
      expect(p.getEffectiveRotSpeed()).toBeCloseTo(0.5);
      p.addSnot();
      expect(p.getEffectiveRotSpeed()).toBeCloseTo(0.5);
      p.addSnot();
      expect(p.getEffectiveRotSpeed()).toBeCloseTo(0.5);
      p.addSnot();
      expect(p.getEffectiveRotSpeed()).toBeCloseTo(0.25);
    });

    it('thrust uses effective max speed', () => {
      const p = new Player(GONDI_STATS);
      p.angle = 0;
      p.addSnot();
      for (let i = 0; i < 100; i++) p.thrust(100);
      expect(p.accelVec.y).toBeCloseTo(0.6, 1);
    });

    it('rotation uses effective rotation speed', () => {
      const p = new Player(GONDI_STATS);
      p.snotCount = 3;
      p.rotate(1, 100);
      expect(p.angle).toBeCloseTo(8.75);
    });
  });

  describe('collision setup', () => {
    it('has entityType Player', () => {
      const p = new Player(GONDI_STATS);
      expect(p.entityType).toBe(EntityType.Player);
    });

    it('has one collision sphere at origin with radius 14', () => {
      const p = new Player(GONDI_STATS);
      expect(p.collisionSpheres).toHaveLength(1);
      expect(p.collisionSpheres[0].offset).toEqual({ x: 0, y: 0, z: 0 });
      expect(p.collisionSpheres[0].radius).toBe(14);
    });
  });

  describe('resetForNewRound', () => {
    it('restores health, energy, and alive status', () => {
      const p = new Player(GONDI_STATS);
      p.health = 0;
      p.energy = 0.3;
      p.alive = false;
      p.resetForNewRound({ x: -500, y: -70, z: 0 });
      expect(p.health).toBe(1);
      expect(p.energy).toBe(1);
      expect(p.alive).toBe(true);
    });

    it('resets position and velocity', () => {
      const p = new Player(GONDI_STATS);
      p.position = { x: 999, y: 999, z: 0 };
      p.accelVec = { x: 1, y: 1, z: 0 };
      p.resetForNewRound({ x: -500, y: -70, z: 0 });
      expect(p.position).toEqual({ x: -500, y: -70, z: 0 });
      expect(p.previousPosition).toEqual({ x: -500, y: -70, z: 0 });
      expect(p.accelVec).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('resets cooldowns, snot count, angle, and roll', () => {
      const p = new Player(GONDI_STATS);
      p.primaryCooldown = 100;
      p.secondaryCooldown = 200;
      p.snotCount = 5;
      p.angle = 180;
      p.rollAngle = 45;
      p.resetForNewRound({ x: 0, y: 0, z: 0 });
      expect(p.primaryCooldown).toBe(0);
      expect(p.secondaryCooldown).toBe(0);
      expect(p.snotCount).toBe(0);
      expect(p.angle).toBe(0);
      expect(p.rollAngle).toBe(0);
    });
  });

  describe('fireSecondary', () => {
    it('creates a snot when fired', () => {
      const p = new Player(GONDI_STATS);
      const enemy = new Player(GONDI_STATS);
      const snot = p.fireSecondary(enemy);
      expect(snot).not.toBeNull();
      expect(snot).toBeInstanceOf(Snot);
    });

    it('deducts energy on fire', () => {
      const p = new Player(GONDI_STATS);
      const enemy = new Player(GONDI_STATS);
      p.fireSecondary(enemy);
      expect(p.energy).toBeCloseTo(1 - 0.12);
    });

    it('sets secondary cooldown on fire', () => {
      const p = new Player(GONDI_STATS);
      const enemy = new Player(GONDI_STATS);
      p.fireSecondary(enemy);
      expect(p.secondaryCooldown).toBe(200);
    });

    it('returns null when secondary cooldown is active', () => {
      const p = new Player(GONDI_STATS);
      const enemy = new Player(GONDI_STATS);
      p.secondaryCooldown = 50;
      expect(p.fireSecondary(enemy)).toBeNull();
    });

    it('returns null when energy is too low', () => {
      const p = new Player(GONDI_STATS);
      const enemy = new Player(GONDI_STATS);
      p.energy = 0.12;
      expect(p.fireSecondary(enemy)).toBeNull();
    });

    it('spawns snot 25 units ahead', () => {
      const p = new Player(GONDI_STATS);
      const enemy = new Player(GONDI_STATS);
      p.position = { x: 100, y: 200, z: 0 };
      p.angle = 0;
      const snot = p.fireSecondary(enemy)!;
      expect(snot.position.x).toBeCloseTo(100);
      expect(snot.position.y).toBeCloseTo(225);
    });

    it('sets snot target to enemy', () => {
      const p = new Player(GONDI_STATS);
      const enemy = new Player(GONDI_STATS);
      const snot = p.fireSecondary(enemy)!;
      expect(snot.target).toBe(enemy);
    });

    it('sets snot origin to self', () => {
      const p = new Player(GONDI_STATS);
      const enemy = new Player(GONDI_STATS);
      const snot = p.fireSecondary(enemy)!;
      expect(snot.originEntity).toBe(p);
    });

    it('decrements secondary cooldown in updateEnergy', () => {
      const p = new Player(GONDI_STATS);
      p.secondaryCooldown = 100;
      p.updateEnergy(60);
      expect(p.secondaryCooldown).toBe(40);
    });
  });
});
