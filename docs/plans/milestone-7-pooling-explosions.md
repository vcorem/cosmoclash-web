# Milestone 7: Entity Pooling & Explosions

**Goal:** Pre-allocate and recycle entities from pools to avoid GC pressure. Add explosion effects when entities are destroyed.

**Depends on:** Milestone 3 (Collision Detection)

## Scope

### Entity Pooling
Mirrors `entitymgr.cpp` pool system:

Each entity type has a free list and a used list:
- When an entity is needed: pop from free list, initialize, move to used list
- When an entity expires/dies: reset, return to free list
- If free list is empty: create a new instance (graceful fallback)

**Pool Sizes (from original):**
| Entity Type | Pool Size |
|-------------|-----------|
| Plasma Bullets | 50 |
| Snots | 80 |
| Explosions | 15 |
| Sun Bullets | 50 |
| Flame Bullets | 50 |
| Frost Bullets | 20 |
| Ice Bullets | 100 |
| Asteroids (3 types) | 20 total |

For this milestone, implement pooling for:
- Plasma Bullets (50)
- Snots (80) — if M6 is done
- Explosions (15)

### Explosion System
- Triggered when: player dies, asteroid destroyed, bullet hits
- Visual: animated billboard sprite (81 frames, speed 0.04)
- Size: 300x300 billboard quad
- Blend mode: additive transparency
- Duration: ~2 seconds (auto-recycles when animation completes)
- Fallback: expanding/fading sphere if sprite unavailable

### Particle Effects (basic)
- **Player thrust:** particle emitter behind the ship when thrusting
  - Small bright particles emitted in the opposite direction of travel
  - Fade out quickly
- **Hit sparks:** small particle burst on bullet impact

### Pool API
```typescript
interface EntityPool<T extends Entity> {
  acquire(): T;          // Get from free list or create
  release(entity: T): void;  // Return to free list
  readonly activeCount: number;
  readonly poolSize: number;
}
```

## Out of Scope
- Pooling for character-specific bullet types (Milestone 10)
- Complex particle systems for frost/flame (Milestone 10)
- Sound on explosion (Milestone 12)

## Original C++ Reference
- `player/entitymgr.cpp` — pool initialization, free/used lists, acquire/release
- `Explosions/Explosion.h/cpp` — explosion animation, billboard rendering
- `player/player.cpp` — thrust particle emitter setup
