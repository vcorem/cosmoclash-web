# M5: Sun & Gravity — Design

## Goal

Place a sun at the center of the arena that pulls players toward it with gravity and damages them on contact. Animated sprite texture from original assets.

## Decisions

- **Visual**: Animated sprite sequence (60 JPG frames from original assets), combined into a single sprite sheet atlas
- **Sun collision damage**: 0.02 per collision (matches original C++ behavior — not instant death)
- **Gravity scope**: Players only (bullets fly straight, matching original)
- **Damage feedback**: Just bounce (no flash/shake — deferred to later milestones)
- **Approach**: Sun as Entity (extends existing Entity class)

## Architecture

### Sun Entity (`src/game/Sun.ts`)

New class extending `Entity`:
- `entityType: EntityType.Sun` (new enum value added to `Entity.ts`)
- `autoWrap: false` — fixed at `(0, 0, 0)`
- One collision sphere: `{ offset: {0,0,0}, radius: 65 }`
- Override `update()` as no-op (sun never moves)
- Texture animation state: `currentFrame: number`, `animSpeed: 0.025`

### Constants (`src/game/Arena.ts`)

```typescript
SUN_POSITION: { x: 0, y: 0, z: 0 },
SUN_COLLISION_RADIUS: 65,
SUN_DAMAGE: 0.02,
GRAVITY_RANGE: 450,
GRAVITY_CONSTANT: 0.5,
GRAVITY_MAX_FORCE: 0.001,
```

### Gravity System

Standalone function `applySunGravity(entity, sunPosition, dt)`:

```
1. distance = length(sunPos - entityPos)
2. if distance > 450: return (no effect)
3. direction = normalize(sunPos - entityPos)
4. force = 0.5 / distance
5. force = min(force, 0.001)
6. entity.accelVec += direction * force * dt * TIME_SCALER
```

Called in game loop after `entityManager.update()`, applied only to `player1` and `player2`.

### Collision Handling

**New event type**: `SunCollisionEvent` in `GameEvent.ts` with `GameEventType.SunCollision`.

**CollisionDetector changes** (`emitEvent()`):
- If one entity is `EntityType.Sun` and other is a bullet: emit `BulletHitEvent` (bullet destroyed, sun takes no damage)
- If one entity is `EntityType.Sun` and other is not a bullet: emit `SunCollisionEvent`

**CollisionHandler additions**:
- `handleSunCollision(event)`: applies 0.02 damage to the non-sun entity, bounces it away from sun center. Sun is immovable — only the other entity's velocity changes.

### Visual — Animated Sprite Sphere

**Build-time asset prep:**
- Combine 60 `sunSurface_XXXX.jpg` frames into one sprite sheet atlas (8x8 grid, 60 used)
- Output: `public/textures/sun_atlas.jpg`

**Three.js rendering:**
- `THREE.SphereGeometry` with `THREE.MeshBasicMaterial`
- Atlas texture with `blending: THREE.AdditiveBlending` (matches original `EMT_TRANSPARENT_ADD_COLOR`)
- UV animation: shift `texture.offset` each frame to cycle through atlas cells
- Scale: 10 (matches original)
- Rotation: -90 degrees on X axis (matches original)

**Lighting:**
- `THREE.PointLight` as child of sun mesh: color `0xff0000`, distance `1500`
- Scene ambient color influence: `(0.45, 0.45, 0.45)` (matches original)

### Game Loop Integration (`main.ts`)

1. Create `Sun` entity, add to `EntityManager`
2. Create sun mesh (sphere + atlas material), add to scene
3. Add red point light to scene
4. In update loop: call `applySunGravity()` for each player after entity update
5. In render step: update sun texture animation frame
6. Listen for `SunCollision` events in `CollisionHandler`

## Files Changed

| File | Change |
|------|--------|
| `src/engine/Entity.ts` | Add `EntityType.Sun` |
| `src/engine/GameEvent.ts` | Add `SunCollisionEvent`, `GameEventType.SunCollision` |
| `src/engine/CollisionDetector.ts` | Handle sun entity type in `emitEvent()` |
| `src/game/Arena.ts` | Add sun/gravity constants |
| `src/game/Sun.ts` | **New** — Sun entity class |
| `src/game/CollisionHandler.ts` | Add `handleSunCollision()` |
| `src/main.ts` | Initialize sun, mesh, light, gravity loop, event listener |
| `public/textures/sun_atlas.jpg` | **New** — combined sprite sheet |

## Out of Scope

- Sun bullet weapon type (M10)
- Sound on sun collision (M12)
- Particle effects on sun destruction (M7)
- Health display / HUD (M9)
