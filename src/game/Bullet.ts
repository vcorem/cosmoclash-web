import { Entity, EntityType } from '@/engine/Entity';

export interface BulletConfig {
  speedMaxScaler: number;
  maxTtl: number;
  damage: number;
  collisionRadius: number;
  tracking?: boolean;
  expandingRadius?: { min: number; max: number };
  decayingDamage?: { initial: number };
}

export const FLAME_BULLET_CONFIG: BulletConfig = {
  speedMaxScaler: 0.3,
  maxTtl: 700,
  damage: 0.05,
  collisionRadius: 10,
};

export const PLASMA_BULLET_CONFIG: BulletConfig = {
  speedMaxScaler: 0.3,
  maxTtl: 10000,
  damage: 0.3,
  collisionRadius: 0,
  tracking: true,
  expandingRadius: { min: 0, max: 70 },
  decayingDamage: { initial: 0.3 },
};

export const SUN_BULLET_CONFIG: BulletConfig = {
  speedMaxScaler: 1.5,
  maxTtl: 1000,
  damage: 0.1,
  collisionRadius: 2,
};

export class Bullet extends Entity {
  config: BulletConfig;
  originEntity: Entity | null;
  ttl: number;
  trackingTarget: Entity | null = null;
  animFrame: number = 0;
  animSpeed: number = 0;

  constructor(config: BulletConfig, originEntity: Entity | null = null) {
    super();
    this.entityType = EntityType.Bullet;
    this.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: config.collisionRadius }];
    this.config = config;
    this.originEntity = originEntity;
    this.ttl = config.maxTtl;
  }

  reset(config: BulletConfig, originEntity: Entity | null): void {
    this.config = config;
    this.originEntity = originEntity;
    this.ttl = config.maxTtl;
    this.alive = true;
    this.position = { x: 0, y: 0, z: 0 };
    this.previousPosition = { x: 0, y: 0, z: 0 };
    this.accelVec = { x: 0, y: 0, z: 0 };
    this.angle = 0;
    this.health = 1;
    this.trackingTarget = null;
    this.animFrame = 0;
    this.animSpeed = 0;
    this.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: config.collisionRadius }];
  }

  getCurrentDamage(): number {
    if (this.config.decayingDamage) {
      const ratio = Math.max(this.ttl, 0) / this.config.maxTtl;
      return ratio * this.config.decayingDamage.initial;
    }
    return this.config.damage;
  }

  update(dt: number): void {
    if (this.config.tracking && this.trackingTarget && this.trackingTarget.alive) {
      const speed = Math.sqrt(
        this.accelVec.x * this.accelVec.x + this.accelVec.y * this.accelVec.y,
      );
      if (speed > 0.001) {
        const dx = this.trackingTarget.position.x - this.position.x;
        const dy = this.trackingTarget.position.y - this.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.001) {
          const tx = dx / dist;
          const ty = dy / dist;
          const cx = this.accelVec.x / speed;
          const cy = this.accelVec.y / speed;
          const steerFactor = 0.02;
          const nx = cx + (tx - cx) * steerFactor;
          const ny = cy + (ty - cy) * steerFactor;
          const nl = Math.sqrt(nx * nx + ny * ny);
          this.accelVec.x = (nx / nl) * speed;
          this.accelVec.y = (ny / nl) * speed;
        }
      }
    }

    super.update(dt);
    this.ttl -= dt;

    if (this.config.expandingRadius) {
      const { min, max } = this.config.expandingRadius;
      const elapsed = this.config.maxTtl - this.ttl;
      const ratio = Math.min(elapsed / this.config.maxTtl, 1);
      this.collisionSpheres[0].radius = min + ratio * (max - min);
    }

    if (this.ttl <= 0) {
      this.destroy();
    }
  }
}
