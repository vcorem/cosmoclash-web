import { describe, it, expect } from 'vitest';
import { ARENA } from './Arena';

describe('Arena constants', () => {
  it('has correct wrap distances', () => {
    expect(ARENA.WRAP_X).toBe(1500);
    expect(ARENA.WRAP_Y).toBe(1050);
  });

  it('has correct camera constants', () => {
    expect(ARENA.CAM_BASE_Z).toBe(-100);
    expect(ARENA.CAM_MAX_Z).toBe(-3500);
    expect(ARENA.CAM_DISTANCE_SCALE).toBe(5);
    expect(ARENA.CAM_MIN_PLAYER_DISTANCE).toBe(50);
  });

  it('has correct star field constants', () => {
    expect(ARENA.NUM_STARS).toBe(500);
    expect(ARENA.STARS_EXTENT).toBe(1800);
    expect(ARENA.STARS_Z).toBe(250);
  });

  it('has correct physics constants', () => {
    expect(ARENA.TIME_SCALER).toBe(0.35);
  });

  it('has correct player 1 spawn position', () => {
    expect(ARENA.PLAYER1_SPAWN).toEqual({ x: -500, y: -70, z: 0 });
  });
});
