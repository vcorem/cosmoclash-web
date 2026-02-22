import { Entity } from '@/engine/Entity';

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
  readonly config: BulletConfig;
  originEntity: Entity | null;
  ttl: number;

  constructor(config: BulletConfig, originEntity: Entity | null = null) {
    super();
    this.config = config;
    this.originEntity = originEntity;
    this.ttl = config.maxTtl;
  }

  update(dt: number): void {
    super.update(dt);
    this.ttl -= dt;
    if (this.ttl <= 0) {
      this.destroy();
    }
  }
}
