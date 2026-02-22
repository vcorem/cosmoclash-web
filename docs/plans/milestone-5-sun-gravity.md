# Milestone 5: Sun & Gravity

**Goal:** A sun sits at the center of the arena and pulls all entities toward it with gravity. Colliding with the sun destroys the entity.

**Depends on:** Milestone 3 (Collision Detection)

## Scope

### Sun Entity
- Fixed position at (0, 0, 0) — center of arena
- Non-moving (`autoWrap: true`, velocity always zero)
- Collision sphere: radius 65 at (0,0,0)
- Visual: animated sprite (60-frame sequence, speed 0.025) or glowing sphere
- Point light attached: radius 1500, color red `(1.0, 0.0, 0.0)`
- Ambient color influence: `(0.45, 0.45, 0.45)`

### Gravity System
Applied every frame to all entities (players, bullets, asteroids):

```
1. distance = length(sunPos - entityPos)
2. if distance > 450: no gravity effect
3. direction = normalize(sunPos - entityPos)
4. force = 0.5 / distance
5. force = min(force, 0.001)  // clamp max pull
6. entity.accelVec += direction * force * dt * TIME_SCALER
```

### Sun Collision
- Contact with the sun (sphere overlap) destroys the entity
- Players: instant death
- Bullets: removed
- Handled through existing collision system from M3

## Constants (from original)
- Gravity range: 450 units
- Gravity constant: 0.5
- Max gravity force: 0.001
- Sun collision radius: 65
- Sun light radius: 1500

## Out of Scope
- Sun bullet weapon type (Milestone 10)
- Sound on sun collision (Milestone 12)
- Particle effects on sun (Milestone 7)

## Original C++ Reference
- `SceneMelee.cpp:ApplySunGravity()` — gravity formula
- `entity.cpp` — sun entity definition, collision sphere
- `SceneMelee.cpp` — sun initialization, light setup
