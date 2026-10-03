import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InputManager, CAMPAIGN_BINDINGS } from './InputManager';

function press(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

function release(key: string) {
  window.dispatchEvent(new KeyboardEvent('keyup', { key }));
}

describe('InputManager', () => {
  let input: InputManager;

  beforeEach(() => {
    input = new InputManager();
  });

  afterEach(() => {
    input.destroy();
  });

  describe('Player 1 (Arrow keys + /)', () => {
    it('reports no input initially', () => {
      const p1 = input.player(0);
      expect(p1.thrust).toBe(false);
      expect(p1.rotateLeft).toBe(false);
      expect(p1.rotateRight).toBe(false);
      expect(p1.firePrimary).toBe(false);
    });

    it('detects ArrowUp as thrust', () => {
      press('ArrowUp');
      expect(input.player(0).thrust).toBe(true);
      release('ArrowUp');
      expect(input.player(0).thrust).toBe(false);
    });

    it('detects ArrowLeft as rotateLeft', () => {
      press('ArrowLeft');
      expect(input.player(0).rotateLeft).toBe(true);
    });

    it('detects ArrowRight as rotateRight', () => {
      press('ArrowRight');
      expect(input.player(0).rotateRight).toBe(true);
    });

    it('detects / as firePrimary', () => {
      press('/');
      expect(input.player(0).firePrimary).toBe(true);
      release('/');
      expect(input.player(0).firePrimary).toBe(false);
    });

    it('detects P1 secondary fire on period key', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '.' }));
      const pi = input.player(0);
      expect(pi.fireSecondary).toBe(true);
      window.dispatchEvent(new KeyboardEvent('keyup', { key: '.' }));
    });

    it('does NOT respond to P2 keys', () => {
      press('w');
      press('a');
      press('d');
      press(' ');
      const p1 = input.player(0);
      expect(p1.thrust).toBe(false);
      expect(p1.rotateLeft).toBe(false);
      expect(p1.rotateRight).toBe(false);
      expect(p1.firePrimary).toBe(false);
    });
  });

  describe('Player 2 (WASD + Space)', () => {
    it('detects w as thrust (case insensitive)', () => {
      press('w');
      expect(input.player(1).thrust).toBe(true);
      release('w');
      press('W');
      expect(input.player(1).thrust).toBe(true);
    });

    it('detects a as rotateLeft (case insensitive)', () => {
      press('a');
      expect(input.player(1).rotateLeft).toBe(true);
      release('a');
      press('A');
      expect(input.player(1).rotateLeft).toBe(true);
    });

    it('detects d as rotateRight (case insensitive)', () => {
      press('d');
      expect(input.player(1).rotateRight).toBe(true);
      release('d');
      press('D');
      expect(input.player(1).rotateRight).toBe(true);
    });

    it('detects Space as firePrimary', () => {
      press(' ');
      expect(input.player(1).firePrimary).toBe(true);
      release(' ');
      expect(input.player(1).firePrimary).toBe(false);
    });

    it('detects P2 secondary fire on Shift key', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
      const pi = input.player(1);
      expect(pi.fireSecondary).toBe(true);
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
    });

    it('does NOT respond to P1 keys', () => {
      press('ArrowUp');
      press('ArrowLeft');
      press('ArrowRight');
      press('/');
      const p2 = input.player(1);
      expect(p2.thrust).toBe(false);
      expect(p2.rotateLeft).toBe(false);
      expect(p2.rotateRight).toBe(false);
      expect(p2.firePrimary).toBe(false);
    });
  });

  describe('Shift + letter key case handling', () => {
    it('clears lowercase key when released with Shift held (uppercase keyup)', () => {
      // Press 'd' (lowercase, no Shift)
      press('d');
      expect(input.player(1).rotateRight).toBe(true);

      // Release D while Shift changes it to uppercase 'D'
      release('D');
      expect(input.player(1).rotateRight).toBe(false);
    });

    it('clears uppercase key when released without Shift (lowercase keyup)', () => {
      // Press 'D' (uppercase, Shift was held)
      press('D');
      expect(input.player(1).rotateRight).toBe(true);

      // Release d after Shift released (lowercase keyup)
      release('d');
      expect(input.player(1).rotateRight).toBe(false);
    });
  });

  describe('destroy', () => {
    it('stops tracking keys after destroy', () => {
      press('ArrowUp');
      input.destroy();
      press('ArrowLeft');
      expect(input.player(0).thrust).toBe(false);
      expect(input.player(0).rotateLeft).toBe(false);
    });
  });

  describe('campaign pilot and touch controls', () => {
    beforeEach(() => {
      input.destroy();
      input = new InputManager(CAMPAIGN_BINDINGS);
    });

    it('routes WASD, Space and Shift to Player 1 only', () => {
      press('w');
      press('a');
      press(' ');
      press('Shift');
      expect(input.player(0)).toMatchObject({ thrust: true, rotateLeft: true, firePrimary: true, fireSecondary: true });
      expect(Object.values(input.player(1)).every(value => !value)).toBe(true);
    });

    it('combines touch with keyboard and releases each source independently', () => {
      press('ArrowUp');
      input.setAction(0, 'thrust', true);
      release('ArrowUp');
      expect(input.player(0).thrust).toBe(true);
      input.setAction(0, 'thrust', false);
      expect(input.player(0).thrust).toBe(false);
    });

    it('clears held controls on pause and ignores campaign keys while idle', () => {
      press(' ');
      input.setAction(0, 'thrust', true);
      input.setEnabled(false);
      const event = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      input.setAction(0, 'rotateLeft', true);
      expect(Object.values(input.player(0)).every(value => !value)).toBe(true);
      input.setEnabled(true);
      expect(Object.values(input.player(0)).every(value => !value)).toBe(true);
    });
  });
});
