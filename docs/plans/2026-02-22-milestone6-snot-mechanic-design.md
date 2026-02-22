# M6 Design: Snot Mechanic

**Date:** 2026-02-22
**Status:** Approved
**Depends on:** M3 (Collision Detection)

## Overview

Players fire snots as a secondary weapon. Snots home toward the opponent, attach on contact, and debuff the target by reducing max speed and rotation speed. Attached snots orbit the victim visually and expire after 10 seconds.

All formulas and behaviors match the original C++ implementation.

## 1. Snot Entity

New `Snot` class extends `Bullet` with `EntityType.Snot`.

| Property | Value | Notes |
|----------|-------|-------|
| speedMaxScaler | 0.2 | 20% of normal bullet speed |
| maxTtl | 10,000ms | 10 seconds |
| damage | 0.0 | Non-damaging |
| collisionRadius | 2 | Small sphere at origin |
| tracking | true | Homes toward enemy |

### Tracking Algorithm (from C++ CBullet::Render)

Each frame while in flight:
1. Compute vector from snot to target player
2. Normalize and calculate angle using dot product with up vector `(0,1,0)`
3. Adjust angle for X-axis sign: `if (vecToTarget.X > 0) angle += 180`
4. Set snot angle and update `accelVec = getFullSpeedVec(0.2)`
5. If X > 0, negate Y component of accelVec

### Attachment (from C++ CSnot::HandleCollision)

On collision with a Player:
1. Store reference to victim (`m_pVictim`)
2. Call `victim.addSnot()` to increment counter
3. Set `attached = true`, reset TTL to 10,000ms
4. Remove from collision detection system
5. Initialize orbit offset: `(0, -30, -30)` rotated by two random angles (XZ and XY)

### Orbit (from C++ CSnot::Render)

Each frame while attached:
- Rotate offset vector on XZ plane by `dt * 0.2`
- Rotate offset vector on XY plane by `dt * 0.2`
- Set position = `victim.position + offset`

### Expiry (from C++ CSnot::HandleTTLExpired)

When TTL reaches 0:
- If attached to victim: call `victim.removeSnot()`
- Destroy snot entity and clean up sprite

### Animation (117 frames, 64x64 each)

- Sprite sheet atlas: 11x11 grid (121 cells, 117 used)
- Texture: additive blending, billboard 50x50 units
- **Phase 1 (TTL > 2000ms):** Loop frames 0-54, speed 0.03/ms
- **Phase 2 (TTL ≤ 2000ms):** Freeze at frame 116

## 2. Player Effects

### Max Speed Reduction (from C++ CPlayer::GetMaxSpeedScaler)

```
effectiveMaxSpeed = baseSpeedMaxScaler / (snotCount + 1)
```

- 0 snots: 1.2 (full Gondi speed)
- 1 snot: 0.6 (50%)
- 2 snots: 0.4 (33%)
- 3 snots: 0.3 (25%)

### Rotation Reduction (from C++ CPlayer::HandleRotation)

```
effectiveRotSpeed = baseRotSpeed / (Math.floor(snotCount / 3) + 1)
```

- 0-2 snots: full rotation (0.5)
- 3-5 snots: 50% (0.25)
- 6-8 snots: 33% (0.167)

### Player Fields Added

- `snotCount: number` (float, starts at 0)
- `secondaryCooldown: number` (ms, starts at 0)
- `addSnot()` / `removeSnot()` methods

## 3. Secondary Weapon

### Firing (from C++ CPlayer::HandleSecondaryWeapon)

- Energy cost: 0.08 base (0.12 for Gondi, uses existing `primaryEnergyCost` which is already 0.12)
- Cooldown: 200ms
- Uses same energy pool as primary weapon
- Energy regen uses primary fill rate only (matching original)
- Spawn: 25 units ahead of player facing direction
- Sets tracking target to enemy player

### Input Bindings

- Player 1: `.` (period)
- Player 2: `Shift`
- New field in `PlayerInput`: `fireSecondary: boolean`

## 4. Collision Integration

### New Event: `SnotHitEvent`

- `GameEventType.SnotHit`
- Fields: `snot: Entity`, `target: Entity`

### CollisionDetector Changes

- Snots don't collide with origin player (like bullets)
- Snots don't collide with other snots
- Attached snots skip collision entirely
- Snots emit `SnotHitEvent` instead of `BulletHitEvent`

### CollisionHandler: `handleSnotHit()`

- Target is Player: attach snot (see Section 1)
- Target is anything else: destroy snot

## 5. Files

### New Files
- `src/game/Snot.ts` — Snot entity class
- `src/game/Snot.test.ts` — Unit tests
- `public/textures/snot_atlas.jpg` — Sprite sheet atlas

### Modified Files
- `src/engine/Entity.ts` — Add `EntityType.Snot`
- `src/game/Player.ts` — snotCount, fireSecondary(), effective speed/rotation
- `src/engine/GameEvent.ts` — Add `SnotHitEvent`, `GameEventType.SnotHit`
- `src/engine/CollisionDetector.ts` — Snot handling
- `src/game/CollisionHandler.ts` — SnotHit handler
- `src/input/InputManager.ts` — fireSecondary bindings
- `src/main.ts` — Wire up snots, sprites, events
- `src/game/Arena.ts` — Snot constants

## 6. Original C++ Reference

- `Bullets/Snot.h/cpp` — Snot entity, attachment, orbit, animation
- `Bullets/BulletBase.h/cpp` — Tracking algorithm
- `player/player.cpp:HandleSecondaryWeapon()` — Fire logic
- `player/player.cpp:GetMaxSpeedScaler()` — Speed formula: `m_SpeedMaxScaler / (m_nSnots + 1.0f)`
- `player/player.cpp:HandleRotation()` — Rotation formula: `m_RotationSpeed / ((m_nSnots / 3) + 1.0)`
- `player/entitymgr.h/cpp` — Snot pooling (deferred to M7)
