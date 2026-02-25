# Sholev Character Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Sholev character with ice shard primary weapon and frost shield secondary weapon.

**Architecture:** SholevPlayer extends Player (same pattern as MichiGichiPlayer). Ice shard is a standard animated projectile using BulletConfig. Frost shield is a persistent, player-attached bullet that drains energy, rate-limits damage, and boosts stats while active. Two new BulletConfig optional fields (`persistent`, `hitRateLimit`) extend the existing behavior-driven bullet system.

**Tech Stack:** Three.js, TypeScript, Vitest

---

## Reference: C++ Source Values

From `sholev.cpp`: speed 0.8, accel 0.004, rotation 0.5, primaryDelay 100, primaryEnergyCost 0.07, secondaryEnergyCost 0.0, collision sphere (0,0,0) r10, model scale 2.0 rotation -90x.

From `IceBullet.cpp`: damage 0.03, TTL 700, speed 1.5, tracking false, collision (0,5,0) r1, 65-frame animation at 0.2 anim speed, additive blending.

From `FrostBullet.cpp`: damage 0.3, TTL 500000, speed 0, fixed=true, collision (0,-25,0) r11, energy drain 0.0003/ms, hit rate limit 500ms per target, particle texture `ice_shield-01_00065.png`.

From `sholev.cpp` HandleSecondaryWeapon: on activate speed→1.6 rotation→1.0, on deactivate speed→0.8 rotation→0.5, min energy 0.25 to activate, only one active frost at a time, disables thrust particles while active.

---

### Task 1: Asset Preparation

**Files:**
- Create: `public/models/sholev.glb`
- Create: `public/textures/ice_shot_atlas.png`
- Create: `public/textures/frost_shield.png`

**Step 1: Convert Sholev model**

```bash
cd /Users/ori/Documents/CosmoClash/turtle_svn/trunk/Turtle/mediaflat/sholev
assimp export sholev.X /Users/ori/Documents/CosmoClash/cosmoclash-web/public/models/sholev.glb
```

Copy texture to models dir for GLB texture reference:
```bash
cp Sholev2kTextureMap.jpg /Users/ori/Documents/CosmoClash/cosmoclash-web/public/models/
```

Verify model loads in browser dev tools after step 7.

**Step 2: Create ice shard atlas from 65 JPG frames**

The 65 frames live at `../turtle_svn/trunk/Turtle/mediaflat/Ice_shot/Ice_shot-small_00000.jpg` through `00064.jpg`.

Pack into 9x8 grid (72 slots, 65 used). Use ImageMagick montage + alpha-from-luminance conversion (same pattern as flame/explosion):

```bash
cd /Users/ori/Documents/CosmoClash/turtle_svn/trunk/Turtle/mediaflat/Ice_shot

# Create montage in 9 columns (65 frames → 9x8 grid, last 7 slots blank)
montage Ice_shot-small_*.jpg -tile 9x8 -geometry +0+0 -background black /tmp/ice_shot_raw.png

# Derive alpha from luminance (same pattern as explosion atlas)
magick /tmp/ice_shot_raw.png \( +clone -colorspace gray \) -alpha off -compose CopyOpacity -composite /Users/ori/Documents/CosmoClash/cosmoclash-web/public/textures/ice_shot_atlas.png
```

**Step 3: Prepare frost shield texture**

Pick frame 65 (the final/representative frame) and derive alpha from luminance:

```bash
cd "/Users/ori/Documents/CosmoClash/turtle_svn/trunk/Turtle/mediaflat/ice_shield"

magick "ice shield-01_00065.png" \( +clone -colorspace gray \) -alpha off -compose CopyOpacity -composite /Users/ori/Documents/CosmoClash/cosmoclash-web/public/textures/frost_shield.png
```

**Step 4: Commit assets**

```bash
git add public/models/sholev.glb public/models/Sholev2kTextureMap.jpg public/textures/ice_shot_atlas.png public/textures/frost_shield.png
git commit -m "assets: add Sholev model, ice shard atlas, frost shield texture"
```

---

### Task 2: ICE_BULLET_CONFIG + BulletConfig Extensions

**Files:**
- Modify: `src/game/Bullet.ts:5-14` (BulletConfig interface)
- Modify: `src/game/Bullet.ts:43` (add new configs after SUN_BULLET_CONFIG)
- Modify: `src/game/Bullet.ts:46-80` (Bullet class — add damageCooldown field)
- Modify: `src/game/Bullet.ts:90-143` (Bullet.update — decrement damageCooldown)
- Test: `src/game/Bullet.test.ts`

**Step 1: Write failing tests for new configs and fields**

Add to `src/game/Bullet.test.ts`:

```typescript
import { ICE_BULLET_CONFIG, FROST_SHIELD_CONFIG } from './Bullet';

describe('ICE_BULLET_CONFIG', () => {
  it('has correct ice shard values from C++', () => {
    expect(ICE_BULLET_CONFIG.speedMaxScaler).toBe(1.5);
    expect(ICE_BULLET_CONFIG.maxTtl).toBe(700);
    expect(ICE_BULLET_CONFIG.damage).toBe(0.03);
    expect(ICE_BULLET_CONFIG.collisionRadius).toBe(1);
    expect(ICE_BULLET_CONFIG.sound).toBe(SoundEffect.IceShot);
  });
});

describe('FROST_SHIELD_CONFIG', () => {
  it('has correct frost shield values from C++', () => {
    expect(FROST_SHIELD_CONFIG.speedMaxScaler).toBe(0);
    expect(FROST_SHIELD_CONFIG.maxTtl).toBe(500000);
    expect(FROST_SHIELD_CONFIG.damage).toBe(0.3);
    expect(FROST_SHIELD_CONFIG.collisionRadius).toBe(11);
    expect(FROST_SHIELD_CONFIG.attached).toBe(true);
    expect(FROST_SHIELD_CONFIG.persistent).toBe(true);
    expect(FROST_SHIELD_CONFIG.hitRateLimit).toBe(500);
    expect(FROST_SHIELD_CONFIG.sound).toBe(SoundEffect.FrostShot);
  });
});

describe('damageCooldown', () => {
  it('initializes to 0', () => {
    const b = new Bullet(FROST_SHIELD_CONFIG);
    expect(b.damageCooldown).toBe(0);
  });

  it('decrements in update', () => {
    const b = new Bullet(FROST_SHIELD_CONFIG);
    b.damageCooldown = 500;
    // Frost is attached, needs origin entity to update
    const origin = new Entity();
    origin.alive = true;
    origin.position = { x: 0, y: 0, z: 0 };
    origin.angle = 0;
    b.originEntity = origin;
    b.config = { ...FROST_SHIELD_CONFIG, attached: true };
    b.update(100);
    expect(b.damageCooldown).toBe(400);
  });

  it('does not go below 0', () => {
    const b = new Bullet(FROST_SHIELD_CONFIG);
    b.damageCooldown = 50;
    const origin = new Entity();
    origin.alive = true;
    origin.position = { x: 0, y: 0, z: 0 };
    origin.angle = 0;
    b.originEntity = origin;
    b.update(100);
    expect(b.damageCooldown).toBe(0);
  });

  it('resets on Bullet.reset()', () => {
    const b = new Bullet(FROST_SHIELD_CONFIG);
    b.damageCooldown = 500;
    b.reset(FROST_SHIELD_CONFIG, null);
    expect(b.damageCooldown).toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/game/Bullet.test.ts`
Expected: FAIL — ICE_BULLET_CONFIG and FROST_SHIELD_CONFIG not defined, damageCooldown not defined

**Step 3: Implement BulletConfig extensions and new configs**

In `src/game/Bullet.ts`, add to BulletConfig interface (after `attached?`):
```typescript
  persistent?: boolean;       // bullet survives hits (not destroyed in CollisionHandler)
  hitRateLimit?: number;      // minimum ms between damage applications
```

Add after SUN_BULLET_CONFIG:
```typescript
export const ICE_BULLET_CONFIG: BulletConfig = {
  speedMaxScaler: 1.5,
  maxTtl: 700,
  damage: 0.03,
  collisionRadius: 1,
  sound: SoundEffect.IceShot,
};

export const FROST_SHIELD_CONFIG: BulletConfig = {
  speedMaxScaler: 0,
  maxTtl: 500000,
  damage: 0.3,
  collisionRadius: 11,
  attached: true,
  persistent: true,
  hitRateLimit: 500,
  sound: SoundEffect.FrostShot,
};
```

Add `damageCooldown` to Bullet class:
```typescript
  damageCooldown: number = 0;
```

In `Bullet.reset()`, add:
```typescript
  this.damageCooldown = 0;
```

In `Bullet.update()`, add damageCooldown decrement at the start of the method (before the attached check):
```typescript
  if (this.damageCooldown > 0) {
    this.damageCooldown = Math.max(0, this.damageCooldown - dt);
  }
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/game/Bullet.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/Bullet.ts src/game/Bullet.test.ts
git commit -m "feat: add ICE_BULLET_CONFIG, FROST_SHIELD_CONFIG, and persistent bullet fields"
```

---

### Task 3: SholevPlayer Class

**Files:**
- Create: `src/game/SholevPlayer.ts`
- Create: `src/game/SholevPlayer.test.ts`

**Step 1: Write failing tests**

Create `src/game/SholevPlayer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { SholevPlayer, SHOLEV_STATS, SHOLEV_BASE_SPEED, SHOLEV_BASE_ROTATION, SHOLEV_BOOST_SPEED, SHOLEV_BOOST_ROTATION, SHOLEV_MIN_ENERGY_SHIELD } from './SholevPlayer';
import { ICE_BULLET_CONFIG, FROST_SHIELD_CONFIG, Bullet } from './Bullet';
import { Player, GONDI_STATS } from './Player';

describe('SholevPlayer', () => {
  describe('SHOLEV_STATS', () => {
    it('has correct stats from C++', () => {
      expect(SHOLEV_STATS.speedMaxScaler).toBe(0.8);
      expect(SHOLEV_STATS.acceleration).toBe(0.004);
      expect(SHOLEV_STATS.rotationSpeed).toBe(0.5);
      expect(SHOLEV_STATS.primaryEnergyCost).toBe(0.07);
      expect(SHOLEV_STATS.primaryWeaponDelay).toBe(100);
      expect(SHOLEV_STATS.primaryWeaponFillRate).toBe(0.0002);
      expect(SHOLEV_STATS.primaryBulletConfig).toBe(ICE_BULLET_CONFIG);
    });
  });

  describe('initial state', () => {
    it('uses SHOLEV_STATS', () => {
      const p = new SholevPlayer();
      expect(p.stats).toBe(SHOLEV_STATS);
    });

    it('has single collision sphere at (0,0,0) r10', () => {
      const p = new SholevPlayer();
      expect(p.collisionSpheres).toHaveLength(1);
      expect(p.collisionSpheres[0]).toEqual({ offset: { x: 0, y: 0, z: 0 }, radius: 10 });
    });

    it('starts with frost shield inactive', () => {
      const p = new SholevPlayer();
      expect(p.frostShieldActive).toBe(false);
      expect(p.activeFrostBullet).toBeNull();
    });
  });

  describe('frost shield activation', () => {
    it('activateFrostShield returns a bullet with FROST_SHIELD_CONFIG', () => {
      const p = new SholevPlayer();
      p.energy = 1.0;
      const bullet = p.activateFrostShield();
      expect(bullet).not.toBeNull();
      expect(bullet!.config).toBe(FROST_SHIELD_CONFIG);
      expect(p.frostShieldActive).toBe(true);
      expect(p.activeFrostBullet).toBe(bullet);
    });

    it('boosts speed and rotation on activation', () => {
      const p = new SholevPlayer();
      p.energy = 1.0;
      p.activateFrostShield();
      expect(p.stats.speedMaxScaler).toBe(SHOLEV_BOOST_SPEED);
      expect(p.stats.rotationSpeed).toBe(SHOLEV_BOOST_ROTATION);
    });

    it('refuses activation when energy < 0.25', () => {
      const p = new SholevPlayer();
      p.energy = 0.24;
      const bullet = p.activateFrostShield();
      expect(bullet).toBeNull();
      expect(p.frostShieldActive).toBe(false);
    });

    it('refuses activation when frost already active', () => {
      const p = new SholevPlayer();
      p.energy = 1.0;
      p.activateFrostShield();
      const second = p.activateFrostShield();
      expect(second).toBeNull();
    });
  });

  describe('frost shield update', () => {
    it('drains energy at 0.0003 per ms', () => {
      const p = new SholevPlayer();
      p.energy = 1.0;
      const bullet = p.activateFrostShield()!;
      p.updateFrostShield(1000); // 1 second
      expect(p.energy).toBeCloseTo(1.0 - 0.0003 * 1000);
    });

    it('deactivates when energy reaches 0', () => {
      const p = new SholevPlayer();
      p.energy = 0.3;
      const bullet = p.activateFrostShield()!;
      p.updateFrostShield(1100); // drains 0.33 > 0.3
      expect(p.energy).toBe(0);
      expect(bullet.alive).toBe(false);
      expect(p.frostShieldActive).toBe(false);
      expect(p.activeFrostBullet).toBeNull();
    });

    it('reverts stats when deactivated by energy drain', () => {
      const p = new SholevPlayer();
      p.energy = 0.26;
      p.activateFrostShield();
      p.updateFrostShield(1000); // drain > remaining energy
      expect(p.stats.speedMaxScaler).toBe(SHOLEV_BASE_SPEED);
      expect(p.stats.rotationSpeed).toBe(SHOLEV_BASE_ROTATION);
    });

    it('deactivates when frost bullet is killed externally', () => {
      const p = new SholevPlayer();
      p.energy = 1.0;
      const bullet = p.activateFrostShield()!;
      bullet.destroy(); // killed by game logic
      p.updateFrostShield(16);
      expect(p.frostShieldActive).toBe(false);
      expect(p.activeFrostBullet).toBeNull();
      expect(p.stats.speedMaxScaler).toBe(SHOLEV_BASE_SPEED);
    });

    it('does nothing when frost not active', () => {
      const p = new SholevPlayer();
      p.energy = 1.0;
      p.updateFrostShield(1000);
      expect(p.energy).toBe(1.0); // no drain
    });
  });

  describe('fireSecondary override', () => {
    it('returns null (frost activation handled separately)', () => {
      const p = new SholevPlayer();
      const enemy = new Player(GONDI_STATS);
      expect(p.fireSecondary(enemy)).toBeNull();
    });
  });

  describe('resetForNewRound', () => {
    it('deactivates frost shield', () => {
      const p = new SholevPlayer();
      p.energy = 1.0;
      p.activateFrostShield();
      p.resetForNewRound({ x: 0, y: 0, z: 0 });
      expect(p.frostShieldActive).toBe(false);
      expect(p.activeFrostBullet).toBeNull();
      expect(p.stats.speedMaxScaler).toBe(SHOLEV_BASE_SPEED);
      expect(p.stats.rotationSpeed).toBe(SHOLEV_BASE_ROTATION);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/game/SholevPlayer.test.ts`
Expected: FAIL — module not found

**Step 3: Implement SholevPlayer**

Create `src/game/SholevPlayer.ts`:

```typescript
import { Player, CharacterStats } from './Player';
import { Bullet, ICE_BULLET_CONFIG, FROST_SHIELD_CONFIG } from './Bullet';
import { Snot } from './Snot';
import { Vec3 } from '@/engine/Entity';

export const SHOLEV_BASE_SPEED = 0.8;
export const SHOLEV_BASE_ROTATION = 0.5;
export const SHOLEV_BOOST_SPEED = 1.6;
export const SHOLEV_BOOST_ROTATION = 1.0;
export const SHOLEV_MIN_ENERGY_SHIELD = 0.25;
const FROST_ENERGY_DRAIN = 0.0003; // per ms, from C++

export const SHOLEV_STATS: CharacterStats = {
  speedMaxScaler: SHOLEV_BASE_SPEED,
  acceleration: 0.004,
  rotationSpeed: SHOLEV_BASE_ROTATION,
  primaryEnergyCost: 0.07,
  primaryWeaponDelay: 100,
  primaryWeaponFillRate: 0.0002,
  primaryBulletConfig: ICE_BULLET_CONFIG,
};

export class SholevPlayer extends Player {
  frostShieldActive: boolean = false;
  activeFrostBullet: Bullet | null = null;

  constructor() {
    // Create a mutable copy of stats so we can swap speed/rotation
    super({ ...SHOLEV_STATS });
    this.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 10 }];
  }

  activateFrostShield(): Bullet | null {
    if (this.frostShieldActive) return null;
    if (this.energy < SHOLEV_MIN_ENERGY_SHIELD) return null;

    const bullet = new Bullet(FROST_SHIELD_CONFIG, this);
    bullet.position = { ...this.position };
    bullet.previousPosition = { ...this.position };

    this.frostShieldActive = true;
    this.activeFrostBullet = bullet;
    this.stats.speedMaxScaler = SHOLEV_BOOST_SPEED;
    this.stats.rotationSpeed = SHOLEV_BOOST_ROTATION;

    return bullet;
  }

  updateFrostShield(dt: number): void {
    if (!this.frostShieldActive || !this.activeFrostBullet) return;

    // Check if bullet was killed externally
    if (!this.activeFrostBullet.alive) {
      this.deactivateFrostShield();
      return;
    }

    // Drain energy
    this.energy -= FROST_ENERGY_DRAIN * dt;
    if (this.energy <= 0) {
      this.energy = 0;
      this.activeFrostBullet.destroy();
      this.deactivateFrostShield();
    }
  }

  private deactivateFrostShield(): void {
    this.frostShieldActive = false;
    this.activeFrostBullet = null;
    this.stats.speedMaxScaler = SHOLEV_BASE_SPEED;
    this.stats.rotationSpeed = SHOLEV_BASE_ROTATION;
  }

  override fireSecondary(_enemy: Player): Snot | null {
    return null;
  }

  override resetForNewRound(spawnPosition: Vec3): void {
    if (this.activeFrostBullet) {
      this.activeFrostBullet.destroy();
    }
    this.deactivateFrostShield();
    super.resetForNewRound(spawnPosition);
    // Ensure stats are reset after super call
    this.stats.speedMaxScaler = SHOLEV_BASE_SPEED;
    this.stats.rotationSpeed = SHOLEV_BASE_ROTATION;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/game/SholevPlayer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/SholevPlayer.ts src/game/SholevPlayer.test.ts
git commit -m "feat: add SholevPlayer with frost shield activation and energy drain"
```

---

### Task 4: CollisionHandler — Persistent Bullet Support

**Files:**
- Modify: `src/game/CollisionHandler.ts:31-53` (handleBulletHit)
- Test: `src/game/CollisionHandler.test.ts`

**Step 1: Write failing tests for persistent bullet collision**

Add to `src/game/CollisionHandler.test.ts`:

```typescript
import { FROST_SHIELD_CONFIG } from './Bullet';

describe('persistent bullet (frost shield)', () => {
  it('applies damage but does not destroy the bullet', () => {
    const handler = new CollisionHandler();
    const bullet = new Bullet(FROST_SHIELD_CONFIG);
    bullet.originEntity = new Entity();
    const target = new Player(GONDI_STATS);
    target.health = 1.0;

    handler.onGameEvent(new BulletHitEvent(bullet, target));

    expect(target.health).toBeCloseTo(0.7); // 1.0 - 0.3
    expect(bullet.alive).toBe(true); // NOT destroyed
  });

  it('sets damageCooldown from hitRateLimit after hit', () => {
    const handler = new CollisionHandler();
    const bullet = new Bullet(FROST_SHIELD_CONFIG);
    bullet.originEntity = new Entity();
    const target = new Player(GONDI_STATS);

    handler.onGameEvent(new BulletHitEvent(bullet, target));

    expect(bullet.damageCooldown).toBe(500);
  });

  it('skips damage when damageCooldown > 0', () => {
    const handler = new CollisionHandler();
    const bullet = new Bullet(FROST_SHIELD_CONFIG);
    bullet.originEntity = new Entity();
    bullet.damageCooldown = 100;
    const target = new Player(GONDI_STATS);
    target.health = 1.0;

    handler.onGameEvent(new BulletHitEvent(bullet, target));

    expect(target.health).toBe(1.0); // no damage applied
    expect(bullet.alive).toBe(true);
  });

  it('still destroys non-persistent bullets normally', () => {
    const handler = new CollisionHandler();
    const bullet = new Bullet(FLAME_BULLET_CONFIG);
    bullet.originEntity = new Entity();
    const target = new Player(GONDI_STATS);

    handler.onGameEvent(new BulletHitEvent(bullet, target));

    expect(bullet.alive).toBe(false); // destroyed as usual
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/game/CollisionHandler.test.ts`
Expected: FAIL — persistent bullets still destroyed

**Step 3: Implement persistent bullet handling in CollisionHandler**

Modify `handleBulletHit` in `src/game/CollisionHandler.ts`:

```typescript
private handleBulletHit(event: BulletHitEvent): void {
  const bullet = event.bullet as Bullet;
  const target = event.target;

  // Persistent bullets (frost shield) survive hits with rate limiting
  if (bullet.config.persistent) {
    if (bullet.damageCooldown > 0) return; // rate limited

    if (target.entityType === EntityType.Sun) {
      // no damage to sun, no destroy
    } else if (target.entityType === EntityType.Asteroid) {
      target.destroy();
      GameEventMgr.getInstance().sendEvent(new ExplosionEvent(target));
    } else {
      target.health -= bullet.getCurrentDamage();
      if (target.health <= 0) {
        target.destroy();
        if (target.entityType === EntityType.Player) {
          GameEventMgr.getInstance().sendEvent(new ExplosionEvent(target));
        }
      }
    }
    bullet.damageCooldown = bullet.config.hitRateLimit ?? 0;
    return;
  }

  // Standard bullets — apply damage and destroy
  if (target.entityType === EntityType.Sun) {
    // no damage
  } else if (target.entityType === EntityType.Asteroid) {
    target.destroy();
    GameEventMgr.getInstance().sendEvent(new ExplosionEvent(target));
  } else {
    target.health -= bullet.getCurrentDamage();
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

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/game/CollisionHandler.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/CollisionHandler.ts src/game/CollisionHandler.test.ts
git commit -m "feat: add persistent bullet support with hit rate limiting"
```

---

### Task 5: CharacterRegistry — Add Sholev

**Files:**
- Modify: `src/game/CharacterRegistry.ts`
- Modify: `src/game/CharacterRegistry.test.ts`

**Step 1: Write failing tests**

Add to `src/game/CharacterRegistry.test.ts`:

```typescript
it('contains Sholev', () => {
  const ids = CHARACTER_REGISTRY.map(c => c.id);
  expect(ids).toContain('sholev');
});

it('Sholev has correct weapon/special', () => {
  const sholev = CHARACTER_REGISTRY.find(c => c.id === 'sholev')!;
  expect(sholev.weapon).toBe('Ice Cones');
  expect(sholev.special).toBe('Ramming Energy');
});
```

Update the count test from `toHaveLength(2)` to `toHaveLength(3)`.

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/game/CharacterRegistry.test.ts`
Expected: FAIL

**Step 3: Add Sholev to CHARACTER_REGISTRY**

In `src/game/CharacterRegistry.ts`, add after gondi entry:

```typescript
{
  id: 'sholev',
  name: 'Sholev',
  weapon: 'Ice Cones',
  special: 'Ramming Energy',
  modelPath: '/models/sholev.glb',
  modelScale: 2.0,
  modelRotation: [-90, 0, 0],
  isMichiGichi: false,
},
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/game/CharacterRegistry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/CharacterRegistry.ts src/game/CharacterRegistry.test.ts
git commit -m "feat: add Sholev to character registry"
```

---

### Task 6: main.ts — Player Creation and Sholev Stats Wiring

Currently `startMelee` uses `GONDI_STATS` for all non-MichiGichi players. We need to select the right stats/player-type based on `charDef.id`.

**Files:**
- Modify: `src/main.ts:5-8` (imports)
- Modify: `src/main.ts:586-602` (startMelee player creation)

**Step 1: Add imports**

Add to main.ts imports:

```typescript
import { SholevPlayer } from '@/game/SholevPlayer';
import { ICE_BULLET_CONFIG, FROST_SHIELD_CONFIG } from '@/game/Bullet';
// (ICE/FROST configs likely already imported via Bullet import — merge as needed)
```

**Step 2: Update player creation in startMelee**

Replace the player creation blocks in `startMelee` (lines ~588-602):

```typescript
function createPlayerForDef(charDef: CharacterDef): Player {
  if (charDef.isMichiGichi) return new MichiGichiPlayer();
  if (charDef.id === 'sholev') return new SholevPlayer();
  return new Player(GONDI_STATS);
}
```

Then in startMelee:
```typescript
player1 = createPlayerForDef(p1Def);
player1.position = { ...ARENA.PLAYER1_SPAWN };
player1.previousPosition = { ...ARENA.PLAYER1_SPAWN };

player2 = createPlayerForDef(p2Def);
player2.position = { ...ARENA.PLAYER2_SPAWN };
player2.previousPosition = { ...ARENA.PLAYER2_SPAWN };
```

**Step 3: Verify**

Run: `npx tsc --noEmit` — should compile
Run dev server and select Sholev — player should spawn (model loads separately, gameplay works with ice shard config)

**Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire SholevPlayer creation in startMelee"
```

---

### Task 7: main.ts — Ice Shard Texture Loading and Bullet Rendering

**Files:**
- Modify: `src/main.ts:145-172` (texture loading section)
- Modify: `src/main.ts:183-228` (acquireBullet)
- Modify: `src/main.ts:1089-1129` (bullet sprite sync)

**Step 1: Load ice shard atlas texture**

Add after the plasma atlas loader (around line 171):

```typescript
const ICE_ATLAS_COLS = 9;
const ICE_ATLAS_ROWS = 8;
const ICE_TOTAL_FRAMES = 65;
const iceAtlasTexture = new THREE.TextureLoader().load('/textures/ice_shot_atlas.png');
iceAtlasTexture.colorSpace = THREE.SRGBColorSpace;
```

**Step 2: Handle ice shard in acquireBullet**

In `acquireBullet`, add an `else if` branch for ICE_BULLET_CONFIG after the SUN_BULLET_CONFIG branch:

```typescript
} else if (config === ICE_BULLET_CONFIG) {
  const tex = iceAtlasTexture.clone();
  tex.repeat.set(1 / ICE_ATLAS_COLS, 1 / ICE_ATLAS_ROWS);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  mat.map = tex;
  sprite.scale.set(15, 15, 1);
  bullet.animFrame = 0;
  bullet.animSpeed = 0.2;
}
```

Also handle FROST_SHIELD_CONFIG (the frost shield bullet also goes through acquireBullet when created from main.ts):

```typescript
} else if (config === FROST_SHIELD_CONFIG) {
  mat.map = frostShieldTexture;
  sprite.scale.set(50, 50, 1);
}
```

Load the frost shield texture alongside the other textures:

```typescript
const frostShieldTexture = new THREE.TextureLoader().load('/textures/frost_shield.png');
```

**Step 3: Handle ice shard sprite sync in game loop**

In the bullet sprite sync section (around line 1089), add a branch for ice shard animation:

```typescript
} else if (bullet.config === ICE_BULLET_CONFIG) {
  // Advance frame-based animation (matching C++ m_curTex += m_AnimSpeed * dt)
  bullet.animFrame += bullet.animSpeed * dt;
  if (bullet.animFrame > ICE_TOTAL_FRAMES - 1) {
    bullet.animFrame = 0; // loop
  }

  // UV offset into 9x8 atlas
  const mat = sprite.material as THREE.SpriteMaterial;
  if (mat.map) {
    const fi = Math.floor(bullet.animFrame) % ICE_TOTAL_FRAMES;
    const col = fi % ICE_ATLAS_COLS;
    const row = Math.floor(fi / ICE_ATLAS_COLS);
    mat.map.offset.set(col / ICE_ATLAS_COLS, 1 - (row + 1) / ICE_ATLAS_ROWS);
  }

  // Rotate sprite to match bullet heading
  const mat2 = sprite.material as THREE.SpriteMaterial;
  mat2.rotation = bullet.angle * (Math.PI / 180);
} else if (bullet.config === FROST_SHIELD_CONFIG) {
  // Frost shield: slowly rotate the sprite
  const mat = sprite.material as THREE.SpriteMaterial;
  const elapsed = bullet.config.maxTtl - bullet.ttl;
  mat.rotation = elapsed * 0.003;
}
```

**Step 4: Verify**

Run dev server, select Sholev, fire primary weapon — animated ice shards should fly forward.
Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/main.ts
git commit -m "feat: add ice shard atlas rendering and frost shield sprite"
```

---

### Task 8: main.ts — Frost Shield Secondary Weapon Handling

**Files:**
- Modify: `src/main.ts:829-857` (fireSecondary section in handlePlayerFrame)

**Step 1: Add frost shield toggle to secondary weapon handling**

In the `pi.fireSecondary` block, add a branch for SholevPlayer before the generic snot branch:

```typescript
if (pi.fireSecondary) {
  if (player instanceof MichiGichiPlayer) {
    if (player.morphState === MorphState.MICHI || player.morphState === MorphState.GICHI) {
      const morphSound = player.morphState === MorphState.MICHI
        ? SoundEffect.MorphOpen : SoundEffect.MorphClose;
      SoundManager.getInstance().play(morphSound);
    }
    player.triggerMorph();
  } else if (player instanceof SholevPlayer) {
    if (!player.frostShieldActive) {
      const bullet = player.activateFrostShield();
      if (bullet) {
        // Register bullet in pool for collision detection
        const poolBullet = acquireBullet(FROST_SHIELD_CONFIG, player);
        // Copy state from the SholevPlayer's bullet to the pooled one
        // Actually — use the pool bullet directly. Update SholevPlayer's reference.
        player.activeFrostBullet?.destroy(); // discard the one from activateFrostShield
        player.activeFrostBullet = poolBullet;
        poolBullet.position = { ...player.position };
        poolBullet.previousPosition = { ...player.position };
        poolBullet.localOffsetDistance = 0;
        poolBullet.attachedSpeed = 0;
        SoundManager.getInstance().play(SoundEffect.FrostShot);
      }
    }
  } else {
    // Generic snot handling (existing code)
    ...
  }
}
```

**IMPORTANT NOTE:** The frost shield bullet must participate in the bullet pool and collision system. Since `activateFrostShield()` creates a standalone Bullet, but the collision detection iterates `bulletPool.activeEntities`, we must use `acquireBullet` to get a pooled bullet. The approach:

1. SholevPlayer.activateFrostShield() handles stat boost and returns whether activation succeeded
2. main.ts acquires a pooled bullet via acquireBullet and assigns it to the SholevPlayer

Refactor `activateFrostShield()` to not create a bullet internally:

In SholevPlayer, change the method to:
```typescript
/** Returns true if frost shield can be activated. Caller must create the bullet. */
activateFrostShield(): boolean {
  if (this.frostShieldActive) return false;
  if (this.energy < SHOLEV_MIN_ENERGY_SHIELD) return false;
  this.frostShieldActive = true;
  this.stats.speedMaxScaler = SHOLEV_BOOST_SPEED;
  this.stats.rotationSpeed = SHOLEV_BOOST_ROTATION;
  return true;
}

/** Set the frost shield bullet reference (called from main.ts after acquireBullet) */
setFrostBullet(bullet: Bullet): void {
  this.activeFrostBullet = bullet;
}
```

Then in main.ts:
```typescript
} else if (player instanceof SholevPlayer) {
  if (!player.frostShieldActive && player.activateFrostShield()) {
    const bullet = acquireBullet(FROST_SHIELD_CONFIG, player);
    bullet.position = { ...player.position };
    bullet.previousPosition = { ...player.position };
    bullet.localOffsetDistance = 0;
    bullet.attachedSpeed = 0;
    player.setFrostBullet(bullet);
    SoundManager.getInstance().play(SoundEffect.FrostShot);
  }
}
```

**Step 2: Add frost shield update to game loop**

In the game loop (where morph is updated), add frost shield update for Sholev players:

```typescript
if (player1 instanceof SholevPlayer) {
  player1.updateFrostShield(dt);
}
if (player2 instanceof SholevPlayer) {
  player2.updateFrostShield(dt);
}
```

**Step 3: Disable thrust particles when frost is active**

In the thrust particle update, skip when frost is active:

```typescript
// Existing:
thrustEffect.update(dt, pi.thrust, player.position.x, player.position.y, player.angle);

// Change to:
const showThrust = pi.thrust && !(player instanceof SholevPlayer && player.frostShieldActive);
thrustEffect.update(dt, showThrust, player.position.x, player.position.y, player.angle);
```

**Step 4: Update SholevPlayer tests for refactored API**

Update the tests in Task 3 to match the refactored `activateFrostShield()` → returns boolean, `setFrostBullet()` sets the bullet reference.

**Step 5: Verify**

Run dev server, select Sholev, press secondary weapon key — frost shield should activate, drain energy, boost speed. When energy runs out, shield deactivates and stats revert.
Run: `npx tsc --noEmit`
Run: `npx vitest run`

**Step 6: Commit**

```bash
git add src/main.ts src/game/SholevPlayer.ts src/game/SholevPlayer.test.ts
git commit -m "feat: wire frost shield secondary weapon with energy drain and stat boost"
```

---

### Task 9: Run Full Test Suite and Type Check

**Step 1: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass (existing + new).

**Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Fix any failures**

If tests fail, fix and re-run until green.

---

### Task 10: Visual Verification with Playwright

**Step 1: Start dev server and open browser**

Navigate to the game, go through selection to Sholev.

**Step 2: Verify:**
- Sholev model renders correctly on selection screen and in melee
- Ice shard primary weapon fires animated projectiles
- Frost shield activates on secondary weapon press (visual sprite + stat boost)
- Energy drains while frost shield is active (watch HUD energy bar)
- Frost shield deactivates when energy runs out
- Speed/rotation boost feels noticeable during frost shield
- Frost shield damages enemy on contact
- Thrust particles hidden during frost shield

**Step 3: Final commit if any visual fixes needed**

---

### Task 11: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

Add Sholev to the documented characters and update relevant sections:
- Add SholevPlayer to key architecture patterns
- Add ice shard + frost shield to weapon descriptions
- Note the persistent bullet pattern and hitRateLimit

**Step 1: Update CLAUDE.md**

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Sholev character documentation to CLAUDE.md"
```
