import { describe, it, expect } from 'vitest';
import { Explosion } from './Explosion';
import { EntityType } from '@/engine/Entity';
import { ARENA } from './Arena';

describe('Explosion', () => {
  describe('constructor', () => {
    it('has EntityType.Explosion', () => {
      const e = new Explosion();
      expect(e.entityType).toBe(EntityType.Explosion);
    });

    it('has no collision spheres', () => {
      const e = new Explosion();
      expect(e.collisionSpheres).toHaveLength(0);
    });

    it('starts at frame 0', () => {
      const e = new Explosion();
      expect(e.currentFrame).toBe(0);
    });

    it('has autoWrap enabled', () => {
      const e = new Explosion();
      expect(e.autoWrap).toBe(true);
    });
  });

  describe('update', () => {
    it('advances frame by animSpeed * dt', () => {
      const e = new Explosion();
      e.update(100);
      expect(e.currentFrame).toBeCloseTo(ARENA.EXPLOSION_ANIM_SPEED * 100);
    });

    it('does not move position (no physics)', () => {
      const e = new Explosion();
      e.position = { x: 50, y: 50, z: 0 };
      e.accelVec = { x: 1, y: 1, z: 0 };
      e.update(100);
      expect(e.position).toEqual({ x: 50, y: 50, z: 0 });
    });

    it('destroys itself when animation completes', () => {
      const e = new Explosion();
      e.update(2100);
      expect(e.currentFrame).toBeGreaterThan(ARENA.EXPLOSION_TOTAL_FRAMES);
      expect(e.alive).toBe(false);
    });

    it('stays alive during animation', () => {
      const e = new Explosion();
      e.update(100);
      expect(e.alive).toBe(true);
    });
  });

  describe('reset', () => {
    it('resets frame to 0 and marks alive', () => {
      const e = new Explosion();
      e.update(1000);
      e.reset();
      expect(e.currentFrame).toBe(0);
      expect(e.alive).toBe(true);
    });
  });
});
