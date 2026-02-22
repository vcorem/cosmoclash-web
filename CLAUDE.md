# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Self-Maintenance

**This file is a living document.** Update it as you work — when you encounter bugs, discover patterns, learn API quirks, or establish conventions, add them here so future sessions don't repeat mistakes. Keep entries concise and actionable. Remove anything that becomes outdated.

## Project Overview

CosmoClash is a WebGL port of a multiplayer 2-player space battle arena game originally written in C++ with the Irrlicht 3D engine. The original codebase lives at `../turtle_svn/trunk/Turtle/`. This repository is the WebGL reimplementation.

## Original Game Reference

The original C++ source at `../turtle_svn/trunk/Turtle/` is the canonical reference for gameplay mechanics and architecture. Key source files for understanding behavior:

- `SceneMelee.h/cpp` — main battle scene, camera logic, arena bounds, wrap-around
- `player/player.h/cpp` — player movement, weapons, energy, snot mechanics
- `entity.h/cpp` — base entity with collision spheres, gravity, wrap-around
- `player/entitymgr.h/cpp` — entity lifecycle with object pooling
- `Bullets/` — projectile types: Plasma, Frost, Ice, Flame, Sun, Snot
- `GameEvents/` — event system (collision, explosion, bullet hit, frame render)
- `CollisionDetector.h/cpp` — sweep-sphere collision detection
- `communication/` — network protocol with entity state sync
- `AI/` — Lua-based AI scripts for computer opponents

## Core Gameplay Mechanics

**Arena**: Bounded playing field with wrap-around edges (1500x1050 units). Camera dynamically zooms based on distance between players (Z range -100 to -3500).

**Movement**: Angle-based rotation (0-360 degrees, 0.3 rotation speed), forward thrust creating acceleration vectors, velocity decay (0.1). Global time scaler of 0.35 affects all physics.

**Energy**: Regenerates over time (0-1 float). Primary weapon costs 0.08 energy with 200ms cooldown. Secondary weapon same cost, slower fill rate.

**Snot mechanic**: Collectible projectiles that attach to players and increase max speed per attached snot.

**Gravity**: Sun entity applies gravitational pull on all entities.

**Collision**: Multi-sphere bounding volumes per entity. Sweep-sphere detection with temporal collision time. Bullets don't collide with their origin player.

**Entity pooling**: Bullets, explosions, and asteroids are pre-allocated and recycled from free lists.

## Playable Characters

Neo, Orca, Ptera, Lepid, Gondi, Tiktok, Sholev, Phyto — each with unique speed scalers (0.2-1.2) and weapon loadouts.

## Original Assets

3D meshes in DirectX `.x` format at `../turtle_svn/trunk/Turtle/mediaflat/` — will need conversion to glTF/GLB for WebGL. Textures are PNG/JPG. Sound effects are WAV files in `mediaflat/sounds/`.

## Current Implementation State

**Completed milestones:** M1 (rendering), M2 (movement), M3 (collision), M4 (weapons), M5 (energy/HUD), M6 (snot mechanic), M7 (entity pooling & explosions)

**Tech stack:** Three.js, TypeScript, Vite, Vitest

**Key architecture patterns:**
- `EntityPool<T>` (`src/engine/EntityPool.ts`) — generic free-list pool for bullets (50), snots (80), explosions (15). Pools manage entity lifecycle; sprites are tracked in separate `Map<Entity, THREE.Sprite>` alongside the pool
- `GameEventMgr` singleton with `sendEvent()` / `addListener()` — used for explosion triggers on player death
- `CollisionHandler` emits `ExplosionEvent` when a Player dies (bullet hit, ship collision, sun collision)
- Pooled entities (bullets, snots, explosions) live OUTSIDE `EntityManager` — they have their own update/sync loops in `main.ts`. `EntityManager` only holds players + sun
- Debug keys: press `1`/`2` to instantly kill player 1/2 with explosion

**Input bindings:**
- Player 1: ArrowUp/Left/Right (thrust/rotate), `/` (fire), `.` (secondary)
- Player 2: WASD (thrust/rotate), Space (fire), Shift (secondary)

## Sprite Atlas Best Practices

**Always use PNG with alpha for sprite atlases used with additive blending.** JPG has no alpha channel, so all pixels have alpha=1.0 — even near-black background pixels get additively blended onto the scene, creating a visible bright rectangle around the sprite.

Fix: derive alpha from luminance when packing the atlas:
```bash
magick input.jpg \( +clone -colorspace gray \) -alpha off -compose CopyOpacity -composite output.png
```

**Original assets preserve format:** The original C++ assets at `mediaflat/` include both JPG and PNG textures. When the original uses JPG (e.g. explosion frames), the background may be near-black but NOT transparent. Always convert to PNG with alpha for WebGL sprites that need transparency.

**Atlas UV animation pattern** (used for sun, snot, explosion):
```typescript
texture.repeat.set(1 / cols, 1 / rows);
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
// Per frame:
const col = frameIndex % cols;
const row = Math.floor(frameIndex / cols);
texture.offset.set(col / cols, 1 - (row + 1) / rows);
```

## Architecture Notes for WebGL Port

- Three.js is the chosen WebGL framework
- Network layer should use WebSockets instead of raw UDP sockets
- Original uses binary blob serialization for entity state — use TypedArrays in JS
- Lua AI scripts can be ported to JavaScript or run via Lua WASM bindings
- Entity object pooling is critical for performance — the original pools 15 explosions, multiple bullet types, and 10 asteroids
- The original config is XML-based (`config.xml`) with resolution, driver, and play mode settings

## Build & Test

```bash
npm run dev          # Start dev server
npx vitest run       # Run all tests (233 tests)
npx tsc --noEmit     # Type check
```
