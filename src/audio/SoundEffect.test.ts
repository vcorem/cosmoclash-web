import { describe, it, expect } from 'vitest';
import { SoundEffect, SOUND_CONFIG } from './SoundEffect';

describe('SoundEffect', () => {
  it('defines all 14 sound effects', () => {
    const values = Object.values(SoundEffect).filter(v => typeof v === 'string');
    expect(values.length).toBe(14);
  });

  it('has config entry for every sound effect', () => {
    const enumValues = Object.values(SoundEffect).filter(v => typeof v === 'string') as string[];
    for (const name of enumValues) {
      const entry = SOUND_CONFIG[name as SoundEffect];
      expect(entry, `missing config for ${name}`).toBeDefined();
      expect(entry.file).toBeTruthy();
      expect(entry.volume).toBeGreaterThan(0);
      expect(entry.volume).toBeLessThanOrEqual(1);
    }
  });
});
