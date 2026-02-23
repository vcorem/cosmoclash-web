import { Player, CharacterStats } from './Player';
import { PLASMA_BULLET_CONFIG, SUN_BULLET_CONFIG } from './Bullet';
import { Snot } from './Snot';
import { Vec3 } from '@/engine/Entity';

export enum MorphState {
  MICHI = 0,
  MICHI_TO_GICHI = 1,
  GICHI = 2,
  GICHI_TO_MICHI = 3,
}

export const MICHI_STATS: CharacterStats = {
  speedMaxScaler: 0.2,
  acceleration: 0.002,
  rotationSpeed: 0.3,
  primaryEnergyCost: 0.24,
  primaryWeaponDelay: 100,
  primaryWeaponFillRate: 0.0002,
  primaryBulletConfig: PLASMA_BULLET_CONFIG,
};

export const GICHI_STATS: CharacterStats = {
  speedMaxScaler: 1.0,
  acceleration: 0.002,
  rotationSpeed: 0.5,
  primaryEnergyCost: 0.08,
  primaryWeaponDelay: 100,
  primaryWeaponFillRate: 0.0002,
  primaryBulletConfig: SUN_BULLET_CONFIG,
};

const MORPH_FRAME_DELAY = 20;
const MORPH_START_FRAME = 1;
const MORPH_END_FRAME = 41;

export class MichiGichiPlayer extends Player {
  morphState: MorphState = MorphState.MICHI;
  currentAnimFrame: number = MORPH_START_FRAME;
  private morphFrameTimer: number = 0;

  constructor() {
    super(MICHI_STATS);
    this.collisionSpheres = [
      { offset: { x: 0, y: -10, z: 0 }, radius: 14 },
      { offset: { x: 0, y: 10, z: 0 }, radius: 14 },
    ];
  }

  triggerMorph(): void {
    if (this.morphState === MorphState.MICHI) {
      this.morphState = MorphState.MICHI_TO_GICHI;
      this.morphFrameTimer = 0;
    } else if (this.morphState === MorphState.GICHI) {
      this.morphState = MorphState.GICHI_TO_MICHI;
      this.morphFrameTimer = 0;
    }
  }

  updateMorph(dt: number): void {
    if (
      this.morphState !== MorphState.MICHI_TO_GICHI &&
      this.morphState !== MorphState.GICHI_TO_MICHI
    ) {
      return;
    }

    this.morphFrameTimer += dt;

    while (this.morphFrameTimer >= MORPH_FRAME_DELAY) {
      this.morphFrameTimer -= MORPH_FRAME_DELAY;

      if (this.morphState === MorphState.MICHI_TO_GICHI) {
        this.currentAnimFrame++;
        if (this.currentAnimFrame >= MORPH_END_FRAME) {
          this.currentAnimFrame = MORPH_END_FRAME;
          this.morphState = MorphState.GICHI;
          this.applyStats(GICHI_STATS);
          break;
        }
      } else if (this.morphState === MorphState.GICHI_TO_MICHI) {
        this.currentAnimFrame--;
        if (this.currentAnimFrame <= MORPH_START_FRAME) {
          this.currentAnimFrame = MORPH_START_FRAME;
          this.morphState = MorphState.MICHI;
          this.applyStats(MICHI_STATS);
          break;
        }
      }
    }
  }

  applyStats(newStats: CharacterStats): void {
    this.stats = newStats;
  }

  override fireSecondary(_enemy: Player): Snot | null {
    return null;
  }

  override resetForNewRound(spawnPosition: Vec3): void {
    super.resetForNewRound(spawnPosition);
    this.morphState = MorphState.MICHI;
    this.currentAnimFrame = MORPH_START_FRAME;
    this.morphFrameTimer = 0;
    this.applyStats(MICHI_STATS);
    this.collisionSpheres = [
      { offset: { x: 0, y: -10, z: 0 }, radius: 14 },
      { offset: { x: 0, y: 10, z: 0 }, radius: 14 },
    ];
  }
}
