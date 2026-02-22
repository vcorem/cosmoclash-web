export interface PlayerInput {
  thrust: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
  firePrimary: boolean;
}

interface PlayerKeyBindings {
  thrust: string[];
  rotateLeft: string[];
  rotateRight: string[];
  firePrimary: string[];
}

const DEFAULT_BINDINGS: PlayerKeyBindings[] = [
  // Player 1: Arrow keys + /
  {
    thrust: ['ArrowUp'],
    rotateLeft: ['ArrowLeft'],
    rotateRight: ['ArrowRight'],
    firePrimary: ['/'],
  },
  // Player 2: WASD + Space
  {
    thrust: ['w', 'W'],
    rotateLeft: ['a', 'A'],
    rotateRight: ['d', 'D'],
    firePrimary: [' '],
  },
];

export class InputManager {
  private pressed = new Set<string>();
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
      if (this.allGameKeys.has(e.key)) {
        e.preventDefault();
      }
      this.pressed.add(e.key);
    };

    this.onKeyUp = (e: KeyboardEvent) => {
      this.pressed.delete(e.key);
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  player(index: number): PlayerInput {
    const b = this.bindings[index];
    return {
      thrust: b.thrust.some(k => this.pressed.has(k)),
      rotateLeft: b.rotateLeft.some(k => this.pressed.has(k)),
      rotateRight: b.rotateRight.some(k => this.pressed.has(k)),
      firePrimary: b.firePrimary.some(k => this.pressed.has(k)),
    };
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.pressed.clear();
  }
}
