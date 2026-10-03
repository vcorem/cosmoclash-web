import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  createCampaign,
  loadCampaign,
  maxFuel,
  SAVE_KEY,
  saveCampaign,
  travelCost,
} from "./engine";
import type { CampaignState } from "./engine";
import { SYSTEMS } from "./world";

const runtime = vi.hoisted(() => ({
  launchCombat: vi.fn(),
  ping: vi.fn(),
  toggle: vi.fn(),
  createObjectURL: vi.fn(
    (_object: Blob | MediaSource) => "blob:signalwake-test",
  ),
  revokeObjectURL: vi.fn((_url: string) => {}),
}));

vi.mock("./combat", () => ({ launchCombat: runtime.launchCombat }));
vi.mock("./audio", () => ({
  CampaignAudio: class {
    enabled = false;
    toggle() {
      runtime.toggle();
      this.enabled = !this.enabled;
      return this.enabled;
    }
    ping() {
      runtime.ping();
    }
  },
}));

const NativeURL = URL;
const originalAddListener = window.addEventListener.bind(window);
const listeners: Array<{
  type: string;
  listener: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
}> = [];

function freshStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

function element<T extends Element = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  expect(found, `Expected UI control: ${selector}`).not.toBeNull();
  return found!;
}

function click(selector: string): void {
  const control = element(selector);
  if (control instanceof HTMLButtonElement) {
    expect(control.disabled, `Expected enabled UI control: ${selector}`).toBe(
      false,
    );
    control.click();
  } else control.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

const command = (id: string) => click(`[data-cmd="${id}"]`);
const action = (id: string) => click(`[data-action="${id}"]`);
const view = (id: string) => click(`[data-view="${id}"]`);

function stored(): CampaignState {
  const state = loadCampaign();
  expect(state, "The UI should persist a valid campaign save").not.toBeNull();
  return state!;
}

async function mount(initial?: CampaignState): Promise<void> {
  if (initial) expect(saveCampaign(initial)).toBe(true);
  await import("./entry");
}

function earnedChoirAlliance(): CampaignState {
  let state = createCampaign();
  for (const id of [
    "contact",
    "harbor:briefing",
    "travel:vellum",
    "contact",
    "choir:accept",
    "travel:prism",
    "scan",
    "travel:vellum",
    "contact",
    "choir:return",
  ]) {
    const next = act(state, id);
    expect(next, `Setup action ${id} should be available`).not.toBe(state);
    state = next;
  }
  return state;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  runtime.launchCombat.mockReset();
  vi.useFakeTimers();
  document.body.replaceChildren();
  document.body.className = "";
  vi.stubGlobal("localStorage", freshStorage());
  vi.stubGlobal(
    "URL",
    class extends NativeURL {
      static createObjectURL = runtime.createObjectURL;
      static revokeObjectURL = runtime.revokeObjectURL;
    },
  );
  vi.spyOn(window, "addEventListener").mockImplementation(
    (type, listener, options) => {
      if (listener) listeners.push({ type, listener, options });
      originalAddListener(type, listener, options);
    },
  );
});

afterEach(() => {
  for (const { type, listener, options } of listeners.splice(0))
    window.removeEventListener(type, listener, options);
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
  document.body.className = "";
});

describe("campaign player interface", { timeout: 30_000 }, () => {
  it("makes every destination available through the mobile chart selector without spending supplies", async () => {
    await mount();
    command("begin");
    const departure = stored();
    const destination = element<HTMLSelectElement>("#chart-destination");
    expect(destination.getAttribute("aria-label")).toBe("Choose a destination");
    expect(
      [...destination.options].map((option) => option.value).sort(),
    ).toEqual(SYSTEMS.map((system) => system.id).sort());
    destination.value = "tether";
    destination.dispatchEvent(new Event("change", { bubbles: true }));
    expect(element(".system-panel h2").textContent).toBe("Tether Commons");
    expect(
      document.querySelector('[data-action="travel:tether"]'),
    ).not.toBeNull();
    expect(element<HTMLSelectElement>("#chart-destination").value).toBe(
      "tether",
    );
    expect(stored()).toEqual(departure);
    expect(element(".status-loc").textContent).toContain("Lastlight Harbor");
  });

  it("starts a voyage, earns the charter, plots a jump, and persists a consequential diplomatic choice", async () => {
    await mount();
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(element("#welcome-title").textContent).toContain("Someone is still");
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
    command("begin");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(stored()).toEqual(createCampaign());
    vi.advanceTimersByTime(10_000);
    expect(stored().day).toBe(1);

    action("contact");
    expect(element("#dialogue-title").textContent).toBe(
      "Someone has to answer",
    );
    action("harbor:briefing");
    expect(stored().flags).toContain("briefed");
    expect(stored().data).toBe(12);
    expect(document.querySelector(".dialogue-modal")).toBeNull();
    const departure = stored();
    const cost = travelCost(departure, "vellum");
    click('.mission-strip [data-select="vellum"]');
    expect(element(".system-panel h2").textContent).toBe("Vellum");
    expect(stored()).toEqual(departure);
    action("travel:vellum");
    expect(stored()).toMatchObject({
      current: "vellum",
      day: departure.day + cost.days,
      fuel: departure.fuel - cost.fuel,
    });
    expect(element(".status-loc").textContent).toContain("Vellum");

    action("contact");
    expect(
      element<HTMLButtonElement>('[data-action="choir:return"]').disabled,
    ).toBe(true);
    action("choir:standardize");
    const chosen = stored();
    expect(chosen.flags).toEqual(
      expect.arrayContaining(["key:choir", "choir:standardized"]),
    );
    expect(chosen.relations.choir).toBe(-2);
    expect(chosen.data).toBe(4);
    expect(document.querySelector(".dialogue-modal")).toBeNull();
    view("log");
    expect(element(".log-entries").textContent).toContain("A perfect verse");
    expect(element(".log-entries").textContent).toContain(
      "The dispatch charter",
    );
    expect(stored()).toEqual(chosen);
  });

  it("installs a module and an earned allied hull, and plots a faction home from Contacts", async () => {
    const initial = earnedChoirAlliance();
    await mount(initial);
    command("begin");
    view("ship");
    expect(element('[data-action="ship:gondi"]').textContent).toContain(
      "Chorus skimmer",
    );
    action("upgrade:tank");
    action("ship:gondi");
    const outfitted = stored();
    expect(outfitted.upgrades).toContain("tank");
    expect(outfitted.credits).toBe(initial.credits - 45);
    expect(outfitted.fuel).toBe(initial.fuel + 30);
    expect(maxFuel(outfitted)).toBe(66);
    expect(outfitted.ship).toBe("gondi");
    expect(element(".ship-overview h2").textContent).toContain("Ember");
    expect(
      element<HTMLButtonElement>('[data-action="upgrade:tank"]').disabled,
    ).toBe(true);
    expect(element('[data-action="upgrade:tank"]').textContent).toBe(
      "INSTALLED",
    );

    view("contacts");
    expect(element(".faction-profile .relation-bar").textContent).toContain(
      "ALLIED",
    );
    click('[data-faction="forge"]');
    expect(element(".faction-profile h2").textContent).toBe("The Ember Forge");
    click('.faction-profile [data-nav-system="kiln"]');
    expect(element('[data-view="map"]').getAttribute("aria-current")).toBe(
      "page",
    );
    expect(element(".system-panel h2").textContent).toBe("Kiln");
    expect(stored()).toEqual(outfitted);
    view("log");
    expect(element(".log-entries").textContent).toContain(
      "Auxiliary Fuel Cells installed",
    );
    expect(element(".log-entries").textContent).toContain(
      "A different hull, the same mission",
    );
  });

  it("exports a named voyage, rejects a bad import, and restores a valid save through Ship Log", async () => {
    await mount();
    command("begin");
    action("contact");
    action("harbor:briefing");
    view("log");
    let downloaded: HTMLAnchorElement | undefined;
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloaded = this;
      });
    command("export");
    expect(runtime.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    const exported = runtime.createObjectURL.mock.calls[0]?.[0] as
      Blob | undefined;
    expect(exported?.type).toBe("application/json");
    expect(exported!.size).toBeGreaterThan(100);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(downloaded?.download).toBe("signalwake-day-1.json");
    expect(downloaded?.href).toBe("blob:signalwake-test");
    vi.advanceTimersByTime(1000);
    expect(runtime.revokeObjectURL).toHaveBeenCalledWith(
      "blob:signalwake-test",
    );

    const beforeImport = stored();
    const importSave = (text: string) => {
      const file = new File([text], "voyage.json", {
        type: "application/json",
      });
      Object.defineProperty(file, "text", {
        value: () => Promise.resolve(text),
      });
      const input = element<HTMLInputElement>("#save-import");
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [file],
      });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    importSave("{invalid");
    await vi.waitFor(() =>
      expect(element(".toast.error").textContent).toContain(
        "not a valid Signalwake save",
      ),
    );
    expect(stored()).toEqual(beforeImport);
    const restore = earnedChoirAlliance();
    importSave(JSON.stringify(restore));
    await vi.waitFor(() => expect(stored()).toEqual(restore));
    expect(element("#toast").textContent).toBe("Voyage restored.");
    expect(element(".status-loc").textContent).toContain("Vellum");
    expect(element(".system-panel h2").textContent).toBe("Vellum");
    expect(element(".log-entries").textContent).toContain(
      "The Choir keeps its own voice",
    );
  });

  it("shows only the welcome dialog when restoring pending combat, then resumes the encounter", async () => {
    const pending = act(createCampaign(), "travel:crucible");
    expect(pending.combat).not.toBeNull();
    await mount(pending);
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.querySelector(".welcome-modal")).not.toBeNull();
    expect(document.querySelector(".encounter-modal")).toBeNull();
    expect(element('[data-cmd="begin"]').textContent).toContain(
      "CONTINUE YOUR VOYAGE",
    );
    expect(runtime.launchCombat).not.toHaveBeenCalled();
    command("begin");
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(element("#encounter-title").textContent).toBe(
      "The silence has teeth.",
    );
    expect(document.querySelector(".welcome-modal")).toBeNull();
    expect(stored()).toEqual(pending);
  });

  it.each(["rescue", "salvage"])(
    "updates the selected panel when %s recovers a remote ship at Harbor",
    async (recovery) => {
      const remote = act(createCampaign(), "travel:prism");
      const stranded = { ...remote, fuel: 0, hull: 5, credits: 0 };
      await mount(stranded);
      command("begin");
      expect(element(".system-panel h2").textContent).toBe("Prism Witness");
      action(recovery);
      expect(stored()).toMatchObject({ current: "harbor", hull: 60, fuel: 22 });
      expect(stored().visited).toContain("prism");
      expect(element(".system-panel h2").textContent).toBe("Lastlight Harbor");
      expect(element(".system-head").textContent).toContain("CURRENT SYSTEM");
      expect(element(".status-loc").textContent).toContain("Lastlight Harbor");
      expect(document.querySelector('[data-action="refuel"]')).not.toBeNull();
      expect(
        element('[data-system="harbor"]').classList.contains("selected"),
      ).toBe(true);
      expect(
        document.querySelector('[data-action="travel:harbor"]'),
      ).toBeNull();
    },
  );

  it("requires confirmation to replace a completed expedition and lets the player cancel", async () => {
    const lastDay = { ...createCampaign(), day: 119 };
    await mount(lastDay);
    command("begin");
    action("scan");
    expect(stored().ending).toBe("collapse");
    expect(element("#ending-title").textContent).toBe(
      "The future nobody chose",
    );
    const completed = stored();
    command("restart");
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.querySelector(".ending-modal")).toBeNull();
    expect(element('[data-cmd="confirm-restart"]').textContent).toContain(
      "START A NEW EXPEDITION",
    );
    expect(stored()).toEqual(completed);
    command("cancel-overlay");
    expect(element("#ending-title").textContent).toBe(
      "The future nobody chose",
    );
    expect(stored()).toEqual(completed);
    command("restart");
    command("confirm-restart");
    expect(stored()).toEqual(createCampaign());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(element(".system-panel h2").textContent).toBe("Lastlight Harbor");
    expect(element('[data-view="map"]').getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("keeps storage errors visible after rendering and offers export instead of claiming a save", async () => {
    const storage = freshStorage();
    storage.setItem = () => {
      throw new DOMException("Storage is blocked", "SecurityError");
    };
    vi.stubGlobal("localStorage", storage);
    await mount();
    command("begin");
    expect(element(".toast.error.visible").textContent).toContain(
      "Browser storage is unavailable",
    );
    expect(element(".save-status").textContent).not.toContain("AUTO-SAVED");
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
    action("contact");
    action("harbor:briefing");
    expect(element(".toast.error.visible").textContent).toContain(
      "Export your voyage",
    );
    view("log");
    expect(element(".log-entries").textContent).toContain(
      "The dispatch charter",
    );
    expect(document.querySelector('[data-cmd="export"]')).not.toBeNull();
  });

  it("preserves a rejected combat launch for retry and applies a successful retry exactly once", async () => {
    const pending = act(createCampaign(), "travel:crucible");
    await mount(pending);
    command("begin");
    runtime.launchCombat.mockRejectedValueOnce(new Error("WebGL unavailable"));
    command("fight");
    await vi.waitFor(() =>
      expect(element(".toast.error.visible").textContent).toContain(
        "Combat could not start",
      ),
    );
    expect(stored()).toEqual(pending);
    expect(document.querySelector(".encounter-modal")).not.toBeNull();
    expect(runtime.launchCombat).toHaveBeenCalledTimes(1);
    expect(runtime.launchCombat).toHaveBeenLastCalledWith(
      expect.objectContaining({
        playerShip: pending.ship,
        enemyShip: pending.combat!.enemyShip,
        difficulty: pending.combat!.difficulty,
        hullFraction: 1,
        upgrades: [],
      }),
    );

    let resolveRound!: (result: {
      won: boolean;
      escaped: boolean;
      hullFraction: number;
    }) => void;
    runtime.launchCombat.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRound = resolve;
        }),
    );
    command("fight");
    command("fight");
    expect(runtime.launchCombat).toHaveBeenCalledTimes(2);
    expect(stored().combat).toEqual(pending.combat);
    resolveRound({ won: true, escaped: false, hullFraction: 0.73 });
    await vi.waitFor(() => expect(stored().combat).toBeNull());
    const victory = stored();
    expect(victory.flags).toContain("cleared:crucible");
    expect(victory.credits).toBe(pending.credits + 50);
    expect(victory.hull).toBe(73);
    expect(victory.data).toBe(8);
    expect(document.querySelector(".encounter-modal")).toBeNull();
    expect(element(".system-panel h2").textContent).toBe("Crucible Nine");
    action("scan");
    expect(stored().scanned).toContain("crucible");
    expect(stored().credits).toBe(victory.credits);
    expect(stored().data).toBe(12);
  });
});
