# M9 HUD/UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add on-screen health/energy bars for both players, a win/lose overlay, and round restart.

**Architecture:** HTML/CSS overlay with 40 segmented bars per stat (matching original C++ PlayerPanel). Game state tracked as a simple `'playing' | 'gameOver'` variable in main.ts. HUD module creates and updates DOM elements. EntityPool gets `releaseAll()` for clean restart. Player gets `resetForNewRound()` for state reset.

**Tech Stack:** TypeScript, HTML/CSS (no new dependencies)

---

### Task 1: Add `releaseAll()` to EntityPool

Needed for restart logic — clears all active entities back to the free list in one call.

**Files:**
- Modify: `src/engine/EntityPool.ts:36` (add method after `releaseInactive`)
- Test: `src/engine/EntityPool.test.ts`

**Step 1: Write the failing test**

Add to existing `EntityPool.test.ts`:

```typescript
describe('releaseAll', () => {
  it('moves all active entities to free list', () => {
    const pool = new EntityPool<Entity>(() => new Entity(), () => {}, 5);
    pool.acquire();
    pool.acquire();
    pool.acquire();
    expect(pool.activeCount).toBe(3);
    pool.releaseAll();
    expect(pool.activeCount).toBe(0);
    expect(pool.freeCount).toBe(5); // original 2 free + 3 released
  });

  it('sets alive=false on all released entities', () => {
    const pool = new EntityPool<Entity>(() => new Entity(), () => {}, 3);
    const a = pool.acquire();
    const b = pool.acquire();
    pool.releaseAll();
    expect(a.alive).toBe(false);
    expect(b.alive).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/EntityPool.test.ts`
Expected: FAIL — `pool.releaseAll is not a function`

**Step 3: Write minimal implementation**

Add to `EntityPool.ts` after `releaseInactive()`:

```typescript
releaseAll(): void {
  for (const e of this.active) {
    e.alive = false;
    this.free.push(e);
  }
  this.active.clear();
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/EntityPool.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/EntityPool.ts src/engine/EntityPool.test.ts
git commit -m "feat(m9): add releaseAll() to EntityPool"
```

---

### Task 2: Add `resetForNewRound()` to Player

Encapsulates all state that needs resetting when a round restarts.

**Files:**
- Modify: `src/game/Player.ts` (add method)
- Test: `src/game/Player.test.ts`

**Step 1: Write the failing test**

Add to existing `Player.test.ts`:

```typescript
describe('resetForNewRound', () => {
  it('restores health, energy, and alive status', () => {
    const p = new Player(GONDI_STATS);
    p.health = 0;
    p.energy = 0.3;
    p.alive = false;
    p.resetForNewRound({ x: -500, y: -70, z: 0 });
    expect(p.health).toBe(1);
    expect(p.energy).toBe(1);
    expect(p.alive).toBe(true);
  });

  it('resets position and velocity', () => {
    const p = new Player(GONDI_STATS);
    p.position = { x: 999, y: 999, z: 0 };
    p.accelVec = { x: 1, y: 1, z: 0 };
    p.resetForNewRound({ x: -500, y: -70, z: 0 });
    expect(p.position).toEqual({ x: -500, y: -70, z: 0 });
    expect(p.previousPosition).toEqual({ x: -500, y: -70, z: 0 });
    expect(p.accelVec).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('resets cooldowns, snot count, angle, and roll', () => {
    const p = new Player(GONDI_STATS);
    p.primaryCooldown = 100;
    p.secondaryCooldown = 200;
    p.snotCount = 5;
    p.angle = 180;
    p.rollAngle = 45;
    p.resetForNewRound({ x: 0, y: 0, z: 0 });
    expect(p.primaryCooldown).toBe(0);
    expect(p.secondaryCooldown).toBe(0);
    expect(p.snotCount).toBe(0);
    expect(p.angle).toBe(0);
    expect(p.rollAngle).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/Player.test.ts`
Expected: FAIL — `p.resetForNewRound is not a function`

**Step 3: Write minimal implementation**

Add to `Player` class in `Player.ts`:

```typescript
resetForNewRound(spawnPosition: Vec3): void {
  this.health = 1;
  this.energy = 1;
  this.alive = true;
  this.position = { ...spawnPosition };
  this.previousPosition = { ...spawnPosition };
  this.accelVec = { x: 0, y: 0, z: 0 };
  this.primaryCooldown = 0;
  this.secondaryCooldown = 0;
  this.snotCount = 0;
  this.angle = 0;
  this.rollAngle = 0;
}
```

Import `Vec3` from `@/engine/Entity` in Player.ts (already available — `Entity` is the base class and `Vec3` is defined there).

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/Player.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/game/Player.ts src/game/Player.test.ts
git commit -m "feat(m9): add resetForNewRound() to Player"
```

---

### Task 3: Create HUD segment calculation logic

Pure functions for computing which segments are active and their colors. Testable without DOM.

**Files:**
- Create: `src/ui/HUD.ts`
- Create: `src/ui/HUD.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/ui/HUD.test.ts
import { describe, it, expect } from 'vitest';
import { computeActiveSegments, computeSegmentColor, HEALTH_COLOR_FULL, HEALTH_COLOR_EMPTY, ENERGY_COLOR_FULL, ENERGY_COLOR_EMPTY, SEGMENT_COUNT } from './HUD';

describe('HUD segment calculations', () => {
  describe('computeActiveSegments', () => {
    it('returns 40 for full health (1.0)', () => {
      expect(computeActiveSegments(1.0)).toBe(40);
    });

    it('returns 0 for zero health', () => {
      expect(computeActiveSegments(0)).toBe(0);
    });

    it('returns 20 for half health', () => {
      expect(computeActiveSegments(0.5)).toBe(20);
    });

    it('clamps to 0-40 range', () => {
      expect(computeActiveSegments(-0.1)).toBe(0);
      expect(computeActiveSegments(1.5)).toBe(40);
    });
  });

  describe('computeSegmentColor', () => {
    it('returns full color at index 0', () => {
      const c = computeSegmentColor(0, HEALTH_COLOR_FULL, HEALTH_COLOR_EMPTY);
      expect(c).toEqual(HEALTH_COLOR_FULL);
    });

    it('returns empty color at last index', () => {
      const c = computeSegmentColor(SEGMENT_COUNT - 1, HEALTH_COLOR_FULL, HEALTH_COLOR_EMPTY);
      expect(c).toEqual(HEALTH_COLOR_EMPTY);
    });

    it('interpolates between full and empty', () => {
      const c = computeSegmentColor(20, ENERGY_COLOR_FULL, ENERGY_COLOR_EMPTY);
      // Midpoint between (250,40,0) and (250,200,0) -> (250,120,0)
      expect(c.r).toBe(250);
      expect(c.g).toBeCloseTo(122, 0); // 40 + (200-40) * 20/39 ≈ 122
      expect(c.b).toBe(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/HUD.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/ui/HUD.ts

export const SEGMENT_COUNT = 40;

export interface RGB {
  r: number;
  g: number;
  b: number;
}

// Original C++ colors from PlayerPanel.cpp
export const HEALTH_COLOR_FULL: RGB = { r: 250, g: 50, b: 50 };
export const HEALTH_COLOR_EMPTY: RGB = { r: 120, g: 10, b: 10 };
export const ENERGY_COLOR_FULL: RGB = { r: 250, g: 40, b: 0 };
export const ENERGY_COLOR_EMPTY: RGB = { r: 250, g: 200, b: 0 };
export const SEGMENT_INACTIVE_COLOR: RGB = { r: 40, g: 40, b: 40 };

export function computeActiveSegments(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return Math.round(clamped * SEGMENT_COUNT);
}

export function computeSegmentColor(index: number, full: RGB, empty: RGB): RGB {
  const t = index / (SEGMENT_COUNT - 1);
  return {
    r: Math.round(full.r + (empty.r - full.r) * t),
    g: Math.round(full.g + (empty.g - full.g) * t),
    b: Math.round(full.b + (empty.b - full.b) * t),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/HUD.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/ui/HUD.ts src/ui/HUD.test.ts
git commit -m "feat(m9): add HUD segment calculation logic"
```

---

### Task 4: Create HUD DOM builder and CSS

Build the full HUD class that creates DOM elements and exposes `update()` / `showWinner()` / `hide()`.

**Files:**
- Modify: `src/ui/HUD.ts` (add HUD class)
- Create: `src/ui/hud.css`

**Step 1: Add HUD class to `src/ui/HUD.ts`**

Append to existing file:

```typescript
export class HUD {
  private root: HTMLDivElement;
  private p1HealthSegs: HTMLDivElement[] = [];
  private p1EnergySegs: HTMLDivElement[] = [];
  private p2HealthSegs: HTMLDivElement[] = [];
  private p2EnergySegs: HTMLDivElement[] = [];
  private overlay: HTMLDivElement;
  private winText: HTMLDivElement;
  private restartText: HTMLDivElement;

  // Pre-computed color strings per segment index
  private healthColors: string[] = [];
  private energyColors: string[] = [];

  constructor() {
    // Pre-compute gradient colors
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const hc = computeSegmentColor(i, HEALTH_COLOR_FULL, HEALTH_COLOR_EMPTY);
      this.healthColors[i] = `rgb(${hc.r},${hc.g},${hc.b})`;
      const ec = computeSegmentColor(i, ENERGY_COLOR_FULL, ENERGY_COLOR_EMPTY);
      this.energyColors[i] = `rgb(${ec.r},${ec.g},${ec.b})`;
    }

    this.root = document.createElement('div');
    this.root.id = 'hud';

    // Player panels
    const p1Panel = this.createPanel('left', this.p1HealthSegs, this.p1EnergySegs);
    const p2Panel = this.createPanel('right', this.p2HealthSegs, this.p2EnergySegs);
    this.root.appendChild(p1Panel);
    this.root.appendChild(p2Panel);

    // Win/lose overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'hud-overlay';
    this.overlay.style.display = 'none';

    this.winText = document.createElement('div');
    this.winText.className = 'hud-win-text';
    this.overlay.appendChild(this.winText);

    this.restartText = document.createElement('div');
    this.restartText.className = 'hud-restart-text';
    this.restartText.textContent = 'Press any key to restart';
    this.overlay.appendChild(this.restartText);

    this.root.appendChild(this.overlay);
    document.body.appendChild(this.root);
  }

  private createPanel(
    side: 'left' | 'right',
    healthSegs: HTMLDivElement[],
    energySegs: HTMLDivElement[],
  ): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = `player-panel ${side}`;

    // Health row
    const healthRow = document.createElement('div');
    healthRow.className = 'bar-row';
    const healthIcon = document.createElement('img');
    healthIcon.className = 'bar-icon';
    healthIcon.src = '/textures/heart.png';
    healthIcon.alt = 'Health';
    healthRow.appendChild(healthIcon);
    const healthBar = document.createElement('div');
    healthBar.className = 'bar-container';
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const seg = document.createElement('div');
      seg.className = 'bar-segment';
      healthBar.appendChild(seg);
      healthSegs.push(seg);
    }
    healthRow.appendChild(healthBar);

    // Energy row
    const energyRow = document.createElement('div');
    energyRow.className = 'bar-row';
    const energyIcon = document.createElement('img');
    energyIcon.className = 'bar-icon';
    energyIcon.src = '/textures/power.png';
    energyIcon.alt = 'Energy';
    energyRow.appendChild(energyIcon);
    const energyBar = document.createElement('div');
    energyBar.className = 'bar-container';
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const seg = document.createElement('div');
      seg.className = 'bar-segment';
      energyBar.appendChild(seg);
      energySegs.push(seg);
    }
    energyRow.appendChild(energyBar);

    panel.appendChild(healthRow);
    panel.appendChild(energyRow);
    return panel;
  }

  update(p1Health: number, p1Energy: number, p2Health: number, p2Energy: number): void {
    this.updateBar(this.p1HealthSegs, p1Health, this.healthColors, false);
    this.updateBar(this.p1EnergySegs, p1Energy, this.energyColors, true);
    this.updateBar(this.p2HealthSegs, p2Health, this.healthColors, false);
    this.updateBar(this.p2EnergySegs, p2Energy, this.energyColors, true);
  }

  private updateBar(
    segs: HTMLDivElement[],
    value: number,
    colors: string[],
    useDecay: boolean,
  ): void {
    const active = computeActiveSegments(value);
    const inactiveColor = `rgb(${SEGMENT_INACTIVE_COLOR.r},${SEGMENT_INACTIVE_COLOR.g},${SEGMENT_INACTIVE_COLOR.b})`;
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      if (i < active) {
        segs[i].style.backgroundColor = colors[i];
        if (useDecay) segs[i].classList.remove('decaying');
      } else {
        if (useDecay) {
          segs[i].classList.add('decaying');
        } else {
          segs[i].style.backgroundColor = inactiveColor;
        }
      }
    }
  }

  showWinner(playerNum: 1 | 2): void {
    this.winText.textContent = `Player ${playerNum} Wins!`;
    this.overlay.style.display = 'flex';
  }

  hide(): void {
    this.overlay.style.display = 'none';
  }

  destroy(): void {
    this.root.remove();
  }
}
```

**Step 2: Create CSS file `src/ui/hud.css`**

```css
#hud {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.player-panel {
  position: absolute;
  top: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.player-panel.left {
  left: 16px;
}

.player-panel.right {
  right: 16px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bar-icon {
  width: 20px;
  height: 20px;
  image-rendering: pixelated;
}

.bar-container {
  display: flex;
  gap: 1px;
}

.bar-segment {
  width: 6px;
  height: 14px;
  background-color: rgb(40, 40, 40);
  border-radius: 1px;
}

.bar-segment.decaying {
  transition: background-color 700ms ease-out;
  background-color: rgb(40, 40, 40);
}

/* Win/lose overlay */
.hud-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}

.hud-win-text {
  font-size: 64px;
  font-weight: bold;
  color: #00ffff;
  text-shadow:
    0 0 20px #00ffff,
    0 0 40px #0088ff,
    0 0 80px #0044ff;
  letter-spacing: 4px;
  text-transform: uppercase;
}

.hud-restart-text {
  margin-top: 24px;
  font-size: 20px;
  color: rgba(255, 255, 255, 0.7);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
```

**Step 3: Run all tests to ensure nothing broke**

Run: `npx vitest run`
Expected: all existing tests PASS

**Step 4: Commit**

```bash
git add src/ui/HUD.ts src/ui/hud.css
git commit -m "feat(m9): add HUD DOM builder and CSS styling"
```

---

### Task 5: Copy icon assets

Port `heart.png` and `power.png` from the original C++ assets.

**Files:**
- Copy: `mediaflat/props/heart.png` → `public/textures/heart.png`
- Copy: `mediaflat/props/power.png` → `public/textures/power.png`

**Step 1: Copy assets**

```bash
cp /Users/ori/Documents/CosmoClash/turtle_svn/trunk/Turtle/mediaflat/props/heart.png public/textures/heart.png
cp /Users/ori/Documents/CosmoClash/turtle_svn/trunk/Turtle/mediaflat/props/power.png public/textures/power.png
```

**Step 2: Verify files exist**

```bash
ls -la public/textures/heart.png public/textures/power.png
```

**Step 3: Commit**

```bash
git add public/textures/heart.png public/textures/power.png
git commit -m "feat(m9): add heart and power icon assets from original"
```

---

### Task 6: Integrate HUD into game loop + game state + winner detection

Wire everything together in main.ts: import HUD, add game state, update HUD each frame, detect winner, show overlay.

**Files:**
- Modify: `src/main.ts`

**Step 1: Add imports and game state at top of main.ts**

After existing imports, add:

```typescript
import { HUD } from '@/ui/HUD';
import '@/ui/hud.css';
```

After `const cameraController = new CameraController();` (line 350), add:

```typescript
// HUD overlay
const hud = new HUD();

// Game state
type GameState = 'playing' | 'gameOver';
let gameState: GameState = 'playing';
let winnerNum: 1 | 2 = 1;
let gameOverDelay = 0;
const GAME_OVER_DELAY_MS = 1500; // Delay before showing winner text (let explosion play)
```

**Step 2: Gate input and collision on game state**

In the game loop `onUpdate` callback, wrap the collision + input + combat sections in a `if (gameState === 'playing')` check. The structure becomes:

```typescript
(dt: number) => {
  if (gameState === 'playing') {
    // Collision detection
    const allEntities = [
      ...entityManager.entities,
      ...bulletPool.activeEntities,
      ...snotPool.activeEntities,
      ...asteroidPool.activeEntities,
    ];
    collisionDetector.checkCollisions(allEntities);
    enforceMinimumDistance(player1, player2);

    // Process input for both players
    updatePlayerInput(player1, player2, input.player(0), thrustEffect1, dt);
    updatePlayerInput(player2, player1, input.player(1), thrustEffect2, dt);

    // Update entities
    const camCenter = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    entityManager.update(dt, camCenter);

    // ... (bullet, snot, asteroid updates — keep as-is)

    // Sun gravity
    applySunGravity(player1, ARENA.SUN_POSITION, dt);
    applySunGravity(player2, ARENA.SUN_POSITION, dt);

    // Winner detection
    if (!player1.alive || !player2.alive) {
      gameState = 'gameOver';
      winnerNum = player1.alive ? 1 : 2;
      gameOverDelay = 0;
    }
  } else {
    // gameOver state — still update explosions so death animation finishes
    gameOverDelay += dt;
    if (gameOverDelay >= GAME_OVER_DELAY_MS) {
      hud.showWinner(winnerNum);
    }
  }

  // These always run regardless of state:
  // - Sun animation
  // - Camera update
  // - Mesh sync
  // - Explosion updates + sprite sync
  // - Pool cleanup
  // - Star parallax

  // ... (keep sun animation, camera, mesh sync, all sprite sync, pool cleanup as-is)

  // HUD update every frame
  hud.update(player1.health, player1.energy, player2.health, player2.energy);
},
```

Key: Move explosion update/sync/cleanup OUTSIDE the `if (gameState === 'playing')` block so death explosions still animate during gameOver.

**Step 3: Add restart key handler**

Modify the existing debug keydown handler or add a new one. After the debug key listener (line 378-386):

```typescript
// Restart round on any key during gameOver
window.addEventListener('keydown', (e) => {
  if (gameState !== 'gameOver') return;
  if (gameOverDelay < GAME_OVER_DELAY_MS) return; // Don't allow restart during explosion

  // Reset players
  player1.resetForNewRound({ ...ARENA.PLAYER1_SPAWN });
  player2.resetForNewRound({ ...ARENA.PLAYER2_SPAWN });

  // Clear all pools
  bulletPool.releaseAll();
  snotPool.releaseAll();
  explosionPool.releaseAll();

  // Clear and respawn asteroids
  asteroidPool.releaseAll();
  // Hide all asteroid meshes
  for (const [, mesh] of asteroidMeshMap) {
    mesh.visible = false;
    scene.remove(mesh);
  }
  asteroidMeshMap.clear();
  // Respawn asteroids (reuses existing spawnAsteroids function)
  if (asteroidModelsLoaded === 3) spawnAsteroids();

  // Hide bullet/snot/explosion sprites
  for (const [, sprite] of bulletSpriteMap) {
    sprite.visible = false;
    scene.remove(sprite);
  }
  for (const [, { sprite }] of snotSpriteMap) {
    sprite.visible = false;
    scene.remove(sprite);
  }
  for (const [, sprite] of explosionSpriteMap) {
    sprite.visible = false;
    scene.remove(sprite);
  }

  // Reset game state
  hud.hide();
  gameState = 'playing';
});
```

**Step 4: Also gate the debug kill keys on playing state**

Modify the existing debug handler (line 378-386) to check `gameState === 'playing'`:

```typescript
window.addEventListener('keydown', (e) => {
  if (gameState !== 'playing') return;
  const target = e.key === '1' ? player1 : e.key === '2' ? player2 : null;
  if (target && target.alive) {
    target.health = 0;
    target.destroy();
    GameEventMgr.getInstance().sendEvent(new ExplosionEvent(target));
  }
});
```

**Step 5: Run all tests**

Run: `npx vitest run`
Expected: all tests PASS

**Step 6: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 7: Manual test**

Run: `npm run dev`
- Verify health/energy bars appear for both players
- Press `1` to kill player 1 — verify explosion plays, then "Player 2 Wins!" appears after ~1.5s
- Press any key to restart — verify round resets cleanly
- Verify energy bars show decay animation (fire weapons to drain energy, watch empty segments fade)

**Step 8: Commit**

```bash
git add src/main.ts
git commit -m "feat(m9): integrate HUD, game state, winner detection, and restart"
```

---

### Task 7: Playwright visual test

Verify HUD renders correctly and win/lose flow works.

**Files:**
- Create: `tests/e2e/hud.spec.ts` (or wherever e2e tests live — check existing pattern)

**Step 1: Check existing Playwright setup**

```bash
ls tests/ e2e/ playwright.config.* 2>/dev/null
npx playwright --version
```

If no Playwright setup exists, skip this task and do manual visual verification only. Note for the implementing agent: if there IS a Playwright config, write a test that:

1. Navigates to the dev server
2. Takes a screenshot of the initial HUD state (both bars full)
3. Uses debug key `1` to kill player 1
4. Waits ~2 seconds
5. Takes a screenshot showing "Player 2 Wins!"
6. Presses any key
7. Takes a screenshot showing bars reset to full

**Step 2: Commit if test was created**

```bash
git add tests/
git commit -m "test(m9): add Playwright visual test for HUD"
```

---

### Task 8: Final verification and cleanup

**Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS

**Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors

**Step 3: Manual smoke test**

Run `npm run dev` and verify:
- [ ] Health bars render (red gradient, 40 segments) for both players
- [ ] Energy bars render (orange gradient, 40 segments) for both players
- [ ] Heart and power icons display next to bars
- [ ] P1 bars on left, P2 bars on right
- [ ] Energy drains visually when firing (segments go inactive with fade)
- [ ] Health drains when taking damage
- [ ] Player death triggers explosion → "Player X Wins!" after delay
- [ ] "Press any key to restart" appears below win text
- [ ] Pressing key resets round: players respawn, bars full, asteroids respawn
- [ ] Multiple rounds work (kill, restart, kill again)

**Step 4: Commit any final fixes**

If cleanup is needed, commit with descriptive message.
