import { Entity, EntityType, Vec3 } from '@/engine/Entity';
import { Bullet, BulletConfig, FLAME_BULLET_CONFIG } from './Bullet';
import { Snot, SNOT_CONFIG } from './Snot';
import { ARENA } from './Arena';

export interface CharacterStats {
  speedMaxScaler: number;
  acceleration: number;
  rotationSpeed: number;
  primaryEnergyCost: number;
  primaryWeaponDelay: number;
  primaryWeaponFillRate: number;
  primaryBulletConfig: BulletConfig;
}

export const GONDI_STATS: CharacterStats = {
  speedMaxScaler: 1.2,
  acceleration: 0.004,
  rotationSpeed: 0.5,
  primaryEnergyCost: 0.12,
  primaryWeaponDelay: 100,
  primaryWeaponFillRate: 0.0002,
  primaryBulletConfig: FLAME_BULLET_CONFIG,
};

const ROLL_SCALER = 0.6;
const ROLL_MAX_ANGLE = 70;

export class Player extends Entity {
  stats: CharacterStats;
  rollAngle: number = 0;
  energy: number = 1;
  primaryCooldown: number = 0;
  snotCount: number = 0;
  secondaryCooldown: number = 0;
  private needRollReset: boolean = false;

  constructor(stats: CharacterStats) {
    super();
    this.stats = stats;
    this.entityType = EntityType.Player;
    this.autoWrap = false; // Players use dedicated player-to-player wrap, not camera-distance wrap
    this.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];
  }

  rotate(direction: 1 | -1, dt: number): void {
    const rotSpeed = this.getEffectiveRotSpeed();
    const delta = rotSpeed * (dt * ARENA.TIME_SCALER);

    this.angle += direction * delta;
    this.rollAngle += direction * ROLL_SCALER * delta;

    if (this.rollAngle > ROLL_MAX_ANGLE) this.rollAngle = ROLL_MAX_ANGLE;
    if (this.rollAngle < -ROLL_MAX_ANGLE) this.rollAngle = -ROLL_MAX_ANGLE;

    this.needRollReset = true;
    this.correctAngle();
  }

  resetRoll(dt: number): void {
    if (!this.needRollReset) {
      this.rollAngle = 0;
      return;
    }

    const rotSpeed = this.getEffectiveRotSpeed();
    const delta = ROLL_SCALER * rotSpeed * (dt * ARENA.TIME_SCALER);

    if (this.rollAngle < 0) {
      this.rollAngle += delta;
      if (this.rollAngle >= 0) {
        this.rollAngle = 0;
        this.needRollReset = false;
      }
    } else {
      this.rollAngle -= delta;
      if (this.rollAngle <= 0) {
        this.rollAngle = 0;
        this.needRollReset = false;
      }
    }
  }

  thrust(dt: number): void {
    const accelAdd = this.stats.acceleration * (dt * ARENA.TIME_SCALER);
    const fullSpeed = this.getFullSpeedVec(this.getEffectiveMaxSpeed());

    // Move accelVec toward fullSpeed without overshooting
    this.accelVec.x = this.moveToward(this.accelVec.x, fullSpeed.x, accelAdd);
    this.accelVec.y = this.moveToward(this.accelVec.y, fullSpeed.y, accelAdd);
  }

  firePrimary(): Bullet | null {
    if (this.primaryCooldown > 0) return null;
    if (this.energy <= this.stats.primaryEnergyCost) return null;

    this.energy -= this.stats.primaryEnergyCost;
    this.primaryCooldown = this.stats.primaryWeaponDelay;

    const bullet = new Bullet(this.stats.primaryBulletConfig, this);
    bullet.angle = this.angle;

    // Spawn 25 units ahead along heading
    const spawnVec = this.getFullSpeedVec(25);
    bullet.position = {
      x: this.position.x + spawnVec.x,
      y: this.position.y + spawnVec.y,
      z: this.position.z,
    };

    // Bullets start at full speed immediately (no acceleration)
    const speedVec = this.getFullSpeedVec(this.stats.primaryBulletConfig.speedMaxScaler);
    bullet.accelVec = { ...speedVec };

    return bullet;
  }

  fireSecondary(enemy: Player): Snot | null {
    if (this.secondaryCooldown > 0) return null;
    if (this.energy <= this.stats.primaryEnergyCost) return null;

    this.energy -= this.stats.primaryEnergyCost;
    this.secondaryCooldown = ARENA.SECONDARY_WEAPON_DELAY;

    const snot = new Snot(this, enemy);
    snot.angle = this.angle;

    const spawnVec = this.getFullSpeedVec(25);
    snot.position = {
      x: this.position.x + spawnVec.x,
      y: this.position.y + spawnVec.y,
      z: this.position.z,
    };

    const speedVec = this.getFullSpeedVec(SNOT_CONFIG.speedMaxScaler);
    snot.accelVec = { ...speedVec };

    return snot;
  }

  updateEnergy(dt: number): void {
    if (this.primaryCooldown > 0) {
      this.primaryCooldown -= dt;
      if (this.primaryCooldown < 0) this.primaryCooldown = 0;
    }
    if (this.secondaryCooldown > 0) {
      this.secondaryCooldown -= dt;
      if (this.secondaryCooldown < 0) this.secondaryCooldown = 0;
    }
    this.energy += this.stats.primaryWeaponFillRate * dt;
    if (this.energy > 1) this.energy = 1;
  }

  addSnot(): void {
    this.snotCount += 1;
  }

  removeSnot(): void {
    this.snotCount -= 1;
  }

  getEffectiveMaxSpeed(): number {
    return this.stats.speedMaxScaler / (this.snotCount + 1);
  }

  getEffectiveRotSpeed(): number {
    return this.stats.rotationSpeed / (Math.floor(this.snotCount / 3) + 1);
  }

  resetForNewRound(spawnPosition: Vec3): void {
    this.health = 1;
    this.energy = 1;
    this.alive = true;
    this.position = { ...spawnPosition };
    this.previousPosition = { ...spawnPosition };
    this.accelVec = { x: 0, y: 0, z: 0 };
    this.primaryCooldown = 0;
    this.secondaryCooldown = 0;
    this.snotCount = 0;
    this.angle = 0;
    this.rollAngle = 0;
  }

  private moveToward(current: number, target: number, maxDelta: number): number {
    const diff = target - current;
    const step = Math.min(Math.abs(diff), maxDelta);
    if (diff > 0) return current + step;
    if (diff < 0) return current - step;
    return current;
  }
}
