# Milestone 7: Entity Pooling & Explosions — Design

**Date:** 2026-02-22
**Status:** Approved

## Scope

- Generic entity pooling for Bullets (50), Snots (80), Explosions (15)
- Pool manages both entity data AND Three.js sprites
- Explosion sprites from original 81-frame assets packed into atlas
- Explosions trigger on player death (health <= 0)
- No player respawn
- Particle effects (thrust, hit sparks) deferred to later milestone

## EntityPool\<T\> Core

A single generic `EntityPool<T extends Entity>` class:

```typescript
class EntityPool<T extends Entity> {
  private free: T[] = [];
  private active: Set<T> = new Set();

  constructor(
    factory: () => T,          // Creates a new instance
    resetFn: (e: T) => void,   // Resets entity state for reuse
    initialSize: number,
    spriteConfig?: SpriteConfig // Optional Three.js sprite management
  )

  acquire(): T;                 // Pop from free (or create), reset, mark alive
  release(entity: T): void;     // Mark dead, return to free list
  releaseInactive(): void;      // Release all entities where alive === false
  getSprite(entity: T): THREE.Sprite | undefined;
  forEachActive(fn: (e: T) => void): void;
  get activeEntities(): T[];    // For collision detection gathering
  get activeCount(): number;
  get freeCount(): number;
}
```

**Graceful fallback:** If free list is empty, `factory()` creates a new instance (matching original C++ behavior).

## Sprite Integration

Each pool optionally manages Three.js sprites:

```typescript
interface SpriteConfig {
  createSprite: () => THREE.Sprite;
  scene: THREE.Scene;
}
```

- On `acquire()`: sprite made visible, added to scene
- On `release()`: sprite hidden, removed from scene
- Sprites created once and reused — no dispose/recreate per shot
- `getSprite(entity)` provides access for position/animation sync
- Eliminates manual `Map<Bullet, Sprite>` and `Map<Snot, {sprite, texture}>` from main.ts

## Explosion Entity

New file `src/game/Explosion.ts`:

- Extends Entity with `EntityType.Explosion`
- No collision spheres, no physics — stays in place
- Frame-based animation: `currentFrame += animSpeed * dt`
- Auto-dies when `currentFrame > 81` (pool releases it)
- `reset()` method zeroes `currentFrame` and sets `alive = true`

**Constants:**
- `EXPLOSION_ANIM_SPEED`: 0.04 (from original)
- `EXPLOSION_TOTAL_FRAMES`: 81
- `EXPLOSION_BILLBOARD_SIZE`: 300
- `EXPLOSION_ATLAS_COLS`: 9 (9x9 grid = 81 cells)
- `EXPLOSION_ATLAS_ROWS`: 9

**Asset:** 81 explosion frames from `../turtle_svn/trunk/Turtle/media/explosion1/` packed into a single sprite atlas PNG.

**Rendering:** 300x300 billboard, additive blending (`THREE.AdditiveBlending`), atlas UV offset per frame — same pattern as sun/snot animation.

## Triggering

When a player's health reaches 0:
1. `explosionPool.acquire()` — get explosion entity
2. Position at dead player's location
3. Player entity marked dead (`alive = false`)
4. Explosion animates through 81 frames, auto-releases to pool

## main.ts Refactoring

1. **Remove** manual `bulletSprites` Map and `snotSprites` Map
2. **Create pools** at startup with factory/reset/spriteConfig
3. **Firing** changes: `bulletPool.acquire()` replaces `new Bullet()` + `entityManager.add()`
4. **Sprite sync** in game loop: `pool.forEachActive(syncFn)` replaces Map iteration
5. **Dead cleanup**: `pool.releaseInactive()` replaces `entityManager.removeDeadEntities()` for pooled types
6. **Collision detection** gathers all active entities: `[...entityManager.entities, ...bulletPool.activeEntities, ...snotPool.activeEntities]`
7. **Player death** listener spawns explosion via pool

**New EntityType:** `EntityType.Explosion` added to enum.

## Out of Scope

- Player respawn logic
- Particle effects (thrust trails, hit sparks)
- Pooling for character-specific bullet types (M10)
- Sound on explosion (M12)
- Asteroid pooling (M8)
