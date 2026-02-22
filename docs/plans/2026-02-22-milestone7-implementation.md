# M7: Entity Pooling & Explosions — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace on-demand entity allocation with generic object pools for bullets, snots, and explosions. Add animated explosion effect on player death.

**Architecture:** A single generic `EntityPool<T>` class handles free-list management and optional Three.js sprite lifecycle. Pooled entities are no longer tracked by `EntityManager` — each pool owns its active set. Collision detection gathers entities from all pools. An `Explosion` entity plays a 81-frame sprite animation and auto-recycles to pool.

**Tech Stack:** TypeScript, Three.js (sprites/materials), Vitest, Vite

---

### Task 1: Add EntityType.Explosion and explosion constants

**Files:**
- Modify: `src/engine/Entity.ts` (add enum value)
- Modify: `src/game/Arena.ts` (add constants)

**Step 1: Add `Explosion` to EntityType enum**

In `src/engine/Entity.ts`, add `Explosion` after `Snot`:

```typescript
export enum EntityType {
  Player,
  Bullet,
  Sun,
  Dummy,
  Snot,
  Explosion,
}
```

**Step 2: Add explosion constants to Arena**

In `src/game/Arena.ts`, add after the `SECONDARY_ENERGY_COST` line:

```typescript
  // Explosion
  EXPLOSION_ANIM_SPEED: 0.04,
  EXPLOSION_TOTAL_FRAMES: 81,
  EXPLOSION_BILLBOARD_SIZE: 300,
  EXPLOSION_ATLAS_COLS: 9,
  EXPLOSION_ATLAS_ROWS: 9,
```

**Step 3: Run existing tests to verify no regressions**

Run: `npx vitest run`
Expected: All existing tests pass.

**Step 4: Commit**

```bash
git add src/engine/Entity.ts src/game/Arena.ts
git commit -m "feat(m7): add EntityType.Explosion and explosion constants to Arena"
```

---

### Task 2: Create EntityPool\<T\> with tests (no sprites)

**Files:**
- Create: `src/engine/EntityPool.ts`
- Create: `src/engine/EntityPool.test.ts`

**Step 1: Write the failing tests**

Create `src/engine/EntityPool.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { EntityPool } from './EntityPool';
import { Entity } from './Entity';

function makeEntity(): Entity {
  return new Entity();
}

function resetEntity(e: Entity): void {
  e.alive = true;
  e.position = { x: 0, y: 0, z: 0 };
  e.accelVec = { x: 0, y: 0, z: 0 };
  e.health = 1;
}

describe('EntityPool', () => {
  let pool: EntityPool<Entity>;

  beforeEach(() => {
    pool = new EntityPool(makeEntity, resetEntity, 3);
  });

  describe('constructor', () => {
    it('pre-allocates initialSize entities in the free list', () => {
      expect(pool.activeCount).toBe(0);
      expect(pool.freeCount).toBe(3);
    });
  });

  describe('acquire', () => {
    it('returns an entity from the free list', () => {
      const e = pool.acquire();
      expect(e).toBeInstanceOf(Entity);
      expect(e.alive).toBe(true);
      expect(pool.activeCount).toBe(1);
      expect(pool.freeCount).toBe(2);
    });

    it('resets entity state on acquire', () => {
      const e = pool.acquire();
      e.position = { x: 999, y: 999, z: 999 };
      e.health = 0;
      pool.release(e);

      const e2 = pool.acquire();
      expect(e2).toBe(e); // same instance reused
      expect(e2.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(e2.health).toBe(1);
    });

    it('creates a new entity when free list is empty (graceful fallback)', () => {
      pool.acquire();
      pool.acquire();
      pool.acquire();
      // Free list exhausted — should create a new one
      const e4 = pool.acquire();
      expect(e4).toBeInstanceOf(Entity);
      expect(pool.activeCount).toBe(4);
      expect(pool.freeCount).toBe(0);
    });
  });

  describe('release', () => {
    it('returns entity to free list', () => {
      const e = pool.acquire();
      pool.release(e);
      expect(e.alive).toBe(false);
      expect(pool.activeCount).toBe(0);
      expect(pool.freeCount).toBe(3);
    });

    it('does not double-release', () => {
      const e = pool.acquire();
      pool.release(e);
      pool.release(e); // second release should be a no-op
      expect(pool.freeCount).toBe(3); // not 4
    });
  });

  describe('releaseInactive', () => {
    it('releases all entities where alive === false', () => {
      const e1 = pool.acquire();
      const e2 = pool.acquire();
      const e3 = pool.acquire();

      e1.alive = false;
      e3.alive = false;

      pool.releaseInactive();

      expect(pool.activeCount).toBe(1);
      expect(pool.freeCount).toBe(2);
    });
  });

  describe('forEachActive', () => {
    it('iterates over all active entities', () => {
      const e1 = pool.acquire();
      const e2 = pool.acquire();
      const visited: Entity[] = [];

      pool.forEachActive(e => visited.push(e));

      expect(visited).toContain(e1);
      expect(visited).toContain(e2);
      expect(visited).toHaveLength(2);
    });
  });

  describe('activeEntities', () => {
    it('returns array of all active entities', () => {
      const e1 = pool.acquire();
      const e2 = pool.acquire();

      const entities = pool.activeEntities;
      expect(entities).toContain(e1);
      expect(entities).toContain(e2);
      expect(entities).toHaveLength(2);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/EntityPool.test.ts`
Expected: FAIL — module not found.

**Step 3: Write the EntityPool implementation**

Create `src/engine/EntityPool.ts`:

```typescript
import { Entity } from './Entity';

export class EntityPool<T extends Entity> {
  private free: T[] = [];
  private active: Set<T> = new Set();
  private factory: () => T;
  private resetFn: (e: T) => void;

  constructor(
    factory: () => T,
    resetFn: (e: T) => void,
    initialSize: number,
  ) {
    this.factory = factory;
    this.resetFn = resetFn;
    for (let i = 0; i < initialSize; i++) {
      this.free.push(factory());
    }
  }

  acquire(): T {
    const entity = this.free.pop() ?? this.factory();
    this.resetFn(entity);
    entity.alive = true;
    this.active.add(entity);
    return entity;
  }

  release(entity: T): void {
    if (!this.active.has(entity)) return;
    entity.alive = false;
    this.active.delete(entity);
    this.free.push(entity);
  }

  releaseInactive(): void {
    for (const e of this.active) {
      if (!e.alive) {
        this.active.delete(e);
        this.free.push(e);
      }
    }
  }

  forEachActive(fn: (e: T) => void): void {
    for (const e of this.active) {
      fn(e);
    }
  }

  get activeEntities(): T[] {
    return Array.from(this.active);
  }

  get activeCount(): number {
    return this.active.size;
  }

  get freeCount(): number {
    return this.free.length;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/EntityPool.test.ts`
Expected: All 9 tests PASS.

**Step 5: Run all tests to check for regressions**

Run: `npx vitest run`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add src/engine/EntityPool.ts src/engine/EntityPool.test.ts
git commit -m "feat(m7): add generic EntityPool with free-list pooling"
```

---

### Task 3: Create Explosion entity with tests

**Files:**
- Create: `src/game/Explosion.ts`
- Create: `src/game/Explosion.test.ts`

**Step 1: Write the failing tests**

Create `src/game/Explosion.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Explosion } from './Explosion';
import { EntityType } from '@/engine/Entity';
import { ARENA } from './Arena';

describe('Explosion', () => {
  describe('constructor', () => {
    it('has EntityType.Explosion', () => {
      const e = new Explosion();
      expect(e.entityType).toBe(EntityType.Explosion);
    });

    it('has no collision spheres', () => {
      const e = new Explosion();
      expect(e.collisionSpheres).toHaveLength(0);
    });

    it('starts at frame 0', () => {
      const e = new Explosion();
      expect(e.currentFrame).toBe(0);
    });

    it('has autoWrap enabled', () => {
      const e = new Explosion();
      expect(e.autoWrap).toBe(true);
    });
  });

  describe('update', () => {
    it('advances frame by animSpeed * dt', () => {
      const e = new Explosion();
      e.update(100);
      expect(e.currentFrame).toBeCloseTo(ARENA.EXPLOSION_ANIM_SPEED * 100);
    });

    it('does not move position (no physics)', () => {
      const e = new Explosion();
      e.position = { x: 50, y: 50, z: 0 };
      e.accelVec = { x: 1, y: 1, z: 0 };
      e.update(100);
      expect(e.position).toEqual({ x: 50, y: 50, z: 0 });
    });

    it('destroys itself when animation completes', () => {
      const e = new Explosion();
      // Advance past all frames: 81 / 0.04 = 2025 dt
      e.update(2100);
      expect(e.currentFrame).toBeGreaterThan(ARENA.EXPLOSION_TOTAL_FRAMES);
      expect(e.alive).toBe(false);
    });

    it('stays alive during animation', () => {
      const e = new Explosion();
      e.update(100);
      expect(e.alive).toBe(true);
    });
  });

  describe('reset', () => {
    it('resets frame to 0 and marks alive', () => {
      const e = new Explosion();
      e.update(1000);
      e.reset();
      expect(e.currentFrame).toBe(0);
      expect(e.alive).toBe(true);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/game/Explosion.test.ts`
Expected: FAIL — module not found.

**Step 3: Write the Explosion implementation**

Create `src/game/Explosion.ts`:

```typescript
import { Entity, EntityType } from '@/engine/Entity';
import { ARENA } from './Arena';

export class Explosion extends Entity {
  currentFrame: number = 0;

  constructor() {
    super();
    this.entityType = EntityType.Explosion;
    this.collisionSpheres = [];
    this.autoWrap = true;
  }

  override update(dt: number): void {
    // No physics — explosion stays in place
    this.currentFrame += ARENA.EXPLOSION_ANIM_SPEED * dt;
    if (this.currentFrame > ARENA.EXPLOSION_TOTAL_FRAMES) {
      this.destroy();
    }
  }

  reset(): void {
    this.currentFrame = 0;
    this.alive = true;
    this.position = { x: 0, y: 0, z: 0 };
    this.accelVec = { x: 0, y: 0, z: 0 };
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/game/Explosion.test.ts`
Expected: All 7 tests PASS.

**Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add src/game/Explosion.ts src/game/Explosion.test.ts
git commit -m "feat(m7): add Explosion entity with frame animation and auto-death"
```

---

### Task 4: Pack explosion sprite atlas from original assets

**Files:**
- Create: `public/textures/explosion_atlas.jpg` (generated)
- Create: `scripts/pack-atlas.sh` (helper script)

**Context:** The 81 explosion frames are at `../turtle_svn/trunk/Turtle/mediaflat/explosion1/explosion1_0000.jpg` through `explosion1_0080.jpg`. We need a 9x9 atlas (81 cells) matching the pattern used for the existing `sun_atlas.jpg` and `snot_atlas.png`.

**Step 1: Create atlas packing script**

Create `scripts/pack-atlas.sh`:

```bash
#!/bin/bash
# Pack 81 explosion frames into a 9x9 sprite atlas.
# Requires ImageMagick (montage command).
# Usage: ./scripts/pack-atlas.sh

SRC="../turtle_svn/trunk/Turtle/mediaflat/explosion1"
OUT="public/textures/explosion_atlas.jpg"
COLS=9

# Collect frames in order
FILES=""
for i in $(seq -w 0 80); do
  FILES="$FILES $SRC/explosion1_00${i}.jpg"
done

montage $FILES -tile ${COLS}x -geometry +0+0 -background black "$OUT"
echo "Created $OUT"
```

**Step 2: Run the script**

```bash
chmod +x scripts/pack-atlas.sh
./scripts/pack-atlas.sh
```

Expected: `public/textures/explosion_atlas.jpg` is created. Verify it visually by opening it.

**Step 3: Verify the atlas exists and has reasonable size**

```bash
ls -la public/textures/explosion_atlas.jpg
```

Expected: File exists, reasonable size (likely 500KB-2MB).

**Step 4: Commit**

```bash
git add scripts/pack-atlas.sh public/textures/explosion_atlas.jpg
git commit -m "asset(m7): add explosion sprite sheet atlas (81 frames, 9x9 grid)"
```

---

### Task 5: Integrate bullet pool into main.ts

**Files:**
- Modify: `src/main.ts`
- Modify: `src/game/Bullet.ts` (add reset method)

This is the first pool integration. It replaces the manual `bulletSprites` Map with `EntityPool<Bullet>`.

**Step 1: Add reset method to Bullet**

In `src/game/Bullet.ts`, add a `reset` method and make `config`/`originEntity` writable for pool reuse:

```typescript
export class Bullet extends Entity {
  config: BulletConfig;
  originEntity: Entity | null;
  ttl: number;

  constructor(config: BulletConfig, originEntity: Entity | null = null) {
    super();
    this.entityType = EntityType.Bullet;
    this.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: config.collisionRadius }];
    this.config = config;
    this.originEntity = originEntity;
    this.ttl = config.maxTtl;
  }

  reset(config: BulletConfig, originEntity: Entity | null): void {
    this.config = config;
    this.originEntity = originEntity;
    this.ttl = config.maxTtl;
    this.alive = true;
    this.position = { x: 0, y: 0, z: 0 };
    this.previousPosition = { x: 0, y: 0, z: 0 };
    this.accelVec = { x: 0, y: 0, z: 0 };
    this.angle = 0;
    this.health = 1;
    this.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: config.collisionRadius }];
  }

  update(dt: number): void {
    super.update(dt);
    this.ttl -= dt;
    if (this.ttl <= 0) {
      this.destroy();
    }
  }
}
```

**Step 2: Run existing Bullet tests to verify no regressions**

Run: `npx vitest run src/game/Bullet.test.ts`
Expected: All pass. The `readonly` removal doesn't break existing tests.

**Step 3: Replace bulletSprites Map with EntityPool in main.ts**

Key changes in `src/main.ts`:

1. Add import for `EntityPool`:
```typescript
import { EntityPool } from '@/engine/EntityPool';
```

2. Replace the `bulletSprites` Map (line 99) with a pool:
```typescript
// Bullet pool with sprite management
const BULLET_POOL_SIZE = 50;
const bulletPool = new EntityPool<Bullet>(
  () => new Bullet(FLAME_BULLET_CONFIG),
  (b) => { /* reset is called per-acquire with specific config */ },
  BULLET_POOL_SIZE,
);

// Sprite tracking for pooled bullets (sprites are reused with the entity)
const bulletSpriteMap = new Map<Bullet, THREE.Sprite>();

function acquireBullet(config: BulletConfig, origin: Entity): Bullet {
  const bullet = bulletPool.acquire();
  bullet.reset(config, origin);
  // Create sprite if this entity doesn't have one yet
  if (!bulletSpriteMap.has(bullet)) {
    const mat = new THREE.SpriteMaterial({
      map: flameTexture,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(35, 35, 1);
    bulletSpriteMap.set(bullet, sprite);
  }
  const sprite = bulletSpriteMap.get(bullet)!;
  sprite.visible = true;
  scene.add(sprite);
  return bullet;
}
```

3. In `updatePlayerInput`, change the fire-primary block (lines 219-233):
```typescript
  if (pi.firePrimary) {
    if (player.primaryCooldown <= 0 && player.energy > player.stats.primaryEnergyCost) {
      player.energy -= player.stats.primaryEnergyCost;
      player.primaryCooldown = player.stats.primaryWeaponDelay;

      const bullet = acquireBullet(player.stats.primaryBulletConfig, player);
      bullet.angle = player.angle;

      const spawnVec = player.getFullSpeedVec(25);
      bullet.position = {
        x: player.position.x + spawnVec.x,
        y: player.position.y + spawnVec.y,
        z: player.position.z,
      };
      const speedVec = player.getFullSpeedVec(player.stats.primaryBulletConfig.speedMaxScaler);
      bullet.accelVec = { ...speedVec };
    }
  }
```

4. In the game loop, replace the bullet sprite sync block (lines 313-322):
```typescript
    // Sync bullet sprites and release dead ones
    bulletPool.forEachActive((bullet) => {
      const sprite = bulletSpriteMap.get(bullet);
      if (!sprite) return;
      sprite.position.set(bullet.position.x, bullet.position.y, bullet.position.z);
    });
    bulletPool.releaseInactive();
    // Hide sprites of released bullets
    for (const [bullet, sprite] of bulletSpriteMap) {
      if (!bullet.alive) {
        sprite.visible = false;
        scene.remove(sprite);
      }
    }
```

5. In collision detection (line 272), gather pooled bullets:
```typescript
    const allEntities = [
      ...entityManager.entities,
      ...bulletPool.activeEntities,
    ];
    collisionDetector.checkCollisions(allEntities);
```

6. Remove `entityManager.add(bullet)` from anywhere it still exists — bullets are now in the pool, not EntityManager.

**Step 4: Run all tests and verify the app builds**

Run: `npx vitest run && npx tsc --noEmit`
Expected: All tests pass, no type errors.

**Step 5: Manual smoke test**

Run: `npx vite dev`, open browser, fire bullets. Verify:
- Bullets appear and move correctly
- Bullets disappear when TTL expires or on hit
- No visual glitches

**Step 6: Commit**

```bash
git add src/game/Bullet.ts src/main.ts src/engine/EntityPool.ts
git commit -m "feat(m7): integrate bullet pool into game loop"
```

---

### Task 6: Integrate snot pool into main.ts

**Files:**
- Modify: `src/main.ts`
- Modify: `src/game/Snot.ts` (add reset method)

**Step 1: Add reset method to Snot**

In `src/game/Snot.ts`, add a `reset` method:

```typescript
  reset(origin: Entity, target: Player): void {
    super.reset(SNOT_CONFIG, origin);
    this.entityType = EntityType.Snot;
    this.target = target;
    this.attached = false;
    this.victim = null;
    this.currentFrame = 0;
    this.orbitOffset = { x: 0, y: 0, z: 0 };
  }
```

Note: `orbitOffset` is currently private. Change it to `private` → keep it private but reset it in the method since it's inside the class.

**Step 2: Run existing Snot tests**

Run: `npx vitest run src/game/Snot.test.ts`
Expected: All pass.

**Step 3: Replace snotSprites Map with pool in main.ts**

Key changes:

1. Replace the `snotSprites` Map (line 160) with a pool:
```typescript
const SNOT_POOL_SIZE = 80;
const snotPool = new EntityPool<Snot>(
  () => new Snot(player1, player2), // dummy args, reset on acquire
  () => { /* reset called per-acquire */ },
  SNOT_POOL_SIZE,
);

const snotSpriteMap = new Map<Snot, { sprite: THREE.Sprite; texture: THREE.Texture }>();

function acquireSnot(origin: Entity, target: Player): Snot {
  const snot = snotPool.acquire();
  snot.reset(origin as Entity, target);
  if (!snotSpriteMap.has(snot)) {
    const mat = new THREE.SpriteMaterial({
      map: snotTexture.clone(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    mat.map!.repeat.set(1 / SNOT_ATLAS_COLS, 1 / SNOT_ATLAS_ROWS);
    mat.map!.wrapS = THREE.RepeatWrapping;
    mat.map!.wrapT = THREE.RepeatWrapping;
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(ARENA.SNOT_BILLBOARD_SIZE, ARENA.SNOT_BILLBOARD_SIZE, 1);
    snotSpriteMap.set(snot, { sprite, texture: mat.map! });
  }
  const { sprite } = snotSpriteMap.get(snot)!;
  sprite.visible = true;
  scene.add(sprite);
  return snot;
}
```

2. In `updatePlayerInput`, change the fire-secondary block (lines 235-253):
```typescript
  if (pi.fireSecondary) {
    if (player.secondaryCooldown <= 0 && player.energy > player.stats.primaryEnergyCost) {
      player.energy -= player.stats.primaryEnergyCost;
      player.secondaryCooldown = ARENA.SECONDARY_WEAPON_DELAY;

      const snot = acquireSnot(player, enemy);
      snot.angle = player.angle;

      const spawnVec = player.getFullSpeedVec(25);
      snot.position = {
        x: player.position.x + spawnVec.x,
        y: player.position.y + spawnVec.y,
        z: player.position.z,
      };
      const speedVec = player.getFullSpeedVec(SNOT_CONFIG.speedMaxScaler);
      snot.accelVec = { ...speedVec };
    }
  }
```

3. In the game loop, replace snot sprite sync block (lines 324-339):
```typescript
    // Sync snot sprites
    snotPool.forEachActive((snot) => {
      const entry = snotSpriteMap.get(snot);
      if (!entry) return;
      const { sprite, texture } = entry;
      sprite.position.set(snot.position.x, snot.position.y, snot.position.z);
      const frameIndex = Math.floor(snot.currentFrame);
      const col = frameIndex % SNOT_ATLAS_COLS;
      const row = Math.floor(frameIndex / SNOT_ATLAS_COLS);
      texture.offset.set(col / SNOT_ATLAS_COLS, 1 - (row + 1) / SNOT_ATLAS_ROWS);
    });
    snotPool.releaseInactive();
    for (const [snot, { sprite }] of snotSpriteMap) {
      if (!snot.alive) {
        sprite.visible = false;
        scene.remove(sprite);
      }
    }
```

4. Update sun gravity loop to use pool:
```typescript
    // Sun gravity on snots in flight
    snotPool.forEachActive((snot) => {
      if (!snot.attached) {
        applySunGravity(snot, ARENA.SUN_POSITION, dt);
      }
    });
```

5. Add snots to collision detection entity gathering:
```typescript
    const allEntities = [
      ...entityManager.entities,
      ...bulletPool.activeEntities,
      ...snotPool.activeEntities,
    ];
    collisionDetector.checkCollisions(allEntities);
```

6. Remove `entityManager.add(snot)` — snots are now pooled.

**Step 4: Update snot pool update in game loop**

Snot entities need their `update()` called. Since they're no longer in EntityManager, add:

```typescript
    // Update pooled entities
    snotPool.forEachActive((snot) => {
      snot.update(dt);
      snot.handleWrapAround(camCenter);
    });
    bulletPool.forEachActive((bullet) => {
      bullet.update(dt);
      bullet.handleWrapAround(camCenter);
    });
```

This replaces the EntityManager update for these types. **Important:** also remove bullets/snots from `entityManager.add()` calls so they aren't double-updated.

**Step 5: Run all tests and type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: All pass.

**Step 6: Manual smoke test**

Run: `npx vite dev`. Verify:
- Snots fire, track, attach, orbit, and expire correctly
- Bullets still work
- No visual glitches

**Step 7: Commit**

```bash
git add src/game/Snot.ts src/main.ts
git commit -m "feat(m7): integrate snot pool into game loop"
```

---

### Task 7: Integrate explosion pool and player death trigger

**Files:**
- Modify: `src/main.ts`
- Modify: `src/game/CollisionHandler.ts` (emit ExplosionEvent on player death)

**Step 1: Load explosion atlas texture in main.ts**

Add near the other texture loads:

```typescript
import { Explosion } from '@/game/Explosion';

// Explosion sprites — animated billboard with sprite sheet atlas
const EXPL_ATLAS_COLS = ARENA.EXPLOSION_ATLAS_COLS;
const EXPL_ATLAS_ROWS = ARENA.EXPLOSION_ATLAS_ROWS;

const explosionTexture = new THREE.TextureLoader().load('/textures/explosion_atlas.jpg');
explosionTexture.repeat.set(1 / EXPL_ATLAS_COLS, 1 / EXPL_ATLAS_ROWS);
explosionTexture.wrapS = THREE.RepeatWrapping;
explosionTexture.wrapT = THREE.RepeatWrapping;
```

**Step 2: Create explosion pool**

```typescript
const EXPLOSION_POOL_SIZE = 15;
const explosionPool = new EntityPool<Explosion>(
  () => new Explosion(),
  (e) => e.reset(),
  EXPLOSION_POOL_SIZE,
);

const explosionSpriteMap = new Map<Explosion, THREE.Sprite>();

function spawnExplosion(x: number, y: number, z: number): void {
  const expl = explosionPool.acquire();
  expl.position = { x, y, z };
  expl.previousPosition = { x, y, z };

  if (!explosionSpriteMap.has(expl)) {
    const mat = new THREE.SpriteMaterial({
      map: explosionTexture.clone(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    mat.map!.repeat.set(1 / EXPL_ATLAS_COLS, 1 / EXPL_ATLAS_ROWS);
    mat.map!.wrapS = THREE.RepeatWrapping;
    mat.map!.wrapT = THREE.RepeatWrapping;
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(ARENA.EXPLOSION_BILLBOARD_SIZE, ARENA.EXPLOSION_BILLBOARD_SIZE, 1);
    explosionSpriteMap.set(expl, sprite);
  }
  const sprite = explosionSpriteMap.get(expl)!;
  sprite.visible = true;
  scene.add(sprite);
}
```

**Step 3: Listen for ExplosionEvent and wire up player death**

Register a listener for `GameEventType.Explosion` that spawns an explosion:

```typescript
import { ExplosionEvent } from '@/engine/GameEvent';

const explosionListener: GameEventListener = {
  onGameEvent(event: GameEvent) {
    if (event.type === GameEventType.Explosion) {
      const e = (event as ExplosionEvent).entity;
      spawnExplosion(e.position.x, e.position.y, e.position.z);
    }
  },
};
GameEventMgr.getInstance().addListener(explosionListener, GameEventType.Explosion);
```

Add the import for `GameEventListener` from `@/engine/GameEventMgr` and `GameEvent` from `@/engine/GameEvent`.

**Step 4: Modify CollisionHandler to emit ExplosionEvent on player death**

In `src/game/CollisionHandler.ts`, wherever `target.destroy()` or `a.destroy()` / `b.destroy()` is called for a Player entity, also emit an `ExplosionEvent`:

In `handleBulletHit`:
```typescript
  private handleBulletHit(event: BulletHitEvent): void {
    const bullet = event.bullet as Bullet;
    const target = event.target;

    if (target.entityType !== EntityType.Sun) {
      target.health -= bullet.config.damage;
      if (target.health <= 0) {
        target.destroy();
        if (target.entityType === EntityType.Player) {
          GameEventMgr.getInstance().sendEvent(new ExplosionEvent(target));
        }
      }
    }

    bullet.destroy();
  }
```

In `handleShipCollision`:
```typescript
    if (a.health <= 0) {
      a.destroy();
      if (a.entityType === EntityType.Player) {
        GameEventMgr.getInstance().sendEvent(new ExplosionEvent(a));
      }
    }
    if (b.health <= 0) {
      b.destroy();
      if (b.entityType === EntityType.Player) {
        GameEventMgr.getInstance().sendEvent(new ExplosionEvent(b));
      }
    }
```

In `handleSunCollision`:
```typescript
    other.health -= ARENA.SUN_DAMAGE;
    if (other.health <= 0) {
      other.destroy();
      if (other.entityType === EntityType.Player) {
        GameEventMgr.getInstance().sendEvent(new ExplosionEvent(other));
      }
    }
```

Add import for `GameEventMgr` and `ExplosionEvent`:
```typescript
import { GameEventMgr } from '@/engine/GameEventMgr';
import { GameEvent, GameEventType, BulletHitEvent, CollisionEvent, SunCollisionEvent, SnotHitEvent, ExplosionEvent } from '@/engine/GameEvent';
```

**Step 5: Add explosion update and sprite sync to game loop**

In the game loop, add after the snot sync block:

```typescript
    // Update explosions
    explosionPool.forEachActive((expl) => {
      expl.update(dt);
      expl.handleWrapAround(camCenter);
    });

    // Sync explosion sprites
    explosionPool.forEachActive((expl) => {
      const sprite = explosionSpriteMap.get(expl);
      if (!sprite) return;
      sprite.position.set(expl.position.x, expl.position.y, expl.position.z);
      const frameIndex = Math.floor(expl.currentFrame);
      const col = frameIndex % EXPL_ATLAS_COLS;
      const row = Math.floor(frameIndex / EXPL_ATLAS_COLS);
      (sprite.material as THREE.SpriteMaterial).map!.offset.set(
        col / EXPL_ATLAS_COLS,
        1 - (row + 1) / EXPL_ATLAS_ROWS,
      );
    });
    explosionPool.releaseInactive();
    for (const [expl, sprite] of explosionSpriteMap) {
      if (!expl.alive) {
        sprite.visible = false;
        scene.remove(sprite);
      }
    }
```

**Step 6: Also hide the dead player's mesh**

After `syncMesh` calls, add logic to hide dead players:

```typescript
    if (p1Mesh) p1Mesh.visible = player1.alive;
    if (p2Mesh) p2Mesh.visible = player2.alive;
```

**Step 7: Run all tests and type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: All pass. The CollisionHandler tests don't test for explosion events being sent (they just test damage/destroy), so existing tests should still pass.

**Step 8: Manual smoke test**

Run: `npx vite dev`. To test:
- Lower a player's health (shoot them repeatedly)
- When health reaches 0, the player should disappear and an explosion animation should play at their position
- Explosion should animate for ~2 seconds then disappear
- Fire many bullets to test pool recycling

**Step 9: Commit**

```bash
git add src/main.ts src/game/CollisionHandler.ts src/game/Explosion.ts
git commit -m "feat(m7): integrate explosion pool and player death trigger"
```

---

### Task 8: Clean up EntityManager usage and remove dead code

**Files:**
- Modify: `src/main.ts`
- Modify: `src/engine/EntityManager.ts` (optional cleanup)

**Step 1: Verify EntityManager only holds players and sun**

After all pool integrations, `EntityManager` should only contain `player1`, `player2`, and `sun`. Bullets and snots are fully pooled.

In the game loop, verify:
- `entityManager.removeDeadEntities()` is still called (for player/sun death)
- `entityManager.update()` is still called (for player/sun physics)
- No `entityManager.add(bullet)` or `entityManager.add(snot)` calls remain

**Step 2: Remove any leftover bulletSprites/snotSprites references**

Search for any remaining references to the old `bulletSprites` and `snotSprites` Maps. Delete them.

**Step 3: Run all tests and type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: All pass.

**Step 4: Full manual smoke test**

Run: `npx vite dev`. Verify all gameplay:
- Two players can fly, shoot, fire snots
- Bullets pool and recycle (fire many rapidly)
- Snots track, attach, orbit, expire
- Player death shows explosion
- Sun gravity works on bullets and snots
- Collision detection works for all entity types
- No console errors or memory leaks (check DevTools)

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor(m7): clean up EntityManager after pool migration"
```

---

### Task 9: Playwright visual smoke test

**Files:**
- None created (uses Playwright MCP browser tools)

**Step 1: Start the dev server**

```bash
npx vite dev &
```

Wait for the server to be ready on `http://localhost:5173`.

**Step 2: Open the game in Playwright browser**

Navigate to `http://localhost:5173` using the Playwright MCP browser.

**Step 3: Take a baseline screenshot**

Take a screenshot to verify the game loads and both players are visible.

**Step 4: Simulate gameplay with keyboard input**

Use Playwright to:
- Press and hold `w` (player 1 thrust) for 2 seconds
- Press `space` (player 1 fire) repeatedly to fire bullets
- Verify bullets appear on screen (take screenshot)

**Step 5: Test explosion by killing a player**

Use the browser console to set a player's health to near-zero:
```javascript
// Access game state (depends on how globals are exposed)
// If not directly accessible, fire many bullets at player 2
```

Alternatively: position both players close and fire many shots to trigger death.

**Step 6: Verify explosion visual**

Take a screenshot during/after the explosion to verify:
- Explosion sprite appears at the death location
- Explosion is rendered with additive blending (bright, not dark)
- Explosion animates and disappears

**Step 7: Verify no console errors**

Check browser console for any errors or warnings.

**Step 8: Stop the dev server**

```bash
kill %1
```

---

## Summary of New/Modified Files

| File | Action | Purpose |
|------|--------|---------|
| `src/engine/EntityPool.ts` | Create | Generic pool class |
| `src/engine/EntityPool.test.ts` | Create | Pool unit tests |
| `src/game/Explosion.ts` | Create | Explosion entity |
| `src/game/Explosion.test.ts` | Create | Explosion unit tests |
| `src/engine/Entity.ts` | Modify | Add EntityType.Explosion |
| `src/game/Arena.ts` | Modify | Add explosion constants |
| `src/game/Bullet.ts` | Modify | Remove readonly, add reset() |
| `src/game/Snot.ts` | Modify | Add reset() |
| `src/game/CollisionHandler.ts` | Modify | Emit ExplosionEvent on player death |
| `src/main.ts` | Modify | Replace Maps with pools, add explosion system |
| `scripts/pack-atlas.sh` | Create | Asset packing script |
| `public/textures/explosion_atlas.jpg` | Create | Explosion sprite atlas |
