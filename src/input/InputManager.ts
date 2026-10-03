export interface PlayerInput {
  thrust: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
  firePrimary: boolean;
  fireSecondary: boolean;
}

export interface PlayerKeyBindings {
  thrust: string[];
  rotateLeft: string[];
  rotateRight: string[];
  firePrimary: string[];
  fireSecondary: string[];
}

const DEFAULT_BINDINGS: PlayerKeyBindings[] = [
  // Player 1: Arrow keys + / + .
  {
    thrust: ['ArrowUp'],
    rotateLeft: ['ArrowLeft'],
    rotateRight: ['ArrowRight'],
    firePrimary: ['/'],
    fireSecondary: ['.'],
  },
  // Player 2: WASD + Space + Shift
  {
    thrust: ['w', 'W'],
    rotateLeft: ['a', 'A'],
    rotateRight: ['d', 'D'],
    firePrimary: [' '],
    fireSecondary: ['Shift'],
  },
];

/** Campaign controls all belong to the human pilot; the opponent is AI. */
export const CAMPAIGN_BINDINGS: PlayerKeyBindings[] = [
  {
    thrust: ['ArrowUp', 'w', 'W'],
    rotateLeft: ['ArrowLeft', 'a', 'A'],
    rotateRight: ['ArrowRight', 'd', 'D'],
    firePrimary: [' ', '/'],
    fireSecondary: ['Shift', '.'],
  },
  { thrust: [], rotateLeft: [], rotateRight: [], firePrimary: [], fireSecondary: [] },
];

export class InputManager {
  private pressed = new Set<string>();
  private injected = new Map<number, Partial<PlayerInput>>();
  private enabled = true;
  private bindings: PlayerKeyBindings[];
  private allGameKeys: Set<string>;
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;

  constructor(bindings: PlayerKeyBindings[] = DEFAULT_BINDINGS) {
    this.bindings = bindings;

    // Build set of all game keys for preventDefault
    this.allGameKeys = new Set<string>();
    for (const b of bindings) {
      for (const keys of Object.values(b)) {
        for (const k of keys) this.allGameKeys.add(k);
      }
    }

    this.onKeyDown = (e: KeyboardEvent) => {
      if (!this.enabled) return;
      if (this.allGameKeys.has(e.key)) {
        e.preventDefault();
      }
      this.pressed.add(e.key);
    };

    this.onKeyUp = (e: KeyboardEvent) => {
      this.pressed.delete(e.key);
      // Shift modifier changes key case: releasing 'd' while Shift is held
      // reports 'D', leaving lowercase 'd' stuck. Delete both cases.
      if (e.key.length === 1) {
        this.pressed.delete(e.key.toLowerCase());
        this.pressed.delete(e.key.toUpperCase());
      }
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  player(index: number): PlayerInput {
    const b = this.bindings[index];
    const touch = this.injected.get(index);
    return {
      thrust: !!touch?.thrust || b.thrust.some(k => this.pressed.has(k)),
      rotateLeft: !!touch?.rotateLeft || b.rotateLeft.some(k => this.pressed.has(k)),
      rotateRight: !!touch?.rotateRight || b.rotateRight.some(k => this.pressed.has(k)),
      firePrimary: !!touch?.firePrimary || b.firePrimary.some(k => this.pressed.has(k)),
      fireSecondary: !!touch?.fireSecondary || b.fireSecondary.some(k => this.pressed.has(k)),
    };
  }

  /** Pointer controls do not synthesize keyboard events or affect the AI. */
  setAction(index: number, action: keyof PlayerInput, pressed: boolean): void {
    if (!this.enabled) return;
    this.injected.set(index, { ...this.injected.get(index), [action]: pressed });
  }

  clear(): void {
    this.pressed.clear();
    this.injected.clear();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.clear();
  }
}
