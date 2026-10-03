import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EntityManager } from '@/engine/EntityManager';
import { Player } from '@/game/Player';
import type { Entity } from '@/engine/Entity';
import { CombatBridge } from './combat';
import type { CombatRequest } from './combat';

const runtime = vi.hoisted(() => ({
  update: (_dt: number) => {}, render: () => {}, starts: 0,
  loads: [] as Array<{ path: string; loaded: (gltf: unknown) => void }>,
  scene: null as unknown,
  sound: { preload: vi.fn(), play: vi.fn(), playMusic: vi.fn(), stopMusic: vi.fn(), toggleMute: vi.fn() },
  logo: vi.fn(),
}));

vi.mock('@/engine/GameLoop', () => ({
  GameLoop: class {
    constructor(update: (dt: number) => void, render: () => void) {
      runtime.update = update;
      runtime.render = render;
    }
    start() { runtime.starts++; }
  },
}));
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    load(path: string, loaded: (gltf: unknown) => void) { runtime.loads.push({ path, loaded }); }
  },
}));
vi.mock('@/audio/SoundManager', () => ({ SoundManager: { getInstance: () => runtime.sound } }));
vi.mock('@/ui/LogoSplash', () => ({ LogoSplash: runtime.logo }));
vi.mock('@/game/Scene', async () => {
  const actual = await vi.importActual<typeof import('@/game/Scene')>('@/game/Scene');
  const three = await import('three');
  return {
    ...actual,
    createScene: () => { const scene = actual.createScene(); runtime.scene = scene; return scene; },
    createStarField: () => new three.Points(new three.BufferGeometry(), new three.PointsMaterial()),
    scrollStarField: vi.fn(),
    createRenderer: (container: HTMLElement) => {
      const domElement = document.createElement('canvas');
      container.appendChild(domElement);
      return { domElement, setSize: vi.fn(), clear: vi.fn(), render: vi.fn() };
    },
  };
});

let added: Entity[];
let app: HTMLElement;
let bridge: CombatBridge;
let viewport: HTMLElement;
let scene: THREE.Scene;
let baseChildren: number;
let bodyStyles: { overflow: string; margin: string; background: string };

afterAll(() => {
  app?.remove();
  if (bodyStyles) Object.assign(document.body.style, bodyStyles);
  vi.restoreAllMocks();
});

describe('campaign runtime integration', () => {
  // Transforming the entire battle runtime can take longer on a busy host.
  // Keep module setup separate from the deadline for the encounter itself.
  beforeAll(async () => {
    vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation(() => new THREE.Texture());
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createRadialGradient: () => ({ addColorStop: () => {} }), fillRect: () => {},
    } as never);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    added = [];
    vi.spyOn(EntityManager.prototype, 'add').mockImplementation(function (this: EntityManager, entity: Entity) {
      added.push(entity);
      this.entities.push(entity);
    });
    app = document.createElement('main');
    app.id = 'signalwake-app';
    document.body.appendChild(app);
    bodyStyles = {
      overflow: document.body.style.overflow,
      margin: document.body.style.margin,
      background: document.body.style.background,
    };
    document.body.style.overflow = 'auto';
    document.body.style.margin = '8px';
    document.body.style.background = 'rgb(12, 20, 28)';
    bridge = new CombatBridge({ loadRuntime: () => import('../main'), isSupported: () => true });
    await import('../main');
    viewport = document.getElementById('game-container')!;
    scene = runtime.scene as THREE.Scene;
    baseChildren = scene.children.length;
  }, 60_000);

  it('runs repeatable real melee rounds, pauses controls, resolves outcomes and ignores late models', async () => {
    expect(viewport.style.display).toBe('none');
    expect(viewport.style.position).toBe('fixed');
    expect(document.body.style.overflow).toBe('auto');
    expect(document.body.style.margin).toBe('8px');
    expect(document.body.style.background).toBe('rgb(12, 20, 28)');
    expect(document.getElementById('hud')).toBeNull();
    expect(runtime.logo).not.toHaveBeenCalled();
    expect(runtime.starts).toBe(1);

    const request: CombatRequest = {
      playerShip: 'gondi', enemyShip: 'sholev', difficulty: 1,
      hullFraction: 0.6, upgrades: ['armor', 'drive', 'resonator'],
    };
    const launch = bridge.launch(request);
    await vi.waitFor(() => expect(document.getElementById('hud')).not.toBeNull());
    expect(viewport.style.display).toBe('');
    expect(app.style.visibility).toBe('hidden');
    expect(document.body.style.overflow).toBe('hidden');
    const [pilot, enemy] = added.filter(e => e instanceof Player).slice(-2) as Player[];
    expect(pilot.health).toBeCloseTo(0.84);
    const pilotLoads = runtime.loads.filter(load => load.path.includes('gondi') || load.path.includes('sholev'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    runtime.update(30);
    expect(Math.abs(pilot.accelVec.y)).toBeGreaterThan(0);
    window.dispatchEvent(new Event('blur'));
    const pausedPosition = { ...pilot.position };
    runtime.update(200);
    expect(pilot.position).toEqual(pausedPosition);
    expect(document.querySelector<HTMLElement>('.signalwake-combat-paused')!.hidden).toBe(false);
    window.dispatchEvent(new Event('focus'));
    expect(document.querySelector<HTMLElement>('.signalwake-combat-paused')!.hidden).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect(launch).resolves.toMatchObject({ won: false, escaped: true, hullFraction: 0.6 });
    expect(document.getElementById('hud')).toBeNull();
    expect(viewport.style.display).toBe('none');
    expect(app.style.visibility).toBe('');
    expect(document.body.style.overflow).toBe('auto');
    // Downloads from the round that retreated cannot add obsolete ships.
    for (const load of pilotLoads) load.loaded({ scene: new THREE.Group(), animations: [] });
    for (const load of runtime.loads.filter(load => load.path.includes('asteroid'))) {
      load.loaded({ scene: new THREE.Group(), animations: [] });
    }
    expect(scene.children.length).toBe(baseChildren);
    expect(document.body.style.overflow).toBe('auto');

    const victory = bridge.launch({ ...request, hullFraction: 0.4 });
    await vi.waitFor(() => expect(document.getElementById('hud')).not.toBeNull());
    const [newPilot, newEnemy] = added.filter(e => e instanceof Player).slice(-2) as Player[];
    expect(newPilot).not.toBe(pilot);
    expect(newEnemy).not.toBe(enemy);
    expect(newPilot.health).toBeCloseTo(0.56);
    expect(document.querySelectorAll('#hud').length).toBe(1);
    expect(document.querySelectorAll('.signalwake-touch-controls').length).toBe(1);
    newEnemy.health = 0;
    newEnemy.destroy();
    runtime.update(1);
    runtime.update(1500);
    await expect(victory).resolves.toMatchObject({ won: true, escaped: false });
    expect(runtime.starts).toBe(1);
    expect(document.getElementById('hud')).toBeNull();
    expect(document.querySelector('.signalwake-touch-controls')).toBeNull();
    expect(scene.children.length).toBe(baseChildren);

    const defeat = bridge.launch({ ...request, playerShip: 'sholev', hullFraction: 0.4 });
    await vi.waitFor(() => expect(document.getElementById('hud')).not.toBeNull());
    const losingPilot = added.filter(e => e instanceof Player).slice(-2)[0] as Player;
    // Exercise the same pointer input path used by the mobile Fire button.
    const fire = Array.from(document.querySelectorAll<HTMLButtonElement>('.signalwake-touch-controls button'))
      .find(button => button.textContent === 'Fire')!;
    fire.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    runtime.update(10);
    expect(losingPilot.energy).toBeLessThan(1);
    fire.dispatchEvent(new Event('pointerup', { bubbles: true }));
    losingPilot.health = 0;
    losingPilot.destroy();
    runtime.update(1);
    runtime.update(1500);
    await expect(defeat).resolves.toEqual({ won: false, escaped: false, hullFraction: 0 });
    expect(runtime.starts).toBe(1);
    expect(document.getElementById('hud')).toBeNull();
    expect(runtime.logo).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe('auto');
  }, 10_000);
});
