import { describe, it, expect } from 'vitest';
import { applySunGravity } from './Gravity';
import { Entity } from '@/engine/Entity';
import { ARENA } from './Arena';

describe('applySunGravity', () => {
  const sunPos = ARENA.SUN_POSITION;

  it('pulls entity toward the sun', () => {
    const e = new Entity();
    e.position = { x: 200, y: 0, z: 0 };
    e.accelVec = { x: 0, y: 0, z: 0 };

    applySunGravity(e, sunPos, 16);

    // Should have gained some negative-x velocity (toward sun at origin)
    expect(e.accelVec.x).toBeLessThan(0);
  });

  it('does nothing when entity is beyond GRAVITY_RANGE', () => {
    const e = new Entity();
    e.position = { x: 500, y: 0, z: 0 }; // > 450
    e.accelVec = { x: 0, y: 0, z: 0 };

    applySunGravity(e, sunPos, 16);

    expect(e.accelVec.x).toBe(0);
    expect(e.accelVec.y).toBe(0);
  });

  it('does nothing at exactly GRAVITY_RANGE + 1', () => {
    const e = new Entity();
    e.position = { x: 451, y: 0, z: 0 };
    e.accelVec = { x: 0, y: 0, z: 0 };

    applySunGravity(e, sunPos, 16);

    expect(e.accelVec.x).toBe(0);
  });

  it('applies gravity at edge of range', () => {
    const e = new Entity();
    e.position = { x: 449, y: 0, z: 0 }; // just inside range
    e.accelVec = { x: 0, y: 0, z: 0 };

    applySunGravity(e, sunPos, 16);

    expect(e.accelVec.x).toBeLessThan(0); // pulled toward sun
  });

  it('gravity force is clamped so near and far get equal pull', () => {
    // With GRAVITY_CONSTANT=0.5 and GRAVITY_MAX_FORCE=0.001,
    // force = 0.5/dist is always > 0.001 within GRAVITY_RANGE=450,
    // so all entities in range receive the same clamped force.
    const near = new Entity();
    near.position = { x: 100, y: 0, z: 0 };
    near.accelVec = { x: 0, y: 0, z: 0 };

    const far = new Entity();
    far.position = { x: 400, y: 0, z: 0 };
    far.accelVec = { x: 0, y: 0, z: 0 };

    applySunGravity(near, sunPos, 16);
    applySunGravity(far, sunPos, 16);

    // Both should be pulled with the same clamped force
    const maxChange = ARENA.GRAVITY_MAX_FORCE * 16 * ARENA.TIME_SCALER;
    expect(Math.abs(near.accelVec.x)).toBeCloseTo(maxChange, 5);
    expect(Math.abs(far.accelVec.x)).toBeCloseTo(maxChange, 5);
  });

  it('clamps force to GRAVITY_MAX_FORCE', () => {
    const e = new Entity();
    e.position = { x: 1, y: 0, z: 0 }; // extremely close — force would be huge
    e.accelVec = { x: 0, y: 0, z: 0 };

    applySunGravity(e, sunPos, 16);

    // Force should be clamped — velocity change bounded
    const maxChange = ARENA.GRAVITY_MAX_FORCE * 16 * ARENA.TIME_SCALER;
    expect(Math.abs(e.accelVec.x)).toBeLessThanOrEqual(maxChange + 0.0001);
  });

  it('pulls in correct direction for entity above sun', () => {
    const e = new Entity();
    e.position = { x: 0, y: 200, z: 0 };
    e.accelVec = { x: 0, y: 0, z: 0 };

    applySunGravity(e, sunPos, 16);

    expect(e.accelVec.x).toBeCloseTo(0, 5);
    expect(e.accelVec.y).toBeLessThan(0); // pulled down toward sun
  });

  it('pulls diagonally for diagonal entity', () => {
    const e = new Entity();
    e.position = { x: 200, y: 200, z: 0 };
    e.accelVec = { x: 0, y: 0, z: 0 };

    applySunGravity(e, sunPos, 16);

    expect(e.accelVec.x).toBeLessThan(0);
    expect(e.accelVec.y).toBeLessThan(0);
  });

  it('accumulates with existing velocity', () => {
    const e = new Entity();
    e.position = { x: 200, y: 0, z: 0 };
    e.accelVec = { x: 5, y: 3, z: 0 };

    applySunGravity(e, sunPos, 16);

    // X should be slightly less than 5 (pulled left)
    expect(e.accelVec.x).toBeLessThan(5);
    // Y should be unchanged (gravity is purely along X axis here)
    expect(e.accelVec.y).toBeCloseTo(3, 3);
  });

  it('handles entity at sun position gracefully (no NaN)', () => {
    const e = new Entity();
    e.position = { x: 0, y: 0, z: 0 }; // same as sun
    e.accelVec = { x: 0, y: 0, z: 0 };

    applySunGravity(e, sunPos, 16);

    expect(Number.isNaN(e.accelVec.x)).toBe(false);
    expect(Number.isNaN(e.accelVec.y)).toBe(false);
  });
});
