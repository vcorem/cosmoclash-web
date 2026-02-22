import { describe, it, expect, beforeEach } from 'vitest';
import { GameEventMgr } from './GameEventMgr';
import { GameEventType, GameEvent, CollisionEvent } from './GameEvent';
import { Entity } from './Entity';

describe('GameEventMgr', () => {
  beforeEach(() => {
    GameEventMgr.reset();
  });

  it('is a singleton', () => {
    const a = GameEventMgr.getInstance();
    const b = GameEventMgr.getInstance();
    expect(a).toBe(b);
  });

  it('dispatches event to registered listener', () => {
    const mgr = GameEventMgr.getInstance();
    const received: GameEvent[] = [];
    mgr.addListener({ onGameEvent: (e) => received.push(e) }, GameEventType.Collision);

    const evt = new CollisionEvent(new Entity(), new Entity(), 0.5);
    mgr.sendEvent(evt);

    expect(received).toHaveLength(1);
    expect(received[0]).toBe(evt);
  });

  it('does not dispatch to listener of different type', () => {
    const mgr = GameEventMgr.getInstance();
    const received: GameEvent[] = [];
    mgr.addListener({ onGameEvent: (e) => received.push(e) }, GameEventType.Explosion);

    const evt = new CollisionEvent(new Entity(), new Entity(), 0.5);
    mgr.sendEvent(evt);

    expect(received).toHaveLength(0);
  });

  it('dispatches to multiple listeners for same type', () => {
    const mgr = GameEventMgr.getInstance();
    let count = 0;
    mgr.addListener({ onGameEvent: () => count++ }, GameEventType.Collision);
    mgr.addListener({ onGameEvent: () => count++ }, GameEventType.Collision);

    mgr.sendEvent(new CollisionEvent(new Entity(), new Entity(), 0));
    expect(count).toBe(2);
  });

  it('copies listener list before iterating (safe against modification during dispatch)', () => {
    const mgr = GameEventMgr.getInstance();
    const received: number[] = [];
    const listener1 = {
      onGameEvent: () => {
        received.push(1);
        mgr.addListener({ onGameEvent: () => received.push(3) }, GameEventType.Collision);
      },
    };
    const listener2 = { onGameEvent: () => received.push(2) };
    mgr.addListener(listener1, GameEventType.Collision);
    mgr.addListener(listener2, GameEventType.Collision);

    mgr.sendEvent(new CollisionEvent(new Entity(), new Entity(), 0));
    expect(received).toEqual([1, 2]);
  });

  it('removes a listener', () => {
    const mgr = GameEventMgr.getInstance();
    const received: GameEvent[] = [];
    const listener = { onGameEvent: (e: GameEvent) => received.push(e) };
    mgr.addListener(listener, GameEventType.Collision);
    mgr.removeListener(listener, GameEventType.Collision);

    mgr.sendEvent(new CollisionEvent(new Entity(), new Entity(), 0));
    expect(received).toHaveLength(0);
  });
});
