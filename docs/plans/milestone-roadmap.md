# CosmoClash WebGL Port — Milestone Roadmap

**Goal:** Port the full CosmoClash C++ game to a browser-based WebGL game using Three.js and TypeScript.

## Milestone Overview

| # | Milestone | Status | Dependencies |
|---|-----------|--------|--------------|
| 1 | Single Ship Flight | DONE | — |
| 2 | Weapons & Energy | Planned | M1 |
| 3 | Collision Detection | Planned | M2 |
| 4 | Second Player & Camera | Planned | M3 |
| 5 | Sun & Gravity | Planned | M3 |
| 6 | Snot Mechanic | Planned | M3 |
| 7 | Entity Pooling & Explosions | Planned | M3 |
| 8 | Asteroids | Planned | M7 |
| 9 | HUD / UI | Planned | M4 |
| 10 | Additional Ships & Weapons | Planned | M6 |
| 11 | AI Opponent | Planned | M4 |
| 12 | Sound | Planned | M7 |
| 13 | Network Multiplayer | Planned | M11 |

## Dependency Graph

```
M1 (Ship Flight) ──► M2 (Weapons) ──► M3 (Collision) ──┬──► M4 (2P + Camera) ──► M9 (HUD)
                                                         │                    └──► M11 (AI) ──► M13 (Network)
                                                         ├──► M5 (Sun/Gravity)
                                                         ├──► M6 (Snot) ──► M10 (All Ships)
                                                         └──► M7 (Pooling/FX) ──► M8 (Asteroids)
                                                                             └──► M12 (Sound)
```
