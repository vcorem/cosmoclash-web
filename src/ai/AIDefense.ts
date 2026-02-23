// src/ai/AIDefense.ts
// Ported from defense.lua — defense mode state machine with tactic cycling.

import { AIOutput } from './AIOutput';
import { PlayerTable } from './AIBridge';
import { TACTIC_TIMES, AI_ENTITY_TYPES } from './AIConstants';
import {
  AIContext,
  facingAndShooting,
  inDisadvantage,
  closeRangeAttack,
  cowardFlying,
  lowEnergyAttack,
  zigzag,
  uniqueTactic,
  turnAndShoot,
} from './AITactics';

const MINIMUM_DISTANCE = 250;

export class AIDefenseMode {
  private frameCounter = 0;
  private whichTactic = 2;
  private lastFrameLife = 1;
  private numOfTacticsPlayed = 1;

  /** Get the current defense tactic number (for learning AI logging). */
  getCurrentTactic(): number {
    return this.whichTactic;
  }

  update(
    ai: PlayerTable, user: PlayerTable,
    out: AIOutput, ctx: AIContext,
  ): void {
    const dist = ai.distance;

    // Close range guard — unless Sholev + uniqueTactic
    if (
      dist < MINIMUM_DISTANCE &&
      !(ai.entityType === AI_ENTITY_TYPES.SHOLEV &&
        (this.whichTactic === 7 || this.whichTactic === 8))
    ) {
      closeRangeAttack(ai, user, out, ctx);
      return;
    }

    // If AI just got hit, or opponent facing+shooting, or still in disadvantage
    if (
      ai.life < this.lastFrameLife ||
      facingAndShooting(ai, user, ctx) ||
      ctx.inDisAdvantage
    ) {
      ctx.inDisAdvantage = true;
      out.resetShots();
      inDisadvantage(ai, user, out, ctx);
      if (ai.speed > ai.maxSpeed / 2) {
        this.lastFrameLife = ai.life;
      }
      return;
    }

    this.frameCounter++;
    if (this.frameCounter % ctx.tacticTime === 1) {
      this.numOfTacticsPlayed++;
      if (this.numOfTacticsPlayed % ctx.constants.rateOfLearningAI === 1) {
        this.whichTactic = ctx.learning.defenseMaxTactic;
      } else {
        // Random defense tactic 1-10
        this.whichTactic = Math.floor(Math.random() * 10) + 1;
      }
      out.resetShots();
      out.resetTurnAndThrust();
    }

    // Tactic dispatch (matching defense.lua lines 63-107)
    if (this.whichTactic === 1 || this.whichTactic === 2) {
      cowardFlying(ai, user, out, ctx);
      ctx.tacticTime = TACTIC_TIMES.cowardFlying;
    } else if (this.whichTactic === 3 || this.whichTactic === 4) {
      lowEnergyAttack(ai, user, out, ctx);
      ctx.tacticTime = TACTIC_TIMES.lowEnergyAttack;
    } else if (this.whichTactic === 5 || this.whichTactic === 6) {
      zigzag(ai, user, out, ctx);
      ctx.tacticTime = TACTIC_TIMES.zigzag;
    } else if (this.whichTactic === 7 || this.whichTactic === 8) {
      uniqueTactic(ai, user, out, ctx);
      ctx.tacticTime = TACTIC_TIMES.uniqueTactic;
    } else if (this.whichTactic === 9 || this.whichTactic === 10) {
      turnAndShoot(ai, user, out, ctx);
      ctx.tacticTime = TACTIC_TIMES.turnAndShoot;
    } else {
      // Fallback
      turnAndShoot(ai, user, out, ctx);
      ctx.tacticTime = TACTIC_TIMES.turnAndShoot;
    }
  }

  /** Reset state for a new round. */
  reset(): void {
    this.frameCounter = 0;
    this.whichTactic = 2;
    this.lastFrameLife = 1;
    this.numOfTacticsPlayed = 1;
  }
}
