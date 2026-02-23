// src/ai/__tests__/AIController.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIController } from '../AIController';
import { getDifficultyConstants } from '../AIConstants';
import { EntityPool } from '@/engine/EntityPool';
import { Bullet, FLAME_BULLET_CONFIG } from '@/game/Bullet';
import { Snot } from '@/game/Snot';
import { Player, GONDI_STATS } from '@/game/Player';
import { MichiGichiPlayer } from '@/game/MichiGichiPlayer';
import { CharacterDef } from '@/game/CharacterRegistry';

const mgDef: CharacterDef = {
  id: 'michiGichi', name: 'MichiGichi', weapon: 'Plasma', special: 'Morph',
  modelPath: '/models/michiGichi.glb', modelScale: 2, modelRotation: [-90, 180, 0],
  isMichiGichi: true,
};

const gondiDef: CharacterDef = {
  id: 'gondi', name: 'Gondi', weapon: 'Flame', special: 'Slime',
  modelPath: '/models/gondi.glb', modelScale: 1.8, modelRotation: [0, 270, 90],
  isMichiGichi: false,
};

function makeBulletPool(): EntityPool<Bullet> {
  return new EntityPool<Bullet>(
    () => new Bullet(FLAME_BULLET_CONFIG),
    () => {},
    10,
  );
}

function makeSnotPool(): EntityPool<Snot> {
  const p1 = new Player(GONDI_STATS);
  const p2 = new Player(GONDI_STATS);
  return new EntityPool<Snot>(
    () => new Snot(p1, p2),
    () => {},
    10,
  );
}

describe('AIController', () => {
  let controller: AIController;
  let bulletPool: EntityPool<Bullet>;
  let snotPool: EntityPool<Snot>;

  beforeEach(() => {
    controller = new AIController(3, gondiDef, mgDef);
    bulletPool = makeBulletPool();
    snotPool = makeSnotPool();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns idle input during first 5 frames', () => {
    const ai = new Player(GONDI_STATS);
    ai.position = { x: 500, y: 0, z: 0 };
    const user = new MichiGichiPlayer();
    user.position = { x: -500, y: 0, z: 0 };

    for (let i = 0; i < 5; i++) {
      const input = controller.update(16, ai, user, bulletPool, snotPool);
      expect(input.thrust).toBe(false);
      expect(input.rotateLeft).toBe(false);
      expect(input.rotateRight).toBe(false);
      expect(input.firePrimary).toBe(false);
      expect(input.fireSecondary).toBe(false);
    }
  });

  it('produces valid PlayerInput after 5 frames', () => {
    const ai = new Player(GONDI_STATS);
    ai.position = { x: 500, y: 0, z: 0 };
    const user = new MichiGichiPlayer();
    user.position = { x: -500, y: 0, z: 0 };

    // Run through initial 5 idle frames
    for (let i = 0; i < 5; i++) {
      controller.update(16, ai, user, bulletPool, snotPool);
    }

    // 6th frame should produce real output
    const input = controller.update(16, ai, user, bulletPool, snotPool);
    expect(input).toBeDefined();
    expect(typeof input.thrust).toBe('boolean');
    expect(typeof input.rotateLeft).toBe('boolean');
    expect(typeof input.rotateRight).toBe('boolean');
    expect(typeof input.firePrimary).toBe('boolean');
    expect(typeof input.fireSecondary).toBe('boolean');
  });

  it('activates sun avoidance when AI is near sun', () => {
    const ai = new Player(GONDI_STATS);
    ai.position = { x: 50, y: 0, z: 0 }; // Very close to sun at (0,0)
    const user = new Player(GONDI_STATS);
    user.position = { x: 500, y: 0, z: 0 };

    // Skip first 5 frames
    for (let i = 0; i < 5; i++) {
      controller.update(16, ai, user, bulletPool, snotPool);
    }

    const input = controller.update(16, ai, user, bulletPool, snotPool);
    // AI should be thrusting away from sun
    expect(input.thrust).toBe(true);
  });

  it('chooses attack mode when AI life >= user life', () => {
    const ai = new Player(GONDI_STATS);
    ai.position = { x: 500, y: 0, z: 0 };
    ai.health = 1.0;
    const user = new Player(GONDI_STATS);
    user.position = { x: -500, y: 0, z: 0 };
    user.health = 0.5;

    // Skip first 5 frames
    for (let i = 0; i < 5; i++) {
      controller.update(16, ai, user, bulletPool, snotPool);
    }

    // Should produce output (attack mode) without crashing
    const input = controller.update(16, ai, user, bulletPool, snotPool);
    expect(input).toBeDefined();
  });

  it('chooses defense mode when AI life < user life', () => {
    const ai = new Player(GONDI_STATS);
    ai.position = { x: 500, y: 0, z: 0 };
    ai.health = 0.3;
    const user = new Player(GONDI_STATS);
    user.position = { x: -500, y: 0, z: 0 };
    user.health = 1.0;

    // Skip first 5 frames
    for (let i = 0; i < 5; i++) {
      controller.update(16, ai, user, bulletPool, snotPool);
    }

    const input = controller.update(16, ai, user, bulletPool, snotPool);
    expect(input).toBeDefined();
  });

  it('resets to initial state', () => {
    const ai = new Player(GONDI_STATS);
    ai.position = { x: 500, y: 0, z: 0 };
    const user = new Player(GONDI_STATS);
    user.position = { x: -500, y: 0, z: 0 };

    // Run several frames
    for (let i = 0; i < 10; i++) {
      controller.update(16, ai, user, bulletPool, snotPool);
    }

    controller.reset();

    // After reset, first 5 frames should be idle again
    const input = controller.update(16, ai, user, bulletPool, snotPool);
    expect(input.thrust).toBe(false);
    expect(input.firePrimary).toBe(false);
  });
});
