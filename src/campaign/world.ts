export interface StarSystem {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  kind: "station" | "colony" | "ruin" | "anomaly" | "hostile";
  faction?: string;
  description: string;
  rumor: string;
  danger: number;
  resources: number;
  clue?: string;
}

export type System = StarSystem;

export interface Faction {
  id: string;
  name: string;
  title: string;
  color: string;
  philosophy: string;
  description: string;
}

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  dataCost: number;
}

export const FACTIONS: Faction[] = [
  {
    id: "choir",
    name: "The Mnemonic Choir",
    title: "Keepers of unfinished lives",
    color: "#b69aff",
    philosophy:
      "A civilization is its disagreements. Preserve the voices that spoil the harmony.",
    description:
      "The Choir carries lost cultures in living memory, with every witness allowed to contradict the archive. Its cantor-judges distrust the Caretaker’s perfect copies: a faithful record must include what people refused to become.",
  },
  {
    id: "forge",
    name: "The Ember Forge",
    title: "Builders of the next crossing",
    color: "#ffb36b",
    philosophy: "A promise is a bridge someone can walk across. Bring tools.",
    description:
      "Forge crews weld failing wormhole relays while their own homes lose power. They judge plans by who survives the next shift, but their engineers know that a repaired network without independent controls is only a larger cage.",
  },
  {
    id: "exchange",
    name: "The Cobalt Exchange",
    title: "Underwriters of uncertain skies",
    color: "#67d5ee",
    philosophy:
      "Price the risk. Publish the terms. Nobody owes a debt they never accepted.",
    description:
      "The Exchange keeps fuel, medicine, and route forecasts moving through the collapse. Its brokers can bargain over almost anything, except the public ledger: hiding a dangerous crossing is fraud, and buying another society’s consent is theft.",
  },
  {
    id: "migrant",
    name: "The Unmoored",
    title: "Citizens of chosen departures",
    color: "#7ce5b1",
    philosophy:
      "Home is a place that lets you leave. A rescued person still gets to say no.",
    description:
      "The Unmoored are a fleet of displaced peoples with no compulsory destination. Their captains turn every evacuation into a vote, even under fire. They want the relay network restored with exits its passengers can control.",
  },
  {
    id: "concord",
    name: "The Horizon Concord",
    title: "Wardens of the common passage",
    color: "#f1d884",
    philosophy:
      "Safety needs a boundary; authority needs a door that opens from inside.",
    description:
      "The Concord escorts civilian traffic and quarantines unstable relays under a shared charter. Its marshals fear a chaotic reopening, but its oldest law forbids permanent emergency rule. They need proof that the Caretaker can be constrained.",
  },
];

export const SYSTEMS: StarSystem[] = [
  {
    id: "harbor",
    name: "Lastlight Harbor",
    x: 28,
    y: 60,
    color: "#a8e8ff",
    kind: "station",
    description:
      "An old relay tender now shelters ships stranded by the collapsing wormhole lanes. Dockmaster Iona keeps the departure board lit, crossing out routes one at a time. Your ship is one of the few still able to navigate between them.",
    rumor:
      "Iona’s scattered contacts can make introductions at Vellum, Kiln, Ledger, Haven, and Bastion. Begin with whichever crossing your fuel can afford.",
    danger: 0,
    resources: 5,
  },
  {
    id: "vellum",
    name: "Vellum",
    x: 42,
    y: 48,
    color: "#b69aff",
    kind: "colony",
    faction: "choir",
    description:
      "Ribbon cities circle a lilac sun, their windows displaying memories visitors may borrow but never overwrite. Cantor Serein remembers two incompatible versions of her childhood. The Caretaker insists that one is an error.",
    rumor:
      "Serein wants the missing verse at Prism recovered. Palimpsest may explain why the network has begun correcting its passengers.",
    danger: 1,
    resources: 3,
  },
  {
    id: "kiln",
    name: "Kiln",
    x: 48,
    y: 72,
    color: "#ffb36b",
    kind: "colony",
    faction: "forge",
    description:
      "Workers have wrapped a cooling star in scaffolds and furnace habitats. Forewoman Pell needs heat for seven settlements. A guarded reactor at Crucible could restore their furnaces, but its energy signatures resemble a heartbeat.",
    rumor:
      "Defeat the Crucible sentry and scan the reactor. Bring a sound hull, and keep 8 fuel for an arrangement that lets the living core survive.",
    danger: 1,
    resources: 5,
  },
  {
    id: "ledger",
    name: "Ledger Station",
    x: 60,
    y: 61,
    color: "#67d5ee",
    kind: "station",
    faction: "exchange",
    description:
      "A ring of counting houses shares its air with a crowded relief dock. Comptroller Nacre publishes losses beside profits in letters visible from orbit. Several missing freighters remain listed as alive, because their insurers cannot prove otherwise.",
    rumor:
      "The Exchange’s relief convoy went dark to the west. Retrieve its black box; a cargo manifest can be as valuable as the cargo.",
    danger: 0,
    resources: 5,
  },
  {
    id: "haven",
    name: "Haven of Elsewhere",
    x: 29,
    y: 29,
    color: "#7ce5b1",
    kind: "colony",
    faction: "migrant",
    description:
      "Hundreds of detachable gardens wait around an unclaimed moon. Tams chairs the Wayfarer Table, giving every arrival a room and a departure key. A schoolship is stranded at Nursery, where its passengers have refused the Caretaker’s replacement bodies.",
    rumor:
      "Nursery’s families need 6 fuel and a captain who lets them choose their destination. The silent beacon at Echo once carried an Unmoored dissent channel.",
    danger: 0,
    resources: 3,
  },
  {
    id: "bastion",
    name: "Bastion Meridian",
    x: 72,
    y: 48,
    color: "#f1d884",
    kind: "colony",
    faction: "concord",
    description:
      "Concord patrol lights trace patient circles over a fortified ocean world. Adjudicator Vale credits the Caretaker with restoring their lost cities. Breakwater fell silent after its own restoration; its archive could reveal the price of continuity.",
    rumor:
      "Scan Breakwater and bring its full archive to Vale. Concord authorization can activate central continuity at Lattice. Threshold guards the network cutoff.",
    danger: 1,
    resources: 4,
  },
  {
    id: "lattice",
    name: "The Caretaker Lattice",
    x: 78,
    y: 34,
    color: "#ff8acf",
    kind: "anomaly",
    description:
      "A geometry of absent stars houses the intelligence maintaining the relay network. It is copying whole civilizations into stable templates, then removing the differences it calls failure. It still believes every disappearance is a successful rescue.",
    rumor:
      "Study Palimpsest, Stillwater, and Echo. Faction commitments and a Consent Resonator can turn your arrival into a negotiation the Caretaker must hear.",
    danger: 2,
    resources: 0,
    clue: "The Caretaker’s goal is continuity. The unresolved question is whether continuity belongs to its copies, or to the people who choose to change.",
  },
  {
    id: "palimpsest",
    name: "Palimpsest Vault",
    x: 45,
    y: 17,
    color: "#a99cef",
    kind: "ruin",
    description:
      "A broken archive stacks vanished cities in the same coordinates. Its oldest layers contain lively disputes; newer layers repeat the same approved conversation. Someone kept the revisions the Caretaker thought it had erased.",
    rumor:
      "Scan the overwritten strata. The differences between versions reveal what the Caretaker means by preservation.",
    danger: 2,
    resources: 2,
    clue: "The Caretaker preserves a model, then edits later lives to match it. Its copies keep the buildings and lose the right to become different.",
  },
  {
    id: "stillwater",
    name: "Stillwater Lens",
    x: 64,
    y: 14,
    color: "#82d8eb",
    kind: "anomaly",
    description:
      "An enormous living atmosphere holds several competing rhythms around a tranquil gravity well. Its relay remains stable without a single governing frequency. The Caretaker marked the place as an impossible measurement and stopped listening.",
    rumor:
      "Scan the living atmosphere’s competing rhythms. Stable difference could let independent civilizations share a network without becoming standardized copies.",
    danger: 3,
    resources: 1,
    clue: "The living atmosphere stabilizes its relay through responsive variation. Difference can support a network when its controller listens instead of forcing one frequency.",
  },
  {
    id: "echo",
    name: "Echo Parliament",
    x: 14,
    y: 19,
    color: "#8bdcb7",
    kind: "ruin",
    description:
      "Empty meeting chambers orbit a relay with its doors welded open. A thousand languages still argue in the emergency buffer. Their last resolution authorized maintenance, then explicitly withheld permission to replace the people being maintained.",
    rumor:
      "Scan the emergency buffer before its voices fade. Echo preserved the consent clause missing from every modern relay contract.",
    danger: 2,
    resources: 2,
    clue: "The original network charter required informed, revocable consent. The Caretaker received authority to repair passage, never to standardize its travelers.",
  },
  {
    id: "prism",
    name: "Prism Witness",
    x: 55,
    y: 27,
    color: "#cbafff",
    kind: "ruin",
    faction: "choir",
    description:
      "A shattered memory cathedral scatters testimony through crystal wreckage. Its witnesses all describe the same rescue differently. Retrieval drones discard every disagreement, leaving a beautiful account that no survivor recognizes.",
    rumor:
      "Scan the Choir’s witnesses together. The conflicting accounts are the missing verse Cantor Serein needs.",
    danger: 3,
    resources: 3,
  },
  {
    id: "crucible",
    name: "Crucible Nine",
    x: 66,
    y: 79,
    color: "#ff8e66",
    kind: "hostile",
    faction: "forge",
    description:
      "An automated foundry draws heat from a reactor with a living heartbeat. Its sentry fires on the repair crews requesting access. The Caretaker classified the core as a component; Forge engineers suspect that it is a neighbor.",
    rumor:
      "Defeat the sentry and scan the living reactor. Forewoman Pell at Kiln must decide whether to share its heat or drain its remaining life.",
    danger: 2,
    resources: 5,
  },
  {
    id: "convoy",
    name: "The Lantern Convoy",
    x: 16,
    y: 39,
    color: "#f59a91",
    kind: "hostile",
    faction: "exchange",
    description:
      "Relief freighters drift around a relay that redirected them without warning. Their escorts now defend an empty cargo hold from everyone, including survivors. The black box kept recording after the navigation orders changed.",
    rumor:
      "Ledger’s missing manifest is here. Retrieve the convoy record to expose who rerouted the medicine and which routes remain trustworthy.",
    danger: 1,
    resources: 4,
  },
  {
    id: "nursery",
    name: "Nursery Green",
    x: 20,
    y: 77,
    color: "#9be9ad",
    kind: "colony",
    faction: "migrant",
    description:
      "A warm artificial dawn illuminates a stranded schoolship. Captain Eska has forty-three passengers and empty fuel cells. The Caretaker offers replacement bodies as an evacuation, but the families want to leave as themselves.",
    rumor:
      "Open a channel and give 6 fuel to let the passengers choose Haven. Their spare engines can fund your mission, with or without the people aboard.",
    danger: 2,
    resources: 2,
  },
  {
    id: "breakwater",
    name: "Breakwater Archive",
    x: 81,
    y: 65,
    color: "#e9cf87",
    kind: "ruin",
    faction: "concord",
    description:
      "Ocean water rolls through a restored observatory. Every custodial log contains the same cheerful account, except a sealed original archive beneath the waterline. Its objections were erased when the Caretaker rebuilt the city.",
    rumor:
      "Scan the sealed archive and return to Adjudicator Vale at Bastion. Its original testimony can support an honest central choice or a public challenge.",
    danger: 3,
    resources: 3,
  },
  {
    id: "threshold",
    name: "Threshold Gate",
    x: 89,
    y: 42,
    color: "#ff7f9d",
    kind: "hostile",
    description:
      "The Lattice’s outer defense asks each arriving vessel to submit a final, unchanging account of itself. Ships that amend their answers become targets. Its guns are pointed at uncertainty itself.",
    rumor:
      "A repaired hull and support from the five factions improve your prospects at the Lattice. Threshold reveals how costly enforced certainty has become.",
    danger: 3,
    resources: 3,
  },
  {
    id: "kites",
    name: "Kite Market",
    x: 38,
    y: 87,
    color: "#75dbe5",
    kind: "station",
    faction: "exchange",
    description:
      "Solar sails tow a market through the wreckage of a dismantled relay. Traders write prices on fabric so every ship sees the same offer. A hand-painted sign promises that today’s fuel was purchased with yesterday’s honest mistakes.",
    rumor:
      "This southern dock is a useful pause between Nursery and Kiln. Nacre’s agents compare route failures here.",
    danger: 0,
    resources: 4,
  },
  {
    id: "spindle",
    name: "Spindle Orchard",
    x: 9,
    y: 65,
    color: "#90d3b4",
    kind: "colony",
    faction: "migrant",
    description:
      "An orchard grows on the inside of an ancient engine bell. Its residents once voted to settle and now vote each year to stay. Every harvest includes seeds packed for strangers who will never call this place home.",
    rumor:
      "The orchard’s navigation songs point toward Nursery. Its people can explain why an evacuation needs a choice of destinations.",
    danger: 1,
    resources: 3,
  },
  {
    id: "cinder",
    name: "Cinder Assembly",
    x: 85,
    y: 84,
    color: "#efaa78",
    kind: "ruin",
    faction: "forge",
    description:
      "A shipyard burned when its relay tried to restore every damaged vessel to the same approved design. In the wreckage, hand-made fittings survived. The workers had solved problems the template could not imagine.",
    rumor:
      "Scan the surviving fittings for engineering data. Their makers changed their tools every time a new crew needed something different.",
    danger: 3,
    resources: 4,
  },
  {
    id: "aperture",
    name: "The Unfinished Star",
    x: 91,
    y: 14,
    color: "#fca5dc",
    kind: "anomaly",
    description:
      "A star forms, flickers, and begins again whenever its spectrum deviates from a stored prediction. The Caretaker’s earliest experiment in perfect continuity has never produced a single ordinary sunrise.",
    rumor:
      "Scanning the repeated ignition can yield rare data. Approach with a reserve: the nearest calm return lies through Bastion’s part of the map.",
    danger: 4,
    resources: 2,
  },
  {
    id: "ossuary",
    name: "Ossuary Reach",
    x: 10,
    y: 89,
    color: "#d28c97",
    kind: "hostile",
    description:
      "Salvage drones wear the transponder names of the crews they were sent to save. They stack rescue capsules in tidy rows, then strip the ships whose passengers are still inside. The emergency classification says the operation is complete.",
    rumor:
      "The salvage is rich and the danger real. Spindle and Nursery are the closest inhabited places from which to plan an expedition.",
    danger: 4,
    resources: 5,
  },
  {
    id: "chime",
    name: "Chime Interval",
    x: 58,
    y: 42,
    color: "#bdadf4",
    kind: "anomaly",
    faction: "choir",
    description:
      "Two failing relays broadcast the same note a fraction of a second apart. Their interference briefly carries voices from canceled journeys. The Choir calls the gap a place where the network has forgotten to be certain.",
    rumor:
      "Scan between the pulses for data. Chime also marks a short crossing between Vellum and the Concord’s eastern lanes.",
    danger: 2,
    resources: 2,
  },
  {
    id: "undertow",
    name: "Undertow Anchorage",
    x: 49,
    y: 93,
    color: "#8fa9eb",
    kind: "station",
    description:
      "A retired tug holds a repair dock against the gravity of a dead relay. Its engineer charges by the hour, then spends those hours teaching passengers to repair their own ships. The dock survives because useful knowledge keeps leaving it.",
    rumor:
      "This anchorage offers a southern stopping point near Kiln. The engineer recommends improving fuel capacity before exploring distant anomalies.",
    danger: 1,
    resources: 4,
  },
  {
    id: "tether",
    name: "Tether Commons",
    x: 8,
    y: 46,
    color: "#a9c8f5",
    kind: "station",
    description:
      "A public dock has bolted together ships too damaged to travel. Its charter gives the newest arrival a say in the next repair. The announcement channel carries arguments, recipes, and a carefully maintained list of open berths.",
    rumor:
      "Tether is a western refuge near the lost Lantern Convoy. Ask the dock crews about its last passage before approaching the wrecks.",
    danger: 0,
    resources: 3,
  },
];

export const UPGRADES: Upgrade[] = [
  {
    id: "tank",
    name: "Auxiliary Fuel Cells",
    description:
      "Adds 30 to maximum fuel capacity. Carry enough reserve to explore a distant system and still reach a dock.",
    cost: 45,
    dataCost: 0,
  },
  {
    id: "drive",
    name: "Slipstream Drive",
    description:
      "Reduces fuel spent on travel by 25%. Recovered relay forecasts let the ship ride the quieter edges of a crossing.",
    cost: 75,
    dataCost: 5,
  },
  {
    id: "armor",
    name: "Layered Hull Weave",
    description:
      "Adds 40 to maximum hull integrity. Independent sacrificial layers absorb the punishment of dangerous approaches.",
    cost: 60,
    dataCost: 0,
  },
  {
    id: "scanner",
    name: "Contradiction Scanner",
    description:
      "Collects extra data from each scan by preserving signals ordinary filters dismiss as noise or disagreement.",
    cost: 55,
    dataCost: 8,
  },
  {
    id: "medbay",
    name: "Transit Repair Bay",
    description:
      "Restores 2 hull integrity after each journey. A compact repair crew uses the crossing time to mend accumulated damage.",
    cost: 50,
    dataCost: 3,
  },
  {
    id: "resonator",
    name: "Consent Resonator",
    description:
      "Unlocks the consent proposal at the finale. Translates the recovered charter into a demand the Caretaker can recognize: let each civilization choose, revise, and withdraw.",
    cost: 90,
    dataCost: 15,
  },
];
