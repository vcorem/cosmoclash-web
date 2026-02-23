// src/ui/DifficultyUI.ts
// Difficulty selection overlay — appears after main menu, before character selection.
// Same HTML/CSS overlay pattern as MainMenu and SelectionUI.

import './difficulty.css';

const LABELS = ['Easy', 'Medium', 'Hard'] as const;

export class DifficultyUI {
  private root: HTMLDivElement;
  private options: HTMLDivElement[] = [];
  private selectedIndex = 1; // Default to Medium
  private onSelect: (level: 1 | 2 | 3) => void;

  constructor(parent: HTMLElement, onSelect: (level: 1 | 2 | 3) => void) {
    this.onSelect = onSelect;

    this.root = document.createElement('div');
    this.root.id = 'difficulty-screen';

    const title = document.createElement('div');
    title.className = 'difficulty-title';
    title.textContent = 'Select Difficulty';
    this.root.appendChild(title);

    const list = document.createElement('div');
    list.className = 'difficulty-list';

    for (let i = 0; i < LABELS.length; i++) {
      const opt = document.createElement('div');
      opt.className = 'difficulty-option';
      opt.textContent = LABELS[i];
      opt.addEventListener('click', () => {
        this.selectedIndex = i;
        this.updateHighlight();
        this.confirm();
      });
      list.appendChild(opt);
      this.options.push(opt);
    }

    this.root.appendChild(list);

    const hint = document.createElement('div');
    hint.className = 'difficulty-hint';
    hint.textContent = 'Arrow Keys to select · Enter to confirm';
    this.root.appendChild(hint);

    parent.appendChild(this.root);
    this.updateHighlight();
  }

  handleKey(key: string): void {
    if (key === 'ArrowUp') {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.updateHighlight();
    } else if (key === 'ArrowDown') {
      this.selectedIndex = Math.min(2, this.selectedIndex + 1);
      this.updateHighlight();
    } else if (key === 'Enter') {
      this.confirm();
    }
  }

  private confirm(): void {
    this.onSelect((this.selectedIndex + 1) as 1 | 2 | 3);
  }

  private updateHighlight(): void {
    for (let i = 0; i < this.options.length; i++) {
      if (i === this.selectedIndex) {
        this.options[i].classList.add('selected');
      } else {
        this.options[i].classList.remove('selected');
      }
    }
  }

  destroy(): void {
    this.root.remove();
  }
}
