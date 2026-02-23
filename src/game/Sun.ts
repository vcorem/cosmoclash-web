import { Entity, EntityType } from '@/engine/Entity';
import { ARENA } from './Arena';

const NUM_SUN_FRAMES = 60;

export class Sun extends Entity {
  currentFrame: number = 0;
  readonly animSpeed: number = 0.025;

  constructor() {
    super();
    this.entityType = EntityType.Sun;
    this.autoWrap = true;
    this.position = { ...ARENA.SUN_POSITION };
    this.previousPosition = { ...ARENA.SUN_POSITION };
    this.collisionSpheres = [
      { offset: { x: 0, y: 0, z: 0 }, radius: ARENA.SUN_COLLISION_RADIUS },
    ];
  }

  override update(_dt: number): void {
    // Sun is fixed — no movement
  }

  updateAnimation(dt: number): void {
    this.currentFrame += this.animSpeed * dt;
    if (this.currentFrame >= NUM_SUN_FRAMES) {
      this.currentFrame -= NUM_SUN_FRAMES;
    }
  }
}
