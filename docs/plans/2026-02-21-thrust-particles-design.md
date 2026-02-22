# Thrust Particle System Design

## Goal

Add a thrust exhaust visual to the ship when the player holds the thrust key, matching the original C++ game's particle emitter behavior.

## Original Game Reference

The original uses an Irrlicht `IParticleSystemSceneNode` attached to each player:
- Box emitter at `(0, -25, 0)` relative to ship (behind)
- 20-60 particles/sec, 200-400ms lifetime
- Texture: `thrust_test01.jpg` (white, 3.8KB)
- Blend: transparent vertex alpha with fade-out affector
- Toggled on/off via `setEmitter(null)` when thrust stops

## Approach: THREE.Points Pool

Single `THREE.Points` geometry with a fixed pool of 60 particles. One draw call for all thrust particles.

### Particle Pool

| Property | Value |
|----------|-------|
| Pool size | 60 |
| Emit rate | ~40/sec |
| Lifetime | 200-400ms (randomized) |
| Spawn offset | 25 units behind ship heading |
| Spread | +/-3 units perpendicular to heading |
| Initial velocity | 0 (particles are stationary, ship moves away) |

### Rendering

| Property | Value |
|----------|-------|
| Texture | `thrust_test01.jpg` (copied from original) |
| Material | `THREE.PointsMaterial` |
| Blending | Additive |
| Size | 20 |
| Size attenuation | true |
| Depth write | false |
| Opacity | Per-particle, linear fade 1.0 -> 0.0 over lifetime |

### ThrustEffect Class

```
ThrustEffect
  - positions: Float32Array (60 * 3)
  - opacities: Float32Array (60)
  - birthTimes: Float32Array (60)
  - lifetimes: Float32Array (60)
  - points: THREE.Points
  - nextIndex: number (ring buffer)
  - timeSinceLastEmit: number

  constructor(texture: THREE.Texture)
  update(dt, isThrusting, shipX, shipY, shipAngle)
  dispose()
```

### Lifecycle

- **Thrusting:** Spawn particles at emit rate behind ship, randomize lifetime and perpendicular offset
- **Not thrusting:** Stop spawning, existing particles continue fading naturally
- **Dead particles:** Opacity 0, position off-screen, slot reusable via ring buffer

### Integration

- Purely visual — no changes to Entity, Player, or game logic
- Created once in `main.ts` after scene setup
- Updated each frame: `thrustEffect.update(dt, input.thrust, player.position, player.angle)`

## Files Affected

| File | Change |
|------|--------|
| `src/game/ThrustEffect.ts` | New — particle pool class |
| `src/game/ThrustEffect.test.ts` | New — unit tests |
| `src/main.ts` | Create ThrustEffect, call update in game loop |
| `public/textures/thrust_test01.jpg` | Copied from original assets |
