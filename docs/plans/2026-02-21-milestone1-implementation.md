# Milestone 1: Single Ship Flight — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A single Gondi ship flying freely in a bounded arena with wrap-around edges.

**Architecture:** Entity system mirroring the original C++ codebase. Entity base class handles position/velocity/wrap-around. Player extends Entity with rotation, thrust, and input-driven movement. EntityManager orchestrates per-frame updates. Three.js renders the scene.

**Tech Stack:** TypeScript, Three.js, Vite, Vitest (testing)

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`

**Step 1: Initialize package.json**

```bash
cd /Users/ori/Documents/CosmoClash/cosmoclash-web
npm init -y
```

**Step 2: Install dependencies**

```bash
npm install three
npm install -D typescript @types/three vite vitest
```

**Step 3: Create tsconfig.json**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

**Step 4: Create vite.config.ts**

Create `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
```

**Step 5: Create index.html**

Create `index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CosmoClash</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #000011; }
    canvas { display: block; }
  </style>
</head>
<body>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

**Step 6: Create placeholder main.ts**

Create `src/main.ts`:
```typescript
console.log('CosmoClash starting...');
```

**Step 7: Add npm scripts to package.json**

Update the `"scripts"` section in `package.json`:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Step 8: Verify dev server starts**

```bash
npx vite --host 2>&1 | head -5
```
Expected: Vite dev server output with local URL.

**Step 9: Verify tests run**

```bash
npx vitest run 2>&1
```
Expected: "No test files found" (or similar clean output — no errors).

**Step 10: Create directory structure**

```bash
mkdir -p src/engine src/game src/input public/models
```

**Step 11: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src/main.ts
git commit -m "feat: project scaffold with Vite, Three.js, TypeScript, Vitest"
```

---

### Task 2: Arena Constants

**Files:**
- Create: `src/game/Arena.ts`
- Test: `src/game/Arena.test.ts`

**Step 1: Write the test**

Create `src/game/Arena.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { ARENA } from './Arena';

describe('Arena constants', () => {
  it('has correct wrap distances', () => {
    expect(ARENA.WRAP_X).toBe(1500);
    expect(ARENA.WRAP_Y).toBe(1050);
  });

  it('has correct camera constants', () => {
    expect(ARENA.CAM_BASE_Z).toBe(-100);
    expect(ARENA.CAM_MAX_Z).toBe(-3500);
    expect(ARENA.CAM_DISTANCE_SCALE).toBe(5);
    expect(ARENA.CAM_MIN_PLAYER_DISTANCE).toBe(50);
  });

  it('has correct star field constants', () => {
    expect(ARENA.NUM_STARS).toBe(500);
    expect(ARENA.STARS_EXTENT).toBe(1800);
    expect(ARENA.STARS_Z).toBe(250);
  });

  it('has correct physics constants', () => {
    expect(ARENA.TIME_SCALER).toBe(0.35);
  });

  it('has correct player 1 spawn position', () => {
    expect(ARENA.PLAYER1_SPAWN).toEqual({ x: -500, y: -70, z: 0 });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/game/Arena.test.ts
```
Expected: FAIL — cannot find module `./Arena`.

**Step 3: Implement Arena.ts**

Create `src/game/Arena.ts`:
```typescript
export const ARENA = {
  // Wrap-around distances from camera center
  WRAP_X: 1500,
  WRAP_Y: 1050,

  // Camera
  CAM_BASE_Z: -100,
  CAM_MAX_Z: -3500,
  CAM_DISTANCE_SCALE: 5,
  CAM_MIN_PLAYER_DISTANCE: 50,

  // Star field
  NUM_STARS: 500,
  STARS_EXTENT: 1800,
  STARS_Z: 250,

  // Physics
  TIME_SCALER: 0.35,

  // Spawn positions
  PLAYER1_SPAWN: { x: -500, y: -70, z: 0 },
  PLAYER2_SPAWN: { x: 500, y: -70, z: 0 },
} as const;
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/game/Arena.test.ts
```
Expected: PASS.

**Step 5: Commit**

```bash
git add src/game/Arena.ts src/game/Arena.test.ts
git commit -m "feat: arena constants matching original C++ values"
```

---

### Task 3: Entity Base Class

**Files:**
- Create: `src/engine/Entity.ts`
- Test: `src/engine/Entity.test.ts`

**Step 1: Write the tests**

Create `src/engine/Entity.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { Entity } from './Entity';

describe('Entity', () => {
  describe('constructor', () => {
    it('initializes with default values', () => {
      const e = new Entity();
      expect(e.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(e.accelVec).toEqual({ x: 0, y: 0, z: 0 });
      expect(e.angle).toBe(0);
      expect(e.alive).toBe(true);
      expect(e.autoWrap).toBe(true);
    });
  });

  describe('update', () => {
    it('applies acceleration to position using time scaler', () => {
      const e = new Entity();
      e.accelVec = { x: 1, y: 0.5, z: 0 };
      e.update(100); // 100ms frame
      // position += accelVec * (dt * 0.35)
      expect(e.position.x).toBeCloseTo(1 * 100 * 0.35);
      expect(e.position.y).toBeCloseTo(0.5 * 100 * 0.35);
      expect(e.position.z).toBe(0);
    });

    it('accumulates position over multiple frames', () => {
      const e = new Entity();
      e.accelVec = { x: 0.5, y: 0, z: 0 };
      e.update(100);
      e.update(100);
      expect(e.position.x).toBeCloseTo(0.5 * 100 * 0.35 * 2);
    });

    it('stores previous position before updating', () => {
      const e = new Entity();
      e.position = { x: 10, y: 20, z: 0 };
      e.accelVec = { x: 1, y: 0, z: 0 };
      e.update(100);
      expect(e.previousPosition).toEqual({ x: 10, y: 20, z: 0 });
    });
  });

  describe('correctAngle', () => {
    it('wraps angle >= 360 back to 0-360 range', () => {
      const e = new Entity();
      e.angle = 370;
      e.correctAngle();
      expect(e.angle).toBe(10);
    });

    it('wraps negative angle to positive', () => {
      const e = new Entity();
      e.angle = -10;
      e.correctAngle();
      expect(e.angle).toBe(350);
    });

    it('leaves valid angle unchanged', () => {
      const e = new Entity();
      e.angle = 180;
      e.correctAngle();
      expect(e.angle).toBe(180);
    });
  });

  describe('handleWrapAround', () => {
    it('wraps entity to opposite side when exceeding +X bound', () => {
      const e = new Entity();
      const camCenter = { x: 0, y: 0, z: -500 };
      e.position = { x: 1600, y: 0, z: 0 };
      e.handleWrapAround(camCenter);
      // delta.X = 1600, overshoot = 1600 - 1500 = 100
      // newX = camCenter.X - 1500 + 100 = -1400
      expect(e.position.x).toBeCloseTo(-1400);
    });

    it('wraps entity to opposite side when exceeding -X bound', () => {
      const e = new Entity();
      const camCenter = { x: 0, y: 0, z: -500 };
      e.position = { x: -1600, y: 0, z: 0 };
      e.handleWrapAround(camCenter);
      // delta.X = -1600, overshoot = -1600 + 1500 = -100
      // newX = camCenter.X + 1500 + (-100) = 1400
      expect(e.position.x).toBeCloseTo(1400);
    });

    it('wraps entity on Y axis', () => {
      const e = new Entity();
      const camCenter = { x: 0, y: 0, z: -500 };
      e.position = { x: 0, y: 1100, z: 0 };
      e.handleWrapAround(camCenter);
      // delta.Y = 1100, overshoot = 1100 - 1050 = 50
      // newY = camCenter.Y - 1050 + 50 = -1000
      expect(e.position.y).toBeCloseTo(-1000);
    });

    it('does not wrap entity within bounds', () => {
      const e = new Entity();
      const camCenter = { x: 0, y: 0, z: -500 };
      e.position = { x: 500, y: 300, z: 0 };
      e.handleWrapAround(camCenter);
      expect(e.position.x).toBe(500);
      expect(e.position.y).toBe(300);
    });

    it('wraps relative to camera center, not origin', () => {
      const e = new Entity();
      const camCenter = { x: 1000, y: 0, z: -500 };
      e.position = { x: 2600, y: 0, z: 0 };
      e.handleWrapAround(camCenter);
      // delta.X = 2600 - 1000 = 1600, overshoot = 1600 - 1500 = 100
      // newX = 1000 - 1500 + 100 = -400
      expect(e.position.x).toBeCloseTo(-400);
    });

    it('skips wrap when autoWrap is false', () => {
      const e = new Entity();
      e.autoWrap = false;
      const camCenter = { x: 0, y: 0, z: -500 };
      e.position = { x: 2000, y: 0, z: 0 };
      e.handleWrapAround(camCenter);
      expect(e.position.x).toBe(2000);
    });
  });

  describe('destroy', () => {
    it('marks entity as not alive', () => {
      const e = new Entity();
      e.destroy();
      expect(e.alive).toBe(false);
    });
  });

  describe('getFullSpeedVec', () => {
    it('returns correct speed vector at angle 0 (pointing up)', () => {
      const e = new Entity();
      e.angle = 0;
      const vec = e.getFullSpeedVec(1.0);
      expect(vec.x).toBeCloseTo(0);
      expect(vec.y).toBeCloseTo(1.0);
    });

    it('returns correct speed vector at angle 90 (pointing left)', () => {
      const e = new Entity();
      e.angle = 90;
      const vec = e.getFullSpeedVec(1.0);
      expect(vec.x).toBeCloseTo(-1.0);
      expect(vec.y).toBeCloseTo(0, 5);
    });

    it('returns correct speed vector at angle 180 (pointing down)', () => {
      const e = new Entity();
      e.angle = 180;
      const vec = e.getFullSpeedVec(1.0);
      expect(vec.x).toBeCloseTo(0, 5);
      expect(vec.y).toBeCloseTo(-1.0);
    });

    it('scales by speedScaler', () => {
      const e = new Entity();
      e.angle = 0;
      const vec = e.getFullSpeedVec(0.5);
      expect(vec.y).toBeCloseTo(0.5);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/engine/Entity.test.ts
```
Expected: FAIL — cannot find module `./Entity`.

**Step 3: Implement Entity.ts**

Create `src/engine/Entity.ts`:
```typescript
import { ARENA } from '@/game/Arena';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export class Entity {
  position: Vec3 = { x: 0, y: 0, z: 0 };
  previousPosition: Vec3 = { x: 0, y: 0, z: 0 };
  accelVec: Vec3 = { x: 0, y: 0, z: 0 };
  angle: number = 0;
  alive: boolean = true;
  autoWrap: boolean = true;

  update(dt: number): void {
    this.previousPosition = { ...this.position };
    const t = dt * ARENA.TIME_SCALER;
    this.position.x += this.accelVec.x * t;
    this.position.y += this.accelVec.y * t;
    this.position.z += this.accelVec.z * t;
  }

  correctAngle(): void {
    if (this.angle >= 360) {
      this.angle = this.angle - 360;
    }
    if (this.angle < 0) {
      this.angle = 360 + this.angle;
    }
  }

  handleWrapAround(camCenter: Vec3): void {
    if (!this.autoWrap) return;

    let wrapped = false;
    const dx = this.position.x - camCenter.x;
    const dy = this.position.y - camCenter.y;

    if (dx > ARENA.WRAP_X) {
      const overshoot = dx - ARENA.WRAP_X;
      this.position.x = camCenter.x - ARENA.WRAP_X + overshoot;
      wrapped = true;
    } else if (dx < -ARENA.WRAP_X) {
      const overshoot = dx + ARENA.WRAP_X;
      this.position.x = camCenter.x + ARENA.WRAP_X + overshoot;
      wrapped = true;
    }

    if (dy > ARENA.WRAP_Y) {
      const overshoot = dy - ARENA.WRAP_Y;
      this.position.y = camCenter.y - ARENA.WRAP_Y + overshoot;
      wrapped = true;
    } else if (dy < -ARENA.WRAP_Y) {
      const overshoot = dy + ARENA.WRAP_Y;
      this.position.y = camCenter.y + ARENA.WRAP_Y + overshoot;
      wrapped = true;
    }
  }

  getFullSpeedVec(speedScaler: number): Vec3 {
    const rad = this.angle * (Math.PI / 180);
    return {
      x: -Math.sin(rad) * speedScaler,
      y: Math.cos(rad) * speedScaler,
      z: 0,
    };
  }

  destroy(): void {
    this.alive = false;
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/engine/Entity.test.ts
```
Expected: All PASS.

**Step 5: Commit**

```bash
git add src/engine/Entity.ts src/engine/Entity.test.ts
git commit -m "feat: Entity base class with position, velocity, wrap-around, angle"
```

---

### Task 4: EntityManager

**Files:**
- Create: `src/engine/EntityManager.ts`
- Test: `src/engine/EntityManager.test.ts`

**Step 1: Write the tests**

Create `src/engine/EntityManager.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { EntityManager } from './EntityManager';
import { Entity } from './Entity';

describe('EntityManager', () => {
  it('adds entities', () => {
    const mgr = new EntityManager();
    const e = new Entity();
    mgr.add(e);
    expect(mgr.entities).toContain(e);
  });

  it('updates all alive entities', () => {
    const mgr = new EntityManager();
    const e1 = new Entity();
    const e2 = new Entity();
    e1.accelVec = { x: 1, y: 0, z: 0 };
    e2.accelVec = { x: 0, y: 1, z: 0 };
    mgr.add(e1);
    mgr.add(e2);

    const camCenter = { x: 0, y: 0, z: -500 };
    mgr.update(100, camCenter);

    expect(e1.position.x).toBeGreaterThan(0);
    expect(e2.position.y).toBeGreaterThan(0);
  });

  it('skips dead entities during update', () => {
    const mgr = new EntityManager();
    const e = new Entity();
    e.accelVec = { x: 1, y: 0, z: 0 };
    e.alive = false;
    mgr.add(e);

    const camCenter = { x: 0, y: 0, z: -500 };
    mgr.update(100, camCenter);

    expect(e.position.x).toBe(0);
  });

  it('calls handleWrapAround on entities', () => {
    const mgr = new EntityManager();
    const e = new Entity();
    e.position = { x: 2000, y: 0, z: 0 };
    mgr.add(e);

    const camCenter = { x: 0, y: 0, z: -500 };
    mgr.update(0, camCenter);

    // Should have been wrapped
    expect(e.position.x).toBeLessThan(0);
  });

  it('removes dead entities', () => {
    const mgr = new EntityManager();
    const e = new Entity();
    mgr.add(e);
    e.alive = false;
    mgr.removeDeadEntities();
    expect(mgr.entities).not.toContain(e);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/engine/EntityManager.test.ts
```
Expected: FAIL — cannot find module.

**Step 3: Implement EntityManager.ts**

Create `src/engine/EntityManager.ts`:
```typescript
import { Entity, Vec3 } from './Entity';

export class EntityManager {
  entities: Entity[] = [];

  add(entity: Entity): void {
    this.entities.push(entity);
  }

  update(dt: number, camCenter: Vec3): void {
    for (const entity of this.entities) {
      if (!entity.alive) continue;
      entity.update(dt);
      entity.handleWrapAround(camCenter);
    }
  }

  removeDeadEntities(): void {
    this.entities = this.entities.filter(e => e.alive);
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/engine/EntityManager.test.ts
```
Expected: All PASS.

**Step 5: Commit**

```bash
git add src/engine/EntityManager.ts src/engine/EntityManager.test.ts
git commit -m "feat: EntityManager with update loop and dead entity cleanup"
```

---

### Task 5: InputManager

**Files:**
- Create: `src/input/InputManager.ts`
- Test: `src/input/InputManager.test.ts`

**Step 1: Write the tests**

Create `src/input/InputManager.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InputManager } from './InputManager';

describe('InputManager', () => {
  let input: InputManager;

  beforeEach(() => {
    input = new InputManager();
  });

  afterEach(() => {
    input.destroy();
  });

  it('reports no keys pressed initially', () => {
    expect(input.isPressed('ArrowUp')).toBe(false);
    expect(input.isPressed('ArrowLeft')).toBe(false);
  });

  it('tracks keydown events', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(input.isPressed('ArrowUp')).toBe(true);
  });

  it('tracks keyup events', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp' }));
    expect(input.isPressed('ArrowUp')).toBe(false);
  });

  it('reports thrust from ArrowUp or w', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    expect(input.thrust).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
    expect(input.thrust).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(input.thrust).toBe(true);
  });

  it('reports rotateLeft from ArrowLeft or a', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(input.rotateLeft).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(input.rotateLeft).toBe(true);
  });

  it('reports rotateRight from ArrowRight or d', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    expect(input.rotateRight).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd' }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(input.rotateRight).toBe(true);
  });

  it('cleans up listeners on destroy', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    input.destroy();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    // After destroy, state should be frozen at last known state
    // but no new events processed — we just check it doesn't throw
    expect(input.isPressed('ArrowLeft')).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/input/InputManager.test.ts
```
Expected: FAIL — cannot find module.

Note: These tests need `jsdom` environment. Update `vite.config.ts` test section:
```typescript
test: {
  globals: true,
  environment: 'jsdom',
},
```
And install: `npm install -D jsdom`

**Step 3: Implement InputManager.ts**

Create `src/input/InputManager.ts`:
```typescript
const THRUST_KEYS = ['ArrowUp', 'w', 'W'];
const ROTATE_LEFT_KEYS = ['ArrowLeft', 'a', 'A'];
const ROTATE_RIGHT_KEYS = ['ArrowRight', 'd', 'D'];
const GAME_KEYS = [...THRUST_KEYS, ...ROTATE_LEFT_KEYS, ...ROTATE_RIGHT_KEYS];

export class InputManager {
  private pressed = new Set<string>();
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;

  constructor() {
    this.onKeyDown = (e: KeyboardEvent) => {
      if (GAME_KEYS.includes(e.key)) {
        e.preventDefault();
      }
      this.pressed.add(e.key);
    };

    this.onKeyUp = (e: KeyboardEvent) => {
      this.pressed.delete(e.key);
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  isPressed(key: string): boolean {
    return this.pressed.has(key);
  }

  get thrust(): boolean {
    return THRUST_KEYS.some(k => this.pressed.has(k));
  }

  get rotateLeft(): boolean {
    return ROTATE_LEFT_KEYS.some(k => this.pressed.has(k));
  }

  get rotateRight(): boolean {
    return ROTATE_RIGHT_KEYS.some(k => this.pressed.has(k));
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.pressed.clear();
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/input/InputManager.test.ts
```
Expected: All PASS.

**Step 5: Commit**

```bash
git add src/input/InputManager.ts src/input/InputManager.test.ts vite.config.ts
git commit -m "feat: InputManager with arrow keys and WASD support"
```

---

### Task 6: Player Class

**Files:**
- Create: `src/game/Player.ts`
- Test: `src/game/Player.test.ts`

**Step 1: Write the tests**

Create `src/game/Player.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { Player, GONDI_STATS } from './Player';

describe('Player', () => {
  describe('Gondi stats', () => {
    it('has correct Gondi parameters', () => {
      expect(GONDI_STATS.speedMaxScaler).toBe(1.2);
      expect(GONDI_STATS.acceleration).toBe(0.004);
      expect(GONDI_STATS.rotationSpeed).toBe(0.5);
    });
  });

  describe('rotation', () => {
    it('increases angle when rotating left', () => {
      const p = new Player(GONDI_STATS);
      p.rotate(1, 100);
      // angle += rotationSpeed * (dt * timeScaler)
      // angle += 0.5 * (100 * 0.35) = 17.5
      expect(p.angle).toBeCloseTo(17.5);
    });

    it('decreases angle when rotating right', () => {
      const p = new Player(GONDI_STATS);
      p.angle = 90;
      p.rotate(-1, 100);
      expect(p.angle).toBeCloseTo(90 - 17.5);
    });

    it('wraps angle after rotation', () => {
      const p = new Player(GONDI_STATS);
      p.angle = 355;
      p.rotate(1, 100);
      // 355 + 17.5 = 372.5 -> wraps to 12.5
      expect(p.angle).toBeCloseTo(12.5);
    });

    it('updates roll angle during rotation', () => {
      const p = new Player(GONDI_STATS);
      p.rotate(1, 100);
      // rollAngle += 0.6 * rotSpeed * (dt * timeScaler)
      // rollAngle += 0.6 * 0.5 * 35 = 10.5
      expect(p.rollAngle).toBeCloseTo(10.5);
    });

    it('clamps roll angle at max', () => {
      const p = new Player(GONDI_STATS);
      // Rotate many times to exceed 70 degree max
      for (let i = 0; i < 20; i++) {
        p.rotate(1, 100);
      }
      expect(p.rollAngle).toBe(70);
    });

    it('decays roll angle when not rotating', () => {
      const p = new Player(GONDI_STATS);
      p.rotate(1, 100); // Build up some roll
      const rollBefore = p.rollAngle;
      p.resetRoll(100); // Decay roll
      expect(p.rollAngle).toBeLessThan(rollBefore);
    });
  });

  describe('thrust', () => {
    it('accelerates toward full speed vector', () => {
      const p = new Player(GONDI_STATS);
      p.angle = 0; // Pointing up: fullSpeed = (0, 1.2, 0)
      p.thrust(100);
      // accelAdd = 0.004 * (100 * 0.35) = 0.14
      // accelVec moves toward (0, 1.2, 0) by up to 0.14 per axis
      expect(p.accelVec.y).toBeCloseTo(0.14);
      expect(p.accelVec.x).toBeCloseTo(0);
    });

    it('does not overshoot target speed', () => {
      const p = new Player(GONDI_STATS);
      p.angle = 0;
      // Thrust many times to reach max speed
      for (let i = 0; i < 100; i++) {
        p.thrust(100);
      }
      expect(p.accelVec.y).toBeCloseTo(1.2, 1);
    });

    it('changes direction when angle changes', () => {
      const p = new Player(GONDI_STATS);
      p.angle = 0;
      p.thrust(100); // Build some upward velocity
      p.angle = 90; // Now pointing left
      p.thrust(100);
      // X should start moving negative (leftward)
      expect(p.accelVec.x).toBeLessThan(0);
    });
  });

  describe('getFullSpeedVec with Gondi scaler', () => {
    it('uses speedMaxScaler for full speed', () => {
      const p = new Player(GONDI_STATS);
      p.angle = 0;
      const vec = p.getFullSpeedVec(GONDI_STATS.speedMaxScaler);
      expect(vec.y).toBeCloseTo(1.2);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/game/Player.test.ts
```
Expected: FAIL — cannot find module.

**Step 3: Implement Player.ts**

Create `src/game/Player.ts`:
```typescript
import { Entity } from '@/engine/Entity';
import { ARENA } from './Arena';

export interface CharacterStats {
  speedMaxScaler: number;
  acceleration: number;
  rotationSpeed: number;
}

export const GONDI_STATS: CharacterStats = {
  speedMaxScaler: 1.2,
  acceleration: 0.004,
  rotationSpeed: 0.5,
};

const ROLL_SCALER = 0.6;
const ROLL_MAX_ANGLE = 70;

export class Player extends Entity {
  readonly stats: CharacterStats;
  rollAngle: number = 0;
  private needRollReset: boolean = false;

  constructor(stats: CharacterStats) {
    super();
    this.stats = stats;
  }

  rotate(direction: 1 | -1, dt: number): void {
    const rotSpeed = this.stats.rotationSpeed;
    const delta = rotSpeed * (dt * ARENA.TIME_SCALER);

    this.angle += direction * delta;
    this.rollAngle += direction * ROLL_SCALER * delta;

    if (this.rollAngle > ROLL_MAX_ANGLE) this.rollAngle = ROLL_MAX_ANGLE;
    if (this.rollAngle < -ROLL_MAX_ANGLE) this.rollAngle = -ROLL_MAX_ANGLE;

    this.needRollReset = true;
    this.correctAngle();
  }

  resetRoll(dt: number): void {
    if (!this.needRollReset) {
      this.rollAngle = 0;
      return;
    }

    const rotSpeed = this.stats.rotationSpeed;
    const delta = ROLL_SCALER * rotSpeed * (dt * ARENA.TIME_SCALER);

    if (this.rollAngle < 0) {
      this.rollAngle += delta;
      if (this.rollAngle >= 0) {
        this.rollAngle = 0;
        this.needRollReset = false;
      }
    } else {
      this.rollAngle -= delta;
      if (this.rollAngle <= 0) {
        this.rollAngle = 0;
        this.needRollReset = false;
      }
    }
  }

  thrust(dt: number): void {
    const accelAdd = this.stats.acceleration * (dt * ARENA.TIME_SCALER);
    const fullSpeed = this.getFullSpeedVec(this.stats.speedMaxScaler);

    // Move accelVec toward fullSpeed without overshooting
    this.accelVec.x = this.moveToward(this.accelVec.x, fullSpeed.x, accelAdd);
    this.accelVec.y = this.moveToward(this.accelVec.y, fullSpeed.y, accelAdd);
  }

  private moveToward(current: number, target: number, maxDelta: number): number {
    const diff = target - current;
    const step = Math.min(Math.abs(diff), maxDelta);
    if (diff > 0) return current + step;
    if (diff < 0) return current - step;
    return current;
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/game/Player.test.ts
```
Expected: All PASS.

**Step 5: Commit**

```bash
git add src/game/Player.ts src/game/Player.test.ts
git commit -m "feat: Player class with Gondi stats, rotation with roll, thrust physics"
```

---

### Task 7: Asset Conversion (Gondi mesh)

**Files:**
- Create: `public/models/gondi.glb` (converted from .x format)

**Step 1: Check if assimp is available**

```bash
which assimp || brew install assimp
```

**Step 2: Convert gondi.x to glTF**

```bash
assimp export /Users/ori/Documents/CosmoClash/turtle_svn/trunk/Turtle/mediaflat/gondi/gondi.x /Users/ori/Documents/CosmoClash/cosmoclash-web/public/models/gondi.glb
```

If assimp fails, try with Blender CLI:
```bash
blender --background --python-expr "
import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.x3d(filepath='/Users/ori/Documents/CosmoClash/turtle_svn/trunk/Turtle/mediaflat/gondi/gondi.x')
bpy.ops.export_scene.gltf(filepath='/Users/ori/Documents/CosmoClash/cosmoclash-web/public/models/gondi.glb')
"
```

If neither works, create a placeholder cone geometry directly in code (see Task 9 fallback).

**Step 3: Verify the file exists**

```bash
ls -la public/models/gondi.glb
```

**Step 4: Commit**

```bash
git add public/models/gondi.glb
git commit -m "feat: convert Gondi mesh from DirectX .x to glTF binary"
```

---

### Task 8: Three.js Scene Setup

**Files:**
- Create: `src/game/Scene.ts`
- Create: `src/game/Camera.ts`

These files depend on Three.js and the browser — they are not unit-testable. Verification is visual via the dev server.

**Step 1: Implement Scene.ts**

Create `src/game/Scene.ts`:
```typescript
import * as THREE from 'three';
import { ARENA } from './Arena';

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000011);

  // Ambient light matching original
  const ambient = new THREE.AmbientLight(0x4d4d4d); // (0.3, 0.3, 0.3)
  scene.add(ambient);

  // Directional light for ship illumination
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(-30, 30, -20);
  scene.add(dirLight);

  return scene;
}

export function createStarField(): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(ARENA.NUM_STARS * 3);
  const extent = ARENA.STARS_EXTENT;

  for (let i = 0; i < ARENA.NUM_STARS; i++) {
    positions[i * 3] = (Math.random() - 0.5) * extent;
    positions[i * 3 + 1] = (Math.random() - 0.5) * extent;
    positions[i * 3 + 2] = (Math.random() - 0.5) * extent;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2,
    sizeAttenuation: true,
  });

  const stars = new THREE.Points(geometry, material);
  stars.position.z = ARENA.STARS_Z;
  return stars;
}

export function createRenderer(): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);
  return renderer;
}
```

**Step 2: Implement Camera.ts**

Create `src/game/Camera.ts`:
```typescript
import * as THREE from 'three';
import { ARENA } from './Arena';

export function createCamera(): THREE.PerspectiveCamera {
  // FOV 0.3 radians = ~17.19 degrees
  const fovDegrees = (0.3 * 180) / Math.PI;
  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(fovDegrees, aspect, 0.1, 100000);

  // Start at a reasonable zoom for single player
  camera.position.set(
    ARENA.PLAYER1_SPAWN.x,
    ARENA.PLAYER1_SPAWN.y,
    ARENA.CAM_BASE_Z - 200 * ARENA.CAM_DISTANCE_SCALE
  );
  camera.lookAt(ARENA.PLAYER1_SPAWN.x, ARENA.PLAYER1_SPAWN.y, 0);

  return camera;
}

export function updateCamera(
  camera: THREE.PerspectiveCamera,
  targetX: number,
  targetY: number,
  dt: number
): void {
  // Smooth camera follow
  const dx = targetX - camera.position.x;
  const dy = targetY - camera.position.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len > 0.01) {
    const speed = len * 0.005 * dt;
    const move = Math.min(speed, len);
    camera.position.x += (dx / len) * move;
    camera.position.y += (dy / len) * move;
  }

  camera.lookAt(camera.position.x, camera.position.y, 0);
}
```

**Step 3: Commit**

```bash
git add src/game/Scene.ts src/game/Camera.ts
git commit -m "feat: Three.js scene with stars, lighting, and smooth camera"
```

---

### Task 9: Game Loop & Main Entry Point

**Files:**
- Create: `src/engine/GameLoop.ts`
- Modify: `src/main.ts`

**Step 1: Implement GameLoop.ts**

Create `src/engine/GameLoop.ts`:
```typescript
export class GameLoop {
  private lastTime: number = 0;
  private running: boolean = false;
  private onUpdate: (dt: number) => void;
  private onRender: () => void;
  private maxDt: number = 100; // Cap at 100ms to prevent spiral-of-death

  constructor(onUpdate: (dt: number) => void, onRender: () => void) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    this.tick(this.lastTime);
  }

  stop(): void {
    this.running = false;
  }

  private tick = (now: number): void => {
    if (!this.running) return;

    let dt = now - this.lastTime;
    this.lastTime = now;

    if (dt > this.maxDt) dt = this.maxDt;

    this.onUpdate(dt);
    this.onRender();

    requestAnimationFrame(this.tick);
  };
}
```

**Step 2: Implement main.ts — wire everything together**

Rewrite `src/main.ts`:
```typescript
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GameLoop } from '@/engine/GameLoop';
import { EntityManager } from '@/engine/EntityManager';
import { Player, GONDI_STATS } from '@/game/Player';
import { ARENA } from '@/game/Arena';
import { InputManager } from '@/input/InputManager';
import { createScene, createStarField, createRenderer } from '@/game/Scene';
import { createCamera, updateCamera } from '@/game/Camera';

// Setup Three.js
const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();
const stars = createStarField();
scene.add(stars);

// Resize handling
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Create player
const player = new Player(GONDI_STATS);
player.position = { ...ARENA.PLAYER1_SPAWN };

// Load Gondi model (with fallback to placeholder)
const loader = new GLTFLoader();
loader.load(
  '/models/gondi.glb',
  (gltf) => {
    const model = gltf.scene;
    model.scale.set(1.8, 1.8, 1.8);
    scene.add(model);
    playerMesh = model;
  },
  undefined,
  () => {
    // Fallback: cone placeholder
    console.warn('Could not load gondi.glb, using placeholder');
    const geo = new THREE.ConeGeometry(8, 20, 8);
    const mat = new THREE.MeshLambertMaterial({ color: 0x00ff88 });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    playerMesh = mesh;
  }
);

let playerMesh: THREE.Object3D | null = null;

// Systems
const entityManager = new EntityManager();
entityManager.add(player);
const input = new InputManager();

// Dev helper: faint arena boundary
const boundaryGeo = new THREE.EdgesGeometry(
  new THREE.PlaneGeometry(ARENA.WRAP_X * 2, ARENA.WRAP_Y * 2)
);
const boundaryMat = new THREE.LineBasicMaterial({ color: 0x333333 });
const boundary = new THREE.LineSegments(boundaryGeo, boundaryMat);
scene.add(boundary);

// Game loop
const gameLoop = new GameLoop(
  (dt: number) => {
    // Process input
    if (input.rotateLeft) {
      player.rotate(1, dt);
    } else if (input.rotateRight) {
      player.rotate(-1, dt);
    } else {
      player.resetRoll(dt);
    }

    if (input.thrust) {
      player.thrust(dt);
    }

    // Update entities
    const camCenter = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    entityManager.update(dt, camCenter);

    // Update camera to follow player
    updateCamera(camera, player.position.x, player.position.y, dt);

    // Sync mesh to player state
    if (playerMesh) {
      playerMesh.position.set(player.position.x, player.position.y, player.position.z);
      // Rotation: (0, rollAngle, angle) in original — Three.js uses radians
      const rad = Math.PI / 180;
      playerMesh.rotation.set(
        -90 * rad, // Base rotation from original model orientation
        player.rollAngle * rad,
        player.angle * rad
      );
    }

    // Move stars with camera
    stars.position.set(camera.position.x, camera.position.y, ARENA.STARS_Z);
  },
  () => {
    renderer.render(scene, camera);
  }
);

gameLoop.start();
```

**Step 3: Verify the dev server runs and shows a ship in the arena**

```bash
npx vite --host
```
Open browser, verify: dark background with stars, ship (or placeholder cone) visible, arrow keys / WASD rotate and thrust, wrap-around works at arena edges.

**Step 4: Run all tests to make sure nothing is broken**

```bash
npx vitest run
```
Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/engine/GameLoop.ts src/main.ts
git commit -m "feat: game loop and main entry point — ship flying in arena"
```

---

### Task 10: Visual Verification & Polish

**No new files.** This task is about running the game and fixing any issues.

**Step 1: Start dev server and test in browser**

```bash
npx vite --host
```

**Step 2: Verify checklist**

- [ ] Ship renders (model or placeholder cone)
- [ ] Arrow keys rotate the ship left/right
- [ ] WASD keys also work for rotation and thrust
- [ ] Ship accelerates smoothly when thrusting
- [ ] Ship decelerates when not thrusting (velocity decay... note: we haven't implemented decay yet!)
- [ ] Ship wraps around arena edges
- [ ] Stars visible in background
- [ ] Camera follows the ship
- [ ] Page doesn't scroll when pressing arrow keys
- [ ] Resize window updates viewport correctly

**Step 3: Add velocity decay (missing from Player)**

The original C++ code doesn't have explicit decay in HandleThrust — the decay comes from the acceleration smoothly approaching the target speed. When not thrusting, the ship keeps its velocity. However for a natural feel, if desired, we can add friction. Check if the original behavior (no decay, ship coasts forever) is acceptable or if explicit decay is needed.

If decay is needed, add to Player.ts:
```typescript
applyDecay(dt: number): void {
  // No thrust — velocity gradually decays
  // This was not explicit in original but may improve feel
}
```

Note: In the original C++, ships coast at their last velocity when not thrusting. The accelVec only changes direction when thrusting. This is the intended behavior — ships drift in space.

**Step 4: Fix any issues found during testing**

Address visual glitches, rotation direction, model orientation, etc.

**Step 5: Final commit**

```bash
git add -A
git commit -m "fix: visual polish and verification for milestone 1"
```

---

## Summary

| Task | What it builds | Dependencies |
|------|---------------|-------------|
| 1 | Project scaffold (Vite + TS + Three.js) | None |
| 2 | Arena constants | Task 1 |
| 3 | Entity base class | Task 2 |
| 4 | EntityManager | Task 3 |
| 5 | InputManager | Task 1 |
| 6 | Player class | Tasks 2, 3 |
| 7 | Asset conversion (Gondi mesh) | Task 1 |
| 8 | Three.js scene + camera | Tasks 1, 2 |
| 9 | Game loop + main.ts (wires everything) | Tasks 3-8 |
| 10 | Visual verification & polish | Task 9 |

Tasks 2-8 can be partially parallelized. Task 9 brings everything together. Task 10 is the final visual check.
