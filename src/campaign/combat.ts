import type { Player, CharacterStats } from '@/game/Player';

export type CombatShip = 'michiGichi' | 'gondi' | 'sholev';
export interface CombatRequest {
  playerShip: string;
  enemyShip: string;
  difficulty: 1 | 2 | 3;
  hullFraction: number;
  upgrades: string[];
}
export interface CombatResult {
  won: boolean;
  hullFraction: number;
  escaped: boolean;
}

export const COMBAT_START_EVENT = 'signalwake:combat';
export const COMBAT_RESULT_EVENT = 'signalwake:combat-result';
export const COMBAT_CANCEL_EVENT = 'signalwake:combat-cancel';

export function normalizeCombatRequest(request: CombatRequest): CombatRequest {
  const ships = ['michiGichi', 'gondi', 'sholev'];
  if (!ships.includes(request.playerShip) || !ships.includes(request.enemyShip)) {
    throw new Error('This ship is not available for combat.');
  }
  if (![1, 2, 3].includes(request.difficulty) || !Number.isFinite(request.hullFraction)) {
    throw new Error('The combat request is invalid.');
  }
  if (request.hullFraction <= 0) throw new Error('Repair the ship before launching combat.');
  return {
    ...request,
    hullFraction: Math.min(1, request.hullFraction),
    upgrades: [...new Set(request.upgrades)],
  };
}

export interface CombatLoadout {
  hullCapacity: number;
  refreshStats(): void;
}

/** Apply upgrades to this round's pilot without modifying shared character presets. */
export function equipCampaignPlayer(player: Player, request: CombatRequest): CombatLoadout {
  const upgrades = new Set(request.upgrades);
  const hullCapacity = upgrades.has('armor') ? 1.4 : 1;
  const resonator = upgrades.has('resonator');
  const reactor = upgrades.has('reactor') ? 1.35 : resonator ? 1.25 : 1;
  const weapons = upgrades.has('weapons') ? 0.75 : resonator ? 0.85 : 1;
  const drive = upgrades.has('drive') ? 1.2 : 1;
  const modified = new WeakSet<CharacterStats>();
  const presets = new WeakMap<CharacterStats, CharacterStats>();

  // These methods read the current morph/shield state, so drive remains useful
  // after either character changes form. No shared speed constants are mutated.
  const originalMaxSpeed = player.getEffectiveMaxSpeed.bind(player);
  player.getEffectiveMaxSpeed = () => originalMaxSpeed() * drive;
  player.health = request.hullFraction * hullCapacity;

  const refreshStats = () => {
    if (modified.has(player.stats)) return;
    let stats = presets.get(player.stats);
    if (!stats) {
      stats = {
        ...player.stats,
        acceleration: player.stats.acceleration * drive,
        primaryWeaponFillRate: player.stats.primaryWeaponFillRate * reactor,
        primaryWeaponDelay: player.stats.primaryWeaponDelay * weapons,
        primaryEnergyCost: player.stats.primaryEnergyCost * (weapons < 1 ? 0.9 : 1),
      };
      presets.set(player.stats, stats);
      modified.add(stats);
    }
    player.stats = stats;
  };
  refreshStats();
  return { hullCapacity, refreshStats };
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2');
    if (!context) return false;
    // Release the probe immediately; Three.js creates the real context later.
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

interface CombatBridgeOptions {
  loadRuntime: () => Promise<unknown>;
  isSupported?: () => boolean;
  startupTimeoutMs?: number;
  battleTimeoutMs?: number;
}

/** One runtime and one active round, with listeners installed before launch. */
export class CombatBridge {
  private runtime: Promise<unknown> | null = null;
  private active = false;
  constructor(private readonly options: CombatBridgeOptions) {}

  launch(request: CombatRequest): Promise<CombatResult> {
    if (this.active) return Promise.reject(new Error('A battle is already in progress.'));
    let normalized: CombatRequest;
    try {
      normalized = normalizeCombatRequest(request);
      if (!(this.options.isSupported ?? supportsWebGL)()) {
        throw new Error('3D combat needs WebGL 2. Try a browser with hardware acceleration enabled.');
      }
    } catch (error) {
      return Promise.reject(error);
    }
    this.active = true;
    return new Promise<CombatResult>((resolve, reject) => {
      let settled = false;
      let launched = false;
      let timer: ReturnType<typeof setTimeout>;
      const finish = (result?: CombatResult, error?: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        window.removeEventListener(COMBAT_RESULT_EVENT, onResult);
        this.active = false;
        if (error) {
          if (launched) window.dispatchEvent(new Event(COMBAT_CANCEL_EVENT));
          reject(error);
        } else {
          resolve(result!);
        }
      };
      const onResult = (event: Event) => {
        const result = (event as CustomEvent<CombatResult>).detail;
        if (!launched || !result || typeof result.won !== 'boolean' ||
          typeof result.escaped !== 'boolean' || !Number.isFinite(result.hullFraction)) return;
        finish({ ...result, hullFraction: Math.max(0, Math.min(1, result.hullFraction)) });
      };
      window.addEventListener(COMBAT_RESULT_EVENT, onResult);
      timer = setTimeout(() => finish(undefined, new Error('Combat could not load. Please try again.')),
        this.options.startupTimeoutMs ?? 25_000);
      try {
        this.runtime ??= this.options.loadRuntime();
        this.runtime.then(() => {
          if (settled) return;
          clearTimeout(timer);
          launched = true;
          timer = setTimeout(() => finish(undefined, new Error('Combat timed out. Your expedition is safe; try again.')),
            this.options.battleTimeoutMs ?? 20 * 60_000);
          window.dispatchEvent(new CustomEvent(COMBAT_START_EVENT, { detail: normalized }));
        }, (error: unknown) => {
          this.runtime = null;
          finish(undefined, error);
        });
      } catch (error) {
        finish(undefined, error);
      }
    });
  }
}

const combatBridge = new CombatBridge({ loadRuntime: () => import('../main') });
export function launchCombat(request: CombatRequest): Promise<CombatResult> {
  return combatBridge.launch(request);
}
