# M6 Snot Mechanic — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the snot secondary weapon — homing projectiles that attach to opponents, slow their speed and rotation, orbit visually, and expire after 10 seconds.

**Architecture:** New `Snot` class extends `Bullet` with tracking, attachment, and orbit behavior. Player gains `snotCount` affecting effective speed/rotation. New `SnotHitEvent` routes through the existing event system. Collision detector distinguishes Snot from Bullet. Sprite sheet atlas for animation.

**Tech Stack:** TypeScript, Three.js (sprites with additive blending), Vitest, Vite

---

### Task 1: Create Snot Sprite Atlas

**Files:**
- Source frames: `../turtle_svn/trunk/Turtle/mediaflat/snot/shnoz_small_00000.jpg` through `shnoz_small_00116.jpg`
- Create: `public/textures/snot_atlas.jpg`

**Step 1: Build the atlas using ImageMagick**

117 frames of 64x64 each. Use an 11×11 grid (121 cells, 117 used, 4 blank).

```bash
cd /Users/ori/Documents/CosmoClash/cosmoclash-web

# Generate ordered file list
files=""
for i in $(seq -w 0 116); do
  files="$files ../turtle_svn/trunk/Turtle/mediaflat/snot/shnoz_small_000${i}.jpg"
done

# Use montage to create 11x11 grid atlas (704x704)
montage $files -tile 11x11 -geometry 64x64+0+0 -background black public/textures/snot_atlas.jpg
```

**Step 2: Verify the atlas**

```bash
file public/textures/snot_atlas.jpg
# Expected: JPEG image data, 704x704
```

**Step 3: Commit**

```bash
git add public/textures/snot_atlas.jpg
git commit -m "asset(m6): add snot sprite sheet atlas (117 frames, 11x11 grid)"
```

---

### Task 2: Add EntityType.Snot and Snot Constants

**Files:**
- Modify: `src/engine/Entity.ts:14-19` (EntityType enum)
- Modify: `src/game/Arena.ts` (add snot constants)

**Step 1: Write the failing test**

No new test file needed — existing `Entity.test.ts` already validates enum. We'll verify the new type exists in Task 3's tests. This is a pure scaffolding step.

**Step 2: Add `Snot` to EntityType enum**

In `src/engine/Entity.ts`, change the enum at line 14-19:

```typescript
export enum EntityType {
  Player,
  Bullet,
  Sun,
  Dummy,
  Snot,
}
```

**Step 3: Add snot constants to Arena**

In `src/game/Arena.ts`, add after the `GRAVITY_MAX_FORCE` line:

```typescript
  // Snot
  SNOT_SPEED_MAX_SCALER: 0.2,
  SNOT_MAX_TTL: 10000,
  SNOT_DAMAGE: 0,
  SNOT_COLLISION_RADIUS: 2,
  SNOT_ANIM_SPEED: 0.03,
  SNOT_ORBIT_SPEED: 0.2,
  SNOT_BILLBOARD_SIZE: 50,
  SNOT_ATLAS_COLS: 11,
  SNOT_ATLAS_ROWS: 11,
  SNOT_TOTAL_FRAMES: 117,
  SNOT_LOOP_END_FRAME: 55,
  SNOT_FADE_FRAME: 116,
  SNOT_FADE_TTL_THRESHOLD: 2000,
  SECONDARY_WEAPON_DELAY: 200,
  SECONDARY_ENERGY_COST: 0.08,
```

**Step 4: Run tests to make sure nothing breaks**

```bash
npx vitest run
```

Expected: All existing tests pass.

**Step 5: Commit**

```bash
git add src/engine/Entity.ts src/game/Arena.ts
git commit -m "feat(m6): add EntityType.Snot and snot constants to Arena"
```

---

### Task 3: Create Snot Entity Class

**Files:**
- Create: `src/game/Snot.ts`
- Create: `src/game/Snot.test.ts`

**Step 1: Write the failing tests**

Create `src/game/Snot.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Snot, SNOT_CONFIG } from './Snot';
import { Player, GONDI_STATS } from './Player';
import { EntityType } from '@/engine/Entity';
import { ARENA } from './Arena';

describe('Snot', () => {
  describe('SNOT_CONFIG', () => {
    it('has correct values from design', () => {
      expect(SNOT_CONFIG.speedMaxScaler).toBe(0.2);
      expect(SNOT_CONFIG.maxTtl).toBe(10000);
      expect(SNOT_CONFIG.damage).toBe(0);
      expect(SNOT_CONFIG.collisionRadius).toBe(2);
    });
  });

  describe('constructor', () => {
    it('sets entityType to Snot', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      expect(s.entityType).toBe(EntityType.Snot);
    });

    it('stores target reference', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      expect(s.target).toBe(target);
    });

    it('starts unattached', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      expect(s.attached).toBe(false);
      expect(s.victim).toBeNull();
    });

    it('has collision sphere with radius 2', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      expect(s.collisionSpheres[0].radius).toBe(2);
    });
  });

  describe('tracking', () => {
    it('adjusts angle toward target each update', () => {
      const target = new Player(GONDI_STATS);
      target.position = { x: 100, y: 0, z: 0 };
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.position = { x: 0, y: 0, z: 0 };
      s.angle = 0; // pointing up

      s.update(16);

      // Should turn toward target (which is to the right, angle ~270)
      // accelVec should have a positive x component (moving right)
      const speed = Math.sqrt(s.accelVec.x ** 2 + s.accelVec.y ** 2);
      expect(speed).toBeGreaterThan(0);
    });

    it('does not track when attached', () => {
      const target = new Player(GONDI_STATS);
      target.position = { x: 100, y: 0, z: 0 };
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.position = { x: 0, y: 0, z: 0 };
      s.attached = true;
      s.victim = target;

      const angleBefore = s.angle;
      s.update(16);

      // Angle should not change when attached
      expect(s.angle).toBe(angleBefore);
    });
  });

  describe('attachment', () => {
    it('attaches to victim and resets TTL', () => {
      const target = new Player(GONDI_STATS);
      target.position = { x: 50, y: 50, z: 0 };
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.ttl = 5000; // partially expired

      s.attachTo(target);

      expect(s.attached).toBe(true);
      expect(s.victim).toBe(target);
      expect(s.ttl).toBe(SNOT_CONFIG.maxTtl);
    });

    it('follows victim position with offset when attached', () => {
      const target = new Player(GONDI_STATS);
      target.position = { x: 100, y: 200, z: 0 };
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.attachTo(target);

      s.update(16);

      // Snot should be near victim but offset by orbit vector
      const dx = s.position.x - target.position.x;
      const dy = s.position.y - target.position.y;
      const dz = s.position.z - target.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // Offset magnitude is sqrt(30^2 + 30^2) ≈ 42.4
      expect(dist).toBeCloseTo(42.4, 0);
    });

    it('orbit offset rotates over time', () => {
      const target = new Player(GONDI_STATS);
      target.position = { x: 0, y: 0, z: 0 };
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.attachTo(target);

      s.update(16);
      const pos1 = { ...s.position };

      s.update(500);
      const pos2 = { ...s.position };

      // After 500ms of rotation, position should have changed
      const moved = pos1.x !== pos2.x || pos1.y !== pos2.y || pos1.z !== pos2.z;
      expect(moved).toBe(true);
    });
  });

  describe('TTL and expiry', () => {
    it('decrements TTL each frame', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.update(100);
      expect(s.ttl).toBe(9900);
    });

    it('destroys when TTL expires while flying', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.update(10001);
      expect(s.alive).toBe(false);
    });

    it('destroys when TTL expires while attached', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.attachTo(target);
      s.update(10001);
      expect(s.alive).toBe(false);
    });
  });

  describe('animation', () => {
    it('starts at frame 0', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      expect(s.currentFrame).toBe(0);
    });

    it('advances frame based on animSpeed * dt', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.update(100);
      // 0.03 * 100 = 3
      expect(s.currentFrame).toBeCloseTo(3);
    });

    it('loops at frame 55 when TTL > 2000', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.ttl = 5000;
      // Push frame past 55: need 55/0.03 ≈ 1834ms
      s.currentFrame = 54;
      s.update(100); // 54 + 3 = 57 → wraps to 2
      expect(s.currentFrame).toBeCloseTo(2);
    });

    it('freezes at frame 116 when TTL <= 2000', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.ttl = 1500;
      s.currentFrame = 115;
      s.update(100); // 115 + 3 = 118 → clamped to 116
      expect(s.currentFrame).toBe(116);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/game/Snot.test.ts
```

Expected: FAIL — `./Snot` module not found.

**Step 3: Write the Snot class**

Create `src/game/Snot.ts`:

```typescript
import { EntityType, Vec3 } from '@/engine/Entity';
import { Bullet, BulletConfig } from './Bullet';
import { Player } from './Player';
import { Entity } from '@/engine/Entity';
import { ARENA } from './Arena';

export const SNOT_CONFIG: BulletConfig = {
  speedMaxScaler: ARENA.SNOT_SPEED_MAX_SCALER,
  maxTtl: ARENA.SNOT_MAX_TTL,
  damage: ARENA.SNOT_DAMAGE,
  collisionRadius: ARENA.SNOT_COLLISION_RADIUS,
};

export class Snot extends Bullet {
  target: Player;
  attached: boolean = false;
  victim: Player | null = null;
  currentFrame: number = 0;
  private orbitOffset: Vec3 = { x: 0, y: 0, z: 0 };

  constructor(origin: Entity, target: Player) {
    super(SNOT_CONFIG, origin);
    this.entityType = EntityType.Snot;
    this.target = target;
  }

  attachTo(victim: Player): void {
    this.attached = true;
    this.victim = victim;
    this.ttl = this.config.maxTtl;

    // Initialize orbit offset: (0, -30, -30) rotated by two random angles
    const randXZ = Math.random() * 360 * (Math.PI / 180);
    const randXY = Math.random() * 360 * (Math.PI / 180);

    let ox = 0, oy = -30, oz = -30;

    // Rotate XZ by randXZ
    const cosXZ = Math.cos(randXZ);
    const sinXZ = Math.sin(randXZ);
    const nx = ox * cosXZ - oz * sinXZ;
    const nz = ox * sinXZ + oz * cosXZ;
    ox = nx; oz = nz;

    // Rotate XY by randXY
    const cosXY = Math.cos(randXY);
    const sinXY = Math.sin(randXY);
    const nx2 = ox * cosXY - oy * sinXY;
    const ny2 = ox * sinXY + oy * cosXY;
    ox = nx2; oy = ny2;

    this.orbitOffset = { x: ox, y: oy, z: oz };
  }

  override update(dt: number): void {
    // Animation
    this.currentFrame += ARENA.SNOT_ANIM_SPEED * dt;
    if (this.ttl > ARENA.SNOT_FADE_TTL_THRESHOLD) {
      if (this.currentFrame >= ARENA.SNOT_LOOP_END_FRAME) {
        this.currentFrame -= ARENA.SNOT_LOOP_END_FRAME;
      }
    } else {
      if (this.currentFrame > ARENA.SNOT_FADE_FRAME) {
        this.currentFrame = ARENA.SNOT_FADE_FRAME;
      }
    }

    if (this.attached && this.victim) {
      // Orbit: rotate offset on XZ and XY planes
      const rotSpeed = ARENA.SNOT_ORBIT_SPEED * dt;
      const cosR = Math.cos(rotSpeed);
      const sinR = Math.sin(rotSpeed);

      // Rotate XZ
      const ox = this.orbitOffset.x * cosR - this.orbitOffset.z * sinR;
      const oz = this.orbitOffset.x * sinR + this.orbitOffset.z * cosR;
      this.orbitOffset.x = ox;
      this.orbitOffset.z = oz;

      // Rotate XY
      const ox2 = this.orbitOffset.x * cosR - this.orbitOffset.y * sinR;
      const oy2 = this.orbitOffset.x * sinR + this.orbitOffset.y * cosR;
      this.orbitOffset.x = ox2;
      this.orbitOffset.y = oy2;

      // Follow victim
      this.position = {
        x: this.victim.position.x + this.orbitOffset.x,
        y: this.victim.position.y + this.orbitOffset.y,
        z: this.victim.position.z + this.orbitOffset.z,
      };

      // TTL countdown (no physics movement)
      this.ttl -= dt;
      if (this.ttl <= 0) {
        this.destroy();
      }
    } else {
      // Tracking: adjust angle toward target
      this.trackTarget();

      // Normal bullet update (physics + TTL)
      super.update(dt);
    }
  }

  private trackTarget(): void {
    const dx = this.target.position.x - this.position.x;
    const dy = this.target.position.y - this.position.y;

    // Calculate angle from snot to target using dot product with up vector
    // Port of C++ CBullet::Render tracking code
    const vecLen = Math.sqrt(dx * dx + dy * dy);
    if (vecLen < 0.001) return;

    const nx = dx / vecLen;
    const ny = dy / vecLen;

    // Dot product with up vector (0, 1, 0)
    const cosAlpha = ny;
    let angle = Math.acos(Math.max(-1, Math.min(1, cosAlpha)));
    angle = (angle * 180) / Math.PI;

    if (nx > 0) {
      angle = 360 - angle;
    }

    this.angle = angle;
    this.correctAngle();

    // Set velocity toward target
    const speedVec = this.getFullSpeedVec(this.config.speedMaxScaler);
    this.accelVec = { ...speedVec };
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/game/Snot.test.ts
```

Expected: All pass.

**Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: All pass.

**Step 6: Commit**

```bash
git add src/game/Snot.ts src/game/Snot.test.ts
git commit -m "feat(m6): add Snot entity with tracking, attachment, orbit, and animation"
```

---

### Task 4: Add Snot Debuff to Player (Speed + Rotation)

**Files:**
- Modify: `src/game/Player.ts`
- Modify: `src/game/Player.test.ts`

**Step 1: Write the failing tests**

Add to `src/game/Player.test.ts`:

```typescript
  describe('snot debuff', () => {
    it('starts with zero snotCount', () => {
      const p = new Player(GONDI_STATS);
      expect(p.snotCount).toBe(0);
    });

    it('addSnot increments count', () => {
      const p = new Player(GONDI_STATS);
      p.addSnot();
      expect(p.snotCount).toBe(1);
      p.addSnot();
      expect(p.snotCount).toBe(2);
    });

    it('removeSnot decrements count', () => {
      const p = new Player(GONDI_STATS);
      p.addSnot();
      p.addSnot();
      p.removeSnot();
      expect(p.snotCount).toBe(1);
    });

    it('getEffectiveMaxSpeed returns base / (snotCount + 1)', () => {
      const p = new Player(GONDI_STATS);
      expect(p.getEffectiveMaxSpeed()).toBeCloseTo(1.2); // 1.2 / 1
      p.addSnot();
      expect(p.getEffectiveMaxSpeed()).toBeCloseTo(0.6); // 1.2 / 2
      p.addSnot();
      expect(p.getEffectiveMaxSpeed()).toBeCloseTo(0.4); // 1.2 / 3
      p.addSnot();
      expect(p.getEffectiveMaxSpeed()).toBeCloseTo(0.3); // 1.2 / 4
    });

    it('getEffectiveRotSpeed returns base / (floor(snotCount/3) + 1)', () => {
      const p = new Player(GONDI_STATS);
      expect(p.getEffectiveRotSpeed()).toBeCloseTo(0.5); // 0 snots: 0.5 / 1
      p.addSnot();
      expect(p.getEffectiveRotSpeed()).toBeCloseTo(0.5); // 1 snot: 0.5 / 1
      p.addSnot();
      expect(p.getEffectiveRotSpeed()).toBeCloseTo(0.5); // 2 snots: 0.5 / 1
      p.addSnot();
      expect(p.getEffectiveRotSpeed()).toBeCloseTo(0.25); // 3 snots: 0.5 / 2
    });

    it('thrust uses effective max speed', () => {
      const p = new Player(GONDI_STATS);
      p.angle = 0;
      p.addSnot(); // speed halved: 1.2 / 2 = 0.6

      // Thrust many times to reach max
      for (let i = 0; i < 100; i++) p.thrust(100);

      // Should cap at 0.6 instead of 1.2
      expect(p.accelVec.y).toBeCloseTo(0.6, 1);
    });

    it('rotation uses effective rotation speed', () => {
      const p = new Player(GONDI_STATS);
      p.snotCount = 3; // rotSpeed halved: 0.5 / 2 = 0.25
      p.rotate(1, 100);
      // delta = 0.25 * (100 * 0.35) = 8.75
      expect(p.angle).toBeCloseTo(8.75);
    });
  });
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/game/Player.test.ts
```

Expected: FAIL — `snotCount`, `addSnot`, etc. not defined.

**Step 3: Implement player snot debuff**

In `src/game/Player.ts`:

Add fields after `primaryCooldown`:
```typescript
  snotCount: number = 0;
  secondaryCooldown: number = 0;
```

Add methods:
```typescript
  addSnot(): void {
    this.snotCount += 1;
  }

  removeSnot(): void {
    this.snotCount -= 1;
  }

  getEffectiveMaxSpeed(): number {
    return this.stats.speedMaxScaler / (this.snotCount + 1);
  }

  getEffectiveRotSpeed(): number {
    return this.stats.rotationSpeed / (Math.floor(this.snotCount / 3) + 1);
  }
```

Modify `thrust()` to use effective speed:
```typescript
  thrust(dt: number): void {
    const accelAdd = this.stats.acceleration * (dt * ARENA.TIME_SCALER);
    const fullSpeed = this.getFullSpeedVec(this.getEffectiveMaxSpeed());
    this.accelVec.x = this.moveToward(this.accelVec.x, fullSpeed.x, accelAdd);
    this.accelVec.y = this.moveToward(this.accelVec.y, fullSpeed.y, accelAdd);
  }
```

Modify `rotate()` to use effective rotation speed:
```typescript
  rotate(direction: 1 | -1, dt: number): void {
    const rotSpeed = this.getEffectiveRotSpeed();
    const delta = rotSpeed * (dt * ARENA.TIME_SCALER);
    // ... rest unchanged
  }
```

Also update `resetRoll()` to use `getEffectiveRotSpeed()`:
```typescript
  resetRoll(dt: number): void {
    if (!this.needRollReset) {
      this.rollAngle = 0;
      return;
    }
    const rotSpeed = this.getEffectiveRotSpeed();
    const delta = ROLL_SCALER * rotSpeed * (dt * ARENA.TIME_SCALER);
    // ... rest unchanged
  }
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/game/Player.test.ts
```

Expected: All pass. Note: The existing rotation test `'increases angle when rotating left'` expects `17.5` which is `0.5 * 100 * 0.35`. With 0 snots, `getEffectiveRotSpeed()` returns `0.5 / 1 = 0.5`, so existing tests still pass.

**Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: All pass.

**Step 6: Commit**

```bash
git add src/game/Player.ts src/game/Player.test.ts
git commit -m "feat(m6): add snot debuff to Player (speed/rotation reduction)"
```

---

### Task 5: Add Secondary Weapon Fire to Player

**Files:**
- Modify: `src/game/Player.ts`
- Modify: `src/game/Player.test.ts`

**Step 1: Write the failing tests**

Add to `src/game/Player.test.ts` (need to import `Snot` and `SNOT_CONFIG`):

```typescript
import { Snot, SNOT_CONFIG } from './Snot';

// ... inside describe('Player', () => { ... })

  describe('fireSecondary', () => {
    it('creates a snot when fired', () => {
      const p = new Player(GONDI_STATS);
      const enemy = new Player(GONDI_STATS);
      const snot = p.fireSecondary(enemy);
      expect(snot).not.toBeNull();
      expect(snot).toBeInstanceOf(Snot);
    });

    it('deducts energy on fire', () => {
      const p = new Player(GONDI_STATS);
      const enemy = new Player(GONDI_STATS);
      p.fireSecondary(enemy);
      // Gondi secondary uses primaryEnergyCost = 0.12
      expect(p.energy).toBeCloseTo(1 - 0.12);
    });

    it('sets secondary cooldown on fire', () => {
      const p = new Player(GONDI_STATS);
      const enemy = new Player(GONDI_STATS);
      p.fireSecondary(enemy);
      expect(p.secondaryCooldown).toBe(200);
    });

    it('returns null when secondary cooldown is active', () => {
      const p = new Player(GONDI_STATS);
      const enemy = new Player(GONDI_STATS);
      p.secondaryCooldown = 50;
      expect(p.fireSecondary(enemy)).toBeNull();
    });

    it('returns null when energy is too low', () => {
      const p = new Player(GONDI_STATS);
      const enemy = new Player(GONDI_STATS);
      p.energy = 0.12; // exactly at cost — blocked (uses <= check)
      expect(p.fireSecondary(enemy)).toBeNull();
    });

    it('spawns snot 25 units ahead', () => {
      const p = new Player(GONDI_STATS);
      const enemy = new Player(GONDI_STATS);
      p.position = { x: 100, y: 200, z: 0 };
      p.angle = 0;
      const snot = p.fireSecondary(enemy)!;
      expect(snot.position.x).toBeCloseTo(100);
      expect(snot.position.y).toBeCloseTo(225);
    });

    it('sets snot target to enemy', () => {
      const p = new Player(GONDI_STATS);
      const enemy = new Player(GONDI_STATS);
      const snot = p.fireSecondary(enemy)!;
      expect(snot.target).toBe(enemy);
    });

    it('sets snot origin to self', () => {
      const p = new Player(GONDI_STATS);
      const enemy = new Player(GONDI_STATS);
      const snot = p.fireSecondary(enemy)!;
      expect(snot.originEntity).toBe(p);
    });

    it('decrements secondary cooldown in updateEnergy', () => {
      const p = new Player(GONDI_STATS);
      p.secondaryCooldown = 100;
      p.updateEnergy(60);
      expect(p.secondaryCooldown).toBe(40);
    });
  });
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/game/Player.test.ts
```

Expected: FAIL — `fireSecondary` not defined.

**Step 3: Implement fireSecondary**

In `src/game/Player.ts`, add import:
```typescript
import { Snot } from './Snot';
import { ARENA } from './Arena';
```

Add method to `Player` class:
```typescript
  fireSecondary(enemy: Player): Snot | null {
    if (this.secondaryCooldown > 0) return null;
    if (this.energy <= this.stats.primaryEnergyCost) return null;

    this.energy -= this.stats.primaryEnergyCost;
    this.secondaryCooldown = ARENA.SECONDARY_WEAPON_DELAY;

    const snot = new Snot(this, enemy);
    snot.angle = this.angle;

    // Spawn 25 units ahead along heading
    const spawnVec = this.getFullSpeedVec(25);
    snot.position = {
      x: this.position.x + spawnVec.x,
      y: this.position.y + spawnVec.y,
      z: this.position.z,
    };

    // Set initial velocity toward target direction
    const speedVec = this.getFullSpeedVec(SNOT_CONFIG.speedMaxScaler);
    snot.accelVec = { ...speedVec };

    return snot;
  }
```

Update `updateEnergy()` to also decrement `secondaryCooldown`:
```typescript
  updateEnergy(dt: number): void {
    if (this.primaryCooldown > 0) {
      this.primaryCooldown -= dt;
      if (this.primaryCooldown < 0) this.primaryCooldown = 0;
    }
    if (this.secondaryCooldown > 0) {
      this.secondaryCooldown -= dt;
      if (this.secondaryCooldown < 0) this.secondaryCooldown = 0;
    }
    this.energy += this.stats.primaryWeaponFillRate * dt;
    if (this.energy > 1) this.energy = 1;
  }
```

**Step 4: Run tests**

```bash
npx vitest run src/game/Player.test.ts
```

Expected: All pass.

**Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: All pass.

**Step 6: Commit**

```bash
git add src/game/Player.ts src/game/Player.test.ts
git commit -m "feat(m6): add fireSecondary method to Player"
```

---

### Task 6: Add SnotHitEvent and Update Collision System

**Files:**
- Modify: `src/engine/GameEvent.ts`
- Modify: `src/engine/CollisionDetector.ts`
- Modify: `src/engine/CollisionDetector.test.ts`

**Step 1: Write failing tests**

Add to `src/engine/CollisionDetector.test.ts` (or create new describe block). Need to import Snot and SnotHitEvent:

```typescript
import { Snot } from '@/game/Snot';
import { Player, GONDI_STATS } from '@/game/Player';
import { SnotHitEvent, GameEventType } from './GameEvent';

// Add these test cases inside the existing describe block:

  describe('snot collision', () => {
    it('emits SnotHitEvent when snot hits a player', () => {
      const events: GameEvent[] = [];
      const listener = { onGameEvent: (e: GameEvent) => events.push(e) };
      GameEventMgr.getInstance().addListener(listener, GameEventType.SnotHit);

      const origin = new Player(GONDI_STATS);
      origin.position = { x: -100, y: 0, z: 0 };
      origin.previousPosition = { x: -100, y: 0, z: 0 };

      const target = new Player(GONDI_STATS);
      target.position = { x: 5, y: 0, z: 0 };
      target.previousPosition = { x: 5, y: 0, z: 0 };

      const snot = new Snot(origin, target);
      snot.position = { x: 4, y: 0, z: 0 }; // overlapping with target
      snot.previousPosition = { x: 3, y: 0, z: 0 };

      const detector = new CollisionDetector();
      detector.checkCollisions([snot, target]);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe(GameEventType.SnotHit);

      GameEventMgr.getInstance().removeListener(listener, GameEventType.SnotHit);
    });

    it('does not collide snot with its origin player', () => {
      const events: GameEvent[] = [];
      const listener = { onGameEvent: (e: GameEvent) => events.push(e) };
      GameEventMgr.getInstance().addListener(listener, GameEventType.SnotHit);

      const origin = new Player(GONDI_STATS);
      origin.position = { x: 0, y: 0, z: 0 };
      origin.previousPosition = { x: 0, y: 0, z: 0 };

      const target = new Player(GONDI_STATS);
      target.position = { x: 200, y: 0, z: 0 };

      const snot = new Snot(origin, target);
      snot.position = { x: 0, y: 0, z: 0 }; // overlapping with origin
      snot.previousPosition = { x: 0, y: 0, z: 0 };

      const detector = new CollisionDetector();
      detector.checkCollisions([snot, origin]);

      expect(events.length).toBe(0);

      GameEventMgr.getInstance().removeListener(listener, GameEventType.SnotHit);
    });

    it('skips attached snots in collision detection', () => {
      const events: GameEvent[] = [];
      const listener = { onGameEvent: (e: GameEvent) => events.push(e) };
      GameEventMgr.getInstance().addListener(listener, GameEventType.SnotHit);

      const origin = new Player(GONDI_STATS);
      const target = new Player(GONDI_STATS);
      target.position = { x: 5, y: 0, z: 0 };
      target.previousPosition = { x: 5, y: 0, z: 0 };

      const snot = new Snot(origin, target);
      snot.attached = true; // already attached
      snot.position = { x: 5, y: 0, z: 0 };
      snot.previousPosition = { x: 5, y: 0, z: 0 };

      const detector = new CollisionDetector();
      detector.checkCollisions([snot, target]);

      expect(events.length).toBe(0);

      GameEventMgr.getInstance().removeListener(listener, GameEventType.SnotHit);
    });

    it('does not collide snot with another snot', () => {
      const events: GameEvent[] = [];
      const listener = { onGameEvent: (e: GameEvent) => events.push(e) };
      GameEventMgr.getInstance().addListener(listener, GameEventType.SnotHit);

      const origin = new Player(GONDI_STATS);
      const target = new Player(GONDI_STATS);

      const s1 = new Snot(origin, target);
      s1.position = { x: 0, y: 0, z: 0 };
      s1.previousPosition = { x: 0, y: 0, z: 0 };

      const s2 = new Snot(origin, target);
      s2.position = { x: 0, y: 0, z: 0 };
      s2.previousPosition = { x: 0, y: 0, z: 0 };

      const detector = new CollisionDetector();
      detector.checkCollisions([s1, s2]);

      expect(events.length).toBe(0);

      GameEventMgr.getInstance().removeListener(listener, GameEventType.SnotHit);
    });
  });
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/engine/CollisionDetector.test.ts
```

Expected: FAIL — `SnotHitEvent` not defined.

**Step 3: Add SnotHitEvent to GameEvent.ts**

In `src/engine/GameEvent.ts`:

Add `SnotHit` to the enum:
```typescript
export enum GameEventType {
  Collision,
  Explosion,
  BulletHit,
  SunCollision,
  FrameRender,
  SnotHit,
}
```

Add the event class at the bottom:
```typescript
export class SnotHitEvent extends GameEvent {
  readonly snot: Entity;
  readonly target: Entity;

  constructor(snot: Entity, target: Entity) {
    super(GameEventType.SnotHit);
    this.snot = snot;
    this.target = target;
  }
}
```

**Step 4: Update CollisionDetector**

In `src/engine/CollisionDetector.ts`:

Add import:
```typescript
import { Snot } from '@/game/Snot';
import { CollisionEvent, BulletHitEvent, SunCollisionEvent, SnotHitEvent } from './GameEvent';
```

Update `shouldCheck()`:
```typescript
  private shouldCheck(a: Entity, b: Entity): boolean {
    const aIsBullet = a.entityType === EntityType.Bullet;
    const bIsBullet = b.entityType === EntityType.Bullet;
    const aIsSnot = a.entityType === EntityType.Snot;
    const bIsSnot = b.entityType === EntityType.Snot;

    // Bullets don't collide with bullets
    if (aIsBullet && bIsBullet) return false;

    // Snots don't collide with snots or bullets
    if (aIsSnot && (bIsSnot || bIsBullet)) return false;
    if (bIsSnot && (aIsSnot || aIsBullet)) return false;

    // Attached snots skip collision entirely
    if (aIsSnot && (a as Snot).attached) return false;
    if (bIsSnot && (b as Snot).attached) return false;

    // Projectiles don't collide with their origin
    if (aIsBullet && (a as Bullet).originEntity === b) return false;
    if (bIsBullet && (b as Bullet).originEntity === a) return false;
    if (aIsSnot && (a as Snot).originEntity === b) return false;
    if (bIsSnot && (b as Snot).originEntity === a) return false;

    return true;
  }
```

Update `emitEvent()`:
```typescript
  private emitEvent(mgr: GameEventMgr, a: Entity, b: Entity, u0: number): void {
    const aIsSnot = a.entityType === EntityType.Snot;
    const bIsSnot = b.entityType === EntityType.Snot;
    const aIsBullet = a.entityType === EntityType.Bullet;
    const bIsBullet = b.entityType === EntityType.Bullet;
    const aIsSun = a.entityType === EntityType.Sun;
    const bIsSun = b.entityType === EntityType.Sun;

    if (aIsSnot) {
      mgr.sendEvent(new SnotHitEvent(a, b));
    } else if (bIsSnot) {
      mgr.sendEvent(new SnotHitEvent(b, a));
    } else if (aIsBullet) {
      mgr.sendEvent(new BulletHitEvent(a, b));
    } else if (bIsBullet) {
      mgr.sendEvent(new BulletHitEvent(b, a));
    } else if (aIsSun) {
      mgr.sendEvent(new SunCollisionEvent(a, b));
    } else if (bIsSun) {
      mgr.sendEvent(new SunCollisionEvent(b, a));
    } else {
      mgr.sendEvent(new CollisionEvent(a, b, u0));
    }
  }
```

**Step 5: Run tests**

```bash
npx vitest run src/engine/CollisionDetector.test.ts
```

Expected: All pass.

**Step 6: Run full test suite**

```bash
npx vitest run
```

Expected: All pass.

**Step 7: Commit**

```bash
git add src/engine/GameEvent.ts src/engine/CollisionDetector.ts src/engine/CollisionDetector.test.ts
git commit -m "feat(m6): add SnotHitEvent and update collision detector for snots"
```

---

### Task 7: Add SnotHit Handler to CollisionHandler

**Files:**
- Modify: `src/game/CollisionHandler.ts`
- Modify: `src/game/CollisionHandler.test.ts`

**Step 1: Write failing tests**

Add to `src/game/CollisionHandler.test.ts`:

```typescript
import { Snot } from './Snot';
import { SnotHitEvent } from '@/engine/GameEvent';

// Inside describe('CollisionHandler', () => { ... })

  describe('snot hit', () => {
    it('attaches snot to target player', () => {
      const origin = new Player(GONDI_STATS);
      const target = new Player(GONDI_STATS);
      const snot = new Snot(origin, target);

      const evt = new SnotHitEvent(snot, target);
      handler.onGameEvent(evt);

      expect(snot.attached).toBe(true);
      expect(snot.victim).toBe(target);
    });

    it('increments target snotCount', () => {
      const origin = new Player(GONDI_STATS);
      const target = new Player(GONDI_STATS);
      const snot = new Snot(origin, target);

      const evt = new SnotHitEvent(snot, target);
      handler.onGameEvent(evt);

      expect(target.snotCount).toBe(1);
    });

    it('destroys snot when target is not a player', () => {
      const origin = new Player(GONDI_STATS);
      const target = new Player(GONDI_STATS);
      const snot = new Snot(origin, target);

      const sun = new Entity();
      sun.entityType = EntityType.Sun;

      const evt = new SnotHitEvent(snot, sun);
      handler.onGameEvent(evt);

      expect(snot.alive).toBe(false);
      expect(snot.attached).toBe(false);
    });

    it('keeps snot alive when attaching to player', () => {
      const origin = new Player(GONDI_STATS);
      const target = new Player(GONDI_STATS);
      const snot = new Snot(origin, target);

      const evt = new SnotHitEvent(snot, target);
      handler.onGameEvent(evt);

      expect(snot.alive).toBe(true);
    });
  });
```

Also need to add `Player` import at the top of the test file:
```typescript
import { Player, GONDI_STATS } from './Player';
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/game/CollisionHandler.test.ts
```

Expected: FAIL — `SnotHitEvent` handler not recognized.

**Step 3: Implement handleSnotHit**

In `src/game/CollisionHandler.ts`:

Add imports:
```typescript
import { GameEvent, GameEventType, BulletHitEvent, CollisionEvent, SunCollisionEvent, SnotHitEvent } from '@/engine/GameEvent';
import { Snot } from './Snot';
import { Player } from './Player';
```

Add to `onGameEvent()`:
```typescript
    } else if (event.type === GameEventType.SnotHit) {
      this.handleSnotHit(event as SnotHitEvent);
    }
```

Add handler method:
```typescript
  private handleSnotHit(event: SnotHitEvent): void {
    const snot = event.snot as Snot;
    const target = event.target;

    if (target.entityType === EntityType.Player) {
      snot.attachTo(target as Player);
      (target as Player).addSnot();
    } else {
      snot.destroy();
    }
  }
```

**Step 4: Run tests**

```bash
npx vitest run src/game/CollisionHandler.test.ts
```

Expected: All pass.

**Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: All pass.

**Step 6: Commit**

```bash
git add src/game/CollisionHandler.ts src/game/CollisionHandler.test.ts
git commit -m "feat(m6): add snot hit handler for attachment and debuff"
```

---

### Task 8: Add Secondary Fire Input Binding

**Files:**
- Modify: `src/input/InputManager.ts`
- Modify: `src/input/InputManager.test.ts`

**Step 1: Write failing tests**

Add to `src/input/InputManager.test.ts`:

```typescript
  it('detects P1 secondary fire on period key', () => {
    // Simulate pressing '.'
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '.' }));
    const pi = input.player(0);
    expect(pi.fireSecondary).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: '.' }));
  });

  it('detects P2 secondary fire on Shift key', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
    const pi = input.player(1);
    expect(pi.fireSecondary).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
  });
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/input/InputManager.test.ts
```

Expected: FAIL — `fireSecondary` not in PlayerInput.

**Step 3: Implement**

In `src/input/InputManager.ts`:

Add `fireSecondary` to both interfaces:
```typescript
export interface PlayerInput {
  thrust: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
  firePrimary: boolean;
  fireSecondary: boolean;
}

interface PlayerKeyBindings {
  thrust: string[];
  rotateLeft: string[];
  rotateRight: string[];
  firePrimary: string[];
  fireSecondary: string[];
}
```

Update bindings:
```typescript
const DEFAULT_BINDINGS: PlayerKeyBindings[] = [
  // Player 1: Arrow keys + / + .
  {
    thrust: ['ArrowUp'],
    rotateLeft: ['ArrowLeft'],
    rotateRight: ['ArrowRight'],
    firePrimary: ['/'],
    fireSecondary: ['.'],
  },
  // Player 2: WASD + Space + Shift
  {
    thrust: ['w', 'W'],
    rotateLeft: ['a', 'A'],
    rotateRight: ['d', 'D'],
    firePrimary: [' '],
    fireSecondary: ['Shift'],
  },
];
```

Update `player()` method:
```typescript
  player(index: number): PlayerInput {
    const b = this.bindings[index];
    return {
      thrust: b.thrust.some(k => this.pressed.has(k)),
      rotateLeft: b.rotateLeft.some(k => this.pressed.has(k)),
      rotateRight: b.rotateRight.some(k => this.pressed.has(k)),
      firePrimary: b.firePrimary.some(k => this.pressed.has(k)),
      fireSecondary: b.fireSecondary.some(k => this.pressed.has(k)),
    };
  }
```

**Step 4: Run tests**

```bash
npx vitest run src/input/InputManager.test.ts
```

Expected: All pass.

**Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: All pass.

**Step 6: Commit**

```bash
git add src/input/InputManager.ts src/input/InputManager.test.ts
git commit -m "feat(m6): add fireSecondary input binding (P1: period, P2: Shift)"
```

---

### Task 9: Wire Everything Up in main.ts

**Files:**
- Modify: `src/main.ts`

**Step 1: Add snot imports**

```typescript
import { Snot } from '@/game/Snot';
import { ARENA } from '@/game/Arena';
```

**Step 2: Load snot atlas texture**

After the sun glow section (~line 148), add:

```typescript
// Snot sprites — animated billboard with sprite sheet atlas
const SNOT_ATLAS_COLS = ARENA.SNOT_ATLAS_COLS;
const SNOT_ATLAS_ROWS = ARENA.SNOT_ATLAS_ROWS;

const snotTexture = new THREE.TextureLoader().load('/textures/snot_atlas.jpg');
snotTexture.repeat.set(1 / SNOT_ATLAS_COLS, 1 / SNOT_ATLAS_ROWS);
snotTexture.wrapS = THREE.RepeatWrapping;
snotTexture.wrapT = THREE.RepeatWrapping;

const snotSprites = new Map<Snot, { sprite: THREE.Sprite; texture: THREE.Texture }>();
```

**Step 3: Register SnotHit event listener**

After the existing event listeners (~line 168), add:

```typescript
GameEventMgr.getInstance().addListener(collisionHandler, GameEventType.SnotHit);
```

**Step 4: Add secondary fire to updatePlayerInput**

In the `updatePlayerInput` function, add the `enemy` parameter and secondary fire logic. Change the function signature:

```typescript
function updatePlayerInput(
  player: Player,
  enemy: Player,
  pi: PlayerInput,
  thrustEffect: ThrustEffect,
  dt: number,
): void {
```

Add after the primary fire block:

```typescript
  if (pi.fireSecondary) {
    const snot = player.fireSecondary(enemy);
    if (snot) {
      entityManager.add(snot);
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
      scene.add(sprite);
      snotSprites.set(snot, { sprite, texture: mat.map! });
    }
  }
```

**Step 5: Update function calls in game loop**

Change the two `updatePlayerInput` calls:

```typescript
    updatePlayerInput(player1, player2, input.player(0), thrustEffect1, dt);
    updatePlayerInput(player2, player1, input.player(1), thrustEffect2, dt);
```

**Step 6: Add snot sprite sync and animation in the game loop**

After the bullet sprite sync block (~line 282), add:

```typescript
    // Sync snot sprites: update position and animation frame
    for (const [snot, { sprite, texture }] of snotSprites) {
      if (!snot.alive) {
        scene.remove(sprite);
        (sprite.material as THREE.SpriteMaterial).dispose();
        texture.dispose();
        snotSprites.delete(snot);
      } else {
        sprite.position.set(snot.position.x, snot.position.y, snot.position.z);
        // Update atlas frame
        const frameIndex = Math.floor(snot.currentFrame);
        const col = frameIndex % SNOT_ATLAS_COLS;
        const row = Math.floor(frameIndex / SNOT_ATLAS_COLS);
        texture.offset.set(col / SNOT_ATLAS_COLS, 1 - (row + 1) / SNOT_ATLAS_ROWS);
      }
    }
```

**Step 7: Apply sun gravity to snots**

After the player gravity calls, add gravity for all entities with snots:

```typescript
    // Sun gravity on snots in flight
    for (const [snot] of snotSprites) {
      if (!snot.attached) {
        applySunGravity(snot, ARENA.SUN_POSITION, dt);
      }
    }
```

**Step 8: Run full test suite**

```bash
npx vitest run
```

Expected: All pass.

**Step 9: Run dev server and manually test**

```bash
npm run dev
```

Test:
1. Press `.` as P1 — green snot fires and tracks P2
2. Press `Shift` as P2 — green snot fires and tracks P1
3. Snot homes toward opponent
4. On hit: snot attaches and orbits victim
5. Victim ship slows down noticeably
6. After 10 seconds, snot fades and disappears
7. Multiple snots stack (rotation gets sluggish at 3+)

**Step 10: Commit**

```bash
git add src/main.ts
git commit -m "feat(m6): integrate snot sprites, secondary fire, and events into game loop"
```

---

### Task 10: Handle Snot Expiry Removing Debuff

**Files:**
- Modify: `src/game/Snot.ts`

This is already handled in the `Snot.update()` method — when TTL expires and the snot is attached, it calls `this.destroy()`. But we need to also decrement the victim's snot count.

**Step 1: Write failing test**

Add to `src/game/Snot.test.ts`:

```typescript
  describe('expiry removes debuff', () => {
    it('decrements victim snotCount when attached snot expires', () => {
      const target = new Player(GONDI_STATS);
      const origin = new Player(GONDI_STATS);
      const s = new Snot(origin, target);
      s.attachTo(target);
      target.addSnot(); // simulate what CollisionHandler does

      expect(target.snotCount).toBe(1);

      // Expire the snot
      s.update(10001);

      expect(s.alive).toBe(false);
      expect(target.snotCount).toBe(0);
    });
  });
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/game/Snot.test.ts
```

Expected: FAIL — snotCount remains 1 after expiry.

**Step 3: Implement**

In `src/game/Snot.ts`, update the attached branch of `update()`:

```typescript
      // TTL countdown (no physics movement)
      this.ttl -= dt;
      if (this.ttl <= 0) {
        if (this.victim) {
          this.victim.removeSnot();
        }
        this.destroy();
      }
```

Also update the flying branch — when a flying snot expires (TTL runs out before hitting anyone), it just dies, no victim to notify. The `super.update(dt)` already handles destroy. No change needed there.

**Step 4: Run tests**

```bash
npx vitest run src/game/Snot.test.ts
```

Expected: All pass.

**Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: All pass.

**Step 6: Commit**

```bash
git add src/game/Snot.ts src/game/Snot.test.ts
git commit -m "fix(m6): decrement victim snotCount when attached snot expires"
```

---

### Task 11: Final Integration Test and Polish

**Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: All pass.

**Step 2: Run dev server**

```bash
npm run dev
```

**Step 3: Manual testing checklist**

- [ ] P1 fires snot with `.` key — green blob appears
- [ ] Snot homes toward P2
- [ ] Snot attaches on contact with P2
- [ ] Attached snot orbits P2 visually
- [ ] P2 movement slows (thrust to max takes longer)
- [ ] P2 rotation slows at 3+ snots
- [ ] Snot disappears after ~10 seconds
- [ ] P2 speed/rotation returns to normal after snot expires
- [ ] P2 fires snot with `Shift` key — targets P1
- [ ] Snots destroyed on sun contact
- [ ] Multiple snots can attach to same player
- [ ] Animation plays (looping green blob, fades near end of life)
- [ ] Energy depletes when firing snots
- [ ] Cooldown prevents rapid fire

**Step 4: Commit any polish fixes**

```bash
git add -A
git commit -m "feat(m6): complete snot mechanic integration"
```
