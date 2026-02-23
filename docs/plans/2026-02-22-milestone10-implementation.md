# M10: MichiGichi Ship Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add MichiGichi (Player 1) alongside Gondi (Player 2), with morph animation, PlasmaBullet, and SunBullet.

**Architecture:** MichiGichiPlayer subclass of Player with 4-state morph machine. BulletConfig extended with optional dynamic fields (tracking, expanding radius, decaying damage). Assets converted via assimp + ImageMagick.

**Tech Stack:** Three.js, TypeScript, Vite, Vitest, assimp, ImageMagick

---

### Task 1: Convert MichiGichi .x to glTF

**Files:**
- Create: `public/models/michiGichi.glb`

**Step 1: Convert with assimp**

Run:
```bash
cd /Users/ori/Documents/CosmoClash/cosmoclash-web/public/models
assimp export /Users/ori/Documents/CosmoClash/turtle_svn/trunk/Turtle/mediaflat/MichiGichi/michiGichi.x michiGichi.glb
```

**Step 2: Copy texture alongside model**

The glTF may reference the texture. Copy it:
```bash
cp /Users/ori/Documents/CosmoClash/turtle_svn/trunk/Turtle/mediaflat/MichiGichi/MichiGichiSingle.jpg /Users/ori/Documents/CosmoClash/cosmoclash-web/public/models/
```

**Step 3: Verify the glb has animation data**

Run:
```bash
assimp info /Users/ori/Documents/CosmoClash/cosmoclash-web/public/models/michiGichi.glb
```
Expected: output should show "Animations: 1" (or more) and mesh data.

If the animation is missing from the glb, try:
```bash
assimp export /Users/ori/Documents/CosmoClash/turtle_svn/trunk/Turtle/mediaflat/MichiGichi/michiGichi.x michiGichi.gltf
```
Then inspect the .gltf JSON for "animations" array.

**Step 4: Quick visual test in dev server**

Write a temporary test: load the model via GLTFLoader in the browser, check `gltf.animations.length > 0`, and that the mesh renders. Delete the test code after confirming.

**Step 5: Commit**

```bash
git add public/models/michiGichi.glb public/models/MichiGichiSingle.jpg
git commit -m "asset: add converted MichiGichi glb with animation"
```

---

### Task 2: Create Plasma Bullet Atlas

**Files:**
- Create: `public/textures/plasma_atlas.png`

**Step 1: Pack 80 frames into a 10x8 sprite atlas with alpha from luminance**

The source frames are JPGs with black backgrounds. We need PNG with alpha derived from luminance (dark pixels → transparent). Use ImageMagick montage:

```bash
cd /Users/ori/Documents/CosmoClash/turtle_svn/trunk/Turtle/mediaflat/shot2

# First convert each frame to PNG with alpha from luminance
mkdir -p /tmp/plasma_frames
for f in shot2_*.jpg; do
  magick "$f" \( +clone -colorspace gray \) -alpha off -compose CopyOpacity -composite "/tmp/plasma_frames/${f%.jpg}.png"
done

# Pack into 10x8 atlas (80 frames)
magick montage /tmp/plasma_frames/shot2_*.png -tile 10x8 -geometry +0+0 -background transparent /Users/ori/Documents/CosmoClash/cosmoclash-web/public/textures/plasma_atlas.png

# Cleanup
rm -rf /tmp/plasma_frames
```

**Step 2: Verify atlas**

```bash
magick identify /Users/ori/Documents/CosmoClash/cosmoclash-web/public/textures/plasma_atlas.png
```
Expected: PNG, 10x frame width by 8x frame height, RGBA.

**Step 3: Commit**

```bash
git add public/textures/plasma_atlas.png
git commit -m "asset: add plasma bullet sprite atlas (80 frames, 10x8)"
```

---

### Task 3: Create Sun Bullet Texture

**Files:**
- Create: `public/textures/sun_shot.png`

**Step 1: Convert sun shot texture to PNG with alpha**

```bash
magick /Users/ori/Documents/CosmoClash/turtle_svn/trunk/Turtle/mediaflat/props/shot_test-01.jpg \
  \( +clone -colorspace gray \) -alpha off -compose CopyOpacity -composite \
  /Users/ori/Documents/CosmoClash/cosmoclash-web/public/textures/sun_shot.png
```

**Step 2: Commit**

```bash
git add public/textures/sun_shot.png
git commit -m "asset: add sun bullet texture"
```

---

### Task 4: Extend BulletConfig with Dynamic Fields

**Files:**
- Modify: `src/game/Bullet.ts`
- Test: `src/game/Bullet.test.ts`

**Step 1: Write failing tests for new BulletConfig fields and dynamic update behaviors**

Add to `src/game/Bullet.test.ts`:

```typescript
import { Bullet, FLAME_BULLET_CONFIG, PLASMA_BULLET_CONFIG, SUN_BULLET_CONFIG } from './Bullet';

describe('PLASMA_BULLET_CONFIG', () => {
  it('has correct plasma values', () => {
    expect(PLASMA_BULLET_CONFIG.speedMaxScaler).toBe(0.3);
    expect(PLASMA_BULLET_CONFIG.maxTtl).toBe(10000);
    expect(PLASMA_BULLET_CONFIG.damage).toBe(0.3);
    expect(PLASMA_BULLET_CONFIG.collisionRadius).toBe(0);
    expect(PLASMA_BULLET_CONFIG.tracking).toBe(true);
    expect(PLASMA_BULLET_CONFIG.expandingRadius).toEqual({ min: 0, max: 70 });
    expect(PLASMA_BULLET_CONFIG.decayingDamage).toEqual({ initial: 0.3 });
  });
});

describe('SUN_BULLET_CONFIG', () => {
  it('has correct sun bullet values', () => {
    expect(SUN_BULLET_CONFIG.speedMaxScaler).toBe(1.5);
    expect(SUN_BULLET_CONFIG.maxTtl).toBe(1000);
    expect(SUN_BULLET_CONFIG.damage).toBe(0.1);
    expect(SUN_BULLET_CONFIG.collisionRadius).toBe(2);
  });
});

describe('dynamic update behaviors', () => {
  describe('expanding collision radius', () => {
    it('expands collision sphere from min to max over TTL', () => {
      const b = new Bullet(PLASMA_BULLET_CONFIG);
      // At start: TTL = 10000, radius should be min (0)
      expect(b.collisionSpheres[0].radius).toBe(0);

      b.update(5000); // Half TTL elapsed
      // radius = ((fullTtl - ttl) / fullTtl) * max = (5000/10000) * 70 = 35
      expect(b.collisionSpheres[0].radius).toBeCloseTo(35);
    });

    it('reaches max radius at end of TTL', () => {
      const b = new Bullet(PLASMA_BULLET_CONFIG);
      b.update(9999); // Almost expired
      expect(b.collisionSpheres[0].radius).toBeCloseTo(70, 0);
    });
  });

  describe('decaying damage', () => {
    it('starts at initial damage', () => {
      const b = new Bullet(PLASMA_BULLET_CONFIG);
      expect(b.getCurrentDamage()).toBeCloseTo(0.3);
    });

    it('decays linearly to zero over TTL', () => {
      const b = new Bullet(PLASMA_BULLET_CONFIG);
      b.update(5000); // Half TTL
      expect(b.getCurrentDamage()).toBeCloseTo(0.15);
    });

    it('returns zero when TTL expired', () => {
      const b = new Bullet(PLASMA_BULLET_CONFIG);
      b.update(10000);
      expect(b.getCurrentDamage()).toBe(0);
    });
  });

  describe('tracking', () => {
    it('steers toward target entity each update', () => {
      const b = new Bullet(PLASMA_BULLET_CONFIG);
      const target = new Entity();
      target.position = { x: 100, y: 0, z: 0 };
      b.trackingTarget = target;
      b.position = { x: 0, y: 0, z: 0 };
      b.accelVec = { x: 0, y: 0.3, z: 0 }; // Moving up

      b.update(100);

      // Should have some positive x component (steering toward target)
      expect(b.accelVec.x).toBeGreaterThan(0);
    });

    it('does not track when target is null', () => {
      const b = new Bullet(PLASMA_BULLET_CONFIG);
      b.accelVec = { x: 0, y: 0.3, z: 0 };
      b.update(100);
      // No target, velocity direction unchanged (only position moves)
      // accelVec stays pointing up
      expect(b.accelVec.x).toBeCloseTo(0);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/game/Bullet.test.ts`
Expected: FAIL — `PLASMA_BULLET_CONFIG` and `SUN_BULLET_CONFIG` not exported, `getCurrentDamage` not a method, `trackingTarget` not a property.

**Step 3: Implement the extended BulletConfig and Bullet update**

Modify `src/game/Bullet.ts`:

```typescript
import { Entity, EntityType, Vec3 } from '@/engine/Entity';

export interface BulletConfig {
  speedMaxScaler: number;
  maxTtl: number;
  damage: number;
  collisionRadius: number;
  tracking?: boolean;
  expandingRadius?: { min: number; max: number };
  decayingDamage?: { initial: number };
}

export const FLAME_BULLET_CONFIG: BulletConfig = {
  speedMaxScaler: 0.3,
  maxTtl: 700,
  damage: 0.05,
  collisionRadius: 10,
};

export const PLASMA_BULLET_CONFIG: BulletConfig = {
  speedMaxScaler: 0.3,
  maxTtl: 10000,
  damage: 0.3,
  collisionRadius: 0,
  tracking: true,
  expandingRadius: { min: 0, max: 70 },
  decayingDamage: { initial: 0.3 },
};

export const SUN_BULLET_CONFIG: BulletConfig = {
  speedMaxScaler: 1.5,
  maxTtl: 1000,
  damage: 0.1,
  collisionRadius: 2,
};

export class Bullet extends Entity {
  config: BulletConfig;
  originEntity: Entity | null;
  ttl: number;
  trackingTarget: Entity | null = null;

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
    this.trackingTarget = null;
    this.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: config.collisionRadius }];
  }

  getCurrentDamage(): number {
    if (this.config.decayingDamage) {
      const ratio = Math.max(this.ttl, 0) / this.config.maxTtl;
      return ratio * this.config.decayingDamage.initial;
    }
    return this.config.damage;
  }

  update(dt: number): void {
    // Tracking: steer toward target
    if (this.config.tracking && this.trackingTarget && this.trackingTarget.alive) {
      const speed = Math.sqrt(
        this.accelVec.x * this.accelVec.x + this.accelVec.y * this.accelVec.y,
      );
      if (speed > 0.001) {
        const dx = this.trackingTarget.position.x - this.position.x;
        const dy = this.trackingTarget.position.y - this.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.001) {
          const tx = dx / dist;
          const ty = dy / dist;
          // Blend current direction toward target (gentle steering)
          const cx = this.accelVec.x / speed;
          const cy = this.accelVec.y / speed;
          const steerFactor = 0.02; // How fast to turn per frame
          const nx = cx + (tx - cx) * steerFactor;
          const ny = cy + (ty - cy) * steerFactor;
          const nl = Math.sqrt(nx * nx + ny * ny);
          this.accelVec.x = (nx / nl) * speed;
          this.accelVec.y = (ny / nl) * speed;
        }
      }
    }

    super.update(dt);
    this.ttl -= dt;

    // Expanding collision radius
    if (this.config.expandingRadius) {
      const { min, max } = this.config.expandingRadius;
      const elapsed = this.config.maxTtl - this.ttl;
      const ratio = Math.min(elapsed / this.config.maxTtl, 1);
      this.collisionSpheres[0].radius = min + ratio * (max - min);
    }

    if (this.ttl <= 0) {
      this.destroy();
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/game/Bullet.test.ts`
Expected: ALL PASS

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS (existing tests unaffected — FLAME_BULLET_CONFIG unchanged)

**Step 6: Commit**

```bash
git add src/game/Bullet.ts src/game/Bullet.test.ts
git commit -m "feat(m10): extend BulletConfig with tracking, expanding radius, decaying damage"
```

---

### Task 5: Update CollisionHandler to Use getCurrentDamage()

**Files:**
- Modify: `src/game/CollisionHandler.ts`

**Step 1: Write failing test for decaying damage in collision**

This is a targeted change. In `CollisionHandler.handleBulletHit()`, replace `bullet.config.damage` with `bullet.getCurrentDamage()`.

No separate test file needed — the existing collision tests cover this path. But we should add a test that verifies a plasma bullet at half TTL deals half damage.

Add to `src/game/CollisionHandler.test.ts` (or create if it doesn't exist):

```typescript
it('uses decaying damage from plasma bullet', () => {
  const bullet = new Bullet(PLASMA_BULLET_CONFIG);
  bullet.update(5000); // Half TTL elapsed
  const target = new Player(GONDI_STATS);
  // Simulate bullet hit
  target.health -= bullet.getCurrentDamage();
  expect(target.health).toBeCloseTo(1 - 0.15);
});
```

**Step 2: Update CollisionHandler**

In `src/game/CollisionHandler.ts`, line 43, change:
```typescript
// OLD:
target.health -= bullet.config.damage;
// NEW:
target.health -= bullet.getCurrentDamage();
```

**Step 3: Also add plasma-plasma TTL reduction**

In `shouldCheck()` in `CollisionDetector.ts`, we currently skip bullet-bullet collisions. For plasma-plasma, we need to allow it. Add a special case:

In `CollisionDetector.ts`, update `shouldCheck`:
```typescript
// Bullets don't collide with bullets (except plasma-plasma)
if (aIsBullet && bIsBullet) {
  const aPlasma = (a as Bullet).config.tracking;
  const bPlasma = (b as Bullet).config.tracking;
  if (aPlasma && bPlasma) return true;
  return false;
}
```

In `CollisionHandler.handleBulletHit()`, add plasma-plasma case:
```typescript
// Plasma-plasma interaction: reduce TTL by 100ms instead of destroying
if (target.entityType === EntityType.Bullet) {
  const targetBullet = target as Bullet;
  targetBullet.ttl -= 100;
  bullet.ttl -= 100;
  return; // Don't destroy either bullet
}
```

**Step 4: Run tests**

Run: `npx vitest run`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/game/CollisionHandler.ts src/engine/CollisionDetector.ts
git commit -m "feat(m10): use decaying damage for plasma bullets, add plasma-plasma interaction"
```

---

### Task 6: Create MichiGichiPlayer Class

**Files:**
- Create: `src/game/MichiGichiPlayer.ts`
- Create: `src/game/MichiGichiPlayer.test.ts`

**Step 1: Write failing tests for morph state machine**

Create `src/game/MichiGichiPlayer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { MichiGichiPlayer, MorphState, MICHI_STATS, GICHI_STATS } from './MichiGichiPlayer';
import { PLASMA_BULLET_CONFIG, SUN_BULLET_CONFIG } from './Bullet';
import { Player, GONDI_STATS } from './Player';

describe('MichiGichiPlayer', () => {
  describe('initial state', () => {
    it('starts in MICHI state', () => {
      const p = new MichiGichiPlayer();
      expect(p.morphState).toBe(MorphState.MICHI);
    });

    it('starts at frame 1', () => {
      const p = new MichiGichiPlayer();
      expect(p.currentAnimFrame).toBe(1);
    });

    it('uses MICHI stats initially', () => {
      const p = new MichiGichiPlayer();
      expect(p.stats.speedMaxScaler).toBe(MICHI_STATS.speedMaxScaler);
      expect(p.stats.primaryBulletConfig).toBe(PLASMA_BULLET_CONFIG);
    });

    it('has two collision spheres', () => {
      const p = new MichiGichiPlayer();
      expect(p.collisionSpheres).toHaveLength(2);
      expect(p.collisionSpheres[0]).toEqual({ offset: { x: 0, y: -10, z: 0 }, radius: 14 });
      expect(p.collisionSpheres[1]).toEqual({ offset: { x: 0, y: 10, z: 0 }, radius: 14 });
    });
  });

  describe('morph trigger', () => {
    it('transitions from MICHI to MICHI_TO_GICHI on triggerMorph()', () => {
      const p = new MichiGichiPlayer();
      p.triggerMorph();
      expect(p.morphState).toBe(MorphState.MICHI_TO_GICHI);
    });

    it('transitions from GICHI to GICHI_TO_MICHI on triggerMorph()', () => {
      const p = new MichiGichiPlayer();
      // Force to GICHI state
      p.morphState = MorphState.GICHI;
      p.currentAnimFrame = 41;
      p.triggerMorph();
      expect(p.morphState).toBe(MorphState.GICHI_TO_MICHI);
    });

    it('ignores triggerMorph during transitions', () => {
      const p = new MichiGichiPlayer();
      p.triggerMorph(); // MICHI -> MICHI_TO_GICHI
      p.triggerMorph(); // Should be ignored
      expect(p.morphState).toBe(MorphState.MICHI_TO_GICHI);
    });
  });

  describe('frame advancement (MICHI_TO_GICHI)', () => {
    it('advances frame after 20ms delay', () => {
      const p = new MichiGichiPlayer();
      p.triggerMorph(); // MICHI -> MICHI_TO_GICHI
      expect(p.currentAnimFrame).toBe(1);

      p.updateMorph(20); // Exactly one frame delay
      expect(p.currentAnimFrame).toBe(2);
    });

    it('does not advance frame before 20ms', () => {
      const p = new MichiGichiPlayer();
      p.triggerMorph();
      p.updateMorph(19);
      expect(p.currentAnimFrame).toBe(1);
    });

    it('reaches GICHI state at frame 41', () => {
      const p = new MichiGichiPlayer();
      p.triggerMorph();

      // Advance 40 frames (1->41) at 20ms each = 800ms
      for (let i = 0; i < 40; i++) {
        p.updateMorph(20);
      }

      expect(p.currentAnimFrame).toBe(41);
      expect(p.morphState).toBe(MorphState.GICHI);
    });

    it('swaps to GICHI stats when reaching GICHI state', () => {
      const p = new MichiGichiPlayer();
      p.triggerMorph();
      for (let i = 0; i < 40; i++) p.updateMorph(20);

      expect(p.stats.speedMaxScaler).toBe(GICHI_STATS.speedMaxScaler);
      expect(p.stats.primaryBulletConfig).toBe(SUN_BULLET_CONFIG);
    });
  });

  describe('frame advancement (GICHI_TO_MICHI)', () => {
    it('decrements frame during reverse morph', () => {
      const p = new MichiGichiPlayer();
      p.morphState = MorphState.GICHI;
      p.currentAnimFrame = 41;
      p.triggerMorph(); // GICHI -> GICHI_TO_MICHI

      p.updateMorph(20);
      expect(p.currentAnimFrame).toBe(40);
    });

    it('reaches MICHI state at frame 1', () => {
      const p = new MichiGichiPlayer();
      p.morphState = MorphState.GICHI;
      p.currentAnimFrame = 41;
      p.triggerMorph();

      for (let i = 0; i < 40; i++) p.updateMorph(20);

      expect(p.currentAnimFrame).toBe(1);
      expect(p.morphState).toBe(MorphState.MICHI);
    });

    it('swaps to MICHI stats when reaching MICHI state', () => {
      const p = new MichiGichiPlayer();
      // Go to GICHI first
      p.morphState = MorphState.GICHI;
      p.currentAnimFrame = 41;
      // Swap stats to gichi
      p.applyStats(GICHI_STATS);

      p.triggerMorph();
      for (let i = 0; i < 40; i++) p.updateMorph(20);

      expect(p.stats.speedMaxScaler).toBe(MICHI_STATS.speedMaxScaler);
      expect(p.stats.primaryBulletConfig).toBe(PLASMA_BULLET_CONFIG);
    });
  });

  describe('secondary weapon override', () => {
    it('returns null from fireSecondary (morph, not a projectile)', () => {
      const p = new MichiGichiPlayer();
      const enemy = new Player(GONDI_STATS);
      expect(p.fireSecondary(enemy)).toBeNull();
    });
  });

  describe('resetForNewRound', () => {
    it('resets morph state to MICHI', () => {
      const p = new MichiGichiPlayer();
      p.morphState = MorphState.GICHI;
      p.currentAnimFrame = 41;
      p.resetForNewRound({ x: 0, y: 0, z: 0 });
      expect(p.morphState).toBe(MorphState.MICHI);
      expect(p.currentAnimFrame).toBe(1);
      expect(p.stats.speedMaxScaler).toBe(MICHI_STATS.speedMaxScaler);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/game/MichiGichiPlayer.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement MichiGichiPlayer**

Create `src/game/MichiGichiPlayer.ts`:

```typescript
import { Player, CharacterStats } from './Player';
import { PLASMA_BULLET_CONFIG, SUN_BULLET_CONFIG } from './Bullet';
import { Snot } from './Snot';
import { Vec3 } from '@/engine/Entity';

export enum MorphState {
  MICHI = 0,
  MICHI_TO_GICHI = 1,
  GICHI = 2,
  GICHI_TO_MICHI = 3,
}

export const MICHI_STATS: CharacterStats = {
  speedMaxScaler: 0.2,
  acceleration: 0.002,
  rotationSpeed: 0.3,
  primaryEnergyCost: 0.24,
  primaryWeaponDelay: 100,
  primaryWeaponFillRate: 0.0002,
  primaryBulletConfig: PLASMA_BULLET_CONFIG,
};

export const GICHI_STATS: CharacterStats = {
  speedMaxScaler: 1.0,
  acceleration: 0.002,
  rotationSpeed: 0.5,
  primaryEnergyCost: 0.08,
  primaryWeaponDelay: 100,
  primaryWeaponFillRate: 0.0002,
  primaryBulletConfig: SUN_BULLET_CONFIG,
};

const MORPH_FRAME_DELAY = 20; // ms between animation frames
const MORPH_START_FRAME = 1;
const MORPH_END_FRAME = 41;

export class MichiGichiPlayer extends Player {
  morphState: MorphState = MorphState.MICHI;
  currentAnimFrame: number = MORPH_START_FRAME;
  private morphFrameTimer: number = 0;

  constructor() {
    super(MICHI_STATS);
    this.collisionSpheres = [
      { offset: { x: 0, y: -10, z: 0 }, radius: 14 },
      { offset: { x: 0, y: 10, z: 0 }, radius: 14 },
    ];
  }

  triggerMorph(): void {
    if (this.morphState === MorphState.MICHI) {
      this.morphState = MorphState.MICHI_TO_GICHI;
      this.morphFrameTimer = 0;
    } else if (this.morphState === MorphState.GICHI) {
      this.morphState = MorphState.GICHI_TO_MICHI;
      this.morphFrameTimer = 0;
    }
    // Ignore during transitions
  }

  updateMorph(dt: number): void {
    if (
      this.morphState !== MorphState.MICHI_TO_GICHI &&
      this.morphState !== MorphState.GICHI_TO_MICHI
    ) {
      return;
    }

    this.morphFrameTimer += dt;

    while (this.morphFrameTimer >= MORPH_FRAME_DELAY) {
      this.morphFrameTimer -= MORPH_FRAME_DELAY;

      if (this.morphState === MorphState.MICHI_TO_GICHI) {
        this.currentAnimFrame++;
        if (this.currentAnimFrame >= MORPH_END_FRAME) {
          this.currentAnimFrame = MORPH_END_FRAME;
          this.morphState = MorphState.GICHI;
          this.applyStats(GICHI_STATS);
          break;
        }
      } else if (this.morphState === MorphState.GICHI_TO_MICHI) {
        this.currentAnimFrame--;
        if (this.currentAnimFrame <= MORPH_START_FRAME) {
          this.currentAnimFrame = MORPH_START_FRAME;
          this.morphState = MorphState.MICHI;
          this.applyStats(MICHI_STATS);
          break;
        }
      }
    }
  }

  applyStats(newStats: CharacterStats): void {
    // Player.stats is readonly, so we need a mutable reference.
    // We'll cast to assign. The Player constructor sets this.stats = stats,
    // so we reassign the object fields.
    (this as { stats: CharacterStats }).stats = newStats;
  }

  // Override: secondary weapon triggers morph, not snot
  override fireSecondary(_enemy: Player): Snot | null {
    return null;
  }

  override resetForNewRound(spawnPosition: Vec3): void {
    super.resetForNewRound(spawnPosition);
    this.morphState = MorphState.MICHI;
    this.currentAnimFrame = MORPH_START_FRAME;
    this.morphFrameTimer = 0;
    this.applyStats(MICHI_STATS);
    this.collisionSpheres = [
      { offset: { x: 0, y: -10, z: 0 }, radius: 14 },
      { offset: { x: 0, y: 10, z: 0 }, radius: 14 },
    ];
  }
}
```

**Important note on `readonly stats`**: The base `Player` class has `readonly stats: CharacterStats`. MichiGichiPlayer needs to swap stats. The `applyStats()` method uses a type assertion to reassign. If this causes TypeScript errors, change `readonly stats` to just `stats` in Player.ts (this is a simple change that doesn't affect any other code since no test mutates stats externally).

**Step 4: Run tests**

Run: `npx vitest run src/game/MichiGichiPlayer.test.ts`
Expected: ALL PASS

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/game/MichiGichiPlayer.ts src/game/MichiGichiPlayer.test.ts
git commit -m "feat(m10): add MichiGichiPlayer with morph state machine"
```

---

### Task 7: Integrate MichiGichi into main.ts

**Files:**
- Modify: `src/main.ts`

**Step 1: Import MichiGichiPlayer**

At top of main.ts, add:
```typescript
import { MichiGichiPlayer } from '@/game/MichiGichiPlayer';
import { PLASMA_BULLET_CONFIG, SUN_BULLET_CONFIG } from '@/game/Bullet';
```

**Step 2: Change Player 1 to MichiGichiPlayer**

Replace line 41:
```typescript
// OLD:
const player1 = new Player(GONDI_STATS);
// NEW:
const player1 = new MichiGichiPlayer();
```

**Step 3: Load MichiGichi model for Player 1 with animation**

Replace the `loadShipModel` calls (lines 92-99) with differentiated loading:

```typescript
let p1Mesh: THREE.Object3D | null = null;
let p2Mesh: THREE.Object3D | null = null;
let p1Mixer: THREE.AnimationMixer | null = null;
let p1AnimAction: THREE.AnimationAction | null = null;

// Load MichiGichi model with animation for Player 1
loader.load(
  '/models/michiGichi.glb',
  (gltf) => {
    const container = new THREE.Group();
    const model = gltf.scene.clone();
    model.scale.set(2.0, 2.0, 2.0);
    model.rotation.set(-90 * rad, 0, 0);
    // Fix emissive (same as asteroid fix)
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (mat.emissive) mat.emissive.set(0, 0, 0);
      }
    });
    container.add(model);
    scene.add(container);
    p1Mesh = container;

    // Setup animation mixer for morph
    if (gltf.animations.length > 0) {
      p1Mixer = new THREE.AnimationMixer(model);
      const clip = gltf.animations[0];
      p1AnimAction = p1Mixer.clipAction(clip);
      p1AnimAction.play();
      p1AnimAction.paused = true; // Manual frame control
    }
  },
  undefined,
  () => {
    console.warn('Could not load michiGichi.glb, using placeholder');
    const container = new THREE.Group();
    const geo = new THREE.ConeGeometry(8, 20, 8);
    const mat = new THREE.MeshLambertMaterial({ color: 0xff8800 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.set(0, 270 * rad, 90 * rad);
    container.add(mesh);
    scene.add(container);
    p1Mesh = container;
  },
);

// Load Gondi model for Player 2 (unchanged)
loadShipModel((mesh) => {
  p2Mesh = mesh;
  mesh.position.set(player2.position.x, player2.position.y, 0);
}, 0x00ff88);
```

**Step 4: Load new bullet textures**

Add after the flame texture load:
```typescript
const plasmaTexture = new THREE.TextureLoader().load('/textures/plasma_atlas.png');
const sunShotTexture = new THREE.TextureLoader().load('/textures/sun_shot.png');
```

**Step 5: Update acquireBullet to differentiate sprite by config**

Replace the `acquireBullet` function:
```typescript
function acquireBullet(config: BulletConfig, origin: Entity, target?: Entity): Bullet {
  const bullet = bulletPool.acquire();
  bullet.reset(config, origin);
  if (config.tracking && target) {
    bullet.trackingTarget = target;
  }

  if (!bulletSpriteMap.has(bullet)) {
    const mat = new THREE.SpriteMaterial({
      map: flameTexture, // default, overridden below
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    const sprite = new THREE.Sprite(mat);
    bulletSpriteMap.set(bullet, sprite);
  }
  const sprite = bulletSpriteMap.get(bullet)!;

  // Set correct texture and scale per bullet type
  const mat = sprite.material as THREE.SpriteMaterial;
  if (config === PLASMA_BULLET_CONFIG) {
    mat.map = plasmaTexture.clone();
    mat.map.repeat.set(1 / 10, 1 / 8); // 10x8 atlas
    mat.map.wrapS = THREE.RepeatWrapping;
    mat.map.wrapT = THREE.RepeatWrapping;
    sprite.scale.set(20, 20, 1);
  } else if (config === SUN_BULLET_CONFIG) {
    mat.map = sunShotTexture;
    sprite.scale.set(10, 10, 1);
  } else {
    mat.map = flameTexture;
    sprite.scale.set(35, 35, 1);
  }
  mat.needsUpdate = true;

  sprite.visible = true;
  scene.add(sprite);
  return bullet;
}
```

**Step 6: Update fire primary to pass target for tracking**

In `updatePlayerInput`, update the fire primary block (line ~478-495):
```typescript
if (pi.firePrimary) {
  if (player.primaryCooldown <= 0 && player.energy > player.stats.primaryEnergyCost) {
    player.energy -= player.stats.primaryEnergyCost;
    player.primaryCooldown = player.stats.primaryWeaponDelay;

    const bullet = acquireBullet(player.stats.primaryBulletConfig, player, enemy);
    bullet.angle = player.angle;

    const spawnVec = player.getFullSpeedVec(25);
    bullet.position = {
      x: player.position.x + spawnVec.x,
      y: player.position.y + spawnVec.y,
      z: player.position.z,
    };
    bullet.previousPosition = { ...bullet.position };
    const speedVec = player.getFullSpeedVec(player.stats.primaryBulletConfig.speedMaxScaler);
    bullet.accelVec = { ...speedVec };
  }
}
```

**Step 7: Update secondary weapon to handle morph**

In `updatePlayerInput`, replace the fireSecondary block (line ~498-516):
```typescript
if (pi.fireSecondary) {
  if (player instanceof MichiGichiPlayer) {
    // MichiGichi: secondary triggers morph
    player.triggerMorph();
  } else {
    // Other characters: fire snot
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
      snot.previousPosition = { ...snot.position };
      const speedVec = player.getFullSpeedVec(SNOT_CONFIG.speedMaxScaler);
      snot.accelVec = { ...speedVec };
    }
  }
}
```

**Step 8: Add morph update and animation sync in game loop**

In the game loop's playing block, after `updatePlayerInput` calls (around line 547), add:
```typescript
// Update MichiGichi morph animation
if (player1 instanceof MichiGichiPlayer) {
  player1.updateMorph(dt);
}
```

In the "always runs" section, after `syncMesh(p1Mesh, player1)` (around line 606), add animation sync:
```typescript
// Sync MichiGichi morph animation frame
if (p1Mixer && p1AnimAction && player1 instanceof MichiGichiPlayer) {
  const clip = p1AnimAction.getClip();
  p1AnimAction.time = (player1.currentAnimFrame / 42) * clip.duration;
  p1Mixer.update(0);
}
```

**Step 9: Update plasma bullet sprite animation in sync loop**

In the bullet sprite sync loop (around line 612-616), add atlas animation for plasma bullets:
```typescript
bulletPool.forEachActive((bullet) => {
  const sprite = bulletSpriteMap.get(bullet);
  if (!sprite) return;
  sprite.position.set(bullet.position.x, bullet.position.y, bullet.position.z);

  // Plasma bullet: animated atlas + growing scale
  if (bullet.config === PLASMA_BULLET_CONFIG) {
    const mat = sprite.material as THREE.SpriteMaterial;
    if (mat.map) {
      const elapsed = bullet.config.maxTtl - bullet.ttl;
      // Fast fade-in: frames 0-41 at 0.4 speed, slow loop: 41-79 at 0.03 speed
      let frameIndex: number;
      const fadeInDuration = 41 / 0.4; // ~102.5ms per frame in fast phase
      if (elapsed < fadeInDuration * 42) {
        frameIndex = Math.min(Math.floor(elapsed / (1000 / 0.4 / 42)), 41);
      } else {
        const loopElapsed = elapsed - fadeInDuration * 42;
        const loopFrame = Math.floor(loopElapsed / (1000 / 0.03 / 39));
        frameIndex = 41 + (loopFrame % 39);
      }
      frameIndex = Math.min(frameIndex, 79);
      const col = frameIndex % 10;
      const row = Math.floor(frameIndex / 10);
      mat.map.offset.set(col / 10, 1 - (row + 1) / 8);
    }
    // Growing scale
    const age = (bullet.config.maxTtl - bullet.ttl) / bullet.config.maxTtl;
    const size = 20 + age * 10; // 20 -> 30
    sprite.scale.set(size, size, 1);
  }
});
```

**Step 10: Type check and dev test**

Run: `npx tsc --noEmit`
Expected: No errors

Run: `npm run dev`
Expected: Game loads, Player 1 is MichiGichi mesh (or placeholder cone), Player 2 is Gondi. Pressing secondary weapon key (`.`) triggers morph animation if model loaded correctly.

**Step 11: Commit**

```bash
git add src/main.ts
git commit -m "feat(m10): integrate MichiGichi as Player 1 with morph animation and new bullet types"
```

---

### Task 8: Visual Verification and Polish

**Files:**
- Modify: `src/main.ts` (minor adjustments)

**Step 1: Run the game and verify visually**

Start dev server: `npm run dev`

Check:
- [ ] MichiGichi mesh loads and renders at Player 1 spawn
- [ ] Pressing `.` (secondary key for P1) triggers morph animation
- [ ] Morph animation plays smoothly over ~800ms
- [ ] After morph, firing shoots sun bullets (small glowing sprite) instead of plasma
- [ ] Pressing `.` again morphs back
- [ ] Player 2 (Gondi) still works with flame bullets
- [ ] Player 2 secondary still fires snot
- [ ] Plasma bullets track toward Player 2
- [ ] Plasma bullets grow in size over time
- [ ] Sun bullets are small and fast
- [ ] MichiGichi speed changes between forms (slow in Michi, fast in Gichi)
- [ ] Game restart resets MichiGichi to Michi form
- [ ] All existing mechanics (collision, explosions, asteroids, HUD) still work

**Step 2: Adjust model orientation/scale if needed**

The original C++ applies scale 2.0 and rotation -90° X. The exact values may need tweaking to match Gondi's visual size and orientation. Adjust in the loader callback if needed.

**Step 3: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit any polish changes**

```bash
git add -A
git commit -m "fix(m10): polish MichiGichi model orientation and bullet visuals"
```

---

### Task 9: Final Test Run and Summary

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS

**Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Summary of what was built**

- MichiGichiPlayer subclass with 4-state morph machine (MICHI ↔ GICHI)
- 42-frame bone animation via Three.js AnimationMixer with manual frame control
- PlasmaBullet with tracking, expanding collision (0→70), decaying damage (0.3→0), 80-frame animated atlas
- SunBullet with fast speed (1.5x), small sprite
- Player 1 = MichiGichi, Player 2 = Gondi
- Secondary weapon triggers morph for MichiGichi, snot for Gondi
- Plasma-plasma collision reduces TTL
- CollisionHandler uses getCurrentDamage() for decaying damage
