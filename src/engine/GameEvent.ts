import { Entity } from './Entity';

export enum GameEventType {
  Collision,
  Explosion,
  BulletHit,
  FrameRender,
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
