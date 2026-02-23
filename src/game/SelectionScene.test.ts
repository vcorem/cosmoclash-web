// src/game/SelectionScene.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Three.js and GLTFLoader
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  return { ...actual };
});

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: vi.fn().mockImplementation(() => ({
    load: vi.fn((_url: string, onLoad: (gltf: any) => void) => {
      const scene = {
        clone: () => ({
          scale: { set: vi.fn() },
          rotation: { set: vi.fn() },
          traverse: vi.fn(),
        }),
        scale: { set: vi.fn() },
        rotation: { set: vi.fn() },
        traverse: vi.fn(),
      };
      onLoad({ scene, animations: [] });
    }),
  })),
}));

import { SelectionScene, SelectionState } from './SelectionScene';
import { CHARACTER_REGISTRY } from './CharacterRegistry';

describe('SelectionScene', () => {
  it('starts in SELECTING_P2 state', () => {
    const sel = new SelectionScene();
    expect(sel.state).toBe(SelectionState.SELECTING_P2);
  });

  it('initially selects index 0', () => {
    const sel = new SelectionScene();
    expect(sel.currentIndex).toBe(0);
  });

  it('cycles selection right', () => {
    const sel = new SelectionScene();
    sel.selectNext();
    expect(sel.currentIndex).toBe(1 % CHARACTER_REGISTRY.length);
  });

  it('cycles selection left', () => {
    const sel = new SelectionScene();
    sel.selectPrev();
    expect(sel.currentIndex).toBe(CHARACTER_REGISTRY.length - 1);
  });

  it('wraps around at boundaries', () => {
    const sel = new SelectionScene();
    sel.selectPrev();
    expect(sel.currentIndex).toBe(CHARACTER_REGISTRY.length - 1);
    sel.selectNext();
    expect(sel.currentIndex).toBe(0);
  });

  it('confirmSelection advances from P2 to P1', () => {
    const sel = new SelectionScene();
    expect(sel.state).toBe(SelectionState.SELECTING_P2);
    sel.confirmSelection();
    expect(sel.state).toBe(SelectionState.SELECTING_P1);
    expect(sel.p2CharIndex).toBe(0);
  });

  it('confirmSelection from P1 advances to DONE', () => {
    const sel = new SelectionScene();
    sel.confirmSelection(); // P2 done
    sel.selectNext();
    sel.confirmSelection(); // P1 done
    expect(sel.state).toBe(SelectionState.DONE);
    expect(sel.p1CharIndex).toBeDefined();
  });

  it('returns selected character defs', () => {
    const sel = new SelectionScene();
    sel.confirmSelection(); // P2 picks index 0
    sel.selectNext();       // P1 moves to index 1
    sel.confirmSelection(); // P1 picks index 1
    const { p1Def, p2Def } = sel.getSelections();
    expect(p1Def.id).toBe(CHARACTER_REGISTRY[1].id);
    expect(p2Def.id).toBe(CHARACTER_REGISTRY[0].id);
  });
});
