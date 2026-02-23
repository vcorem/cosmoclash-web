# Selection Screen Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a character selection screen where players sequentially choose ships before entering the melee arena.

**Architecture:** New `CharacterRegistry` defines available characters. `SelectionScene` manages a 3D preview scene with star field and animated ship models. `SelectionUI` provides an HTML/CSS overlay for the info panel. main.ts gains a scene state machine (`'selection' | 'playing' | 'gameOver'`) that gates the game loop.

**Tech Stack:** Three.js (3D scene), HTML/CSS overlay (info panel), TypeScript, Vitest

---

### Task 1: CharacterRegistry — Character Definition Data

**Files:**
- Create: `src/game/CharacterRegistry.ts`
- Test: `src/game/CharacterRegistry.test.ts`

**Step 1: Write the failing test**

```typescript
// src/game/CharacterRegistry.test.ts
import { describe, it, expect } from 'vitest';
import { CHARACTER_REGISTRY, CharacterDef } from './CharacterRegistry';

describe('CharacterRegistry', () => {
  it('contains MichiGichi and Gondi', () => {
    const ids = CHARACTER_REGISTRY.map(c => c.id);
    expect(ids).toContain('michiGichi');
    expect(ids).toContain('gondi');
  });

  it('each entry has required fields', () => {
    for (const char of CHARACTER_REGISTRY) {
      expect(char.id).toBeTruthy();
      expect(char.name).toBeTruthy();
      expect(char.weapon).toBeTruthy();
      expect(char.special).toBeTruthy();
      expect(char.modelPath).toMatch(/\.glb$/);
      expect(char.modelScale).toBeGreaterThan(0);
    }
  });

  it('MichiGichi has correct weapon/special', () => {
    const michi = CHARACTER_REGISTRY.find(c => c.id === 'michiGichi')!;
    expect(michi.weapon).toBe('Plasma Blast');
    expect(michi.special).toBe('Transform between fast and weak / slow and strong');
  });

  it('Gondi has correct weapon/special', () => {
    const gondi = CHARACTER_REGISTRY.find(c => c.id === 'gondi')!;
    expect(gondi.weapon).toBe('Galactic Flame');
    expect(gondi.special).toBe('Space Slime');
  });

  it('has exactly 2 characters', () => {
    expect(CHARACTER_REGISTRY).toHaveLength(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/CharacterRegistry.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/game/CharacterRegistry.ts
export interface CharacterDef {
  id: string;
  name: string;
  weapon: string;
  special: string;
  modelPath: string;
  modelScale: number;
  modelRotation: [number, number, number]; // Euler angles in degrees
  isMichiGichi: boolean; // needs special MichiGichiPlayer + AnimationMixer
}

export const CHARACTER_REGISTRY: CharacterDef[] = [
  {
    id: 'michiGichi',
    name: 'MichiGichi',
    weapon: 'Plasma Blast',
    special: 'Transform between fast and weak / slow and strong',
    modelPath: '/models/michiGichi.glb',
    modelScale: 2.0,
    modelRotation: [-90, 180, 0],
    isMichiGichi: true,
  },
  {
    id: 'gondi',
    name: 'Gondi',
    weapon: 'Galactic Flame',
    special: 'Space Slime',
    modelPath: '/models/gondi.glb',
    modelScale: 1.8,
    modelRotation: [0, 270, 90],
    isMichiGichi: false,
  },
];
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/CharacterRegistry.test.ts`
Expected: PASS — all 5 tests green

**Step 5: Commit**

```bash
git add src/game/CharacterRegistry.ts src/game/CharacterRegistry.test.ts
git commit -m "feat(selection): add CharacterRegistry with MichiGichi and Gondi definitions"
```

---

### Task 2: SelectionUI — HTML/CSS Info Panel

**Files:**
- Create: `src/ui/SelectionUI.ts`
- Create: `src/ui/selection.css`
- Test: `src/ui/SelectionUI.test.ts`

**Step 1: Write the failing test**

```typescript
// src/ui/SelectionUI.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SelectionUI } from './SelectionUI';

describe('SelectionUI', () => {
  let ui: SelectionUI;

  beforeEach(() => {
    ui = new SelectionUI();
  });

  afterEach(() => {
    ui.destroy();
  });

  it('creates root element in DOM', () => {
    expect(document.getElementById('selection-ui')).not.toBeNull();
  });

  it('displays player number in header', () => {
    ui.show(2, { id: 'gondi', name: 'Gondi', weapon: 'Galactic Flame', special: 'Space Slime', modelPath: '/models/gondi.glb', modelScale: 1.8, modelRotation: [0, 270, 90], isMichiGichi: false });
    const header = document.querySelector('.selection-header');
    expect(header?.textContent).toContain('Player 2');
  });

  it('displays character info', () => {
    ui.show(1, { id: 'michiGichi', name: 'MichiGichi', weapon: 'Plasma Blast', special: 'Transform between fast and weak / slow and strong', modelPath: '/models/michiGichi.glb', modelScale: 2.0, modelRotation: [-90, 180, 0], isMichiGichi: true });
    const name = document.querySelector('.selection-ship-name');
    const weapon = document.querySelector('.selection-weapon');
    const special = document.querySelector('.selection-special');
    expect(name?.textContent).toContain('MichiGichi');
    expect(weapon?.textContent).toContain('Plasma Blast');
    expect(special?.textContent).toContain('Transform');
  });

  it('hide removes visibility', () => {
    ui.show(1, { id: 'gondi', name: 'Gondi', weapon: 'Galactic Flame', special: 'Space Slime', modelPath: '/models/gondi.glb', modelScale: 1.8, modelRotation: [0, 270, 90], isMichiGichi: false });
    ui.hide();
    const root = document.getElementById('selection-ui');
    expect(root?.style.display).toBe('none');
  });

  it('destroy removes element from DOM', () => {
    ui.destroy();
    expect(document.getElementById('selection-ui')).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/SelectionUI.test.ts`
Expected: FAIL — module not found

**Step 3: Write the CSS**

```css
/* src/ui/selection.css */
#selection-ui {
  position: fixed;
  top: 30px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  pointer-events: none;
  font-family: 'Segoe UI', Tahoma, sans-serif;
  text-align: center;
  color: #fff;
}

.selection-header {
  font-size: 22px;
  margin-bottom: 12px;
  text-shadow: 0 0 8px rgba(100, 150, 255, 0.8);
  letter-spacing: 2px;
  text-transform: uppercase;
}

.selection-info-panel {
  background: rgba(0, 0, 20, 0.75);
  border: 1px solid rgba(100, 150, 255, 0.4);
  border-radius: 8px;
  padding: 14px 28px;
  min-width: 320px;
}

.selection-ship-name {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 8px;
  text-shadow: 0 0 10px rgba(100, 200, 255, 0.6);
}

.selection-row {
  font-size: 15px;
  margin: 4px 0;
  color: #bbc;
}

.selection-row .label {
  color: #88a;
  margin-right: 6px;
}

.selection-controls {
  font-size: 13px;
  margin-top: 14px;
  color: #667;
}
```

**Step 4: Write minimal implementation**

```typescript
// src/ui/SelectionUI.ts
import { CharacterDef } from '@/game/CharacterRegistry';
import './selection.css';

export class SelectionUI {
  private root: HTMLDivElement;
  private header: HTMLDivElement;
  private nameEl: HTMLDivElement;
  private weaponEl: HTMLDivElement;
  private specialEl: HTMLDivElement;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'selection-ui';
    this.root.style.display = 'none';

    this.header = document.createElement('div');
    this.header.className = 'selection-header';

    const panel = document.createElement('div');
    panel.className = 'selection-info-panel';

    this.nameEl = document.createElement('div');
    this.nameEl.className = 'selection-ship-name';

    this.weaponEl = document.createElement('div');
    this.weaponEl.className = 'selection-row selection-weapon';

    this.specialEl = document.createElement('div');
    this.specialEl.className = 'selection-row selection-special';

    const controls = document.createElement('div');
    controls.className = 'selection-controls';
    controls.textContent = '\u2190 \u2192 Browse  |  Enter to Select';

    panel.appendChild(this.nameEl);
    panel.appendChild(this.weaponEl);
    panel.appendChild(this.specialEl);
    panel.appendChild(controls);

    this.root.appendChild(this.header);
    this.root.appendChild(panel);
    document.body.appendChild(this.root);
  }

  show(playerNum: number, character: CharacterDef): void {
    this.header.textContent = `Player ${playerNum} \u2014 Choose Your Ship`;
    this.nameEl.textContent = character.name;
    this.weaponEl.innerHTML = `<span class="label">Weapon:</span>${character.weapon}`;
    this.specialEl.innerHTML = `<span class="label">Special:</span>${character.special}`;
    this.root.style.display = '';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  destroy(): void {
    this.root.remove();
  }
}
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run src/ui/SelectionUI.test.ts`
Expected: PASS — all 5 tests green

**Step 6: Commit**

```bash
git add src/ui/SelectionUI.ts src/ui/selection.css src/ui/SelectionUI.test.ts
git commit -m "feat(selection): add SelectionUI overlay with ship info panel"
```

---

### Task 3: SelectionScene — 3D Scene with Ship Models and Animation

**Files:**
- Create: `src/game/SelectionScene.ts`
- Test: `src/game/SelectionScene.test.ts`

This is the core 3D scene for the selection screen. It manages loading character models, positioning them, animating the selected ship (bob + rotation), moving the camera, and the star field.

**Step 1: Write the failing test**

```typescript
// src/game/SelectionScene.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Three.js — SelectionScene uses Three.js extensively, so we test the state machine logic
// by mocking the renderer/scene and testing the public API
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  return {
    ...actual,
  };
});

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: vi.fn().mockImplementation(() => ({
    load: vi.fn((_url: string, onLoad: (gltf: any) => void) => {
      // Simulate immediate load with a minimal scene
      const scene = { clone: () => ({ scale: { set: vi.fn() }, rotation: { set: vi.fn() }, traverse: vi.fn() }), scale: { set: vi.fn() }, rotation: { set: vi.fn() }, traverse: vi.fn() };
      onLoad({ scene, animations: [] });
    }),
  })),
}));

import { SelectionScene, SelectionState } from './SelectionScene';
import { CHARACTER_REGISTRY } from './CharacterRegistry';

describe('SelectionScene', () => {
  it('starts in SELECTING_P2 state', () => {
    const sel = new SelectionScene();
    expect(sel.state).toBe(SelectionState.SELECTING_P2);
  });

  it('initially selects index 0', () => {
    const sel = new SelectionScene();
    expect(sel.currentIndex).toBe(0);
  });

  it('cycles selection right', () => {
    const sel = new SelectionScene();
    sel.selectNext();
    expect(sel.currentIndex).toBe(1 % CHARACTER_REGISTRY.length);
  });

  it('cycles selection left', () => {
    const sel = new SelectionScene();
    sel.selectPrev();
    expect(sel.currentIndex).toBe(CHARACTER_REGISTRY.length - 1);
  });

  it('wraps around at boundaries', () => {
    const sel = new SelectionScene();
    // At index 0, go left should wrap to last
    sel.selectPrev();
    expect(sel.currentIndex).toBe(CHARACTER_REGISTRY.length - 1);
    // Go right should wrap back to 0
    sel.selectNext();
    expect(sel.currentIndex).toBe(0);
  });

  it('confirmSelection advances from P2 to P1', () => {
    const sel = new SelectionScene();
    expect(sel.state).toBe(SelectionState.SELECTING_P2);
    sel.confirmSelection();
    expect(sel.state).toBe(SelectionState.SELECTING_P1);
    expect(sel.p2CharIndex).toBe(0);
  });

  it('confirmSelection from P1 advances to DONE', () => {
    const sel = new SelectionScene();
    sel.confirmSelection(); // P2 done
    sel.selectNext();
    sel.confirmSelection(); // P1 done
    expect(sel.state).toBe(SelectionState.DONE);
    expect(sel.p1CharIndex).toBeDefined();
  });

  it('returns selected character defs', () => {
    const sel = new SelectionScene();
    sel.confirmSelection(); // P2 picks index 0
    sel.selectNext();       // P1 moves to index 1
    sel.confirmSelection(); // P1 picks index 1
    const { p1Def, p2Def } = sel.getSelections();
    expect(p1Def.id).toBe(CHARACTER_REGISTRY[1].id);
    expect(p2Def.id).toBe(CHARACTER_REGISTRY[0].id);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/SelectionScene.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// src/game/SelectionScene.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CHARACTER_REGISTRY, CharacterDef } from './CharacterRegistry';

export enum SelectionState {
  SELECTING_P2 = 'selectingP2',
  SELECTING_P1 = 'selectingP1',
  DONE = 'done',
}

const SHIP_SPACING = 300;
const SHIP_FRONT_Z = -400;
const SHIP_BACK_Z = 400;
const FLY_DURATION = 400; // ms
const CAM_Z = -700;
const CAM_FOV = (0.3 * 180) / Math.PI; // match original
const BOB_SPEED = 0.1; // wave speed multiplier
const rad = Math.PI / 180;

export class SelectionScene {
  state: SelectionState = SelectionState.SELECTING_P2;
  currentIndex: number = 0;
  p2CharIndex: number = 0;
  p1CharIndex: number = 0;

  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  private stars: THREE.Points;
  private shipGroups: THREE.Group[] = [];
  private loader = new GLTFLoader();
  private waveTime: number = 0;

  // Fly animation state
  private flyAnims: { group: THREE.Group; startZ: number; endZ: number; elapsed: number }[] = [];
  private camFly: { startX: number; endX: number; elapsed: number } | null = null;

  constructor() {
    // Create a dedicated scene for selection
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000011);

    const ambient = new THREE.AmbientLight(0x999999);
    this.scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(-30, 30, -20);
    this.scene.add(dirLight);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      CAM_FOV,
      window.innerWidth / window.innerHeight,
      0.1,
      100000,
    );
    this.camera.position.set(0, 0, CAM_Z);
    this.camera.lookAt(0, 0, 0);

    // Star field (reuse the pattern from Scene.ts but with selection-specific params)
    this.stars = this.createStarField();
    this.scene.add(this.stars);

    // Load all character models
    this.loadModels();
  }

  private createStarField(): THREE.Points {
    const count = 3000;
    const extent = 7000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * extent;
      positions[i * 3 + 1] = (Math.random() - 0.5) * extent;
      positions[i * 3 + 2] = 0;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0x8888ff,
      size: 2,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const stars = new THREE.Points(geometry, material);
    stars.position.z = 3500;
    stars.renderOrder = -1;
    return stars;
  }

  private loadModels(): void {
    CHARACTER_REGISTRY.forEach((charDef, i) => {
      const xPos = this.getShipX(i);
      const container = new THREE.Group();
      container.position.set(xPos, 0, i === 0 ? SHIP_FRONT_Z : SHIP_BACK_Z);
      this.scene.add(container);
      this.shipGroups[i] = container;

      this.loader.load(
        charDef.modelPath,
        (gltf) => {
          const model = gltf.scene.clone();
          model.scale.set(charDef.modelScale, charDef.modelScale, charDef.modelScale);
          model.rotation.set(
            charDef.modelRotation[0] * rad,
            charDef.modelRotation[1] * rad,
            charDef.modelRotation[2] * rad,
          );
          // Fix PBR emissive from Irrlicht conversion
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
              if (mat.emissive) mat.emissive.set(0, 0, 0);
            }
          });
          container.add(model);
        },
        undefined,
        () => {
          // Placeholder cone on load failure
          const geo = new THREE.ConeGeometry(8, 20, 8);
          const mat = new THREE.MeshLambertMaterial({ color: 0x00ff88 });
          const mesh = new THREE.Mesh(geo, mat);
          container.add(mesh);
        },
      );
    });
  }

  private getShipX(index: number): number {
    const totalWidth = (CHARACTER_REGISTRY.length - 1) * SHIP_SPACING;
    return -totalWidth / 2 + index * SHIP_SPACING;
  }

  selectNext(): void {
    if (this.state === SelectionState.DONE) return;
    this.currentIndex = (this.currentIndex + 1) % CHARACTER_REGISTRY.length;
    this.triggerFlyAnimation();
  }

  selectPrev(): void {
    if (this.state === SelectionState.DONE) return;
    this.currentIndex = (this.currentIndex - 1 + CHARACTER_REGISTRY.length) % CHARACTER_REGISTRY.length;
    this.triggerFlyAnimation();
  }

  confirmSelection(): void {
    if (this.state === SelectionState.SELECTING_P2) {
      this.p2CharIndex = this.currentIndex;
      this.state = SelectionState.SELECTING_P1;
      this.currentIndex = 0;
      this.triggerFlyAnimation();
    } else if (this.state === SelectionState.SELECTING_P1) {
      this.p1CharIndex = this.currentIndex;
      this.state = SelectionState.DONE;
    }
  }

  getSelections(): { p1Def: CharacterDef; p2Def: CharacterDef } {
    return {
      p1Def: CHARACTER_REGISTRY[this.p1CharIndex],
      p2Def: CHARACTER_REGISTRY[this.p2CharIndex],
    };
  }

  getCurrentCharacter(): CharacterDef {
    return CHARACTER_REGISTRY[this.currentIndex];
  }

  private triggerFlyAnimation(): void {
    this.flyAnims = [];
    for (let i = 0; i < this.shipGroups.length; i++) {
      const group = this.shipGroups[i];
      if (!group) continue;
      const endZ = i === this.currentIndex ? SHIP_FRONT_Z : SHIP_BACK_Z;
      this.flyAnims.push({
        group,
        startZ: group.position.z,
        endZ,
        elapsed: 0,
      });
    }
    // Camera follows selected ship on X
    const targetX = this.getShipX(this.currentIndex);
    this.camFly = {
      startX: this.camera.position.x,
      endX: targetX,
      elapsed: 0,
    };
  }

  update(dt: number): void {
    if (this.state === SelectionState.DONE) return;

    this.waveTime += BOB_SPEED * dt;

    // Fly animations
    for (const anim of this.flyAnims) {
      anim.elapsed += dt;
      const t = Math.min(anim.elapsed / FLY_DURATION, 1);
      anim.group.position.z = anim.startZ + (anim.endZ - anim.startZ) * t;
    }
    if (this.flyAnims.length > 0 && this.flyAnims[0].elapsed >= FLY_DURATION) {
      this.flyAnims = [];
    }

    // Camera fly
    if (this.camFly) {
      this.camFly.elapsed += dt;
      const t = Math.min(this.camFly.elapsed / FLY_DURATION, 1);
      this.camera.position.x = this.camFly.startX + (this.camFly.endX - this.camFly.startX) * t;
      this.camera.lookAt(this.camera.position.x, 0, 0);
      if (t >= 1) this.camFly = null;
    }

    // Selected ship bob/rotate animation (matches C++ sine wave pattern)
    const selGroup = this.shipGroups[this.currentIndex];
    if (selGroup && this.flyAnims.length === 0) {
      const baseX = this.getShipX(this.currentIndex);
      const wave = Math.sin((this.waveTime * Math.PI) / 180);
      selGroup.position.x = baseX + wave * 0.03;
      selGroup.position.z = SHIP_FRONT_Z + wave * 0.1;
      selGroup.rotation.set(0, 20 * wave * rad, 0);
    }

    // Star field scrolling
    this.stars.position.x = this.camera.position.x;
    this.stars.position.y += 5 * (dt / 1000); // slow vertical scroll
  }

  dispose(): void {
    // Remove all objects from scene
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }
    this.shipGroups = [];
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/SelectionScene.test.ts`
Expected: PASS — all 8 tests green

**Step 5: Commit**

```bash
git add src/game/SelectionScene.ts src/game/SelectionScene.test.ts
git commit -m "feat(selection): add SelectionScene with 3D ship display and state machine"
```

---

### Task 4: Wire Selection Screen into main.ts

**Files:**
- Modify: `src/main.ts`

This is the integration task. main.ts needs to:
1. Start in `'selection'` state showing the selection scene
2. Handle keyboard input for LEFT/RIGHT/ENTER during selection
3. On selection complete, transition to `'playing'` state creating the correct player types
4. On game over + restart, return to `'selection'`

**Step 1: Add scene state and selection imports**

At the top of `src/main.ts`, add imports:
```typescript
import { SelectionScene, SelectionState } from '@/game/SelectionScene';
import { SelectionUI } from '@/ui/SelectionUI';
import '@/ui/selection.css';
import { CHARACTER_REGISTRY, CharacterDef } from '@/game/CharacterRegistry';
```

Change game state type from `'playing' | 'gameOver'` to `'selection' | 'playing' | 'gameOver'`:
```typescript
type GameState = 'selection' | 'playing' | 'gameOver';
let gameState: GameState = 'selection';
```

**Step 2: Create selection scene objects**

After the renderer creation and before player creation, add:
```typescript
// Selection screen
let selectionScene: SelectionScene | null = new SelectionScene();
let selectionUI: SelectionUI | null = new SelectionUI();
```

Show the initial selection state:
```typescript
if (selectionScene && selectionUI) {
  selectionUI.show(2, selectionScene.getCurrentCharacter());
}
```

**Step 3: Defer player/melee-scene creation**

The existing code creates players, pools, models, etc. immediately at module load. We need to gate the melee scene setup behind a function that's called when selection completes.

Wrap the melee-specific setup (player creation, model loading, pools, HUD, collision, game loop) in a function `startMelee(p1Def: CharacterDef, p2Def: CharacterDef)` and remove the immediate execution.

The render loop needs to switch between:
- `'selection'` state: `renderer.render(selectionScene.scene, selectionScene.camera)`
- `'playing'`/`'gameOver'` state: existing game loop with `renderer.render(scene, camera)`

**Step 4: Handle selection keyboard input**

Add a keydown listener for selection:
```typescript
window.addEventListener('keydown', (e) => {
  if (gameState !== 'selection' || !selectionScene || !selectionUI) return;
  if (selectionScene.state === SelectionState.DONE) return;

  switch (e.key) {
    case 'ArrowLeft':
      selectionScene.selectPrev();
      selectionUI.show(
        selectionScene.state === SelectionState.SELECTING_P2 ? 2 : 1,
        selectionScene.getCurrentCharacter(),
      );
      break;
    case 'ArrowRight':
      selectionScene.selectNext();
      selectionUI.show(
        selectionScene.state === SelectionState.SELECTING_P2 ? 2 : 1,
        selectionScene.getCurrentCharacter(),
      );
      break;
    case 'Enter':
      selectionScene.confirmSelection();
      if (selectionScene.state === SelectionState.SELECTING_P1) {
        selectionUI.show(1, selectionScene.getCurrentCharacter());
      } else if (selectionScene.state === SelectionState.DONE) {
        selectionUI.hide();
        const { p1Def, p2Def } = selectionScene.getSelections();
        transitionToMelee(p1Def, p2Def);
      }
      break;
  }
});
```

**Step 5: Implement transitionToMelee**

```typescript
function transitionToMelee(p1Def: CharacterDef, p2Def: CharacterDef): void {
  // Clean up selection scene
  if (selectionScene) {
    selectionScene.dispose();
    selectionScene = null;
  }
  if (selectionUI) {
    selectionUI.destroy();
    selectionUI = null;
  }

  // Create players based on selection
  if (p1Def.isMichiGichi) {
    player1 = new MichiGichiPlayer();
  } else {
    player1 = new Player(GONDI_STATS);
  }
  player1.position = { ...ARENA.PLAYER1_SPAWN };
  player1.previousPosition = { ...ARENA.PLAYER1_SPAWN };

  if (p2Def.isMichiGichi) {
    player2 = new MichiGichiPlayer();
  } else {
    player2 = new Player(GONDI_STATS);
  }
  player2.position = { ...ARENA.PLAYER2_SPAWN };
  player2.previousPosition = { ...ARENA.PLAYER2_SPAWN };

  // Load models, set up pools, add to scene, start game loop...
  // (reuse existing setup code, parameterized by p1Def/p2Def)

  gameState = 'playing';
}
```

**Step 6: Update the render/animation loop**

The existing `gameLoop` callback needs to be split:
- During `'selection'`: update selectionScene, render selectionScene
- During `'playing'`/`'gameOver'`: existing game logic

Replace the single `gameLoop` with a `requestAnimationFrame` loop that dispatches based on state, or keep the GameLoop but add selection branch.

**Step 7: Update restart to go back to selection**

In the restart keydown handler, instead of immediately resetting players, transition back to selection:
```typescript
// Instead of resetting players inline, return to selection
gameState = 'selection';
selectionScene = new SelectionScene();
selectionUI = new SelectionUI();
selectionUI.show(2, selectionScene.getCurrentCharacter());
```

**Step 8: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (existing tests should not break — main.ts has no test file)

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 9: Commit**

```bash
git add src/main.ts
git commit -m "feat(selection): wire selection screen into main game loop"
```

---

### Task 5: Visual Testing with Playwright

**Files:**
- None created, manual verification

**Step 1: Start dev server and verify**

Run: `npm run dev`

Open browser and verify:
1. Game starts on selection screen (star field background, ship model visible)
2. LEFT/RIGHT cycles between MichiGichi and Gondi
3. Info panel updates with character name/weapon/special
4. ENTER confirms P2's selection, UI switches to "Player 1 — Choose Your Ship"
5. ENTER confirms P1's selection, transitions to melee gameplay
6. Melee plays normally with the selected characters
7. After game over, "Press any key" returns to selection screen

**Step 2: Take screenshot for reference**

Use Playwright browser snapshot to capture the selection screen state.

**Step 3: Commit any visual fixes**

If any CSS/positioning tweaks needed, fix and commit.

---

### Task 6: Final Cleanup and Type Check

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Final commit with CLAUDE.md update**

Update CLAUDE.md to document the selection screen architecture and patterns, then commit.
