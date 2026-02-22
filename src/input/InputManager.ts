const THRUST_KEYS = ['ArrowUp', 'w', 'W'];
const ROTATE_LEFT_KEYS = ['ArrowLeft', 'a', 'A'];
const ROTATE_RIGHT_KEYS = ['ArrowRight', 'd', 'D'];
const FIRE_PRIMARY_KEYS = [' '];
const GAME_KEYS = [...THRUST_KEYS, ...ROTATE_LEFT_KEYS, ...ROTATE_RIGHT_KEYS, ...FIRE_PRIMARY_KEYS];

export class InputManager {
  private pressed = new Set<string>();
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;

  constructor() {
    this.onKeyDown = (e: KeyboardEvent) => {
      if (GAME_KEYS.includes(e.key)) {
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

  isPressed(key: string): boolean {
    return this.pressed.has(key);
  }

  get thrust(): boolean {
    return THRUST_KEYS.some(k => this.pressed.has(k));
  }

  get rotateLeft(): boolean {
    return ROTATE_LEFT_KEYS.some(k => this.pressed.has(k));
  }

  get rotateRight(): boolean {
    return ROTATE_RIGHT_KEYS.some(k => this.pressed.has(k));
  }

  get firePrimary(): boolean {
    return FIRE_PRIMARY_KEYS.some(k => this.pressed.has(k));
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.pressed.clear();
  }
}
