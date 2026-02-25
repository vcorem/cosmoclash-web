# CosmoClash WebGL Port — Milestone Roadmap

**Goal:** Port the full CosmoClash C++ game to a browser-based WebGL game using Three.js and TypeScript.

## Milestone Overview

| # | Milestone | Status | Dependencies |
|---|-----------|--------|--------------|
| 1 | Single Ship Flight | DONE | — |
| 2 | Weapons & Energy | DONE | M1 |
| 3 | Collision Detection | DONE | M2 |
| 4 | Second Player & Camera | DONE | M3 |
| 5 | Sun & Gravity | DONE | M3 |
| 6 | Snot Mechanic | DONE | M3 |
| 7 | Entity Pooling & Explosions | DONE | M3 |
| 8 | Asteroids | DONE | M7 |
| 9 | HUD / UI | DONE | M4 |
| 10 | Additional Ships & Weapons | DONE | M6 |
| 11 | AI Opponent | DONE | M4 |
| 12 | Sound | DONE | M7 |
| — | Selection Screen | DONE | M10 |
| — | Logo Splash & Main Menu | DONE | — |
| — | 4:3 Letterboxed Viewport | DONE | — |
| — | Sholev Character | DONE | M10 |
| — | Multi-Ship Fleet Lives | DONE | Selection Screen |
| — | Gauntlet Mode | DONE | M11, Fleet Lives |
| 13 | Network Multiplayer | Out of Scope | M11 |

## Dependency Graph

```
M1 (Ship Flight) ──► M2 (Weapons) ──► M3 (Collision) ──┬──► M4 (2P + Camera) ──► M9 (HUD)
                                                         │                    └──► M11 (AI) ──► M13 (Network)
                                                         ├──► M5 (Sun/Gravity)
                                                         ├──► M6 (Snot) ──► M10 (Ships/Weapons) ──► Selection Screen ──► Fleet Lives
                                                         └──► M7 (Pooling/FX) ──► M8 (Asteroids)                    └──► Gauntlet
                                                                             └──► M12 (Sound)
```

## Additional Features (post-milestone)

These were added outside the original milestone plan:

- **Selection Screen** — 3D character select with ship previews, info panels, sequential P2→P1 pick
- **Logo Splash & Main Menu** — Intro splash screen with fade animation, main menu with play button
- **4:3 Letterboxed Viewport** — Matches the original game's aspect ratio with pillarboxing
- **Sholev Character** — Third playable ship with ice shards (primary) and frost shield (secondary)
- **Multi-Ship Fleet Lives** — P1 picks a fleet of ships; losing a round advances to the next ship
- **Gauntlet Mode** — Auto-advancing single-player rounds against AI opponent
