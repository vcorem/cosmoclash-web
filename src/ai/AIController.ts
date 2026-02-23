// src/ai/AIController.ts
// Ported from turtle.lua — main AI controller that wires all modules together.
// Each frame, update() builds PlayerTables, runs the decision hierarchy,
// and returns a PlayerInput for the game loop.

import { PlayerInput } from '@/input/InputManager';
import { Player } from '@/game/Player';
import { Bullet } from '@/game/Bullet';
import { Snot } from '@/game/Snot';
import { EntityPool } from '@/engine/EntityPool';
import { DifficultyLevel, getDifficultyConstants } from './AIConstants';
import { buildPlayerTable, PlayerTable, getAIEntityType } from './AIBridge';
import { AIOutput } from './AIOutput';
import { AIAttackMode } from './AIAttack';
import { AIDefenseMode } from './AIDefense';
import { AILearning } from './AILog';
import { CharacterDef } from '@/game/CharacterRegistry';
import { ARENA } from '@/game/Arena';
import { getDistance } from './AICalc';
import {
  AIContext,
  onceMethod,
  stayAtADistanceFromSun,
  avoidBluePlasma,
  snotsStuckOnAIAction,
  avoidSnot,
  avoidIceSholev,
  shootWhenSnotsActive,
} from './AITactics';

export class AIController {
  private level: DifficultyLevel;
  private num = 0;
  private out = new AIOutput();
  private attackMode = new AIAttackMode();
  private defenseMode = new AIDefenseMode();
  private learning = new AILearning();
  private aiCharDef: CharacterDef;
  private userCharDef: CharacterDef;
  private ctx: AIContext;
  private lastAILife = 1;
  private lastUserLife = 1;

  constructor(level: DifficultyLevel, aiCharDef: CharacterDef, userCharDef: CharacterDef) {
    this.level = level;
    this.aiCharDef = aiCharDef;
    this.userCharDef = userCharDef;
    const constants = getDifficultyConstants(level);
    this.ctx = {
      num: 0,
      constants,
      sunTable: { x: ARENA.SUN_POSITION.x, y: ARENA.SUN_POSITION.y },
      out: this.out,
      learning: this.learning,
      level,
      tacticTime: 1000,
      inDisAdvantage: false,
      smallGitchiFlag: false,
      fireWeapon2Flag: false,
      thrustOnceFlag: false,
      energyFillFlag: false,
      cowardReadyFlag: false,
      inLowEnergyAttack: false,
      slowDownSunFlag: false,
      countShootTime: 0,
      readyToFire: true,
      rotAngle: 0,
      lastFrameCloseRange: 0,
      closeRangeCounter: 0,
      disAdvantageCounter: 0,
      randomAngle: 0,
      inAndOutdistance: constants.inAndOutdistance,
    };
  }

  update(
    dt: number,
    aiPlayer: Player,
    userPlayer: Player,
    bulletPool: EntityPool<Bullet>,
    snotPool: EntityPool<Snot>,
  ): PlayerInput {
    this.num++;
    this.ctx.num = this.num;

    // Skip first 5 frames (matches turtle.lua HandleFrame guard)
    if (this.num <= 5) {
      return this.out.toPlayerInput();
    }

    // Build player tables (init() from turtle.lua)
    const AI = buildPlayerTable(aiPlayer, userPlayer, this.aiCharDef, bulletPool, snotPool);
    const USER = buildPlayerTable(userPlayer, aiPlayer, this.userCharDef, bulletPool, snotPool);

    // onceMethod — handle one-shot flags from previous frame
    onceMethod(this.out, this.ctx);

    // expertLevel — update runtime-computed constants
    this.updateRuntimeConstants(AI);

    // Decision hierarchy from HandleFrame()
    if (getDistance(AI, this.ctx.sunTable) <= this.ctx.constants.distanceToStayAway) {
      stayAtADistanceFromSun(AI, this.ctx.sunTable, this.ctx.constants.distanceToStayAway, this.out, this.ctx);
    } else if (
      avoidBluePlasma(AI, USER, this.out, this.ctx) ||
      snotsStuckOnAIAction(AI, USER, this.out, this.ctx) ||
      avoidSnot(AI, USER, this.out, this.ctx) ||
      avoidIceSholev(AI, USER, this.out, this.ctx) ||
      shootWhenSnotsActive(AI, USER, this.out, this.ctx)
    ) {
      // One of the avoidance tactics activated — nothing else to do
    } else if (AI.life >= USER.life) {
      // Attack mode
      this.out.resetTurnAndThrust();
      this.out.resetShots();
      this.attackMode.update(AI, USER, this.out, this.ctx);
    } else {
      // Defense mode
      this.out.resetTurnAndThrust();
      this.out.resetShots();
      this.defenseMode.update(AI, USER, this.out, this.ctx);
    }

    // Learning AI — doLog equivalent from turtle.lua
    this.updateLearning(AI, USER);

    return this.out.toPlayerInput();
  }

  /** Update runtime-computed constants (matches turtle.lua expertLevel()). */
  private updateRuntimeConstants(ai: PlayerTable): void {
    // For levels 2 and 3, inAndOutdistance is derived from weapon range
    if (this.level === 2 || this.level === 3) {
      this.ctx.inAndOutdistance = ai.weapon1Distance - 100;
    }
  }

  /** Track hits/misses and update learning tables (matches turtle.lua doLog()). */
  private updateLearning(ai: PlayerTable, user: PlayerTable): void {
    const isAttackMode = ai.life >= user.life;
    const currentTactic = isAttackMode
      ? this.attackMode.getCurrentTactic()
      : this.defenseMode.getCurrentTactic();
    const mode = isAttackMode ? 'attack' : 'defense';

    // AI got hit — user scored on current tactic
    if (ai.life < this.lastAILife) {
      this.learning.updateTacticsTable(mode, currentTactic, false);
    }
    // User got hit — AI scored on current tactic
    if (user.life < this.lastUserLife) {
      this.learning.updateTacticsTable(mode, currentTactic, true);
    }

    this.lastAILife = ai.life;
    this.lastUserLife = user.life;
  }

  /** Reset for a new round. */
  reset(): void {
    this.num = 0;
    this.out.reset();
    this.attackMode.reset();
    this.defenseMode.reset();
    this.lastAILife = 1;
    this.lastUserLife = 1;
    this.ctx.num = 0;
    this.ctx.tacticTime = 1000;
    this.ctx.inDisAdvantage = false;
    this.ctx.smallGitchiFlag = false;
    this.ctx.fireWeapon2Flag = false;
    this.ctx.thrustOnceFlag = false;
    this.ctx.energyFillFlag = false;
    this.ctx.cowardReadyFlag = false;
    this.ctx.inLowEnergyAttack = false;
    this.ctx.slowDownSunFlag = false;
    this.ctx.countShootTime = 0;
    this.ctx.readyToFire = true;
    this.ctx.rotAngle = 0;
    this.ctx.lastFrameCloseRange = 0;
    this.ctx.closeRangeCounter = 0;
    this.ctx.disAdvantageCounter = 0;
    this.ctx.randomAngle = 0;
    this.ctx.inAndOutdistance = this.ctx.constants.inAndOutdistance;
  }
}
