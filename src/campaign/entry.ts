import { SYSTEMS, FACTIONS, UPGRADES } from "./world";
import {
  createCampaign,
  act,
  campaignActions,
  travelCost,
  dialogue,
  missionBrief,
  endingText,
  combatResult,
  saveCampaign,
  loadCampaign,
  maxFuel,
  maxHull,
} from "./engine";
import type { CampaignState } from "./engine";
import { launchCombat } from "./combat";
import { icon, portrait } from "./icons";
import { CampaignAudio } from "./audio";
import "./signalwake.css";

const escape = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const app = document.createElement("div");
app.id = "signalwake-app";
document.body.append(app);
document.body.classList.add("campaign-mode");
const audio = new CampaignAudio();
const saved = loadCampaign();
let state: CampaignState = saved ?? createCampaign();
let selected = state.current;
let view: "map" | "ship" | "contacts" | "log" = "map";
let overlay: "welcome" | "help" | "restart" | null = "welcome";
let busy = false,
  combatActive = false,
  toastTimer: ReturnType<typeof setTimeout> | undefined;
let selectedFaction = FACTIONS[0]?.id;
let storageOK = true;

function notify(text: string, error = false): void {
  const toast = document.querySelector<HTMLElement>("#toast");
  if (!toast) return;
  toast.textContent = text;
  toast.className = `toast visible ${error ? "error" : ""}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 4000);
}
function store(): void {
  storageOK = saveCampaign(state);
}
function storageNotice(): void {
  if (!storageOK)
    notify(
      "Browser storage is unavailable. Export your voyage from Ship Log.",
      true,
    );
}
function perform(id: string): void {
  if (busy || combatActive) return;
  const old = state;
  state = act(state, id);
  if (state === old) {
    notify("That action is not available right now.", true);
    return;
  }
  if (state.current !== old.current) selected = state.current;
  audio.ping();
  store();
  render();
  storageNotice();
  if (id.startsWith("travel:")) {
    app.classList.add("jump-arrival");
    setTimeout(() => app.classList.remove("jump-arrival"), 850);
  }
}
function meter(
  name: string,
  value: number,
  max: number,
  color: string,
): string {
  return `<div class="resource"><span class="resource-icon" style="color:${color}">${icon(name)}</span><div><span class="eyebrow">${name === "hull" ? "HULL INTEGRITY" : name === "fuel" ? "JUMP FUEL" : name.toUpperCase()}</span><div class="resource-value">${Math.round(value)}${max ? `<span> / ${max}</span>` : ""}</div>${max ? `<div class="meter"><i style="width:${Math.min(100, (value / max) * 100)}%;background:${color}"></i></div>` : ""}</div></div>`;
}
function render(): void {
  const current = SYSTEMS.find((s) => s.id === state.current)!;
  const end = endingText(state);
  app.innerHTML = `
 <header class="topbar"><a class="brand" href="/" aria-label="Signalwake home"><span class="brand-symbol">${icon("map")}</span><span>signalwake<small>A COSMOCLASH EXPEDITION</small></span></a><div class="ship-ident"><span class="live-dot"></span><div>VESSEL <b>SW–07</b><small>Civilian relay tender</small></div></div><div class="resources">${meter("fuel", state.fuel, maxFuel(state), "#64dbd0")}${meter("hull", state.hull, maxHull(state), "#f1c47c")}${meter("credits", state.credits, 0, "#d0d9e8")}${meter("data", state.data, 0, "#ac96ed")}</div><div class="top-tools"><button data-cmd="audio" class="icon-button ${audio.enabled ? "active" : ""}" title="${audio.enabled ? "Mute ambient audio" : "Enable ambient audio"}" aria-label="${audio.enabled ? "Mute ambient audio" : "Enable ambient audio"}">${icon("sound")}</button><button data-cmd="help" class="icon-button" title="How to play" aria-label="How to play">${icon("help")}</button></div></header>
 <div class="game-shell"><nav class="nav-rail" aria-label="Ship navigation">${(["map", "ship", "contacts", "log"] as const).map((v) => `<button data-view="${v}" class="nav-item ${view === v ? "active" : ""}" aria-current="${view === v ? "page" : "false"}">${icon(v === "map" ? "map" : v === "ship" ? "ship" : v === "log" ? "log" : "contacts")}<span>${v === "map" ? "STAR MAP" : v === "ship" ? "SHIPYARD" : v === "log" ? "SHIP LOG" : "CONTACTS"}</span></button>`).join("")}<div class="nav-bottom"><span>REACH</span><b>07</b><small>FRONTIER SECTOR</small></div></nav>
 <main class="workspace"><div class="workspace-heading"><div><span class="eyebrow">${view === "map" ? "NAVIGATION / ECHO REACH" : view === "ship" ? "VESSEL / SW–07" : view === "contacts" ? "DIPLOMACY / OPEN CHANNELS" : "ARCHIVE / EXPEDITION RECORD"}</span><h1>${view === "map" ? "Every signal is a story." : view === "ship" ? "Built for the unknown." : view === "contacts" ? "No one survives alone." : "Remember what matters."}</h1></div><div class="day-counter">${icon("time")}<div><b>DAY ${state.day}</b><span>${state.day >= 100 ? "THE NETWORK IS FAILING" : state.day >= 65 ? "RELAY STABILITY FALLING" : "THE CLOCK ADVANCES WHEN YOU ACT"}</span></div></div></div>
 ${view === "map" ? renderMap() : view === "ship" ? renderShip() : view === "contacts" ? renderContacts() : renderLog()}
 </main><aside class="system-panel">${renderSystem()}</aside></div>
 <footer class="statusbar"><span class="status-loc"><i class="live-dot"></i> ORBITING <b>${escape(current.name)}</b></span><span>${state.visited.length} / ${SYSTEMS.length} SYSTEMS VISITED</span><span class="save-status">${icon("save")} ${storageOK ? "AUTO-SAVED ON THIS BROWSER" : "SAVE UNAVAILABLE · EXPORT FROM SHIP LOG"}</span></footer>
 <div id="toast" class="toast" role="status" aria-live="polite"></div>
 ${state.combat && !combatActive && !overlay && !end ? renderEncounter() : ""}
 ${!state.combat && dialogue(state) && !overlay && !end ? renderDialogue() : ""}
 ${overlay === "restart" ? renderOverlay() : end ? renderEnding(end) : overlay ? renderOverlay() : ""}`;
  bind();
}
function renderMap(): string {
  const origin = SYSTEMS.find((s) => s.id === state.current)!;
  const target = SYSTEMS.find((s) => s.id === selected)!;
  const costs = travelCost(state, selected);
  const missions = missionBrief(state);
  // Fixed seed stars stay still across actions, keeping the sector recognizable.
  let stars = "";
  for (let i = 0; i < 190; i++) {
    const x = (i * 37.17 + Math.sin(i) * 31) % 100,
      y = (i * 23.71 + Math.cos(i) * 21) % 100;
    stars += `<circle cx="${Math.abs(x)}" cy="${Math.abs(y)}" r="${i % 5 === 0 ? 0.1 : 0.055}" fill="${i % 3 ? "#b7d0e8" : "#65a8d3"}" opacity="${0.18 + (i % 7) * 0.08}"/>`;
  }
  const lines = SYSTEMS.map((s, i) => {
    const n = SYSTEMS[(i + 1) % SYSTEMS.length];
    return `<path d="M${s.x} ${s.y}L${n.x} ${n.y}"/>`;
  }).join("");
  return `<section class="starmap" aria-label="Echo Reach star map"><div class="map-noise"></div><div class="map-corner top-left">ECHO REACH <span>SECTOR 07 / LOCAL CHART</span></div><div class="map-corner top-right"><span class="signal-bars"><i></i><i></i><i></i><i></i></span> DEEP-SCAN ONLINE</div>
 <svg class="sector-map" viewBox="0 0 100 100" role="group" aria-label="Select a star system"><defs><radialGradient id="nebula"><stop stop-color="#23455f" stop-opacity=".36"/><stop offset="1" stop-color="#112130" stop-opacity="0"/></radialGradient><radialGradient id="nebula2"><stop stop-color="#50335a" stop-opacity=".22"/><stop offset="1" stop-color="#112130" stop-opacity="0"/></radialGradient><filter id="starGlow"><feGaussianBlur stdDeviation=".28"/></filter></defs><ellipse cx="50" cy="43" rx="53" ry="30" fill="url(#nebula)" transform="rotate(-26 50 43)"/><ellipse cx="74" cy="54" rx="23" ry="43" fill="url(#nebula2)" transform="rotate(45 74 54)"/>${stars}<g class="chart-grid">${[10, 30, 50, 70, 90].map((x) => `<path d="M${x} 0v100M0 ${x}h100"/>`).join("")}</g><g class="constellation">${lines}</g>
 ${FACTIONS.map((f, i) => {
   const home = SYSTEMS.find((s) => s.faction === f.id);
   return home
     ? `<circle cx="${home.x}" cy="${home.y}" r="${14 + (i % 2) * 3}" fill="${f.color}" fill-opacity=".022" stroke="${f.color}" stroke-opacity=".13" stroke-width=".15" stroke-dasharray=".4 1.1"/>`
     : "";
 }).join("")}
 ${selected !== state.current ? `<path class="course-line" d="M${origin.x} ${origin.y}L${target.x} ${target.y}"/><circle cx="${target.x}" cy="${target.y}" r="3.7" class="target-ring"/>` : ""}
 ${SYSTEMS.map((s) => `<g class="star-node ${s.id === selected ? "selected" : ""} ${state.visited.includes(s.id) ? "visited" : ""}" role="button" tabindex="0" aria-label="${escape(s.name)}, ${s.kind}, ${state.visited.includes(s.id) ? "visited" : "unexplored"}" data-system="${s.id}"><circle class="star-hit" cx="${s.x}" cy="${s.y}" r="3.5"/><circle cx="${s.x}" cy="${s.y}" r="${s.id === state.current ? 1.5 : 0.85}" fill="${s.color}" opacity=".38" filter="url(#starGlow)"/><circle cx="${s.x}" cy="${s.y}" r="${s.kind === "station" ? 0.8 : 0.48}" fill="${s.color}"/>${state.visited.includes(s.id) ? `<circle cx="${s.x}" cy="${s.y}" r="1.45" fill="none" stroke="${s.color}" stroke-width=".12" opacity=".7"/>` : ""}${s.id === state.current ? `<path class="vessel-marker" d="m${s.x - 2.8} ${s.y + 1} .8-2.2 .8 2.2-.8-.4Z"/>` : ""}<text x="${s.x + 1.7}" y="${s.y - 0.6}" fill="${s.id === selected ? "#f0d6a0" : state.visited.includes(s.id) ? "#dae2eb" : "#8c9baa"}">${escape(s.name)}</text></g>`).join("")}
 <g class="coordinates"><text x="3" y="98">RA 07h 21m • DEC −42°</text><text x="81" y="98">50 LIGHT YEARS</text><path d="M81 96h15m-15-1v2m15-2v2"/></g></svg>
 <div class="map-legend"><span><i class="legend-dot"></i> INHABITED</span><span><i class="legend-dot ruin"></i> ANOMALY</span><span><i class="legend-dot danger"></i> HOSTILE</span></div>
 <div class="chart-picker"><label for="chart-destination">CHART DESTINATION</label><select id="chart-destination" aria-label="Choose a destination">${SYSTEMS.map((s) => `<option value="${s.id}" ${s.id === selected ? "selected" : ""}>${escape(s.name)}${state.visited.includes(s.id) ? " · charted" : ""}</option>`).join("")}</select></div><div class="course-summary"><div>${icon("map")}<span class="eyebrow">${selected === state.current ? "CURRENT ORBIT" : "COURSE PLOTTED"}</span><b>${escape(target.name)}</b></div><span>${selected === state.current ? "Ready for your next discovery" : `${costs.fuel} FUEL · ${costs.days} DAYS`}</span></div>
 </section><section class="mission-strip"><div class="mission-mark">${icon("scan")}</div><div><span class="eyebrow">CAPTAIN’S NEXT LEAD</span><h2>${escape(missions[0]?.title ?? "Follow the remaining signals")}</h2><p>${escape(missions[0]?.text ?? "Explore the sector and listen to its inhabitants.")}</p></div>${missions[0]?.target ? `<button class="text-button" data-select="${missions[0].target}">PLOT COURSE ${icon("arrow")}</button>` : ""}</section>`;
}
function renderSystem(): string {
  const system = SYSTEMS.find((s) => s.id === selected)!;
  const here = selected === state.current;
  const faction = FACTIONS.find((f) => f.id === system.faction);
  const scanned = state.scanned.includes(system.id);
  const cost = travelCost(state, selected);
  const actions = campaignActions(state).filter(
    (a) =>
      !a.id.startsWith("travel:") &&
      !a.id.startsWith("upgrade:") &&
      !a.id.startsWith("ship:"),
  );
  return `<div class="system-head"><span class="eyebrow">${here ? "CURRENT SYSTEM" : "SELECTED SYSTEM"}</span><span class="system-number">${String(SYSTEMS.indexOf(system) + 1).padStart(2, "0")}</span></div><div class="planet-visual" style="--planet-color:${system.color}"><div class="planet-orbit orbit-one"></div><div class="planet-orbit orbit-two"></div><div class="planet-globe ${system.kind === "anomaly" ? "anomaly" : ""}"></div><span class="planet-reticle"></span><div class="planet-tag">${system.kind.toUpperCase()} / ${state.visited.includes(system.id) ? "CHARTED" : "UNKNOWN"}</div></div><div class="system-copy"><span class="eyebrow" style="color:${faction?.color ?? "#73b5c6"}">${escape(faction?.name ?? "UNCLAIMED SPACE")}</span><h2>${escape(system.name)}</h2><p>${escape(system.description)}</p><div class="system-facts"><div><span>THREAT</span><b class="${system.danger >= 3 ? "warning" : ""}">${["Quiet", "Low", "Elevated", "High", "Severe"][Math.min(4, system.danger)]}</b></div><div><span>SURVEY</span><b>${scanned ? "Complete" : "Unscanned"}</b></div><div><span>SIGNAL</span><b>${faction ? "Intelligent" : "Unidentified"}</b></div></div>${scanned ? `<div class="discovery-note">${icon("scan")}<span>${escape(system.clue ?? system.rumor)}</span></div>` : `<div class="rumor"><span>LONG-RANGE SENSOR</span><p>${escape(system.rumor)}</p></div>`}</div><div class="system-actions">${!here ? `<button class="primary-button" data-action="travel:${system.id}" ${state.fuel < cost.fuel || state.ending || state.combat ? "disabled" : ""}>${icon("arrow")} JUMP TO SYSTEM <span>${cost.fuel} FUEL</span></button><p class="action-note">${state.fuel < cost.fuel ? "Not enough fuel. Return to your current orbit and refuel or call a rescue tug." : `${cost.days} days in transit. ${system.kind === "hostile" && !state.flags.includes(`cleared:${system.id}`) ? "Dangerous waters: be ready to fight or retreat." : "Fuel and time are spent only when you jump."}`}</p><button class="text-button" data-select="${state.current}">RETURN TO CURRENT ORBIT</button>` : actions.map((a) => `<button class="${a.tone === "danger" ? "danger-button" : a.id === "contact" || a.id === "scan" ? "primary-button" : "secondary-button"}" data-action="${a.id}" ${a.disabled || state.ending ? "disabled" : ""} title="${escape(a.disabled ?? a.description ?? "")}">${a.id === "scan" ? icon("scan") : a.id === "contact" ? icon("contacts") : a.id === "salvage" ? icon("credits") : icon("arrow")}<span>${escape(a.label)}</span></button>${a.description ? `<p class="action-note">${escape(a.disabled ?? a.description)}</p>` : ""}`).join("")}</div>`;
}
function renderShip(): string {
  const actions = campaignActions(state);
  const shipNames: Record<string, string> = {
    michiGichi: "Kestrel / Adaptive skiff",
    gondi: "Ember / Assault cutter",
    sholev: "Rime / Shield frigate",
  };
  return `<section class="ship-overview"><div class="ship-drawing">${icon("ship")}<div class="ship-orbit"></div></div><div><span class="eyebrow">ACTIVE HULL</span><h2>${shipNames[state.ship]}</h2><p>Your expeditions reshape your ship. Allies open new hulls; upgrades improve travel and your real-time combat capabilities.</p><div class="ship-specs"><span>HULL <b>${maxHull(state)}</b></span><span>FUEL CAPACITY <b>${maxFuel(state)}</b></span><span>MODULES <b>${state.upgrades.length}</b></span></div></div></section><h2 class="section-label">SYSTEM UPGRADES <small>AVAILABLE AT FRIENDLY SERVICE PORTS</small></h2><div class="upgrades-grid">${UPGRADES.map(
    (u, i) => {
      const installed = state.upgrades.includes(u.id);
      const action = actions.find((a) => a.id === `upgrade:${u.id}`);
      return `<article class="upgrade ${installed ? "installed" : ""}"><span class="module-number">MOD / ${String(i + 1).padStart(2, "0")}</span>${icon(["fuel", "arrow", "hull", "scan", "contacts", "data"][i % 6])}<h3>${escape(u.name)}</h3><p>${escape(u.description)}</p><div class="upgrade-cost">${u.cost} CREDITS ${u.dataCost ? `+ ${u.dataCost} DATA` : ""}</div><button class="secondary-button" data-action="upgrade:${u.id}" ${installed || !action || action.disabled ? "disabled" : ""}>${installed ? "INSTALLED" : (action?.disabled ?? (action ? "INSTALL MODULE" : "DOCK AT A SERVICE PORT"))}</button></article>`;
    },
  ).join("")}</div><div class="fleet-switch"><h2>ALLIED HULLS</h2>${
    actions
      .filter((a) => a.id.startsWith("ship:"))
      .map(
        (a) =>
          `<button class="secondary-button" data-action="${a.id}" ${a.disabled ? "disabled" : ""}>${escape(a.label)}</button>`,
      )
      .join("") || "<p>Earn faction trust to unlock alternative ships.</p>"
  }</div>`;
}
function renderContacts(): string {
  const f = FACTIONS.find((f) => f.id === selectedFaction) ?? FACTIONS[0];
  const relation = state.relations[f.id] ?? 0;
  const home = SYSTEMS.find((s) => s.faction === f.id);
  return `<div class="faction-list">${FACTIONS.map((item) => `<button class="faction-chip ${item.id === f.id ? "active" : ""}" data-faction="${item.id}" style="--faction:${item.color}"><span class="faction-symbol">${icon("contacts")}</span><span>${escape(item.name)}<small>${state.flags.includes(`ally:${item.id}`) ? "ALLIED" : (state.relations[item.id] ?? 0) < 0 ? "DISTRUSTFUL" : "OPEN CHANNEL"}</small></span><b>${state.relations[item.id] ?? 0}</b></button>`).join("")}</div><section class="faction-profile" style="--faction:${f.color}">${portrait(f.id, f.color)}<div><span class="eyebrow">${escape(f.title)}</span><h2>${escape(f.name)}</h2><blockquote>“${escape(f.philosophy)}”</blockquote><p>${escape(f.description)}</p><div class="relation-bar"><span>TRUST</span><div class="meter"><i style="width:${Math.max(5, Math.min(100, (relation + 2) * 20))}%;background:${f.color}"></i></div><b>${state.flags.includes(`ally:${f.id}`) ? "ALLIED" : relation < 0 ? "STRAINED" : "UNCOMMITTED"}</b></div>${home ? `<button class="secondary-button" data-nav-system="${home.id}">PLOT COURSE TO ${escape(home.name.toUpperCase())} ${icon("arrow")}</button>` : ""}</div></section><div class="diplomacy-note">${icon("contacts")}<p>Trust is earned through your choices. Trade routes, ships and the final accord depend on who believes you.</p></div>`;
}
function renderLog(): string {
  const briefs = missionBrief(state);
  return `<section class="objective-list"><span class="eyebrow">ACTIVE THREADS</span>${briefs.map((b) => `<article><h2>${escape(b.title)}</h2><p>${escape(b.text)}</p>${b.target ? `<button class="text-button" data-nav-system="${b.target}">SHOW ON CHART ${icon("arrow")}</button>` : ""}</article>`).join("")}</section><div class="log-heading"><h2 class="section-label">CAPTAIN’S LOG</h2><button class="text-button" data-cmd="export">${icon("save")} EXPORT SAVE</button><button class="text-button" data-cmd="import">IMPORT SAVE</button><input id="save-import" type="file" accept="application/json" hidden/><button class="text-button muted" data-cmd="restart">NEW EXPEDITION</button></div><div class="log-entries">${
    state.journal
      .slice()
      .reverse()
      .map(
        (j) =>
          `<article><time>DAY ${j.day}</time><div><h3>${escape(j.title)}</h3><p>${escape(j.text)}</p>${j.system ? `<button class="text-button" data-nav-system="${j.system}">LOCATE SYSTEM ${icon("arrow")}</button>` : ""}</div></article>`,
      )
      .join("") || "<p>Your first discovery is waiting.</p>"
  }</div>`;
}
function renderDialogue(): string {
  const d = dialogue(state)!;
  const f = FACTIONS.find(
    (f) => f.id === SYSTEMS.find((s) => s.id === state.current)?.faction,
  );
  return `<div class="modal-backdrop"><section class="dialogue-modal" role="dialog" aria-modal="true" aria-labelledby="dialogue-title"><div class="transmission" style="--faction:${f?.color ?? "#64dbd0"}"><span class="eyebrow"><i class="live-dot"></i> SECURE TRANSMISSION</span>${portrait(f?.id ?? d.speaker, f?.color ?? "#64dbd0")}<h3>${escape(d.speaker)}</h3><div class="waveform">${Array.from({ length: 40 }, (_, i) => `<i style="height:${6 + ((i * 7) % 28)}px;animation-delay:${i * 0.07}s"></i>`).join("")}</div><small>THE WORDS YOU CHOOSE TRAVEL FURTHER THAN YOU DO.</small></div><div class="dialogue-copy"><span class="eyebrow">DIPLOMATIC CHANNEL / DAY ${state.day}</span><h2 id="dialogue-title">${escape(d.title)}</h2><div class="dialogue-text">${d.text
    .split("\n")
    .filter(Boolean)
    .map((p) => `<p>${escape(p)}</p>`)
    .join(
      "",
    )}</div><div class="dialogue-choices">${d.choices.map((c, i) => `<button data-action="${c.id}" class="dialogue-choice ${c.tone ?? ""}" ${c.disabled ? "disabled" : ""}><span class="choice-num">${String(i + 1).padStart(2, "0")}</span><div><b>${escape(c.label)}</b>${c.description || c.disabled ? `<small>${escape(c.disabled ?? c.description)}</small>` : ""}</div>${icon("arrow")}</button>`).join("")}</div></div></section></div>`;
}
function renderEncounter(): string {
  const c = state.combat!;
  return `<div class="modal-backdrop"><section class="compact-modal encounter-modal" role="dialog" aria-modal="true" aria-labelledby="encounter-title"><span class="eyebrow warning">UNIDENTIFIED VESSEL / INTERCEPT COURSE</span><div class="encounter-symbol">${icon("ship")}</div><h2 id="encounter-title">The silence has teeth.</h2><p>${escape(c.reason)}</p><div class="encounter-info"><span>HULL <b>${Math.round(state.hull)} / ${maxHull(state)}</b></span><span>THREAT <b>${c.difficulty === 1 ? "LOW" : c.difficulty === 2 ? "ELEVATED" : "SEVERE"}</b></span></div><button class="primary-button" data-cmd="fight">${icon("ship")} TAKE THE HELM</button><button class="secondary-button" data-cmd="retreat">DISENGAGE AND RETREAT</button><p class="action-note">Combat is real-time. W or ↑ thrust · A/D or ←/→ turn · Space fire · Shift special · Esc retreat. Retreat costs time and fuel.</p></section></div>`;
}
async function fight(): Promise<void> {
  if (!state.combat || combatActive) return;
  combatActive = true;
  busy = true;
  const c = state.combat;
  let failed = false;
  try {
    const result = await launchCombat({
      playerShip: state.ship,
      enemyShip: c.enemyShip,
      difficulty: c.difficulty,
      hullFraction: state.hull / maxHull(state),
      upgrades: state.upgrades,
    });
    state = combatResult(state, result);
    selected = state.current;
    store();
  } catch {
    failed = true;
  } finally {
    combatActive = false;
    busy = false;
    render();
    storageNotice();
    if (failed)
      notify(
        "Combat could not start. Your voyage is safe; try again or disengage.",
        true,
      );
  }
}
function renderEnding(end: { title: string; text: string }): string {
  return `<div class="modal-backdrop"><section class="ending-modal" role="dialog" aria-modal="true" aria-labelledby="ending-title"><span class="eyebrow">EXPEDITION COMPLETE / DAY ${state.day}</span><div class="ending-emblem">${icon("map")}</div><h2 id="ending-title">${escape(end.title)}</h2><div class="ending-text">${end.text
    .split("\n")
    .filter(Boolean)
    .map((p) => `<p>${escape(p)}</p>`)
    .join(
      "",
    )}</div><div class="ending-stats"><span><b>${state.visited.length}</b>SYSTEMS VISITED</span><span><b>${FACTIONS.filter((f) => state.flags.includes(`ally:${f.id}`)).length}</b>ALLIED FACTIONS</span><span><b>${state.day}</b>DAYS OF YOUR LIFE</span></div><button class="primary-button" data-cmd="restart">ANOTHER POSSIBLE FUTURE ${icon("arrow")}</button><button class="text-button" data-cmd="export">EXPORT THIS VOYAGE</button></section></div>`;
}
function renderOverlay(): string {
  if (overlay === "restart")
    return `<div class="modal-backdrop"><section class="compact-modal" role="dialog" aria-modal="true"><span class="eyebrow">NEW EXPEDITION</span><h2>A different future?</h2><p>Starting over replaces this browser’s voyage. You can export your current save first.</p><button class="primary-button" data-cmd="confirm-restart">START A NEW EXPEDITION</button><button class="secondary-button" data-cmd="cancel-overlay">KEEP THIS VOYAGE</button></section></div>`;
  if (overlay === "help")
    return `<div class="modal-backdrop"><section class="help-modal" role="dialog" aria-modal="true"><button class="modal-close icon-button" data-cmd="cancel-overlay" aria-label="Close help">${icon("close")}</button><span class="eyebrow">CAPTAIN’S FIELD GUIDE</span><h2>Follow a signal. Change a world.</h2><div class="help-grid"><article>${icon("map")}<h3>Explore</h3><p>Select a star, check the fuel and day costs, then jump. Survey once in orbit to uncover clues. Salvage pays for your next expedition.</p></article><article>${icon("contacts")}<h3>Listen</h3><p>Open comms with inhabited worlds. Factions have different ideas of what a person is. Their trust, missions and technologies depend on your decisions.</p></article><article>${icon("ship")}<h3>Survive</h3><p>Service ports refuel, repair and install upgrades. A rescue tug can recover a stranded ship at a cost. Time advances through actions, never while reading.</p></article><article>${icon("hull")}<h3>Fight</h3><p>W/↑ thrust; A/D/←/→ turn; Space fire; Shift special. Escape disengages. Touch controls appear in battle. Losing is costly, but your story continues.</p></article></div><p class="help-foot">Follow the Captain’s Next Lead and Ship Log to restore the relays. Gather the resonant keys, discover the truth, then decide how the network should survive. Your voyage saves automatically on this browser.</p><button class="primary-button" data-cmd="cancel-overlay">RETURN TO THE REACH</button></section></div>`;
  return `<div class="modal-backdrop welcome-backdrop"><section class="welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title"><div class="welcome-signal"><i></i><i></i><i></i><span>${icon("map")}</span></div><span class="eyebrow">COSMOCLASH / A SINGLE-PLAYER SPACE ADVENTURE</span><h2 id="welcome-title">Someone is still<br/><em>out there.</em></h2><p>The relays are falling silent. Whole worlds have disappeared from the network. You have one ship, a handful of fuel, and a message that should not exist.</p><div class="welcome-principles"><span>${icon("map")} EXPLORE</span><span>${icon("contacts")} NEGOTIATE</span><span>${icon("ship")} SURVIVE</span></div><button class="primary-button" data-cmd="begin">${saved ? "CONTINUE YOUR VOYAGE" : "START EXPEDITION"} ${icon("arrow")}</button><button class="text-button" data-cmd="help">READ THE CAPTAIN’S GUIDE</button><a class="legacy-link" href="?mode=melee">Original CosmoClash Melee ↗</a></section></div>`;
}
function bind(): void {
  app
    .querySelector<HTMLSelectElement>("#chart-destination")
    ?.addEventListener("change", (e) => {
      selected = (e.target as HTMLSelectElement).value;
      render();
    });
  app.querySelectorAll<HTMLElement>("[data-system]").forEach((el) => {
    const choose = () => {
      if (overlay || dialogue(state) || state.combat || state.ending) return;
      selected = el.dataset.system!;
      render();
    };
    el.addEventListener("click", choose);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        choose();
      }
    });
  });
  app.querySelectorAll<HTMLElement>("[data-select]").forEach((el) =>
    el.addEventListener("click", () => {
      selected = el.dataset.select!;
      render();
    }),
  );
  app.querySelectorAll<HTMLElement>("[data-nav-system]").forEach((el) =>
    el.addEventListener("click", () => {
      selected = el.dataset.navSystem!;
      view = "map";
      render();
    }),
  );
  app.querySelectorAll<HTMLElement>("[data-view]").forEach((el) =>
    el.addEventListener("click", () => {
      view = el.dataset.view as typeof view;
      render();
    }),
  );
  app.querySelectorAll<HTMLElement>("[data-faction]").forEach((el) =>
    el.addEventListener("click", () => {
      selectedFaction = el.dataset.faction!;
      render();
    }),
  );
  app
    .querySelectorAll<HTMLElement>("[data-action]")
    .forEach((el) =>
      el.addEventListener("click", () => perform(el.dataset.action!)),
    );
  app.querySelectorAll<HTMLElement>("[data-cmd]").forEach((el) =>
    el.addEventListener("click", () => {
      const cmd = el.dataset.cmd;
      if (cmd === "begin") {
        overlay = null;
        store();
        render();
        storageNotice();
      } else if (cmd === "help") {
        overlay = "help";
        render();
      } else if (cmd === "cancel-overlay") {
        overlay = null;
        render();
      } else if (cmd === "audio") {
        audio.toggle();
        render();
      } else if (cmd === "restart") {
        overlay = "restart";
        render();
      } else if (cmd === "confirm-restart") {
        state = createCampaign();
        selected = state.current;
        overlay = null;
        view = "map";
        store();
        render();
        storageNotice();
      } else if (cmd === "fight") void fight();
      else if (cmd === "retreat") {
        state = combatResult(state, {
          won: false,
          hullFraction: state.hull / maxHull(state),
          escaped: true,
        });
        selected = state.current;
        store();
        render();
        storageNotice();
      } else if (cmd === "export") {
        const blob = new Blob([JSON.stringify(state, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob),
          a = document.createElement("a");
        a.href = url;
        a.download = `signalwake-day-${state.day}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else if (cmd === "import")
        document.querySelector<HTMLInputElement>("#save-import")?.click();
    }),
  );
  app
    .querySelector<HTMLInputElement>("#save-import")
    ?.addEventListener("change", async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 300000) {
        notify("That save file is too large.", true);
        return;
      }
      try {
        const text = await file.text();
        const candidate = loadCampaign({
          getItem: () => text,
        } as unknown as Storage);
        if (!candidate) throw new Error();
        state = candidate;
        selected = state.current;
        store();
        render();
        if (storageOK) notify("Voyage restored.");
        else storageNotice();
      } catch {
        notify("That file is not a valid Signalwake save.", true);
      }
    });
  const modal = app.querySelector<HTMLElement>("[role=dialog]");
  if (modal) {
    const first = modal.querySelector<HTMLElement>("button:not([disabled])");
    first?.focus({ preventScroll: true });
  }
}
window.addEventListener("keydown", (event) => {
  if (combatActive) return;
  if (event.key === "Escape" && overlay) {
    overlay = null;
    render();
  }
  if (event.key === "Tab") {
    const modal = app.querySelector("[role=dialog]");
    if (!modal) return;
    const focusable = Array.from(
      modal.querySelectorAll<HTMLElement>(
        "button:not([disabled]),a[href],input",
      ),
    );
    if (!focusable.length) return;
    const first = focusable[0],
      last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
render();
