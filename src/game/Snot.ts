import { EntityType, Vec3 } from '@/engine/Entity';
import { Bullet, BulletConfig } from './Bullet';
import { Player } from './Player';
import { Entity } from '@/engine/Entity';
import { ARENA } from './Arena';

export const SNOT_CONFIG: BulletConfig = {
  speedMaxScaler: ARENA.SNOT_SPEED_MAX_SCALER,
  maxTtl: ARENA.SNOT_MAX_TTL,
  damage: ARENA.SNOT_DAMAGE,
  collisionRadius: ARENA.SNOT_COLLISION_RADIUS,
};

export class Snot extends Bullet {
  target: Player;
  attached: boolean = false;
  victim: Player | null = null;
  currentFrame: number = 0;
  private orbitOffset: Vec3 = { x: 0, y: 0, z: 0 };

  constructor(origin: Entity, target: Player) {
    super(SNOT_CONFIG, origin);
    this.entityType = EntityType.Snot;
    this.target = target;
  }

  attachTo(victim: Player): void {
    this.attached = true;
    this.victim = victim;
    this.ttl = this.config.maxTtl;

    // Initialize orbit offset: (0, -30, -30) rotated by two random angles
    const randXZ = Math.random() * 360 * (Math.PI / 180);
    const randXY = Math.random() * 360 * (Math.PI / 180);

    let ox = 0, oy = -30, oz = -30;

    // Rotate XZ by randXZ
    const cosXZ = Math.cos(randXZ);
    const sinXZ = Math.sin(randXZ);
    const nx = ox * cosXZ - oz * sinXZ;
    const nz = ox * sinXZ + oz * cosXZ;
    ox = nx; oz = nz;

    // Rotate XY by randXY
    const cosXY = Math.cos(randXY);
    const sinXY = Math.sin(randXY);
    const nx2 = ox * cosXY - oy * sinXY;
    const ny2 = ox * sinXY + oy * cosXY;
    ox = nx2; oy = ny2;

    this.orbitOffset = { x: ox, y: oy, z: oz };
  }

  override update(dt: number): void {
    // Animation
    this.currentFrame += ARENA.SNOT_ANIM_SPEED * dt;
    if (this.ttl > ARENA.SNOT_FADE_TTL_THRESHOLD) {
      if (this.currentFrame >= ARENA.SNOT_LOOP_END_FRAME) {
        this.currentFrame -= ARENA.SNOT_LOOP_END_FRAME;
      }
    } else {
      if (this.currentFrame > ARENA.SNOT_FADE_FRAME) {
        this.currentFrame = ARENA.SNOT_FADE_FRAME;
      }
    }

    if (this.attached && this.victim) {
      // Orbit: rotate offset on XZ and XY planes
      const rotSpeed = ARENA.SNOT_ORBIT_SPEED * dt;
      const cosR = Math.cos(rotSpeed);
      const sinR = Math.sin(rotSpeed);

      // Rotate XZ
      const ox = this.orbitOffset.x * cosR - this.orbitOffset.z * sinR;
      const oz = this.orbitOffset.x * sinR + this.orbitOffset.z * cosR;
      this.orbitOffset.x = ox;
      this.orbitOffset.z = oz;

      // Rotate XY
      const ox2 = this.orbitOffset.x * cosR - this.orbitOffset.y * sinR;
      const oy2 = this.orbitOffset.x * sinR + this.orbitOffset.y * cosR;
      this.orbitOffset.x = ox2;
      this.orbitOffset.y = oy2;

      // Follow victim
      this.position = {
        x: this.victim.position.x + this.orbitOffset.x,
        y: this.victim.position.y + this.orbitOffset.y,
        z: this.victim.position.z + this.orbitOffset.z,
      };

      // TTL countdown (no physics movement)
      this.ttl -= dt;
      if (this.ttl <= 0) {
        if (this.victim) {
          this.victim.removeSnot();
        }
        this.destroy();
      }
    } else {
      // Tracking: adjust angle toward target
      this.trackTarget();

      // Normal bullet update (physics + TTL)
      super.update(dt);
    }
  }

  private trackTarget(): void {
    const dx = this.target.position.x - this.position.x;
    const dy = this.target.position.y - this.position.y;

    const vecLen = Math.sqrt(dx * dx + dy * dy);
    if (vecLen < 0.001) return;

    const nx = dx / vecLen;
    const ny = dy / vecLen;

    // Dot product with up vector (0, 1, 0)
    const cosAlpha = ny;
    let angle = Math.acos(Math.max(-1, Math.min(1, cosAlpha)));
    angle = (angle * 180) / Math.PI;

    if (nx > 0) {
      angle = 360 - angle;
    }

    this.angle = angle;
    this.correctAngle();

    // Set velocity toward target
    const speedVec = this.getFullSpeedVec(this.config.speedMaxScaler);
    this.accelVec = { ...speedVec };
  }
}
