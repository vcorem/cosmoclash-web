import { describe, it, expect } from 'vitest';
import {
  SholevPlayer,
  SHOLEV_STATS,
  SHOLEV_BASE_SPEED,
  SHOLEV_BASE_ROTATION,
  SHOLEV_BOOST_SPEED,
  SHOLEV_BOOST_ROTATION,
  SHOLEV_MIN_ENERGY_SHIELD,
  FROST_SHIELD_TOGGLE_COOLDOWN,
} from './SholevPlayer';
import { ICE_BULLET_CONFIG, FROST_SHIELD_CONFIG, Bullet } from './Bullet';
import { Player, GONDI_STATS } from './Player';

describe('SholevPlayer', () => {
  describe('SHOLEV_STATS', () => {
    it('has correct stats from C++', () => {
      expect(SHOLEV_STATS.speedMaxScaler).toBe(0.8);
      expect(SHOLEV_STATS.acceleration).toBe(0.004);
      expect(SHOLEV_STATS.rotationSpeed).toBe(0.5);
      expect(SHOLEV_STATS.primaryEnergyCost).toBe(0.07);
      expect(SHOLEV_STATS.primaryWeaponDelay).toBe(100);
      expect(SHOLEV_STATS.primaryWeaponFillRate).toBe(0.0002);
      expect(SHOLEV_STATS.primaryBulletConfig).toBe(ICE_BULLET_CONFIG);
    });
  });

  describe('initial state', () => {
    it('has stats matching SHOLEV_STATS values', () => {
      const p = new SholevPlayer();
      expect(p.stats.speedMaxScaler).toBe(SHOLEV_STATS.speedMaxScaler);
      expect(p.stats.primaryBulletConfig).toBe(ICE_BULLET_CONFIG);
    });

    it('has single collision sphere at (0,0,0) r10', () => {
      const p = new SholevPlayer();
      expect(p.collisionSpheres).toHaveLength(1);
      expect(p.collisionSpheres[0]).toEqual({ offset: { x: 0, y: 0, z: 0 }, radius: 10 });
    });

    it('starts with frost shield inactive', () => {
      const p = new SholevPlayer();
      expect(p.frostShieldActive).toBe(false);
      expect(p.activeFrostBullet).toBeNull();
    });
  });

  describe('frost shield activation', () => {
    it('returns true and boosts stats when energy sufficient', () => {
      const p = new SholevPlayer();
      p.energy = 1.0;
      expect(p.activateFrostShield()).toBe(true);
      expect(p.frostShieldActive).toBe(true);
      expect(p.stats.speedMaxScaler).toBe(SHOLEV_BOOST_SPEED);
      expect(p.stats.rotationSpeed).toBe(SHOLEV_BOOST_ROTATION);
    });

    it('returns false when energy < 0.25', () => {
      const p = new SholevPlayer();
      p.energy = 0.24;
      expect(p.activateFrostShield()).toBe(false);
      expect(p.frostShieldActive).toBe(false);
    });

    it('returns false when frost already active', () => {
      const p = new SholevPlayer();
      p.energy = 1.0;
      p.activateFrostShield();
      expect(p.activateFrostShield()).toBe(false);
    });
  });

  describe('setFrostBullet', () => {
    it('stores the bullet reference', () => {
      const p = new SholevPlayer();
      const bullet = new Bullet(FROST_SHIELD_CONFIG, p);
      p.setFrostBullet(bullet);
      expect(p.activeFrostBullet).toBe(bullet);
    });
  });

  describe('frost shield update', () => {
    it('drains energy at 0.0003 per ms', () => {
      const p = new SholevPlayer();
      p.energy = 1.0;
      p.activateFrostShield();
      const bullet = new Bullet(FROST_SHIELD_CONFIG, p);
      p.setFrostBullet(bullet);
      p.updateFrostShield(1000);
      expect(p.energy).toBeCloseTo(1.0 - 0.0003 * 1000);
    });

    it('deactivates when energy reaches 0', () => {
      const p = new SholevPlayer();
      p.energy = 0.3;
      p.activateFrostShield();
      const bullet = new Bullet(FROST_SHIELD_CONFIG, p);
      p.setFrostBullet(bullet);
      p.updateFrostShield(1100);
      expect(p.energy).toBe(0);
      expect(bullet.alive).toBe(false);
      expect(p.frostShieldActive).toBe(false);
      expect(p.activeFrostBullet).toBeNull();
    });

    it('reverts stats when deactivated by energy drain', () => {
      const p = new SholevPlayer();
      p.energy = 0.26;
      p.activateFrostShield();
      const bullet = new Bullet(FROST_SHIELD_CONFIG, p);
      p.setFrostBullet(bullet);
      p.updateFrostShield(1000);
      expect(p.stats.speedMaxScaler).toBe(SHOLEV_BASE_SPEED);
      expect(p.stats.rotationSpeed).toBe(SHOLEV_BASE_ROTATION);
    });

    it('deactivates when frost bullet is killed externally', () => {
      const p = new SholevPlayer();
      p.energy = 1.0;
      p.activateFrostShield();
      const bullet = new Bullet(FROST_SHIELD_CONFIG, p);
      p.setFrostBullet(bullet);
      bullet.destroy();
      p.updateFrostShield(16);
      expect(p.frostShieldActive).toBe(false);
      expect(p.activeFrostBullet).toBeNull();
      expect(p.stats.speedMaxScaler).toBe(SHOLEV_BASE_SPEED);
    });

    it('does nothing when frost not active', () => {
      const p = new SholevPlayer();
      p.energy = 1.0;
      p.updateFrostShield(1000);
      expect(p.energy).toBe(1.0);
    });
  });

  describe('deactivateFrostShieldManual', () => {
    it('destroys the frost bullet and reverts stats after cooldown', () => {
      const p = new SholevPlayer();
      p.energy = 1.0;
      p.activateFrostShield();
      const bullet = new Bullet(FROST_SHIELD_CONFIG, p);
      p.setFrostBullet(bullet);

      // Advance past the 2-second cooldown
      p.updateFrostShield(FROST_SHIELD_TOGGLE_COOLDOWN);

      expect(p.deactivateFrostShieldManual()).toBe(true);
      expect(p.frostShieldActive).toBe(false);
      expect(p.activeFrostBullet).toBeNull();
      expect(bullet.alive).toBe(false);
      expect(p.stats.speedMaxScaler).toBe(SHOLEV_BASE_SPEED);
      expect(p.stats.rotationSpeed).toBe(SHOLEV_BASE_ROTATION);
    });

    it('returns false when toggle cooldown has not elapsed', () => {
      const p = new SholevPlayer();
      p.energy = 1.0;
      p.activateFrostShield();
      const bullet = new Bullet(FROST_SHIELD_CONFIG, p);
      p.setFrostBullet(bullet);

      // Only 1 second elapsed — not enough
      p.updateFrostShield(1000);

      expect(p.deactivateFrostShieldManual()).toBe(false);
      expect(p.frostShieldActive).toBe(true);
      expect(bullet.alive).toBe(true);
    });

    it('does nothing when frost shield is not active', () => {
      const p = new SholevPlayer();
      p.energy = 1.0;
      expect(p.deactivateFrostShieldManual()).toBe(false);
      expect(p.frostShieldActive).toBe(false);
      expect(p.energy).toBe(1.0);
    });
  });

  describe('fireSecondary override', () => {
    it('returns null', () => {
      const p = new SholevPlayer();
      const enemy = new Player(GONDI_STATS);
      expect(p.fireSecondary(enemy)).toBeNull();
    });
  });

  describe('resetForNewRound', () => {
    it('deactivates frost shield and reverts stats', () => {
      const p = new SholevPlayer();
      p.energy = 1.0;
      p.activateFrostShield();
      const bullet = new Bullet(FROST_SHIELD_CONFIG, p);
      p.setFrostBullet(bullet);
      p.resetForNewRound({ x: 0, y: 0, z: 0 });
      expect(p.frostShieldActive).toBe(false);
      expect(p.activeFrostBullet).toBeNull();
      expect(p.stats.speedMaxScaler).toBe(SHOLEV_BASE_SPEED);
      expect(p.stats.rotationSpeed).toBe(SHOLEV_BASE_ROTATION);
    });
  });
});
