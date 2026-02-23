# M11: AI Opponent — Design Document

## Overview

Port the original Lua AI system (9 files, ~2500 lines) to TypeScript as a direct, exact translation. The AI controls Player 2 as a computer opponent for single-player mode.

## Architecture

### File Structure

```
src/ai/
├── AIController.ts       # Main class: init(), handleFrame(), state machine (turtle.lua)
├── AICalc.ts            # Math/geometry: distance, angle, aiming, movement (calc_Methods.lua)
├── AITactics.ts         # All 16 tactics with per-character branches (Tactics.lua)
├── AIAttack.ts          # Attack mode dispatcher + tactic cycling (attack.lua)
├── AIDefense.ts         # Defense mode dispatcher (defense.lua)
├── AILog.ts             # Learning tables: hit tracking per tactic (AiLog.lua)
├── AIConstants.ts       # Difficulty-level constants from expertLevel()
├── AIBridge.ts          # Query/control wrappers (Pzy_Methods.lua)
└── __tests__/
    ├── AICalc.test.ts
    ├── AITactics.test.ts
    └── AIController.test.ts
```

### Integration with main.ts

AI produces `PlayerInput` — the same interface used by keyboard input:

```typescript
// In game loop, instead of keyboard input for P2:
const aiInput = aiController.update(dt, player2, player1, sun, bulletPool, snotPool, asteroidPool);
updatePlayerInput(player2, player1, aiInput, thrustEffect2, dt);
```

### State Management

The original Lua uses global variables that persist across frames. In TypeScript, the `AIController` class holds all mutable state:

- Frame counter (`num`)
- Player tables (`player1Table`, `player2Table`, `sunTable`) — refreshed each frame
- Tactic state (`whichAttackTactic`, `whichDefenseTactic`, `attackFrameCounter`, etc.)
- Energy management flags (`minEnergyLevel`, `resumeEnergyLevel`, weapon firing state)
- Learning tables (`hittingInAttackTable`, `hittingInDefenseTable`, etc.)
- Per-tactic persistent flags (`inDisAdvantage`, `readyForcowardFlying`, etc.)

### Frame Timing

Original Lua increments a frame counter once per render frame (~60fps). Our game loop passes `dt` in milliseconds. The AI frame counter increments by `dt / 16.67` each update to match original timing. Tactic durations (e.g., `kamikazeAttack_TIME = 1500` frames) remain in frame units.

## Decision Hierarchy (per frame)

Exact port of `HandleFrame()`:

1. `init()` — refresh all player/sun state tables
2. Priority avoidance checks (in order):
   - Near sun → `stayAtADistanceFromSun()`
   - Opponent plasma nearby → `avoidBluePlasma()`
   - Snots stuck on AI → `snotsStuckOnAIAction()`
   - Opponent snots nearby → `avoidSnot()`
   - Opponent ice shield active → `avoidIceSholev()`
   - Opponent slowed by snots → `shootWhenSnotsActive()`
3. Mode selection:
   - AI health >= opponent health → `attack()`
   - AI health < opponent health → `defense()`
4. Within attack/defense:
   - Interruption: if hit or opponent facing+shooting → `inDisadvantage()`
   - Tactic cycling: every `tacticTime` frames, random tactic
   - Learning: every `rateOfLearningAI` cycles, use best tactic

## All 16 Tactics (Exact Port)

### Attack Mode (5 tactics, each 20% probability)

| Tactic | Duration | Description |
|--------|----------|-------------|
| kamikazeAttack | 1500 frames | All-in charge, stop at KAMIKAZE_CLOSE_DIS |
| uniqueTactic | 1000 frames | Character-specific power play |
| sitOnTailAttack | 2000 frames | Pursuit until weapon range |
| stationaryAttack | 1000 frames | Stop, aim, fire bursts |
| inAndOut | 2000 frames | Hit-and-run approach/retreat |

### Defense Mode (5 tactics, each 20% probability)

| Tactic | Duration | Description |
|--------|----------|-------------|
| cowardFlying | 4000 frames | Stay beyond weapon range, fire when charged |
| lowEnergyAttack | 2000 frames | Counter when opponent energy < 0.3 |
| zigzag | 500 frames | Perpendicular evasion to opponent velocity |
| uniqueTactic | 1000 frames | Character-specific |
| turnAndShoot | 3000 frames | Maintain distance > 350, random angle shots |

### Special Behaviors (priority-based)

- `stayAtADistanceFromSun()` — orbit sun at safe distance
- `avoidBluePlasma()` — evade MichiGichi plasma tracking
- `avoidSnot()` — evade Gondi snots
- `avoidIceSholev()` — evade Sholev ice shield
- `shootWhenSnotsActive()` — exploit slowed opponent
- `inDisadvantage()` — reactive evasion when hit
- `closeRangeAttack()` — emergency melee response
- `snotsStuckOnAIAction()` — when AI has snots attached

### Utility Tactics

- `superFastAndShoot()` — accelerate to max, then aim+fire
- `zigZagShoot()` — zigzag with firing (sub-routine of others)

## Per-Character AI Logic

### MichiGichi (Type 1)
- Morph management: slow mode for power (plasma), fast mode for evasion
- `getMitchiGitchiState()` checks: 0=MICHI, 1=MICHI_TO_GICHI, 2=GICHI, 3=GICHI_TO_MICHI
- Secondary weapon = morph trigger (not projectile)
- Bullet speed: 0.2 (slow/MICHI), 0.525 (fast/GICHI)
- Bullet TTL: 5000ms (slow), 1000ms (fast)
- In `superFastAndShoot`: morphs to fast, triggers secondary every 250 frames
- In `avoidBluePlasma`: morphs to fast to escape
- In `zigzag`: morphs to fast first

### Gondi (Type 4)
- Heavy snot usage: fires secondary (snots) in nearly every tactic
- `shootWhenSnotsActive()`: dedicated routine when opponent slowed
- Bullet speed: 0.18 (flame), TTL: 700ms
- In `uniqueTactic`: holds distance then circles when opponent has snots
- In `superFastAndShoot`: fires secondary while accelerating
- `makeSpiderNet()`: scales net based on opponent speed

### Sholev (Type 8)
- Secondary = ice shield (defensive, not projectile)
- `avoidIceSholev()`: triggered when shield active + close range
- Bullet speed: 0.6 (ice cones, fast), TTL: 700ms
- In `uniqueTactic`: fires secondary close range, freezes aim when very close

### Others (Neo, Orca, Ptera, Lepid, Tiktok, Phyto)
- Default behavior: similar to Sholev minus ice mechanics
- Bullet speed: 0.525 (sun weapon), TTL: 1000ms
- Some tactics skip secondary entirely

## Difficulty Constants

### Level 1 (Beginner)
```
distanceToAvoidPlasma: 50
distanceToAvoidSnot: 50
distanceToStayAway: 150 (sun)
goodAimProbability: 0.4
BELOW_MAX_SPEED_TO_SHOOT: 0.05
DEFAULT_SHOOT_INTERVAL: 100
SIT_ON_TAIL_DIS: 400
KAMIKAZE_CLOSE_DIS: 200
rateOfLearningAI: 6
```

### Level 2 (Medium)
```
distanceToAvoidPlasma: 175
distanceToAvoidSnot: 100
distanceToStayAway: 300
goodAimProbability: 0.7
BELOW_MAX_SPEED_TO_SHOOT: 0.06
DEFAULT_SHOOT_INTERVAL: 50
SIT_ON_TAIL_DIS: 300
KAMIKAZE_CLOSE_DIS: 150
rateOfLearningAI: 5
```

### Level 3 (Expert)
```
distanceToAvoidPlasma: 250
distanceToAvoidSnot: 150
distanceToStayAway: 350
goodAimProbability: 1.0
BELOW_MAX_SPEED_TO_SHOOT: 0.069
DEFAULT_SHOOT_INTERVAL: 25
SIT_ON_TAIL_DIS: 200
KAMIKAZE_CLOSE_DIS: 100
rateOfLearningAI: 4
```

## Learning AI

Tracks which tactic lands the most hits per mode:
- `hittingInAttackTable[tactic]` — count of AI hits using this attack tactic
- `hittingInDefenseTable[tactic]` — count of AI hits using this defense tactic
- `gotHitInAttackTable[tactic]` — count of AI getting hit during attack
- `gotHitInDefenseTable[tactic]` — count of AI getting hit during defense
- `maxTactic` — best-performing tactic (highest hit count)
- Every `rateOfLearningAI` tactic cycles, AI replays its best tactic

## Selection Screen Changes

### Flow Change: Difficulty First, Then Character

1. Logo → Main Menu → **Difficulty Selection** (Easy/Medium/Hard)
2. After difficulty chosen → **P1 Character Selection** (arrow keys + Enter)
3. P2 character randomly assigned from roster
4. Start melee

### UI Changes
- New difficulty selector screen/overlay before character selection
- Selection screen shows only P1 selection (no P2 phase)
- P2's assigned character shown briefly or in HUD

## Aiming System

### `goodAim()` — Predictive Aiming
```
futureX = opponentX + velocityX * (distance * 1.5)
futureY = opponentY + velocityY * (distance * 1.5)
correctedAngle = angleToXY(futureX, futureY)

if random(100) < (100 * goodAimProbability):
    return correctedAngle  // accurate
else:
    return angleToOpponent  // inaccurate (simple direct angle)
```

### `realIsInRange()` — Movement-Aware Range Check
For MichiGichi/Sholev: bullet moves independently of ship velocity
For Gondi: ship momentum transfers to bullet
Accounts for both ship and opponent movement vectors over bullet TTL

## Out of Scope
- Multiple AI opponents simultaneously
- AI learning between rounds (resets each match)
- Network-aware AI
- Lua WASM integration
