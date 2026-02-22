# Milestone 1: Single Ship Flight

**Date:** 2026-02-21
**Goal:** A single Gondi ship flying freely in a bounded arena with wrap-around edges.

## Stack

- **Language:** TypeScript
- **Renderer:** Three.js
- **Bundler:** Vite
- **No networking** — single-player only port

## Project Structure

```
cosmoclash-web/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── models/
│       └── gondi.glb
├── src/
│   ├── main.ts
│   ├── engine/
│   │   ├── Entity.ts
│   │   ├── EntityManager.ts
│   │   └── GameLoop.ts
│   ├── game/
│   │   ├── Arena.ts
│   │   ├── Camera.ts
│   │   ├── Scene.ts
│   │   └── Player.ts
│   └── input/
│       └── InputManager.ts
```

## Entity System

Mirrors the original C++ `entity.h` architecture.

### Entity (base class)

**Properties:**
- `position: Vector3` — world position
- `previousPosition: Vector3` — for sweep collision (scaffolded)
- `accelVec: Vector3` — velocity/acceleration vector
- `angle: number` — rotation in degrees (0-360)
- `mesh: Object3D | null` — Three.js scene object
- `alive: boolean` — active state flag
- `autoWrap: boolean` — whether wrap-around applies
- `timeScaler: number` — global 0.35 constant
- `collisionSpheres: CollisionSphere[]` — bounding volumes (scaffolded)

**Methods:**
- `update(dt)` — apply acceleration to position, sync mesh transform
- `handleWrapAround(cameraCenter)` — teleport when exceeding ±1500 X or ±1050 Y from camera
- `correctAngle()` — normalize angle to 0-360
- `destroy()` — mark dead, remove from scene

### EntityManager (scaffolded)

- Maintains active entity list
- Calls `update()` and `handleWrapAround()` on all entities each frame
- Pool infrastructure prepared but not populated until bullets/explosions needed

### Player (extends Entity)

Gondi-specific values:
- `rotationSpeed: 0.5`
- `acceleration: 0.004`
- `speedMaxScaler: 1.2`

**Methods:**
- `rotate(direction, dt)` — adjust angle from input
- `thrust(dt)` — compute acceleration from current angle, add to accelVec
- `applyDecay(dt)` — 0.1 velocity decay when not thrusting

## Game Loop

- `requestAnimationFrame` with delta time
- Delta capped at 100ms to prevent spiral-of-death
- Frame order: process input → update entities → render
- Global `timeScaler = 0.35` applied in entity updates

## Camera

- PerspectiveCamera, FOV 0.3 radians (~17 degrees)
- Far plane: 100,000
- Fixed Z distance from player (no dynamic zoom with one player)
- Follows player position
- Ready for dynamic zoom logic when second entity added later

## Scene

- WebGLRenderer filling viewport, responsive resize
- Background: dark space (`0x000011`)
- Star field: 500 small white points in a cube around the arena
- Ambient light: `(0.3, 0.3, 0.3)`
- Directional light for ship illumination

## Arena

- Bounds: 1500 x 1050 units with wrap-around edges
- Player spawn: `(-500, -70, 0)` (original player 1 position)
- Optional faint boundary markers for development

## Input

- `keydown`/`keyup` on `window`, tracking pressed keys in a `Set<string>`
- Key mappings:
  - Rotate left: `ArrowLeft` / `a`
  - Rotate right: `ArrowRight` / `d`
  - Thrust: `ArrowUp` / `w`
- Prevents default on game keys to avoid scrolling
- Direct key polling each frame via `isPressed(key)`

## Asset Conversion

- Source: `../turtle_svn/trunk/Turtle/mediaflat/gondi/gondi.x` (DirectX .x)
- Convert to `gondi.glb` using assimp CLI or Blender
- Load via Three.js `GLTFLoader`
- Apply original transform: scale 1.8x, rotation (-90, 0, 90) degrees
- Fallback: simple cone placeholder if conversion is difficult

## Out of Scope

- Weapons / energy system
- Collision detection
- Enemies / AI opponents
- Sun / gravity
- Sound
- UI / HUD
- Object pooling (scaffolded only)
