# Milestone 12: Sound

**Goal:** Sound effects for all game actions and optional background music.

**Depends on:** Milestone 7 (Entity Pooling & Explosions)

## Scope

### Sound Effects (from original `CSoundSys`)

| Event | Sound | Trigger |
|-------|-------|---------|
| Plasma shot | PlayPlasmaShot() | Primary fire (most characters) |
| Flame shot | PlayFlame() | Gondi primary fire |
| Ice shot | PlayIceShot() | Sholev primary fire |
| Frost shield | PlayFrost() | Sholev secondary activation |
| Snot shot | PlayShot3() | Secondary fire (snot) |
| Small explosion | PlayExplosion() | Bullet impact, asteroid hit |
| Large explosion | PlayExplosionBig() | Player death |
| Hit impact | PlayHit() | Bullet hits player |
| Asteroid hit | PlayAsteroidHit() | Bullet hits asteroid |
| Snot attach | PlaySnotHit() | Snot attaches to player |
| Sun collision | PlaySunBoom() | Entity hits sun |

### Audio Implementation
- Use Web Audio API (or a lightweight library like Howler.js)
- Convert original WAV files from `mediaflat/sounds/` to OGG/MP3
- Preload all sounds at game start
- Simple sound manager with play/stop/volume control

### Sound Manager API
```typescript
class SoundManager {
  preload(): Promise<void>;
  play(sound: SoundEffect): void;
  setVolume(volume: number): void;  // 0-1
  setMuted(muted: boolean): void;
}
```

### Background Music
- Optional: loop a background track during gameplay
- Mute/volume controls
- Source: original music files if available

### User Controls
- Mute toggle key (e.g., `M`)
- Volume persisted in localStorage

## Out of Scope
- Positional/3D audio (all sounds play at full volume)
- Dynamic music that changes with game state
- Voice lines

## Original C++ Reference
- `Sound/SoundSys.h/cpp` — irrKlang-based sound system
- `mediaflat/sounds/` — WAV source files
- Various game files that call `PlayExplosion()`, `PlayHit()`, etc.
