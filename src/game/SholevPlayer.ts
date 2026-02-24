import { Player, CharacterStats } from './Player';
import { Bullet, ICE_BULLET_CONFIG } from './Bullet';
import { Snot } from './Snot';
import { Vec3 } from '@/engine/Entity';

export const SHOLEV_BASE_SPEED = 0.8;
export const SHOLEV_BASE_ROTATION = 0.5;
export const SHOLEV_BOOST_SPEED = 1.6;
export const SHOLEV_BOOST_ROTATION = 1.0;
export const SHOLEV_MIN_ENERGY_SHIELD = 0.25;
export const FROST_SHIELD_TOGGLE_COOLDOWN = 2000; // 2 seconds before allowing toggle-off
const FROST_ENERGY_DRAIN = 0.0003; // per ms, from C++

export const SHOLEV_STATS: CharacterStats = {
  speedMaxScaler: SHOLEV_BASE_SPEED,
  acceleration: 0.004,
  rotationSpeed: SHOLEV_BASE_ROTATION,
  primaryEnergyCost: 0.07,
  primaryWeaponDelay: 100,
  primaryWeaponFillRate: 0.0002,
  primaryBulletConfig: ICE_BULLET_CONFIG,
};

export class SholevPlayer extends Player {
  frostShieldActive: boolean = false;
  activeFrostBullet: Bullet | null = null;
  frostShieldActiveTime: number = 0;

  constructor() {
    super({ ...SHOLEV_STATS }); // mutable copy for stat swapping
    this.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 10 }];
  }

  /** Returns true if frost shield can be activated. Caller creates the bullet. */
  activateFrostShield(): boolean {
    if (this.frostShieldActive) return false;
    if (this.energy < SHOLEV_MIN_ENERGY_SHIELD) return false;
    this.frostShieldActive = true;
    this.frostShieldActiveTime = 0;
    this.stats.speedMaxScaler = SHOLEV_BOOST_SPEED;
    this.stats.rotationSpeed = SHOLEV_BOOST_ROTATION;
    return true;
  }

  /** Set frost bullet reference (called from main.ts after acquireBullet). */
  setFrostBullet(bullet: Bullet): void {
    this.activeFrostBullet = bullet;
  }

  updateFrostShield(dt: number): void {
    if (!this.frostShieldActive || !this.activeFrostBullet) return;

    this.frostShieldActiveTime += dt;

    if (!this.activeFrostBullet.alive) {
      this.deactivateFrostShield();
      return;
    }

    this.energy -= FROST_ENERGY_DRAIN * dt;
    if (this.energy <= 0) {
      this.energy = 0;
      this.activeFrostBullet.destroy();
      this.deactivateFrostShield();
    }
  }

  /** Manually toggle off the frost shield (called from input handler). Returns true if deactivated. */
  deactivateFrostShieldManual(): boolean {
    if (!this.frostShieldActive) return false;
    if (this.frostShieldActiveTime < FROST_SHIELD_TOGGLE_COOLDOWN) return false;
    if (this.activeFrostBullet) {
      this.activeFrostBullet.destroy();
    }
    this.deactivateFrostShield();
    return true;
  }

  private deactivateFrostShield(): void {
    this.frostShieldActive = false;
    this.activeFrostBullet = null;
    this.frostShieldActiveTime = 0;
    this.stats.speedMaxScaler = SHOLEV_BASE_SPEED;
    this.stats.rotationSpeed = SHOLEV_BASE_ROTATION;
  }

  override fireSecondary(_enemy: Player): Snot | null {
    return null;
  }

  override resetForNewRound(spawnPosition: Vec3): void {
    if (this.activeFrostBullet) {
      this.activeFrostBullet.destroy();
    }
    this.deactivateFrostShield();
    super.resetForNewRound(spawnPosition);
    this.stats.speedMaxScaler = SHOLEV_BASE_SPEED;
    this.stats.rotationSpeed = SHOLEV_BASE_ROTATION;
  }
}
