# Signalwake — first playable expedition

Signalwake extends CosmoClash with an authored single-player adventure. It is a complete small campaign with a beginning and multiple conclusions, and a foundation for a larger game. The original melee gauntlet remains available through `?mode=melee`.

## The question at the center

The Echo Reach’s relays are collapsing. A caretaker promises continuity by replacing messy living civilizations with coherent copies. Is an accurate archive a surviving society? Can consent remain meaningful during an emergency? Is safety without a right to leave rescue or captivity?

Five communities answer differently: the Mnemonic Choir preserves disagreement; the Ember Forge measures promises by practical survival; the Cobalt Exchange demands informed contracts; the Unmoored insist rescued people choose their destination; the Horizon Concord wrestles with the limits of emergency authority. These beliefs shape quests and the final choices.

## Playing

- Select a star on the chart, inspect its fuel/time costs, and jump. Star nodes support keyboard Enter/Space as well as pointer input.
- Open channels to receive missions and choose diplomatic responses. Captain’s Next Lead and Ship Log point to actionable destinations.
- Scan systems for evidence, salvage finite supplies, and refuel/repair at service ports. Install ship modules in Shipyard while docked at a service port.
- In combat: W or Up thrust; A/D or Left/Right turn; Space fire; Shift special; Escape retreat; M mute. Touch flight controls appear on touch devices. Leaving the window pauses combat.
- Time advances when you act, never while you read. The final relay window closes on day 120; there are advance warnings. Losing a fight or exhausting supplies does not erase story progress: Harbor can recover your ship at a cost.
- Earn three resonant keys, investigate the caretaker, and return to Lattice. There are three gated resolutions plus the consequence of missing the final window.
- Progress stays in this browser under `signalwake.campaign.v1`. Ship Log exports and imports validated JSON saves. A new expedition replaces the active local voyage; export first to keep it.

## Scope and next expansion

This first version includes 24 systems, five factions, six modules, three usable combat hulls, authored branching missions, consequential diplomatic choices, ship progression, real-time AI encounters, recovery, three endings, and local saves. It is single-player. It does not yet include online co-op, generated galaxy sectors, surface lander gameplay, voiced conversations, or an account-backed save service. Those can extend this campaign without replacing its engine.

Useful next improvements after playtesting are more ship-specific encounters and mission chains, traveling faction fleets, and persistent changes to inhabited worlds. Balance and subjective fun need human playtesting beyond automated route completion.

## How it relates to Star Control II

Research covered the full adventure, not only Super Melee: exploration, resource decisions, diplomacy, clue-driven quests, allied technologies, a changing strategic situation, and combat as one part of the expedition. Signalwake uses that interconnected design while creating its own setting, prose, characters, portraits, and philosophical conflict. It does not copy Star Control characters, dialogue, music, or art. Combat assets and mechanics come from CosmoClash with its existing credits retained.

References:

- [Star Control II overview](https://en.wikipedia.org/wiki/Star_Control_II)
- [The Ur-Quan Masters project](https://sc2.sourceforge.net/)
- [The Ur-Quan Masters manual](https://raw.githubusercontent.com/juj/sc2-uqm/master/sc2/doc/users/manual.txt)
- [Gameplay FAQ](https://wiki.uqm.stack.nl/Star_Control_II_Gameplay_FAQ)

## Architecture and validation

`src/app.ts` selects campaign or classic melee. `src/campaign/world.ts` contains authored systems, cultures, and modules. `engine.ts` is a pure action/state engine; the browser UI in `entry.ts` renders chart, dialogues, shipyard, contacts, and journal. `combat.ts` bridges to the existing Three.js simulation lazily, so chart exploration does not load the 3D engine until needed. `main.ts` carries hull/upgrades into one campaign encounter and returns its outcome without entering the classic fleet flow.

Campaign tests complete all three routes from a new expedition using actual available actions, verify branches and no repeat rewards, and cover stranded-ship recovery, the deadline, invalid saves, and blocked browser storage. Integration tests cover visible UI actions and the combat lifecycle, input, retained hull, win/loss/retreat, pause, repeated launch, delayed asset loads, and cleanup. Existing melee tests remain in the suite.

Run `npm ci`, then `npm run dev`. Build with `npm run build`; run the suite with `npm test -- --maxWorkers=2`. Deploy the resulting `dist` folder on a static host. No backend or environment secrets are required.
