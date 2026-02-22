# Milestone 10: Additional Ships & Weapons

**Goal:** All 8 playable characters with their unique stats and weapon loadouts.

**Depends on:** Milestone 6 (Snot Mechanic)

## Scope

### Character Stats

| Character | Speed | Accel | Rot Speed | Primary | Secondary | Primary Cost |
|-----------|-------|-------|-----------|---------|-----------|--------------|
| Neo | 0.8 | 0.004 | 0.5 | Plasma | Snot | 0.08 |
| Orca | 0.8 | 0.004 | 0.5 | Plasma | Snot | 0.08 |
| Ptera | 0.8 | 0.004 | 0.5 | Plasma | Snot | 0.08 |
| Lepid | 0.8 | 0.004 | 0.5 | Plasma | Snot | 0.08 |
| Gondi | 1.2 | 0.004 | 0.5 | Flame | Snot | 0.12 |
| Tiktok | 0.8 | 0.004 | 0.5 | Plasma | Snot | 0.08 |
| Sholev | 0.8 | 0.004 | 0.5 | Ice | Frost | 0.07 |
| Phyto | 0.8 | 0.004 | 0.5 | Plasma | Snot | 0.08 |

### Collision Spheres (per character)

| Character | Spheres |
|-----------|---------|
| Neo | 1: (0,0,0) r14 |
| Orca | 5: (0,15,0) r6, (0,0,0) r14, (0,-20,0) r6.2, (0,-40,0) r5, (0,-30,0) r8 |
| Ptera | 1: (0,0,0) r14 |
| Lepid | 1: (0,0,0) r14 |
| Gondi | 1: (0,0,0) r14 |
| Tiktok | 3: (0,5,0) r5, (0,0,0) r5, (0,-9,0) r7 |
| Sholev | 1: (0,0,0) r10 |
| Phyto | 1: (0,6,0) r14 |

### Character-Specific Weapons

**Flame Bullet (Gondi primary):**
- Particle emitter-based fire effect
- Collision sphere: radius 11 at offset (0, -25, 0)
- Affects target mobility on hit
- Higher energy cost (0.12)

**Ice Bullet (Sholev primary):**
- Projectile with ice texture
- Can attach to targets (slow effect)
- Energy cost: 0.07

**Frost Shield (Sholev secondary):**
- Stationary shield around the player
- Speed: 0.0 (doesn't fly — stays at player position)
- TTL: 500,000ms (effectively permanent until destroyed)
- Blocks incoming projectiles
- Requires 0.25 minimum energy to activate
- Energy cost: 0.0 after activation (free to maintain)

### Asset Conversion
- Convert all 8 ship meshes from DirectX .x to glTF/GLB
- Source: `../turtle_svn/trunk/Turtle/mediaflat/<character>/`
- Each character has unique mesh and texture
- Apply per-character base orientation (found empirically, like Gondi's (0, 270, 90))

### Character Selection
- Simple pre-game screen: each player picks a character
- Can be as simple as a numbered list with keyboard selection

## Out of Scope
- Character-specific AI behavior (Milestone 11)
- Character-specific sound effects (Milestone 12)
- Balancing/stat tweaks

## Original C++ Reference
- `Characters/` — one .h/.cpp per character with stats and collision spheres
- `Bullets/FlameBullet.h/cpp` — flame weapon
- `Bullets/IceBullet.h/cpp` — ice weapon
- `Bullets/FrostBullet.h/cpp` — frost shield
- `mediaflat/` — per-character model directories
