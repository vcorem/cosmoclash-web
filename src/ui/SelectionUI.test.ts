import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SelectionUI } from './SelectionUI';

describe('SelectionUI', () => {
  let ui: SelectionUI;

  beforeEach(() => {
    ui = new SelectionUI();
  });

  afterEach(() => {
    ui.destroy();
  });

  it('creates root element in DOM', () => {
    expect(document.getElementById('selection-ui')).not.toBeNull();
  });

  it('displays player number in header', () => {
    ui.show(2, { id: 'gondi', name: 'Gondi', weapon: 'Galactic Flame', special: 'Space Slime', modelPath: '/models/gondi.glb', modelScale: 1.8, modelRotation: [0, 270, 90], isMichiGichi: false });
    const header = document.querySelector('.selection-header');
    expect(header?.textContent).toContain('Player 2');
  });

  it('displays character info', () => {
    ui.show(1, { id: 'michiGichi', name: 'MichiGichi', weapon: 'Plasma Blast', special: 'Transform between fast and weak / slow and strong', modelPath: '/models/michiGichi.glb', modelScale: 2.0, modelRotation: [-90, 180, 0], isMichiGichi: true });
    const name = document.querySelector('.selection-ship-name');
    const weapon = document.querySelector('.selection-weapon');
    const special = document.querySelector('.selection-special');
    expect(name?.textContent).toContain('MichiGichi');
    expect(weapon?.textContent).toContain('Plasma Blast');
    expect(special?.textContent).toContain('Transform');
  });

  it('hide removes visibility', () => {
    ui.show(1, { id: 'gondi', name: 'Gondi', weapon: 'Galactic Flame', special: 'Space Slime', modelPath: '/models/gondi.glb', modelScale: 1.8, modelRotation: [0, 270, 90], isMichiGichi: false });
    ui.hide();
    const root = document.getElementById('selection-ui');
    expect(root?.style.display).toBe('none');
  });

  it('destroy removes element from DOM', () => {
    ui.destroy();
    expect(document.getElementById('selection-ui')).toBeNull();
  });
});
