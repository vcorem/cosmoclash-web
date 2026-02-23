import './logo-splash.css';

export class LogoSplash {
  private root: HTMLDivElement;
  private done = false;
  private onComplete: () => void;
  private skipHandler: () => void;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(onComplete: () => void) {
    this.onComplete = onComplete;

    this.root = document.createElement('div');
    this.root.id = 'logo-splash';

    const img = document.createElement('img');
    img.src = '/textures/logo.jpg';
    img.alt = 'PixtaZy Presents';
    this.root.appendChild(img);
    document.body.appendChild(this.root);

    this.skipHandler = () => this.finish();
    window.addEventListener('keydown', this.skipHandler);
    window.addEventListener('click', this.skipHandler);

    // Fade in on next frame
    requestAnimationFrame(() => {
      this.root.classList.add('visible');
    });

    // After fade-in (1s) + hold (3s), start fade-out
    this.timers.push(setTimeout(() => {
      this.root.classList.remove('visible');
    }, 4000));

    // After fade-out (1s more), complete
    this.timers.push(setTimeout(() => {
      this.finish();
    }, 5000));
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    for (const t of this.timers) clearTimeout(t);
    window.removeEventListener('keydown', this.skipHandler);
    window.removeEventListener('click', this.skipHandler);
    this.root.remove();
    this.onComplete();
  }
}
