# M11: AI Opponent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port the original 9-file Lua AI system to TypeScript as an exact translation, producing `PlayerInput` for Player 2.

**Architecture:** `AIController` class holds all per-frame mutable state (frame counter, tactic selection, learning tables, flags). Each frame it reads game state from entities, runs the decision hierarchy, and outputs a `PlayerInput`. The AI files map 1:1 to the original Lua files.

**Tech Stack:** TypeScript, Vitest for tests

**Original Lua files reference:** `/Users/ori/Documents/CosmoClash/turtle_svn/trunk/Turtle/AI/`

---

## Important Notes for the Implementer

- **The original Lua AI runs per-frame**. Our game loop passes `dt` in milliseconds. The Lua frame counter (`num`) increments once per render frame (~16.67ms at 60fps). In our port, increment `num` by 1 each call (since our game loop already handles dt). Tactic durations are in "frame" units where 1 frame = 1 call to `aiController.update()`.
- **All entity positions, velocities, angles come from the existing Player/Entity/Bullet/Snot classes**. No new C++ bridge needed — we read TypeScript objects directly.
- **The AI outputs `PlayerInput`** — same interface used by `InputManager.player()`. The existing `updatePlayerInput()` in main.ts processes it identically for human and AI.
- **Character type detection**: Use `player instanceof MichiGichiPlayer` for MITCHIGITCHI, check `charDef.id` for 'gondi' vs others. We need to add an `entityName` field or use the existing `CharacterDef` reference.
- **Angle convention**: The original Lua `getAngle()` does `(-pzy_entangle(player)+360)%360`. Our Entity.angle already stores 0-360 (corrected by `correctAngle()`). The Lua `pzy_entangle` returns the raw C++ angle. We need to verify our angle matches. In our Entity, `angle` is already in the same coordinate system (0=north, increases clockwise when viewed in 2D).
- **Velocity vectors**: The original `pzy_entvec()` returns `accel_vector × time_scaler`. In our codebase, `entity.accelVec` is the raw velocity vector (before time scaler multiplication). The AI should use `accelVec.x * ARENA.TIME_SCALER` and `accelVec.y * ARENA.TIME_SCALER` to match the Lua `dxVector`/`dyVector`.

---

### Task 1: AIConstants — Difficulty level constants

**Files:**
- Create: `src/ai/AIConstants.ts`
- Test: `src/ai/__tests__/AIConstants.test.ts`

Port all constants from `turtle.lua:expertLevel()`. This is a pure data module with no logic dependencies.

**Step 1: Write the test**

```typescript
// src/ai/__tests__/AIConstants.test.ts
import { describe, it, expect } from 'vitest';
import { getDifficultyConstants, DifficultyLevel } from '../AIConstants';

describe('AIConstants', () => {
  it('returns beginner constants for level 1', () => {
    const c = getDifficultyConstants(1);
    expect(c.distanceToAvoidPlasma).toBe(50);
    expect(c.goodAimProbability).toBe(0.4);
    expect(c.DEFAULT_SHOOT_INETRVAL).toBe(100);
    expect(c.KAMIKAZE_CLOSE_DIS).toBe(200);
    expect(c.rateOfLearningAI).toBe(6);
  });

  it('returns medium constants for level 2', () => {
    const c = getDifficultyConstants(2);
    expect(c.distanceToAvoidPlasma).toBe(175);
    expect(c.goodAimProbability).toBe(0.7);
    expect(c.DEFAULT_SHOOT_INETRVAL).toBe(50);
    expect(c.rateOfLearningAI).toBe(5);
  });

  it('returns expert constants for level 3', () => {
    const c = getDifficultyConstants(3);
    expect(c.distanceToAvoidPlasma).toBe(250);
    expect(c.goodAimProbability).toBe(1.0);
    expect(c.DEFAULT_SHOOT_INETRVAL).toBe(25);
    expect(c.rateOfLearningAI).toBe(4);
  });
});
```

**Step 2: Run test — expect FAIL**

Run: `npx vitest run src/ai/__tests__/AIConstants.test.ts`

**Step 3: Implement**

```typescript
// src/ai/AIConstants.ts
export type DifficultyLevel = 1 | 2 | 3;

export interface AILevelConstants {
  distanceToAvoidPlasma: number;
  distanceToAvoidSnot: number;
  distanceToStayAway: number;
  distanceSholevToFreezeAim: number;
  distanceToAvoidSholevIce: number;
  BELOW_MAX_SPEED_TO_SHOOT: number;
  goodAimProbability: number;
  minEnergyLevel: number;
  resumeEnergyLevel: number;
  rateOfLearningAI: number;
  inAndOutdistance: number; // Level 1 uses fixed 100; levels 2-3 use weapon1Distance-based
  holdingDistanceBeforeFly: number;
  KAMIKAZE_CLOSE_DIS: number;
  SIT_ON_TAIL_DIS: number;
  DEFAULT_SHOOT_TIME: number;
  DEFAULT_SHOOT_INETRVAL: number; // intentional misspelling from original
  DEFAULT_TIME_TO_REST: number;
}

// Note: inAndOutdistance for levels 2-3 depends on weapon1Distance,
// which is computed at runtime. The base constants provide defaults.
export function getDifficultyConstants(level: DifficultyLevel): AILevelConstants {
  if (level === 1) {
    return {
      distanceToAvoidPlasma: 50,
      distanceToAvoidSnot: 50,
      distanceToStayAway: 150,
      distanceSholevToFreezeAim: 200,
      distanceToAvoidSholevIce: 300,
      BELOW_MAX_SPEED_TO_SHOOT: 0.05,
      goodAimProbability: 0.4,
      minEnergyLevel: 0.01,
      resumeEnergyLevel: 0.8,
      rateOfLearningAI: 6,
      inAndOutdistance: 100,
      holdingDistanceBeforeFly: 400,
      KAMIKAZE_CLOSE_DIS: 200,
      SIT_ON_TAIL_DIS: 400,
      DEFAULT_SHOOT_TIME: 1000,
      DEFAULT_SHOOT_INETRVAL: 100,
      DEFAULT_TIME_TO_REST: 500,
    };
  } else if (level === 2) {
    return {
      distanceToAvoidPlasma: 175,
      distanceToAvoidSnot: 100,
      distanceToStayAway: 300,
      distanceSholevToFreezeAim: 100,
      distanceToAvoidSholevIce: 400,
      BELOW_MAX_SPEED_TO_SHOOT: 0.06,
      goodAimProbability: 0.7,
      minEnergyLevel: 0.01,
      resumeEnergyLevel: 0.5,
      rateOfLearningAI: 5,
      inAndOutdistance: 0, // computed at runtime: weapon1Distance - weapon1Distance/6
      holdingDistanceBeforeFly: 450,
      KAMIKAZE_CLOSE_DIS: 150,
      SIT_ON_TAIL_DIS: 300,
      DEFAULT_SHOOT_TIME: 1000,
      DEFAULT_SHOOT_INETRVAL: 50,
      DEFAULT_TIME_TO_REST: 250,
    };
  } else {
    return {
      distanceToAvoidPlasma: 250,
      distanceToAvoidSnot: 150,
      distanceToStayAway: 350,
      distanceSholevToFreezeAim: 50,
      distanceToAvoidSholevIce: 500,
      BELOW_MAX_SPEED_TO_SHOOT: 0.069,
      goodAimProbability: 1.0,
      minEnergyLevel: 0.01,
      resumeEnergyLevel: 0.4,
      rateOfLearningAI: 4,
      inAndOutdistance: 0, // computed at runtime: weapon1Distance - weapon1Distance/7
      holdingDistanceBeforeFly: 500,
      KAMIKAZE_CLOSE_DIS: 100,
      SIT_ON_TAIL_DIS: 200,
      DEFAULT_SHOOT_TIME: 1000,
      DEFAULT_SHOOT_INETRVAL: 25,
      DEFAULT_TIME_TO_REST: 100,
    };
  }
}

// Tactic time constants (in frames) from Tactics.lua
export const TACTIC_TIMES = {
  DEFAULT_TIME_FOR_TACTICS: 1000,
  simpleAttack: 1000,
  sitOnTailAttack: 2000,
  kamikazeAttack: 1500,
  stationaryAttack: 1000,
  superFastAndShoot: 1000,
  zigzag: 500,
  turnAndShoot: 3000,
  uniqueTactic: 1000,
  cowardFlying: 4000,
  lowEnergyAttack: 2000,
  inAndOut: 2000,
} as const;

// Entity type constants matching original Lua
export const AI_ENTITY_TYPES = {
  MITCHIGITCHI: 1,
  GONDI: 4,
  SHOLEV: 8,
  PLASMA: 14,
  SNOT: 16,
} as const;
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add src/ai/AIConstants.ts src/ai/__tests__/AIConstants.test.ts
git commit -m "feat(ai): add difficulty level constants from original turtle.lua"
```

---

### Task 2: AIBridge — Entity type detection and state query helpers

**Files:**
- Create: `src/ai/AIBridge.ts`
- Test: `src/ai/__tests__/AIBridge.test.ts`

Port `Pzy_Methods.lua` entity type constants and query wrappers. This maps between our TypeScript entity types and the original Lua entity type numbers. Also provides the `PlayerTable` interface that mirrors the Lua player tables.

**Step 1: Write the test**

Test entity type detection, `getSpeedOfShot()`, `getMaxTtlOfShot()`, `getMaxDistanceOfShot()`, bullet speed/TTL lookups per character type.

**Step 2: Run test — expect FAIL**

**Step 3: Implement**

Key types and functions:
- `AIEntityType` enum matching original Lua constants
- `getAIEntityType(player, charDef)` — returns the Lua-equivalent entity type number
- `PlayerTable` interface — mirrors Lua player tables (x, y, angle, speed, distance, dxVector, dyVector, etc.)
- `buildPlayerTable(player, opponent, sun, charDef, activeBullets, activeSnots)` — populates a PlayerTable from live game state
- `getSpeedOfShot(entityType, morphState?)` — bullet speed per character (from `Pzy_Methods.lua:239-254`)
- `getMaxTtlOfShot(entityType, morphState?)` — bullet TTL per character (from `Pzy_Methods.lua:262-277`)
- `getMaxDistanceOfShot(entityType, morphState?)` — `maxTtl * speedOfShot`
- `SunTable` interface — `{ x, y }`

Important: `dxVector` and `dyVector` in Lua are `accelVec * TIME_SCALER`. Port this: `player.accelVec.x * ARENA.TIME_SCALER`.

The original `getAngle()` does `(-pzy_entangle(player)+360)%360`. Our angle is already 0-360. Verify both conventions match.

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add src/ai/AIBridge.ts src/ai/__tests__/AIBridge.test.ts
git commit -m "feat(ai): add AIBridge entity type detection and state queries"
```

---

### Task 3: AICalc — Math and geometry functions

**Files:**
- Create: `src/ai/AICalc.ts`
- Test: `src/ai/__tests__/AICalc.test.ts`

Port `calc_Methods.lua` — pure math functions. This is the largest utility module. Functions have no side effects (they compute and return values) EXCEPT for `turnToAngle`, `slowDown`, `stayAtADistance*`, `fire`, etc. which mutate AI output state.

Since the AI produces `PlayerInput`, we need an intermediate representation. The AI should set flags on a mutable `AIOutput` object during its decision-making, then convert to `PlayerInput` at the end.

**Step 1: Write tests**

Test these pure math functions with known inputs/outputs:
- `getDistance(table1, table2)` — Euclidean distance
- `getVectorSize(x1, y1, x2, y2)` — vector magnitude
- `getAngleToPlayer(toTable, fromTable)` — angle calculation using `getAngleBetweenTwoVectors`
- `getAngleBetweenTwoVectors(v1, v2)` — core angle math with the `x<0` correction
- `getVVAngle(playerTable)` — velocity vector angle
- `goodAim(computer, user, probability)` — predictive aiming
- `realIsInRange(computer, user)` — range check
- `turnToAngle(currentAngle, desiredAngle)` — returns `{ rotateLeft, rotateRight, reached }`

**Step 2: Run test — expect FAIL**

**Step 3: Implement**

Port each function from `calc_Methods.lua`. Key functions:

```typescript
// Pure distance/angle math (no side effects)
export function getDistance(a: {x: number, y: number}, b: {x: number, y: number}): number
export function getVectorSize(x1: number, y1: number, x2: number, y2: number): number
export function getAngleBetweenTwoVectors(v1: Vec2WithSize, v2: Vec2WithSize): number
export function getAngleToXY(x: number, y: number, fromX: number, fromY: number): number
export function getVVAngle(dxVector: number, dyVector: number): number
export function goodAim(computer: PlayerTable, user: PlayerTable, probability: number): number
export function realIsInRange(computer: PlayerTable, user: PlayerTable): boolean
export function isInFutureRange(computer: PlayerTable, user: PlayerTable, numFrames: number): boolean

// These return rotation decisions (not side-effectful)
export function turnToAngleDecision(currentAngle: number, desiredAngle: number): { left: boolean; right: boolean; reached: boolean }
```

The key insight: `getAngleBetweenTwoVectors` uses `acos(dot/mag)` and corrects for `x<0` by doing `360 - angle`. This matches our coordinate system.

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add src/ai/AICalc.ts src/ai/__tests__/AICalc.test.ts
git commit -m "feat(ai): add AICalc math/geometry from calc_Methods.lua"
```

---

### Task 4: AILog — Learning tables

**Files:**
- Create: `src/ai/AILog.ts`
- Test: `src/ai/__tests__/AILog.test.ts`

Port `AiLog.lua` — the learning AI system. Tracks which tactic is most effective.

**Step 1: Write the test**

Test `updateTacticsTable()` and max tactic tracking.

**Step 2: Implement**

```typescript
export class AILearning {
  hittingInAttackTable: number[] = new Array(21).fill(0);
  hittingInDefenseTable: number[] = new Array(21).fill(0);
  gotHitInAttackTable: number[] = new Array(21).fill(0);
  gotHitInDefenseTable: number[] = new Array(21).fill(0);

  attackMaxTactic = 0;
  attackMax = 0;
  defenseMaxTactic = 0;
  defenseMax = 0;

  updateTacticsTable(mode: 'attack' | 'defense', tactic: number, aiHit: boolean): void { ... }
}
```

Exact port of the 4 tables + maxTactic tracking from `AiLog.lua:30-60`.

**Step 3: Run test — expect PASS**

**Step 4: Commit**

```bash
git add src/ai/AILog.ts src/ai/__tests__/AILog.test.ts
git commit -m "feat(ai): add learning AI tables from AiLog.lua"
```

---

### Task 5: AIOutput — Mutable output accumulator

**Files:**
- Create: `src/ai/AIOutput.ts`

The original Lua AI calls `turnLeft()`, `turnRight()`, `playerThrust()`, `fireWeapon1()`, `fireWeapon2()` as side effects during decision-making. In our port, we accumulate these into a mutable object, then convert to `PlayerInput` at the end.

```typescript
import { PlayerInput } from '@/input/InputManager';

export class AIOutput {
  thrust = false;
  rotateLeft = false;
  rotateRight = false;
  firePrimary = false;
  fireSecondary = false;

  // Mirrors Lua flag behavior: setting true activates, false deactivates
  setThrust(on: boolean): void { this.thrust = on; }
  setTurnLeft(on: boolean): void { if (on) { this.rotateRight = false; } this.rotateLeft = on; }
  setTurnRight(on: boolean): void { if (on) { this.rotateLeft = false; } this.rotateRight = on; }
  setFirePrimary(on: boolean): void { this.firePrimary = on; }
  setFireSecondary(on: boolean): void { this.fireSecondary = on; }

  // Matches Lua resetTurnAndThrust
  resetTurnAndThrust(): void { this.thrust = false; this.rotateLeft = false; this.rotateRight = false; }
  resetTurn(): void { this.rotateLeft = false; this.rotateRight = false; }
  resetShots(): void { this.firePrimary = false; this.fireSecondary = false; }
  reset(): void { this.thrust = false; this.rotateLeft = false; this.rotateRight = false; this.firePrimary = false; this.fireSecondary = false; }

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
```

No test needed for this simple accumulator.

**Step 1: Write the file**

**Step 2: Commit**

```bash
git add src/ai/AIOutput.ts
git commit -m "feat(ai): add AIOutput mutable accumulator"
```

---

### Task 6: AITactics — All 16 tactics with per-character branches

**Files:**
- Create: `src/ai/AITactics.ts`
- Test: `src/ai/__tests__/AITactics.test.ts`

Port `Tactics.lua` — all 16 tactics. This is the largest file. Each tactic is a function that reads `PlayerTable` state and mutates `AIOutput`.

**Step 1: Write tests for a few key tactics**

Test `kamikazeAttack`, `cowardFlying`, `inDisadvantage`, `avoidBluePlasma` with mock player tables.

**Step 2: Implement all tactics**

Each tactic function has the signature:
```typescript
function tacticName(
  ai: PlayerTable,
  user: PlayerTable,
  out: AIOutput,
  ctx: AIContext  // holds frame counter, constants, flags, sunTable
): boolean | void
```

Port these tactics exactly from `Tactics.lua`:
1. `superFastAndShoot` (lines 44-127) — per-character: MG, Gondi, Sholev, others
2. `zigzag` (lines 132-190) — per-character
3. `turnAndShoot` (lines 195-281) — per-character
4. `avoidBluePlasma` (lines 285-301) — MG plasma dodge
5. `avoidSnot` (lines 304-315) — Gondi snot dodge
6. `avoidIceSholev` (lines 319-353) — Sholev ice dodge
7. `shootWhenSnotsActive` (lines 357-388) — Gondi snot exploitation
8. `zigZagShoot` (lines 393-523) — per-character
9. `uniqueTactic` (lines 527-590) — per-character power play
10. `snotsStuckOnAIAction` (lines 593-660) — when AI has snots
11. `cowardFlying` (lines 665-709) — conservative retreat
12. `lowEnergyAttack` (lines 714-750) — counter-attack
13. `closeRangeAttack` (lines 753-778) — emergency melee
14. `inDisadvantage` (lines 782-803) — evasion
15. `inAndOut` (lines 808-827) — hit-and-run
16. `stationaryAttack` (lines 833-847) — static defense
17. `kamikazeAttack` (lines 853-886) — all-in charge
18. `sitOnTailAttack` (lines 890-914) — pursuit

Also port helper functions used by tactics:
- `turnToAngle` — calls `out.setTurnLeft/Right` based on `turnToAngleDecision`
- `turnAwayFromOp` — `turnToAngle(angle + 180)`
- `slowDown` — complex deceleration with sun check
- `stayAtADistance`, `stayAtADistanceFromSun`, `stayAtADistanceFromEntity`
- `flyToPoint`, `flyToPointNStop`, `flyInCircle`
- `fire` — burst pattern state machine
- `fireWeapon1Energy`, `fireWeapon2Energy` — energy-aware firing
- `facingAndShooting` — detection helper
- `getClosestPlasma`, `getClosestSnot`, `isActiveIceShield`, `getNumberOfSnotsStuck`
- `goodAim` call through from AICalc
- `isInRange` / `realIsInRange` call through from AICalc
- `playerThrustSpeed` — throttled thrust

**Step 3: Run tests — expect PASS**

**Step 4: Commit**

```bash
git add src/ai/AITactics.ts src/ai/__tests__/AITactics.test.ts
git commit -m "feat(ai): add all 16 tactics from Tactics.lua with per-character branches"
```

---

### Task 7: AIAttack — Attack mode dispatcher

**Files:**
- Create: `src/ai/AIAttack.ts`
- Test: `src/ai/__tests__/AIAttack.test.ts`

Port `attack.lua` — the attack mode state machine.

**Step 1: Write test**

Test tactic cycling, learning AI selection, interruption on hit.

**Step 2: Implement**

```typescript
export class AIAttackMode {
  private frameCounter = 0;
  private whichTactic = 11;
  private lastFrameLife = 1;
  private numOfTacticsPlayed = 1;

  update(ai: PlayerTable, user: PlayerTable, out: AIOutput, ctx: AIContext): void {
    // If AI just got hit or opponent facing+shooting → inDisadvantage
    if (ai.life < this.lastFrameLife || facingAndShooting(ai, user)) {
      ctx.inDisAdvantage = true;
      out.resetShots();
      inDisadvantage(ai, user, out, ctx);
      if (ai.speed > ai.maxSpeed / 2) this.lastFrameLife = ai.life;
      return;
    }

    this.frameCounter++;
    if (this.frameCounter % ctx.tacticTime === 1) {
      this.numOfTacticsPlayed++;
      if (this.numOfTacticsPlayed % ctx.constants.rateOfLearningAI === 1) {
        this.whichTactic = ctx.learning.attackMaxTactic;
      } else {
        this.whichTactic = Math.floor(Math.random() * 10) + 11;
      }
      out.resetShots();
      out.resetTurnAndThrust();
    }

    // Tactic dispatch: 11-12=kamikaze, 13-14=unique, 15-16=sitOnTail, 17-18=stationary, 19-20=inAndOut
    // (exact mapping from attack.lua lines 61-105)
    this.dispatchTactic(ai, user, out, ctx);
  }
}
```

**Step 3: Run test — expect PASS**

**Step 4: Commit**

```bash
git add src/ai/AIAttack.ts src/ai/__tests__/AIAttack.test.ts
git commit -m "feat(ai): add attack mode dispatcher from attack.lua"
```

---

### Task 8: AIDefense — Defense mode dispatcher

**Files:**
- Create: `src/ai/AIDefense.ts`
- Test: `src/ai/__tests__/AIDefense.test.ts`

Port `defense.lua` — defense mode state machine.

**Step 1: Write test**

Test close range detection, interruption, tactic cycling.

**Step 2: Implement**

Same pattern as AIAttack but with defense tactics 1-10:
- 1-2: cowardFlying
- 3-4: lowEnergyAttack
- 5-6: zigzag
- 7-8: uniqueTactic
- 9-10: turnAndShoot

Include the close-range guard: `if distance < 250 and not (Sholev + uniqueTactic)` → closeRangeAttack.

**Step 3: Run test — expect PASS**

**Step 4: Commit**

```bash
git add src/ai/AIDefense.ts src/ai/__tests__/AIDefense.test.ts
git commit -m "feat(ai): add defense mode dispatcher from defense.lua"
```

---

### Task 9: AIController — Main controller (turtle.lua)

**Files:**
- Create: `src/ai/AIController.ts`
- Test: `src/ai/__tests__/AIController.test.ts`

Port `turtle.lua` — the main AI entry point.

**Step 1: Write test**

Test the decision hierarchy: sun avoidance > plasma avoidance > snot > ice > attack/defense mode.

**Step 2: Implement**

```typescript
import { PlayerInput } from '@/input/InputManager';
import { Player } from '@/game/Player';
import { MichiGichiPlayer } from '@/game/MichiGichiPlayer';
import { Sun } from '@/game/Sun';
import { EntityPool } from '@/engine/EntityPool';
import { Bullet } from '@/game/Bullet';
import { Snot } from '@/game/Snot';
import { Asteroid } from '@/game/Asteroid';
import { DifficultyLevel, getDifficultyConstants, AILevelConstants } from './AIConstants';
import { buildPlayerTable, PlayerTable, SunTable, getAIEntityType } from './AIBridge';
import { AIOutput } from './AIOutput';
import { AIAttackMode } from './AIAttack';
import { AIDefenseMode } from './AIDefense';
import { AILearning } from './AILog';
import { CharacterDef } from '@/game/CharacterRegistry';
import { ARENA } from '@/game/Arena';

export interface AIContext {
  num: number;
  constants: AILevelConstants;
  sunTable: SunTable;
  out: AIOutput;
  learning: AILearning;
  tacticTime: number;
  inDisAdvantage: boolean;
  // Persistent flags from Pzy_Methods.lua
  smallGitchiFlag: boolean;
  fireWeapon2Flag: boolean;
  thrustOnceFlag: boolean;
  energyFillFlag: boolean;
  cowardReadyFlag: boolean;
  inLowEnergyAttack: boolean;
  slowDownSunFlag: boolean;
  // fire() state machine
  countShootTime: number;
  readyToFire: boolean;
  // flyInCircle
  rotAngle: number;
  // closeRange
  lastFrameCloseRange: number;
  closeRangeCounter: number;
  // inDisadvantage
  disAdvantageCounter: number;
}

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
    };
  }

  update(
    dt: number,
    aiPlayer: Player,
    userPlayer: Player,
    sun: Sun,
    bulletPool: EntityPool<Bullet>,
    snotPool: EntityPool<Snot>,
    asteroidPool: EntityPool<Asteroid>,
  ): PlayerInput {
    this.num++;
    this.ctx.num = this.num;

    if (this.num <= 5) {
      return this.out.toPlayerInput(); // Skip first 5 frames like original
    }

    // Build player tables (init() from turtle.lua)
    const AI = buildPlayerTable(aiPlayer, userPlayer, sun, this.aiCharDef, bulletPool, snotPool);
    const USER = buildPlayerTable(userPlayer, aiPlayer, sun, this.userCharDef, bulletPool, snotPool);

    // onceMethod — handle one-shot flags from previous frame
    this.handleOnceFlags(AI);

    // expertLevel — update runtime-computed constants
    this.updateRuntimeConstants(AI);

    // Reset output for this frame
    // (Don't reset — the Lua AI carries state across frames via toggle flags)

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
      // One of the avoidance tactics activated
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

    // Handle learning AI — doLog equivalent
    this.updateLearning(AI, USER);

    return this.out.toPlayerInput();
  }
}
```

**Step 3: Run test — expect PASS**

**Step 4: Commit**

```bash
git add src/ai/AIController.ts src/ai/__tests__/AIController.test.ts
git commit -m "feat(ai): add AIController main loop from turtle.lua"
```

---

### Task 10: Wire AI into main.ts game loop

**Files:**
- Modify: `src/main.ts`

Replace Player 2 keyboard input with AI-generated input.

**Step 1: Add AI imports and state**

```typescript
import { AIController } from '@/ai/AIController';
import { DifficultyLevel } from '@/ai/AIConstants';

let aiController: AIController | null = null;
let aiDifficulty: DifficultyLevel = 3;
```

**Step 2: Modify game loop**

In the `gameState === 'playing'` section of the game loop, replace:
```typescript
updatePlayerInput(player2, player1, input.player(1), thrustEffect2, dt);
```
with:
```typescript
if (aiController) {
  const aiInput = aiController.update(dt, player2, player1, sun, bulletPool, snotPool, asteroidPool);
  updatePlayerInput(player2, player1, aiInput, thrustEffect2, dt);
} else {
  updatePlayerInput(player2, player1, input.player(1), thrustEffect2, dt);
}
```

**Step 3: Modify `startMelee()` to create AI controller**

After creating player2, instantiate the AI:
```typescript
aiController = new AIController(aiDifficulty, p2Def, p1Def);
```

**Step 4: Verify it compiles**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/main.ts
git commit -m "feat(ai): wire AIController into game loop for Player 2"
```

---

### Task 11: Difficulty selection UI

**Files:**
- Create: `src/ui/DifficultyUI.ts`
- Modify: `src/main.ts` (game flow)

Add difficulty selection screen that appears after main menu, before character selection.

**Step 1: Create DifficultyUI**

Simple HTML/CSS overlay (same pattern as SelectionUI and HUD):

```typescript
export class DifficultyUI {
  private root: HTMLDivElement;
  private options: HTMLDivElement[] = [];
  private selectedIndex = 1; // Default to Medium
  private onSelect: (level: 1 | 2 | 3) => void;

  constructor(parent: HTMLElement, onSelect: (level: 1 | 2 | 3) => void) { ... }

  handleKey(key: string): void {
    if (key === 'ArrowUp') this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    if (key === 'ArrowDown') this.selectedIndex = Math.min(2, this.selectedIndex + 1);
    if (key === 'Enter') this.onSelect((this.selectedIndex + 1) as 1 | 2 | 3);
    this.updateHighlight();
  }

  destroy(): void { this.root.remove(); }
}
```

**Step 2: Modify game flow in main.ts**

Add new `'difficulty'` state to `GameState`:
```typescript
type GameState = 'logo' | 'menu' | 'difficulty' | 'selection' | 'playing' | 'gameOver';
```

Flow: Main Menu → Difficulty Selection → P1 Character Selection → Start Melee

**Step 3: Modify selection to be P1-only**

Change `SelectionScene` to start at `SELECTING_P1` (skip P2 selection). After P1 confirms, randomly assign P2 character:
```typescript
const p2Index = Math.floor(Math.random() * CHARACTER_REGISTRY.length);
const p2Def = CHARACTER_REGISTRY[p2Index];
```

**Step 4: Test manually in browser**

Run: `npm run dev` and verify the flow: Menu → Difficulty → P1 Selection → Game starts with AI

**Step 5: Commit**

```bash
git add src/ui/DifficultyUI.ts src/main.ts
git commit -m "feat(ai): add difficulty selection UI and P1-only character selection"
```

---

### Task 12: Integration testing and tuning

**Files:**
- Modify: various AI files as needed

**Step 1: Run all existing tests**

```bash
npx vitest run
```

Ensure all 924+ existing tests still pass.

**Step 2: Run TypeScript type check**

```bash
npx tsc --noEmit
```

**Step 3: Manual play testing**

Run `npm run dev` and play against the AI at each difficulty level:
- Easy (Level 1): AI should be passive, miss shots often, retreat frequently
- Medium (Level 2): AI should mix attack/defense, ~70% accuracy
- Hard (Level 3): AI should be aggressive, 100% accuracy, relentless pursuit

Verify per-character AI behaviors:
- AI as MichiGichi: morphs between modes appropriately
- AI as Gondi: fires snots frequently, exploits slowed opponents
- Player vs MichiGichi AI: AI avoids plasma
- Player vs Gondi AI: AI avoids snots

**Step 4: Fix any issues found**

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(ai): M11 AI opponent complete — exact port of original Lua AI"
```
