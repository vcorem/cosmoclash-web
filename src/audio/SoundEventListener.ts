import { GameEventListener } from '@/engine/GameEventMgr';
import { GameEvent, GameEventType, BulletHitEvent, ExplosionEvent, SunCollisionEvent, SnotHitEvent } from '@/engine/GameEvent';
import { EntityType } from '@/engine/Entity';
import { Player } from '@/game/Player';
import { SoundManager } from './SoundManager';
import { SoundEffect } from './SoundEffect';

export class SoundEventListener implements GameEventListener {
  onGameEvent(event: GameEvent): void {
    const sm = SoundManager.getInstance();

    switch (event.type) {
      case GameEventType.BulletHit: {
        const e = event as BulletHitEvent;
        if (e.target.entityType === EntityType.Asteroid) {
          sm.play(SoundEffect.AsteroidHit);
        } else if (e.target instanceof Player) {
          sm.play(SoundEffect.Hit);
        }
        break;
      }
      case GameEventType.Explosion: {
        const e = event as ExplosionEvent;
        if (e.entity instanceof Player) {
          sm.play(SoundEffect.ExplosionBig);
        } else {
          sm.play(SoundEffect.Explosion);
        }
        break;
      }
      case GameEventType.SunCollision: {
        sm.play(SoundEffect.SunBoom);
        break;
      }
      case GameEventType.SnotHit: {
        sm.play(SoundEffect.SnotHit);
        break;
      }
    }
  }
}
