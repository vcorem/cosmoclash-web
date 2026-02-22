import { ARENA } from '@/game/Arena';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CollisionSphere {
  offset: Vec3;
  radius: number;
}

export enum EntityType {
  Player,
  Bullet,
  Sun,
  Dummy,
  Snot,
  Explosion,
}

export class Entity {
  private static _nextId = 0;
  readonly id: number = Entity._nextId++;

  position: Vec3 = { x: 0, y: 0, z: 0 };
  previousPosition: Vec3 = { x: 0, y: 0, z: 0 };
  accelVec: Vec3 = { x: 0, y: 0, z: 0 };
  angle: number = 0;
  alive: boolean = true;
  autoWrap: boolean = true;
  health: number = 1;
  entityType: EntityType = EntityType.Player;
  collisionSpheres: CollisionSphere[] = [];

  update(dt: number): void {
    this.previousPosition = { ...this.position };
    const t = dt * ARENA.TIME_SCALER;
    this.position.x += this.accelVec.x * t;
    this.position.y += this.accelVec.y * t;
    this.position.z += this.accelVec.z * t;
  }

  correctAngle(): void {
    if (this.angle >= 360) {
      this.angle = this.angle - 360;
    }
    if (this.angle < 0) {
      this.angle = 360 + this.angle;
    }
  }

  handleWrapAround(camCenter: Vec3): void {
    if (!this.autoWrap) return;

    const dx = this.position.x - camCenter.x;
    const dy = this.position.y - camCenter.y;

    if (dx > ARENA.WRAP_X) {
      const overshoot = dx - ARENA.WRAP_X;
      this.position.x = camCenter.x - ARENA.WRAP_X + overshoot;
    } else if (dx < -ARENA.WRAP_X) {
      const overshoot = dx + ARENA.WRAP_X;
      this.position.x = camCenter.x + ARENA.WRAP_X + overshoot;
    }

    if (dy > ARENA.WRAP_Y) {
      const overshoot = dy - ARENA.WRAP_Y;
      this.position.y = camCenter.y - ARENA.WRAP_Y + overshoot;
    } else if (dy < -ARENA.WRAP_Y) {
      const overshoot = dy + ARENA.WRAP_Y;
      this.position.y = camCenter.y + ARENA.WRAP_Y + overshoot;
    }
  }

  getFullSpeedVec(speedScaler: number): Vec3 {
    const rad = this.angle * (Math.PI / 180);
    return {
      x: -Math.sin(rad) * speedScaler,
      y: Math.cos(rad) * speedScaler,
      z: 0,
    };
  }

  destroy(): void {
    this.alive = false;
  }
}
