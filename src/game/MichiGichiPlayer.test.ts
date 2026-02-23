import { describe, it, expect } from 'vitest';
import { MichiGichiPlayer, MorphState, MICHI_STATS, GICHI_STATS } from './MichiGichiPlayer';
import { PLASMA_BULLET_CONFIG, SUN_BULLET_CONFIG } from './Bullet';
import { Player, GONDI_STATS } from './Player';

describe('MichiGichiPlayer', () => {
  describe('initial state', () => {
    it('starts in MICHI state', () => {
      const p = new MichiGichiPlayer();
      expect(p.morphState).toBe(MorphState.MICHI);
    });

    it('starts at frame 1', () => {
      const p = new MichiGichiPlayer();
      expect(p.currentAnimFrame).toBe(1);
    });

    it('uses MICHI stats initially', () => {
      const p = new MichiGichiPlayer();
      expect(p.stats.speedMaxScaler).toBe(MICHI_STATS.speedMaxScaler);
      expect(p.stats.primaryBulletConfig).toBe(PLASMA_BULLET_CONFIG);
    });

    it('has two collision spheres', () => {
      const p = new MichiGichiPlayer();
      expect(p.collisionSpheres).toHaveLength(2);
      expect(p.collisionSpheres[0]).toEqual({ offset: { x: 0, y: -10, z: 0 }, radius: 14 });
      expect(p.collisionSpheres[1]).toEqual({ offset: { x: 0, y: 10, z: 0 }, radius: 14 });
    });
  });

  describe('morph trigger', () => {
    it('transitions from MICHI to MICHI_TO_GICHI on triggerMorph()', () => {
      const p = new MichiGichiPlayer();
      p.triggerMorph();
      expect(p.morphState).toBe(MorphState.MICHI_TO_GICHI);
    });

    it('transitions from GICHI to GICHI_TO_MICHI on triggerMorph()', () => {
      const p = new MichiGichiPlayer();
      p.morphState = MorphState.GICHI;
      p.currentAnimFrame = 41;
      p.triggerMorph();
      expect(p.morphState).toBe(MorphState.GICHI_TO_MICHI);
    });

    it('ignores triggerMorph during transitions', () => {
      const p = new MichiGichiPlayer();
      p.triggerMorph();
      p.triggerMorph();
      expect(p.morphState).toBe(MorphState.MICHI_TO_GICHI);
    });
  });

  describe('frame advancement (MICHI_TO_GICHI)', () => {
    it('advances frame after 20ms delay', () => {
      const p = new MichiGichiPlayer();
      p.triggerMorph();
      expect(p.currentAnimFrame).toBe(1);
      p.updateMorph(20);
      expect(p.currentAnimFrame).toBe(2);
    });

    it('does not advance frame before 20ms', () => {
      const p = new MichiGichiPlayer();
      p.triggerMorph();
      p.updateMorph(19);
      expect(p.currentAnimFrame).toBe(1);
    });

    it('reaches GICHI state at frame 41', () => {
      const p = new MichiGichiPlayer();
      p.triggerMorph();
      for (let i = 0; i < 40; i++) p.updateMorph(20);
      expect(p.currentAnimFrame).toBe(41);
      expect(p.morphState).toBe(MorphState.GICHI);
    });

    it('swaps to GICHI stats when reaching GICHI state', () => {
      const p = new MichiGichiPlayer();
      p.triggerMorph();
      for (let i = 0; i < 40; i++) p.updateMorph(20);
      expect(p.stats.speedMaxScaler).toBe(GICHI_STATS.speedMaxScaler);
      expect(p.stats.primaryBulletConfig).toBe(SUN_BULLET_CONFIG);
    });
  });

  describe('frame advancement (GICHI_TO_MICHI)', () => {
    it('decrements frame during reverse morph', () => {
      const p = new MichiGichiPlayer();
      p.morphState = MorphState.GICHI;
      p.currentAnimFrame = 41;
      p.triggerMorph();
      p.updateMorph(20);
      expect(p.currentAnimFrame).toBe(40);
    });

    it('reaches MICHI state at frame 1', () => {
      const p = new MichiGichiPlayer();
      p.morphState = MorphState.GICHI;
      p.currentAnimFrame = 41;
      p.triggerMorph();
      for (let i = 0; i < 40; i++) p.updateMorph(20);
      expect(p.currentAnimFrame).toBe(1);
      expect(p.morphState).toBe(MorphState.MICHI);
    });

    it('swaps to MICHI stats when reaching MICHI state', () => {
      const p = new MichiGichiPlayer();
      p.morphState = MorphState.GICHI;
      p.currentAnimFrame = 41;
      p.applyStats(GICHI_STATS);
      p.triggerMorph();
      for (let i = 0; i < 40; i++) p.updateMorph(20);
      expect(p.stats.speedMaxScaler).toBe(MICHI_STATS.speedMaxScaler);
      expect(p.stats.primaryBulletConfig).toBe(PLASMA_BULLET_CONFIG);
    });
  });

  describe('secondary weapon override', () => {
    it('returns null from fireSecondary (morph, not a projectile)', () => {
      const p = new MichiGichiPlayer();
      const enemy = new Player(GONDI_STATS);
      expect(p.fireSecondary(enemy)).toBeNull();
    });
  });

  describe('resetForNewRound', () => {
    it('resets morph state to MICHI', () => {
      const p = new MichiGichiPlayer();
      p.morphState = MorphState.GICHI;
      p.currentAnimFrame = 41;
      p.resetForNewRound({ x: 0, y: 0, z: 0 });
      expect(p.morphState).toBe(MorphState.MICHI);
      expect(p.currentAnimFrame).toBe(1);
      expect(p.stats.speedMaxScaler).toBe(MICHI_STATS.speedMaxScaler);
    });
  });
});
