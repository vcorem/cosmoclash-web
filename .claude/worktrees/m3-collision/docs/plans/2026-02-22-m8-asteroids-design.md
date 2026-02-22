# M8: Asteroids — Design Document

## Overview

Add asteroid obstacles to the arena, matching the original C++ implementation. 10 asteroids spawn at random positions with random types (3 variants), drift slowly with rotation, are affected by gravity and wrap-around, and can be destroyed by bullets. Player-asteroid collisions cause a bounce with no damage.

## Asteroid Class

`src/game/Asteroid.ts` extends `Entity`:

- **Properties:** `asteroidType` (0/1/2), `rotationSpeedX/Y` (0.1), `curXAngle/curYAngle` (random 0-360)
- **EntityType:** `EntityType.Asteroid` (new enum value)
- **Collision spheres:** Single sphere per type — radius 8 (type 0), 18 (type 1), 15 (type 2)
- **Speed:** 0.1 base, 0.1 speedMaxScaler
- **Init:** Random heading angle → `accelVec` set to full-speed vector in that direction
- **update(dt):** Increment both rotation angles by `dt * rotationSpeed`, wrap at 360. Call `super.update(dt)` for physics.
- **reset():** Randomize rotation angles, clear state for pool reuse

## Pooling

- Single `EntityPool<Asteroid>` with pool size 10
- Factory creates asteroids; `resetFn` reinitializes for reuse
- `Map<Asteroid, THREE.Mesh>` tracks 3D meshes separate from pool (matches bullet/snot/explosion pattern)

## Spawning

At game initialization, acquire 10 asteroids:
- Random type per asteroid: `Math.floor(Math.random() * 3)`
- Random position: `x ∈ [-1500, 1500]`, `y ∈ [-1050, 1050]`
- Random initial heading → `accelVec` in that direction
- No respawning — destroyed asteroids stay dead for the match

## Visual Representation

- Convert original `.x` meshes to glTF/GLB: `Asteroid01.x` → `asteroid01.glb`, etc.
- Apply original textures: `Asteroid1.jpg`, `Asteroid2.jpg`, `Asteroid3.jpg`
- Place in `public/models/` alongside `gondi.glb`
- Load at startup with `GLTFLoader`, clone mesh on acquire
- Mesh scale: 10x (matching original)
- 3D rotation: `mesh.rotation.set(curXAngle, curYAngle, 0)` each frame

## Collision Rules

| Pair | Behavior |
|------|----------|
| Asteroid-Bullet | Asteroid explodes (ExplosionEvent), bullet destroyed |
| Asteroid-Player | Bounce only (reverse accelVec direction), no damage |
| Asteroid-Asteroid | Skip (no collision) |
| Asteroid-Snot | Skip (no interaction) |
| Asteroid-Explosion | Skip |
| Asteroid-Sun | Gravity pull (within 450 units), no destruction |

### CollisionDetector changes
- Add `EntityType.Asteroid` to `shouldCheck()` skip rules:
  - Both asteroids → skip
  - Asteroid + snot → skip
  - Asteroid + explosion → skip

### CollisionHandler changes
- Handle asteroid-bullet: destroy asteroid, emit `ExplosionEvent`
- Handle asteroid-player: apply bounce response (reverse accelVec based on collision normal)

## Game Loop Integration (main.ts)

Order within the existing game loop:

1. **Collision detection** — add `...asteroidPool.activeEntities` to `allEntities` array
2. **Update loop** — after snots, before gravity:
   ```
   asteroidPool.forEachActive(asteroid => {
     asteroid.update(dt);
     asteroid.handleWrapAround(camCenter);
   });
   ```
3. **Gravity** — apply sun gravity to active asteroids
4. **Mesh sync** — sync mesh position and rotation from entity state
5. **Release inactive** — clean up dead asteroids and their meshes

## Arena Constants

```typescript
ASTEROID_COUNT: 10,
ASTEROID_ROTATION_SPEED: 0.1,
ASTEROID_SPEED: 0.1,
ASTEROID_SPEED_MAX_SCALER: 0.1,
ASTEROID_COLLISION_RADII: [8, 18, 15],  // type 0, 1, 2
ASTEROID_MESH_SCALE: 10,
```

## Testing

- Asteroid class: construction, reset, update rotation, type-specific collision radii
- Pool lifecycle: acquire, release, spawn 10
- Collision rules: asteroid-bullet destroy, asteroid-player bounce, asteroid-asteroid skip
- Integration: asteroids in collision allEntities list

## Asset Pipeline

1. Convert `Asteroid01.x`, `Asteroid02.x`, `Asteroid03.x` from DirectX format to glTF/GLB
2. Embed or reference textures `Asteroid1.jpg`, `Asteroid2.jpg`, `Asteroid3.jpg`
3. Verify mesh scale and orientation match original
