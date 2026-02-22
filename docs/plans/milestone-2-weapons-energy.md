# Milestone 2: Weapons & Energy

**Goal:** The player can fire plasma bullets that fly forward and disappear after a timeout. Firing consumes energy, which regenerates over time.

**Depends on:** Milestone 1 (Single Ship Flight)

## Scope

### Bullet System
- **Plasma Bullet** — the default primary weapon for most characters
  - Spawns 25 units ahead of the player in the direction they face
  - Initial velocity: bullet direction vector * 0.3 (speed max scaler)
  - Time to live: 10,000ms (10 seconds)
  - Collision sphere: radius 2 at (0,0,0)
  - Visual: billboard quad (50x50) with animated sprite (80 frames, speed 0.4)
  - Fallback: small glowing sphere if sprite unavailable

### Energy System
- Energy range: 0.0 to 1.0 (float)
- Primary weapon cost: 0.08 per shot (Gondi: 0.12)
- Primary fire cooldown: 200ms
- Primary energy fill rate: 0.0001 per frame-unit (passive regen)
- Cannot fire if energy < weapon cost
- Energy clamped to [0, 1]

### Input
- Fire primary: `Space` / `Enter`

### Entity Integration
- Bullets extend Entity base class
- Bullets have `autoWrap: false` (don't wrap around arena — they expire)
- Bullets store `originEntity` reference (for later collision filtering)
- Bullets tracked in EntityManager with a dedicated bullet list
- Remove bullets when TTL expires or `alive = false`

## Out of Scope
- Collision detection (Milestone 3)
- Secondary weapons / snot (Milestone 6)
- Bullet tracking/homing behavior (Milestone 6)
- Particle effects on bullets (Milestone 7)
- Sound effects (Milestone 12)

## Original C++ Reference
- `Bullets/PlasmaBullet.h/cpp` — bullet properties and animation
- `player/player.cpp:HandleWeapon1()` — fire logic, energy cost, cooldown
- `entity.cpp:GetFullSpeedVec()` — bullet direction from angle
- `player/entitymgr.cpp` — bullet lifecycle management
