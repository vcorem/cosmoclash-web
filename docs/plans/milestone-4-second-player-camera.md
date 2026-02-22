# Milestone 4: Second Player & Camera

**Goal:** Two ships on screen with split keyboard controls. Camera dynamically zooms to keep both players in view.

**Depends on:** Milestone 3 (Collision Detection)

## Scope

### Second Player
- Player 2 uses the same entity system as Player 1
- Player 2 spawns at `(500, -70, 0)` — original PLAYER2_SPAWN
- Both players share the same arena with wrap-around
- Each player has independent health, energy, angle, velocity

### Split Keyboard Controls
- **Player 1:** Arrow keys (rotate left/right, thrust) + `/` or `.` to fire
- **Player 2:** WASD (rotate left/right, thrust) + `Space` to fire
- InputManager updated to track two sets of bindings
- Each player gets their own input state

### Dynamic Camera Zoom
Mirrors `SceneMelee.cpp` camera logic:

1. Calculate midpoint between both players: `camCenter = (p1 + p2) / 2`
2. Calculate distance between players: `dist = sqrt(dx² + dy²)`
3. Smooth the zoom distance: `zoomDist = lerp(prevZoom, dist, 1/400)` per frame
4. Clamp distance to minimum: `max(dist, 50)`
5. Calculate camera Z: `z = -100 - (dist * 5)`
6. Clamp Z to range: `max(z, -3500)`
7. Smooth camera position transition at 0.5% per frame toward midpoint

### Camera Constants (from original)
- `CAM_BASE_Z: -100` (closest zoom)
- `CAM_MAX_Z: -3500` (farthest zoom)
- `CAM_DISTANCE_SCALE: 5` (Z units per distance unit)
- `CAM_MIN_PLAYER_DISTANCE: 50`

### Model Loading
- Load gondi.glb twice (or clone the scene) for both players
- Different tint or no tint — players distinguishable by position/panel later

## Out of Scope
- Character selection (Milestone 10)
- HUD showing health/energy (Milestone 9)
- AI opponent (Milestone 11 — this milestone is local 2-player only)
- Gamepad input

## Original C++ Reference
- `SceneMelee.cpp` — camera midpoint, zoom calculation, smooth follow
- `player/player.h` — PLAYER1_SPAWN, PLAYER2_SPAWN positions
- `input/` — dual player input bindings
