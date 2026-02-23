const ASPECT = 4 / 3;

/** Creates a 4:3 letterboxed game container. All game UI and the canvas go inside it. */
export class Viewport {
  readonly container: HTMLDivElement;

  constructor() {
    // Black background for letterbox bars
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.background = '#000';

    this.container = document.createElement('div');
    this.container.id = 'game-container';
    this.container.style.position = 'absolute';
    this.container.style.overflow = 'hidden';
    document.body.appendChild(this.container);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;

    let cw: number, ch: number;
    if (w / h > ASPECT) {
      // Window is wider than 4:3 → pillarbox (bars on sides)
      ch = h;
      cw = Math.floor(h * ASPECT);
    } else {
      // Window is taller than 4:3 → letterbox (bars on top/bottom)
      cw = w;
      ch = Math.floor(w / ASPECT);
    }

    this.container.style.width = `${cw}px`;
    this.container.style.height = `${ch}px`;
    this.container.style.left = `${Math.floor((w - cw) / 2)}px`;
    this.container.style.top = `${Math.floor((h - ch) / 2)}px`;
  }

  get width(): number {
    return this.container.clientWidth;
  }

  get height(): number {
    return this.container.clientHeight;
  }
}
