# Milestone 3: Collision Detection

**Goal:** Bullets damage the player. Ship-to-ship collision causes mutual damage. Health system tracks damage and triggers destruction.

**Depends on:** Milestone 2 (Weapons & Energy)

## Scope

### Health System
- Health range: 0.0 to 1.0 (float)
- Plasma bullet damage: 0.3
- Ship-to-ship collision: mutual damage based on impact velocity
- When health <= 0: entity destroyed (explosion triggered in M7, for now just remove)

### Sweep-Sphere Collision
Mirrors the original `CollisionDetector.h/cpp`:

- Each entity has a list of `CollisionSphere { offset: Vec3, radius: number }`
- Collision check uses **sweep-sphere** algorithm:
  1. For each pair of collidable entities, for each sphere pair
  2. Use previous and current positions to compute a swept path
  3. Solve quadratic equation for collision time `t` in [0, 1]
  4. If valid collision: trigger collision event

### Collision Spheres (from original)
- **Gondi:** 1 sphere at (0,0,0) radius 14
- **Plasma Bullet:** 1 sphere at (0,0,0) radius 2
- Other characters added in Milestone 10

### Collision Rules
- Bullets do NOT collide with their origin player
- Bullets do NOT collide with other bullets
- Players collide with players
- Players collide with bullets

### Game Event System
Simple event dispatcher (mirrors `GameEvents/`):
- `CollisionEvent { entityA, entityB, collisionTime }`
- `ExplosionEvent { entity }` (scaffolded for M7)
- `BulletHitEvent { bullet, target }`
- Scene listens for events and applies damage

## Collision Sphere Coordinates
Collision sphere offsets are in the entity's local space. They must be transformed by the entity's current rotation before world-space distance checks.

## Out of Scope
- Explosion visual effects (Milestone 7)
- Asteroid collision (Milestone 8)
- Sun collision (Milestone 5)
- Sound on hit (Milestone 12)

## Original C++ Reference
- `CollisionDetector.h/cpp` — `SphereSphereSweep()` algorithm, detection loop
- `entity.h` — `m_CollisionSpheres` list, per-character sphere definitions
- `GameEvents/GameEvent.h` — event type enum and event data structures
- `GameEvents/GameEventMgr.h/cpp` — event dispatch and listener registration
- Character constructors (e.g., `gondi.cpp`) — sphere definitions
