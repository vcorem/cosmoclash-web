# M5: Sun & Gravity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a sun at the arena center with gravity pull on players, collision damage, and animated sprite texture.

**Architecture:** Sun extends Entity with `EntityType.Sun`, fixed at (0,0,0). Gravity is a standalone function applied per-frame to players only. Sun collision emits a new `SunCollisionEvent` handled by `CollisionHandler`. The sun mesh is a Three.js sphere with a sprite-sheet atlas texture animated via UV offsets.

**Tech Stack:** TypeScript, Three.js, Vitest, Vite

---

### Task 1: Add Sun/Gravity Constants to Arena

**Files:**
- Modify: `src/game/Arena.ts`

**Step 1: Add constants**

Add to the `ARENA` object in `src/game/Arena.ts`, after the `PLAYER2_SPAWN` line:

```typescript
  // Sun
  SUN_POSITION: { x: 0, y: 0, z: 0 },
  SUN_COLLISION_RADIUS: 65,
  SUN_DAMAGE: 0.02,

  // Gravity
  GRAVITY_RANGE: 450,
  GRAVITY_CONSTANT: 0.5,
  GRAVITY_MAX_FORCE: 0.001,
```

**Step 2: Commit**

```bash
git add src/game/Arena.ts
git commit -m "feat(m5): add sun and gravity constants to Arena"
```

---

### Task 2: Add EntityType.Sun

**Files:**
- Modify: `src/engine/Entity.ts`

**Step 1: Add Sun to EntityType enum**

In `src/engine/Entity.ts`, change:

```typescript
export enum EntityType {
  Player,
  Bullet,
  Dummy,
}
```

to:

```typescript
export enum EntityType {
  Player,
  Bullet,
  Sun,
  Dummy,
}
```

**Step 2: Run existing tests to confirm nothing broke**

Run: `npm test`
Expected: All existing tests PASS

**Step 3: Commit**

```bash
git add src/engine/Entity.ts
git commit -m "feat(m5): add EntityType.Sun to entity type enum"
```

---

### Task 3: Create Sun Entity Class (TDD)

**Files:**
- Create: `src/game/Sun.ts`
- Create: `src/game/Sun.test.ts`

**Step 1: Write the failing tests**

Create `src/game/Sun.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Sun } from './Sun';
import { EntityType } from '@/engine/Entity';
import { ARENA } from './Arena';

describe('Sun', () => {
  it('has EntityType.Sun', () => {
    const sun = new Sun();
    expect(sun.entityType).toBe(EntityType.Sun);
  });

  it('is positioned at arena sun position', () => {
    const sun = new Sun();
    expect(sun.position).toEqual(ARENA.SUN_POSITION);
  });

  it('has autoWrap disabled', () => {
    const sun = new Sun();
    expect(sun.autoWrap).toBe(false);
  });

  it('has collision sphere with correct radius', () => {
    const sun = new Sun();
    expect(sun.collisionSpheres).toHaveLength(1);
    expect(sun.collisionSpheres[0].radius).toBe(ARENA.SUN_COLLISION_RADIUS);
    expect(sun.collisionSpheres[0].offset).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('update is a no-op (position never changes)', () => {
    const sun = new Sun();
    const posBefore = { ...sun.position };
    sun.accelVec = { x: 10, y: 10, z: 10 };
    sun.update(100);
    expect(sun.position).toEqual(posBefore);
  });

  it('tracks animation frame state', () => {
    const sun = new Sun();
    expect(sun.currentFrame).toBe(0);
    expect(sun.animSpeed).toBe(0.025);
  });

  it('advances animation frame on updateAnimation', () => {
    const sun = new Sun();
    sun.updateAnimation(100);
    expect(sun.currentFrame).toBeGreaterThan(0);
  });

  it('wraps animation frame back to 0 after reaching 60', () => {
    const sun = new Sun();
    sun.currentFrame = 59.99;
    sun.updateAnimation(100); // Should push past 60 and wrap
    expect(sun.currentFrame).toBeLessThan(60);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/game/Sun.test.ts`
Expected: FAIL — `Sun` module not found

**Step 3: Write the Sun class**

Create `src/game/Sun.ts`:

```typescript
import { Entity, EntityType } from '@/engine/Entity';
import { ARENA } from './Arena';

const NUM_SUN_FRAMES = 60;

export class Sun extends Entity {
  currentFrame: number = 0;
  readonly animSpeed: number = 0.025;

  constructor() {
    super();
    this.entityType = EntityType.Sun;
    this.autoWrap = false;
    this.position = { ...ARENA.SUN_POSITION };
    this.previousPosition = { ...ARENA.SUN_POSITION };
    this.collisionSpheres = [
      { offset: { x: 0, y: 0, z: 0 }, radius: ARENA.SUN_COLLISION_RADIUS },
    ];
  }

  override update(_dt: number): void {
    // Sun is fixed — no movement
  }

  updateAnimation(dt: number): void {
    this.currentFrame += this.animSpeed * dt;
    if (this.currentFrame >= NUM_SUN_FRAMES) {
      this.currentFrame -= NUM_SUN_FRAMES;
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/game/Sun.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/game/Sun.ts src/game/Sun.test.ts
git commit -m "feat(m5): add Sun entity class with animation state"
```

---

### Task 4: Add SunCollisionEvent (TDD)

**Files:**
- Modify: `src/engine/GameEvent.ts`

**Step 1: Add SunCollision event type and class**

In `src/engine/GameEvent.ts`, add `SunCollision` to the `GameEventType` enum:

```typescript
export enum GameEventType {
  Collision,
  Explosion,
  BulletHit,
  SunCollision,
  FrameRender,
}
```

Add the event class after `ExplosionEvent`:

```typescript
export class SunCollisionEvent extends GameEvent {
  readonly sun: Entity;
  readonly other: Entity;

  constructor(sun: Entity, other: Entity) {
    super(GameEventType.SunCollision);
    this.sun = sun;
    this.other = other;
  }
}
```

**Step 2: Run all tests to confirm nothing broke**

Run: `npm test`
Expected: All existing tests PASS

**Step 3: Commit**

```bash
git add src/engine/GameEvent.ts
git commit -m "feat(m5): add SunCollisionEvent type"
```

---

### Task 5: Update CollisionDetector for Sun (TDD)

**Files:**
- Modify: `src/engine/CollisionDetector.ts`
- Modify: `src/engine/CollisionDetector.test.ts`

**Step 1: Write the failing tests**

Add these tests at the end of the `CollisionDetector` describe block in `src/engine/CollisionDetector.test.ts`:

```typescript
  it('fires SunCollisionEvent when player collides with sun', () => {
    const sun = new Entity();
    sun.entityType = EntityType.Sun;
    sun.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 65 }];
    sun.position = { x: 0, y: 0, z: 0 };
    sun.previousPosition = { x: 0, y: 0, z: 0 };

    const player = new Entity();
    player.entityType = EntityType.Player;
    player.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];
    player.position = { x: 50, y: 0, z: 0 };
    player.previousPosition = { x: 50, y: 0, z: 0 };

    const events: GameEvent[] = [];
    GameEventMgr.getInstance().addListener(
      { onGameEvent: (e) => events.push(e) },
      GameEventType.SunCollision,
    );

    detector.checkCollisions([sun, player]);

    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(SunCollisionEvent);
    const evt = events[0] as SunCollisionEvent;
    expect(evt.sun).toBe(sun);
    expect(evt.other).toBe(player);
  });

  it('fires BulletHitEvent (not SunCollision) when bullet hits sun', () => {
    const sun = new Entity();
    sun.entityType = EntityType.Sun;
    sun.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 65 }];
    sun.position = { x: 0, y: 0, z: 0 };
    sun.previousPosition = { x: 0, y: 0, z: 0 };

    const shooter = new Entity();
    shooter.entityType = EntityType.Player;

    const bullet = new Bullet(FLAME_BULLET_CONFIG, shooter);
    bullet.position = { x: 50, y: 0, z: 0 };
    bullet.previousPosition = { x: 60, y: 0, z: 0 };

    const sunEvents: GameEvent[] = [];
    const bulletEvents: GameEvent[] = [];
    GameEventMgr.getInstance().addListener(
      { onGameEvent: (e) => sunEvents.push(e) },
      GameEventType.SunCollision,
    );
    GameEventMgr.getInstance().addListener(
      { onGameEvent: (e) => bulletEvents.push(e) },
      GameEventType.BulletHit,
    );

    detector.checkCollisions([sun, bullet]);

    expect(sunEvents).toHaveLength(0);
    expect(bulletEvents).toHaveLength(1);
    const hit = bulletEvents[0] as BulletHitEvent;
    expect(hit.bullet).toBe(bullet);
    expect(hit.target).toBe(sun);
  });
```

Also add these imports at the top of the test file:

```typescript
import { GameEventType, GameEvent, CollisionEvent, BulletHitEvent, SunCollisionEvent } from './GameEvent';
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/CollisionDetector.test.ts`
Expected: FAIL — SunCollisionEvent not imported / wrong event type emitted

**Step 3: Update CollisionDetector.emitEvent()**

In `src/engine/CollisionDetector.ts`, add the import:

```typescript
import { CollisionEvent, BulletHitEvent, SunCollisionEvent } from './GameEvent';
```

Replace the `emitEvent` method:

```typescript
  private emitEvent(mgr: GameEventMgr, a: Entity, b: Entity, u0: number): void {
    const aIsBullet = a.entityType === EntityType.Bullet;
    const bIsBullet = b.entityType === EntityType.Bullet;
    const aIsSun = a.entityType === EntityType.Sun;
    const bIsSun = b.entityType === EntityType.Sun;

    if (aIsBullet) {
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

Note: Bullet checks come before Sun checks. This means bullet-sun collisions emit BulletHitEvent (bullet is destroyed, sun is the target). Sun checks only fire for non-bullet entities (players, asteroids, etc.).

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/CollisionDetector.test.ts`
Expected: All PASS

**Step 5: Run all tests**

Run: `npm test`
Expected: All PASS

**Step 6: Commit**

```bash
git add src/engine/CollisionDetector.ts src/engine/CollisionDetector.test.ts
git commit -m "feat(m5): emit SunCollisionEvent from collision detector"
```

---

### Task 6: Add Sun Collision Handling (TDD)

**Files:**
- Modify: `src/game/CollisionHandler.ts`
- Modify: `src/game/CollisionHandler.test.ts`

**Step 1: Write the failing tests**

Add these tests at the end of the `CollisionHandler` describe block in `src/game/CollisionHandler.test.ts`:

```typescript
  describe('sun collision', () => {
    it('applies SUN_DAMAGE to the non-sun entity', () => {
      const sun = new Entity();
      sun.entityType = EntityType.Sun;
      sun.position = { x: 0, y: 0, z: 0 };
      sun.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 65 }];

      const player = new Entity();
      player.health = 1;
      player.position = { x: 60, y: 0, z: 0 };
      player.accelVec = { x: -0.5, y: 0, z: 0 };
      player.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const evt = new SunCollisionEvent(sun, player);
      handler.onGameEvent(evt);

      expect(player.health).toBeCloseTo(1 - 0.02);
    });

    it('does not damage the sun', () => {
      const sun = new Entity();
      sun.entityType = EntityType.Sun;
      sun.health = 1;
      sun.position = { x: 0, y: 0, z: 0 };
      sun.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 65 }];

      const player = new Entity();
      player.position = { x: 60, y: 0, z: 0 };
      player.accelVec = { x: -0.5, y: 0, z: 0 };
      player.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const evt = new SunCollisionEvent(sun, player);
      handler.onGameEvent(evt);

      expect(sun.health).toBe(1);
    });

    it('bounces the player away from the sun', () => {
      const sun = new Entity();
      sun.entityType = EntityType.Sun;
      sun.position = { x: 0, y: 0, z: 0 };
      sun.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 65 }];

      const player = new Entity();
      player.position = { x: 60, y: 0, z: 0 };
      player.accelVec = { x: -0.5, y: 0, z: 0 }; // moving toward sun
      player.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const evt = new SunCollisionEvent(sun, player);
      handler.onGameEvent(evt);

      // Player velocity should now point away from sun (positive X)
      expect(player.accelVec.x).toBeGreaterThan(0);
    });

    it('does not move the sun', () => {
      const sun = new Entity();
      sun.entityType = EntityType.Sun;
      sun.position = { x: 0, y: 0, z: 0 };
      sun.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 65 }];

      const player = new Entity();
      player.position = { x: 60, y: 0, z: 0 };
      player.accelVec = { x: -0.5, y: 0, z: 0 };
      player.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const evt = new SunCollisionEvent(sun, player);
      handler.onGameEvent(evt);

      expect(sun.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(sun.accelVec).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('pushes the player outside the sun collision radius', () => {
      const sun = new Entity();
      sun.entityType = EntityType.Sun;
      sun.position = { x: 0, y: 0, z: 0 };
      sun.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 65 }];

      const player = new Entity();
      player.position = { x: 50, y: 0, z: 0 }; // inside sun radius
      player.accelVec = { x: -0.5, y: 0, z: 0 };
      player.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const evt = new SunCollisionEvent(sun, player);
      handler.onGameEvent(evt);

      const dist = Math.sqrt(player.position.x ** 2 + player.position.y ** 2);
      expect(dist).toBeGreaterThanOrEqual(65 + 14);
    });

    it('destroys the player if health reaches 0', () => {
      const sun = new Entity();
      sun.entityType = EntityType.Sun;
      sun.position = { x: 0, y: 0, z: 0 };
      sun.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 65 }];

      const player = new Entity();
      player.health = 0.01;
      player.position = { x: 60, y: 0, z: 0 };
      player.accelVec = { x: -0.5, y: 0, z: 0 };
      player.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];

      const evt = new SunCollisionEvent(sun, player);
      handler.onGameEvent(evt);

      expect(player.health).toBeLessThanOrEqual(0);
      expect(player.alive).toBe(false);
    });
  });
```

Add imports at the top of the test file:

```typescript
import { BulletHitEvent, CollisionEvent, SunCollisionEvent } from '@/engine/GameEvent';
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/game/CollisionHandler.test.ts`
Expected: FAIL — SunCollisionEvent not handled

**Step 3: Implement handleSunCollision**

In `src/game/CollisionHandler.ts`, add the import:

```typescript
import { GameEvent, GameEventType, BulletHitEvent, CollisionEvent, SunCollisionEvent } from '@/engine/GameEvent';
```

Add `ARENA` import:

```typescript
import { ARENA } from './Arena';
```

In the constructor area, register for the new event (this is done externally in `main.ts`, but the handler needs to route it). Update `onGameEvent`:

```typescript
  onGameEvent(event: GameEvent): void {
    if (event.type === GameEventType.BulletHit) {
      this.handleBulletHit(event as BulletHitEvent);
    } else if (event.type === GameEventType.Collision) {
      this.handleShipCollision(event as CollisionEvent);
    } else if (event.type === GameEventType.SunCollision) {
      this.handleSunCollision(event as SunCollisionEvent);
    }
  }
```

Add the new method:

```typescript
  private handleSunCollision(event: SunCollisionEvent): void {
    const sun = event.sun;
    const other = event.other;

    // Damage the non-sun entity
    other.health -= ARENA.SUN_DAMAGE;
    if (other.health <= 0) {
      other.destroy();
    }

    // Compute collision normal (sun → other)
    const radiusSun = sun.collisionSpheres[0]?.radius ?? 0;
    const radiusOther = other.collisionSpheres[0]?.radius ?? 0;

    let nx = other.position.x - sun.position.x;
    let ny = other.position.y - sun.position.y;
    let dist = Math.sqrt(nx * nx + ny * ny);

    if (dist < 0.001) {
      nx = 1; ny = 0; dist = 0;
    } else {
      nx /= dist;
      ny /= dist;
    }

    // Push other entity outside sun collision radius
    const targetDist = radiusSun + radiusOther + 8;
    if (dist < targetDist) {
      other.position.x = sun.position.x + nx * targetDist;
      other.position.y = sun.position.y + ny * targetDist;
    }

    other.previousPosition = { ...other.position };

    // Bounce: redirect velocity away from sun
    const speed = Math.sqrt(
      other.accelVec.x * other.accelVec.x +
      other.accelVec.y * other.accelVec.y +
      other.accelVec.z * other.accelVec.z,
    );
    const bounce = Math.max(speed, MIN_BOUNCE_SPEED);
    other.accelVec = { x: nx * bounce, y: ny * bounce, z: 0 };
  }
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/game/CollisionHandler.test.ts`
Expected: All PASS

**Step 5: Run all tests**

Run: `npm test`
Expected: All PASS

**Step 6: Commit**

```bash
git add src/game/CollisionHandler.ts src/game/CollisionHandler.test.ts
git commit -m "feat(m5): handle sun collision with bounce and damage"
```

---

### Task 7: Implement Gravity System (TDD)

**Files:**
- Create: `src/game/Gravity.ts`
- Create: `src/game/Gravity.test.ts`

**Step 1: Write the failing tests**

Create `src/game/Gravity.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { applySunGravity } from './Gravity';
import { Entity } from '@/engine/Entity';
import { ARENA } from './Arena';

describe('applySunGravity', () => {
  const sunPos = ARENA.SUN_POSITION;

  it('pulls entity toward the sun', () => {
    const e = new Entity();
    e.position = { x: 200, y: 0, z: 0 };
    e.accelVec = { x: 0, y: 0, z: 0 };

    applySunGravity(e, sunPos, 16);

    // Should have gained some negative-x velocity (toward sun at origin)
    expect(e.accelVec.x).toBeLessThan(0);
  });

  it('does nothing when entity is beyond GRAVITY_RANGE', () => {
    const e = new Entity();
    e.position = { x: 500, y: 0, z: 0 }; // > 450
    e.accelVec = { x: 0, y: 0, z: 0 };

    applySunGravity(e, sunPos, 16);

    expect(e.accelVec.x).toBe(0);
    expect(e.accelVec.y).toBe(0);
  });

  it('does nothing at exactly GRAVITY_RANGE + 1', () => {
    const e = new Entity();
    e.position = { x: 451, y: 0, z: 0 };
    e.accelVec = { x: 0, y: 0, z: 0 };

    applySunGravity(e, sunPos, 16);

    expect(e.accelVec.x).toBe(0);
  });

  it('applies gravity at edge of range', () => {
    const e = new Entity();
    e.position = { x: 449, y: 0, z: 0 }; // just inside range
    e.accelVec = { x: 0, y: 0, z: 0 };

    applySunGravity(e, sunPos, 16);

    expect(e.accelVec.x).toBeLessThan(0); // pulled toward sun
  });

  it('gravity force is stronger when closer', () => {
    const near = new Entity();
    near.position = { x: 100, y: 0, z: 0 };
    near.accelVec = { x: 0, y: 0, z: 0 };

    const far = new Entity();
    far.position = { x: 400, y: 0, z: 0 };
    far.accelVec = { x: 0, y: 0, z: 0 };

    applySunGravity(near, sunPos, 16);
    applySunGravity(far, sunPos, 16);

    // Near entity should have stronger pull (more negative x)
    expect(Math.abs(near.accelVec.x)).toBeGreaterThan(Math.abs(far.accelVec.x));
  });

  it('clamps force to GRAVITY_MAX_FORCE', () => {
    const e = new Entity();
    e.position = { x: 1, y: 0, z: 0 }; // extremely close — force would be huge
    e.accelVec = { x: 0, y: 0, z: 0 };

    applySunGravity(e, sunPos, 16);

    // Force should be clamped — velocity change bounded
    const maxChange = ARENA.GRAVITY_MAX_FORCE * 16 * ARENA.TIME_SCALER;
    expect(Math.abs(e.accelVec.x)).toBeLessThanOrEqual(maxChange + 0.0001);
  });

  it('pulls in correct direction for entity above sun', () => {
    const e = new Entity();
    e.position = { x: 0, y: 200, z: 0 };
    e.accelVec = { x: 0, y: 0, z: 0 };

    applySunGravity(e, sunPos, 16);

    expect(e.accelVec.x).toBeCloseTo(0, 5);
    expect(e.accelVec.y).toBeLessThan(0); // pulled down toward sun
  });

  it('pulls diagonally for diagonal entity', () => {
    const e = new Entity();
    e.position = { x: 200, y: 200, z: 0 };
    e.accelVec = { x: 0, y: 0, z: 0 };

    applySunGravity(e, sunPos, 16);

    expect(e.accelVec.x).toBeLessThan(0);
    expect(e.accelVec.y).toBeLessThan(0);
  });

  it('accumulates with existing velocity', () => {
    const e = new Entity();
    e.position = { x: 200, y: 0, z: 0 };
    e.accelVec = { x: 5, y: 3, z: 0 };

    applySunGravity(e, sunPos, 16);

    // X should be slightly less than 5 (pulled left)
    expect(e.accelVec.x).toBeLessThan(5);
    // Y should be unchanged (gravity is purely along X axis here)
    expect(e.accelVec.y).toBeCloseTo(3, 3);
  });

  it('handles entity at sun position gracefully (no NaN)', () => {
    const e = new Entity();
    e.position = { x: 0, y: 0, z: 0 }; // same as sun
    e.accelVec = { x: 0, y: 0, z: 0 };

    applySunGravity(e, sunPos, 16);

    expect(Number.isNaN(e.accelVec.x)).toBe(false);
    expect(Number.isNaN(e.accelVec.y)).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/game/Gravity.test.ts`
Expected: FAIL — module not found

**Step 3: Implement applySunGravity**

Create `src/game/Gravity.ts`:

```typescript
import { Entity, Vec3 } from '@/engine/Entity';
import { ARENA } from './Arena';

/**
 * Apply the sun's gravitational pull to an entity.
 * Port of C++ CSceneMelee::ApplySunGravity.
 */
export function applySunGravity(entity: Entity, sunPos: Vec3, dt: number): void {
  const dx = sunPos.x - entity.position.x;
  const dy = sunPos.y - entity.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > ARENA.GRAVITY_RANGE) return;
  if (dist < 0.001) return; // at sun center — skip to avoid division by zero

  const nx = dx / dist;
  const ny = dy / dist;

  let force = ARENA.GRAVITY_CONSTANT / dist;
  if (force > ARENA.GRAVITY_MAX_FORCE) {
    force = ARENA.GRAVITY_MAX_FORCE;
  }

  const scale = force * dt * ARENA.TIME_SCALER;
  entity.accelVec.x += nx * scale;
  entity.accelVec.y += ny * scale;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/game/Gravity.test.ts`
Expected: All PASS

**Step 5: Run all tests**

Run: `npm test`
Expected: All PASS

**Step 6: Commit**

```bash
git add src/game/Gravity.ts src/game/Gravity.test.ts
git commit -m "feat(m5): implement sun gravity system"
```

---

### Task 8: Generate Sun Sprite Sheet Atlas

**Files:**
- Create: `public/textures/sun_atlas.jpg`

This task uses ImageMagick to combine the 60 original sun frames into a single sprite sheet atlas.

**Step 1: Generate the atlas**

Run this command to create an 8x8 grid (60 frames used, 4 blank) from the original assets:

```bash
cd /Users/ori/Documents/CosmoClash/cosmoclash-web
montage /Users/ori/Documents/CosmoClash/turtle_svn/trunk/Turtle/mediaflat/sun/sunSurface_{0000..0059}.jpg -tile 8x8 -geometry 512x256+0+0 -background black public/textures/sun_atlas.jpg
```

If `montage` (ImageMagick) is not available, install it:
```bash
brew install imagemagick
```

After generating, verify:
```bash
ls -la public/textures/sun_atlas.jpg
```

Expected: File exists, approximately 500KB-2MB

**Step 2: Commit**

```bash
git add public/textures/sun_atlas.jpg
git commit -m "asset(m5): add sun sprite sheet atlas (60 frames, 8x8 grid)"
```

---

### Task 9: Integrate Sun into Game Loop

**Files:**
- Modify: `src/main.ts`

This task wires everything together: creates the sun entity, renders it as an animated sphere, adds the red point light, hooks gravity into the game loop, and registers the sun collision event listener.

**Step 1: Add imports**

Add to the top of `src/main.ts`:

```typescript
import { Sun } from '@/game/Sun';
import { applySunGravity } from '@/game/Gravity';
import { GameEventType } from '@/engine/GameEvent';
```

(`GameEventType` may already be imported — just ensure `SunCollision` is accessible through it.)

**Step 2: Create sun entity after player creation**

After the player2 creation block (around line 38), add:

```typescript
// Create sun
const sun = new Sun();
entityManager.add(sun);
```

**Step 3: Create sun mesh and light**

After the thrust effect setup (around line 100), add:

```typescript
// Sun mesh — animated sphere with sprite sheet atlas
const SUN_ATLAS_COLS = 8;
const SUN_ATLAS_ROWS = 8;
const SUN_TOTAL_FRAMES = 60;

const sunTexture = new THREE.TextureLoader().load('/textures/sun_atlas.jpg');
sunTexture.repeat.set(1 / SUN_ATLAS_COLS, 1 / SUN_ATLAS_ROWS);
sunTexture.wrapS = THREE.RepeatWrapping;
sunTexture.wrapT = THREE.RepeatWrapping;

const sunGeo = new THREE.SphereGeometry(65, 32, 32);
const sunMat = new THREE.MeshBasicMaterial({
  map: sunTexture,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
sunMesh.rotation.x = -90 * rad;
sunMesh.position.set(ARENA.SUN_POSITION.x, ARENA.SUN_POSITION.y, ARENA.SUN_POSITION.z);
scene.add(sunMesh);

// Sun point light
const sunLight = new THREE.PointLight(0xff0000, 2, 1500);
sunLight.position.set(ARENA.SUN_POSITION.x, ARENA.SUN_POSITION.y, ARENA.SUN_POSITION.z);
scene.add(sunLight);
```

**Step 4: Register sun collision event listener**

After the existing collision event listener registrations (around line 113), add:

```typescript
GameEventMgr.getInstance().addListener(collisionHandler, GameEventType.SunCollision);
```

**Step 5: Add gravity and sun animation to the game loop update**

In the game loop callback, after `entityManager.update(dt, camCenter)` (around line 192), add:

```typescript
    // Sun gravity — applied to players only (matches original C++)
    applySunGravity(player1, ARENA.SUN_POSITION, dt);
    applySunGravity(player2, ARENA.SUN_POSITION, dt);

    // Sun animation
    sun.updateAnimation(dt);
    const frameIndex = Math.floor(sun.currentFrame);
    const col = frameIndex % SUN_ATLAS_COLS;
    const row = Math.floor(frameIndex / SUN_ATLAS_COLS);
    sunTexture.offset.set(col / SUN_ATLAS_COLS, 1 - (row + 1) / SUN_ATLAS_ROWS);
```

**Step 6: Run all tests**

Run: `npm test`
Expected: All PASS

**Step 7: Manual test**

Run: `npm run dev`

Verify:
- A large glowing sun is visible at the arena center
- The sun surface texture animates (slowly shifting surface pattern)
- Red light illuminates nearby objects
- Flying ships near the sun shows gravitational pull toward center
- Ships touching the sun bounce away

**Step 8: Commit**

```bash
git add src/main.ts
git commit -m "feat(m5): integrate sun entity, gravity, and visuals into game loop"
```

---

### Task 10: Handle Bullet-Sun Collision (Bullet Destroyed, Sun Undamaged)

**Files:**
- Modify: `src/game/CollisionHandler.ts`
- Modify: `src/game/CollisionHandler.test.ts`

The existing `handleBulletHit` applies damage to the target. When the target is the sun, we need to skip damage application (sun is indestructible) but still destroy the bullet.

**Step 1: Write the failing test**

Add to the `bullet hit` describe block in `src/game/CollisionHandler.test.ts`:

```typescript
    it('destroys bullet on sun hit but does not damage sun', () => {
      const sun = new Entity();
      sun.entityType = EntityType.Sun;
      sun.health = 1;
      sun.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 65 }];

      const bullet = new Bullet(FLAME_BULLET_CONFIG, new Entity());
      const evt = new BulletHitEvent(bullet, sun);

      handler.onGameEvent(evt);

      expect(bullet.alive).toBe(false);
      expect(sun.health).toBe(1); // sun takes no damage
    });
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/CollisionHandler.test.ts`
Expected: FAIL — sun.health is less than 1

**Step 3: Update handleBulletHit to skip sun damage**

In `src/game/CollisionHandler.ts`, modify `handleBulletHit`:

```typescript
  private handleBulletHit(event: BulletHitEvent): void {
    const bullet = event.bullet as Bullet;
    const target = event.target;

    // Sun is indestructible — bullets die on contact but deal no damage
    if (target.entityType !== EntityType.Sun) {
      target.health -= bullet.config.damage;
      if (target.health <= 0) {
        target.destroy();
      }
    }

    bullet.destroy();
  }
```

Add the `EntityType` import if not already present:

```typescript
import { Entity, EntityType } from '@/engine/Entity';
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/game/CollisionHandler.test.ts`
Expected: All PASS

**Step 5: Run all tests**

Run: `npm test`
Expected: All PASS

**Step 6: Commit**

```bash
git add src/game/CollisionHandler.ts src/game/CollisionHandler.test.ts
git commit -m "feat(m5): bullets destroyed on sun contact without damaging sun"
```

---

### Task 11: Final Integration Test and Cleanup

**Step 1: Run full test suite**

Run: `npm test`
Expected: All PASS

**Step 2: Run the dev server and verify gameplay**

Run: `npm run dev`

Full verification checklist:
- [ ] Sun visible at arena center with animated texture
- [ ] Red point light visible on nearby objects
- [ ] Players feel gravitational pull when within 450 units of sun
- [ ] Gravity is stronger closer to the sun
- [ ] Player bounces away on sun contact
- [ ] Bullets are destroyed on sun contact
- [ ] Ships can orbit the sun (thrust perpendicular to gravity)
- [ ] Ships outside gravity range (>450 units) feel no pull
- [ ] Existing features still work: thrust, rotation, shooting, camera zoom, wrap-around

**Step 3: Commit any cleanup**

If no changes needed, this task is done.
