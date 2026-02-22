import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GameLoop } from '@/engine/GameLoop';
import { EntityManager } from '@/engine/EntityManager';
import { Player, GONDI_STATS } from '@/game/Player';
import { ARENA } from '@/game/Arena';
import { InputManager } from '@/input/InputManager';
import { createScene, createStarField, createRenderer } from '@/game/Scene';
import { createCamera, updateCamera } from '@/game/Camera';

// Setup Three.js
const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();
const stars = createStarField();
scene.add(stars);

// Resize handling
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Create player
const player = new Player(GONDI_STATS);
player.position = { ...ARENA.PLAYER1_SPAWN };

// Load Gondi model (with fallback to placeholder)
const loader = new GLTFLoader();
let playerMesh: THREE.Object3D | null = null;

loader.load(
  '/models/gondi.glb',
  (gltf) => {
    const model = gltf.scene;
    model.scale.set(1.8, 1.8, 1.8);
    scene.add(model);
    playerMesh = model;
  },
  undefined,
  () => {
    // Fallback: cone placeholder
    console.warn('Could not load gondi.glb, using placeholder');
    const geo = new THREE.ConeGeometry(8, 20, 8);
    const mat = new THREE.MeshLambertMaterial({ color: 0x00ff88 });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    playerMesh = mesh;
  }
);

// Systems
const entityManager = new EntityManager();
entityManager.add(player);
const input = new InputManager();

// Dev helper: faint arena boundary
const boundaryGeo = new THREE.EdgesGeometry(
  new THREE.PlaneGeometry(ARENA.WRAP_X * 2, ARENA.WRAP_Y * 2)
);
const boundaryMat = new THREE.LineBasicMaterial({ color: 0x333333 });
const boundary = new THREE.LineSegments(boundaryGeo, boundaryMat);
scene.add(boundary);

// Game loop
const gameLoop = new GameLoop(
  (dt: number) => {
    // Process input
    if (input.rotateLeft) {
      player.rotate(1, dt);
    } else if (input.rotateRight) {
      player.rotate(-1, dt);
    } else {
      player.resetRoll(dt);
    }

    if (input.thrust) {
      player.thrust(dt);
    }

    // Update entities
    const camCenter = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    entityManager.update(dt, camCenter);

    // Update camera to follow player
    updateCamera(camera, player.position.x, player.position.y, dt);

    // Sync mesh to player state
    if (playerMesh) {
      playerMesh.position.set(player.position.x, player.position.y, player.position.z);
      // Rotation: (0, rollAngle, angle) in original — Three.js uses radians
      const rad = Math.PI / 180;
      playerMesh.rotation.set(
        -90 * rad, // Base rotation from original model orientation
        player.rollAngle * rad,
        player.angle * rad
      );
    }

    // Move stars with camera
    stars.position.set(camera.position.x, camera.position.y, ARENA.STARS_Z);
  },
  () => {
    renderer.render(scene, camera);
  }
);

gameLoop.start();
