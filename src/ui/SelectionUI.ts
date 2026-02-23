import { CharacterDef } from '@/game/CharacterRegistry';
import './selection.css';

export class SelectionUI {
  private root: HTMLDivElement;
  private header: HTMLDivElement;
  private nameEl: HTMLDivElement;
  private weaponEl: HTMLDivElement;
  private specialEl: HTMLDivElement;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'selection-ui';
    this.root.style.display = 'none';

    this.header = document.createElement('div');
    this.header.className = 'selection-header';

    const panel = document.createElement('div');
    panel.className = 'selection-info-panel';

    this.nameEl = document.createElement('div');
    this.nameEl.className = 'selection-ship-name';

    this.weaponEl = document.createElement('div');
    this.weaponEl.className = 'selection-row selection-weapon';

    this.specialEl = document.createElement('div');
    this.specialEl.className = 'selection-row selection-special';

    const controls = document.createElement('div');
    controls.className = 'selection-controls';
    controls.textContent = '\u2190 \u2192 Browse  |  Enter to Select';

    panel.appendChild(this.nameEl);
    panel.appendChild(this.weaponEl);
    panel.appendChild(this.specialEl);
    panel.appendChild(controls);

    this.root.appendChild(this.header);
    this.root.appendChild(panel);
    document.body.appendChild(this.root);
  }

  show(playerNum: number, character: CharacterDef): void {
    this.header.textContent = `Player ${playerNum} \u2014 Choose Your Ship`;
    this.nameEl.textContent = character.name;
    this.weaponEl.innerHTML = `<span class="label">Weapon:</span>${character.weapon}`;
    this.specialEl.innerHTML = `<span class="label">Special:</span>${character.special}`;
    this.root.style.display = '';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  destroy(): void {
    this.root.remove();
  }
}
