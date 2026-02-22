# Thrust Particle System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a thrust exhaust particle effect behind the ship when the player holds the thrust key, matching the original C++ game's particle emitter.

**Architecture:** A `ThrustEffect` class manages a fixed-size `THREE.Points` object with 60 particle slots in a ring buffer. When thrusting, particles spawn 25 units behind the ship and fade out over 200-400ms. Purely visual — no changes to Entity or Player.

**Tech Stack:** Three.js (`THREE.Points`, `THREE.PointsMaterial`, `THREE.BufferGeometry`), TypeScript, Vitest

---

### Task 1: Copy thrust texture asset

**Files:**
- Create: `public/textures/thrust_test01.jpg` (copied from original)

**Step 1: Copy the file**

```bash
cp ../turtle_svn/trunk/Turtle/mediaflat/props/thrust_test01.jpg public/textures/thrust_test01.jpg
```

**Step 2: Verify it exists**

```bash
ls -la public/textures/thrust_test01.jpg
```

Expected: File exists, ~3.8KB

---

### Task 2: Create ThrustEffect class with particle pool

**Files:**
- Create: `src/game/ThrustEffect.ts`
- Create: `src/game/ThrustEffect.test.ts`

The class owns a `THREE.Points` with `BufferGeometry`. It uses parallel typed arrays for particle state: positions (`Float32Array[180]` = 60 * 3), opacities (`Float32Array[60]`), birth ages (`Float32Array[60]`), and lifetimes (`Float32Array[60]`). A `nextIndex` ring-buffer counter cycles through slots.

**Step 1: Write tests for ThrustEffect constructor and constants**

```typescript
// src/game/ThrustEffect.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock THREE since ThrustEffect creates Three.js objects
vi.mock('three', () => {
  const Float32BufferAttribute = vi.fn().mockImplementation((array, itemSize) => ({
    array,
    itemSize,
    needsUpdate: false,
  }));
  const BufferGeometry = vi.fn().mockImplementation(() => ({
    setAttribute: vi.fn(),
    dispose: vi.fn(),
  }));
  const PointsMaterial = vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
  }));
  const Points = vi.fn().mockImplementation(() => ({
    geometry: { dispose: vi.fn() },
    material: { dispose: vi.fn() },
  }));
  return {
    Float32BufferAttribute,
    BufferGeometry,
    PointsMaterial,
    Points,
    AdditiveBlending: 2,
  };
});

import { ThrustEffect, THRUST_CONFIG } from './ThrustEffect';

describe('ThrustEffect', () => {
  describe('THRUST_CONFIG', () => {
    it('has correct values from original game', () => {
      expect(THRUST_CONFIG.POOL_SIZE).toBe(60);
      expect(THRUST_CONFIG.EMIT_RATE).toBe(40);
      expect(THRUST_CONFIG.MIN_LIFETIME).toBe(200);
      expect(THRUST_CONFIG.MAX_LIFETIME).toBe(400);
      expect(THRUST_CONFIG.SPAWN_OFFSET).toBe(25);
      expect(THRUST_CONFIG.SPREAD).toBe(3);
      expect(THRUST_CONFIG.PARTICLE_SIZE).toBe(20);
    });
  });

  describe('constructor', () => {
    it('creates with initial state', () => {
      const effect = new ThrustEffect({} as any);
      expect(effect.points).toBeDefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/ThrustEffect.test.ts`
Expected: FAIL — `ThrustEffect` does not exist

**Step 3: Write ThrustEffect class skeleton with constructor**

```typescript
// src/game/ThrustEffect.ts
import * as THREE from 'three';

export const THRUST_CONFIG = {
  POOL_SIZE: 60,
  EMIT_RATE: 40,        // particles per second
  MIN_LIFETIME: 200,    // ms
  MAX_LIFETIME: 400,    // ms
  SPAWN_OFFSET: 25,     // units behind ship
  SPREAD: 3,            // ±units perpendicular
  PARTICLE_SIZE: 20,
} as const;

export class ThrustEffect {
  readonly points: THREE.Points;
  private positions: Float32Array;
  private opacities: Float32Array;
  private ages: Float32Array;
  private lifetimes: Float32Array;
  private nextIndex = 0;
  private timeSinceLastEmit = 0;
  private geometry: THREE.BufferGeometry;
  private posAttr: THREE.Float32BufferAttribute;
  private opacityAttr: THREE.Float32BufferAttribute;

  constructor(texture: THREE.Texture) {
    const n = THRUST_CONFIG.POOL_SIZE;
    this.positions = new Float32Array(n * 3);
    this.opacities = new Float32Array(n);
    this.ages = new Float32Array(n);
    this.lifetimes = new Float32Array(n);

    // All particles start dead (opacity 0, off-screen)
    for (let i = 0; i < n; i++) {
      this.positions[i * 3] = 0;
      this.positions[i * 3 + 1] = 0;
      this.positions[i * 3 + 2] = -9999;
      this.opacities[i] = 0;
      this.ages[i] = 0;
      this.lifetimes[i] = 0;
    }

    this.geometry = new THREE.BufferGeometry();
    this.posAttr = new THREE.Float32BufferAttribute(this.positions, 3);
    this.opacityAttr = new THREE.Float32BufferAttribute(this.opacities, 1);
    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('opacity', this.opacityAttr);

    const material = new THREE.PointsMaterial({
      map: texture,
      size: THRUST_CONFIG.PARTICLE_SIZE,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      vertexColors: false,
      opacity: 1,
    });

    this.points = new THREE.Points(this.geometry, material);
  }

  update(dt: number, isThrusting: boolean, shipX: number, shipY: number, shipAngle: number): void {
    // Will implement in next task
  }

  dispose(): void {
    this.geometry.dispose();
    (this.points.material as THREE.PointsMaterial).dispose();
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/ThrustEffect.test.ts`
Expected: PASS

---

### Task 3: Implement particle spawning and aging

**Files:**
- Modify: `src/game/ThrustEffect.ts` — fill in `update()` method
- Modify: `src/game/ThrustEffect.test.ts` — add spawn/age tests

**Step 1: Add spawn and aging tests**

Add to the test file's `describe('ThrustEffect')` block:

```typescript
  describe('update', () => {
    let effect: ThrustEffect;

    beforeEach(() => {
      effect = new ThrustEffect({} as any);
    });

    it('does not spawn particles when not thrusting', () => {
      effect.update(50, false, 0, 0, 0);
      // All opacities should remain 0
      for (let i = 0; i < THRUST_CONFIG.POOL_SIZE; i++) {
        expect(effect.getOpacity(i)).toBe(0);
      }
    });

    it('spawns particles when thrusting', () => {
      // 50ms at 40/sec = 2 particles
      effect.update(50, true, 100, 200, 0);
      let alive = 0;
      for (let i = 0; i < THRUST_CONFIG.POOL_SIZE; i++) {
        if (effect.getOpacity(i) > 0) alive++;
      }
      expect(alive).toBe(2);
    });

    it('spawns particles behind ship (angle 0 = heading up, behind = -Y)', () => {
      effect.update(25, true, 100, 200, 0); // 1 particle
      // At angle 0, behind is -Y direction: (100, 200 - 25, 0)
      const pos = effect.getPosition(0);
      expect(pos.y).toBeCloseTo(175, 0);
      expect(pos.x).toBeCloseTo(100, -1); // ±3 spread
    });

    it('spawns particles behind ship at angle 90 (heading left, behind = +X)', () => {
      effect.update(25, true, 100, 200, 90); // 1 particle
      const pos = effect.getPosition(0);
      expect(pos.x).toBeCloseTo(125, 0);
      expect(pos.y).toBeCloseTo(200, -1);
    });

    it('ages particles and fades opacity', () => {
      effect.update(25, true, 0, 0, 0); // spawn 1
      const initialOpacity = effect.getOpacity(0);
      expect(initialOpacity).toBe(1);

      effect.update(150, false, 0, 0, 0); // age by 150ms
      const fadedOpacity = effect.getOpacity(0);
      expect(fadedOpacity).toBeLessThan(1);
      expect(fadedOpacity).toBeGreaterThan(0);
    });

    it('kills particles after lifetime expires', () => {
      effect.update(25, true, 0, 0, 0); // spawn 1
      effect.update(500, false, 0, 0, 0); // well past max lifetime
      expect(effect.getOpacity(0)).toBe(0);
    });

    it('wraps ring buffer index', () => {
      // Spawn more than pool size worth of particles
      for (let i = 0; i < 70; i++) {
        effect.update(25, true, 0, 0, 0); // 1 particle each
      }
      // Should not throw, ring buffer wraps
      expect(true).toBe(true);
    });
  });
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/game/ThrustEffect.test.ts`
Expected: FAIL — `getOpacity` and `getPosition` don't exist, `update` is empty

**Step 3: Implement `update()`, `getOpacity()`, `getPosition()`**

Add these methods to `ThrustEffect`:

```typescript
  // Test helpers
  getOpacity(index: number): number {
    return this.opacities[index];
  }

  getPosition(index: number): { x: number; y: number; z: number } {
    return {
      x: this.positions[index * 3],
      y: this.positions[index * 3 + 1],
      z: this.positions[index * 3 + 2],
    };
  }

  update(dt: number, isThrusting: boolean, shipX: number, shipY: number, shipAngle: number): void {
    const n = THRUST_CONFIG.POOL_SIZE;

    // Age existing particles
    for (let i = 0; i < n; i++) {
      if (this.opacities[i] <= 0) continue;
      this.ages[i] += dt;
      if (this.ages[i] >= this.lifetimes[i]) {
        // Kill particle
        this.opacities[i] = 0;
        this.positions[i * 3 + 2] = -9999;
      } else {
        // Fade linearly
        this.opacities[i] = 1 - this.ages[i] / this.lifetimes[i];
      }
    }

    // Spawn new particles if thrusting
    if (isThrusting) {
      this.timeSinceLastEmit += dt;
      const emitInterval = 1000 / THRUST_CONFIG.EMIT_RATE; // 25ms

      while (this.timeSinceLastEmit >= emitInterval) {
        this.timeSinceLastEmit -= emitInterval;
        this.spawnParticle(shipX, shipY, shipAngle);
      }
    } else {
      this.timeSinceLastEmit = 0;
    }

    // Mark buffers for GPU upload
    this.posAttr.needsUpdate = true;
    this.opacityAttr.needsUpdate = true;
  }

  private spawnParticle(shipX: number, shipY: number, shipAngle: number): void {
    const i = this.nextIndex;
    this.nextIndex = (this.nextIndex + 1) % THRUST_CONFIG.POOL_SIZE;

    const rad = shipAngle * (Math.PI / 180);
    // "Behind" is the opposite of the heading direction
    // Heading = (-sin(a), cos(a)), so behind = (sin(a), -cos(a))
    const behindX = Math.sin(rad) * THRUST_CONFIG.SPAWN_OFFSET;
    const behindY = -Math.cos(rad) * THRUST_CONFIG.SPAWN_OFFSET;

    // Perpendicular direction for spread: (cos(a), sin(a))
    const perpX = Math.cos(rad);
    const perpY = Math.sin(rad);
    const spread = (Math.random() - 0.5) * 2 * THRUST_CONFIG.SPREAD;

    this.positions[i * 3] = shipX + behindX + perpX * spread;
    this.positions[i * 3 + 1] = shipY + behindY + perpY * spread;
    this.positions[i * 3 + 2] = 0;
    this.opacities[i] = 1;
    this.ages[i] = 0;
    this.lifetimes[i] = THRUST_CONFIG.MIN_LIFETIME +
      Math.random() * (THRUST_CONFIG.MAX_LIFETIME - THRUST_CONFIG.MIN_LIFETIME);
  }
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/game/ThrustEffect.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (72 existing + new ThrustEffect tests)

---

### Task 4: Custom shader for per-particle opacity

**Files:**
- Modify: `src/game/ThrustEffect.ts` — replace `PointsMaterial` with `ShaderMaterial`

`THREE.PointsMaterial` doesn't support per-vertex opacity out of the box. We need a minimal custom `ShaderMaterial` that reads the `opacity` attribute per vertex.

**Step 1: Add shader test**

Add to `ThrustEffect.test.ts`:

```typescript
  describe('per-particle opacity', () => {
    it('newly spawned particle has opacity 1', () => {
      const effect = new ThrustEffect({} as any);
      effect.update(25, true, 0, 0, 0);
      expect(effect.getOpacity(0)).toBe(1);
    });

    it('half-life particle has opacity ~0.5', () => {
      const effect = new ThrustEffect({} as any);
      effect.update(25, true, 0, 0, 0);
      const lifetime = effect.getLifetime(0);
      effect.update(lifetime / 2, false, 0, 0, 0);
      expect(effect.getOpacity(0)).toBeCloseTo(0.5, 1);
    });
  });
```

**Step 2: Add `getLifetime()` helper and replace material**

Add to `ThrustEffect`:

```typescript
  getLifetime(index: number): number {
    return this.lifetimes[index];
  }
```

Replace the `PointsMaterial` in the constructor with:

```typescript
    const material = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: texture },
        pointSize: { value: THRUST_CONFIG.PARTICLE_SIZE },
      },
      vertexShader: `
        attribute float opacity;
        varying float vOpacity;
        uniform float pointSize;
        void main() {
          vOpacity = opacity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = pointSize * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        varying float vOpacity;
        void main() {
          vec4 texColor = texture2D(map, gl_PointCoord);
          gl_FragColor = vec4(texColor.rgb, texColor.a * vOpacity);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
```

Update `dispose()` to handle `ShaderMaterial`:

```typescript
  dispose(): void {
    this.geometry.dispose();
    (this.points.material as THREE.ShaderMaterial).dispose();
  }
```

**Step 3: Run tests**

Run: `npx vitest run src/game/ThrustEffect.test.ts`
Expected: PASS

**Step 4: Also update the THREE mock** if needed — the mock should include `ShaderMaterial`:

Add to the `vi.mock('three')` block:

```typescript
  const ShaderMaterial = vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
  }));
```

And export it from the mock.

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All pass

---

### Task 5: Wire up ThrustEffect in main.ts

**Files:**
- Modify: `src/main.ts`

**Step 1: Add import and create ThrustEffect**

After the flame texture loading block (line 69), add:

```typescript
import { ThrustEffect } from '@/game/ThrustEffect';
```

(Add with other imports at top of file)

After the `bulletSprites` line (line 72), add:

```typescript
// Thrust particle effect
const thrustTexture = new THREE.TextureLoader().load('/textures/thrust_test01.jpg');
const thrustEffect = new ThrustEffect(thrustTexture);
scene.add(thrustEffect.points);
```

**Step 2: Call update in game loop**

After the thrust input block (after line 101 `player.thrust(dt);` closing brace), add:

```typescript
    // Update thrust particles
    thrustEffect.update(dt, input.thrust, player.position.x, player.position.y, player.angle);
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All pass

**Step 5: Visual verification**

Run: `npx vite`

Open http://localhost:5173/. Hold W/ArrowUp — white particles should trail behind the ship and fade out. Release thrust — particles stop spawning, existing ones fade naturally. Rotate while thrusting — particles spawn behind the new heading direction.

---

## Verification Summary

1. `npx vitest run` — all tests pass
2. `npx tsc --noEmit` — no type errors
3. Visual: thrust particles appear behind ship when holding W, fade out over ~300ms, stop spawning when released
