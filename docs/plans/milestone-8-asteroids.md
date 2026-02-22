# Milestone 8: Asteroids

**Goal:** Asteroids float around the arena, wrap at edges, and explode when hit by bullets.

**Depends on:** Milestone 7 (Entity Pooling & Explosions)

## Scope

### Asteroid Entity
- Extends Entity base class
- 3 visual types (different meshes/sizes): Asteroid1, Asteroid2, Asteroid3
- 10 asteroids spawned at game start
- Speed max scaler: 0.1 (very slow drift)
- Random initial velocity direction
- Continuous rotation: random X and Y axes at 0.1 radians/frame
- `autoWrap: true`
- Affected by sun gravity (if M5 is done)

### Asteroid Collision
- Collision sphere: entity-specific radius (varies by asteroid type)
- Destroyed on any bullet hit (no health — one-shot kill)
- Triggers explosion effect (from M7 pool)
- Does NOT collide with other asteroids
- Collides with players (causes damage)

### Asteroid Pool
- Pool size: 20 total (distributed across 3 types)
- Acquired from pool at game start
- Returned to pool on destruction
- Respawn logic: optional timer to respawn destroyed asteroids

### Visual
- Convert original asteroid meshes from DirectX .x to glTF
- 3 distinct models for visual variety
- Fallback: rough sphere geometry with rocky material

## Out of Scope
- Asteroid splitting into smaller pieces
- Asteroid spawning during gameplay (just initial placement)
- Sound on asteroid hit (Milestone 12)

## Original C++ Reference
- `Asteroids/` — asteroid entity classes, 3 types
- `player/entitymgr.cpp` — asteroid pool initialization (20 total)
- `SceneMelee.cpp` — asteroid spawn at game start (10 asteroids)
- `mediaflat/` — asteroid mesh assets
