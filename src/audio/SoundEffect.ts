export enum SoundEffect {
  PlasmaShot = 'PlasmaShot',
  FlameShot = 'FlameShot',
  IceShot = 'IceShot',
  FrostShot = 'FrostShot',
  SunShot = 'SunShot',
  SnotShot = 'SnotShot',
  Hit = 'Hit',
  SnotHit = 'SnotHit',
  AsteroidHit = 'AsteroidHit',
  SunBoom = 'SunBoom',
  Explosion = 'Explosion',
  ExplosionBig = 'ExplosionBig',
  MorphOpen = 'MorphOpen',
  MorphClose = 'MorphClose',
}

export interface SoundConfig {
  file: string;
  volume: number;
}

export const SOUND_CONFIG: Record<SoundEffect, SoundConfig> = {
  [SoundEffect.PlasmaShot]:  { file: '/sounds/MichiGichiPlazma-5.ogg', volume: 0.6 },
  [SoundEffect.FlameShot]:   { file: '/sounds/GondiFire.wav', volume: 0.5 },
  [SoundEffect.IceShot]:     { file: '/sounds/Sholev-IceConus-Shoot.ogg', volume: 0.3 },
  [SoundEffect.FrostShot]:   { file: '/sounds/Sholevice-1.wav', volume: 0.5 },
  [SoundEffect.SunShot]:     { file: '/sounds/Shoot-5.ogg', volume: 0.3 },
  [SoundEffect.SnotShot]:    { file: '/sounds/Shoot-3.ogg', volume: 0.3 },
  [SoundEffect.Hit]:         { file: '/sounds/Damage.ogg', volume: 0.6 },
  [SoundEffect.SnotHit]:     { file: '/sounds/Gondi-Nidbak5.ogg', volume: 0.6 },
  [SoundEffect.AsteroidHit]: { file: '/sounds/Asteroid-4.ogg', volume: 0.6 },
  [SoundEffect.SunBoom]:     { file: '/sounds/SunBoom-1.ogg', volume: 0.9 },
  [SoundEffect.Explosion]:   { file: '/sounds/BigExplosion-2.wav', volume: 1.0 },
  [SoundEffect.ExplosionBig]:{ file: '/sounds/bigang.wav', volume: 1.0 },
  [SoundEffect.MorphOpen]:   { file: '/sounds/MichiGichiOpen-2.ogg', volume: 0.6 },
  [SoundEffect.MorphClose]:  { file: '/sounds/MichiGichiClose-1.ogg', volume: 0.6 },
};
