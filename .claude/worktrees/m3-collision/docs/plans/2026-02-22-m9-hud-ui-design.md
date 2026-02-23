# M9 Design: HUD / UI

## Summary

On-screen HUD showing each player's health and energy bars, plus a win/lose overlay with round restart. HTML/CSS overlay approach.

## Game State

A `gameState` variable in main.ts: `'playing'` | `'gameOver'`. No singleton class.

- **Playing**: normal game loop — input processed, collision active
- **GameOver**: input ignored, collision stops, winner overlay shown, awaiting keypress

**Transitions:**
- `playing → gameOver`: when either player's `alive` becomes false (detected in update loop after collision)
- `gameOver → playing`: on any keypress — resets both players, clears pools, re-shows meshes, hides overlay

## HUD Layout & Bar Rendering

### DOM Structure

```html
<div id="hud">
  <div class="player-panel left">
    <div class="bar-row">
      <img class="bar-icon" src="heart.png" />
      <div class="bar-container health">
        <div class="bar-segment" /> × 40
      </div>
    </div>
    <div class="bar-row">
      <img class="bar-icon" src="power.png" />
      <div class="bar-container energy">
        <div class="bar-segment" /> × 40
      </div>
    </div>
  </div>
  <div class="player-panel right">
    <!-- mirrored -->
  </div>
</div>
```

### Positioning

Absolute overlay on top of canvas. P1 panel top-left, P2 panel top-right. Bars horizontal, ~300px wide (40 segments × ~6px + 1px gaps).

### Colors (matching original C++)

- **Health segments**: Gradient from bright red `rgb(250,0,0)` to dark red, left-to-right. Each segment gets a pre-calculated color based on index.
- **Energy segments**: Gradient from bright orange `rgb(250,40,0)` to dark orange `rgb(250,200,0)`.

### Active/Inactive Logic

Each frame: `activeCount = Math.round(value * 40)`. Segments 0..activeCount-1 are lit (full color). Segments activeCount..39 are "empty."

### Decay Animation

- **Energy**: Empty segments fade from orange to gray over time (CSS transition on background-color, ~700ms). Matches C++ `0.0007 * timeDiff` rate.
- **Health**: Segments snap to hidden (no decay) — matches original where only energy has decay.

### Icons

- Heart icon (`heart.png`) for health row
- Lightning bolt icon (`power.png`) for energy row
- Ported from `mediaflat/gui/`
- Character thumbnail out of scope (M10)

## Win/Lose Overlay

### Detection

In update loop, after collision processing, check if either player is not alive. Set `gameState = 'gameOver'`, record winner.

### Display

Centered `<div>` overlay with "Player X Wins!" text. Glow effect via text-shadow (approximates original additive-blended billboard). Appears after ~1-2 second delay to let explosion animation play.

### Restart

"Press any key to restart" shown below win text. On keypress:
1. Reset both players: health=1, energy=1, position=spawn, velocity=zero, alive=true, snotCount=0
2. Clear all pools: release all active bullets, snots, explosions, asteroids
3. Re-show player meshes
4. Hide overlay
5. Set `gameState = 'playing'`

No scene transition — round restarts in-place.

## File Structure

### New Files

- `src/ui/HUD.ts` — HUD class: creates DOM elements, exposes `update(p1, p2)`, `showWinner(num)`, `hide()`
- `src/ui/hud.css` — all HUD styling (bars, segments, overlay, positioning)

### Modified Files

- `main.ts` — add `gameState`, import HUD, call `hud.update()` each frame, winner detection, restart handler, gate input/collision on state
- `index.html` — CSS import (or via Vite TS import)

### Assets

- `heart.png` and `power.png` from `mediaflat/gui/` → `public/textures/`

## Testing

- Unit tests: HUD segment calculations (active count from percentage)
- Unit tests: game state transitions (playing → gameOver → playing)
- Unit tests: restart logic (all state properly reset)
- Playwright visual test: bar rendering and win screen

## Out of Scope

- Character selection screen
- Main menu / settings
- Score tracking across rounds
- Minimap
- Character thumbnails in panels
