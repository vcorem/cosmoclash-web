# Milestone 3: Collision Detection — Design

**Date:** 2026-02-21
**Depends on:** M2 (Weapons & Energy) — complete
**Approach:** Centralized CollisionDetector + full GameEventMgr port

## Decisions

- **Architecture:** Centralized `CollisionDetector` mirroring original C++ `CollisionDetector.h/cpp`
- **Event system:** Full port of `GameEventMgr` with typed events, listener registration, synchronous dispatch
- **Test scenario:** Dummy target entity in arena + origin-player exemption verification
- **Death behavior:** Entity removed instantly (explosion effects deferred to M7)

## 1. Collision Spheres on Entity

```ts
interface CollisionSphere {
  offset: Vec3;   // Local-space offset from entity center
  radius: number;
}
```

- `Entity` gains `collisionSpheres: CollisionSphere[]`
- Detector transforms offsets by entity rotation for world-space positions
- Uses existing `previousPosition` for sweep start, `position` for sweep end

Initial sphere definitions:
- **Gondi (Player):** 1 sphere at `(0,0,0)`, radius `14`
- **Flame Bullet:** 1 sphere at `(0,0,0)`, radius `10`

## 2. Sweep-Sphere Algorithm

Direct port of original `SphereSphereSweep()`.

**Inputs:** radius A, prev pos A, curr pos A, radius B, prev pos B, curr pos B
**Outputs:** `{ hit: boolean, u0: number }` — collision occurred and normalized time [0,1]

Algorithm:
1. Velocity vectors: `va = A1 - A0`, `vb = B1 - B0`
2. Relative separation: `AB = B0 - A0`
3. Relative velocity: `vab = vb - va`
4. Sum of radii: `rab = ra + rb`
5. Quadratic: `a = dot(vab,vab)`, `b = 2*dot(vab,AB)`, `c = dot(AB,AB) - rab²`
6. If already overlapping (`c <= 0`): `{ hit: true, u0: 0 }`
7. Solve quadratic, check discriminant. If `u0` in `(0, 1]`: collision

Detection loop uses scan-ID to prevent double-checking pairs.

## 3. Game Event System

Port of `GameEventMgr` pattern.

**Event types:**
```ts
enum GameEventType { Collision, Explosion, BulletHit, FrameRender }
```

**Event classes:**
- `GameEvent` — base with `type: GameEventType`
- `CollisionEvent` — `entityA`, `entityB`, `collisionTime`
- `BulletHitEvent` — `bullet`, `target`
- `ExplosionEvent` — `entity` (scaffolded for M7)

**GameEventMgr (singleton):**
- `listeners: Map<GameEventType, GameEventListener[]>`
- `addListener(listener, type)` — register for specific type
- `sendEvent(event)` — synchronous dispatch, copies listener list before iterating
- `removeListener(listener, type)` — cleanup

**Listener interface:**
```ts
interface GameEventListener {
  onGameEvent(event: GameEvent): void;
}
```

## 4. Health System & Collision Rules

**Health:** `Entity.health: number` (0.0–1.0, default 1.0)

**Entity types:** `enum EntityType { Player, Bullet, Dummy }`

**Damage values:**
- Flame bullet: 0.05 (from `BulletConfig.damage`)
- Ship-to-ship: mutual damage based on relative velocity magnitude (~0.1–0.3)

**Death:** When `health <= 0`, call `entity.destroy()` (removed from scene)

**Collision rules:**
- Bullets do NOT collide with `originEntity`
- Bullets do NOT collide with other bullets
- Players/dummies collide with players/dummies
- Players/dummies collide with bullets → bullet applies damage, bullet destroyed

**Collision response:**
- `BulletHitEvent`: apply damage to target, destroy bullet
- Player-player `CollisionEvent`: reflect velocity vectors (separation force), apply mutual damage

## 5. Dummy Target

- `Player` instance with `entityType = Dummy`
- Placed at a fixed arena position
- Same collision sphere as Gondi (radius 14)
- Has health, takes damage, removed when `health <= 0`

## 6. File Structure

**New files:**
- `src/engine/GameEvent.ts` — event types, base class, typed subclasses
- `src/engine/GameEventMgr.ts` — singleton event manager
- `src/engine/CollisionDetector.ts` — sweep-sphere, detection loop, CollisionSphere interface

**Modified files:**
- `src/engine/Entity.ts` — add `health`, `entityType`, `collisionSpheres[]`
- `src/game/Player.ts` — set spheres (Gondi radius 14), set entityType
- `src/game/Bullet.ts` — set sphere from config, set entityType
- `src/main.ts` — instantiate detector, spawn dummy, register listeners, call per frame

## 7. Game Loop Integration

Each frame:
1. `EntityManager.update()` — movement, wrap-around (existing)
2. `CollisionDetector.checkCollisions()` — **new**
3. `EntityManager.removeDeadEntities()` — existing
4. Render — existing

## Original C++ Reference

- `CollisionDetector.h/cpp` — `SphereSphereSweep()`, detection loop, scan-ID optimization
- `entity.h/cpp` — `CollisionSphereElement`, `HandleCollision()`, `Explode()`
- `GameEvents/GameEvent.h` — event type enum
- `GameEvents/GameEventMgr.h/cpp` — singleton manager, listener dispatch
- `GameEvents/CollisionEvent.h` — collision event with sphere data
- `Collisable.h` — `BoundingSphere` struct
