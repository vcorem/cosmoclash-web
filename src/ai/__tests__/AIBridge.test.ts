// src/ai/__tests__/AIBridge.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  getAIEntityType,
  getSpeedOfShot,
  getMaxTtlOfShot,
  getMaxDistanceOfShot,
  getMorphState,
  buildPlayerTable,
} from '../AIBridge';
import { AI_ENTITY_TYPES } from '../AIConstants';
import { MorphState } from '@/game/MichiGichiPlayer';
import { CharacterDef } from '@/game/CharacterRegistry';

// Minimal CharacterDef factories
function michiDef(): CharacterDef {
  return { id: 'michiGichi', name: 'MichiGichi', weapon: '', special: '', modelPath: '', modelScale: 1, modelRotation: [0, 0, 0], isMichiGichi: true };
}
function gondiDef(): CharacterDef {
  return { id: 'gondi', name: 'Gondi', weapon: '', special: '', modelPath: '', modelScale: 1, modelRotation: [0, 0, 0], isMichiGichi: false };
}
function sholevDef(): CharacterDef {
  return { id: 'sholev', name: 'Sholev', weapon: '', special: '', modelPath: '', modelScale: 1, modelRotation: [0, 0, 0], isMichiGichi: false };
}
function neoDef(): CharacterDef {
  return { id: 'neo', name: 'Neo', weapon: '', special: '', modelPath: '', modelScale: 1, modelRotation: [0, 0, 0], isMichiGichi: false };
}

describe('getAIEntityType', () => {
  it('returns MITCHIGITCHI for MichiGichi', () => {
    expect(getAIEntityType(michiDef())).toBe(AI_ENTITY_TYPES.MITCHIGITCHI);
  });
  it('returns GONDI for Gondi', () => {
    expect(getAIEntityType(gondiDef())).toBe(AI_ENTITY_TYPES.GONDI);
  });
  it('returns SHOLEV for Sholev', () => {
    expect(getAIEntityType(sholevDef())).toBe(AI_ENTITY_TYPES.SHOLEV);
  });
  it('returns 0 for other characters (Neo, Orca, etc)', () => {
    expect(getAIEntityType(neoDef())).toBe(0);
  });
});

describe('getSpeedOfShot', () => {
  it('MichiGichi MICHI mode = 0.2 (plasma)', () => {
    expect(getSpeedOfShot(AI_ENTITY_TYPES.MITCHIGITCHI, MorphState.MICHI)).toBe(0.2);
  });
  it('MichiGichi GICHI mode = 0.525 (sun)', () => {
    expect(getSpeedOfShot(AI_ENTITY_TYPES.MITCHIGITCHI, MorphState.GICHI)).toBe(0.525);
  });
  it('MichiGichi GICHI_TO_MICHI = 0.2 (transitioning back to slow)', () => {
    expect(getSpeedOfShot(AI_ENTITY_TYPES.MITCHIGITCHI, MorphState.GICHI_TO_MICHI)).toBe(0.2);
  });
  it('MichiGichi MICHI_TO_GICHI = 0.525 (transitioning to fast)', () => {
    expect(getSpeedOfShot(AI_ENTITY_TYPES.MITCHIGITCHI, MorphState.MICHI_TO_GICHI)).toBe(0.525);
  });
  it('MichiGichi with no morphState defaults to 0.525', () => {
    expect(getSpeedOfShot(AI_ENTITY_TYPES.MITCHIGITCHI)).toBe(0.525);
  });
  it('Gondi = 0.18 (flame)', () => {
    expect(getSpeedOfShot(AI_ENTITY_TYPES.GONDI)).toBe(0.18);
  });
  it('Sholev = 0.6 (ice cones)', () => {
    expect(getSpeedOfShot(AI_ENTITY_TYPES.SHOLEV)).toBe(0.6);
  });
  it('others = 0.525 (sun bullet)', () => {
    expect(getSpeedOfShot(0)).toBe(0.525);
  });
});

describe('getMaxTtlOfShot', () => {
  it('MichiGichi MICHI = 5000 (plasma)', () => {
    expect(getMaxTtlOfShot(AI_ENTITY_TYPES.MITCHIGITCHI, MorphState.MICHI)).toBe(5000);
  });
  it('MichiGichi GICHI = 1000 (sun)', () => {
    expect(getMaxTtlOfShot(AI_ENTITY_TYPES.MITCHIGITCHI, MorphState.GICHI)).toBe(1000);
  });
  it('Gondi = 700', () => {
    expect(getMaxTtlOfShot(AI_ENTITY_TYPES.GONDI)).toBe(700);
  });
  it('Sholev = 700', () => {
    expect(getMaxTtlOfShot(AI_ENTITY_TYPES.SHOLEV)).toBe(700);
  });
  it('others = 1000', () => {
    expect(getMaxTtlOfShot(0)).toBe(1000);
  });
});

describe('getMaxDistanceOfShot', () => {
  it('MichiGichi MICHI = 5000 * 0.2 = 1000', () => {
    expect(getMaxDistanceOfShot(AI_ENTITY_TYPES.MITCHIGITCHI, MorphState.MICHI)).toBe(1000);
  });
  it('MichiGichi GICHI = 1000 * 0.525 = 525', () => {
    expect(getMaxDistanceOfShot(AI_ENTITY_TYPES.MITCHIGITCHI, MorphState.GICHI)).toBe(525);
  });
  it('Gondi = 700 * 0.18 = 126', () => {
    expect(getMaxDistanceOfShot(AI_ENTITY_TYPES.GONDI)).toBeCloseTo(126, 1);
  });
  it('Sholev = 700 * 0.6 = 420', () => {
    expect(getMaxDistanceOfShot(AI_ENTITY_TYPES.SHOLEV)).toBe(420);
  });
  it('others = 1000 * 0.525 = 525', () => {
    expect(getMaxDistanceOfShot(0)).toBe(525);
  });
});

describe('getMorphState', () => {
  it('returns undefined for a regular Player', () => {
    // Create a minimal mock Player (not MichiGichiPlayer)
    const mockPlayer = { constructor: { name: 'Player' } } as any;
    expect(getMorphState(mockPlayer)).toBeUndefined();
  });
});
