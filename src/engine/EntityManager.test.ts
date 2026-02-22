import { describe, it, expect } from 'vitest';
import { EntityManager } from './EntityManager';
import { Entity } from './Entity';

describe('EntityManager', () => {
  it('adds entities', () => {
    const mgr = new EntityManager();
    const e = new Entity();
    mgr.add(e);
    expect(mgr.entities).toContain(e);
  });

  it('updates all alive entities', () => {
    const mgr = new EntityManager();
    const e1 = new Entity();
    const e2 = new Entity();
    e1.accelVec = { x: 1, y: 0, z: 0 };
    e2.accelVec = { x: 0, y: 1, z: 0 };
    mgr.add(e1);
    mgr.add(e2);

    const camCenter = { x: 0, y: 0, z: -500 };
    mgr.update(100, camCenter);

    expect(e1.position.x).toBeGreaterThan(0);
    expect(e2.position.y).toBeGreaterThan(0);
  });

  it('skips dead entities during update', () => {
    const mgr = new EntityManager();
    const e = new Entity();
    e.accelVec = { x: 1, y: 0, z: 0 };
    e.alive = false;
    mgr.add(e);

    const camCenter = { x: 0, y: 0, z: -500 };
    mgr.update(100, camCenter);

    expect(e.position.x).toBe(0);
  });

  it('calls handleWrapAround on entities', () => {
    const mgr = new EntityManager();
    const e = new Entity();
    e.position = { x: 2000, y: 0, z: 0 };
    mgr.add(e);

    const camCenter = { x: 0, y: 0, z: -500 };
    mgr.update(0, camCenter);

    // Should have been wrapped
    expect(e.position.x).toBeLessThan(0);
  });

  it('removes dead entities', () => {
    const mgr = new EntityManager();
    const e = new Entity();
    mgr.add(e);
    e.alive = false;
    mgr.removeDeadEntities();
    expect(mgr.entities).not.toContain(e);
  });
});
