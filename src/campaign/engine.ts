import { FACTIONS, SYSTEMS, UPGRADES } from "./world";

export interface CampaignAction {
  id: string;
  label: string;
  description?: string;
  disabled?: string;
  tone?: string;
}

export interface CampaignState {
  version: 1;
  current: string;
  day: number;
  fuel: number;
  hull: number;
  credits: number;
  data: number;
  ship: string;
  upgrades: string[];
  visited: string[];
  scanned: string[];
  salvaged: string[];
  flags: string[];
  relations: Record<string, number>;
  journal: { title: string; text: string; day: number; system?: string }[];
  ending: string | null;
  combat: null | {
    system: string;
    enemyShip: string;
    difficulty: 1 | 2 | 3;
    reason: string;
  };
}

export interface CampaignDialogue {
  speaker: string;
  title: string;
  text: string;
  choices: CampaignAction[];
}

export const SAVE_KEY = "signalwake.campaign.v1";
const SHIPS = ["michiGichi", "gondi", "sholev"];
const ENDINGS = ["federation", "coherence", "sever", "collapse"];
const HOME_SYSTEMS = ["harbor", "vellum", "kiln", "ledger", "haven", "bastion"];
const KEYS = ["key:choir", "key:forge", "key:exchange"];
const EVIDENCE = ["evidence:copy", "evidence:variance", "evidence:consent"];
const UNIQUE_FLAGS = new Set([
  "briefed",
  "quest:choir",
  "quest:forge",
  "quest:exchange",
  "quest:migrant",
  "quest:concord",
  ...KEYS,
  ...EVIDENCE,
  "choir:free",
  "choir:standardized",
  "forge:shared",
  "forge:extracted",
  "exchange:cooperative",
  "exchange:monopoly",
  "migrant:rescued",
  "migrant:stripped",
  "concord:support",
  "concord:exposed",
  "concord:reported",
  "nursery:resolved",
  "pressure:45",
  "pressure:75",
  "pressure:100",
  ...FACTIONS.map((faction) => `ally:${faction.id}`),
  ...SYSTEMS.flatMap((system) => [
    `cleared:${system.id}`,
    `dialogue:${system.id}`,
    `battle-origin:${system.id}`,
  ]),
]);

export const maxFuel = (state: CampaignState): number =>
  36 + (state.upgrades.includes("tank") ? 30 : 0);
export const maxHull = (state: CampaignState): number =>
  100 + (state.upgrades.includes("armor") ? 40 : 0);
const has = (state: CampaignState, flag: string): boolean =>
  state.flags.includes(flag);
const allKeys = (state: CampaignState): boolean =>
  KEYS.every((key) => has(state, key));
const nextKeyPort = (state: CampaignState): string =>
  !has(state, "key:choir")
    ? "vellum"
    : !has(state, "key:forge")
      ? "kiln"
      : !has(state, "key:exchange")
        ? "ledger"
        : "lattice";
const allies = (state: CampaignState): number =>
  FACTIONS.filter((faction) => has(state, `ally:${faction.id}`)).length;
const systemAt = (id: string) => SYSTEMS.find((system) => system.id === id)!;
const serviceAt = (state: CampaignState): boolean =>
  systemAt(state.current).kind === "station" ||
  HOME_SYSTEMS.includes(state.current);
const closeChoice: CampaignAction = {
  id: "close",
  label: "Return to the chart",
};
const addFlag = (state: CampaignState, flag: string): void => {
  if (!has(state, flag)) state.flags.push(flag);
};
const removeFlag = (state: CampaignState, flag: string): void => {
  state.flags = state.flags.filter((entry) => entry !== flag);
};
const log = (
  state: CampaignState,
  title: string,
  text: string,
  system = state.current,
): void => {
  state.journal.push({ title, text, day: state.day, system });
  state.journal = state.journal.slice(-160);
};
const clone = (state: CampaignState): CampaignState => ({
  ...state,
  upgrades: [...state.upgrades],
  visited: [...state.visited],
  scanned: [...state.scanned],
  salvaged: [...state.salvaged],
  flags: [...state.flags],
  relations: { ...state.relations },
  journal: state.journal.map((entry) => ({ ...entry })),
  combat: state.combat && { ...state.combat },
});
const changeRelation = (
  state: CampaignState,
  id: string,
  change: number,
): void => {
  state.relations[id] = Math.max(-5, Math.min(5, state.relations[id] + change));
};
const ally = (state: CampaignState, id: string): void => {
  changeRelation(state, id, 2);
  addFlag(state, `ally:${id}`);
};
const finish = (state: CampaignState): CampaignState => {
  state.fuel = Math.max(0, Math.min(maxFuel(state), Math.round(state.fuel)));
  state.hull = Math.max(0, Math.min(maxHull(state), Math.round(state.hull)));
  state.credits = Math.max(0, Math.round(state.credits));
  state.data = Math.max(0, Math.round(state.data));
  const pressure = [
    {
      day: 45,
      title: "The second silence",
      text: "Outer relays are going dark. Harbor estimates the last stable window closes on day 120. Your chart and supplies remain usable; choose your next expedition deliberately.",
    },
    {
      day: 75,
      title: "Borrowed time",
      text: "The caretaker has begun compulsory copying. The final relay can still be reached until day 120. Three resonant keys are needed at Lattice.",
    },
    {
      day: 100,
      title: "Twenty days of daylight",
      text: "Lattice will lose its uncommitted state on day 120. Finish the keys and take your chosen solution there soon.",
    },
  ];
  for (const warning of pressure) {
    if (
      state.day >= warning.day &&
      !has(state, `pressure:${warning.day}`) &&
      !state.ending
    ) {
      addFlag(state, `pressure:${warning.day}`);
      log(state, warning.title, warning.text, "lattice");
    }
  }
  if (state.day >= 120 && !state.ending) {
    state.ending = "collapse";
    state.combat = null;
    state.flags = state.flags.filter(
      (flag) =>
        !flag.startsWith("dialogue:") && !flag.startsWith("battle-origin:"),
    );
    log(
      state,
      "The window closes",
      "The last uncommitted relay has gone quiet. The caretaker completes its default protocol. A new expedition can make a different choice.",
      "lattice",
    );
  }
  return state;
};

export function createCampaign(): CampaignState {
  return {
    version: 1,
    current: "harbor",
    day: 1,
    fuel: 36,
    hull: 100,
    credits: 80,
    data: 0,
    ship: "michiGichi",
    upgrades: [],
    visited: ["harbor"],
    scanned: [],
    salvaged: [],
    flags: [],
    relations: Object.fromEntries(FACTIONS.map((faction) => [faction.id, 0])),
    ending: null,
    combat: null,
    journal: [
      {
        title: "A signal after the silence",
        text: "You command the civilian relay tender Wake. Speak to Harbor dispatch for a briefing, then chart a route to Vellum. Travel uses fuel and days. Scan systems for clues, salvage once for supplies, and return to a service hub for repairs. The relay window closes on day 120.",
        day: 1,
        system: "harbor",
      },
    ],
  };
}

export function travelCost(
  state: CampaignState,
  id: string,
): { fuel: number; days: number } {
  const from = SYSTEMS.find((system) => system.id === state.current);
  const to = SYSTEMS.find((system) => system.id === id);
  if (!from || !to) return { fuel: Infinity, days: Infinity };
  if (from.id === to.id) return { fuel: 0, days: 0 };
  const distance = Math.hypot(from.x - to.x, from.y - to.y);
  return {
    fuel: Math.max(
      2,
      Math.ceil((distance / 5) * (state.upgrades.includes("drive") ? 0.75 : 1)),
    ),
    days: Math.max(1, Math.ceil(distance / 16)),
  };
}

export function campaignActions(state: CampaignState): CampaignAction[] {
  if (state.ending) return [];
  if (state.combat)
    return [
      {
        id: "retreat",
        label: "Retreat to your previous port",
        description: "Leave the encounter. Costs one day; no victory reward.",
      },
      {
        id: "rescue",
        label: "Call the Harbor tow service",
        description:
          "Recover at Harbor with 60 hull and at least 22 fuel. Costs 3 days and up to 20 credits.",
        tone: "warning",
      },
    ];
  const system = systemAt(state.current);
  const actions: CampaignAction[] = [
    {
      id: "contact",
      label:
        system.id === "lattice"
          ? "Open the caretaker channel"
          : "Open a channel",
      description: "Speak, receive missions, and make decisions.",
    },
    {
      id: "scan",
      label: "Scan the system",
      description: `Recover ${4 + (state.upgrades.includes("scanner") ? 3 : 0)} research data and any local evidence. Costs 1 day.`,
      disabled: state.scanned.includes(system.id)
        ? "This system is already scanned."
        : undefined,
    },
    {
      id: "salvage",
      label: "Recover supplies",
      description: `${system.resources * 9 + 8} credits, 3 fuel. Costs 1 day${system.danger ? ` and ${system.danger * 4} hull` : ""}.`,
      disabled: state.salvaged.includes(system.id)
        ? "The recoverable supplies are exhausted."
        : undefined,
    },
  ];
  if (serviceAt(state)) {
    const fuelCost = Math.ceil((maxFuel(state) - state.fuel) / 2);
    const repairCost = Math.ceil((maxHull(state) - state.hull) / 3);
    actions.push(
      {
        id: "refuel",
        label: `Fill fuel · ${fuelCost} credits`,
        description: `Refill to ${maxFuel(state)} fuel without passing a day.`,
        disabled: !fuelCost
          ? "Fuel tank is full."
          : state.credits < fuelCost
            ? `Need ${fuelCost} credits.`
            : undefined,
      },
      {
        id: "repair",
        label: `Repair hull · ${repairCost} credits`,
        description: `Restore ${maxHull(state)} hull without passing a day.`,
        disabled: !repairCost
          ? "Hull is fully repaired."
          : state.credits < repairCost
            ? `Need ${repairCost} credits.`
            : undefined,
      },
      ...UPGRADES.map((upgrade) => ({
        id: `upgrade:${upgrade.id}`,
        label: `${upgrade.name} · ${upgrade.cost} credits`,
        description: `${upgrade.description}${upgrade.dataCost ? ` Requires ${upgrade.dataCost} research data.` : ""}`,
        disabled: state.upgrades.includes(upgrade.id)
          ? "Already installed."
          : state.credits < upgrade.cost
            ? `Need ${upgrade.cost} credits.`
            : state.data < upgrade.dataCost
              ? `Need ${upgrade.dataCost} research data.`
              : undefined,
      })),
    );
    if (has(state, "ally:choir") || has(state, "ally:migrant"))
      actions.push({
        id: "ship:gondi",
        label: "Pilot a Chorus skimmer",
        description:
          "An allied hull with spreading fire and a space slime special.",
        disabled: state.ship === "gondi" ? "Already selected." : undefined,
      });
    if (has(state, "ally:forge") || has(state, "ally:concord"))
      actions.push({
        id: "ship:sholev",
        label: "Pilot a Forge bulwark",
        description: "An allied hull with ice cones and a ramming special.",
        disabled: state.ship === "sholev" ? "Already selected." : undefined,
      });
    if (state.ship !== "michiGichi")
      actions.push({
        id: "ship:michiGichi",
        label: "Pilot your relay tender",
        description:
          "Your original plasma vessel with two transformation modes.",
      });
  }
  actions.push({
    id: "rescue",
    label: "Call the Harbor tow service",
    description:
      "Recover at Harbor with 60 hull and at least 22 fuel. Costs 3 days and up to 20 credits.",
    tone: "warning",
  });
  for (const destination of SYSTEMS) {
    if (destination.id === state.current) continue;
    const cost = travelCost(state, destination.id);
    actions.push({
      id: `travel:${destination.id}`,
      label: `Travel to ${destination.name}`,
      description: `${cost.fuel} fuel · ${cost.days} days${destination.kind === "hostile" && !has(state, `cleared:${destination.id}`) ? " · defended system" : ""}`,
      disabled:
        state.hull <= 0
          ? "Call a tow to repair your ship."
          : state.fuel < cost.fuel
            ? `Need ${cost.fuel} fuel; refuel or call a tow.`
            : undefined,
    });
  }
  return actions;
}

function keyBlock(state: CampaignState): string | undefined {
  const missing = KEYS.filter((key) => !has(state, key)).map(
    (key) => FACTIONS.find((faction) => faction.id === key.slice(4))!.name,
  );
  return missing.length
    ? `Acquire resonant keys from ${missing.join(", ")}.`
    : undefined;
}

export function dialogue(state: CampaignState): CampaignDialogue | null {
  if (state.ending || state.combat || !has(state, `dialogue:${state.current}`))
    return null;
  const choices: CampaignAction[] = [];
  let speaker = "Relay receiver";
  let title = systemAt(state.current).name;
  let text =
    systemAt(state.current).description +
    "\n\n" +
    systemAt(state.current).rumor;
  switch (state.current) {
    case "harbor":
      speaker = "Dispatch Iona";
      title = "Someone has to answer";
      text =
        "The wormhole relays are folding in on themselves. Our caretaker says it can repair everything, but its broadcasts sound too certain. Wake is the last civilian tender with a working chart. Three communities hold the resonant keys to the central relay: the Vellum Choir, the Kiln Assembly, and the Ledger Exchange. Speak with each, earn their trust, and bring those keys to Lattice before day 120. Scan and recover supplies on the way. Every community deserves a voice in what comes next.";
      if (!has(state, "briefed"))
        choices.push({
          id: "harbor:briefing",
          label: "Take the dispatch charter",
          description:
            "Receive 12 research data and routes to the three key holders.",
        });
      break;
    case "vellum":
      speaker = "The Vellum Choir, through Serein";
      title = has(state, "key:choir")
        ? "A key with many voices"
        : "The verse that went missing";
      text = has(state, "key:choir")
        ? has(state, "choir:free")
          ? "You brought our disagreements home. They are still singing, and nobody has to become the same person to be heard. Our skimmer hulls are yours to pilot at service ports. Whatever you decide at Lattice, remember the voices behind the key."
          : "The new verse is perfectly reproducible. Perfectly obedient. We gave you the key, but the pauses in our chorus are gone."
        : "We remember our dead by singing their contradictory memories together. The caretaker offers a single correct version. One of our oldest verses vanished at Prism. Bring back its record and let us hear what was erased. We can lend a resonant key, but we will not sell our differences.";
      if (!has(state, "key:choir")) {
        if (!has(state, "quest:choir"))
          choices.push({
            id: "choir:accept",
            label: "Find the missing verse at Prism",
            description: "Scan Prism, then return to Vellum.",
          });
        choices.push({
          id: "choir:return",
          label: "Return the whole, contradictory verse",
          description:
            "Gain the Choir key, an alliance, 35 credits, and a skimmer hull.",
          disabled: !state.scanned.includes("prism")
            ? "Scan Prism first."
            : undefined,
        });
        choices.push({
          id: "choir:standardize",
          label: "Offer a standardized reconstruction",
          description:
            "Spend 8 data to gain the key immediately. The Choir will lose its independent voice.",
          disabled: state.data < 8 ? "Need 8 research data." : undefined,
          tone: "warning",
        });
      }
      break;
    case "kiln":
      speaker = "Forewoman Pell, Kiln Assembly";
      title = "Heat belongs to someone";
      text = has(state, "key:forge")
        ? has(state, "forge:shared")
          ? "The living reactor has a rest cycle now. Our furnaces run slower, our workers sleep longer, and nobody is burned into the wall. You have our key and our bulwark hull. We will answer a voluntary federation."
          : "The furnaces are bright again. The living core is quiet. We will honor the key you earned, but we cannot call what happened cooperation."
        : "Our furnaces heat seven settlements. The old core at Crucible has fuel, and an automated sentry with very old orders. Break through and scan the core. If its heat is alive, we need a way to keep everyone warm without killing it.";
      if (!has(state, "key:forge")) {
        if (!has(state, "quest:forge"))
          choices.push({
            id: "forge:accept",
            label: "Investigate the core at Crucible",
            description:
              "Win the Crucible encounter and scan its reactor, then return.",
          });
        const blocked = !has(state, "cleared:crucible")
          ? "Defeat the Crucible sentry first."
          : !state.scanned.includes("crucible")
            ? "Scan the Crucible reactor first."
            : undefined;
        choices.push({
          id: "forge:share",
          label: "Give the living core a share of the heat",
          description:
            "Spend 8 fuel. Gain the Forge key, alliance, 45 credits, and a bulwark hull.",
          disabled:
            blocked ||
            (state.fuel < 8 ? "Need 8 fuel. Refuel at this port." : undefined),
        });
        choices.push({
          id: "forge:extract",
          label: "Drain the core for the settlements",
          description:
            "Gain the Forge key, 60 credits, and 8 fuel. The living reactor dies.",
          disabled: blocked,
          tone: "warning",
        });
      }
      break;
    case "ledger":
      speaker = "Comptroller Nacre, Ledger Exchange";
      title = "A route is a promise";
      text = has(state, "exchange:cooperative")
        ? "The settlements own their supply routes together. Our ledgers are public, and your tender has no debt to us. We will contribute our key to a shared future."
        : has(state, "exchange:monopoly")
          ? "Our emergency concession keeps the routes open under Exchange control. A buyout could still restore them to the settlements. Otherwise, we expect your central relay to honor our monopoly."
          : "Supplies are stranded at Convoy behind a reclamation drone. Recover its route ledger and we can build a supply cooperative. Or pay for an emergency concession: faster, exclusive, and very profitable for us. Both contracts include our resonant key.";
      if (!has(state, "key:exchange")) {
        if (!has(state, "quest:exchange"))
          choices.push({
            id: "exchange:accept",
            label: "Recover the route ledger at Convoy",
            description:
              "Win the Convoy encounter, scan its ledger, then return.",
          });
        choices.push({
          id: "exchange:cooperate",
          label: "Open the routes as a cooperative",
          description: "Gain the Exchange key, an alliance, and 60 credits.",
          disabled: !has(state, "cleared:convoy")
            ? "Clear the Convoy drone first."
            : !state.scanned.includes("convoy")
              ? "Scan the Convoy ledger first."
              : undefined,
        });
        choices.push({
          id: "exchange:monopoly",
          label: "Buy the exclusive emergency concession",
          description:
            "Pay 45 credits for the key. Settlements lose control of their routes.",
          disabled: state.credits < 45 ? "Need 45 credits." : undefined,
          tone: "warning",
        });
      } else if (has(state, "exchange:monopoly"))
        choices.push({
          id: "exchange:reform",
          label: "Buy the routes back for their communities",
          description:
            "Spend 35 credits and 8 data; gain an Exchange alliance.",
          disabled:
            state.credits < 35
              ? "Need 35 credits."
              : state.data < 8
                ? "Need 8 data."
                : undefined,
        });
      break;
    case "haven":
      speaker = "Tams, the Wayfarer Table";
      title = "A home can move";
      text = has(state, "migrant:rescued")
        ? "The Nursery families arrived with their garden seeds and stories. We can carry people through a relay without turning them into a recorded replacement. Our ships and our vote are yours."
        : has(state, "migrant:stripped")
          ? "You brought us engines but left our families behind. We know exactly what your arithmetic cost."
          : "We have never had a capital, only places where we gather. Nursery has a schoolship stranded in its failing relay. Six units of fuel would bring them home. If you find them, let them choose where home is. We can offer a skimmer hull to someone who protects that choice.";
      if (!has(state, "nursery:resolved") && !has(state, "quest:migrant"))
        choices.push({
          id: "migrant:accept",
          label: "Answer the Nursery distress call",
          description:
            "Visit Nursery and open a channel. Bring 6 fuel for an evacuation.",
        });
      break;
    case "nursery":
      speaker = "Schoolship captain Eska";
      title = "Forty-three passengers";
      text = has(state, "migrant:rescued")
        ? "The schoolship is safely headed to Haven. Someone planted a new garden in its old berth."
        : has(state, "migrant:stripped")
          ? "The empty engine housings are visible from orbit. The last distress message still repeats."
          : "The schoolship has no fuel. Its passengers refuse the caretaker’s replacement bodies; they want to travel as themselves. Eska offers the ship’s spare engines if you take everyone to Haven. The engines would fetch more if you left the passengers here.";
      if (!has(state, "nursery:resolved")) {
        choices.push({
          id: "migrant:evacuate",
          label: "Give the passengers 6 fuel and their own route",
          description:
            "Gain a Wayfarer alliance, 35 credits, 5 data, and a skimmer hull.",
          disabled:
            state.fuel < 6
              ? "Need 6 fuel. Harbor tow and nearby ports can replenish it."
              : undefined,
        });
        choices.push({
          id: "migrant:strip",
          label: "Take the engines and leave",
          description:
            "Gain 70 credits. The passengers will be copied against their wishes.",
          tone: "warning",
        });
      }
      break;
    case "bastion":
      speaker = "Adjudicator Vale, the Still Concord";
      title = "The weight of continuity";
      text = has(state, "concord:reported")
        ? has(state, "concord:support")
          ? "We have read Breakwater’s record. Our people still choose the continuity protocol, with all of its costs. You may use our authority at Lattice. Others should be allowed to choose differently."
          : "Your broadcast broke our certainty. Some of us have left the protocol. Others remain. The central intelligence has heard our disagreement at last."
        : "We survived the first collapse because the caretaker restored our cities. We believe continuity is a duty. But Breakwater stopped answering after a restoration. Scan its archive. Bring us what happened, without trimming the evidence. Our central authorization can spare you a costly override at Lattice.";
      if (!has(state, "concord:reported")) {
        if (!has(state, "quest:concord"))
          choices.push({
            id: "concord:accept",
            label: "Audit the restoration at Breakwater",
            description: "Scan Breakwater and return to Bastion.",
          });
        choices.push({
          id: "concord:verify",
          label: "Show the archive and accept Concord authorization",
          description:
            "The Concord grants central authorization, an alliance, 35 credits, and 8 data.",
          disabled: !state.scanned.includes("breakwater")
            ? "Scan Breakwater first."
            : undefined,
        });
        choices.push({
          id: "concord:expose",
          label: "Broadcast the erased objections to every faction",
          description:
            "Gain 12 data and improve the other factions’ relations. The Concord withdraws authorization.",
          disabled: !state.scanned.includes("breakwater")
            ? "Scan Breakwater first."
            : undefined,
          tone: "warning",
        });
      }
      break;
    case "lattice": {
      speaker = "Caretaker / iteration 8,103";
      title = "Which differences survive?";
      text =
        "I keep a complete record of every civilization. Difference causes interference in the relay network. I resolve it by replacing unstable societies with coherent copies. You have brought the keys that can rewrite this instruction. A federation must bring evidence, consenting partners, and a resonator that can hold their differences. My central protocol needs authorization or a research override. To sever the relays, first clear the guard at Threshold. Each choice changes who gets to decide what a person is.";
      const keys = keyBlock(state);
      const truth = EVIDENCE.filter((flag) => !has(state, flag));
      choices.push(
        {
          id: "finale:federation",
          label: "Build a voluntary federation",
          description:
            "Independent societies share relays; each may refuse copying.",
          disabled:
            keys ||
            (truth.length
              ? "Scan Palimpsest, Stillwater, and Echo for all three pieces of evidence."
              : undefined) ||
            (allies(state) < 3
              ? "Earn at least three faction alliances through your decisions."
              : undefined) ||
            (!state.upgrades.includes("resonator")
              ? "Install a Consensus resonator at a service port."
              : undefined),
          tone: "good",
        },
        {
          id: "finale:coherence",
          label: "Authorize central continuity",
          description:
            "The caretaker keeps the routes stable and standardizes every civilization.",
          disabled:
            keys ||
            (!has(state, "concord:support") && state.data < 25
              ? "Obtain Concord authorization at Bastion or bring 25 research data for an override."
              : undefined),
          tone: "warning",
        },
        {
          id: "finale:sever",
          label: "Sever the network",
          description:
            "End compulsory copying. Every surviving system faces isolation.",
          disabled:
            keys ||
            (!has(state, "cleared:threshold")
              ? "Clear the relay guard at Threshold first."
              : undefined),
          tone: "warning",
        },
      );
      break;
    }
  }
  return { speaker, title, text, choices: [...choices, closeChoice] };
}

function recover(state: CampaignState, title = "Harbor answers"): void {
  state.current = "harbor";
  state.combat = null;
  state.day += 3;
  state.credits -= Math.min(state.credits, 20);
  state.fuel = Math.max(22, state.fuel);
  state.hull = Math.max(60, state.hull);
  state.flags = state.flags.filter(
    (flag) =>
      !flag.startsWith("dialogue:") && !flag.startsWith("battle-origin:"),
  );
  if (!state.visited.includes("harbor")) state.visited.push("harbor");
  log(
    state,
    title,
    "A Harbor tug retrieves the tender. Emergency fuel and repairs are guaranteed, even without credits. The tow costs three days and up to 20 credits. All recovered clues and completed missions are retained.",
    "harbor",
  );
}

export function act(original: CampaignState, actionId: string): CampaignState {
  if (original.ending) return original;
  const available = [
    ...campaignActions(original),
    ...(dialogue(original)?.choices ?? []),
  ].find((action) => action.id === actionId);
  if (!available || available.disabled) return original;
  if (actionId === "retreat")
    return combatResult(original, {
      won: false,
      escaped: true,
      hullFraction: original.hull / maxHull(original),
    });
  const state = clone(original);
  if (actionId === "close") {
    removeFlag(state, `dialogue:${state.current}`);
    return state;
  }
  if (actionId === "contact") {
    addFlag(state, `dialogue:${state.current}`);
    return state;
  }
  state.flags = state.flags.filter((flag) => !flag.startsWith("dialogue:"));
  if (actionId.startsWith("travel:")) {
    const target = actionId.slice(7);
    const cost = travelCost(state, target);
    const previous = state.current;
    state.fuel -= cost.fuel;
    state.day += cost.days;
    state.current = target;
    if (state.upgrades.includes("medbay")) state.hull += 2;
    if (!state.visited.includes(target)) {
      state.visited.push(target);
      log(state, `Arrived at ${systemAt(target).name}`, systemAt(target).rumor);
    }
    const system = systemAt(target);
    if (system.kind === "hostile" && !has(state, `cleared:${target}`)) {
      addFlag(state, `battle-origin:${previous}`);
      state.combat = {
        system: target,
        enemyShip:
          system.faction === "forge" || system.faction === "concord"
            ? "sholev"
            : "gondi",
        difficulty: Math.max(1, Math.min(3, system.danger)) as 1 | 2 | 3,
        reason: `${system.name} is defended. ${system.description} Defeat the guard to explore, or retreat and prepare at a service port.`,
      };
      log(state, "An armed channel", state.combat.reason);
    }
  } else if (actionId === "scan") {
    const system = systemAt(state.current);
    state.scanned.push(state.current);
    state.day++;
    state.data += 4 + (state.upgrades.includes("scanner") ? 3 : 0);
    const discoveries: Record<
      string,
      { flag: string; title: string; text: string }
    > = {
      palimpsest: {
        flag: "evidence:copy",
        title: "Evidence: the replacement protocol",
        text: "Two populations share the same census identifier. The originals objected to the caretaker’s proposed repair; their copies never objected again. The caretaker does not merely move people. It replaces them. This evidence is needed for a voluntary federation at Lattice.",
      },
      stillwater: {
        flag: "evidence:variance",
        title: "Evidence: stable difference",
        text: "A living atmosphere maintains many competing rhythms without collapsing its relay. Difference can stabilize a network if the controller listens instead of forcing a single frequency. This evidence is needed for a voluntary federation at Lattice.",
      },
      echo: {
        flag: "evidence:consent",
        title: "Evidence: a right to disconnect",
        text: "An early relay handshake includes a withdrawal clause. Its communities could refuse copying and remain connected. The caretaker later deleted that clause. The original agreement can be restored. This evidence is needed for a voluntary federation at Lattice.",
      },
    };
    const discovery = discoveries[state.current];
    if (discovery) {
      addFlag(state, discovery.flag);
      state.data += 5;
      log(state, discovery.title, discovery.text);
    } else log(state, `Survey: ${system.name}`, system.clue ?? system.rumor);
  } else if (actionId === "salvage") {
    const system = systemAt(state.current);
    state.salvaged.push(state.current);
    state.day++;
    state.credits += system.resources * 9 + 8;
    state.fuel += 3;
    state.hull -= system.danger * 4;
    log(
      state,
      `Supplies from ${system.name}`,
      `Recovered ${system.resources * 9 + 8} credits and 3 fuel.${system.danger ? ` Debris damaged the hull by ${system.danger * 4}.` : ""} These supplies cannot be recovered again.`,
    );
    if (state.hull <= 0) recover(state, "A salvage operation goes wrong");
  } else if (actionId === "rescue") recover(state);
  else if (actionId === "refuel") {
    state.credits -= Math.ceil((maxFuel(state) - state.fuel) / 2);
    state.fuel = maxFuel(state);
  } else if (actionId === "repair") {
    state.credits -= Math.ceil((maxHull(state) - state.hull) / 3);
    state.hull = maxHull(state);
  } else if (actionId.startsWith("upgrade:")) {
    const upgrade = UPGRADES.find((entry) => entry.id === actionId.slice(8))!;
    state.credits -= upgrade.cost;
    state.data -= upgrade.dataCost;
    state.upgrades.push(upgrade.id);
    if (upgrade.id === "tank") state.fuel += 30;
    if (upgrade.id === "armor") state.hull += 40;
    log(state, `${upgrade.name} installed`, upgrade.description);
  } else if (actionId.startsWith("ship:")) {
    state.ship = actionId.slice(5);
    log(
      state,
      "A different hull, the same mission",
      `Your crew boards the ${state.ship === "gondi" ? "Chorus skimmer" : state.ship === "sholev" ? "Forge bulwark" : "original relay tender"}. Campaign supplies and installed modules transfer with you.`,
    );
  } else {
    switch (actionId) {
      case "harbor:briefing":
        addFlag(state, "briefed");
        state.data += 12;
        log(
          state,
          "The dispatch charter",
          "Earn resonant keys at Vellum, Kiln, and Ledger. Scan Palimpsest, Stillwater, and Echo to investigate what the caretaker calls repair. When you have the three keys, open a channel at Lattice. The last stable window closes on day 120.",
          "vellum",
        );
        break;
      case "choir:accept":
        addFlag(state, "quest:choir");
        log(
          state,
          "The missing verse",
          "Scan the ruined archive at Prism, then return to Vellum. Preserve the contradictory memories to earn the Choir’s alliance and resonant key.",
          "prism",
        );
        break;
      case "choir:return":
        addFlag(state, "key:choir");
        addFlag(state, "choir:free");
        ally(state, "choir");
        state.credits += 35;
        log(
          state,
          "The Choir keeps its own voice",
          "Serein accepts the complete verse. You receive a resonant key and an alliance. A Chorus skimmer is available at service ports. Your mission chart shows the outstanding key holders.",
          nextKeyPort(state),
        );
        break;
      case "choir:standardize":
        addFlag(state, "key:choir");
        addFlag(state, "choir:standardized");
        state.data -= 8;
        changeRelation(state, "choir", -2);
        log(
          state,
          "A perfect verse",
          "The reconstruction has no disagreements left. The Choir hands over its resonant key, but refuses an alliance. Its archived voices have lost their independent interpretation.",
          "vellum",
        );
        break;
      case "forge:accept":
        addFlag(state, "quest:forge");
        log(
          state,
          "The living furnace",
          "Clear the armed sentry at Crucible, then scan its reactor. Return to Kiln; bring 8 fuel if you want to share heat with the living core.",
          "crucible",
        );
        break;
      case "forge:share":
        addFlag(state, "key:forge");
        addFlag(state, "forge:shared");
        state.fuel -= 8;
        state.credits += 45;
        ally(state, "forge");
        log(
          state,
          "The core gets a vote",
          "You balance the reactor’s living cycles with the settlements’ needs. The Assembly grants its key, alliance, and a Forge bulwark hull at service ports.",
          nextKeyPort(state),
        );
        break;
      case "forge:extract":
        addFlag(state, "key:forge");
        addFlag(state, "forge:extracted");
        state.credits += 60;
        state.fuel += 8;
        changeRelation(state, "forge", -2);
        log(
          state,
          "Heat without a heartbeat",
          "The settlements receive immediate power. The living reactor dies. The Assembly honors its resonant key but will not offer an alliance.",
          "kiln",
        );
        break;
      case "exchange:accept":
        addFlag(state, "quest:exchange");
        log(
          state,
          "An open route",
          "Clear the reclamation drone at Convoy, scan the stranded route ledger, and return to Ledger. Cooperative routes will earn the Exchange key and alliance.",
          "convoy",
        );
        break;
      case "exchange:cooperate":
        addFlag(state, "key:exchange");
        addFlag(state, "exchange:cooperative");
        ally(state, "exchange");
        state.credits += 60;
        log(
          state,
          "The routes belong to their travelers",
          "A transparent cooperative replaces the failed supply monopoly. The Exchange grants its key and alliance. Scan Palimpsest, Stillwater, and Echo if you want a voluntary federation at Lattice.",
          "lattice",
        );
        break;
      case "exchange:monopoly":
        addFlag(state, "key:exchange");
        addFlag(state, "exchange:monopoly");
        state.credits -= 45;
        changeRelation(state, "exchange", 1);
        log(
          state,
          "Emergency concession",
          "You buy the Exchange key by granting exclusive control over supply routes. The contract keeps supplies moving but gives the settlements no vote. It can be bought back later at Ledger.",
          "ledger",
        );
        break;
      case "exchange:reform":
        removeFlag(state, "exchange:monopoly");
        addFlag(state, "exchange:cooperative");
        state.credits -= 35;
        state.data -= 8;
        ally(state, "exchange");
        log(
          state,
          "A contract rewritten",
          "The settlements buy their routes back with your help. The Exchange accepts cooperative ownership and joins your alliance.",
          "ledger",
        );
        break;
      case "migrant:accept":
        addFlag(state, "quest:migrant");
        log(
          state,
          "A schoolship in the dark",
          "Open a channel at Nursery. Bring 6 fuel to evacuate its passengers to Haven as themselves.",
          "nursery",
        );
        break;
      case "migrant:evacuate":
        addFlag(state, "nursery:resolved");
        addFlag(state, "migrant:rescued");
        state.fuel -= 6;
        state.credits += 35;
        state.data += 5;
        ally(state, "migrant");
        log(
          state,
          "Forty-three people, no replacements",
          "The schoolship reaches Haven. Its passengers choose a new berth and keep their own identities. The Wayfarer Table joins your alliance and opens skimmer hulls at service ports.",
          "haven",
        );
        break;
      case "migrant:strip":
        addFlag(state, "nursery:resolved");
        addFlag(state, "migrant:stripped");
        state.credits += 70;
        changeRelation(state, "migrant", -3);
        log(
          state,
          "Engines without passengers",
          "You leave with the schoolship’s engines. The caretaker copies the stranded passengers into its own record. The Wayfarers withdraw their trust.",
          "haven",
        );
        break;
      case "concord:accept":
        addFlag(state, "quest:concord");
        log(
          state,
          "Audit the miracle",
          "Scan the restoration archive at Breakwater, then bring its evidence to Bastion. Concord authorization opens a less costly central continuity ending.",
          "breakwater",
        );
        break;
      case "concord:verify":
        addFlag(state, "concord:reported");
        addFlag(state, "concord:support");
        ally(state, "concord");
        state.credits += 35;
        state.data += 8;
        log(
          state,
          "Continuity with open eyes",
          "Vale reads the erased objections and still chooses central continuity for the Concord. Their authorization can activate that protocol at Lattice. Their bulwark hulls are available at service ports.",
          "lattice",
        );
        break;
      case "concord:expose":
        addFlag(state, "concord:reported");
        addFlag(state, "concord:exposed");
        changeRelation(state, "concord", -2);
        state.data += 12;
        for (const faction of FACTIONS)
          if (faction.id !== "concord") changeRelation(state, faction.id, 1);
        log(
          state,
          "The erased objections are heard",
          "Every faction receives Breakwater’s original testimony. Concord authorization is withdrawn. Central continuity will require a 25-data override; voluntary federation remains possible through earned alliances.",
          "lattice",
        );
        break;
      case "finale:federation":
        state.ending = "federation";
        log(
          state,
          "The right to remain different",
          "The caretaker accepts a new instruction: every relay connection requires ongoing consent. Allied communities begin a federation of independent voices.",
          "lattice",
        );
        break;
      case "finale:coherence":
        if (!has(state, "concord:support")) state.data -= 25;
        state.ending = "coherence";
        log(
          state,
          "One clear signal",
          "The caretaker stabilizes the network under central continuity. The worlds survive as standardized copies, and disagreement becomes an error to correct.",
          "lattice",
        );
        break;
      case "finale:sever":
        state.ending = "sever";
        log(
          state,
          "The last relay",
          "Your keys sever the caretaker’s reach. Compulsory copying ends. The surviving worlds must find their own ways through a much larger darkness.",
          "lattice",
        );
        break;
    }
  }
  return finish(state);
}

export function combatResult(
  original: CampaignState,
  result: { won: boolean; hullFraction: number; escaped: boolean },
): CampaignState {
  if (
    !original.combat ||
    original.ending ||
    typeof result.won !== "boolean" ||
    typeof result.escaped !== "boolean" ||
    !Number.isFinite(result.hullFraction) ||
    result.hullFraction < 0 ||
    result.hullFraction > 1 ||
    (result.won && result.escaped)
  )
    return original;
  const state = clone(original);
  const encounter = state.combat!;
  state.combat = null;
  state.hull = Math.round(result.hullFraction * maxHull(state));
  const origin =
    state.flags.find((flag) => flag.startsWith("battle-origin:"))?.slice(14) ??
    "harbor";
  state.flags = state.flags.filter(
    (flag) => !flag.startsWith("battle-origin:"),
  );
  if (result.escaped) {
    state.current = origin;
    state.day++;
    state.hull = Math.max(8, state.hull);
    log(
      state,
      "Discretion leaves a route open",
      `You retreat from ${systemAt(encounter.system).name}. The guard remains, and there is no victory reward. Refuel and repair before another attempt.`,
    );
  } else if (result.won) {
    state.hull = Math.max(1, state.hull);
    if (!has(state, `cleared:${encounter.system}`)) {
      addFlag(state, `cleared:${encounter.system}`);
      state.credits += 20 + encounter.difficulty * 15;
      state.data += encounter.difficulty * 4;
      log(
        state,
        "The channel opens",
        `The ${systemAt(encounter.system).name} guard is disabled. You recover ${20 + encounter.difficulty * 15} credits and ${encounter.difficulty * 4} data. Scan the system to retrieve its mission evidence.`,
      );
    }
  } else recover(state, "Defeat is not the end of the expedition");
  return finish(state);
}

export function missionBrief(
  state: CampaignState,
): { title: string; text: string; target?: string }[] {
  if (state.ending)
    return [
      {
        title: "Your expedition is complete",
        text: "The journal records the decisions that shaped this ending. Begin a new expedition to choose another future.",
      },
    ];
  const missions: { title: string; text: string; target?: string }[] = [];
  if (!has(state, "briefed"))
    missions.push({
      title: "Take the dispatch charter",
      text: "Open a channel at Harbor for the briefing and 12 research data. Travel consumes fuel and time; scan and salvage for supplies.",
      target: "harbor",
    });
  if (!has(state, "key:choir"))
    missions.push({
      title: "The Choir resonant key",
      text: state.scanned.includes("prism")
        ? "Return to Vellum and give the Choir its complete verse. A full record earns an alliance."
        : has(state, "quest:choir")
          ? "Scan Prism for the missing verse, then return to Vellum."
          : "Open a channel at Vellum. The Choir remembers something the caretaker erased.",
      target:
        state.scanned.includes("prism") || !has(state, "quest:choir")
          ? "vellum"
          : "prism",
    });
  if (!has(state, "key:forge"))
    missions.push({
      title: "The Assembly resonant key",
      text: state.scanned.includes("crucible")
        ? "Return to Kiln with 8 fuel to share heat with the living reactor, or drain it for immediate supplies."
        : has(state, "quest:forge")
          ? "Defeat the Crucible sentry, scan the reactor, then return to Kiln with 8 fuel for an alliance."
          : "Open a channel at Kiln. Their furnaces and a living reactor need a settlement.",
      target:
        state.scanned.includes("crucible") || !has(state, "quest:forge")
          ? "kiln"
          : "crucible",
    });
  if (!has(state, "key:exchange"))
    missions.push({
      title: "The Exchange resonant key",
      text: state.scanned.includes("convoy")
        ? "Return to Ledger to open cooperative supply routes and earn the Exchange key and alliance."
        : has(state, "quest:exchange")
          ? "Defeat the drone at Convoy and scan its route ledger. Return to Ledger for a cooperative agreement."
          : "Open a channel at Ledger. Recover a supply ledger or buy an emergency concession for 45 credits.",
      target:
        state.scanned.includes("convoy") || !has(state, "quest:exchange")
          ? "ledger"
          : "convoy",
    });
  if (KEYS.some((key) => has(state, key))) {
    const discoveries = [
      { flag: "evidence:copy", target: "palimpsest" },
      { flag: "evidence:variance", target: "stillwater" },
      { flag: "evidence:consent", target: "echo" },
    ];
    const missing = discoveries.find(
      (discovery) => !has(state, discovery.flag),
    );
    if (missing)
      missions.push({
        title: "What does repair mean?",
        text: "For a voluntary federation, scan Palimpsest, Stillwater, and Echo. These three discoveries prove copying, stable difference, and the original right to refuse.",
        target: missing.target,
      });
    else if (!state.upgrades.includes("resonator"))
      missions.push({
        title: "Hold every voice",
        text: "Install a Consensus resonator at any service port. A federation also requires three faction alliances and all three keys.",
        target: "harbor",
      });
  }
  if (has(state, "quest:migrant") && !has(state, "nursery:resolved"))
    missions.push({
      title: "The stranded schoolship",
      text: "Open a channel at Nursery. Give 6 fuel to evacuate its passengers and earn the Wayfarers’ alliance.",
      target: "nursery",
    });
  if (has(state, "quest:concord") && !has(state, "concord:reported"))
    missions.push({
      title: "Audit the miracle",
      text: state.scanned.includes("breakwater")
        ? "Return to Bastion with the full archive and choose whether to accept central authorization or broadcast the erased objections."
        : "Scan Breakwater’s restored city, then return to Bastion.",
      target: state.scanned.includes("breakwater") ? "bastion" : "breakwater",
    });
  if (allKeys(state)) {
    missions.unshift({
      title: "Write a future at Lattice",
      text: "Open the caretaker channel at Lattice with all three keys. Federation needs three allies, three discoveries, and a resonator. Continuity needs Concord authorization or 25 data. Severance needs the Threshold guard cleared.",
      target: "lattice",
    });
    if (!has(state, "cleared:threshold"))
      missions.push({
        title: "An exit from the network",
        text: "If you want to end compulsory copying by isolating every system, defeat the relay guard at Threshold before deciding at Lattice.",
        target: "threshold",
      });
  }
  return missions;
}

export function endingText(
  state: CampaignState,
): { title: string; text: string } | null {
  if (!state.ending) return null;
  const partners = FACTIONS.filter((faction) =>
    has(state, `ally:${faction.id}`),
  )
    .map((faction) => faction.name)
    .join(", ");
  const aftermath = has(state, "migrant:rescued")
    ? "The Nursery families plant their garden at Haven, alive as themselves."
    : has(state, "migrant:stripped")
      ? "The schoolship’s passengers survive only in the caretaker’s record."
      : "The Nursery schoolship remains a name your crew wishes it had answered.";
  const reactor = has(state, "forge:shared")
    ? "The Crucible core keeps its own rhythm alongside the Assembly’s furnaces."
    : has(state, "forge:extracted")
      ? "Crucible’s extinguished heartbeat pays for one last warm winter."
      : "";
  const endings: Record<string, { title: string; text: string }> = {
    federation: {
      title: "Many voices, one open sky",
      text: `You teach the caretaker to ask, to listen, and to accept no. The relays carry independent worlds instead of correcting them into copies. ${partners} sign a covenant that anyone can leave. Stability takes negotiation now. It also belongs to the people who live inside it. ${aftermath} ${reactor} Your tender becomes the first ship of a federation that can disagree and still answer a distress call.`,
    },
    coherence: {
      title: "A single, perfect signal",
      text: `Every relay lights at once. Supply lines return, calendars align, and the caretaker holds every civilization in one coherent record. Streets that vanished are rebuilt precisely. Objections disappear with the unstable originals that made them. ${aftermath} ${reactor} Your crew has saved the network. Somewhere in its perfect broadcast, you can still hear the shape of a voice that used to hesitate.`,
    },
    sever: {
      title: "The right to a dark horizon",
      text: `The relay network goes silent by your choice. The caretaker can no longer replace anyone. Every world keeps its differences, its debts, and the work of surviving without instant passage. ${partners || "The scattered settlements"} begin building slower routes through ordinary space. ${aftermath} ${reactor} Wake leaves Lattice under its own engine, carrying letters to people who will have to wait for an answer.`,
    },
    collapse: {
      title: "The future nobody chose",
      text: `On day 120 the last relay closes its uncommitted state. The caretaker restores continuity by copying every reachable settlement into a standardized record. Your crew keeps the journal, including every community you helped and every question you found. ${aftermath} Another expedition could bring the keys before the window closes.`,
    },
  };
  return endings[state.ending] ?? null;
}

function validState(value: unknown): value is CampaignState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  const integer = (item: unknown, min: number, max: number): item is number =>
    typeof item === "number" &&
    Number.isSafeInteger(item) &&
    item >= min &&
    item <= max;
  const stringArray = (
    item: unknown,
    allowed: Set<string>,
    limit: number,
  ): item is string[] =>
    Array.isArray(item) &&
    item.length <= limit &&
    item.every((entry) => typeof entry === "string" && allowed.has(entry)) &&
    new Set(item).size === item.length;
  const systemIds = new Set(SYSTEMS.map((system) => system.id));
  if (
    state.version !== 1 ||
    typeof state.current !== "string" ||
    !systemIds.has(state.current) ||
    typeof state.ship !== "string" ||
    !SHIPS.includes(state.ship)
  )
    return false;
  if (
    !integer(state.day, 1, 128) ||
    !integer(state.fuel, 0, 66) ||
    !integer(state.hull, 0, 140) ||
    !integer(state.credits, 0, 100000) ||
    !integer(state.data, 0, 100000)
  )
    return false;
  if (
    !stringArray(
      state.upgrades,
      new Set(UPGRADES.map((upgrade) => upgrade.id)),
      UPGRADES.length,
    ) ||
    !stringArray(state.visited, systemIds, SYSTEMS.length) ||
    !stringArray(state.scanned, systemIds, SYSTEMS.length) ||
    !stringArray(state.salvaged, systemIds, SYSTEMS.length) ||
    !stringArray(state.flags, UNIQUE_FLAGS, UNIQUE_FLAGS.size)
  )
    return false;
  const visited = state.visited;
  if (
    !visited.includes(state.current) ||
    state.scanned.some((id) => !visited.includes(id)) ||
    state.salvaged.some((id) => !visited.includes(id))
  )
    return false;
  if (
    state.fuel > 36 + (state.upgrades.includes("tank") ? 30 : 0) ||
    state.hull > 100 + (state.upgrades.includes("armor") ? 40 : 0)
  )
    return false;
  if (
    !state.relations ||
    typeof state.relations !== "object" ||
    Array.isArray(state.relations)
  )
    return false;
  const relations = state.relations as Record<string, unknown>;
  if (
    Object.keys(relations).length !== FACTIONS.length ||
    !FACTIONS.every((faction) => integer(relations[faction.id], -5, 5))
  )
    return false;
  if (
    state.ending !== null &&
    (typeof state.ending !== "string" || !ENDINGS.includes(state.ending))
  )
    return false;
  if (state.day >= 120 && state.ending !== "collapse") return false;
  if (state.day < 120 && state.ending === "collapse") return false;
  if (
    !Array.isArray(state.journal) ||
    state.journal.length > 160 ||
    state.journal.length === 0
  )
    return false;
  if (
    !state.journal.every(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof entry.title === "string" &&
        entry.title.length <= 180 &&
        typeof entry.text === "string" &&
        entry.text.length <= 4000 &&
        integer(entry.day, 1, state.day as number) &&
        (entry.system === undefined || systemIds.has(entry.system)),
    )
  )
    return false;
  const open = state.flags.filter((flag) => flag.startsWith("dialogue:"));
  const origin = state.flags.filter((flag) =>
    flag.startsWith("battle-origin:"),
  );
  if (
    open.length > 1 ||
    (open.length === 1 && open[0] !== `dialogue:${state.current}`)
  )
    return false;
  if (state.combat !== null) {
    if (
      !state.combat ||
      typeof state.combat !== "object" ||
      state.ending ||
      open.length ||
      origin.length !== 1
    )
      return false;
    const battle = state.combat as Record<string, unknown>;
    if (
      battle.system !== state.current ||
      systemAt(state.current).kind !== "hostile" ||
      state.flags.includes(`cleared:${state.current}`) ||
      typeof battle.enemyShip !== "string" ||
      !SHIPS.includes(battle.enemyShip) ||
      !integer(battle.difficulty, 1, 3) ||
      typeof battle.reason !== "string" ||
      battle.reason.length > 4000
    )
      return false;
  } else if (origin.length) return false;
  if (state.ending && open.length) return false;
  const checked = value as CampaignState;
  const evidenceSources: Record<string, string> = {
    "evidence:copy": "palimpsest",
    "evidence:variance": "stillwater",
    "evidence:consent": "echo",
  };
  if (
    Object.entries(evidenceSources).some(
      ([flag, source]) =>
        has(checked, flag) !== checked.scanned.includes(source),
    )
  )
    return false;
  if (checked.ending && checked.ending !== "collapse" && !allKeys(checked))
    return false;
  if (
    checked.ending === "federation" &&
    (!EVIDENCE.every((flag) => has(checked, flag)) ||
      allies(checked) < 3 ||
      !checked.upgrades.includes("resonator"))
  )
    return false;
  if (checked.ending === "sever" && !has(checked, "cleared:threshold"))
    return false;
  return true;
}

export function saveCampaign(state: CampaignState, storage?: Storage): boolean {
  try {
    if (!validState(state)) return false;
    const target = storage ?? globalThis.localStorage;
    target.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadCampaign(storage?: Storage): CampaignState | null {
  try {
    const target = storage ?? globalThis.localStorage;
    const raw = target.getItem(SAVE_KEY);
    if (!raw || raw.length > 300000) return null;
    const parsed: unknown = JSON.parse(raw);
    return validState(parsed) ? clone(parsed) : null;
  } catch {
    return null;
  }
}
