# CosmoClash Web

A space battle arena game running in the browser, built with **Three.js** and **TypeScript**.

CosmoClash is a WebGL reimplementation of an original C++ game built with the [Irrlicht 3D engine](https://irrlicht.sourceforge.io/) around the year 2008. The port faithfully recreates the gameplay mechanics, physics, and visual style — from sweep-sphere collision detection to the unique snot mechanic — while running entirely in a web browser with zero plugins.

The game was ported in about 48 hours using Claude Code, ~17 years after the original code was last modified. 

## Gameplay

Battle an AI opponent in a bounded arena with wrap-around edges. A central sun exerts gravitational pull on everything — ships, bullets, and debris alike. Manage your energy to fire weapons, dodge projectiles, and outmaneuver your opponent in zero-gravity combat.

**Features:**
- 3 playable ships with unique weapons and abilities
- AI opponent with 3 difficulty levels (ported from the original Lua scripts)
- Dynamic zoom camera that tracks the action
- Sun gravity affecting all entities
- Snot mechanic — projectiles that attach to opponents and alter their handling
- Asteroids that bounce ships and shatter on bullet impact
- Fleet mode — pick multiple ships and fight through them one by one
- Sound effects and music

### Characters

| Ship | Primary Weapon | Special Ability |
|------|---------------|-----------------|
| **MichiGichi** | Plasma Blast (tracking) | Morph between slow+strong and fast+weak forms |
| **Gondi** | Galactic Flame (persistent beam) | Space Slime launcher |
| **Sholev** | Ice Cones (radial shards) | Frost Shield — damage aura with speed boost |

### Controls

| Action | Key |
|--------|-----|
| Thrust | Arrow Up |
| Rotate | Arrow Left / Right |
| Fire | `/` |
| Secondary | `.` |
| Mute | M |

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Build & Test

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm test             # Run all tests (531+)
npx tsc --noEmit     # Type check
```

## Tech Stack

| | |
|-|-|
| **Rendering** | [Three.js](https://threejs.org/) (WebGL) |
| **Language** | TypeScript |
| **Build** | [Vite](https://vitejs.dev/) |
| **Tests** | [Vitest](https://vitest.dev/) |
| **Audio** | Web Audio API |
| **3D Models** | glTF/GLB |

No runtime dependencies beyond Three.js. No UI framework — HUD and menus are hand-written HTML/CSS overlays.

## Project Structure

```
src/
  engine/     Core systems — entity, collision, pools, events
  game/       Ships, bullets, asteroids, sun, camera, arena
  ai/         AI opponent (attack, defense, tactics, difficulty)
  audio/      Sound manager, effects, event-driven playback
  input/      Keyboard input handling
  ui/         HUD, menus, selection screen, viewport
  main.ts     Entry point and game state machine

public/
  models/     Ship and asteroid meshes (.glb)
  textures/   Sprite atlases and textures
  sounds/     Sound effects and music

docs/
  plans/      Milestone specs and roadmap
  architecture.md   Detailed design document
```

## Architecture Highlights

- **Entity pooling** — Bullets, explosions, snots, and asteroids are pre-allocated and recycled from free lists, matching the original C++ architecture
- **Sweep-sphere collision** — Multi-sphere bounding volumes with temporal detection, ported from the original `CollisionDetector`
- **Data-driven bullets** — A single `Bullet` class with config-driven behaviors (tracking, expanding radius, decaying damage, persistence) instead of a class hierarchy
- **Event bus** — `GameEventMgr` decouples collision responses, explosions, and sound triggers
- **4:3 letterboxing** — Preserves the original game's aspect ratio on modern displays

See [docs/architecture.md](docs/architecture.md) for the full design document.

## Credits

**Original game** created by Ori Hanegby, Guy Corem, and Orr Kowarsky using the [Irrlicht 3D Engine](https://irrlicht.sourceforge.io/) (C++) with Lua-based AI scripts. 3D models, textures, and sound effects are from the original game.

**WebGL port** built with [Three.js](https://threejs.org/), [Vite](https://vitejs.dev/), and [TypeScript](https://www.typescriptlang.org/). Asset conversion from DirectX `.x` format to glTF/GLB via [Assimp](https://github.com/assimp/assimp).
