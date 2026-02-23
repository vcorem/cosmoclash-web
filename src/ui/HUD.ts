export const SEGMENT_COUNT = 40;

export interface RGB {
  r: number;
  g: number;
  b: number;
}

// Original C++ colors from PlayerPanel.cpp
export const HEALTH_COLOR_FULL: RGB = { r: 250, g: 50, b: 50 };
export const HEALTH_COLOR_EMPTY: RGB = { r: 120, g: 10, b: 10 };
export const ENERGY_COLOR_FULL: RGB = { r: 40, g: 80, b: 250 };
export const ENERGY_COLOR_EMPTY: RGB = { r: 10, g: 20, b: 120 };
export const SEGMENT_INACTIVE_COLOR: RGB = { r: 40, g: 40, b: 40 };

export function computeActiveSegments(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return Math.round(clamped * SEGMENT_COUNT);
}

export function computeSegmentColor(index: number, full: RGB, empty: RGB): RGB {
  const t = index / (SEGMENT_COUNT - 1);
  return {
    r: Math.round(full.r + (empty.r - full.r) * t),
    g: Math.round(full.g + (empty.g - full.g) * t),
    b: Math.round(full.b + (empty.b - full.b) * t),
  };
}

export class HUD {
  private root: HTMLDivElement;
  private p1HealthSegs: HTMLDivElement[] = [];
  private p1EnergySegs: HTMLDivElement[] = [];
  private p2HealthSegs: HTMLDivElement[] = [];
  private p2EnergySegs: HTMLDivElement[] = [];
  private overlay: HTMLDivElement;
  private winText: HTMLDivElement;
  private restartText: HTMLDivElement;

  // Pre-computed color strings per segment index
  private healthColors: string[] = [];
  private energyColors: string[] = [];

  constructor() {
    // Pre-compute gradient colors
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const hc = computeSegmentColor(i, HEALTH_COLOR_FULL, HEALTH_COLOR_EMPTY);
      this.healthColors[i] = `rgb(${hc.r},${hc.g},${hc.b})`;
      const ec = computeSegmentColor(i, ENERGY_COLOR_FULL, ENERGY_COLOR_EMPTY);
      this.energyColors[i] = `rgb(${ec.r},${ec.g},${ec.b})`;
    }

    this.root = document.createElement('div');
    this.root.id = 'hud';

    // Player panels
    const p1Panel = this.createPanel('left', this.p1HealthSegs, this.p1EnergySegs);
    const p2Panel = this.createPanel('right', this.p2HealthSegs, this.p2EnergySegs);
    this.root.appendChild(p1Panel);
    this.root.appendChild(p2Panel);

    // Win/lose overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'hud-overlay';
    this.overlay.style.display = 'none';

    this.winText = document.createElement('div');
    this.winText.className = 'hud-win-text';
    this.overlay.appendChild(this.winText);

    this.restartText = document.createElement('div');
    this.restartText.className = 'hud-restart-text';
    this.restartText.textContent = 'Press any key to restart';
    this.overlay.appendChild(this.restartText);

    this.root.appendChild(this.overlay);
    document.body.appendChild(this.root);
  }

  private createPanel(
    side: 'left' | 'right',
    healthSegs: HTMLDivElement[],
    energySegs: HTMLDivElement[],
  ): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = `player-panel ${side}`;

    // Health row
    const healthRow = document.createElement('div');
    healthRow.className = 'bar-row';
    const healthIcon = document.createElement('img');
    healthIcon.className = 'bar-icon';
    healthIcon.src = '/textures/heart.png';
    healthIcon.alt = 'Health';
    healthRow.appendChild(healthIcon);
    const healthBar = document.createElement('div');
    healthBar.className = 'bar-container';
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const seg = document.createElement('div');
      seg.className = 'bar-segment';
      healthBar.appendChild(seg);
      healthSegs.push(seg);
    }
    healthRow.appendChild(healthBar);

    // Energy row
    const energyRow = document.createElement('div');
    energyRow.className = 'bar-row';
    const energyIcon = document.createElement('img');
    energyIcon.className = 'bar-icon';
    energyIcon.src = '/textures/power.png';
    energyIcon.alt = 'Energy';
    energyRow.appendChild(energyIcon);
    const energyBar = document.createElement('div');
    energyBar.className = 'bar-container';
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const seg = document.createElement('div');
      seg.className = 'bar-segment';
      energyBar.appendChild(seg);
      energySegs.push(seg);
    }
    energyRow.appendChild(energyBar);

    panel.appendChild(healthRow);
    panel.appendChild(energyRow);
    return panel;
  }

  update(p1Health: number, p1Energy: number, p2Health: number, p2Energy: number): void {
    this.updateBar(this.p1HealthSegs, p1Health, this.healthColors, false);
    this.updateBar(this.p1EnergySegs, p1Energy, this.energyColors, true);
    this.updateBar(this.p2HealthSegs, p2Health, this.healthColors, false);
    this.updateBar(this.p2EnergySegs, p2Energy, this.energyColors, true);
  }

  private updateBar(
    segs: HTMLDivElement[],
    value: number,
    colors: string[],
    useDecay: boolean,
  ): void {
    const active = computeActiveSegments(value);
    const inactiveColor = `rgb(${SEGMENT_INACTIVE_COLOR.r},${SEGMENT_INACTIVE_COLOR.g},${SEGMENT_INACTIVE_COLOR.b})`;
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      if (i < active) {
        segs[i].style.backgroundColor = colors[i];
        if (useDecay) segs[i].classList.remove('decaying');
      } else {
        if (useDecay) {
          segs[i].style.backgroundColor = '';  // Remove inline style so CSS class takes over
          segs[i].classList.add('decaying');
        } else {
          segs[i].style.backgroundColor = inactiveColor;
        }
      }
    }
  }

  showWinner(playerNum: 1 | 2): void {
    this.winText.textContent = `Player ${playerNum} Wins!`;
    this.overlay.style.display = 'flex';
  }

  hide(): void {
    this.overlay.style.display = 'none';
  }

  destroy(): void {
    this.root.remove();
  }
}
