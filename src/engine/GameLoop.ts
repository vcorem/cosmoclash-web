export class GameLoop {
  private lastTime: number = 0;
  private running: boolean = false;
  private onUpdate: (dt: number) => void;
  private onRender: () => void;
  private maxDt: number = 100; // Cap at 100ms to prevent spiral-of-death

  constructor(onUpdate: (dt: number) => void, onRender: () => void) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    this.tick(this.lastTime);
  }

  stop(): void {
    this.running = false;
  }

  private tick = (now: number): void => {
    if (!this.running) return;

    let dt = now - this.lastTime;
    this.lastTime = now;

    if (dt > this.maxDt) dt = this.maxDt;

    this.onUpdate(dt);
    this.onRender();

    requestAnimationFrame(this.tick);
  };
}
