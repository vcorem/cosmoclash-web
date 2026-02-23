# M10 Design: MichiGichi Ship with Vertex Animation

**Date:** 2026-02-22
**Scope:** Add MichiGichi character (Player 1) alongside existing Gondi (Player 2). Full morph mechanic with animation, PlasmaBullet, and SunBullet.

## Decisions

- **Scope**: Player 1 = MichiGichi, Player 2 = Gondi. No character selection screen.
- **Conversion**: assimp export `.x` → glTF with animation tracks preserved.
- **PlasmaBullet**: Full original behavior (tracking, expanding collision, decaying damage, 80-frame animation).
- **Architecture**: `MichiGichiPlayer extends Player` subclass for morph logic.
- **Bullet system**: Extend `BulletConfig` with optional fields for dynamic behaviors (no bullet subclasses).

## 1. Asset Pipeline

### MichiGichi Mesh
- **Source**: `mediaflat/MichiGichi/michiGichi.x` (69K lines, 42-frame bone animation)
- **Texture**: `MichiGichiSingle.jpg`
- **Convert**: `assimp export michiGichi.x michiGichi.glb`
- **Output**: `public/models/michiGichi.glb`
- **Verify**: animation tracks preserved (rotation/scale/position per bone per keyframe)
- **Transform**: scale 2.0x, rotation -90° X (matching original C++ Load)

### PlasmaBullet Atlas
- **Source**: 80 frames `shot2_0000.jpg` → `shot2_0079.jpg`
- **Pack**: sprite atlas PNG with alpha derived from luminance
- **Output**: `public/textures/plasma_atlas.png`

### SunBullet Texture
- **Source**: `shot_test-01.jpg`
- **Convert**: PNG with alpha for additive blending
- **Output**: `public/textures/sun_shot.png`

## 2. MichiGichiPlayer Class

**File**: `src/game/MichiGichiPlayer.ts`

### Morph State Machine (4 states, matching C++)

| State | Frame | Speed | Weapon | Energy Cost |
|-------|-------|-------|--------|-------------|
| MICHI | 1 | 0.2 | Plasma | 0.24 |
| MICHI_TO_GICHI | 1→41 | 0.2 | Plasma | 0.24 |
| GICHI | 41 | 1.0 | Sun | 0.08 |
| GICHI_TO_MICHI | 41→1 | 1.0 | Sun | 0.08 |

- Secondary weapon button triggers morph (no projectile fired)
- Frame advancement: 20ms delay between frames (~840ms total transition)
- Stats swap at destination state (not during transition)
- Exposes `currentAnimFrame` for mesh sync

### Collision Spheres
Two spheres: `(0, -10, 0) r14` and `(0, 10, 0) r14`

### Stat Configs
```
MICHI_STATS: speedMaxScaler 0.2, rotationSpeed 0.3, accel 0.002, energyCost 0.24, weapon PLASMA
GICHI_STATS: speedMaxScaler 1.0, rotationSpeed 0.5, accel 0.002, energyCost 0.08, weapon SUN
```

### Animation Integration (Three.js)
- Load glTF with GLTFLoader, extract `gltf.animations[0]`
- Create `THREE.AnimationMixer` attached to mesh
- Use `mixer.clipAction(clip)` with manual time control
- Per frame: `action.time = (currentAnimFrame / 42) * clip.duration`
- Call `mixer.update(0)` to apply pose without auto-advance

## 3. New Bullet Types

### PlasmaBullet (Michi form primary)
```
speedMaxScaler: 0.3, maxTtl: 10000, damage: 0.3 (decays), collisionRadius: 0→70 (expands)
```
- **Tracking**: steers toward nearest non-origin player each update
- **Expanding collision**: `radius = ((fullTtl - ttl) / fullTtl) * 70`
- **Decaying damage**: `damage = (ttl / fullTtl) * 0.3`
- **Animated sprite**: 80-frame atlas, fast fade-in (0-41 @ 0.4), slow loop (41-79 @ 0.03)
- **Sprite scaling**: grows 20→30 units with age
- **Bullet interaction**: plasma-plasma collision reduces TTL by 100ms

### SunBullet (Gichi form primary)
```
speedMaxScaler: 1.5, maxTtl: 1000, damage: 0.1, collisionRadius: 2
```
- Straight-line, no tracking
- Small glowing sprite (10x10) with additive blending

### BulletConfig Extension
Add optional fields to existing `BulletConfig`:
```typescript
tracking?: boolean;
expandingRadius?: { min: number; max: number };
decayingDamage?: { initial: number };
animatedSprite?: { atlas: string; cols: number; rows: number; frameSpeed: number };
```

`Bullet.update()` applies dynamic behaviors when optional fields are present.

## 4. Integration (main.ts)

- **Player 1**: `new MichiGichiPlayer(MICHI_STATS)` + load `michiGichi.glb` with AnimationMixer
- **Player 2**: `new Player(GONDI_STATS)` + load `gondi.glb` (unchanged)
- **Mesh sync**: existing `syncMesh()` for position/rotation + animation frame sync via `mixer.setTime()` for MichiGichi
- **Bullet sprites**: differentiate material by config type (plasma=animated atlas, sun=small glow, flame=existing)
- **Secondary weapon**: `instanceof MichiGichiPlayer` → `triggerMorph()`, else fire snot

## 5. Testing

### Unit Tests
- `MichiGichiPlayer.test.ts`: morph state transitions, stat swapping, frame timing, secondary triggers morph
- `Bullet.test.ts` (extend): plasma tracking, expanding collision, decaying damage; sun bullet basics

### Integration Tests
- Dual collision spheres in collision detection
- Plasma tracking steers toward target
- Plasma-plasma TTL reduction

### Visual (Playwright)
- MichiGichi renders and morphs
- New bullet sprites render correctly

## Files

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/game/MichiGichiPlayer.ts` | Morph state machine subclass |
| Create | `src/game/MichiGichiPlayer.test.ts` | Morph mechanic tests |
| Modify | `src/game/Bullet.ts` | Optional config fields, dynamic behaviors |
| Modify | `src/game/Bullet.test.ts` | Plasma/sun bullet tests |
| Modify | `src/main.ts` | P1=MichiGichi, animation sync, bullet differentiation |
| Create | `public/models/michiGichi.glb` | Converted mesh with animation |
| Create | `public/textures/plasma_atlas.png` | 80-frame plasma atlas |
| Create | `public/textures/sun_shot.png` | Sun bullet texture |
