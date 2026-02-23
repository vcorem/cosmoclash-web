import { SoundEffect, SOUND_CONFIG } from './SoundEffect';

export class SoundManager {
  private static instance: SoundManager | null = null;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private buffers = new Map<SoundEffect, AudioBuffer>();
  private musicBuffers = new Map<string, AudioBuffer>();
  private rawBuffers = new Map<string, ArrayBuffer>(); // raw fetched data before decode
  private musicSource: AudioBufferSourceNode | null = null;
  private currentMusicKey: string | null = null;
  private preloadPromise: Promise<void> | null = null;
  private pendingMusicKey: string | null = null;
  private decoded = false;

  private masterVolume: number;
  private muted: boolean;

  private constructor() {
    this.masterVolume = parseFloat(localStorage.getItem('cosmoclash-volume') ?? '1');
    this.muted = localStorage.getItem('cosmoclash-muted') === 'true';
    if (isNaN(this.masterVolume)) this.masterVolume = 1;
    this.masterVolume = Math.max(0, Math.min(1, this.masterVolume));
  }

  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  static reset(): void {
    SoundManager.instance = null;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.masterGain);
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.masterGain);
      this.applyVolume();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  preload(): Promise<void> {
    if (this.preloadPromise) return this.preloadPromise;
    this.preloadPromise = this.doPreload();
    return this.preloadPromise;
  }

  private async doPreload(): Promise<void> {
    // Phase 1: Fetch raw ArrayBuffers (no AudioContext needed)
    const sfxEntries = Object.values(SoundEffect) as SoundEffect[];
    const sfxPromises = sfxEntries.map(async (effect) => {
      const config = SOUND_CONFIG[effect];
      try {
        const resp = await fetch(config.file);
        const arrayBuf = await resp.arrayBuffer();
        this.rawBuffers.set(`sfx:${effect}`, arrayBuf);
      } catch {
        console.warn(`Failed to load sound: ${config.file}`);
      }
    });

    const musicFiles: Record<string, string> = {
      intro: '/sounds/Melee_Intro.ogg',
      battle: '/sounds/MeleeTheme.ogg',
    };
    const musicPromises = Object.entries(musicFiles).map(async ([key, file]) => {
      try {
        const resp = await fetch(file);
        const arrayBuf = await resp.arrayBuffer();
        this.rawBuffers.set(`music:${key}`, arrayBuf);
      } catch {
        console.warn(`Failed to load music: ${file}`);
      }
    });

    await Promise.all([...sfxPromises, ...musicPromises]);
  }

  /** Decode raw ArrayBuffers into AudioBuffers (requires AudioContext from user gesture) */
  private async decodeAll(): Promise<void> {
    if (this.decoded) return;
    this.decoded = true;
    const ctx = this.ensureContext();

    const promises: Promise<void>[] = [];
    for (const [key, raw] of this.rawBuffers) {
      promises.push((async () => {
        try {
          const audioBuf = await ctx.decodeAudioData(raw);
          if (key.startsWith('sfx:')) {
            this.buffers.set(key.slice(4) as SoundEffect, audioBuf);
          } else if (key.startsWith('music:')) {
            this.musicBuffers.set(key.slice(6), audioBuf);
          }
        } catch {
          console.warn(`Failed to decode: ${key}`);
        }
      })());
    }
    await Promise.all(promises);
    this.rawBuffers.clear();

    // Play any music that was requested before decode finished
    if (this.pendingMusicKey) {
      const key = this.pendingMusicKey;
      this.pendingMusicKey = null;
      this.playMusic(key);
    }
  }

  play(effect: SoundEffect): void {
    if (!this.decoded) this.decodeAll();
    const buf = this.buffers.get(effect);
    if (!buf || this.muted) return;
    const ctx = this.ensureContext();
    const source = ctx.createBufferSource();
    source.buffer = buf;
    const vol = ctx.createGain();
    vol.gain.value = SOUND_CONFIG[effect].volume;
    vol.connect(this.sfxGain!);
    source.connect(vol);
    source.start();
  }

  playMusic(key: string): void {
    if (this.currentMusicKey === key) return;
    this.stopMusic();

    // If not decoded yet, trigger decode (creates AudioContext from user gesture) and queue
    if (!this.decoded) {
      this.pendingMusicKey = key;
      this.decodeAll();
      return;
    }

    const buf = this.musicBuffers.get(key);
    if (!buf) {
      this.pendingMusicKey = key;
      return;
    }
    const ctx = this.ensureContext();
    this.musicSource = ctx.createBufferSource();
    this.musicSource.buffer = buf;
    this.musicSource.loop = true;
    this.musicSource.connect(this.musicGain!);
    this.musicSource.start();
    this.currentMusicKey = key;
  }

  stopMusic(): void {
    if (this.musicSource) {
      try { this.musicSource.stop(); } catch { /* already stopped */ }
      this.musicSource = null;
    }
    this.currentMusicKey = null;
  }

  setMasterVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    localStorage.setItem('cosmoclash-volume', String(this.masterVolume));
    this.applyVolume();
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    localStorage.setItem('cosmoclash-muted', String(m));
    this.applyVolume();
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): void {
    this.setMuted(!this.muted);
  }

  private applyVolume(): void {
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    }
  }
}
