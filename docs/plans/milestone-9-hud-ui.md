# Milestone 9: HUD / UI

**Goal:** On-screen display showing each player's health and energy. Win/lose screen when a player is destroyed.

**Depends on:** Milestone 4 (Second Player & Camera)

## Scope

### Player Panels
Two panels mirroring `CPlayerPanel`:
- **Player 1 panel:** left side of screen
- **Player 2 panel:** right side of screen

Each panel shows:
- **Health bar:** horizontal bar, green (full) → red (empty)
- **Energy bar:** horizontal bar, cyan (full) → red (empty)
- **Player icon:** small ship thumbnail (optional)

### Bar Rendering
- Use HTML/CSS overlay (simpler than in-world 3D quads)
- Or: Three.js `CSS2DRenderer` / `Sprite` for in-world HUD
- Bars update every frame based on player state
- Smooth animation for bar changes (lerp toward target value)

### Win/Lose Screen
- When a player's health reaches 0:
  - Brief delay (1-2 seconds for explosion)
  - Display "Player X Wins!" centered on screen
  - Option to restart (press any key)
- No complex animation — text overlay is sufficient

### Game State
- Add game state tracking: `playing`, `gameOver`
- Stop processing input for dead player
- Optional: freeze camera on explosion

## Out of Scope
- Character selection screen
- Main menu
- Settings/options
- Score tracking across rounds
- Minimap

## Original C++ Reference
- `GUI/PlayerPanel.h/cpp` — health/energy bar rendering, icon display
- `GUI/` — win/lose billboard textures (`you_win.jpg`, `you_lose.jpg`)
- `SceneMelee.cpp` — kill delay timer, game end handling
