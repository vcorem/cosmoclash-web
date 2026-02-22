import { Entity, Vec3 } from '@/engine/Entity';
import { ARENA } from './Arena';

/**
 * Apply the sun's gravitational pull to an entity.
 * Port of C++ CSceneMelee::ApplySunGravity.
 */
export function applySunGravity(entity: Entity, sunPos: Vec3, dt: number): void {
  const dx = sunPos.x - entity.position.x;
  const dy = sunPos.y - entity.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > ARENA.GRAVITY_RANGE) return;
  if (dist < 0.001) return; // at sun center — skip to avoid division by zero

  const nx = dx / dist;
  const ny = dy / dist;

  let force = ARENA.GRAVITY_CONSTANT / dist;
  if (force > ARENA.GRAVITY_MAX_FORCE) {
    force = ARENA.GRAVITY_MAX_FORCE;
  }

  const scale = force * dt * ARENA.TIME_SCALER;
  entity.accelVec.x += nx * scale;
  entity.accelVec.y += ny * scale;
}
