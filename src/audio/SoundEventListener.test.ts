import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SoundEventListener } from './SoundEventListener';
import { SoundManager } from './SoundManager';
import { SoundEffect } from './SoundEffect';
import { GameEventType, BulletHitEvent, ExplosionEvent, SunCollisionEvent, SnotHitEvent } from '@/engine/GameEvent';
import { Entity, EntityType } from '@/engine/Entity';
import { Bullet, FLAME_BULLET_CONFIG } from '@/game/Bullet';
import { Player, GONDI_STATS } from '@/game/Player';
import { Snot } from '@/game/Snot';

vi.mock('./SoundManager', () => {
  const play = vi.fn();
  return {
    SoundManager: {
      getInstance: () => ({ play }),
    },
  };
});

describe('SoundEventListener', () => {
  let listener: SoundEventListener;
  let playSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listener = new SoundEventListener();
    playSpy = (SoundManager.getInstance() as any).play;
    playSpy.mockClear();
  });

  it('plays Hit on BulletHit when target is Player', () => {
    const bullet = new Bullet(FLAME_BULLET_CONFIG);
    const target = new Player(GONDI_STATS);
    listener.onGameEvent(new BulletHitEvent(bullet, target));
    expect(playSpy).toHaveBeenCalledWith(SoundEffect.Hit);
  });

  it('plays Explosion on BulletHit when target is Asteroid', () => {
    const bullet = new Bullet(FLAME_BULLET_CONFIG);
    const target = new Entity();
    target.entityType = EntityType.Asteroid;
    listener.onGameEvent(new BulletHitEvent(bullet, target));
    expect(playSpy).toHaveBeenCalledWith(SoundEffect.Explosion);
  });

  it('plays ExplosionBig on Explosion when entity is Player', () => {
    const player = new Player(GONDI_STATS);
    listener.onGameEvent(new ExplosionEvent(player));
    expect(playSpy).toHaveBeenCalledWith(SoundEffect.ExplosionBig);
  });

  it('plays Explosion on Explosion when entity is Asteroid', () => {
    const entity = new Entity();
    entity.entityType = EntityType.Asteroid;
    listener.onGameEvent(new ExplosionEvent(entity));
    expect(playSpy).toHaveBeenCalledWith(SoundEffect.Explosion);
  });

  it('plays SunBoom on SunCollision', () => {
    const sun = new Entity();
    const other = new Player(GONDI_STATS);
    listener.onGameEvent(new SunCollisionEvent(sun, other));
    expect(playSpy).toHaveBeenCalledWith(SoundEffect.SunBoom);
  });

  it('plays SnotHit on SnotHit event', () => {
    const origin = new Player(GONDI_STATS);
    const target = new Player(GONDI_STATS);
    const snot = new Snot(origin, target);
    listener.onGameEvent(new SnotHitEvent(snot, target));
    expect(playSpy).toHaveBeenCalledWith(SoundEffect.SnotHit);
  });
});
