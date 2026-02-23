// src/game/SelectionScene.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CHARACTER_REGISTRY, CharacterDef } from './CharacterRegistry';

export enum SelectionState {
  SELECTING_P2 = 'selectingP2',
  SELECTING_P1 = 'selectingP1',
  DONE = 'done',
}

const SHIP_SPACING = 300;
const SHIP_FRONT_Z = -400;
const SHIP_BACK_Z = 400;
const FLY_DURATION = 400;
const CAM_Z = -700;
const CAM_FOV = (0.3 * 180) / Math.PI;
const BOB_SPEED = 0.1;
const rad = Math.PI / 180;

export class SelectionScene {
  state: SelectionState = SelectionState.SELECTING_P2;
  currentIndex: number = 0;
  p2CharIndex: number = 0;
  p1CharIndex: number = 0;

  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  private stars: THREE.Points;
  private shipGroups: THREE.Group[] = [];
  private loader = new GLTFLoader();
  private waveTime: number = 0;
  private flyAnims: { group: THREE.Group; startZ: number; endZ: number; elapsed: number }[] = [];
  private camFly: { startX: number; endX: number; elapsed: number } | null = null;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000011);
    const ambient = new THREE.AmbientLight(0x999999);
    this.scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(-30, 30, -20);
    this.scene.add(dirLight);

    this.camera = new THREE.PerspectiveCamera(
      CAM_FOV, window.innerWidth / window.innerHeight, 0.1, 100000,
    );
    this.camera.position.set(0, 0, CAM_Z);
    this.camera.lookAt(0, 0, 0);

    this.stars = this.createStarField();
    this.scene.add(this.stars);
    this.loadModels();
  }

  private createStarField(): THREE.Points {
    const count = 3000;
    const extent = 7000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * extent;
      positions[i * 3 + 1] = (Math.random() - 0.5) * extent;
      positions[i * 3 + 2] = 0;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0x8888ff, size: 2, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const stars = new THREE.Points(geometry, material);
    stars.position.z = 3500;
    stars.renderOrder = -1;
    return stars;
  }

  private loadModels(): void {
    CHARACTER_REGISTRY.forEach((charDef, i) => {
      const xPos = this.getShipX(i);
      const container = new THREE.Group();
      container.position.set(xPos, 0, i === 0 ? SHIP_FRONT_Z : SHIP_BACK_Z);
      this.scene.add(container);
      this.shipGroups[i] = container;

      this.loader.load(
        charDef.modelPath,
        (gltf) => {
          const model = gltf.scene.clone();
          model.scale.set(charDef.modelScale, charDef.modelScale, charDef.modelScale);
          model.rotation.set(
            charDef.modelRotation[0] * rad,
            charDef.modelRotation[1] * rad,
            charDef.modelRotation[2] * rad,
          );
          model.traverse((child: THREE.Object3D) => {
            if ((child as THREE.Mesh).isMesh) {
              const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
              if (mat.emissive) mat.emissive.set(0, 0, 0);
            }
          });
          container.add(model);
        },
        undefined,
        () => {
          const geo = new THREE.ConeGeometry(8, 20, 8);
          const mat = new THREE.MeshLambertMaterial({ color: 0x00ff88 });
          const mesh = new THREE.Mesh(geo, mat);
          container.add(mesh);
        },
      );
    });
  }

  private getShipX(index: number): number {
    const totalWidth = (CHARACTER_REGISTRY.length - 1) * SHIP_SPACING;
    return -totalWidth / 2 + index * SHIP_SPACING;
  }

  selectNext(): void {
    if (this.state === SelectionState.DONE) return;
    this.currentIndex = (this.currentIndex + 1) % CHARACTER_REGISTRY.length;
    this.triggerFlyAnimation();
  }

  selectPrev(): void {
    if (this.state === SelectionState.DONE) return;
    this.currentIndex = (this.currentIndex - 1 + CHARACTER_REGISTRY.length) % CHARACTER_REGISTRY.length;
    this.triggerFlyAnimation();
  }

  confirmSelection(): void {
    if (this.state === SelectionState.SELECTING_P2) {
      this.p2CharIndex = this.currentIndex;
      this.state = SelectionState.SELECTING_P1;
      this.currentIndex = 0;
      this.triggerFlyAnimation();
    } else if (this.state === SelectionState.SELECTING_P1) {
      this.p1CharIndex = this.currentIndex;
      this.state = SelectionState.DONE;
    }
  }

  getSelections(): { p1Def: CharacterDef; p2Def: CharacterDef } {
    return {
      p1Def: CHARACTER_REGISTRY[this.p1CharIndex],
      p2Def: CHARACTER_REGISTRY[this.p2CharIndex],
    };
  }

  getCurrentCharacter(): CharacterDef {
    return CHARACTER_REGISTRY[this.currentIndex];
  }

  private triggerFlyAnimation(): void {
    this.flyAnims = [];
    for (let i = 0; i < this.shipGroups.length; i++) {
      const group = this.shipGroups[i];
      if (!group) continue;
      const endZ = i === this.currentIndex ? SHIP_FRONT_Z : SHIP_BACK_Z;
      this.flyAnims.push({ group, startZ: group.position.z, endZ, elapsed: 0 });
    }
    const targetX = this.getShipX(this.currentIndex);
    this.camFly = { startX: this.camera.position.x, endX: targetX, elapsed: 0 };
  }

  update(dt: number): void {
    if (this.state === SelectionState.DONE) return;
    this.waveTime += BOB_SPEED * dt;

    for (const anim of this.flyAnims) {
      anim.elapsed += dt;
      const t = Math.min(anim.elapsed / FLY_DURATION, 1);
      anim.group.position.z = anim.startZ + (anim.endZ - anim.startZ) * t;
    }
    if (this.flyAnims.length > 0 && this.flyAnims[0].elapsed >= FLY_DURATION) {
      this.flyAnims = [];
    }

    if (this.camFly) {
      this.camFly.elapsed += dt;
      const t = Math.min(this.camFly.elapsed / FLY_DURATION, 1);
      this.camera.position.x = this.camFly.startX + (this.camFly.endX - this.camFly.startX) * t;
      this.camera.lookAt(this.camera.position.x, 0, 0);
      if (t >= 1) this.camFly = null;
    }

    const selGroup = this.shipGroups[this.currentIndex];
    if (selGroup && this.flyAnims.length === 0) {
      const baseX = this.getShipX(this.currentIndex);
      const wave = Math.sin((this.waveTime * Math.PI) / 180);
      selGroup.position.x = baseX + wave * 0.03;
      selGroup.position.z = SHIP_FRONT_Z + wave * 0.1;
      selGroup.rotation.set(0, 20 * wave * rad, 0);
    }

    this.stars.position.x = this.camera.position.x;
    this.stars.position.y += 5 * (dt / 1000);
  }

  dispose(): void {
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }
    this.shipGroups = [];
  }
}
