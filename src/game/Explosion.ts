import { Entity, EntityType } from '@/engine/Entity';
import { ARENA } from './Arena';

export class Explosion extends Entity {
  currentFrame: number = 0;

  constructor() {
    super();
    this.entityType = EntityType.Explosion;
    this.collisionSpheres = [];
    this.autoWrap = true;
  }

  override update(dt: number): void {
    // No physics — explosion stays in place
    this.currentFrame += ARENA.EXPLOSION_ANIM_SPEED * dt;
    if (this.currentFrame > ARENA.EXPLOSION_TOTAL_FRAMES) {
      this.destroy();
    }
  }

  reset(): void {
    this.currentFrame = 0;
    this.alive = true;
    this.position = { x: 0, y: 0, z: 0 };
    this.accelVec = { x: 0, y: 0, z: 0 };
  }
}
