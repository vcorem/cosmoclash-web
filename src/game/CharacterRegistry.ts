export interface CharacterDef {
  id: string;
  name: string;
  weapon: string;
  special: string;
  modelPath: string;
  modelScale: number;
  modelRotation: [number, number, number]; // Euler angles in degrees
  isMichiGichi: boolean; // needs special MichiGichiPlayer + AnimationMixer
}

export const CHARACTER_REGISTRY: CharacterDef[] = [
  {
    id: 'michiGichi',
    name: 'MichiGichi',
    weapon: 'Plasma Blast',
    special: 'Transform between fast and weak / slow and strong',
    modelPath: '/models/michiGichi.glb',
    modelScale: 2.0,
    modelRotation: [-90, 180, 0],
    isMichiGichi: true,
  },
  {
    id: 'gondi',
    name: 'Gondi',
    weapon: 'Galactic Flame',
    special: 'Space Slime',
    modelPath: '/models/gondi.glb',
    modelScale: 1.8,
    modelRotation: [0, 270, 90],
    isMichiGichi: false,
  },
  {
    id: 'sholev',
    name: 'Sholev',
    weapon: 'Ice Cones',
    special: 'Ramming Energy',
    modelPath: '/models/sholev.glb',
    modelScale: 2.0,
    modelRotation: [-90, 0, 0],
    isMichiGichi: false,
  },
];
