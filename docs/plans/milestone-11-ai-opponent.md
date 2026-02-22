# Milestone 11: AI Opponent

**Goal:** A computer-controlled opponent that can fly, fight, and provide a challenging single-player experience.

**Depends on:** Milestone 4 (Second Player & Camera)

## Scope

### AI Architecture
The original uses Lua scripts. For the web port, rewrite the AI logic in TypeScript:
- AI runs every frame as part of the game loop
- AI reads game state (positions, angles, health, energy, bullets)
- AI outputs actions: thrust, rotate, fire primary, fire secondary

### AI API (matching original Lua API)
The AI controller receives a read-only game state view:

```typescript
interface AIGameState {
  self: PlayerState;       // AI player's state
  opponent: PlayerState;   // Human player's state
  sun: { x: number, y: number };
  bullets: BulletState[];  // All active bullets
}

interface PlayerState {
  x: number; y: number;
  angle: number;
  velocityX: number; velocityY: number;
  health: number;
  energy: number;
  maxSpeed: number;
  snotCount: number;
}
```

### AI Actions
```typescript
interface AIActions {
  thrust: boolean;
  rotateDirection: -1 | 0 | 1;
  firePrimary: boolean;
  fireSecondary: boolean;
}
```

### Difficulty Levels (from original `turtle.lua`)

| Level | Sun Avoidance | Attack Range | Aim Accuracy | Behavior |
|-------|--------------|--------------|--------------|----------|
| 1 (Easy) | 50-100 units | Conservative | 40% | Passive, runs away often |
| 2 (Medium) | 100-175 units | Balanced | 70% | Mix of attack/defense |
| 3 (Hard) | 150-250 units | Aggressive | 100% | Pursues relentlessly |

### AI Decision Hierarchy (from original)
1. **Sun avoidance:** If distance to sun < threshold, turn away and thrust
2. **Dodge projectiles:** If incoming plasma/snot/ice within range, evade
3. **Attack vs Defend:** If health >= opponent health → attack mode; else → defend
4. **Attack tactics:** Turn toward opponent, close distance, fire when aimed
5. **Defense tactics:** Maintain distance, fire opportunistically, retreat

### AI Tactics (from original, simplified for initial port)
- **Simple Attack:** Turn toward opponent, thrust, fire when angle is close
- **Coward Flying:** Maintain distance, only fire when safe
- **In And Out:** Alternate between closing distance and retreating

### Aim Calculation
```
angleToOpponent = atan2(-(opponent.x - self.x), opponent.y - self.y) * 180 / PI
angleDiff = normalizeAngle(angleToOpponent - self.angle)
if abs(angleDiff) < aimThreshold: fire
```

## Out of Scope
- Multiple AI opponents simultaneously
- AI learning/adaptation between rounds
- Network-aware AI (AI runs locally only)
- Lua WASM integration (rewrite in TypeScript instead)

## Original C++ Reference
- `AI/turtle.lua` — complete AI script with tactics, difficulty levels
- `AI/CLuaScript.h/cpp` — Lua binding layer, API functions
- `player/player.cpp` — AI function registration (`RegisterLuaFunctions`)
