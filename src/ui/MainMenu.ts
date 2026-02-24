import './main-menu.css';

export class MainMenu {
  private root: HTMLDivElement;
  private onPlay: () => void;
  private keyHandler: (e: KeyboardEvent) => void;

  constructor(parent: HTMLElement, onPlay: () => void) {
    this.onPlay = onPlay;

    this.root = document.createElement('div');
    this.root.id = 'main-menu';
    this.root.style.backgroundImage = 'url(/textures/main-bk.jpg)';

    const playBtn = document.createElement('button');
    playBtn.className = 'menu-btn';
    playBtn.textContent = 'Play';
    playBtn.addEventListener('click', () => this.play());
    this.root.appendChild(playBtn);

    const credits = document.createElement('div');
    credits.className = 'menu-credits';
    credits.textContent = 'Made by Ori Hanegby, Guy Corem, Orr Kowarsky';
    this.root.appendChild(credits);

    parent.appendChild(this.root);

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
