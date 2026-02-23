// src/ai/AIAttack.ts
// Ported from attack.lua — attack mode state machine with tactic cycling.

import { AIOutput } from './AIOutput';
import { PlayerTable } from './AIBridge';
import { TACTIC_TIMES } from './AIConstants';
import {
  AIContext,
  facingAndShooting,
  inDisadvantage,
  kamikazeAttack,
  uniqueTactic,
  sitOnTailAttack,
  stationaryAttack,
  inAndOut,
  turnAndShoot,
} from './AITactics';

export class AIAttackMode {
  private frameCounter = 0;
  private whichTactic = 11;
  private lastFrameLife = 1;
  private numOfTacticsPlayed = 1;

  /** Get the current attack tactic number (for learning AI logging). */
  getCurrentTactic(): number {
    return this.whichTactic;
  }

  update(
    ai: PlayerTable, user: PlayerTable,
    out: AIOutput, ctx: AIContext,
  ): void {
    // If AI just got hit or opponent facing+shooting → inDisadvantage
    if (ai.life < this.lastFrameLife || facingAndShooting(ai, user, ctx)) {
      ctx.inDisAdvantage = true;
      out.resetShots();
      inDisadvantage(ai, user, out, ctx);
      // Only update lastFrameLife after gaining speed
      if (ai.speed > ai.maxSpeed / 2) {
        this.lastFrameLife = ai.life;
      }
      return;
    }

    this.frameCounter++;
    // Every tacticTime frames, pick a new tactic
    if (this.frameCounter % ctx.tacticTime === 1) {
      this.numOfTacticsPlayed++;
      if (this.numOfTacticsPlayed % ctx.constants.rateOfLearningAI === 1) {
        // Use the learning AI's best attack tactic
        this.whichTactic = ctx.learning.attackMaxTactic;
      } else {
        // Random attack tactic 11-20
        this.whichTactic = Math.floor(Math.random() * 10) + 11;
      }
      out.resetShots();
      out.resetTurnAndThrust();
    }

    // Tactic dispatch (matching attack.lua lines 61-105)
    if (this.whichTactic === 11 || this.whichTactic === 12) {
      kamikazeAttack(ai, user, out, ctx);
      ctx.tacticTime = TACTIC_TIMES.kamikazeAttack;
    } else if (this.whichTactic === 13 || this.whichTactic === 14) {
      uniqueTactic(ai, user, out, ctx);
      ctx.tacticTime = TACTIC_TIMES.uniqueTactic;
    } else if (this.whichTactic === 15 || this.whichTactic === 16) {
      sitOnTailAttack(ai, user, out, ctx);
      ctx.tacticTime = TACTIC_TIMES.sitOnTailAttack;
    } else if (this.whichTactic === 17 || this.whichTactic === 18) {
      stationaryAttack(ai, user, out, ctx);
      ctx.tacticTime = TACTIC_TIMES.stationaryAttack;
    } else if (this.whichTactic === 19 || this.whichTactic === 20) {
      inAndOut(ai, user, out, ctx);
      ctx.tacticTime = TACTIC_TIMES.inAndOut;
    } else {
      // Fallback
      turnAndShoot(ai, user, out, ctx);
      ctx.tacticTime = TACTIC_TIMES.turnAndShoot;
    }
  }

  /** Reset state for a new round. */
  reset(): void {
    this.frameCounter = 0;
    this.whichTactic = 11;
    this.lastFrameLife = 1;
    this.numOfTacticsPlayed = 1;
  }
}
