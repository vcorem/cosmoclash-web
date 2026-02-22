# M3 Collision Detection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bullets damage entities, ships collide with each other, health tracks damage and triggers destruction — using sweep-sphere collision detection and a full game event system.

**Architecture:** Centralized `CollisionDetector` (port of C++ `CollisionDetector.h/cpp`) runs each frame over all entity pairs. Collisions dispatch through `GameEventMgr` (port of C++ `GameEventMgr`) to registered listeners that apply damage and destroy entities. Collision spheres live on `Entity`.

**Tech Stack:** TypeScript, Vitest, Three.js (rendering only — collision is pure math)

**Test command:** `npm test` (runs `vitest run`)

**Design doc:** `docs/plans/2026-02-21-milestone3-collision-detection-design.md`

---

### Task 1: Game Event System — Types and Base Class

**Files:**
- Create: `src/engine/GameEvent.ts`
- Create: `src/engine/GameEvent.test.ts`

**Step 1: Write the failing test**

Create `src/engine/GameEvent.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  GameEventType,
  GameEvent,
  CollisionEvent,
  BulletHitEvent,
  ExplosionEvent,
} from './GameEvent';
import { Entity } from './Entity';

describe('GameEvent', () => {
  it('stores event type', () => {
    const e = new GameEvent(GameEventType.Collision);
    expect(e.type).toBe(GameEventType.Collision);
  });
});

describe('CollisionEvent', () => {
  it('stores entityA, entityB, and collisionTime', () => {
    const a = new Entity();
    const b = new Entity();
    const e = new CollisionEvent(a, b, 0.5);
    expect(e.type).toBe(GameEventType.Collision);
    expect(e.entityA).toBe(a);
    expect(e.entityB).toBe(b);
    expect(e.collisionTime).toBe(0.5);
  });
});

describe('BulletHitEvent', () => {
  it('stores bullet and target', () => {
    const bullet = new Entity();
    const target = new Entity();
    const e = new BulletHitEvent(bullet, target);
    expect(e.type).toBe(GameEventType.BulletHit);
    expect(e.bullet).toBe(bullet);
    expect(e.target).toBe(target);
  });
});

describe('ExplosionEvent', () => {
  it('stores entity', () => {
    const ent = new Entity();
    const e = new ExplosionEvent(ent);
    expect(e.type).toBe(GameEventType.Explosion);
    expect(e.entity).toBe(ent);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/GameEvent.test.ts`
Expected: FAIL — module `./GameEvent` does not exist

**Step 3: Write minimal implementation**

Create `src/engine/GameEvent.ts`:

```ts
import { Entity } from './Entity';

export enum GameEventType {
  Collision,
  Explosion,
  BulletHit,
  FrameRender,
}

export class GameEvent {
  readonly type: GameEventType;

  constructor(type: GameEventType) {
    this.type = type;
  }
}

export class CollisionEvent extends GameEvent {
  readonly entityA: Entity;
  readonly entityB: Entity;
  readonly collisionTime: number;

  constructor(entityA: Entity, entityB: Entity, collisionTime: number) {
    super(GameEventType.Collision);
    this.entityA = entityA;
    this.entityB = entityB;
    this.collisionTime = collisionTime;
  }
}

export class BulletHitEvent extends GameEvent {
  readonly bullet: Entity;
  readonly target: Entity;

  constructor(bullet: Entity, target: Entity) {
    super(GameEventType.BulletHit);
    this.bullet = bullet;
    this.target = target;
  }
}

export class ExplosionEvent extends GameEvent {
  readonly entity: Entity;

  constructor(entity: Entity) {
    super(GameEventType.Explosion);
    this.entity = entity;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/GameEvent.test.ts`
Expected: PASS — all 4 tests green

**Step 5: Commit**

```bash
git add src/engine/GameEvent.ts src/engine/GameEvent.test.ts
git commit -m "feat(m3): add game event types and event classes"
```

---

### Task 2: Game Event Manager

**Files:**
- Create: `src/engine/GameEventMgr.ts`
- Create: `src/engine/GameEventMgr.test.ts`

**Step 1: Write the failing test**

Create `src/engine/GameEventMgr.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GameEventMgr } from './GameEventMgr';
import { GameEventType, GameEvent, CollisionEvent } from './GameEvent';
import { Entity } from './Entity';

describe('GameEventMgr', () => {
  beforeEach(() => {
    GameEventMgr.reset();
  });

  it('is a singleton', () => {
    const a = GameEventMgr.getInstance();
    const b = GameEventMgr.getInstance();
    expect(a).toBe(b);
  });

  it('dispatches event to registered listener', () => {
    const mgr = GameEventMgr.getInstance();
    const received: GameEvent[] = [];
    mgr.addListener({ onGameEvent: (e) => received.push(e) }, GameEventType.Collision);

    const evt = new CollisionEvent(new Entity(), new Entity(), 0.5);
    mgr.sendEvent(evt);

    expect(received).toHaveLength(1);
    expect(received[0]).toBe(evt);
  });

  it('does not dispatch to listener of different type', () => {
    const mgr = GameEventMgr.getInstance();
    const received: GameEvent[] = [];
    mgr.addListener({ onGameEvent: (e) => received.push(e) }, GameEventType.Explosion);

    const evt = new CollisionEvent(new Entity(), new Entity(), 0.5);
    mgr.sendEvent(evt);

    expect(received).toHaveLength(0);
  });

  it('dispatches to multiple listeners for same type', () => {
    const mgr = GameEventMgr.getInstance();
    let count = 0;
    mgr.addListener({ onGameEvent: () => count++ }, GameEventType.Collision);
    mgr.addListener({ onGameEvent: () => count++ }, GameEventType.Collision);

    mgr.sendEvent(new CollisionEvent(new Entity(), new Entity(), 0));
    expect(count).toBe(2);
  });

  it('copies listener list before iterating (safe against modification during dispatch)', () => {
    const mgr = GameEventMgr.getInstance();
    const received: number[] = [];
    const listener1 = {
      onGameEvent: () => {
        received.push(1);
        // Add new listener during dispatch — should NOT fire in this dispatch
        mgr.addListener({ onGameEvent: () => received.push(3) }, GameEventType.Collision);
      },
    };
    const listener2 = { onGameEvent: () => received.push(2) };
    mgr.addListener(listener1, GameEventType.Collision);
    mgr.addListener(listener2, GameEventType.Collision);

    mgr.sendEvent(new CollisionEvent(new Entity(), new Entity(), 0));
    expect(received).toEqual([1, 2]);
  });

  it('removes a listener', () => {
    const mgr = GameEventMgr.getInstance();
    const received: GameEvent[] = [];
    const listener = { onGameEvent: (e: GameEvent) => received.push(e) };
    mgr.addListener(listener, GameEventType.Collision);
    mgr.removeListener(listener, GameEventType.Collision);

    mgr.sendEvent(new CollisionEvent(new Entity(), new Entity(), 0));
    expect(received).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/GameEventMgr.test.ts`
Expected: FAIL — module `./GameEventMgr` does not exist

**Step 3: Write minimal implementation**

Create `src/engine/GameEventMgr.ts`:

```ts
import { GameEvent, GameEventType } from './GameEvent';

export interface GameEventListener {
  onGameEvent(event: GameEvent): void;
}

export class GameEventMgr {
  private static instance: GameEventMgr | null = null;
  private listeners: Map<GameEventType, GameEventListener[]> = new Map();

  private constructor() {
    for (const val of Object.values(GameEventType)) {
      if (typeof val === 'number') {
        this.listeners.set(val, []);
      }
    }
  }

  static getInstance(): GameEventMgr {
    if (!GameEventMgr.instance) {
      GameEventMgr.instance = new GameEventMgr();
    }
    return GameEventMgr.instance;
  }

  static reset(): void {
    GameEventMgr.instance = null;
  }

  addListener(listener: GameEventListener, type: GameEventType): void {
    const list = this.listeners.get(type);
    if (list) {
      list.push(listener);
    }
  }

  removeListener(listener: GameEventListener, type: GameEventType): void {
    const list = this.listeners.get(type);
    if (list) {
      const idx = list.indexOf(listener);
      if (idx !== -1) list.splice(idx, 1);
    }
  }

  sendEvent(event: GameEvent): void {
    const list = this.listeners.get(event.type);
    if (!list) return;
    const copy = [...list];
    for (const listener of copy) {
      listener.onGameEvent(event);
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/GameEventMgr.test.ts`
Expected: PASS — all 6 tests green

**Step 5: Commit**

```bash
git add src/engine/GameEventMgr.ts src/engine/GameEventMgr.test.ts
git commit -m "feat(m3): add GameEventMgr singleton with listener dispatch"
```

---

### Task 3: Entity — Add Health, EntityType, and CollisionSpheres

**Files:**
- Modify: `src/engine/Entity.ts`
- Modify: `src/engine/Entity.test.ts`

**Step 1: Write the failing tests**

Add to `src/engine/Entity.test.ts` — new describe blocks at the end:

```ts
// Add EntityType to imports at top:
// import { Entity, EntityType } from './Entity';

describe('health', () => {
  it('initializes with full health', () => {
    const e = new Entity();
    expect(e.health).toBe(1);
  });

  it('can take damage', () => {
    const e = new Entity();
    e.health -= 0.3;
    expect(e.health).toBeCloseTo(0.7);
  });

  it('destroy sets alive to false', () => {
    const e = new Entity();
    e.health = 0;
    e.destroy();
    expect(e.alive).toBe(false);
  });
});

describe('entityType', () => {
  it('defaults to Player', () => {
    const e = new Entity();
    expect(e.entityType).toBe(EntityType.Player);
  });
});

describe('collisionSpheres', () => {
  it('initializes with empty collision spheres', () => {
    const e = new Entity();
    expect(e.collisionSpheres).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/Entity.test.ts`
Expected: FAIL — `health`, `entityType`, `collisionSpheres` don't exist on Entity

**Step 3: Modify Entity.ts**

Add to `src/engine/Entity.ts`:

```ts
// Add before the Entity class:
export interface CollisionSphere {
  offset: Vec3;
  radius: number;
}

export enum EntityType {
  Player,
  Bullet,
  Dummy,
}

// Add these properties to the Entity class body (after the existing properties):
  health: number = 1;
  entityType: EntityType = EntityType.Player;
  collisionSpheres: CollisionSphere[] = [];
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/Entity.test.ts`
Expected: PASS — all tests green (existing + new)

**Step 5: Commit**

```bash
git add src/engine/Entity.ts src/engine/Entity.test.ts
git commit -m "feat(m3): add health, entityType, collisionSpheres to Entity"
```

---

### Task 4: Player and Bullet — Set Collision Spheres and EntityType

**Files:**
- Modify: `src/game/Player.ts`
- Modify: `src/game/Player.test.ts`
- Modify: `src/game/Bullet.ts`
- Modify: `src/game/Bullet.test.ts`

**Step 1: Write the failing tests**

Add to `src/game/Player.test.ts` — new describe block:

```ts
// Add EntityType to imports:
// import { EntityType } from '@/engine/Entity';

describe('collision setup', () => {
  it('has entityType Player', () => {
    const p = new Player(GONDI_STATS);
    expect(p.entityType).toBe(EntityType.Player);
  });

  it('has one collision sphere at origin with radius 14', () => {
    const p = new Player(GONDI_STATS);
    expect(p.collisionSpheres).toHaveLength(1);
    expect(p.collisionSpheres[0].offset).toEqual({ x: 0, y: 0, z: 0 });
    expect(p.collisionSpheres[0].radius).toBe(14);
  });
});
```

Add to `src/game/Bullet.test.ts` — new describe block:

```ts
// Add EntityType to imports:
// import { EntityType } from '@/engine/Entity';

describe('collision setup', () => {
  it('has entityType Bullet', () => {
    const b = new Bullet(FLAME_BULLET_CONFIG);
    expect(b.entityType).toBe(EntityType.Bullet);
  });

  it('has one collision sphere at origin with radius from config', () => {
    const b = new Bullet(FLAME_BULLET_CONFIG);
    expect(b.collisionSpheres).toHaveLength(1);
    expect(b.collisionSpheres[0].offset).toEqual({ x: 0, y: 0, z: 0 });
    expect(b.collisionSpheres[0].radius).toBe(10);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/game/Player.test.ts src/game/Bullet.test.ts`
Expected: FAIL — collision spheres are empty, entityType is default

**Step 3: Modify Player.ts and Bullet.ts**

In `src/game/Player.ts`, add to the `Player` constructor (after `super()`):

```ts
import { Entity, EntityType } from '@/engine/Entity';

// Inside constructor, after super():
    this.entityType = EntityType.Player;
    this.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];
```

In `src/game/Bullet.ts`, add to the `Bullet` constructor (after `super()`):

```ts
import { Entity, EntityType } from '@/engine/Entity';

// Inside constructor, after super():
    this.entityType = EntityType.Bullet;
    this.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: config.collisionRadius }];
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/game/Player.test.ts src/game/Bullet.test.ts`
Expected: PASS — all tests green

**Step 5: Commit**

```bash
git add src/game/Player.ts src/game/Player.test.ts src/game/Bullet.ts src/game/Bullet.test.ts
git commit -m "feat(m3): set collision spheres and entityType on Player and Bullet"
```

---

### Task 5: Sweep-Sphere Algorithm

**Files:**
- Create: `src/engine/CollisionDetector.ts`
- Create: `src/engine/CollisionDetector.test.ts`

**Step 1: Write the failing test**

Create `src/engine/CollisionDetector.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sphereSphereSweep } from './CollisionDetector';

describe('sphereSphereSweep', () => {
  it('detects head-on collision between two moving spheres', () => {
    // Sphere A moves right, sphere B moves left, they meet in the middle
    const result = sphereSphereSweep(
      5, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 },   // A: r=5, moves from 0 to 10
      5, { x: 20, y: 0, z: 0 }, { x: 10, y: 0, z: 0 },   // B: r=5, moves from 20 to 10
    );
    expect(result.hit).toBe(true);
    expect(result.u0).toBeGreaterThan(0);
    expect(result.u0).toBeLessThanOrEqual(1);
  });

  it('detects stationary overlapping spheres', () => {
    const result = sphereSphereSweep(
      10, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 },
      10, { x: 5, y: 0, z: 0 }, { x: 5, y: 0, z: 0 },
    );
    expect(result.hit).toBe(true);
    expect(result.u0).toBe(0);
  });

  it('returns no hit for spheres moving apart', () => {
    const result = sphereSphereSweep(
      5, { x: 0, y: 0, z: 0 }, { x: -10, y: 0, z: 0 },
      5, { x: 20, y: 0, z: 0 }, { x: 30, y: 0, z: 0 },
    );
    expect(result.hit).toBe(false);
  });

  it('returns no hit for parallel paths that never touch', () => {
    const result = sphereSphereSweep(
      2, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 },
      2, { x: 0, y: 100, z: 0 }, { x: 10, y: 100, z: 0 },
    );
    expect(result.hit).toBe(false);
  });

  it('returns no hit when collision would occur outside frame (u > 1)', () => {
    // Spheres approach but won't reach each other this frame
    const result = sphereSphereSweep(
      1, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
      1, { x: 100, y: 0, z: 0 }, { x: 99, y: 0, z: 0 },
    );
    expect(result.hit).toBe(false);
  });

  it('detects collision at exact frame boundary (u = 1)', () => {
    // Two spheres with r=5 each. Start 20 apart, each moves 5 toward the other.
    // At u=1 they are 10 apart = exactly touching (5+5).
    const result = sphereSphereSweep(
      5, { x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 },
      5, { x: 20, y: 0, z: 0 }, { x: 15, y: 0, z: 0 },
    );
    expect(result.hit).toBe(true);
    expect(result.u0).toBeCloseTo(1, 5);
  });

  it('handles one stationary and one moving sphere', () => {
    // B is stationary at x=20, A moves from x=0 to x=15. Radii 5 each.
    // They first touch when A center is at x=10 (distance = 10 = 5+5)
    // A travels 15 units total, needs 10 units -> u = 10/15 = 0.667
    const result = sphereSphereSweep(
      5, { x: 0, y: 0, z: 0 }, { x: 15, y: 0, z: 0 },
      5, { x: 20, y: 0, z: 0 }, { x: 20, y: 0, z: 0 },
    );
    expect(result.hit).toBe(true);
    expect(result.u0).toBeCloseTo(0.667, 2);
  });

  it('handles both spheres stationary and not overlapping', () => {
    const result = sphereSphereSweep(
      5, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 },
      5, { x: 100, y: 0, z: 0 }, { x: 100, y: 0, z: 0 },
    );
    expect(result.hit).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/CollisionDetector.test.ts`
Expected: FAIL — module `./CollisionDetector` does not exist

**Step 3: Write implementation**

Create `src/engine/CollisionDetector.ts`:

```ts
import { Vec3 } from './Entity';

export interface SweepResult {
  hit: boolean;
  u0: number;
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/**
 * Sweep-sphere collision test. Port of C++ SphereSphereSweep().
 * Tests whether two moving spheres collide during the frame.
 * Returns hit=true and normalized collision time u0 in (0, 1].
 * Returns hit=true, u0=0 if already overlapping.
 */
export function sphereSphereSweep(
  ra: number, A0: Vec3, A1: Vec3,
  rb: number, B0: Vec3, B1: Vec3,
): SweepResult {
  const va = sub(A1, A0);
  const vb = sub(B1, B0);
  const AB = sub(B0, A0);
  const vab = sub(vb, va);
  const rab = ra + rb;

  const a = dot(vab, vab);
  const b = 2 * dot(vab, AB);
  const c = dot(AB, AB) - rab * rab;

  // Already overlapping
  if (c <= 0) {
    return { hit: true, u0: 0 };
  }

  // Both stationary and not overlapping
  if (a === 0) {
    return { hit: false, u0: 0 };
  }

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return { hit: false, u0: 0 };
  }

  const sqrtD = Math.sqrt(discriminant);
  let u0 = (-b - sqrtD) / (2 * a);
  let u1 = (-b + sqrtD) / (2 * a);

  if (u0 > u1) {
    const tmp = u0;
    u0 = u1;
    u1 = tmp;
  }

  if (u0 > 1 || u1 < 0) {
    return { hit: false, u0: 0 };
  }

  if (u0 < 0) {
    // Collision started before frame — use u1 if valid
    if (u1 >= 0 && u1 <= 1) {
      return { hit: true, u0: 0 };
    }
    return { hit: false, u0: 0 };
  }

  return { hit: true, u0 };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/CollisionDetector.test.ts`
Expected: PASS — all 8 tests green

**Step 5: Commit**

```bash
git add src/engine/CollisionDetector.ts src/engine/CollisionDetector.test.ts
git commit -m "feat(m3): implement sweep-sphere collision algorithm"
```

---

### Task 6: Collision Detection Loop

**Files:**
- Modify: `src/engine/CollisionDetector.ts`
- Modify: `src/engine/CollisionDetector.test.ts`

**Step 1: Write the failing tests**

Add to `src/engine/CollisionDetector.test.ts`:

```ts
import { CollisionDetector } from './CollisionDetector';
import { Entity, EntityType } from './Entity';
import { Bullet, FLAME_BULLET_CONFIG } from '@/game/Bullet';
import { GameEventMgr } from './GameEventMgr';
import { GameEventType, GameEvent, CollisionEvent, BulletHitEvent } from './GameEvent';
import { beforeEach } from 'vitest';

describe('CollisionDetector', () => {
  let detector: CollisionDetector;

  beforeEach(() => {
    GameEventMgr.reset();
    detector = new CollisionDetector();
  });

  it('fires BulletHitEvent when bullet hits non-origin entity', () => {
    const target = new Entity();
    target.entityType = EntityType.Player;
    target.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];
    target.position = { x: 50, y: 0, z: 0 };
    target.previousPosition = { x: 50, y: 0, z: 0 };

    const shooter = new Entity();
    shooter.entityType = EntityType.Player;

    const bullet = new Bullet(FLAME_BULLET_CONFIG, shooter);
    bullet.position = { x: 50, y: 0, z: 0 }; // overlapping target
    bullet.previousPosition = { x: 40, y: 0, z: 0 };

    const events: GameEvent[] = [];
    GameEventMgr.getInstance().addListener(
      { onGameEvent: (e) => events.push(e) },
      GameEventType.BulletHit,
    );

    detector.checkCollisions([target, bullet]);

    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(BulletHitEvent);
    const hit = events[0] as BulletHitEvent;
    expect(hit.bullet).toBe(bullet);
    expect(hit.target).toBe(target);
  });

  it('does NOT fire event when bullet hits its origin entity', () => {
    const shooter = new Entity();
    shooter.entityType = EntityType.Player;
    shooter.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];
    shooter.position = { x: 50, y: 0, z: 0 };
    shooter.previousPosition = { x: 50, y: 0, z: 0 };

    const bullet = new Bullet(FLAME_BULLET_CONFIG, shooter);
    bullet.position = { x: 50, y: 0, z: 0 };
    bullet.previousPosition = { x: 40, y: 0, z: 0 };

    const events: GameEvent[] = [];
    GameEventMgr.getInstance().addListener(
      { onGameEvent: (e) => events.push(e) },
      GameEventType.BulletHit,
    );

    detector.checkCollisions([shooter, bullet]);

    expect(events).toHaveLength(0);
  });

  it('does NOT fire event for bullet-bullet collision', () => {
    const shooter = new Entity();
    const b1 = new Bullet(FLAME_BULLET_CONFIG, shooter);
    b1.position = { x: 50, y: 0, z: 0 };
    b1.previousPosition = { x: 50, y: 0, z: 0 };

    const b2 = new Bullet(FLAME_BULLET_CONFIG, shooter);
    b2.position = { x: 50, y: 0, z: 0 };
    b2.previousPosition = { x: 50, y: 0, z: 0 };

    const events: GameEvent[] = [];
    GameEventMgr.getInstance().addListener(
      { onGameEvent: (e) => events.push(e) },
      GameEventType.BulletHit,
    );
    GameEventMgr.getInstance().addListener(
      { onGameEvent: (e) => events.push(e) },
      GameEventType.Collision,
    );

    detector.checkCollisions([b1, b2]);

    expect(events).toHaveLength(0);
  });

  it('fires CollisionEvent for player-player collision', () => {
    const p1 = new Entity();
    p1.entityType = EntityType.Player;
    p1.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];
    p1.position = { x: 0, y: 0, z: 0 };
    p1.previousPosition = { x: 0, y: 0, z: 0 };

    const p2 = new Entity();
    p2.entityType = EntityType.Player;
    p2.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];
    p2.position = { x: 10, y: 0, z: 0 }; // within 14+14 = 28
    p2.previousPosition = { x: 10, y: 0, z: 0 };

    const events: GameEvent[] = [];
    GameEventMgr.getInstance().addListener(
      { onGameEvent: (e) => events.push(e) },
      GameEventType.Collision,
    );

    detector.checkCollisions([p1, p2]);

    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(CollisionEvent);
  });

  it('skips dead entities', () => {
    const target = new Entity();
    target.entityType = EntityType.Player;
    target.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];
    target.position = { x: 50, y: 0, z: 0 };
    target.previousPosition = { x: 50, y: 0, z: 0 };
    target.alive = false;

    const bullet = new Bullet(FLAME_BULLET_CONFIG, new Entity());
    bullet.position = { x: 50, y: 0, z: 0 };
    bullet.previousPosition = { x: 40, y: 0, z: 0 };

    const events: GameEvent[] = [];
    GameEventMgr.getInstance().addListener(
      { onGameEvent: (e) => events.push(e) },
      GameEventType.BulletHit,
    );

    detector.checkCollisions([target, bullet]);

    expect(events).toHaveLength(0);
  });

  it('does not check same pair twice', () => {
    const p1 = new Entity();
    p1.entityType = EntityType.Player;
    p1.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];
    p1.position = { x: 0, y: 0, z: 0 };
    p1.previousPosition = { x: 0, y: 0, z: 0 };

    const p2 = new Entity();
    p2.entityType = EntityType.Player;
    p2.collisionSpheres = [{ offset: { x: 0, y: 0, z: 0 }, radius: 14 }];
    p2.position = { x: 10, y: 0, z: 0 };
    p2.previousPosition = { x: 10, y: 0, z: 0 };

    const events: GameEvent[] = [];
    GameEventMgr.getInstance().addListener(
      { onGameEvent: (e) => events.push(e) },
      GameEventType.Collision,
    );

    detector.checkCollisions([p1, p2]);

    // Should only fire once, not twice (A-B and B-A)
    expect(events).toHaveLength(1);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/CollisionDetector.test.ts`
Expected: FAIL — `CollisionDetector` class does not exist

**Step 3: Add CollisionDetector class to CollisionDetector.ts**

Add to the bottom of `src/engine/CollisionDetector.ts`:

```ts
import { Entity, EntityType, CollisionSphere, Vec3 } from './Entity';
import { Bullet } from '@/game/Bullet';
import { GameEventMgr } from './GameEventMgr';
import { CollisionEvent, BulletHitEvent } from './GameEvent';

export class CollisionDetector {
  checkCollisions(entities: Entity[]): void {
    const mgr = GameEventMgr.getInstance();

    for (let i = 0; i < entities.length; i++) {
      const a = entities[i];
      if (!a.alive || a.collisionSpheres.length === 0) continue;

      for (let j = i + 1; j < entities.length; j++) {
        const b = entities[j];
        if (!b.alive || b.collisionSpheres.length === 0) continue;

        if (!this.shouldCheck(a, b)) continue;

        const result = this.testEntityPair(a, b);
        if (result.hit) {
          this.emitEvent(mgr, a, b, result.u0);
        }
      }
    }
  }

  private shouldCheck(a: Entity, b: Entity): boolean {
    const aIsBullet = a.entityType === EntityType.Bullet;
    const bIsBullet = b.entityType === EntityType.Bullet;

    // Bullets don't collide with each other
    if (aIsBullet && bIsBullet) return false;

    // Bullets don't collide with their origin
    if (aIsBullet && (a as Bullet).originEntity === b) return false;
    if (bIsBullet && (b as Bullet).originEntity === a) return false;

    return true;
  }

  private testEntityPair(a: Entity, b: Entity): SweepResult {
    for (const sa of a.collisionSpheres) {
      const aPos0 = this.worldSpherePos(a.previousPosition, sa);
      const aPos1 = this.worldSpherePos(a.position, sa);

      for (const sb of b.collisionSpheres) {
        const bPos0 = this.worldSpherePos(b.previousPosition, sb);
        const bPos1 = this.worldSpherePos(b.position, sb);

        const result = sphereSphereSweep(sa.radius, aPos0, aPos1, sb.radius, bPos0, bPos1);
        if (result.hit) return result;
      }
    }

    return { hit: false, u0: 0 };
  }

  private worldSpherePos(entityPos: Vec3, sphere: CollisionSphere): Vec3 {
    return {
      x: entityPos.x + sphere.offset.x,
      y: entityPos.y + sphere.offset.y,
      z: entityPos.z + sphere.offset.z,
    };
  }

  private emitEvent(mgr: GameEventMgr, a: Entity, b: Entity, u0: number): void {
    const aIsBullet = a.entityType === EntityType.Bullet;
    const bIsBullet = b.entityType === EntityType.Bullet;

    if (aIsBullet) {
      mgr.sendEvent(new BulletHitEvent(a, b));
    } else if (bIsBullet) {
      mgr.sendEvent(new BulletHitEvent(b, a));
    } else {
      mgr.sendEvent(new CollisionEvent(a, b, u0));
    }
  }
}
```

Note: you will need to update the imports at the top of `CollisionDetector.ts` to include `Entity`, `EntityType`, `CollisionSphere`, `Vec3` from `./Entity`, `Bullet` from `@/game/Bullet`, `GameEventMgr` from `./GameEventMgr`, and `CollisionEvent`, `BulletHitEvent` from `./GameEvent`. Keep the existing `sphereSphereSweep` function and its helpers (`dot`, `sub`, `SweepResult`) — the class is added below them in the same file.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/CollisionDetector.test.ts`
Expected: PASS — all 14 tests green (8 sweep + 6 detector)

**Step 5: Commit**

```bash
git add src/engine/CollisionDetector.ts src/engine/CollisionDetector.test.ts
git commit -m "feat(m3): add CollisionDetector with pair rules and event dispatch"
```

---

### Task 7: Collision Response — Damage and Destruction

**Files:**
- Create: `src/game/CollisionHandler.ts`
- Create: `src/game/CollisionHandler.test.ts`

This is the listener that responds to collision events by applying damage.

**Step 1: Write the failing test**

Create `src/game/CollisionHandler.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { CollisionHandler } from './CollisionHandler';
import { Entity, EntityType } from '@/engine/Entity';
import { Bullet, FLAME_BULLET_CONFIG } from './Bullet';
import { BulletHitEvent, CollisionEvent } from '@/engine/GameEvent';

describe('CollisionHandler', () => {
  let handler: CollisionHandler;

  beforeEach(() => {
    handler = new CollisionHandler();
  });

  describe('bullet hit', () => {
    it('applies bullet damage to target', () => {
      const target = new Entity();
      target.health = 1;
      const bullet = new Bullet(FLAME_BULLET_CONFIG, new Entity());
      const evt = new BulletHitEvent(bullet, target);

      handler.onGameEvent(evt);

      expect(target.health).toBeCloseTo(1 - 0.05);
    });

    it('destroys bullet on hit', () => {
      const target = new Entity();
      const bullet = new Bullet(FLAME_BULLET_CONFIG, new Entity());
      const evt = new BulletHitEvent(bullet, target);

      handler.onGameEvent(evt);

      expect(bullet.alive).toBe(false);
    });

    it('destroys target when health reaches 0', () => {
      const target = new Entity();
      target.health = 0.03; // less than bullet damage 0.05
      const bullet = new Bullet(FLAME_BULLET_CONFIG, new Entity());
      const evt = new BulletHitEvent(bullet, target);

      handler.onGameEvent(evt);

      expect(target.health).toBeLessThanOrEqual(0);
      expect(target.alive).toBe(false);
    });

    it('does not destroy target if health remains above 0', () => {
      const target = new Entity();
      target.health = 1;
      const bullet = new Bullet(FLAME_BULLET_CONFIG, new Entity());
      const evt = new BulletHitEvent(bullet, target);

      handler.onGameEvent(evt);

      expect(target.alive).toBe(true);
    });
  });

  describe('ship-ship collision', () => {
    it('applies mutual damage based on relative velocity', () => {
      const p1 = new Entity();
      p1.health = 1;
      p1.accelVec = { x: 0.5, y: 0, z: 0 };

      const p2 = new Entity();
      p2.health = 1;
      p2.accelVec = { x: -0.5, y: 0, z: 0 };

      const evt = new CollisionEvent(p1, p2, 0.5);
      handler.onGameEvent(evt);

      // Both should take some damage
      expect(p1.health).toBeLessThan(1);
      expect(p2.health).toBeLessThan(1);
    });

    it('reflects velocity vectors apart (separation force)', () => {
      const p1 = new Entity();
      p1.position = { x: 0, y: 0, z: 0 };
      p1.accelVec = { x: 0.5, y: 0, z: 0 };

      const p2 = new Entity();
      p2.position = { x: 10, y: 0, z: 0 };
      p2.accelVec = { x: -0.5, y: 0, z: 0 };

      const evt = new CollisionEvent(p1, p2, 0.5);
      handler.onGameEvent(evt);

      // p1 should now move left (away from p2)
      expect(p1.accelVec.x).toBeLessThan(0);
      // p2 should now move right (away from p1)
      expect(p2.accelVec.x).toBeGreaterThan(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/CollisionHandler.test.ts`
Expected: FAIL — module `./CollisionHandler` does not exist

**Step 3: Write implementation**

Create `src/game/CollisionHandler.ts`:

```ts
import { GameEventListener } from '@/engine/GameEventMgr';
import { GameEvent, GameEventType, BulletHitEvent, CollisionEvent } from '@/engine/GameEvent';
import { Bullet } from './Bullet';

const COLLISION_DAMAGE_SCALE = 0.2;

export class CollisionHandler implements GameEventListener {
  onGameEvent(event: GameEvent): void {
    if (event.type === GameEventType.BulletHit) {
      this.handleBulletHit(event as BulletHitEvent);
    } else if (event.type === GameEventType.Collision) {
      this.handleShipCollision(event as CollisionEvent);
    }
  }

  private handleBulletHit(event: BulletHitEvent): void {
    const bullet = event.bullet as Bullet;
    const target = event.target;

    target.health -= bullet.config.damage;
    bullet.destroy();

    if (target.health <= 0) {
      target.destroy();
    }
  }

  private handleShipCollision(event: CollisionEvent): void {
    const a = event.entityA;
    const b = event.entityB;

    // Damage based on relative velocity magnitude
    const rvx = a.accelVec.x - b.accelVec.x;
    const rvy = a.accelVec.y - b.accelVec.y;
    const rvz = a.accelVec.z - b.accelVec.z;
    const relSpeed = Math.sqrt(rvx * rvx + rvy * rvy + rvz * rvz);
    const damage = Math.min(relSpeed * COLLISION_DAMAGE_SCALE, 0.3);

    a.health -= damage;
    b.health -= damage;

    if (a.health <= 0) a.destroy();
    if (b.health <= 0) b.destroy();

    // Separation force: reflect velocities along collision axis
    const dx = b.position.x - a.position.x;
    const dy = b.position.y - a.position.y;
    const dz = b.position.z - a.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    const nz = dz / dist;

    const aSpeed = Math.sqrt(
      a.accelVec.x * a.accelVec.x +
      a.accelVec.y * a.accelVec.y +
      a.accelVec.z * a.accelVec.z,
    );
    const bSpeed = Math.sqrt(
      b.accelVec.x * b.accelVec.x +
      b.accelVec.y * b.accelVec.y +
      b.accelVec.z * b.accelVec.z,
    );

    // Reflect: each entity bounces away along collision normal
    a.accelVec = { x: -nx * aSpeed, y: -ny * aSpeed, z: -nz * aSpeed };
    b.accelVec = { x: nx * bSpeed, y: ny * bSpeed, z: nz * bSpeed };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/CollisionHandler.test.ts`
Expected: PASS — all 6 tests green

**Step 5: Commit**

```bash
git add src/game/CollisionHandler.ts src/game/CollisionHandler.test.ts
git commit -m "feat(m3): add CollisionHandler with damage and separation force"
```

---

### Task 8: Integration — Wire into Game Loop with Dummy Target

**Files:**
- Modify: `src/main.ts`

This task wires the collision system into the running game. No unit test — this is visual integration verified by running the game.

**Step 1: Add imports to main.ts**

At the top of `src/main.ts`, add:

```ts
import { CollisionDetector } from '@/engine/CollisionDetector';
import { CollisionHandler } from '@/game/CollisionHandler';
import { GameEventMgr } from '@/engine/GameEventMgr';
import { GameEventType } from '@/engine/GameEvent';
import { EntityType } from '@/engine/Entity';
```

**Step 2: Create dummy target and collision systems**

After the `const input = new InputManager();` line, add:

```ts
// Collision detection
const collisionDetector = new CollisionDetector();
const collisionHandler = new CollisionHandler();
GameEventMgr.getInstance().addListener(collisionHandler, GameEventType.BulletHit);
GameEventMgr.getInstance().addListener(collisionHandler, GameEventType.Collision);

// Dummy target for collision testing
const dummy = new Player(GONDI_STATS);
dummy.entityType = EntityType.Dummy;
dummy.position = { ...ARENA.PLAYER2_SPAWN };
entityManager.add(dummy);
```

**Step 3: Load dummy mesh**

After the main player model loading block, add a second loader call for the dummy. Copy the same pattern as the player mesh loader but use a different variable name (`dummyMesh`) and different color for the fallback placeholder (e.g., `0xff4444` red):

```ts
let dummyMesh: THREE.Object3D | null = null;

loader.load(
  '/models/gondi.glb',
  (gltf) => {
    const container = new THREE.Group();
    const model = gltf.scene;
    model.scale.set(1.8, 1.8, 1.8);
    model.rotation.set(0, 270 * rad, 90 * rad);
    container.add(model);
    scene.add(container);
    dummyMesh = container;
    dummyMesh.position.set(dummy.position.x, dummy.position.y, 0);
  },
  undefined,
  () => {
    console.warn('Could not load gondi.glb for dummy, using placeholder');
    const container = new THREE.Group();
    const geo = new THREE.ConeGeometry(8, 20, 8);
    const mat = new THREE.MeshLambertMaterial({ color: 0xff4444 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.set(0, 270 * rad, 90 * rad);
    container.add(mesh);
    scene.add(container);
    dummyMesh = container;
    dummyMesh.position.set(dummy.position.x, dummy.position.y, 0);
  }
);
```

**Step 4: Add collision check to game loop**

In the game loop callback, after `entityManager.update(dt, camCenter);` and before `updateCamera(...)`, add:

```ts
    // Collision detection
    collisionDetector.checkCollisions(entityManager.entities);
```

**Step 5: Sync dummy mesh and handle death**

In the game loop callback, after the `// Sync bullet sprites and remove dead ones` block, add:

```ts
    // Sync dummy mesh
    if (dummyMesh) {
      if (!dummy.alive) {
        scene.remove(dummyMesh);
        dummyMesh = null;
      } else {
        dummyMesh.position.set(dummy.position.x, dummy.position.y, dummy.position.z);
      }
    }
```

**Step 6: Run all tests**

Run: `npm test`
Expected: PASS — all existing and new tests green

**Step 7: Manual verification**

Run: `npm run dev`

Verify in browser:
1. Player ship visible at left spawn
2. Red/second Gondi dummy visible at right spawn
3. Fire bullets at the dummy — bullets disappear on contact
4. After enough hits (~20 at 0.05 damage each), dummy disappears
5. Bullets pass through your own ship (origin exemption works)

**Step 8: Commit**

```bash
git add src/main.ts
git commit -m "feat(m3): integrate collision detection into game loop with dummy target"
```

---

### Task 9: Run Full Test Suite and Verify

**Files:** None — verification only

**Step 1: Run all tests**

Run: `npm test`
Expected: PASS — all tests green

**Step 2: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Final commit if any fixups needed**

If any test or type fixes were needed, commit them:

```bash
git add -A
git commit -m "fix(m3): test and type fixes for collision detection"
```

---

Plan complete and saved to `docs/plans/2026-02-21-milestone3-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** — Open a new session with executing-plans, batch execution with checkpoints

Which approach?
