import { Entity, EntityType } from '@/engine/Entity';

export interface BulletConfig {
  speedMaxScaler: number;
  maxTtl: number;
  damage: number;
  collisionRadius: number;
}

export const FLAME_BULLET_CONFIG: BulletConfig = {
  speedMaxScaler: 0.3,
  maxTtl: 700,
  damage: 0.05,
  collisionRadius: 10,
};

export class Bullet extends Entity {
  config: BulletConfig;
  originEntity: Entity | null;
  ttl: number;

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
    this.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: config.collisionRadius }];
  }

  update(dt: number): void {
    super.update(dt);
    this.ttl -= dt;
    if (this.ttl <= 0) {
      this.destroy();
    }
  }
}
