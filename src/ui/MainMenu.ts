import './main-menu.css';

export class MainMenu {
  private root: HTMLDivElement;
  private onPlay: () => void;
  private keyHandler: (e: KeyboardEvent) => void;

  constructor(onPlay: () => void) {
    this.onPlay = onPlay;

    this.root = document.createElement('div');
    this.root.id = 'main-menu';
    this.root.style.backgroundImage = 'url(/textures/main-bk.jpg)';

    const playBtn = document.createElement('button');
    playBtn.className = 'menu-btn';
    playBtn.textContent = 'Play';
    playBtn.addEventListener('click', () => this.play());
    this.root.appendChild(playBtn);

    document.body.appendChild(this.root);

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.play();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  private play(): void {
    this.onPlay();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.keyHandler);
    this.root.remove();
  }
}
