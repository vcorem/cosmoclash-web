import { Entity } from '@/engine/Entity';
import { ARENA } from './Arena';

export interface CharacterStats {
  speedMaxScaler: number;
  acceleration: number;
  rotationSpeed: number;
}

export const GONDI_STATS: CharacterStats = {
  speedMaxScaler: 1.2,
  acceleration: 0.004,
  rotationSpeed: 0.5,
};

const ROLL_SCALER = 0.6;
const ROLL_MAX_ANGLE = 70;

export class Player extends Entity {
  readonly stats: CharacterStats;
  rollAngle: number = 0;
  private needRollReset: boolean = false;

  constructor(stats: CharacterStats) {
    super();
    this.stats = stats;
  }

  rotate(direction: 1 | -1, dt: number): void {
    const rotSpeed = this.stats.rotationSpeed;
    const delta = rotSpeed * (dt * ARENA.TIME_SCALER);

    this.angle += direction * delta;
    this.rollAngle += direction * ROLL_SCALER * delta;

    if (this.rollAngle > ROLL_MAX_ANGLE) this.rollAngle = ROLL_MAX_ANGLE;
    if (this.rollAngle < -ROLL_MAX_ANGLE) this.rollAngle = -ROLL_MAX_ANGLE;

    this.needRollReset = true;
    this.correctAngle();
  }

  resetRoll(dt: number): void {
    if (!this.needRollReset) {
      this.rollAngle = 0;
      return;
    }

    const rotSpeed = this.stats.rotationSpeed;
    const delta = ROLL_SCALER * rotSpeed * (dt * ARENA.TIME_SCALER);

    if (this.rollAngle < 0) {
      this.rollAngle += delta;
      if (this.rollAngle >= 0) {
        this.rollAngle = 0;
        this.needRollReset = false;
      }
    } else {
      this.rollAngle -= delta;
      if (this.rollAngle <= 0) {
        this.rollAngle = 0;
        this.needRollReset = false;
      }
    }
  }

  thrust(dt: number): void {
    const accelAdd = this.stats.acceleration * (dt * ARENA.TIME_SCALER);
    const fullSpeed = this.getFullSpeedVec(this.stats.speedMaxScaler);

    // Move accelVec toward fullSpeed without overshooting
    this.accelVec.x = this.moveToward(this.accelVec.x, fullSpeed.x, accelAdd);
    this.accelVec.y = this.moveToward(this.accelVec.y, fullSpeed.y, accelAdd);
  }

  private moveToward(current: number, target: number, maxDelta: number): number {
    const diff = target - current;
    const step = Math.min(Math.abs(diff), maxDelta);
    if (diff > 0) return current + step;
    if (diff < 0) return current - step;
    return current;
  }
}
