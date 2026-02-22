# Milestone 6: Snot Mechanic

**Goal:** Players can fire snot as a secondary weapon. Snots track toward the opponent, attach on hit, increase the target's max speed, and slow their turning.

**Depends on:** Milestone 3 (Collision Detection)

## Scope

### Snot Entity
- Extends Entity / Bullet base
- Damage: 0.0 (non-damaging)
- Speed: 0.2 (max speed scaler)
- TTL: 10,000ms (10 seconds)
- Collision sphere: radius 2 at (0,0,0)
- Visual: animated sprite (116 frames, speed 0.03) or small green blob
- Spawn offset: randomized vector around (0, -30, -30) from player
- Tracking: homes toward nearest opponent

### Tracking Behavior
- Each frame, adjust snot's angle toward the target player
- Gradual turn — not instant lock-on
- Only tracks while in flight (not after attachment)

### Attachment
When a snot collides with a player:
1. Snot stops being a free-flying entity
2. Snot follows the target player's position with a visual offset
3. Player's `snotCount` increments

### Effects on Target Player
- **Max speed increases:** `effectiveMaxSpeed = baseMaxSpeed + snotCount`
  - More snots = harder to control (faster drift)
- **Rotation slows:** `effectiveRotSpeed = baseRotSpeed / (snotCount / 3 + 1)`
  - 0 snots: full rotation speed
  - 3 snots: half rotation speed
  - 6 snots: one-third rotation speed

### Secondary Weapon Input
- Player 1: additional key TBD (e.g., `Shift` + fire)
- Player 2: additional key TBD
- Energy cost: 0.08 per snot
- Cooldown: 200ms
- Secondary energy fill rate: 0.00005 (half the primary rate)

## Out of Scope
- Snot removal/expiry after attachment (keep simple for now)
- Frost shield blocking snots (Milestone 10)
- Sound effects (Milestone 12)

## Original C++ Reference
- `Bullets/Snot.h/cpp` — snot properties, tracking, attachment
- `player/player.cpp:HandleWeapon2()` — secondary fire logic
- `player/player.cpp:GetMaxSpeedScaler()` — `return m_SpeedMaxScaler + m_nSnots`
- `player/player.cpp:HandleRotation()` — rotation speed reduction formula
