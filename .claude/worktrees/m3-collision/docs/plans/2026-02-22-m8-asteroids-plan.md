# M8: Asteroids — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 10 pooled asteroids with 3 type variants, collision physics, gravity, and 3D mesh rendering — matching the original C++ implementation.

**Architecture:** Asteroid extends Entity with rotation state. EntityPool<Asteroid> manages lifecycle. Map<Asteroid, THREE.Group> tracks cloned glTF meshes. CollisionDetector skips asteroid-asteroid/snot/explosion pairs. CollisionHandler destroys asteroids on bullet hit (one-shot kill) and bounces players without damage.

**Tech Stack:** TypeScript, Three.js, Vitest, GLTFLoader, Assimp (asset conversion)

---

### Task 1: Add EntityType.Asteroid and Arena Constants

**Files:**
- Modify: `src/engine/Entity.ts:14-21` (EntityType enum)
- Modify: `src/game/Arena.ts:1-57` (add constants)

**Step 1: Add Asteroid to EntityType enum**

In `src/engine/Entity.ts`, add `Asteroid` to the enum:

```typescript
export enum EntityType {
  Player,
  Bullet,
  Sun,
  Dummy,
  Snot,
  Explosion,
  Asteroid,
}
```

**Step 2: Add asteroid constants to Arena.ts**

In `src/game/Arena.ts`, add before the closing `} as const;`:

```typescript
  // Asteroids
  ASTEROID_COUNT: 10,
  ASTEROID_ROTATION_SPEED: 0.1,
  ASTEROID_SPEED: 0.1,
  ASTEROID_SPEED_MAX_SCALER: 0.1,
  ASTEROID_COLLISION_RADII: [8, 18, 15] as readonly number[],
  ASTEROID_MESH_SCALE: 10,
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Run existing tests to confirm no regressions**

Run: `npx vitest run`
Expected: All 233 tests pass

**Step 5: Commit**

```bash
git add src/engine/Entity.ts src/game/Arena.ts
git commit -m "feat(m8): add EntityType.Asteroid and arena constants"
```

---

### Task 2: Create Asteroid Class (TDD)

**Files:**
- Create: `src/game/Asteroid.ts`
- Create: `src/game/Asteroid.test.ts`

**Step 1: Write failing tests for Asteroid class**

Create `src/game/Asteroid.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Asteroid } from './Asteroid';
import { EntityType } from '@/engine/Entity';
import { ARENA } from './Arena';

describe('Asteroid', () => {
  describe('constructor', () => {
    it('sets entityType to Asteroid', () => {
      const a = new Asteroid(0);
      expect(a.entityType).toBe(EntityType.Asteroid);
    });

    it('sets collision sphere radius based on type 0', () => {
      const a = new Asteroid(0);
      expect(a.collisionSpheres).toHaveLength(1);
      expect(a.collisionSpheres[0].radius).toBe(ARENA.ASTEROID_COLLISION_RADII[0]);
    });

    it('sets collision sphere radius based on type 1', () => {
      const a = new Asteroid(1);
      expect(a.collisionSpheres[0].radius).toBe(ARENA.ASTEROID_COLLISION_RADII[1]);
    });

    it('sets collision sphere radius based on type 2', () => {
      const a = new Asteroid(2);
      expect(a.collisionSpheres[0].radius).toBe(ARENA.ASTEROID_COLLISION_RADII[2]);
    });

    it('stores asteroidType', () => {
      const a = new Asteroid(1);
      expect(a.asteroidType).toBe(1);
    });

    it('enables autoWrap', () => {
      const a = new Asteroid(0);
      expect(a.autoWrap).toBe(true);
    });

    it('initializes rotation angles between 0 and 360', () => {
      const a = new Asteroid(0);
      expect(a.curXAngle).toBeGreaterThanOrEqual(0);
      expect(a.curXAngle).toBeLessThan(360);
      expect(a.curYAngle).toBeGreaterThanOrEqual(0);
      expect(a.curYAngle).toBeLessThan(360);
    });

    it('sets initial accelVec based on random heading', () => {
      const a = new Asteroid(0);
      const speed = Math.sqrt(
        a.accelVec.x * a.accelVec.x +
        a.accelVec.y * a.accelVec.y +
        a.accelVec.z * a.accelVec.z,
      );
      expect(speed).toBeCloseTo(ARENA.ASTEROID_SPEED_MAX_SCALER, 5);
    });
  });

  describe('update', () => {
    it('advances rotation angles by dt * rotationSpeed', () => {
      const a = new Asteroid(0);
      a.curXAngle = 10;
      a.curYAngle = 20;
      a.update(100);
      expect(a.curXAngle).toBeCloseTo(10 + 100 * ARENA.ASTEROID_ROTATION_SPEED);
      expect(a.curYAngle).toBeCloseTo(20 + 100 * ARENA.ASTEROID_ROTATION_SPEED);
    });

    it('wraps rotation angles at 360', () => {
      const a = new Asteroid(0);
      a.curXAngle = 359;
      a.curYAngle = 359;
      a.update(100); // 359 + 10 = 369 → wraps to 9
      expect(a.curXAngle).toBeCloseTo(369 - 360);
      expect(a.curYAngle).toBeCloseTo(369 - 360);
    });

    it('applies physics via super.update (moves position by accelVec)', () => {
      const a = new Asteroid(0);
      a.position = { x: 100, y: 200, z: 0 };
      a.accelVec = { x: 1, y: 0, z: 0 };
      a.update(10);
      // super.update: position.x += accelVec.x * dt * TIME_SCALER
      expect(a.position.x).toBeCloseTo(100 + 1 * 10 * ARENA.TIME_SCALER);
    });
  });

  describe('reset', () => {
    it('resets position and velocity', () => {
      const a = new Asteroid(0);
      a.position = { x: 999, y: 999, z: 999 };
      a.accelVec = { x: 5, y: 5, z: 5 };
      a.health = 0;
      a.alive = false;
      a.reset(2);
      expect(a.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(a.health).toBe(1);
      expect(a.alive).toBe(true);
      expect(a.asteroidType).toBe(2);
      expect(a.collisionSpheres[0].radius).toBe(ARENA.ASTEROID_COLLISION_RADII[2]);
    });

    it('randomizes rotation angles on reset', () => {
      const a = new Asteroid(0);
      a.curXAngle = 0;
      a.curYAngle = 0;
      // Reset multiple times — at least one should differ from 0
      const angles: number[] = [];
      for (let i = 0; i < 10; i++) {
        a.reset(0);
        angles.push(a.curXAngle);
      }
      const allZero = angles.every((v) => v === 0);
      expect(allZero).toBe(false);
    });

    it('sets a new random accelVec direction', () => {
      const a = new Asteroid(0);
      a.reset(0);
      const speed = Math.sqrt(
        a.accelVec.x * a.accelVec.x +
        a.accelVec.y * a.accelVec.y +
        a.accelVec.z * a.accelVec.z,
      );
      expect(speed).toBeCloseTo(ARENA.ASTEROID_SPEED_MAX_SCALER, 5);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/game/Asteroid.test.ts`
Expected: FAIL — module `./Asteroid` not found

**Step 3: Implement Asteroid class**

Create `src/game/Asteroid.ts`:

```typescript
import { Entity, EntityType } from '@/engine/Entity';
import { ARENA } from './Arena';

export class Asteroid extends Entity {
  asteroidType: number;
  curXAngle: number;
  curYAngle: number;

  constructor(type: number) {
    super();
    this.entityType = EntityType.Asteroid;
    this.asteroidType = type;
    this.autoWrap = true;
    this.curXAngle = Math.random() * 360;
    this.curYAngle = Math.random() * 360;
    this.collisionSpheres = [
      { offset: { x: 0, y: 0, z: 0 }, radius: ARENA.ASTEROID_COLLISION_RADII[type] },
    ];
    // Set initial velocity in a random direction
    this.angle = Math.random() * 360;
    this.accelVec = this.getFullSpeedVec(ARENA.ASTEROID_SPEED_MAX_SCALER);
  }

  override update(dt: number): void {
    // Advance rotation
    this.curXAngle += dt * ARENA.ASTEROID_ROTATION_SPEED;
    if (this.curXAngle >= 360) this.curXAngle -= 360;
    this.curYAngle += dt * ARENA.ASTEROID_ROTATION_SPEED;
    if (this.curYAngle >= 360) this.curYAngle -= 360;

    // Physics (position += accelVec * dt * TIME_SCALER)
    super.update(dt);
  }

  reset(type: number): void {
    this.asteroidType = type;
    this.alive = true;
    this.health = 1;
    this.position = { x: 0, y: 0, z: 0 };
    this.previousPosition = { x: 0, y: 0, z: 0 };
    this.curXAngle = Math.random() * 360;
    this.curYAngle = Math.random() * 360;
    this.collisionSpheres = [
      { offset: { x: 0, y: 0, z: 0 }, radius: ARENA.ASTEROID_COLLISION_RADII[type] },
    ];
    this.angle = Math.random() * 360;
    this.accelVec = this.getFullSpeedVec(ARENA.ASTEROID_SPEED_MAX_SCALER);
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/game/Asteroid.test.ts`
Expected: All tests PASS

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (233 + new asteroid tests)

**Step 6: Commit**

```bash
git add src/game/Asteroid.ts src/game/Asteroid.test.ts
git commit -m "feat(m8): add Asteroid class with rotation and pool reset"
```

---

### Task 3: Collision Skip Rules for Asteroids (TDD)

**Files:**
- Modify: `src/engine/CollisionDetector.ts:101-125` (shouldCheck method)
- Modify: `src/engine/CollisionDetector.test.ts` (add asteroid collision tests)

**Step 1: Write failing tests for asteroid collision skip rules**

Append to `src/engine/CollisionDetector.test.ts` inside the `CollisionDetector` describe block:

```typescript
  describe('asteroid collision rules', () => {
    it('skips asteroid-asteroid collision', () => {
      const { Asteroid } = await import('@/game/Asteroid');
      const a1 = new Asteroid(0);
      a1.position = { x: 0, y: 0, z: 0 };
      a1.previousPosition = { x: 0, y: 0, z: 0 };

      const a2 = new Asteroid(1);
      a2.position = { x: 5, y: 0, z: 0 };
      a2.previousPosition = { x: 5, y: 0, z: 0 };

      const events: GameEvent[] = [];
      GameEventMgr.getInstance().addListener(
        { onGameEvent: (e) => events.push(e) },
        GameEventType.Collision,
      );

      detector.checkCollisions([a1, a2]);
      expect(events).toHaveLength(0);
    });

    it('skips asteroid-snot collision', () => {
      const { Asteroid } = await import('@/game/Asteroid');
      const asteroid = new Asteroid(0);
      asteroid.position = { x: 0, y: 0, z: 0 };
      asteroid.previousPosition = { x: 0, y: 0, z: 0 };

      const origin = new Player(GONDI_STATS);
      const target = new Player(GONDI_STATS);
      const snot = new Snot(origin, target);
      snot.position = { x: 0, y: 0, z: 0 };
      snot.previousPosition = { x: 0, y: 0, z: 0 };

      const events: GameEvent[] = [];
      GameEventMgr.getInstance().addListener(
        { onGameEvent: (e) => events.push(e) },
        GameEventType.SnotHit,
      );
      GameEventMgr.getInstance().addListener(
        { onGameEvent: (e) => events.push(e) },
        GameEventType.Collision,
      );

      detector.checkCollisions([asteroid, snot]);
      expect(events).toHaveLength(0);
    });

    it('allows asteroid-bullet collision (emits BulletHitEvent)', () => {
      const { Asteroid } = await import('@/game/Asteroid');
      const asteroid = new Asteroid(1);
      asteroid.position = { x: 50, y: 0, z: 0 };
      asteroid.previousPosition = { x: 50, y: 0, z: 0 };

      const shooter = new Entity();
      shooter.entityType = EntityType.Player;

      const bullet = new Bullet(FLAME_BULLET_CONFIG, shooter);
      bullet.position = { x: 50, y: 0, z: 0 };
      bullet.previousPosition = { x: 40, y: 0, z: 0 };

      const events: GameEvent[] = [];
      GameEventMgr.getInstance().addListener(
        { onGameEvent: (e) => events.push(e) },
        GameEventType.BulletHit,
      );

      detector.checkCollisions([asteroid, bullet]);
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(BulletHitEvent);
      const hit = events[0] as BulletHitEvent;
      expect(hit.bullet).toBe(bullet);
      expect(hit.target).toBe(asteroid);
    });

    it('allows asteroid-player collision (emits CollisionEvent)', () => {
      const { Asteroid } = await import('@/game/Asteroid');
      const asteroid = new Asteroid(0);
      asteroid.position = { x: 0, y: 0, z: 0 };
      asteroid.previousPosition = { x: 0, y: 0, z: 0 };

      const player = new Player(GONDI_STATS);
      player.position = { x: 5, y: 0, z: 0 };
      player.previousPosition = { x: 5, y: 0, z: 0 };

      const events: GameEvent[] = [];
      GameEventMgr.getInstance().addListener(
        { onGameEvent: (e) => events.push(e) },
        GameEventType.Collision,
      );

      detector.checkCollisions([asteroid, player]);
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(CollisionEvent);
    });
  });
```

**Step 2: Run tests to verify new tests fail**

Run: `npx vitest run src/engine/CollisionDetector.test.ts`
Expected: asteroid-asteroid and asteroid-snot tests FAIL (they currently allow collision)

**Step 3: Add asteroid skip rules to shouldCheck**

In `src/engine/CollisionDetector.ts`, modify `shouldCheck()` to add after the existing snot rules (around line 112):

```typescript
    const aIsAsteroid = a.entityType === EntityType.Asteroid;
    const bIsAsteroid = b.entityType === EntityType.Asteroid;

    // Asteroids don't collide with asteroids
    if (aIsAsteroid && bIsAsteroid) return false;

    // Asteroids don't collide with snots
    if (aIsAsteroid && bIsSnot) return false;
    if (bIsAsteroid && aIsSnot) return false;

    // Asteroids don't collide with explosions
    if (aIsAsteroid && b.entityType === EntityType.Explosion) return false;
    if (bIsAsteroid && a.entityType === EntityType.Explosion) return false;
```

Also add `import { Asteroid } from '@/game/Asteroid';` is NOT needed — we only use EntityType enum which is already imported.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/CollisionDetector.test.ts`
Expected: All tests PASS

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/engine/CollisionDetector.ts src/engine/CollisionDetector.test.ts
git commit -m "feat(m8): add asteroid collision skip rules in CollisionDetector"
```

---

### Task 4: Collision Handler — Asteroid-Bullet Destroys Asteroid (TDD)

**Files:**
- Modify: `src/game/CollisionHandler.ts:31-47` (handleBulletHit)
- Create: `src/game/CollisionHandler.test.ts`

**Step 1: Write failing tests for asteroid-bullet handling**

Create `src/game/CollisionHandler.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { CollisionHandler } from './CollisionHandler';
import { Entity, EntityType } from '@/engine/Entity';
import { Bullet, FLAME_BULLET_CONFIG } from './Bullet';
import { Asteroid } from './Asteroid';
import { Player, GONDI_STATS } from './Player';
import { GameEventMgr } from '@/engine/GameEventMgr';
import { GameEventType, GameEvent, BulletHitEvent, CollisionEvent, ExplosionEvent } from '@/engine/GameEvent';

describe('CollisionHandler', () => {
  let handler: CollisionHandler;

  beforeEach(() => {
    GameEventMgr.reset();
    handler = new CollisionHandler();
    GameEventMgr.getInstance().addListener(handler, GameEventType.BulletHit);
    GameEventMgr.getInstance().addListener(handler, GameEventType.Collision);
  });

  describe('asteroid-bullet', () => {
    it('destroys asteroid on any bullet hit (one-shot kill)', () => {
      const asteroid = new Asteroid(0);
      asteroid.health = 1;

      const shooter = new Entity();
      const bullet = new Bullet(FLAME_BULLET_CONFIG, shooter);

      const event = new BulletHitEvent(bullet, asteroid);
      handler.onGameEvent(event);

      expect(asteroid.alive).toBe(false);
      expect(bullet.alive).toBe(false);
    });

    it('emits ExplosionEvent when asteroid is destroyed by bullet', () => {
      const asteroid = new Asteroid(0);
      const shooter = new Entity();
      const bullet = new Bullet(FLAME_BULLET_CONFIG, shooter);

      const explosionEvents: GameEvent[] = [];
      GameEventMgr.getInstance().addListener(
        { onGameEvent: (e) => explosionEvents.push(e) },
        GameEventType.Explosion,
      );

      const event = new BulletHitEvent(bullet, asteroid);
      handler.onGameEvent(event);

      expect(explosionEvents).toHaveLength(1);
      expect(explosionEvents[0]).toBeInstanceOf(ExplosionEvent);
      expect((explosionEvents[0] as ExplosionEvent).entity).toBe(asteroid);
    });
  });

  describe('asteroid-player collision', () => {
    it('does NOT deal damage to either entity', () => {
      const asteroid = new Asteroid(0);
      asteroid.position = { x: 0, y: 0, z: 0 };
      asteroid.previousPosition = { x: 0, y: 0, z: 0 };
      asteroid.health = 1;

      const player = new Player(GONDI_STATS);
      player.position = { x: 5, y: 0, z: 0 };
      player.previousPosition = { x: 5, y: 0, z: 0 };
      player.health = 1;
      player.accelVec = { x: -1, y: 0, z: 0 };

      const event = new CollisionEvent(asteroid, player, 0.5);
      handler.onGameEvent(event);

      expect(asteroid.health).toBe(1);
      expect(player.health).toBe(1);
      expect(asteroid.alive).toBe(true);
      expect(player.alive).toBe(true);
    });

    it('still applies bounce physics (velocity deflection)', () => {
      const asteroid = new Asteroid(0);
      asteroid.position = { x: 0, y: 0, z: 0 };
      asteroid.previousPosition = { x: -5, y: 0, z: 0 };
      asteroid.accelVec = { x: 0.1, y: 0, z: 0 };

      const player = new Player(GONDI_STATS);
      player.position = { x: 5, y: 0, z: 0 };
      player.previousPosition = { x: 10, y: 0, z: 0 };
      player.accelVec = { x: -0.5, y: 0, z: 0 };

      const event = new CollisionEvent(asteroid, player, 0.5);
      handler.onGameEvent(event);

      // After bounce, asteroid should move away from player (negative x)
      expect(asteroid.accelVec.x).toBeLessThan(0);
      // Player should move away from asteroid (positive x)
      expect(player.accelVec.x).toBeGreaterThan(0);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/game/CollisionHandler.test.ts`
Expected: FAIL — asteroid-bullet test fails because current `handleBulletHit` applies damage (0.05) instead of one-shot kill. Asteroid-player test fails because `handleShipCollision` applies damage.

**Step 3: Modify handleBulletHit for asteroid one-shot kill**

In `src/game/CollisionHandler.ts`, modify `handleBulletHit()`:

```typescript
  private handleBulletHit(event: BulletHitEvent): void {
    const bullet = event.bullet as Bullet;
    const target = event.target;

    // Sun is indestructible — bullets die on contact but deal no damage
    if (target.entityType === EntityType.Sun) {
      // no damage
    } else if (target.entityType === EntityType.Asteroid) {
      // Asteroids are one-shot killed by any bullet (matches C++)
      target.destroy();
      GameEventMgr.getInstance().sendEvent(new ExplosionEvent(target));
    } else {
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

**Step 4: Modify handleShipCollision to skip damage for asteroids**

In `src/game/CollisionHandler.ts`, modify `handleShipCollision()`. Add this check after the first line that gets `a` and `b`, before the damage calculation:

```typescript
  private handleShipCollision(event: CollisionEvent): void {
    const a = event.entityA;
    const b = event.entityB;

    // Asteroid-player: bounce only, no damage (matches C++)
    const hasAsteroid =
      a.entityType === EntityType.Asteroid ||
      b.entityType === EntityType.Asteroid;

    if (!hasAsteroid) {
      // --- Damage based on relative velocity ---
      const rvx = a.accelVec.x - b.accelVec.x;
      const rvy = a.accelVec.y - b.accelVec.y;
      const rvz = a.accelVec.z - b.accelVec.z;
      const relSpeed = Math.sqrt(rvx * rvx + rvy * rvy + rvz * rvz);
      const damage = Math.min(relSpeed * COLLISION_DAMAGE_SCALE, 0.3);

      a.health -= damage;
      b.health -= damage;

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
    }

    // --- Position separation + velocity deflection ---
    // (keep existing bounce code unchanged — applies to all collisions)
    // ... rest of the method unchanged ...
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run src/game/CollisionHandler.test.ts`
Expected: All tests PASS

**Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 7: Commit**

```bash
git add src/game/CollisionHandler.ts src/game/CollisionHandler.test.ts
git commit -m "feat(m8): handle asteroid-bullet (one-shot kill) and asteroid-player (bounce, no damage)"
```

---

### Task 5: Convert Asteroid Meshes (.x → .glb)

**Files:**
- Source: `../turtle_svn/trunk/Turtle/mediaflat/Asteroids/Asteroid01.x`, `Asteroid02.x`, `Asteroid03.x`
- Source: `../turtle_svn/trunk/Turtle/mediaflat/Asteroids/Asteroid1.jpg`, `Asteroid2.jpg`, `Asteroid3.jpg`
- Output: `public/models/asteroid01.glb`, `asteroid02.glb`, `asteroid03.glb`

**Step 1: Install Assimp if not present**

Run: `brew list assimp 2>/dev/null || brew install assimp`

**Step 2: Convert each asteroid mesh to glTF binary**

Run from the project root:

```bash
MEDIA_DIR="../turtle_svn/trunk/Turtle/mediaflat/Asteroids"

assimp export "$MEDIA_DIR/Asteroid01.x" public/models/asteroid01.glb
assimp export "$MEDIA_DIR/Asteroid02.x" public/models/asteroid02.glb
assimp export "$MEDIA_DIR/Asteroid03.x" public/models/asteroid03.glb
```

If assimp fails (`.x` format issues), use Blender as fallback:

```bash
blender --background --python-expr "
import bpy, sys
bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.import_scene.x3d(filepath=sys.argv[-2])
bpy.ops.export_scene.gltf(filepath=sys.argv[-1], export_format='GLB')
" -- "$MEDIA_DIR/Asteroid01.x" "public/models/asteroid01.glb"
```

**Step 3: Copy textures alongside models**

```bash
cp "$MEDIA_DIR/Asteroid1.jpg" public/models/
cp "$MEDIA_DIR/Asteroid2.jpg" public/models/
cp "$MEDIA_DIR/Asteroid3.jpg" public/models/
```

Note: If the glb files embed the textures, the separate jpg copies are not needed. Verify by loading in the browser.

**Step 4: Verify the output files exist and are reasonable size**

Run: `ls -la public/models/asteroid*.glb`
Expected: Three files, each > 1KB

**Step 5: Commit**

```bash
git add public/models/asteroid*.glb public/models/Asteroid*.jpg
git commit -m "asset(m8): convert asteroid meshes from .x to .glb"
```

---

### Task 6: Integrate Asteroids into Game Loop (main.ts)

**Files:**
- Modify: `src/main.ts`

This task adds the asteroid pool, mesh loading, spawning, game loop hooks, and mesh sync. It follows the exact same patterns used for bullets, snots, and explosions.

**Step 1: Add imports**

At the top of `src/main.ts`, add:

```typescript
import { Asteroid } from '@/game/Asteroid';
```

**Step 2: Add asteroid pool and mesh tracking**

After the explosion pool/map declarations (around line 258), add:

```typescript
// Asteroid pool with 3D mesh management
const asteroidPool = new EntityPool<Asteroid>(
  () => new Asteroid(0),
  () => { /* reset called per-acquire with specific type */ },
  ARENA.ASTEROID_COUNT,
);
const asteroidMeshMap = new Map<Asteroid, THREE.Group>();

// Load asteroid glTF models (3 types)
const asteroidModels: THREE.Group[] = [];
let asteroidModelsLoaded = 0;

function loadAsteroidModels(onAllLoaded: () => void): void {
  for (let i = 0; i < 3; i++) {
    const filename = `/models/asteroid0${i + 1}.glb`;
    loader.load(
      filename,
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(
          ARENA.ASTEROID_MESH_SCALE,
          ARENA.ASTEROID_MESH_SCALE,
          ARENA.ASTEROID_MESH_SCALE,
        );
        asteroidModels[i] = model;
        asteroidModelsLoaded++;
        if (asteroidModelsLoaded === 3) onAllLoaded();
      },
      undefined,
      () => {
        // Fallback: procedural asteroid shape
        console.warn(`Could not load ${filename}, using placeholder`);
        const geo = new THREE.IcosahedronGeometry(ARENA.ASTEROID_COLLISION_RADII[i], 1);
        const mat = new THREE.MeshLambertMaterial({ color: 0x888888 });
        const mesh = new THREE.Mesh(geo, mat);
        const group = new THREE.Group();
        group.add(mesh);
        asteroidModels[i] = group;
        asteroidModelsLoaded++;
        if (asteroidModelsLoaded === 3) onAllLoaded();
      },
    );
  }
}

function spawnAsteroids(): void {
  for (let i = 0; i < ARENA.ASTEROID_COUNT; i++) {
    const type = Math.floor(Math.random() * 3);
    const asteroid = asteroidPool.acquire();
    asteroid.reset(type);
    asteroid.position = {
      x: ARENA.WRAP_X - Math.random() * ARENA.WRAP_X * 2,
      y: ARENA.WRAP_Y - Math.random() * ARENA.WRAP_Y * 2,
      z: 0,
    };
    asteroid.previousPosition = { ...asteroid.position };

    // Clone the model for this asteroid type
    const meshClone = asteroidModels[type].clone();
    meshClone.position.set(asteroid.position.x, asteroid.position.y, 0);
    scene.add(meshClone);
    asteroidMeshMap.set(asteroid, meshClone);
  }
}

// Trigger asteroid loading and spawning
loadAsteroidModels(() => {
  spawnAsteroids();
});
```

**Step 3: Add asteroids to collision detection**

In the game loop callback, modify the `allEntities` array (around line 394):

```typescript
    const allEntities = [
      ...entityManager.entities,
      ...bulletPool.activeEntities,
      ...snotPool.activeEntities,
      ...asteroidPool.activeEntities,
    ];
```

**Step 4: Add asteroid update loop**

After the snot update loop (around line 420), add:

```typescript
    // Update pooled asteroids
    asteroidPool.forEachActive((asteroid) => {
      asteroid.update(dt);
      asteroid.handleWrapAround(camCenter);
    });
```

**Step 5: Add gravity to asteroids**

After the snot gravity loop (around line 431), add:

```typescript
    // Sun gravity on asteroids
    asteroidPool.forEachActive((asteroid) => {
      applySunGravity(asteroid, ARENA.SUN_POSITION, dt);
    });
```

**Step 6: Add asteroid mesh sync**

After the explosion sprite sync block (around line 512), add:

```typescript
    // Sync asteroid meshes
    const DEG2RAD = Math.PI / 180;
    asteroidPool.forEachActive((asteroid) => {
      const mesh = asteroidMeshMap.get(asteroid);
      if (!mesh) return;
      mesh.position.set(asteroid.position.x, asteroid.position.y, asteroid.position.z);
      mesh.rotation.set(
        asteroid.curXAngle * DEG2RAD,
        asteroid.curYAngle * DEG2RAD,
        0,
      );
    });
    asteroidPool.releaseInactive();
    for (const [asteroid, mesh] of asteroidMeshMap) {
      if (!asteroid.alive) {
        mesh.visible = false;
        scene.remove(mesh);
      }
    }
```

**Step 7: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 8: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 9: Commit**

```bash
git add src/main.ts
git commit -m "feat(m8): integrate asteroid pool into game loop"
```

---

### Task 7: Visual Verification and Polish

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Verify in browser**

Open the dev server URL. Check:
- [ ] 10 asteroids visible in the arena at random positions
- [ ] Asteroids slowly drift and rotate
- [ ] Asteroids wrap around arena edges
- [ ] Asteroids are pulled toward sun when close
- [ ] Shooting an asteroid destroys it with an explosion
- [ ] Flying into an asteroid bounces the player without damage
- [ ] Destroyed asteroids don't respawn

**Step 3: Adjust mesh scale if needed**

If asteroids are too large or too small, adjust `ARENA.ASTEROID_MESH_SCALE` in `src/game/Arena.ts`. The original uses 10x but the glTF conversion may change the base scale.

**Step 4: Adjust materials for lighting**

If asteroid meshes look wrong (too dark or flat), check their materials. The original C++ sets:
- `AmbientColor: (0,0,0,0)`
- `SpecularColor: (0,255,255,255)`
- `Shininess: 0.0`
- `Lighting: true`
- `NormalizeNormals: true`

Apply equivalent Three.js material properties if needed.

**Step 5: Run type check and tests one final time**

Run: `npx tsc --noEmit && npx vitest run`
Expected: Clean types, all tests pass

**Step 6: Commit any polish changes**

```bash
git add -u
git commit -m "fix(m8): adjust asteroid mesh scale and materials"
```

---

### Task 8: Final Type Check and Test Run

**Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (233 original + ~15 new asteroid tests)

**Step 3: Commit if any remaining changes**

Only if uncommitted changes exist.

---

## Summary of Files Changed

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/engine/Entity.ts` | Add `EntityType.Asteroid` |
| Modify | `src/game/Arena.ts` | Add asteroid constants |
| Create | `src/game/Asteroid.ts` | Asteroid class |
| Create | `src/game/Asteroid.test.ts` | Asteroid unit tests |
| Modify | `src/engine/CollisionDetector.ts` | Skip rules for asteroids |
| Modify | `src/engine/CollisionDetector.test.ts` | Collision skip rule tests |
| Modify | `src/game/CollisionHandler.ts` | One-shot kill, no-damage bounce |
| Create | `src/game/CollisionHandler.test.ts` | Collision handler tests |
| Create | `public/models/asteroid01.glb` | Type 0 mesh |
| Create | `public/models/asteroid02.glb` | Type 1 mesh |
| Create | `public/models/asteroid03.glb` | Type 2 mesh |
| Modify | `src/main.ts` | Pool, spawn, game loop |
