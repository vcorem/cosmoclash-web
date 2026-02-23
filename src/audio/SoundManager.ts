import { SoundEffect, SOUND_CONFIG } from './SoundEffect';

export class SoundManager {
  private static instance: SoundManager | null = null;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private buffers = new Map<SoundEffect, AudioBuffer>();
  private musicBuffers = new Map<string, AudioBuffer>();
  private musicSource: AudioBufferSourceNode | null = null;
  private currentMusicKey: string | null = null;

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

  async preload(): Promise<void> {
    const ctx = this.ensureContext();

    // Preload SFX
    const sfxEntries = Object.values(SoundEffect) as SoundEffect[];
    const sfxPromises = sfxEntries.map(async (effect) => {
      const config = SOUND_CONFIG[effect];
      try {
        const resp = await fetch(config.file);
        const arrayBuf = await resp.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(arrayBuf);
        this.buffers.set(effect, audioBuf);
      } catch {
        console.warn(`Failed to load sound: ${config.file}`);
      }
    });

    // Preload music
    const musicFiles: Record<string, string> = {
      intro: '/sounds/Melee_Intro.ogg',
      battle: '/sounds/MeleeTheme.ogg',
    };
    const musicPromises = Object.entries(musicFiles).map(async ([key, file]) => {
      try {
        const resp = await fetch(file);
        const arrayBuf = await resp.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(arrayBuf);
        this.musicBuffers.set(key, audioBuf);
      } catch {
        console.warn(`Failed to load music: ${file}`);
      }
    });

    await Promise.all([...sfxPromises, ...musicPromises]);
  }

  play(effect: SoundEffect): void {
    const buf = this.buffers.get(effect);
    if (!buf || this.muted) return;
    const ctx = this.ensureContext();
    const source = ctx.createBufferSource();
    source.buffer = buf;
    // Per-sound volume via a temporary gain node
    const vol = ctx.createGain();
    vol.gain.value = SOUND_CONFIG[effect].volume;
    vol.connect(this.sfxGain!);
    source.connect(vol);
    source.start();
  }

  playMusic(key: string): void {
    if (this.currentMusicKey === key) return;
    this.stopMusic();
    const buf = this.musicBuffers.get(key);
    if (!buf) return;
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
