import { GameEventListener } from '@/engine/GameEventMgr';
import { GameEvent, GameEventType, BulletHitEvent, CollisionEvent } from '@/engine/GameEvent';
import { Bullet } from './Bullet';

const COLLISION_DAMAGE_SCALE = 0.2;

export class CollisionHandler implements GameEventListener {
  onGameEvent(event: GameEvent): void {
    if (event.type === GameEventType.BulletHit) {
      this.handleBulletHit(event as BulletHitEvent);
    } else if (event.type === GameEventType.Collision) {
      this.handleShipCollision(event as CollisionEvent);
    }
  }

  private handleBulletHit(event: BulletHitEvent): void {
    const bullet = event.bullet as Bullet;
    const target = event.target;

    target.health -= bullet.config.damage;
    bullet.destroy();

    if (target.health <= 0) {
      target.destroy();
    }
  }

  private handleShipCollision(event: CollisionEvent): void {
    const a = event.entityA;
    const b = event.entityB;

    const rvx = a.accelVec.x - b.accelVec.x;
    const rvy = a.accelVec.y - b.accelVec.y;
    const rvz = a.accelVec.z - b.accelVec.z;
    const relSpeed = Math.sqrt(rvx * rvx + rvy * rvy + rvz * rvz);
    const damage = Math.min(relSpeed * COLLISION_DAMAGE_SCALE, 0.3);

    a.health -= damage;
    b.health -= damage;

    if (a.health <= 0) a.destroy();
    if (b.health <= 0) b.destroy();

    const dx = b.position.x - a.position.x;
    const dy = b.position.y - a.position.y;
    const dz = b.position.z - a.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    const nz = dz / dist;

    const aSpeed = Math.sqrt(
      a.accelVec.x * a.accelVec.x +
      a.accelVec.y * a.accelVec.y +
      a.accelVec.z * a.accelVec.z,
    );
    const bSpeed = Math.sqrt(
      b.accelVec.x * b.accelVec.x +
      b.accelVec.y * b.accelVec.y +
      b.accelVec.z * b.accelVec.z,
    );

    a.accelVec = { x: -nx * aSpeed, y: -ny * aSpeed, z: -nz * aSpeed };
    b.accelVec = { x: nx * bSpeed, y: ny * bSpeed, z: nz * bSpeed };
  }
}
