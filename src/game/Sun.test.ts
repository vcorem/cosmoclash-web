import { describe, it, expect } from 'vitest';
import { Sun } from './Sun';
import { EntityType } from '@/engine/Entity';
import { ARENA } from './Arena';

describe('Sun', () => {
  it('has EntityType.Sun', () => {
    const sun = new Sun();
    expect(sun.entityType).toBe(EntityType.Sun);
  });

  it('is positioned at arena sun position', () => {
    const sun = new Sun();
    expect(sun.position).toEqual(ARENA.SUN_POSITION);
  });

  it('has autoWrap enabled (wraps relative to camera like all entities)', () => {
    const sun = new Sun();
    expect(sun.autoWrap).toBe(true);
  });

  it('has collision sphere with correct radius', () => {
    const sun = new Sun();
    expect(sun.collisionSpheres).toHaveLength(1);
    expect(sun.collisionSpheres[0].radius).toBe(ARENA.SUN_COLLISION_RADIUS);
    expect(sun.collisionSpheres[0].offset).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('update is a no-op (position never changes)', () => {
    const sun = new Sun();
    const posBefore = { ...sun.position };
    sun.accelVec = { x: 10, y: 10, z: 10 };
    sun.update(100);
    expect(sun.position).toEqual(posBefore);
  });

  it('tracks animation frame state', () => {
    const sun = new Sun();
    expect(sun.currentFrame).toBe(0);
    expect(sun.animSpeed).toBe(0.025);
  });

  it('advances animation frame on updateAnimation', () => {
    const sun = new Sun();
    sun.updateAnimation(100);
    expect(sun.currentFrame).toBeGreaterThan(0);
  });

  it('wraps animation frame back to 0 after reaching 60', () => {
    const sun = new Sun();
    sun.currentFrame = 59.99;
    sun.updateAnimation(100); // Should push past 60 and wrap
    expect(sun.currentFrame).toBeLessThan(60);
  });
});
