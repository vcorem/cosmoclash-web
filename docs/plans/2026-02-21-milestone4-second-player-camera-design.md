# M4 Design: Second Player & Camera

## Summary

Add Player 2 with split keyboard controls and a dynamic zoom camera that keeps both players in view. Replace the dummy collision-test entity with a real second player.

## 1. InputManager Refactor

Replace the flat `InputManager` API with per-player input state.

### PlayerInput interface

```ts
interface PlayerInput {
  thrust: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
  firePrimary: boolean;
}
```

### PlayerKeyBindings

```ts
interface PlayerKeyBindings {
  thrust: string[];
  rotateLeft: string[];
  rotateRight: string[];
  firePrimary: string[];
}
```

### Default bindings

- **P1**: ArrowUp, ArrowLeft, ArrowRight, `/`
- **P2**: `w`/`W`, `a`/`A`, `d`/`D`, Space

### API change

Old: `input.thrust`, `input.rotateLeft`, etc.
New: `input.player(0).thrust`, `input.player(1).thrust`, etc.

Single shared `keydown`/`keyup` listener. Key bindings stored as array of `PlayerKeyBindings`.

## 2. Dynamic Camera Zoom

Replace single-target camera follow with two-player zoom camera, ported from C++ `AdjustCamera`.

### Algorithm

1. Midpoint: `camCenter = (p1 + p2) / 2`
2. Camera smoothing: `moveLen = dt * (distToCamCenter * 0.005)`, clamped to not overshoot
3. Player distance: `dist = sqrt(dx² + dy²)` (2D)
4. Smooth zoom: exponential averaging, 400ms time constant: `zoomDist = (zoomDist * (avgr-1) / avgr) + (dist / avgr)` where `avgr = 400 / dt`
5. Clamp min distance: `max(dist, 50)`
6. Camera Z: `-100 - dist * 5`
7. Clamp max zoom: `max(z, -3500)`
8. Look at: `(camCenter.x, camCenter.y, 0)`

### New signature

```ts
updateCamera(camera, p1x, p1y, p2x, p2y, dt): void
```

`zoomDist` state lives as module-level variable in Camera.ts.

## 3. Player 2 Integration

### Changes to main.ts

- Remove dummy entity, its mesh, and sync code
- Create `player2 = new Player(GONDI_STATS)` at `ARENA.PLAYER2_SPAWN`
- Load second gondi.glb (clone scene) — same model, no tint
- Add player2 to entityManager
- Process `input.player(1)` for player2 (same rotate/thrust/fire/energy logic)
- Player2 gets its own `ThrustEffect` instance
- Extract `updatePlayerInput(player, playerInput, thrustEffect, dt)` helper to avoid duplication
- Camera calls `updateCamera(camera, p1.x, p1.y, p2.x, p2.y, dt)`

### Files modified

- `src/input/InputManager.ts` — refactor to per-player bindings
- `src/input/InputManager.test.ts` — update tests
- `src/game/Camera.ts` — two-player zoom camera
- `src/main.ts` — P2 setup, remove dummy, update game loop

## Out of Scope

- Character selection (M10)
- HUD (M9)
- AI opponent (M11)
- Gamepad input
- Visual differentiation (tint/color) between players
