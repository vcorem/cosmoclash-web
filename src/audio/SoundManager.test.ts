import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SoundManager } from './SoundManager';
import { SoundEffect } from './SoundEffect';

// Mock AudioContext
const mockGainNode = {
  gain: { value: 1, setValueAtTime: vi.fn() },
  connect: vi.fn(),
};
const mockSourceNode = {
  buffer: null as AudioBuffer | null,
  loop: false,
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  addEventListener: vi.fn(),
};
const mockAudioContext = {
  createGain: vi.fn(() => ({ ...mockGainNode })),
  createBufferSource: vi.fn(() => ({ ...mockSourceNode })),
  decodeAudioData: vi.fn(async (buf: ArrayBuffer) => buf as unknown as AudioBuffer),
  destination: {},
  state: 'running',
  resume: vi.fn(),
};

vi.stubGlobal('AudioContext', vi.fn(() => ({ ...mockAudioContext })));
vi.stubGlobal('fetch', vi.fn(async () => ({
  arrayBuffer: async () => new ArrayBuffer(8),
})));

describe('SoundManager', () => {
  beforeEach(() => {
    SoundManager.reset();
    localStorage.clear();
  });

  it('is a singleton', () => {
    const a = SoundManager.getInstance();
    const b = SoundManager.getInstance();
    expect(a).toBe(b);
  });

  it('preload resolves without error', async () => {
    const sm = SoundManager.getInstance();
    await expect(sm.preload()).resolves.toBeUndefined();
  });

  it('setMasterVolume clamps to 0-1', () => {
    const sm = SoundManager.getInstance();
    sm.setMasterVolume(0.5);
    expect(sm.getMasterVolume()).toBe(0.5);
    sm.setMasterVolume(-1);
    expect(sm.getMasterVolume()).toBe(0);
    sm.setMasterVolume(2);
    expect(sm.getMasterVolume()).toBe(1);
  });

  it('setMuted toggles mute state', () => {
    const sm = SoundManager.getInstance();
    expect(sm.isMuted()).toBe(false);
    sm.setMuted(true);
    expect(sm.isMuted()).toBe(true);
    sm.setMuted(false);
    expect(sm.isMuted()).toBe(false);
  });

  it('play does not throw before preload', () => {
    const sm = SoundManager.getInstance();
    expect(() => sm.play(SoundEffect.Hit)).not.toThrow();
  });

  it('persists volume to localStorage', () => {
    const sm = SoundManager.getInstance();
    sm.setMasterVolume(0.7);
    expect(localStorage.getItem('cosmoclash-volume')).toBe('0.7');
  });

  it('persists mute to localStorage', () => {
    const sm = SoundManager.getInstance();
    sm.setMuted(true);
    expect(localStorage.getItem('cosmoclash-muted')).toBe('true');
  });

  it('restores volume from localStorage', () => {
    localStorage.setItem('cosmoclash-volume', '0.3');
    localStorage.setItem('cosmoclash-muted', 'true');
    SoundManager.reset();
    const sm = SoundManager.getInstance();
    expect(sm.getMasterVolume()).toBe(0.3);
    expect(sm.isMuted()).toBe(true);
  });
});
