import { Entity } from './Entity';

export enum GameEventType {
  Collision,
  Explosion,
  BulletHit,
  SunCollision,
  FrameRender,
  SnotHit,
}

export class GameEvent {
  readonly type: GameEventType;

  constructor(type: GameEventType) {
    this.type = type;
  }
}

export class CollisionEvent extends GameEvent {
  readonly entityA: Entity;
  readonly entityB: Entity;
  readonly collisionTime: number;

  constructor(entityA: Entity, entityB: Entity, collisionTime: number) {
    super(GameEventType.Collision);
    this.entityA = entityA;
    this.entityB = entityB;
    this.collisionTime = collisionTime;
  }
}

export class BulletHitEvent extends GameEvent {
  readonly bullet: Entity;
  readonly target: Entity;

  constructor(bullet: Entity, target: Entity) {
    super(GameEventType.BulletHit);
    this.bullet = bullet;
    this.target = target;
  }
}

export class ExplosionEvent extends GameEvent {
  readonly entity: Entity;

  constructor(entity: Entity) {
    super(GameEventType.Explosion);
    this.entity = entity;
  }
}

export class SunCollisionEvent extends GameEvent {
  readonly sun: Entity;
  readonly other: Entity;

  constructor(sun: Entity, other: Entity) {
    super(GameEventType.SunCollision);
    this.sun = sun;
    this.other = other;
  }
}

export class SnotHitEvent extends GameEvent {
  readonly snot: Entity;
  readonly target: Entity;

  constructor(snot: Entity, target: Entity) {
    super(GameEventType.SnotHit);
    this.snot = snot;
    this.target = target;
  }
}
