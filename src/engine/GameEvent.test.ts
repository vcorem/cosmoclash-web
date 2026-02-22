import { describe, it, expect } from 'vitest';
import {
  GameEventType,
  GameEvent,
  CollisionEvent,
  BulletHitEvent,
  ExplosionEvent,
} from './GameEvent';
import { Entity } from './Entity';

describe('GameEvent', () => {
  it('stores event type', () => {
    const e = new GameEvent(GameEventType.Collision);
    expect(e.type).toBe(GameEventType.Collision);
  });
});

describe('CollisionEvent', () => {
  it('stores entityA, entityB, and collisionTime', () => {
    const a = new Entity();
    const b = new Entity();
    const e = new CollisionEvent(a, b, 0.5);
    expect(e.type).toBe(GameEventType.Collision);
    expect(e.entityA).toBe(a);
    expect(e.entityB).toBe(b);
    expect(e.collisionTime).toBe(0.5);
  });
});

describe('BulletHitEvent', () => {
  it('stores bullet and target', () => {
    const bullet = new Entity();
    const target = new Entity();
    const e = new BulletHitEvent(bullet, target);
    expect(e.type).toBe(GameEventType.BulletHit);
    expect(e.bullet).toBe(bullet);
    expect(e.target).toBe(target);
  });
});

describe('ExplosionEvent', () => {
  it('stores entity', () => {
    const ent = new Entity();
    const e = new ExplosionEvent(ent);
    expect(e.type).toBe(GameEventType.Explosion);
    expect(e.entity).toBe(ent);
  });
});
