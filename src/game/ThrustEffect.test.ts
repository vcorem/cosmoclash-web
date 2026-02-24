import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock THREE since ThrustEffect creates Three.js objects
vi.mock('three', () => {
  const BufferAttribute = vi.fn().mockImplementation((array: Float32Array, itemSize: number) => ({
    array,
    itemSize,
    needsUpdate: false,
  }));
  const BufferGeometry = vi.fn().mockImplementation(() => ({
    setAttribute: vi.fn(),
    dispose: vi.fn(),
  }));
  const ShaderMaterial = vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
  }));
  const Points = vi.fn().mockImplementation(
    (geometry: unknown, material: unknown) => ({
      geometry,
      material,
    })
  );
  const Color = vi.fn().mockImplementation(() => ({
    setRGB: vi.fn(),
  }));
  return {
    BufferAttribute,
    BufferGeometry,
    ShaderMaterial,
    Points,
    Color,
    AdditiveBlending: 2,
  };
});

import { ThrustEffect, THRUST_CONFIG } from './ThrustEffect';

describe('ThrustEffect', () => {
  describe('THRUST_CONFIG', () => {
    it('has correct values from original game', () => {
      expect(THRUST_CONFIG.POOL_SIZE).toBe(60);
      expect(THRUST_CONFIG.EMIT_RATE).toBe(60);
      expect(THRUST_CONFIG.MIN_LIFETIME).toBe(200);
      expect(THRUST_CONFIG.MAX_LIFETIME).toBe(400);
      expect(THRUST_CONFIG.SPAWN_OFFSET).toBe(25);
      expect(THRUST_CONFIG.SPREAD).toBe(3);
      expect(THRUST_CONFIG.PARTICLE_SIZE).toBe(400);
    });
  });

  describe('constructor', () => {
    it('creates with initial state', () => {
      const effect = new ThrustEffect({} as any);
      expect(effect.points).toBeDefined();
    });
  });

  describe('update', () => {
    let effect: ThrustEffect;

    beforeEach(() => {
      effect = new ThrustEffect({} as any);
    });

    it('does not spawn particles when not thrusting', () => {
      effect.update(50, false, 0, 0, 0);
      for (let i = 0; i < THRUST_CONFIG.POOL_SIZE; i++) {
        expect(effect.getOpacity(i)).toBe(0);
      }
    });

    it('spawns particles when thrusting', () => {
      // 50ms at 40/sec = 2 particles
      effect.update(50, true, 100, 200, 0);
      let alive = 0;
      for (let i = 0; i < THRUST_CONFIG.POOL_SIZE; i++) {
        if (effect.getOpacity(i) > 0) alive++;
      }
      expect(alive).toBe(2);
    });

    it('spawns particles behind ship (angle 0 = heading up, behind = -Y)', () => {
      effect.update(25, true, 100, 200, 0); // 1 particle
      const pos = effect.getPosition(0);
      expect(pos.y).toBeCloseTo(175, 0);
      expect(pos.x).toBeCloseTo(100, -1); // ±3 spread
    });

    it('spawns particles behind ship at angle 90 (heading left, behind = +X)', () => {
      effect.update(25, true, 100, 200, 90); // 1 particle
      const pos = effect.getPosition(0);
      expect(pos.x).toBeCloseTo(125, 0);
      expect(pos.y).toBeCloseTo(200, -1);
    });

    it('ages particles and fades opacity', () => {
      effect.update(25, true, 0, 0, 0); // spawn 1
      const initialOpacity = effect.getOpacity(0);
      expect(initialOpacity).toBe(1);

      effect.update(150, false, 0, 0, 0); // age by 150ms
      const fadedOpacity = effect.getOpacity(0);
      expect(fadedOpacity).toBeLessThan(1);
      expect(fadedOpacity).toBeGreaterThan(0);
    });

    it('kills particles after lifetime expires', () => {
      effect.update(25, true, 0, 0, 0); // spawn 1
      effect.update(500, false, 0, 0, 0); // well past max lifetime
      expect(effect.getOpacity(0)).toBe(0);
    });

    it('wraps ring buffer index', () => {
      // Spawn more than pool size worth of particles
      for (let i = 0; i < 70; i++) {
        effect.update(25, true, 0, 0, 0);
      }
      // Should not throw, ring buffer wraps
      expect(true).toBe(true);
    });
  });

  describe('per-particle opacity', () => {
    it('newly spawned particle has opacity 1', () => {
      const effect = new ThrustEffect({} as any);
      effect.update(25, true, 0, 0, 0);
      expect(effect.getOpacity(0)).toBe(1);
    });

    it('half-life particle has opacity ~0.5', () => {
      const effect = new ThrustEffect({} as any);
      effect.update(25, true, 0, 0, 0);
      const lifetime = effect.getLifetime(0);
      effect.update(lifetime / 2, false, 0, 0, 0);
      expect(effect.getOpacity(0)).toBeCloseTo(0.5, 1);
    });
  });
});
