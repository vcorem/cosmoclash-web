import { describe, it, expect, beforeEach } from 'vitest';
import { EntityPool } from './EntityPool';
import { Entity } from './Entity';

function makeEntity(): Entity {
  return new Entity();
}

function resetEntity(e: Entity): void {
  e.alive = true;
  e.position = { x: 0, y: 0, z: 0 };
  e.accelVec = { x: 0, y: 0, z: 0 };
  e.health = 1;
}

describe('EntityPool', () => {
  let pool: EntityPool<Entity>;

  beforeEach(() => {
    pool = new EntityPool(makeEntity, resetEntity, 3);
  });

  describe('constructor', () => {
    it('pre-allocates initialSize entities in the free list', () => {
      expect(pool.activeCount).toBe(0);
      expect(pool.freeCount).toBe(3);
    });
  });

  describe('acquire', () => {
    it('returns an entity from the free list', () => {
      const e = pool.acquire();
      expect(e).toBeInstanceOf(Entity);
      expect(e.alive).toBe(true);
      expect(pool.activeCount).toBe(1);
      expect(pool.freeCount).toBe(2);
    });

    it('resets entity state on acquire', () => {
      const e = pool.acquire();
      e.position = { x: 999, y: 999, z: 999 };
      e.health = 0;
      pool.release(e);

      const e2 = pool.acquire();
      expect(e2).toBe(e); // same instance reused
      expect(e2.position).toEqual({ x: 0, y: 0, z: 0 });
      expect(e2.health).toBe(1);
    });

    it('creates a new entity when free list is empty (graceful fallback)', () => {
      pool.acquire();
      pool.acquire();
      pool.acquire();
      const e4 = pool.acquire();
      expect(e4).toBeInstanceOf(Entity);
      expect(pool.activeCount).toBe(4);
      expect(pool.freeCount).toBe(0);
    });
  });

  describe('release', () => {
    it('returns entity to free list', () => {
      const e = pool.acquire();
      pool.release(e);
      expect(e.alive).toBe(false);
      expect(pool.activeCount).toBe(0);
      expect(pool.freeCount).toBe(3);
    });

    it('does not double-release', () => {
      const e = pool.acquire();
      pool.release(e);
      pool.release(e);
      expect(pool.freeCount).toBe(3);
    });
  });

  describe('releaseInactive', () => {
    it('releases all entities where alive === false', () => {
      const e1 = pool.acquire();
      const e2 = pool.acquire();
      const e3 = pool.acquire();

      e1.alive = false;
      e3.alive = false;

      pool.releaseInactive();

      expect(pool.activeCount).toBe(1);
      expect(pool.freeCount).toBe(2);
    });
  });

  describe('forEachActive', () => {
    it('iterates over all active entities', () => {
      const e1 = pool.acquire();
      const e2 = pool.acquire();
      const visited: Entity[] = [];

      pool.forEachActive(e => visited.push(e));

      expect(visited).toContain(e1);
      expect(visited).toContain(e2);
      expect(visited).toHaveLength(2);
    });
  });

  describe('activeEntities', () => {
    it('returns array of all active entities', () => {
      const e1 = pool.acquire();
      const e2 = pool.acquire();

      const entities = pool.activeEntities;
      expect(entities).toContain(e1);
      expect(entities).toContain(e2);
      expect(entities).toHaveLength(2);
    });
  });

  describe('releaseAll', () => {
    it('moves all active entities to free list', () => {
      const pool = new EntityPool<Entity>(() => new Entity(), () => {}, 5);
      pool.acquire();
      pool.acquire();
      pool.acquire();
      expect(pool.activeCount).toBe(3);
      pool.releaseAll();
      expect(pool.activeCount).toBe(0);
      expect(pool.freeCount).toBe(5); // original 2 free + 3 released
    });

    it('sets alive=false on all released entities', () => {
      const pool = new EntityPool<Entity>(() => new Entity(), () => {}, 3);
      const a = pool.acquire();
      const b = pool.acquire();
      pool.releaseAll();
      expect(a.alive).toBe(false);
      expect(b.alive).toBe(false);
    });
  });
});
