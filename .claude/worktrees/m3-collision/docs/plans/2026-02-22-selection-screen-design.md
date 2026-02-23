# Selection Screen Design

## Overview

Character selection screen for 2-player local play. Players sequentially choose their ship before entering the melee arena. Matches the original C++ SceneSelect behavior.

## Scope

- 2 characters: MichiGichi and Gondi (extensible to more later)
- 3D model display with star field background
- Sequential selection (P2 first with arrows, then P1)
- Last-round winner auto-selects

## Scene Layout

Ships arranged horizontally, spaced 300 units apart on X axis. Camera at `(0, 0, -700)` with narrow FOV (0.3), tracks the selected ship.

- **Selected ship**: Animates forward to Z=-400 over 400ms. Gently bobs/rotates via sine wave on X/Z position and Y rotation.
- **Unselected ships**: Animate back to Z=400 over 400ms.
- **Star field**: 3000 particle stars in a 7000-unit cube, scrolling parallax behind the scene.

## Info Panel (HTML/CSS Overlay)

Top-center panel consistent with existing HUD pattern:
- Header: "Player X — Choose your ship"
- Ship Name
- Weapon description
- Special ability description
- Updates dynamically when selection changes

## Input

- LEFT/RIGHT arrows to cycle characters
- ENTER to confirm selection
- Player 2 selects first (uses arrow keys), then Player 1 (also arrow keys)
- If a player won the last round, their selection is auto-carried and their turn is skipped

## Architecture

### CharacterDef Registry

```typescript
interface CharacterDef {
  id: string;
  name: string;
  weapon: string;
  special: string;
  modelPath: string;
  modelScale: number;
  modelRotation: [number, number, number];
  speedScaler: number;
  rotationSpeed: number;
  PlayerClass: typeof Player; // Player or MichiGichiPlayer
}
```

Two entries for now. Adding a character = adding one entry + a GLB model.

### SelectionScene

Manages the 3D scene during selection:
- Loads character models into Three.js scene
- Handles camera animation (fly-straight to selected ship)
- Renders star field background
- Drives ship bob/rotation animation
- Cleans up when transitioning to melee

### SelectionUI

HTML/CSS overlay (same pattern as HUD.ts):
- Creates/destroys DOM elements for the info panel
- `update(characterDef, playerNumber)` refreshes display
- Shows/hides with CSS

### Scene State Machine

main.ts gains a scene state: `'selection' | 'playing' | 'gameOver'`

- Game starts in `'selection'`
- After both players confirm, transitions to `'playing'` (loads melee scene)
- After game over + restart, returns to `'selection'`
- Selection results feed into player creation (replacing hardcoded characters)

## Character Data

| Character | Weapon | Special | Model |
|-----------|--------|---------|-------|
| MichiGichi | Plasma Blast | Transform between fast/weak and slow/strong | michiGichi.glb |
| Gondi | Galactic Flame | Space Slime | gondi.glb |
