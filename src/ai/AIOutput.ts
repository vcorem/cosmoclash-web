// src/ai/AIOutput.ts
// Mutable output accumulator that replaces the Lua side-effect calls
// (turnLeft, turnRight, playerThrust, fireWeapon1, fireWeapon2).
// Each frame, the AI sets flags on this object, then calls toPlayerInput().

import { PlayerInput } from '@/input/InputManager';

export class AIOutput {
  thrust = false;
  rotateLeft = false;
  rotateRight = false;
  firePrimary = false;
  fireSecondary = false;

  setThrust(on: boolean): void {
    this.thrust = on;
  }

  setTurnLeft(on: boolean): void {
    if (on) this.rotateRight = false;
    this.rotateLeft = on;
  }

  setTurnRight(on: boolean): void {
    if (on) this.rotateLeft = false;
    this.rotateRight = on;
  }

  setFirePrimary(on: boolean): void {
    this.firePrimary = on;
  }

  setFireSecondary(on: boolean): void {
    this.fireSecondary = on;
  }

  /** Matches Lua resetTurnAndThrust */
  resetTurnAndThrust(): void {
    this.thrust = false;
    this.rotateLeft = false;
    this.rotateRight = false;
  }

  /** Matches Lua resetTurn */
  resetTurn(): void {
    this.rotateLeft = false;
    this.rotateRight = false;
  }

  /** Matches Lua resetShots */
  resetShots(): void {
    this.firePrimary = false;
    this.fireSecondary = false;
  }

  /** Reset all outputs */
  reset(): void {
    this.thrust = false;
    this.rotateLeft = false;
    this.rotateRight = false;
    this.firePrimary = false;
    this.fireSecondary = false;
  }

  /** Convert to PlayerInput for the game loop */
  toPlayerInput(): PlayerInput {
    return {
      thrust: this.thrust,
      rotateLeft: this.rotateLeft,
      rotateRight: this.rotateRight,
      firePrimary: this.firePrimary,
      fireSecondary: this.fireSecondary,
    };
  }
}
