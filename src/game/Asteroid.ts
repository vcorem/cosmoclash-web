import { Entity, EntityType } from '@/engine/Entity';
import { ARENA } from './Arena';

export class Asteroid extends Entity {
  asteroidType: number;
  curXAngle: number;
  curYAngle: number;

  constructor(type: number) {
    super();
    this.entityType = EntityType.Asteroid;
    this.asteroidType = type;
    this.autoWrap = true;
    this.curXAngle = Math.random() * 360;
    this.curYAngle = Math.random() * 360;
    this.collisionSpheres = [
      { offset: { x: 0, y: 0, z: 0 }, radius: ARENA.ASTEROID_COLLISION_RADII[type] },
    ];
    // Set initial velocity in a random direction
    this.angle = Math.random() * 360;
    this.accelVec = this.getFullSpeedVec(ARENA.ASTEROID_SPEED_MAX_SCALER);
  }

  override update(dt: number): void {
    // Advance rotation
    this.curXAngle += dt * ARENA.ASTEROID_ROTATION_SPEED;
    if (this.curXAngle >= 360) this.curXAngle -= 360;
    this.curYAngle += dt * ARENA.ASTEROID_ROTATION_SPEED;
    if (this.curYAngle >= 360) this.curYAngle -= 360;

    // Physics (position += accelVec * dt * TIME_SCALER)
    super.update(dt);
  }

  reset(type: number): void {
    this.asteroidType = type;
    this.alive = true;
    this.health = 1;
    this.position = { x: 0, y: 0, z: 0 };
    this.previousPosition = { x: 0, y: 0, z: 0 };
    this.curXAngle = Math.random() * 360;
    this.curYAngle = Math.random() * 360;
    this.collisionSpheres = [
      { offset: { x: 0, y: 0, z: 0 }, radius: ARENA.ASTEROID_COLLISION_RADII[type] },
    ];
    this.angle = Math.random() * 360;
    this.accelVec = this.getFullSpeedVec(ARENA.ASTEROID_SPEED_MAX_SCALER);
  }
}
