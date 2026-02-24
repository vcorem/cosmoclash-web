import { CharacterDef } from '@/game/CharacterRegistry';
import './selection.css';

export class SelectionUI {
  private root: HTMLDivElement;
  private parent: HTMLElement;
  private header: HTMLDivElement;
  private nameEl: HTMLDivElement;
  private weaponLabel: HTMLSpanElement;
  private weaponValue: Text;
  private specialLabel: HTMLSpanElement;
  private specialValue: Text;
  private remainingEl: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'selection-ui';
    this.root.style.display = 'none';

    this.header = document.createElement('div');
    this.header.className = 'selection-header';

    const panel = document.createElement('div');
    panel.className = 'selection-info-panel';

    this.nameEl = document.createElement('div');
    this.nameEl.className = 'selection-ship-name';

    const weaponEl = document.createElement('div');
    weaponEl.className = 'selection-row selection-weapon';
    this.weaponLabel = document.createElement('span');
    this.weaponLabel.className = 'label';
    this.weaponLabel.textContent = 'Weapon: ';
    this.weaponValue = document.createTextNode('');
    weaponEl.appendChild(this.weaponLabel);
    weaponEl.appendChild(this.weaponValue);

    const specialEl = document.createElement('div');
    specialEl.className = 'selection-row selection-special';
    this.specialLabel = document.createElement('span');
    this.specialLabel.className = 'label';
    this.specialLabel.textContent = 'Special: ';
    this.specialValue = document.createTextNode('');
    specialEl.appendChild(this.specialLabel);
    specialEl.appendChild(this.specialValue);

    const controls = document.createElement('div');
    controls.className = 'selection-controls';
    controls.textContent = '\u2190 \u2192 Browse  |  Enter to Select';

    this.remainingEl = document.createElement('div');
    this.remainingEl.className = 'selection-remaining';
    this.remainingEl.style.display = 'none';

    panel.appendChild(this.nameEl);
    panel.appendChild(weaponEl);
    panel.appendChild(specialEl);
    panel.appendChild(this.remainingEl);
    panel.appendChild(controls);

    this.root.appendChild(this.header);
    this.root.appendChild(panel);
    this.parent = parent;
    parent.appendChild(this.root);
  }

  show(playerNum: number, character: CharacterDef): void {
    this.header.textContent = `Player ${playerNum} \u2014 Choose Your Ship`;
    this.nameEl.textContent = character.name;
    this.weaponValue.textContent = character.weapon;
    this.specialValue.textContent = character.special;
    this.root.style.display = '';
  }

  showRemaining(count: number): void {
    if (count > 0) {
      this.remainingEl.textContent = `${count} ship${count === 1 ? '' : 's'} remaining`;
      this.remainingEl.style.display = '';
    } else {
      this.remainingEl.style.display = 'none';
    }
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  destroy(): void {
    this.root.remove();
  }
}
