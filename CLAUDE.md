# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Architecture Notes for WebGL Port

- Replace Irrlicht with a WebGL framework (Three.js, Babylon.js, or raw WebGL)
- Network layer should use WebSockets instead of raw UDP sockets
- Original uses binary blob serialization for entity state — use TypedArrays in JS
- Lua AI scripts can be ported to JavaScript or run via Lua WASM bindings
- Entity object pooling is critical for performance — the original pools 15 explosions, multiple bullet types, and 10 asteroids
- The original config is XML-based (`config.xml`) with resolution, driver, and play mode settings
