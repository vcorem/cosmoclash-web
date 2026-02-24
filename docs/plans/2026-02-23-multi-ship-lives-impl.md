# Multi-Ship Lives Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When P1 dies with unused ships remaining, return to selection screen instead of game over. P1 picks their next ship and re-fights the same AI opponent.

**Architecture:** Add `usedP1Ships: Set<string>` and `currentP2Def: CharacterDef` state to main.ts. On P1 death, if unused ships exist, transition to selection (not menu). Selection screen skips used ships. Game over only when all ships exhausted.

**Tech Stack:** TypeScript, Three.js (existing codebase)

---

### Task 1: Track current P2 opponent across rounds

**Files:**
- Modify: `src/main.ts:439-440`

**Step 1: Add `currentP2Def` state variable**

In `src/main.ts`, after line 440 (`let remainingAIShips`), the gauntlet state section already has `currentP1Def`. Add `currentP2Def` to track the AI opponent that killed P1:

```typescript
// Gauntlet state — tracks remaining AI ships for consecutive rounds
let currentP1Def: CharacterDef | null = null;
let currentP2Def: CharacterDef | null = null;
let remainingAIShips: CharacterDef[] = [];
```

**Step 2: Set `currentP2Def` when starting a melee round**

In the `Enter` key handler (line 620-633), set `currentP2Def` when building the gauntlet:

```typescript
case 'Enter': {
  const p1Def = selectionScene.getCurrentCharacter();
  currentP1Def = p1Def;

  const p2Index = Math.floor(Math.random() * CHARACTER_REGISTRY.length);
  const p2Def = CHARACTER_REGISTRY[p2Index];
  currentP2Def = p2Def;  // <-- ADD THIS
  remainingAIShips = CHARACTER_REGISTRY.filter((_, i) => i !== p2Index);

  selectionUI.hide();
  startMelee(p1Def, p2Def);
  break;
}
```

Also update the gauntlet auto-advance block (line 956-963) to track `currentP2Def` when advancing to next AI:

```typescript
if (gauntletContinues && gameOverDelay >= GAME_OVER_DELAY_MS + GAUNTLET_ADVANCE_MS) {
  cleanupRound();
  if (hud) { hud.destroy(); hud = null; }
  const nextIndex = Math.floor(Math.random() * remainingAIShips.length);
  const nextP2Def = remainingAIShips[nextIndex];
  currentP2Def = nextP2Def;  // <-- ADD THIS
  remainingAIShips.splice(nextIndex, 1);
  startMelee(currentP1Def!, nextP2Def);
  return;
}
```

**Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: Clean compile

**Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: track currentP2Def for multi-ship lives"
```

---

### Task 2: Track used P1 ships and add fleet check

**Files:**
- Modify: `src/main.ts:439-448`

**Step 1: Add `usedP1Ships` state**

Add a Set to track which ships P1 has already lost with:

```typescript
// Fleet state — tracks ships P1 has already lost with
let usedP1Ships: Set<string> = new Set();
```

**Step 2: Add fleet helper function**

Add a helper function near the gauntlet state variables:

```typescript
function hasRemainingP1Ships(): boolean {
  return CHARACTER_REGISTRY.some(c => !usedP1Ships.has(c.id));
}
```

**Step 3: Mark ship as used when P1 dies**

In the winner detection block (line 942-947), when P1 loses, add the current ship to usedP1Ships:

```typescript
// Winner detection
if (!player1.alive || !player2.alive) {
  gameState = 'gameOver';
  winnerNum = player1.alive ? 1 : 2;
  gameOverDelay = 0;
  // Track used P1 ship when P1 dies
  if (winnerNum === 2 && currentP1Def) {
    usedP1Ships.add(currentP1Def.id);
  }
}
```

**Step 4: Reset `usedP1Ships` when starting a new gauntlet**

In the `Enter` key handler where the gauntlet starts, clear the set:

```typescript
case 'Enter': {
  const p1Def = selectionScene.getCurrentCharacter();
  currentP1Def = p1Def;
  usedP1Ships = new Set();  // <-- fresh fleet for new gauntlet
  // ... rest unchanged
}
```

**Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: Clean compile

**Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat: track used P1 ships for fleet lives system"
```

---

### Task 3: Add "return to selection" transition on P1 death

**Files:**
- Modify: `src/main.ts` (gameOver handler, showSelectionScreen)

**Step 1: Create `showSelectionScreenForFleet()` function**

Add a new function that shows the selection screen but preserves gauntlet state (unlike `showSelectionScreen` which is for fresh games):

```typescript
function showSelectionScreenForFleet(): void {
  selectionScene = new SelectionScene();
  selectionScene.state = SelectionState.SELECTING_P1;
  // Start browsing at first available (non-used) ship
  const firstAvailable = CHARACTER_REGISTRY.findIndex(c => !usedP1Ships.has(c.id));
  if (firstAvailable >= 0) {
    selectionScene.currentIndex = firstAvailable;
  }
  selectionUI = new SelectionUI(container);
  selectionUI.show(1, selectionScene.getCurrentCharacter());
  gameState = 'selection';
  SoundManager.getInstance().playMusic('intro');
}
```

**Step 2: Modify the gameOver handler to transition to selection when P1 has ships left**

In the `gameState === 'gameOver'` block (line 948-964), add a new path for P1 death with remaining ships:

```typescript
} else if (gameState === 'gameOver') {
  gameOverDelay += dt;
  const gauntletContinues = winnerNum === 1 && remainingAIShips.length > 0 && currentP1Def !== null;
  const fleetContinues = winnerNum === 2 && hasRemainingP1Ships() && currentP2Def !== null;

  if (gameOverDelay >= GAME_OVER_DELAY_MS && hud) {
    hud.showWinner(winnerNum, !gauntletContinues && !fleetContinues);
  }

  // P1 wins — gauntlet auto-advance to next AI
  if (gauntletContinues && gameOverDelay >= GAME_OVER_DELAY_MS + GAUNTLET_ADVANCE_MS) {
    cleanupRound();
    if (hud) { hud.destroy(); hud = null; }
    const nextIndex = Math.floor(Math.random() * remainingAIShips.length);
    const nextP2Def = remainingAIShips[nextIndex];
    currentP2Def = nextP2Def;
    remainingAIShips.splice(nextIndex, 1);
    startMelee(currentP1Def!, nextP2Def);
    return;
  }

  // P1 dies with ships remaining — return to selection after delay
  if (fleetContinues && gameOverDelay >= GAME_OVER_DELAY_MS + GAUNTLET_ADVANCE_MS) {
    cleanupRound();
    if (hud) { hud.destroy(); hud = null; }
    showSelectionScreenForFleet();
    return;
  }
}
```

**Step 3: Modify the "press any key to return to menu" handler**

Update the keydown handler (line 694-708) to also skip when fleet continues:

```typescript
window.addEventListener('keydown', () => {
  if (gameState !== 'gameOver') return;
  if (gameOverDelay < GAME_OVER_DELAY_MS) return;

  const gauntletContinues = winnerNum === 1 && remainingAIShips.length > 0 && currentP1Def !== null;
  if (gauntletContinues) return;

  const fleetContinues = winnerNum === 2 && hasRemainingP1Ships() && currentP2Def !== null;
  if (fleetContinues) return;

  cleanupRound();
  if (hud) { hud.destroy(); hud = null; }
  showMainMenu();
});
```

**Step 4: Wire fleet selection to re-fight same AI opponent**

In the selection screen keyboard handler (line 602-635), modify the `Enter` case to handle fleet re-selection vs fresh gauntlet:

```typescript
case 'Enter': {
  const p1Def = selectionScene.getCurrentCharacter();

  // Check if this is a fleet re-selection (currentP2Def already set)
  if (currentP2Def && usedP1Ships.size > 0) {
    // Fleet re-selection: fight same AI opponent
    currentP1Def = p1Def;
    selectionUI.hide();
    startMelee(p1Def, currentP2Def);
  } else {
    // Fresh gauntlet start
    currentP1Def = p1Def;
    usedP1Ships = new Set();

    const p2Index = Math.floor(Math.random() * CHARACTER_REGISTRY.length);
    const p2Def = CHARACTER_REGISTRY[p2Index];
    currentP2Def = p2Def;
    remainingAIShips = CHARACTER_REGISTRY.filter((_, i) => i !== p2Index);

    selectionUI.hide();
    startMelee(p1Def, p2Def);
  }
  break;
}
```

**Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: Clean compile

**Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat: return to selection screen on P1 death with remaining ships"
```

---

### Task 4: Skip used ships in selection screen navigation

**Files:**
- Modify: `src/game/SelectionScene.ts`

**Step 1: Add disabled ship tracking to SelectionScene**

Add a `disabledIds` set and methods to skip disabled ships:

```typescript
export class SelectionScene {
  // ... existing fields ...
  private disabledIds: Set<string> = new Set();

  setDisabledShips(ids: Set<string>): void {
    this.disabledIds = ids;
    // Update visual: push disabled ships further back
    CHARACTER_REGISTRY.forEach((charDef, i) => {
      const group = this.shipGroups[i];
      if (!group) return;
      if (this.disabledIds.has(charDef.id)) {
        group.visible = false;
      }
    });
  }
```

**Step 2: Modify `selectNext()` and `selectPrev()` to skip disabled ships**

```typescript
selectNext(): void {
  if (this.state === SelectionState.DONE) return;
  const len = CHARACTER_REGISTRY.length;
  let next = (this.currentIndex + 1) % len;
  // Skip disabled ships (max one full loop to avoid infinite)
  for (let i = 0; i < len; i++) {
    if (!this.disabledIds.has(CHARACTER_REGISTRY[next].id)) break;
    next = (next + 1) % len;
  }
  this.currentIndex = next;
  this.triggerFlyAnimation();
}

selectPrev(): void {
  if (this.state === SelectionState.DONE) return;
  const len = CHARACTER_REGISTRY.length;
  let prev = (this.currentIndex - 1 + len) % len;
  for (let i = 0; i < len; i++) {
    if (!this.disabledIds.has(CHARACTER_REGISTRY[prev].id)) break;
    prev = (prev - 1 + len) % len;
  }
  this.currentIndex = prev;
  this.triggerFlyAnimation();
}
```

**Step 3: Wire `setDisabledShips` in `showSelectionScreenForFleet()`**

In `src/main.ts`, update `showSelectionScreenForFleet()`:

```typescript
function showSelectionScreenForFleet(): void {
  selectionScene = new SelectionScene();
  selectionScene.state = SelectionState.SELECTING_P1;
  selectionScene.setDisabledShips(usedP1Ships);
  const firstAvailable = CHARACTER_REGISTRY.findIndex(c => !usedP1Ships.has(c.id));
  if (firstAvailable >= 0) {
    selectionScene.currentIndex = firstAvailable;
  }
  selectionUI = new SelectionUI(container);
  selectionUI.show(1, selectionScene.getCurrentCharacter());
  gameState = 'selection';
  SoundManager.getInstance().playMusic('intro');
}
```

**Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: Clean compile

**Step 5: Commit**

```bash
git add src/game/SelectionScene.ts src/main.ts
git commit -m "feat: skip used ships in selection screen navigation"
```

---

### Task 5: Show remaining ships count in SelectionUI

**Files:**
- Modify: `src/ui/SelectionUI.ts`

**Step 1: Add remaining count display**

Add an optional remaining ships indicator to the SelectionUI:

```typescript
export class SelectionUI {
  // ... existing fields ...
  private remainingEl: HTMLDivElement;

  constructor(parent: HTMLElement) {
    // ... existing constructor code ...

    this.remainingEl = document.createElement('div');
    this.remainingEl.className = 'selection-remaining';
    this.remainingEl.style.display = 'none';
    panel.appendChild(this.remainingEl);

    // ... rest of constructor (controls, appendChild calls) ...
  }

  show(playerNum: number, character: CharacterDef): void {
    this.header.textContent = `Player ${playerNum} — Choose Your Ship`;
    this.nameEl.textContent = character.name;
    this.weaponValue.textContent = character.weapon;
    this.specialValue.textContent = character.special;
    this.root.style.display = '';
  }

  showRemaining(count: number): void {
    if (count > 0) {
      this.remainingEl.textContent = `${count} ship${count === 1 ? '' : 's'} remaining`;
      this.remainingEl.style.display = '';
    } else {
      this.remainingEl.style.display = 'none';
    }
  }
  // ... rest unchanged
}
```

**Step 2: Add CSS for remaining count**

In `src/ui/selection.css`, add:

```css
.selection-remaining {
  color: #ff6644;
  font-size: 1.1em;
  margin-top: 0.5em;
  text-align: center;
}
```

**Step 3: Wire in `showSelectionScreenForFleet()`**

In `src/main.ts`, after creating the SelectionUI in `showSelectionScreenForFleet()`, call `showRemaining`:

```typescript
function showSelectionScreenForFleet(): void {
  selectionScene = new SelectionScene();
  selectionScene.state = SelectionState.SELECTING_P1;
  selectionScene.setDisabledShips(usedP1Ships);
  const firstAvailable = CHARACTER_REGISTRY.findIndex(c => !usedP1Ships.has(c.id));
  if (firstAvailable >= 0) {
    selectionScene.currentIndex = firstAvailable;
  }
  selectionUI = new SelectionUI(container);
  const remaining = CHARACTER_REGISTRY.filter(c => !usedP1Ships.has(c.id)).length;
  selectionUI.show(1, selectionScene.getCurrentCharacter());
  selectionUI.showRemaining(remaining);
  gameState = 'selection';
  SoundManager.getInstance().playMusic('intro');
}
```

**Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: Clean compile

**Step 5: Commit**

```bash
git add src/ui/SelectionUI.ts src/ui/selection.css src/main.ts
git commit -m "feat: show remaining ships count on fleet selection screen"
```

---

### Task 6: End-to-end manual test and type check

**Files:**
- None (verification only)

**Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: Clean compile

**Step 2: Run existing tests**

Run: `npx vitest run`
Expected: All existing tests pass

**Step 3: Manual playtest**

Run: `npm run dev`

Test these scenarios:
1. Start new game → select ship → fight AI → **let P1 die** → should see "Player 2 Wins!" briefly → return to selection screen with used ship hidden, remaining count shown
2. On selection screen → pick another ship → should fight **same** AI opponent
3. **Let P1 die again** with last ship → should show game over and return to menu on keypress
4. Start new game → select ship → **win** → gauntlet should auto-advance as before (unchanged)

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: multi-ship fleet lives system complete"
```
