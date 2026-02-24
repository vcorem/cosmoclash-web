// src/game/CharacterRegistry.test.ts
import { describe, it, expect } from 'vitest';
import { CHARACTER_REGISTRY, CharacterDef } from './CharacterRegistry';

describe('CharacterRegistry', () => {
  it('contains MichiGichi and Gondi', () => {
    const ids = CHARACTER_REGISTRY.map(c => c.id);
    expect(ids).toContain('michiGichi');
    expect(ids).toContain('gondi');
  });

  it('each entry has required fields', () => {
    for (const char of CHARACTER_REGISTRY) {
      expect(char.id).toBeTruthy();
      expect(char.name).toBeTruthy();
      expect(char.weapon).toBeTruthy();
      expect(char.special).toBeTruthy();
      expect(char.modelPath).toMatch(/\.glb$/);
      expect(char.modelScale).toBeGreaterThan(0);
    }
  });

  it('MichiGichi has correct weapon/special', () => {
    const michi = CHARACTER_REGISTRY.find(c => c.id === 'michiGichi')!;
    expect(michi.weapon).toBe('Plasma Blast');
    expect(michi.special).toBe('Transform between fast and weak / slow and strong');
  });

  it('Gondi has correct weapon/special', () => {
    const gondi = CHARACTER_REGISTRY.find(c => c.id === 'gondi')!;
    expect(gondi.weapon).toBe('Galactic Flame');
    expect(gondi.special).toBe('Space Slime');
  });

  it('Sholev has correct weapon/special', () => {
    const sholev = CHARACTER_REGISTRY.find(c => c.id === 'sholev')!;
    expect(sholev.weapon).toBe('Ice Cones');
    expect(sholev.special).toBe('Ramming Energy');
  });

  it('has exactly 3 characters', () => {
    expect(CHARACTER_REGISTRY).toHaveLength(3);
  });
});
