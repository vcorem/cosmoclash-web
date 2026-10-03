import { afterEach, describe, expect, it, vi } from 'vitest';
import { CombatBridge, COMBAT_START_EVENT, COMBAT_RESULT_EVENT, COMBAT_CANCEL_EVENT, equipCampaignPlayer, normalizeCombatRequest } from './combat';
import type { CombatRequest } from './combat';
import { Player, GONDI_STATS } from '@/game/Player';
import { MichiGichiPlayer, GICHI_STATS, MICHI_STATS } from '@/game/MichiGichiPlayer';
import { SholevPlayer } from '@/game/SholevPlayer';

const request: CombatRequest = {
  playerShip: 'michiGichi', enemyShip: 'gondi', difficulty: 2,
  hullFraction: 0.6, upgrades: ['armor', 'resonator'],
};
const settleLoading = async () => { await Promise.resolve(); await Promise.resolve(); };
const result = (won = true, escaped = false) => {
  window.dispatchEvent(new CustomEvent(COMBAT_RESULT_EVENT, {
    detail: { won, hullFraction: 0.42, escaped },
  }));
};

afterEach(() => vi.useRealTimers());

describe('campaign combat event bridge', () => {
  it('loads the runtime once and carries hull, ship and upgrade choices into repeated rounds', async () => {
    const loadRuntime = vi.fn(async () => undefined);
    const bridge = new CombatBridge({ loadRuntime, isSupported: () => true });
    const starts: CombatRequest[] = [];
    const onStart = (event: Event) => starts.push((event as CustomEvent<CombatRequest>).detail);
    window.addEventListener(COMBAT_START_EVENT, onStart);
    const first = bridge.launch(request);
    await settleLoading();
    expect(starts).toEqual([request]);
    result();
    expect(await first).toEqual({ won: true, escaped: false, hullFraction: 0.42 });
    const second = bridge.launch({ ...request, playerShip: 'sholev', hullFraction: 0.42 });
    await settleLoading();
    result(false, true);
    expect(await second).toEqual({ won: false, escaped: true, hullFraction: 0.42 });
    expect(loadRuntime).toHaveBeenCalledTimes(1);
    expect(starts[1]).toMatchObject({ playerShip: 'sholev', hullFraction: 0.42 });
    window.removeEventListener(COMBAT_START_EVENT, onStart);
  });

  it('permits only one active battle, including while loading', async () => {
    let loaded!: () => void;
    const bridge = new CombatBridge({ isSupported: () => true, loadRuntime: () => new Promise<void>(resolve => { loaded = resolve; }) });
    const first = bridge.launch(request);
    await expect(bridge.launch(request)).rejects.toThrow('already in progress');
    // A stale result before the round is dispatched cannot consume the launch.
    result();
    loaded();
    await settleLoading();
    result();
    await expect(first).resolves.toMatchObject({ won: true });
  });

  it('reports unsupported WebGL before importing the game runtime', async () => {
    const loadRuntime = vi.fn(async () => undefined);
    const bridge = new CombatBridge({ loadRuntime, isSupported: () => false });
    await expect(bridge.launch(request)).rejects.toThrow('WebGL 2');
    expect(loadRuntime).not.toHaveBeenCalled();
  });

  it('times out stalled loading and never dispatches a late launch', async () => {
    vi.useFakeTimers();
    let loaded!: () => void;
    const bridge = new CombatBridge({ isSupported: () => true, startupTimeoutMs: 100,
      loadRuntime: () => new Promise<void>(resolve => { loaded = resolve; }) });
    const start = vi.fn();
    window.addEventListener(COMBAT_START_EVENT, start);
    const promise = bridge.launch(request);
    const rejected = expect(promise).rejects.toThrow('could not load');
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
    loaded();
    await settleLoading();
    expect(start).not.toHaveBeenCalled();
    window.removeEventListener(COMBAT_START_EVENT, start);
  });

  it('cancels the scene on a battle timeout and allows another launch', async () => {
    vi.useFakeTimers();
    const bridge = new CombatBridge({ isSupported: () => true, battleTimeoutMs: 100,
      loadRuntime: async () => undefined });
    const cancelled = vi.fn();
    window.addEventListener(COMBAT_CANCEL_EVENT, cancelled);
    const promise = bridge.launch(request);
    const rejected = expect(promise).rejects.toThrow('timed out');
    await settleLoading();
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
    expect(cancelled).toHaveBeenCalledTimes(1);
    const retry = bridge.launch(request);
    await settleLoading();
    result();
    await expect(retry).resolves.toMatchObject({ won: true });
    window.removeEventListener(COMBAT_CANCEL_EVENT, cancelled);
  });

  it('propagates runtime loading errors and releases single-flight state', async () => {
    const bridge = new CombatBridge({ isSupported: () => true,
      loadRuntime: async () => { throw new Error('Network unavailable'); } });
    await expect(bridge.launch(request)).rejects.toThrow('Network unavailable');
    await expect(bridge.launch(request)).rejects.toThrow('Network unavailable');
  });

  it('rejects unavailable ships and unrepaired hull without launching', () => {
    expect(() => normalizeCombatRequest({ ...request, hullFraction: 0 })).toThrow('Repair');
    expect(() => normalizeCombatRequest({ ...request, enemyShip: 'missing' as CombatRequest['enemyShip'] })).toThrow('not available');
  });
});

describe('campaign combat upgrades', () => {
  it('carries damage into the armor capacity without giving a free repair', () => {
    const player = new Player(GONDI_STATS);
    const loadout = equipCampaignPlayer(player, request);
    expect(player.health).toBeCloseTo(0.84);
    player.health -= 0.14;
    expect(player.health / loadout.hullCapacity).toBeCloseTo(0.5);
  });

  it('gives resonator real energy and firing buffs without changing enemy presets', () => {
    const player = new Player(GONDI_STATS);
    const enemy = new Player(GONDI_STATS);
    const loadout = equipCampaignPlayer(player, request);
    player.energy = 0;
    player.updateEnergy(1000);
    enemy.energy = 0;
    enemy.updateEnergy(1000);
    expect(player.energy).toBeGreaterThan(enemy.energy);
    player.energy = 1;
    expect(player.firePrimary()).not.toBeNull();
    expect(player.primaryCooldown).toBeLessThan(enemy.stats.primaryWeaponDelay);
    loadout.refreshStats();
    expect(player.stats.primaryWeaponFillRate).toBeCloseTo(GONDI_STATS.primaryWeaponFillRate * 1.25);
    expect(enemy.stats).toBe(GONDI_STATS);
  });

  it('preserves buffs through MichiGichi transformations without compounding them', () => {
    const player = new MichiGichiPlayer();
    const loadout = equipCampaignPlayer(player, { ...request, upgrades: ['drive', 'resonator'] });
    player.triggerMorph();
    player.updateMorph(1000);
    loadout.refreshStats();
    expect(player.getEffectiveMaxSpeed()).toBeCloseTo(GICHI_STATS.speedMaxScaler * 1.2);
    expect(player.stats.primaryWeaponDelay).toBeCloseTo(GICHI_STATS.primaryWeaponDelay * 0.85);
    player.triggerMorph();
    player.updateMorph(1000);
    loadout.refreshStats();
    loadout.refreshStats();
    expect(player.stats.acceleration).toBeCloseTo(MICHI_STATS.acceleration * 1.2);
    expect(MICHI_STATS.acceleration).toBe(0.002);
  });

  it('preserves the drive boost while Sholev activates and drops its shield', () => {
    const player = new SholevPlayer();
    equipCampaignPlayer(player, { ...request, upgrades: ['drive'] });
    expect(player.getEffectiveMaxSpeed()).toBeCloseTo(0.96);
    expect(player.activateFrostShield()).toBe(true);
    expect(player.getEffectiveMaxSpeed()).toBeCloseTo(1.92);
    player.frostShieldActiveTime = 3000;
    expect(player.deactivateFrostShieldManual()).toBe(true);
    expect(player.getEffectiveMaxSpeed()).toBeCloseTo(0.96);
  });
});
