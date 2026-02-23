# M12 Sound Design

## Approach

Raw Web Audio API — no dependencies. `AudioContext` + `AudioBuffer` for SFX, looping `AudioBufferSourceNode` for music. All sounds are 2D stereo (no positional audio).

## SoundManager Singleton

**File:** `src/audio/SoundManager.ts`

- Creates `AudioContext` on first user gesture (handles autoplay policy)
- Preloads all 14 SFX + 2 music tracks as `AudioBuffer`s
- `play(sound: SoundEffect)` — fire-and-forget via `AudioBufferSourceNode` → sfxGain → masterGain
- Music via dedicated source node with `loop=true`, separate musicGain node
- Mute toggle (M key), volume persisted in `localStorage`

**Audio graph:**
```
SFX sources ──→ sfxGain ──→ masterGain ──→ destination
Music source ──→ musicGain ──→ masterGain ──→ destination
```

## Sound Effects

| SoundEffect enum | File | Volume | Trigger |
|---|---|---|---|
| PlasmaShot | MichiGichiPlazma-5.ogg | 0.6 | Primary fire (plasma config) |
| FlameShot | GondiFire.wav | 0.5 | Primary fire (flame config) |
| IceShot | Sholev-IceConus-Shoot.ogg | 0.3 | Primary fire (ice config) |
| FrostShot | Sholevice-1.wav | 0.5 | Primary fire (frost config) |
| SunShot | Shoot-5.ogg | 0.3 | Primary fire (sun config) |
| SnotShot | Shoot-3.ogg | 0.3 | Secondary fire (snot) |
| Hit | Damage.ogg | 0.6 | Bullet hits player |
| SnotHit | Gondi-Nidbak5.ogg | 0.6 | Snot attaches to player |
| AsteroidHit | Asteroid-4.ogg | 0.6 | Player-asteroid collision |
| SunBoom | SunBoom-1.ogg | 0.9 | Entity hits sun |
| Explosion | BigExplosion-2.wav | 1.0 | Asteroid destroyed |
| ExplosionBig | bigang.wav | 1.0 | Player death |
| MorphOpen | MichiGichiOpen-2.ogg | 0.6 | MICHI→GICHI morph |
| MorphClose | MichiGichiClose-1.ogg | 0.6 | GICHI→MICHI morph |

## Music Tracks

| Track | File | Volume | When |
|---|---|---|---|
| Intro | Melee_Intro.ogg | 0.5 | Menu/selection screens |
| Battle | MeleeTheme.ogg | 0.5 | During gameplay |

## Integration Points

1. **Weapon fire** — Direct `SoundManager.play()` in `main.ts` after `acquireBullet()`/`acquireSnot()`, sound chosen by bullet config type
2. **Morph** — Direct call at `triggerMorph()` in `main.ts`, MorphOpen or MorphClose based on current MichiGichi state
3. **Collision sounds** — SoundManager registers as `GameEventListener` for BulletHit, SnotHit, SunCollision, Explosion events
4. **Music transitions** — `playMusic('intro'|'battle')` in game state transition logic in `main.ts`

## Asset Pipeline

- Copy OGG files directly from `mediaflat/sounds/` to `public/sounds/`
- Convert WAV files to OGG: `ffmpeg -i input.wav -c:a libvorbis -q:a 6 output.ogg`
- Keep WAV as fallback if needed (browsers support both)

## User Controls

- **M key** — toggle mute
- Volume level persisted in `localStorage` key `cosmoclash-volume`
- Mute state persisted in `localStorage` key `cosmoclash-muted`
