import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InputManager } from './InputManager';

describe('InputManager', () => {
  let input: InputManager;

  beforeEach(() => {
    input = new InputManager();
  });

  afterEach(() => {
    input.destroy();
  });

  it('reports no keys pressed initially', () => {
    expect(input.isPressed('ArrowUp')).toBe(false);
    expect(input.isPressed('ArrowLeft')).toBe(false);
  });

  it('tracks keydown events', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(input.isPressed('ArrowUp')).toBe(true);
  });

  it('tracks keyup events', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp' }));
    expect(input.isPressed('ArrowUp')).toBe(false);
  });

  it('reports thrust from ArrowUp or w', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    expect(input.thrust).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
    expect(input.thrust).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(input.thrust).toBe(true);
  });

  it('reports rotateLeft from ArrowLeft or a', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(input.rotateLeft).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(input.rotateLeft).toBe(true);
  });

  it('reports rotateRight from ArrowRight or d', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    expect(input.rotateRight).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd' }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(input.rotateRight).toBe(true);
  });

  it('reports firePrimary from Space', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(input.firePrimary).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));
    expect(input.firePrimary).toBe(false);
  });

  it('cleans up listeners on destroy', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    input.destroy();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    // After destroy, state should be frozen at last known state
    // but no new events processed — we just check it doesn't throw
    expect(input.isPressed('ArrowLeft')).toBe(false);
  });
});
