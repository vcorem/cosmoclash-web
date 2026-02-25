# CosmoClash WebGL — Architecture & Design

## Origins

CosmoClash is a 2-player space battle arena game originally developed in C++ using the [Irrlicht 3D engine](https://irrlicht.sourceforge.io/). The original game was created by **Ori Hanegby, Guy Corem, and Orr Kowarsky**. This repository is a ground-up WebGL reimplementation that faithfully ports the gameplay mechanics, physics, and visual style to the browser using **Three.js** and **TypeScript**.

The original C++ source code serves as the canonical reference for all gameplay behavior. Key reference files include `SceneMelee.h/cpp` (battle scene and camera), `player/player.h/cpp` (movement, weapons, energy), `entity.h/cpp` (base entity with collision), `CollisionDetector.h/cpp` (sweep-sphere detection), `Bullets/` (projectile types), and `AI/` (Lua-based opponent scripts).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Rendering | [Three.js](https://threejs.org/) (WebGL) |
| Language | TypeScript (strict mode) |
| Build | [Vite](https://vitejs.dev/) |
| Testing | [Vitest](https://vitest.dev/) (531+ unit tests) |
| Audio | Web Audio API (no dependencies) |
| 3D Models | glTF/GLB (converted from DirectX `.x` via Assimp) |
| Textures | PNG sprite atlases (with alpha for additive blending) |

No runtime dependencies beyond Three.js. No UI framework — all HUD and menu UI is hand-written HTML/CSS overlays.

## Project Structure

```
src/
├── engine/          Core engine systems (entity, collision, pools, events)
│   ├── Entity.ts          Base entity class — position, velocity, wrap-around, collision spheres
│   ├── EntityManager.ts   Manages players + sun lifecycle and update loop
│   ├── EntityPool.ts      Generic free-list object pool for bullets, snots, explosions, asteroids
│   ├── CollisionDetector.ts   Sweep-sphere collision detection (ported from C++)
│   ├── GameEventMgr.ts    Singleton event bus — sendEvent() / addListener()
│   ├── GameEvent.ts       Event types: Explosion, BulletHit, SunCollision, SnotHit
│   └── GameLoop.ts        requestAnimationFrame loop with delta time
│
├── game/            Game-specific entities and mechanics
│   ├── Player.ts          Player entity — movement, energy, weapons, health, snot debuff
│   ├── MichiGichiPlayer.ts  Extends Player — 4-state morph machine (Michi ↔ Gichi)
│   ├── SholevPlayer.ts    Extends Player — frost shield, ice shards, energy drain
│   ├── Bullet.ts          Projectile entity + BulletConfig (plasma, flame, sun, ice, frost shield)
│   ├── Snot.ts            Collectible snot projectile — attaches to players, boosts speed
│   ├── Explosion.ts       Animated billboard explosion (atlas UV animation)
│   ├── Asteroid.ts        3D asteroid with rotation, wrap-around, one-shot-kill collision
│   ├── Sun.ts             Central sun entity with animated sprite and gravitational pull
│   ├── Gravity.ts         Gravitational force calculation applied each frame
│   ├── Arena.ts           Arena constants (bounds, time scaler, physics values)
│   ├── Camera.ts          Dynamic zoom camera tracking two players
│   ├── Scene.ts           Three.js scene setup, star field, renderer creation
│   ├── ThrustEffect.ts    Particle exhaust trail behind ships
│   ├── FrostTrailEffect.ts  Shrinking shield sprite trail (Sholev-specific)
│   ├── CollisionHandler.ts  Collision response — damage, bounce, explosions
│   ├── CharacterRegistry.ts  Data-driven character definitions
│   └── SelectionScene.ts  3D character select with ship previews and fly animations
│
├── ai/              AI opponent system (ported from Lua)
│   ├── AIController.ts    Main controller — builds player tables, runs decision hierarchy
│   ├── AIBridge.ts        Translates game entities into AI-readable tables
│   ├── AICalc.ts          Math utilities — distance, angle, interception
│   ├── AIAttack.ts        Attack mode decision tree
│   ├── AIDefense.ts       Defense mode decision tree
│   ├── AITactics.ts       Tactical behaviors — avoid sun, dodge bullets, collect snots
│   ├── AIConstants.ts     Difficulty level tuning (Easy/Medium/Hard)
│   ├── AIOutput.ts        Converts AI decisions into PlayerInput
│   └── AILog.ts           Learning/logging for AI adaptation
│
├── audio/           Sound system
│   ├── SoundManager.ts    Singleton — Web Audio API, preloading, playback, mute
│   ├── SoundEffect.ts     Enum + config map for 14 SFX + 2 music tracks
│   └── SoundEventListener.ts  Maps game events to sounds via GameEventMgr
│
├── input/           Input handling
│   └── InputManager.ts    Per-player key bindings (P1: arrows, P2: WASD)
│
├── ui/              User interface (HTML/CSS overlays)
│   ├── HUD.ts             In-game health/energy bars (40-segment gradients)
│   ├── SelectionUI.ts     Character select info panel overlay
│   ├── DifficultyUI.ts    AI difficulty picker (Easy/Medium/Hard)
│   ├── MainMenu.ts        Main menu with play button
│   ├── LogoSplash.ts      Intro splash with fade animation
│   └── Viewport.ts        4:3 letterboxed game container
│
└── main.ts          Entry point — game state machine, wiring, render loop
```

## Core Architecture Decisions

### Entity System

All game objects inherit from `Entity`, which provides position, velocity, angle, health, collision spheres, and arena wrap-around. This mirrors the original C++ `CEntity` base class.

**Entity types:** Player, Bullet, Sun, Snot, Explosion, Asteroid.

The `EntityManager` only manages **players and the sun**. All pooled entities (bullets, snots, explosions, asteroids) have their own `EntityPool<T>` instances with dedicated update/sync loops in `main.ts`. This separation keeps the generic pool system decoupled from the entity manager's lifecycle.

### Object Pooling

The original C++ game uses pre-allocated free lists for performance-critical entities. We replicate this with `EntityPool<T>` — a generic pool that manages acquire/release with a free list. Pool sizes match the original: 50 bullets, 80 snots, 15 explosions, 10 asteroids.

Visual representations (Three.js sprites/meshes) are tracked in separate `Map<Entity, THREE.Sprite|THREE.Group>` collections alongside each pool, keeping the pool generic and the rendering concerns isolated.

### Collision Detection

Ported directly from the C++ `CollisionDetector`. Uses **sweep-sphere** detection — each entity has one or more collision spheres with offsets and radii. The detector checks all entity pairs per frame, computing temporal collision time to handle fast-moving projectiles.

Collision filtering (`shouldCheck()`) prevents nonsensical interactions: bullets skip their origin player, explosions skip everything, asteroid-asteroid is ignored, and bullet-bullet collision only applies to tracking projectiles (plasma vs plasma).

### Event System

`GameEventMgr` is a singleton event bus used for decoupled communication between systems. The primary use case is triggering explosions: when the `CollisionHandler` determines a player dies or an asteroid is destroyed, it sends an `ExplosionEvent`. The sound system, explosion pool, and other listeners respond independently.

### Rendering Approach

Three.js renders the 3D scene (ships, asteroids, sun, star field, projectile sprites). All UI elements — HUD bars, selection screen info, menus, difficulty picker — are **HTML/CSS overlays** positioned on top of the WebGL canvas. This gives precise layout control and avoids the complexity of in-world UI rendering.

The game uses a **4:3 letterboxed viewport** (`Viewport.ts`) to match the original game's aspect ratio, with black pillarbox/letterbox bars on modern widescreen displays.

### Camera System

A dynamic zoom camera tracks both players simultaneously. The camera Z position interpolates between -100 (close, when players are near each other) and -3500 (far, when players are at opposite ends of the arena). This matches the original C++ `SceneMelee` camera behavior.

## Gameplay Design

### Arena & Physics

The arena is a bounded 1500×1050 unit playing field with **wrap-around edges** — entities exiting one side reappear on the opposite side. A global time scaler of 0.35 affects all physics calculations, matching the original C++ tuning.

Movement uses angle-based rotation (0-360 degrees) with forward thrust generating acceleration vectors. Velocity decays at 0.1 per frame, creating a drifting feel in zero gravity (except for the sun's gravitational pull).

### Energy System

Each player has an energy bar (0.0 to 1.0) that regenerates over time. Primary weapons cost 0.08 energy with a 200ms cooldown. Energy management is a core skill — overusing weapons leaves the player unable to fire.

### Characters

Three playable characters are currently implemented, each ported from the original C++ definitions:

| Character | Speed | Primary Weapon | Secondary / Special |
|-----------|-------|---------------|-------------------|
| **MichiGichi** | 0.2 / 1.0 | Plasma Blast (tracking) | Morph: slow+strong ↔ fast+weak |
| **Gondi** | 0.5 | Galactic Flame (persistent, attached) | Space Slime (snot launcher) |
| **Sholev** | 0.8 | Ice Cones (radial shards) | Frost Shield (damage aura + speed boost) |

MichiGichi extends `Player` with a 4-state morph machine and bone-based animation (42 keyframes ported from the DirectX `.x` format). Sholev extends `Player` with frost shield mechanics including energy drain, stat boosts, and a visual frost trail effect.

The original game defines 8 characters (Neo, Orca, Ptera, Lepid, Gondi, Tiktok, Sholev, Phyto). The remaining 5 are planned for future implementation.

### Bullet System

Rather than a class hierarchy of bullet subclasses (as in the original C++), the WebGL port uses a single `Bullet` class with a data-driven `BulletConfig`. Optional config fields enable dynamic behaviors:

- `tracking` — projectile homes toward the nearest enemy (plasma)
- `expandingRadius` — collision radius grows over time (sun weapon)
- `decayingDamage` — damage decreases with distance/time (flame)
- `persistent` — bullet survives hits and rate-limits damage (flame, frost shield)
- `hitRateLimit` — milliseconds between damage ticks for persistent bullets
- `attached` — bullet follows its owner's position (frost shield, flame)

This data-driven approach is simpler than the original's class hierarchy while preserving all the mechanical variety.

### AI Opponent

The AI system is ported from the original game's Lua scripts (`turtle.lua`). It uses a hierarchical decision system:

1. **AIBridge** translates game state into `PlayerTable` structures the AI can reason about
2. **AITactics** handles immediate threats — avoid the sun, dodge tracking bullets, evade snots
3. **AIAttack** decides offensive behavior — approach, aim, fire timing
4. **AIDefense** decides defensive behavior — retreat, dodge, evasion patterns
5. **AIController** orchestrates the pipeline each frame and emits a `PlayerInput`

Three difficulty levels (Easy, Medium, Hard) tune reaction times, accuracy, and tactical sophistication via `AIConstants`.

### Snot Mechanic

A unique CosmoClash mechanic: players can fire snot projectiles that attach to opponents and **increase the target's max speed** (making them harder to control). Snot collection and debuff management add a layer of strategy beyond direct combat.

### Sun & Gravity

A central sun entity exerts gravitational pull on all entities in the arena. Players and bullets curve toward the sun, adding dynamic trajectory planning. Contact with the sun deals damage and bounces the entity away. Bullets are instantly destroyed on sun contact.

## Game Flow

```
Logo Splash → Main Menu → Difficulty Select → Character Selection → Battle → Game Over
                  ↑                                                            │
                  └────────────────────────────────────────────────────────────┘
```

1. **Logo Splash** — Intro image with fade-in/hold/fade-out (skippable)
2. **Main Menu** — Play button, credits
3. **Difficulty Select** — Easy / Medium / Hard (sets AI behavior)
4. **Character Selection** — 3D ship previews with info panels. P2 selects first, then P1. In single-player mode, P1 can pick a fleet of ships for multi-life gameplay
5. **Battle (Melee)** — The main gameplay loop. Separate Three.js scene with arena, sun, star field, HUD overlay
6. **Game Over** — Victory screen, returns to selection

### Fleet Lives & Gauntlet Mode

An extension beyond the original game: P1 can select multiple ships as a "fleet." Losing a round with one ship automatically advances to the next ship in the fleet. In gauntlet mode, rounds auto-advance against the AI opponent.

## Asset Pipeline

Original assets are in DirectX `.x` format (3D meshes) and JPG/PNG (textures). The conversion pipeline:

1. **3D models:** `assimp export model.x model.glb` converts DirectX meshes to glTF binary, preserving bone animations where present
2. **Sprite atlases:** Original JPG textures are converted to PNG with alpha channel derived from luminance, required for correct additive blending in WebGL
3. **Sound effects:** WAV files from the original `mediaflat/sounds/` directory, loaded via Web Audio API

## Sound Architecture

The sound system uses the **Web Audio API** directly (no audio library dependencies):

- `SoundManager` singleton handles preloading, playback, volume control, and mute state
- 14 sound effects + 2 music tracks preloaded as `AudioBuffer` objects
- `SoundEventListener` subscribes to `GameEventMgr` for collision-triggered sounds
- Weapon fire sounds are driven by `BulletConfig.sound` field
- AudioContext creation is deferred to the first user gesture (browser autoplay policy)
- Mute state persisted in `localStorage`

## Testing Strategy

531+ unit tests using Vitest. Tests cover:

- Entity physics (position, velocity, wrap-around, angle correction)
- Collision detection (sweep-sphere, filtering, multi-sphere)
- Object pool lifecycle (acquire, release, releaseAll)
- Player mechanics (energy, weapons, cooldowns, health, snot debuff)
- Character-specific behavior (MichiGichi morph states, Sholev frost shield)
- AI decision logic (attack modes, defense modes, tactics)
- Sound system (playback, events, mute)
- UI components (HUD segments, selection state)
- Camera controller (zoom interpolation)
- Event system (send, listen, unsubscribe)

## Credits

- **Original game:** CosmoClash by Ori Hanegby, Guy Corem, and Orr Kowarsky
