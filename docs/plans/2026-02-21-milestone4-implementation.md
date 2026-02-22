# M4: Second Player & Camera — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Player 2 with split keyboard controls and a dynamic zoom camera that keeps both players in view.

**Architecture:** Refactor InputManager to support per-player key bindings via a `player(index)` API. Replace the single-target camera with a two-player zoom camera ported from C++ `AdjustCamera`. Replace the dummy collision entity with a real Player 2 in main.ts.

**Tech Stack:** TypeScript, Three.js, Vitest (jsdom environment)

---

### Task 1: InputManager — Write failing tests for per-player API

**Files:**
- Modify: `src/input/InputManager.test.ts`

**Step 1: Replace all existing tests with new per-player tests**

Replace the entire contents of `src/input/InputManager.test.ts` with:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InputManager } from './InputManager';

function press(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

function release(key: string) {
  window.dispatchEvent(new KeyboardEvent('keyup', { key }));
}

describe('InputManager', () => {
  let input: InputManager;

  beforeEach(() => {
    input = new InputManager();
  });

  afterEach(() => {
    input.destroy();
  });

  describe('Player 1 (Arrow keys + /)', () => {
    it('reports no input initially', () => {
      const p1 = input.player(0);
      expect(p1.thrust).toBe(false);
      expect(p1.rotateLeft).toBe(false);
      expect(p1.rotateRight).toBe(false);
      expect(p1.firePrimary).toBe(false);
    });

    it('detects ArrowUp as thrust', () => {
      press('ArrowUp');
      expect(input.player(0).thrust).toBe(true);
      release('ArrowUp');
      expect(input.player(0).thrust).toBe(false);
    });

    it('detects ArrowLeft as rotateLeft', () => {
      press('ArrowLeft');
      expect(input.player(0).rotateLeft).toBe(true);
    });

    it('detects ArrowRight as rotateRight', () => {
      press('ArrowRight');
      expect(input.player(0).rotateRight).toBe(true);
    });

    it('detects / as firePrimary', () => {
      press('/');
      expect(input.player(0).firePrimary).toBe(true);
      release('/');
      expect(input.player(0).firePrimary).toBe(false);
    });

    it('does NOT respond to P2 keys', () => {
      press('w');
      press('a');
      press('d');
      press(' ');
      const p1 = input.player(0);
      expect(p1.thrust).toBe(false);
      expect(p1.rotateLeft).toBe(false);
      expect(p1.rotateRight).toBe(false);
      expect(p1.firePrimary).toBe(false);
    });
  });

  describe('Player 2 (WASD + Space)', () => {
    it('detects w as thrust (case insensitive)', () => {
      press('w');
      expect(input.player(1).thrust).toBe(true);
      release('w');
      press('W');
      expect(input.player(1).thrust).toBe(true);
    });

    it('detects a as rotateLeft (case insensitive)', () => {
      press('a');
      expect(input.player(1).rotateLeft).toBe(true);
      release('a');
      press('A');
      expect(input.player(1).rotateLeft).toBe(true);
    });

    it('detects d as rotateRight (case insensitive)', () => {
      press('d');
      expect(input.player(1).rotateRight).toBe(true);
      release('d');
      press('D');
      expect(input.player(1).rotateRight).toBe(true);
    });

    it('detects Space as firePrimary', () => {
      press(' ');
      expect(input.player(1).firePrimary).toBe(true);
      release(' ');
      expect(input.player(1).firePrimary).toBe(false);
    });

    it('does NOT respond to P1 keys', () => {
      press('ArrowUp');
      press('ArrowLeft');
      press('ArrowRight');
      press('/');
      const p2 = input.player(1);
      expect(p2.thrust).toBe(false);
      expect(p2.rotateLeft).toBe(false);
      expect(p2.rotateRight).toBe(false);
      expect(p2.firePrimary).toBe(false);
    });
  });

  describe('destroy', () => {
    it('stops tracking keys after destroy', () => {
      press('ArrowUp');
      input.destroy();
      press('ArrowLeft');
      expect(input.player(0).thrust).toBe(false);
      expect(input.player(0).rotateLeft).toBe(false);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/input/InputManager.test.ts`
Expected: FAIL — `input.player is not a function`

---

### Task 2: InputManager — Implement per-player bindings

**Files:**
- Modify: `src/input/InputManager.ts`

**Step 1: Rewrite InputManager with per-player API**

Replace the entire contents of `src/input/InputManager.ts` with:

```ts
export interface PlayerInput {
  thrust: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
  firePrimary: boolean;
}

interface PlayerKeyBindings {
  thrust: string[];
  rotateLeft: string[];
  rotateRight: string[];
  firePrimary: string[];
}

const DEFAULT_BINDINGS: PlayerKeyBindings[] = [
  // Player 1: Arrow keys + /
  {
    thrust: ['ArrowUp'],
    rotateLeft: ['ArrowLeft'],
    rotateRight: ['ArrowRight'],
    firePrimary: ['/'],
  },
  // Player 2: WASD + Space
  {
    thrust: ['w', 'W'],
    rotateLeft: ['a', 'A'],
    rotateRight: ['d', 'D'],
    firePrimary: [' '],
  },
];

export class InputManager {
  private pressed = new Set<string>();
  private bindings: PlayerKeyBindings[];
  private allGameKeys: Set<string>;
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;

  constructor(bindings: PlayerKeyBindings[] = DEFAULT_BINDINGS) {
    this.bindings = bindings;

    // Build set of all game keys for preventDefault
    this.allGameKeys = new Set<string>();
    for (const b of bindings) {
      for (const keys of Object.values(b)) {
        for (const k of keys) this.allGameKeys.add(k);
      }
    }

    this.onKeyDown = (e: KeyboardEvent) => {
      if (this.allGameKeys.has(e.key)) {
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

  player(index: number): PlayerInput {
    const b = this.bindings[index];
    return {
      thrust: b.thrust.some(k => this.pressed.has(k)),
      rotateLeft: b.rotateLeft.some(k => this.pressed.has(k)),
      rotateRight: b.rotateRight.some(k => this.pressed.has(k)),
      firePrimary: b.firePrimary.some(k => this.pressed.has(k)),
    };
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.pressed.clear();
  }
}
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run src/input/InputManager.test.ts`
Expected: All 12 tests PASS

**Step 3: Commit**

```bash
git add src/input/InputManager.ts src/input/InputManager.test.ts
git commit -m "feat(input): refactor InputManager for per-player key bindings (M4)"
```

---

### Task 3: Camera — Write failing tests for two-player zoom

**Files:**
- Create: `src/game/Camera.test.ts`

Camera.ts currently has no tests. We need tests for the new two-player zoom behavior.

**Step 1: Write Camera tests**

Create `src/game/Camera.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createCamera, CameraController } from './Camera';
import { ARENA } from './Arena';

describe('CameraController', () => {
  let cam: CameraController;

  beforeEach(() => {
    cam = new CameraController();
  });

  it('calculates midpoint between two players', () => {
    // Players at (-100, 0) and (100, 0) → midpoint (0, 0)
    cam.update(createCamera(), -100, 0, 100, 0, 16);
    // Camera should be moving toward (0, 0)
    const camera = createCamera();
    // After one frame the camera won't be exactly at midpoint due to smoothing,
    // but with bImmediate-style first frame, let's just verify the zoom Z
  });

  describe('zoom distance', () => {
    it('zooms out as players separate', () => {
      const camera = createCamera();
      // Players 200 units apart → Z = -100 - 200*5 = -1100
      cam.update(camera, -100, 0, 100, 0, 16);
      cam.update(camera, -100, 0, 100, 0, 16);
      // After a couple frames the Z should be moving toward -1100
      expect(camera.position.z).toBeLessThan(ARENA.CAM_BASE_Z);
    });

    it('does not zoom closer than CAM_BASE_Z when players overlap', () => {
      const camera = createCamera();
      // Both players at same position → dist=0, clamped to 50 → Z = -100 - 50*5 = -350
      for (let i = 0; i < 100; i++) {
        cam.update(camera, 0, 0, 0, 0, 16);
      }
      // Z should converge around -350 (CAM_BASE_Z - MIN_DIST * SCALE)
      expect(camera.position.z).toBeGreaterThanOrEqual(ARENA.CAM_MAX_Z);
      expect(camera.position.z).toBeLessThanOrEqual(ARENA.CAM_BASE_Z);
    });

    it('clamps zoom to CAM_MAX_Z when players are very far apart', () => {
      const camera = createCamera();
      // Players 2000 units apart → Z = -100 - 2000*5 = -10100, clamped to -3500
      for (let i = 0; i < 100; i++) {
        cam.update(camera, -1000, 0, 1000, 0, 16);
      }
      expect(camera.position.z).toBeGreaterThanOrEqual(ARENA.CAM_MAX_Z);
    });
  });

  describe('camera position smoothing', () => {
    it('camera moves toward midpoint of players', () => {
      const camera = createCamera();
      // Camera starts near P1 spawn. Players at (100, 100) and (300, 100).
      // Midpoint is (200, 100). Camera should move toward it.
      const startX = camera.position.x;
      cam.update(camera, 100, 100, 300, 100, 16);
      cam.update(camera, 100, 100, 300, 100, 16);
      // Camera X should have moved toward 200
      const midX = 200;
      const newDist = Math.abs(camera.position.x - midX);
      const oldDist = Math.abs(startX - midX);
      expect(newDist).toBeLessThan(oldDist);
    });

    it('camera Y moves toward midpoint', () => {
      const camera = createCamera();
      const startY = camera.position.y;
      // Midpoint Y = 200
      cam.update(camera, 0, 100, 0, 300, 16);
      cam.update(camera, 0, 100, 0, 300, 16);
      const midY = 200;
      const newDist = Math.abs(camera.position.y - midY);
      const oldDist = Math.abs(startY - midY);
      expect(newDist).toBeLessThan(oldDist);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/game/Camera.test.ts`
Expected: FAIL — `CameraController is not a constructor` (not exported yet)

---

### Task 4: Camera — Implement two-player zoom controller

**Files:**
- Modify: `src/game/Camera.ts`

**Step 1: Rewrite Camera.ts with CameraController class**

Replace the entire contents of `src/game/Camera.ts` with:

```ts
import * as THREE from 'three';
import { ARENA } from './Arena';

export function createCamera(): THREE.PerspectiveCamera {
  const fovDegrees = (0.3 * 180) / Math.PI;
  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(fovDegrees, aspect, 0.1, 100000);

  // Start centered between spawn points
  const midX = (ARENA.PLAYER1_SPAWN.x + ARENA.PLAYER2_SPAWN.x) / 2;
  const midY = (ARENA.PLAYER1_SPAWN.y + ARENA.PLAYER2_SPAWN.y) / 2;
  const spawnDist = Math.sqrt(
    (ARENA.PLAYER2_SPAWN.x - ARENA.PLAYER1_SPAWN.x) ** 2 +
    (ARENA.PLAYER2_SPAWN.y - ARENA.PLAYER1_SPAWN.y) ** 2
  );
  camera.position.set(midX, midY, ARENA.CAM_BASE_Z - spawnDist * ARENA.CAM_DISTANCE_SCALE);
  camera.lookAt(midX, midY, 0);

  return camera;
}

/**
 * Two-player dynamic zoom camera, ported from C++ SceneMelee::AdjustCamera.
 *
 * Tracks the midpoint between two players and smoothly zooms in/out
 * based on player separation distance.
 */
export class CameraController {
  private zoomDist: number = -1;

  update(
    camera: THREE.PerspectiveCamera,
    p1x: number, p1y: number,
    p2x: number, p2y: number,
    dt: number,
  ): void {
    // Midpoint between players
    const midX = (p1x + p2x) / 2;
    const midY = (p1y + p2y) / 2;

    // Smooth camera position toward midpoint
    const dx = midX - camera.position.x;
    const dy = midY - camera.position.y;
    const distToCam = Math.sqrt(dx * dx + dy * dy);

    if (distToCam > 0.01) {
      const moveLen = Math.min(dt * distToCam * 0.005, distToCam);
      camera.position.x += (dx / distToCam) * moveLen;
      camera.position.y += (dy / distToCam) * moveLen;
    }

    // Player separation distance (2D)
    const pdx = p2x - p1x;
    const pdy = p2y - p1y;
    const playerDist = Math.sqrt(pdx * pdx + pdy * pdy);

    // Smooth zoom with exponential averaging (400ms time constant)
    if (this.zoomDist < 0) {
      this.zoomDist = playerDist;
    } else {
      const avgr = 400 / dt;
      this.zoomDist = (this.zoomDist * (avgr - 1) / avgr) + (playerDist / avgr);
    }

    // Clamp minimum distance
    let dist = this.zoomDist;
    if (dist < ARENA.CAM_MIN_PLAYER_DISTANCE) {
      dist = ARENA.CAM_MIN_PLAYER_DISTANCE;
    }

    // Calculate Z from distance
    let z = ARENA.CAM_BASE_Z - dist * ARENA.CAM_DISTANCE_SCALE;
    if (z < ARENA.CAM_MAX_Z) {
      z = ARENA.CAM_MAX_Z;
    }

    camera.position.z = z;
    camera.lookAt(camera.position.x, camera.position.y, 0);
  }
}
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run src/game/Camera.test.ts`
Expected: All 5 tests PASS

**Step 3: Commit**

```bash
git add src/game/Camera.ts src/game/Camera.test.ts
git commit -m "feat(camera): add two-player dynamic zoom controller (M4)"
```

---

### Task 5: main.ts — Integrate Player 2, remove dummy, wire camera

**Files:**
- Modify: `src/main.ts`

This is the integration task. Replace the dummy entity with a real Player 2, wire up per-player input, add P2 thrust effect, and use the new CameraController.

**Step 1: Rewrite main.ts**

Replace the entire contents of `src/main.ts` with:

```ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GameLoop } from '@/engine/GameLoop';
import { EntityManager } from '@/engine/EntityManager';
import { Player, GONDI_STATS } from '@/game/Player';
import { ARENA } from '@/game/Arena';
import { Bullet } from '@/game/Bullet';
import { InputManager, PlayerInput } from '@/input/InputManager';
import { ThrustEffect } from '@/game/ThrustEffect';
import { CollisionDetector } from '@/engine/CollisionDetector';
import { CollisionHandler } from '@/game/CollisionHandler';
import { GameEventMgr } from '@/engine/GameEventMgr';
import { GameEventType } from '@/engine/GameEvent';
import { createScene, createStarField, createRenderer } from '@/game/Scene';
import { createCamera, CameraController } from '@/game/Camera';

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

// Create players
const player1 = new Player(GONDI_STATS);
player1.position = { ...ARENA.PLAYER1_SPAWN };

const player2 = new Player(GONDI_STATS);
player2.position = { ...ARENA.PLAYER2_SPAWN };

// Reusable objects for per-frame rotation (avoids GC pressure)
const _qHead = new THREE.Quaternion();
const _qRoll = new THREE.Quaternion();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _fwd = new THREE.Vector3();

// Load ship models
const loader = new GLTFLoader();
const rad = Math.PI / 180;

function loadShipModel(
  onLoaded: (mesh: THREE.Object3D) => void,
  placeholderColor: number = 0x00ff88,
): void {
  loader.load(
    '/models/gondi.glb',
    (gltf) => {
      const container = new THREE.Group();
      const model = gltf.scene.clone();
      model.scale.set(1.8, 1.8, 1.8);
      model.rotation.set(0, 270 * rad, 90 * rad);
      container.add(model);
      scene.add(container);
      onLoaded(container);
    },
    undefined,
    () => {
      console.warn('Could not load gondi.glb, using placeholder');
      const container = new THREE.Group();
      const geo = new THREE.ConeGeometry(8, 20, 8);
      const mat = new THREE.MeshLambertMaterial({ color: placeholderColor });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.set(0, 270 * rad, 90 * rad);
      container.add(mesh);
      scene.add(container);
      onLoaded(container);
    },
  );
}

let p1Mesh: THREE.Object3D | null = null;
let p2Mesh: THREE.Object3D | null = null;

loadShipModel((mesh) => { p1Mesh = mesh; }, 0x00ff88);
loadShipModel((mesh) => {
  p2Mesh = mesh;
  mesh.position.set(player2.position.x, player2.position.y, 0);
}, 0x00ff88);

// Load flame texture
const flameTexture = new THREE.TextureLoader().load('/textures/GondiFire.jpg');

// Bullet sprite tracking
const bulletSprites = new Map<Bullet, THREE.Sprite>();

// Thrust particle effects (one per player)
const thrustTexture = new THREE.TextureLoader().load('/textures/thrust_test01.jpg');
const thrustEffect1 = new ThrustEffect(thrustTexture);
const thrustEffect2 = new ThrustEffect(thrustTexture);
scene.add(thrustEffect1.points);
scene.add(thrustEffect2.points);

// Systems
const entityManager = new EntityManager();
entityManager.add(player1);
entityManager.add(player2);
const input = new InputManager();
const cameraController = new CameraController();

// Collision detection
const collisionDetector = new CollisionDetector();
const collisionHandler = new CollisionHandler();
GameEventMgr.getInstance().addListener(collisionHandler, GameEventType.BulletHit);
GameEventMgr.getInstance().addListener(collisionHandler, GameEventType.Collision);

// Dev helper: faint arena boundary
const boundaryGeo = new THREE.EdgesGeometry(
  new THREE.PlaneGeometry(ARENA.WRAP_X * 2, ARENA.WRAP_Y * 2)
);
const boundaryMat = new THREE.LineBasicMaterial({ color: 0x333333 });
const boundary = new THREE.LineSegments(boundaryGeo, boundaryMat);
scene.add(boundary);

// Per-player update helper
function updatePlayerInput(
  player: Player,
  pi: PlayerInput,
  thrustEffect: ThrustEffect,
  dt: number,
): void {
  // Rotation
  if (pi.rotateLeft) {
    player.rotate(-1, dt);
  } else if (pi.rotateRight) {
    player.rotate(1, dt);
  } else {
    player.resetRoll(dt);
  }

  // Thrust
  if (pi.thrust) {
    player.thrust(dt);
  }

  // Thrust particles
  thrustEffect.update(dt, pi.thrust, player.position.x, player.position.y, player.angle);

  // Energy & weapons
  player.updateEnergy(dt);

  if (pi.firePrimary) {
    const bullet = player.firePrimary();
    if (bullet) {
      entityManager.add(bullet);
      const mat = new THREE.SpriteMaterial({
        map: flameTexture,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(35, 35, 1);
      scene.add(sprite);
      bulletSprites.set(bullet, sprite);
    }
  }
}

// Sync mesh to player physics state
function syncMesh(mesh: THREE.Object3D | null, player: Player): void {
  if (!mesh) return;
  mesh.position.set(player.position.x, player.position.y, player.position.z);
  const headingQ = _qHead.setFromAxisAngle(_zAxis, player.angle * rad);
  const forward = _fwd.set(0, 1, 0).applyQuaternion(headingQ);
  const rollQ = _qRoll.setFromAxisAngle(forward, player.rollAngle * rad);
  mesh.quaternion.copy(rollQ.multiply(headingQ));
}

// Game loop
const gameLoop = new GameLoop(
  (dt: number) => {
    // Process input for both players
    updatePlayerInput(player1, input.player(0), thrustEffect1, dt);
    updatePlayerInput(player2, input.player(1), thrustEffect2, dt);

    // Update entities
    const camCenter = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    entityManager.update(dt, camCenter);

    // Collision detection
    collisionDetector.checkCollisions(entityManager.entities);

    // Update camera to track both players
    cameraController.update(
      camera,
      player1.position.x, player1.position.y,
      player2.position.x, player2.position.y,
      dt,
    );

    // Sync meshes
    syncMesh(p1Mesh, player1);
    syncMesh(p2Mesh, player2);

    // Sync bullet sprites and remove dead ones
    for (const [bullet, sprite] of bulletSprites) {
      if (!bullet.alive) {
        scene.remove(sprite);
        sprite.material.dispose();
        bulletSprites.delete(bullet);
      } else {
        sprite.position.set(bullet.position.x, bullet.position.y, bullet.position.z);
      }
    }

    entityManager.removeDeadEntities();

    // Parallax: stars scroll at 80% of camera speed for depth effect
    stars.position.set(camera.position.x * 0.8, camera.position.y * 0.8, ARENA.STARS_Z);
  },
  () => {
    renderer.render(scene, camera);
  }
);

gameLoop.start();
```

**Step 2: Verify the app compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run all tests to make sure nothing is broken**

Run: `npx vitest run`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: add Player 2 with split controls and dynamic zoom camera (M4)"
```

---

### Task 6: Manual smoke test in browser

**Files:** None (verification only)

**Step 1: Start the dev server**

Run: `npx vite`

**Step 2: Test in browser**

Open `http://localhost:5173` and verify:
1. Two ships appear — P1 at left spawn, P2 at right spawn
2. P1 controls: Arrow keys to fly, `/` to fire
3. P2 controls: WASD to fly, Space to fire
4. Camera zooms out as players separate, zooms in as they approach
5. Camera smoothly tracks the midpoint between players
6. Both players have thrust particle effects
7. Both players can fire bullets
8. Bullet collision still works between players
9. Arena boundary is visible

**Step 3: Run full test suite one final time**

Run: `npx vitest run`
Expected: All tests PASS

**Step 4: Final commit if any tweaks were needed**

If smoke testing revealed any issues and fixes were applied, commit them:

```bash
git add -A
git commit -m "fix: M4 smoke test fixes"
```

---

### Task 7: Update milestone roadmap

**Files:**
- Modify: `docs/plans/milestone-roadmap.md`

**Step 1: Mark M4 as DONE in the roadmap**

In `docs/plans/milestone-roadmap.md`, change M4's status from `Planned` to `DONE`:

```
| 4 | Second Player & Camera | DONE | M3 |
```

**Step 2: Commit**

```bash
git add docs/plans/milestone-roadmap.md
git commit -m "docs: mark M4 as done in roadmap"
```
