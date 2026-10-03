import { beforeEach, describe, expect, it } from 'vitest';
import {
  act, campaignActions, combatResult, createCampaign, dialogue, endingText,
  loadCampaign, maxFuel, maxHull, missionBrief, SAVE_KEY, saveCampaign, travelCost,
} from './engine';
import type { CampaignState } from './engine';
import { SYSTEMS, UPGRADES } from './world';

const serviceIds = new Set([
  'harbor', 'vellum', 'kiln', 'ledger', 'haven', 'bastion',
  ...SYSTEMS.filter(system => system.kind === 'station').map(system => system.id),
]);

function available(state: CampaignState, id: string) {
  return [...campaignActions(state), ...(dialogue(state)?.choices ?? [])].find(action => action.id === id);
}

function step(state: CampaignState, id: string): CampaignState {
  const action = available(state, id);
  expect(action, `Action ${id} should exist at ${state.current}`).toBeDefined();
  expect(action?.disabled, `Action ${id} at ${state.current}: ${action?.disabled}`).toBeUndefined();
  const next = act(state, id);
  expect(next).not.toBe(state);
  expect(next.fuel).toBeGreaterThanOrEqual(0);
  expect(next.fuel).toBeLessThanOrEqual(maxFuel(next));
  expect(next.hull).toBeGreaterThanOrEqual(0);
  expect(next.hull).toBeLessThanOrEqual(maxHull(next));
  expect(next.credits).toBeGreaterThanOrEqual(0);
  expect(next.data).toBeGreaterThanOrEqual(0);
  expect(saveCampaign(next)).toBe(true);
  return next;
}

function choose(state: CampaignState, id: string): CampaignState {
  return step(step(state, 'contact'), id);
}

function prepare(state: CampaignState): CampaignState {
  if (!serviceIds.has(state.current)) return state;
  let next = state;
  if (!next.salvaged.includes(next.current)) next = step(next, 'salvage');
  if (available(next, 'refuel') && !available(next, 'refuel')?.disabled) next = step(next, 'refuel');
  if (available(next, 'repair') && !available(next, 'repair')?.disabled) next = step(next, 'repair');
  return next;
}

function route(state: CampaignState, id: string): CampaignState {
  if (state.current === id) return state;
  let next = prepare(state);
  if (next.fuel < travelCost(next, id).fuel) {
    if (!next.salvaged.includes(next.current)) next = step(next, 'salvage');
    if (next.fuel < travelCost(next, id).fuel) {
      const port = SYSTEMS.filter(system => serviceIds.has(system.id) && system.id !== next.current)
        .sort((a, b) => travelCost(next, a.id).fuel - travelCost(next, b.id).fuel)
        .find(system => travelCost(next, system.id).fuel <= next.fuel);
      expect(port, 'A service port must be reachable without a seeded resource').toBeDefined();
      next = route(next, port!.id);
      next = prepare(next);
    }
  }
  return step(next, `travel:${id}`);
}

function win(state: CampaignState): CampaignState {
  expect(state.combat).not.toBeNull();
  const next = combatResult(state, { won: true, escaped: false, hullFraction: 0.8 });
  expect(next.combat).toBeNull();
  expect(next.flags).toContain(`cleared:${state.current}`);
  expect(saveCampaign(next)).toBe(true);
  return next;
}

function alliedKeys(): CampaignState {
  let state = choose(createCampaign(), 'harbor:briefing');
  state = choose(route(state, 'vellum'), 'choir:accept');
  state = step(route(state, 'prism'), 'scan');
  state = choose(route(state, 'vellum'), 'choir:return');
  state = choose(route(state, 'kiln'), 'forge:accept');
  state = step(win(route(state, 'crucible')), 'scan');
  state = prepare(route(state, 'kiln'));
  state = choose(state, 'forge:share');
  state = choose(route(state, 'ledger'), 'exchange:accept');
  state = step(win(route(state, 'convoy')), 'scan');
  state = choose(route(state, 'ledger'), 'exchange:cooperate');
  return state;
}

function expedientKeys(): CampaignState {
  let state = choose(createCampaign(), 'harbor:briefing');
  state = choose(route(state, 'vellum'), 'choir:standardize');
  state = choose(route(state, 'kiln'), 'forge:accept');
  state = step(win(route(state, 'crucible')), 'scan');
  state = choose(route(state, 'kiln'), 'forge:extract');
  return choose(route(state, 'ledger'), 'exchange:monopoly');
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

beforeEach(() => localStorage.clear());

describe('complete player expeditions', () => {
  it('earns three alliances and discoveries, purchases a resonator, and forms a federation', () => {
    let state = alliedKeys();
    for (const id of ['palimpsest', 'stillwater', 'echo']) state = step(route(state, id), 'scan');
    state = prepare(route(state, 'haven'));
    state = step(state, 'upgrade:resonator');
    expect(state.upgrades).toContain('resonator');
    expect(state.flags).toEqual(expect.arrayContaining([
      'key:choir', 'key:forge', 'key:exchange', 'ally:choir', 'ally:forge', 'ally:exchange',
      'evidence:copy', 'evidence:variance', 'evidence:consent',
    ]));
    state = choose(route(state, 'lattice'), 'finale:federation');
    expect(state.ending).toBe('federation');
    expect(state.day).toBeLessThan(120);
    expect(endingText(state)?.text).toContain('independent worlds');
    expect(campaignActions(state)).toEqual([]);
    expect(act(state, 'rescue')).toBe(state);
    expect(loadCampaign()).toEqual(state);
  });

  it('can choose central continuity after standardizing, extracting, and buying a monopoly', () => {
    let state = expedientKeys();
    state = step(route(state, 'palimpsest'), 'scan');
    expect(state.data).toBeGreaterThanOrEqual(25);
    state = route(state, 'lattice');
    const before = state.data;
    state = choose(state, 'finale:coherence');
    expect(state.ending).toBe('coherence');
    expect(state.data).toBe(before - 25);
    expect(state.flags).toEqual(expect.arrayContaining(['choir:standardized', 'forge:extracted', 'exchange:monopoly']));
    expect(state.flags.filter(flag => flag.startsWith('ally:'))).toEqual([]);
    expect(endingText(state)?.text).toContain('Objections disappear');
  });

  it('obtains actual Concord authorization instead of paying for a continuity override', () => {
    let state = expedientKeys();
    state = choose(route(state, 'bastion'), 'concord:accept');
    state = step(route(state, 'breakwater'), 'scan');
    state = choose(route(state, 'bastion'), 'concord:verify');
    expect(state.flags).toContain('ally:concord');
    state = route(state, 'lattice');
    const before = state.data;
    state = choose(state, 'finale:coherence');
    expect(state.ending).toBe('coherence');
    expect(state.data).toBe(before);
  });

  it('requires and clears the Threshold guard before severing the network', () => {
    let state = expedientKeys();
    state = step(route(state, 'lattice'), 'contact');
    expect(available(state, 'finale:sever')?.disabled).toContain('Threshold');
    expect(act(state, 'finale:sever')).toBe(state);
    state = win(route(state, 'threshold'));
    state = choose(route(state, 'lattice'), 'finale:sever');
    expect(state.ending).toBe('sever');
    expect(endingText(state)?.text).toContain('slower routes');
    expect(state.day).toBeLessThan(120);
  });

  it('rescues the schoolship and makes an Exchange monopoly reversible', () => {
    let state = expedientKeys();
    state = prepare(route(state, 'ledger'));
    state = choose(state, 'exchange:reform');
    expect(state.flags).not.toContain('exchange:monopoly');
    expect(state.flags).toContain('ally:exchange');
    state = choose(route(state, 'haven'), 'migrant:accept');
    state = choose(route(state, 'nursery'), 'migrant:evacuate');
    expect(state.flags).toEqual(expect.arrayContaining(['migrant:rescued', 'nursery:resolved', 'ally:migrant']));
    state = route(state, 'haven');
    expect(available(state, 'ship:gondi')?.disabled).toBeUndefined();
    expect(missionBrief(state).some(mission => mission.target === 'nursery')).toBe(false);
  });
});

describe('action integrity and rewards', () => {
  it('opens and closes dialogues and rejects choices outside their conversation', () => {
    const start = createCampaign();
    expect(dialogue(start)).toBeNull();
    expect(act(start, 'harbor:briefing')).toBe(start);
    const opened = step(start, 'contact');
    expect(dialogue(opened)?.choices.map(choice => choice.id)).toContain('harbor:briefing');
    const closed = step(opened, 'close');
    expect(dialogue(closed)).toBeNull();
    expect(closed.day).toBe(start.day);
    const travelled = route(opened, 'vellum');
    expect(dialogue(travelled)).toBeNull();
    expect(travelled.flags.some(flag => flag.startsWith('dialogue:'))).toBe(false);
  });

  it('rejects invalid, disabled, unaffordable, and unearned actions', () => {
    const start = createCampaign();
    for (const id of ['invented', 'travel:missing', 'ship:sholev', 'refuel', 'repair', 'upgrade:resonator', 'finale:federation']) {
      expect(act(start, id)).toBe(start);
    }
    const empty = { ...start, fuel: 0, credits: 0 };
    expect(act(empty, 'travel:vellum')).toBe(empty);
    expect(act(empty, 'refuel')).toBe(empty);
    const atVellum = step(route(start, 'vellum'), 'contact');
    expect(act(atVellum, 'choir:return')).toBe(atVellum);
  });

  it('does not mutate nested inputs during actions or combat resolution', () => {
    const start = freeze(createCampaign());
    const snapshot = JSON.stringify(start);
    const briefed = choose(start, 'harbor:briefing');
    expect(JSON.stringify(start)).toBe(snapshot);
    expect(briefed.flags).not.toBe(start.flags);
    expect(briefed.journal).not.toBe(start.journal);
    expect(briefed.journal[0]).not.toBe(start.journal[0]);
    const battle = freeze(route(briefed, 'crucible'));
    const battleSnapshot = JSON.stringify(battle);
    const won = win(battle);
    expect(JSON.stringify(battle)).toBe(battleSnapshot);
    expect(won.flags).not.toBe(battle.flags);
  });

  it('awards briefing, scans, salvage, and mission turn-ins only once', () => {
    let state = choose(createCampaign(), 'harbor:briefing');
    state = step(state, 'contact');
    expect(act(state, 'harbor:briefing')).toBe(state);
    state = step(state, 'scan');
    expect(act(state, 'scan')).toBe(state);
    state = step(state, 'salvage');
    expect(act(state, 'salvage')).toBe(state);
    state = alliedKeys();
    state = step(route(state, 'vellum'), 'contact');
    expect(act(state, 'choir:return')).toBe(state);
    state = step(route(state, 'kiln'), 'contact');
    expect(act(state, 'forge:share')).toBe(state);
    state = step(route(state, 'ledger'), 'contact');
    expect(act(state, 'exchange:cooperate')).toBe(state);
  });

  it('advances mission targets from investigation to return to the finale', () => {
    let state = choose(route(choose(createCampaign(), 'harbor:briefing'), 'vellum'), 'choir:accept');
    expect(missionBrief(state).find(mission => mission.title === 'The Choir resonant key')?.target).toBe('prism');
    state = step(route(state, 'prism'), 'scan');
    expect(missionBrief(state).find(mission => mission.title === 'The Choir resonant key')?.target).toBe('vellum');
    state = alliedKeys();
    expect(missionBrief(state)[0].target).toBe('lattice');
  });

  it('clamps salvage damage and guarantees a tow for a bankrupt disabled vessel', () => {
    const start = createCampaign();
    const disabled = { ...start, fuel: 0, hull: 0, credits: 0 };
    const recovered = step(disabled, 'rescue');
    expect(recovered).toMatchObject({ current: 'harbor', hull: 60, fuel: 22, credits: 0, day: 4 });
    const fragile = { ...start, current: 'palimpsest', visited: ['harbor', 'palimpsest'], hull: 1 };
    const salvaged = step(fragile, 'salvage');
    expect(salvaged.current).toBe('harbor');
    expect(salvaged.hull).toBe(60);
    expect(salvaged.salvaged).toContain('palimpsest');
  });

  it('issues each pressure warning once and closes the window at day 120', () => {
    let state = { ...createCampaign(), day: 44 };
    state = step(state, 'scan');
    expect(state.flags).toContain('pressure:45');
    state = step(state, 'salvage');
    expect(state.journal.filter(entry => entry.title === 'The second silence')).toHaveLength(1);
    state = { ...state, day: 119 };
    state = step(state, 'travel:vellum');
    expect(state.ending).toBe('collapse');
    expect(state.combat).toBeNull();
    expect(dialogue(state)).toBeNull();
    expect(endingText(state)?.title).toBe('The future nobody chose');
  });

  it('can save a deadline ending after a long crossing overshoots day 120', () => {
    const late = { ...createCampaign(), current: 'aperture', visited: ['harbor', 'aperture'], day: 119 };
    const ended = step(late, 'travel:ossuary');
    expect(ended.day).toBe(126);
    expect(ended.ending).toBe('collapse');
    expect(ended.combat).toBeNull();
    expect(loadCampaign()).toEqual(ended);
  });
});

describe('combat recovery', () => {
  function missionBattle() {
    return route(choose(route(choose(createCampaign(), 'harbor:briefing'), 'kiln'), 'forge:accept'), 'crucible');
  }

  it('only exposes retreat and rescue during a guarded encounter', () => {
    const battle = missionBattle();
    expect(campaignActions(battle).map(action => action.id)).toEqual(['retreat', 'rescue']);
    for (const id of ['scan', 'salvage', 'contact', 'travel:harbor']) expect(act(battle, id)).toBe(battle);
    expect(dialogue(battle)).toBeNull();
  });

  it('retreats to the origin without rewarding or losing the accepted mission', () => {
    const battle = missionBattle();
    const retreated = step(battle, 'retreat');
    expect(retreated.current).toBe('kiln');
    expect(retreated.flags).toContain('quest:forge');
    expect(retreated.flags).not.toContain('cleared:crucible');
    expect(retreated.flags.some(flag => flag.startsWith('battle-origin:'))).toBe(false);
    expect(retreated.credits).toBe(battle.credits);
    expect(retreated.data).toBe(battle.data);
    expect(retreated.day).toBe(battle.day + 1);
  });

  it('tows a defeated ship home and preserves evidence and mission progress', () => {
    const battle = missionBattle();
    const defeated = combatResult(battle, { won: false, escaped: false, hullFraction: 0 });
    expect(defeated).toMatchObject({ current: 'harbor', hull: 60, combat: null });
    expect(defeated.fuel).toBeGreaterThanOrEqual(22);
    expect(defeated.credits).toBe(Math.max(0, battle.credits - 20));
    expect(defeated.day).toBe(battle.day + 3);
    expect(defeated.flags).toEqual(expect.arrayContaining(['briefed', 'quest:forge']));
    expect(defeated.scanned).toEqual(battle.scanned);
    expect(saveCampaign(defeated)).toBe(true);
  });

  it('cannot replay a victory or collect its battle reward again on revisit', () => {
    const won = win(missionBattle());
    expect(combatResult(won, { won: true, escaped: false, hullFraction: 1 })).toBe(won);
    const revisited = route(route(won, 'kiln'), 'crucible');
    expect(revisited.combat).toBeNull();
    expect(revisited.flags.filter(flag => flag === 'cleared:crucible')).toHaveLength(1);
    expect(revisited.data).toBe(won.data);
  });

  it('ignores malformed and contradictory battle results', () => {
    const battle = missionBattle();
    for (const hullFraction of [NaN, Infinity, -0.1, 1.1]) {
      expect(combatResult(battle, { won: true, escaped: false, hullFraction })).toBe(battle);
    }
    expect(combatResult(battle, { won: true, escaped: true, hullFraction: 0.5 })).toBe(battle);
  });
});

describe('fleet modules and travel', () => {
  it('installs tank and armor capacity once, charging both currency types correctly', () => {
    let state = { ...createCampaign(), credits: 500, data: 100, fuel: 10, hull: 50 };
    const tank = UPGRADES.find(upgrade => upgrade.id === 'tank')!;
    state = step(state, 'upgrade:tank');
    expect(state.fuel).toBe(40);
    expect(maxFuel(state)).toBe(66);
    expect(state.credits).toBe(500 - tank.cost);
    expect(act(state, 'upgrade:tank')).toBe(state);
    state = step(state, 'upgrade:armor');
    expect(state.hull).toBe(90);
    expect(maxHull(state)).toBe(140);
    const scanner = UPGRADES.find(upgrade => upgrade.id === 'scanner')!;
    const before = state.data;
    state = step(state, 'upgrade:scanner');
    expect(state.data).toBe(before - scanner.dataCost);
  });

  it('reduces travel fuel with the drive and repairs two hull per journey with the bay', () => {
    const start = { ...createCampaign(), credits: 500, data: 100, hull: 50 };
    const normalCost = travelCost(start, 'lattice');
    const equipped = step(step(start, 'upgrade:drive'), 'upgrade:medbay');
    const equippedCost = travelCost(equipped, 'lattice');
    expect(equippedCost.fuel).toBeLessThan(normalCost.fuel);
    expect(equippedCost.days).toBe(normalCost.days);
    const travelled = step(equipped, 'travel:lattice');
    expect(travelled.fuel).toBe(equipped.fuel - equippedCost.fuel);
    expect(travelled.hull).toBe(52);
    expect(travelled.day).toBe(equipped.day + equippedCost.days);
    expect(travelCost(start, 'missing')).toEqual({ fuel: Infinity, days: Infinity });
    expect(travelCost(start, 'harbor')).toEqual({ fuel: 0, days: 0 });
  });

  it('collects scanner bonus once and transfers campaign supplies to allied hulls', () => {
    let state = alliedKeys();
    state = prepare(state);
    state = step(state, 'upgrade:scanner');
    const before = state.data;
    state = step(state, 'scan');
    expect(state.data).toBe(before + 7);
    const resources = { fuel: state.fuel, hull: state.hull, credits: state.credits, data: state.data };
    state = step(state, 'ship:gondi');
    expect(state).toMatchObject({ ...resources, ship: 'gondi' });
    state = step(state, 'ship:sholev');
    expect(state).toMatchObject({ ...resources, ship: 'sholev' });
    expect(state.upgrades).toContain('scanner');
    state = step(state, 'ship:michiGichi');
    expect(state.ship).toBe('michiGichi');
  });
});

describe('save safety', () => {
  it('round-trips a pending encounter and returns an independent loaded state', () => {
    const battle = route(createCampaign(), 'convoy');
    expect(saveCampaign(battle)).toBe(true);
    const loaded = loadCampaign()!;
    expect(loaded).toEqual(battle);
    expect(loaded).not.toBe(battle);
    loaded.flags.push('briefed');
    loaded.journal[0].text = 'changed';
    expect(battle.flags).not.toContain('briefed');
    expect(loadCampaign()).toEqual(battle);
  });

  it.each(['{broken', 'null', '[]', '{"version":2}', 'x'.repeat(300001)])('rejects malformed or oversized storage without throwing', raw => {
    localStorage.setItem(SAVE_KEY, raw);
    expect(loadCampaign()).toBeNull();
  });

  it.each<[string, Record<string, unknown>]>([
    ['version', { version: 2 }],
    ['nonfinite fuel', { fuel: Infinity }],
    ['negative credits', { credits: -1 }],
    ['fractional day', { day: 1.5 }],
    ['capacity without tank', { fuel: 37 }],
    ['capacity without armor', { hull: 101 }],
    ['unknown system', { current: 'lost' }],
    ['unvisited current', { current: 'vellum' }],
    ['unvisited scan', { scanned: ['prism'] }],
    ['duplicate reward marker', { salvaged: ['harbor', 'harbor'] }],
    ['unknown upgrade', { upgrades: ['free-energy'] }],
    ['missing faction relation', { relations: {} }],
    ['wrong open channel', { flags: ['dialogue:vellum'] }],
    ['orphan combat origin', { flags: ['battle-origin:harbor'] }],
    ['late undecided save', { day: 120 }],
    ['premature collapse', { ending: 'collapse' }],
    ['unearned federation', { ending: 'federation' }],
    ['unearned central ending', { ending: 'coherence' }],
    ['unearned severance', { ending: 'sever' }],
    ['unscanned evidence', { flags: ['evidence:copy'] }],
  ])('rejects corrupted save: %s', (_label, patch) => {
    const invalid = { ...createCampaign(), ...patch } as CampaignState;
    expect(saveCampaign(invalid)).toBe(false);
    localStorage.setItem(SAVE_KEY, JSON.stringify(invalid));
    expect(loadCampaign()).toBeNull();
  });

  it('rejects numeric overflow parsed from JSON', () => {
    const raw = JSON.stringify(createCampaign()).replace('"credits":80', '"credits":1e309');
    localStorage.setItem(SAVE_KEY, raw);
    expect(loadCampaign()).toBeNull();
  });

  it('handles browsers that deny access to persistent storage', () => {
    const denied = {
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('quota'); },
    } as unknown as Storage;
    expect(loadCampaign(denied)).toBeNull();
    expect(saveCampaign(createCampaign(), denied)).toBe(false);
  });
});
