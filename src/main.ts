import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GameLoop } from '@/engine/GameLoop';
import { EntityManager } from '@/engine/EntityManager';
import { Player, GONDI_STATS } from '@/game/Player';
import { ARENA } from '@/game/Arena';
import { Bullet } from '@/game/Bullet';
import { InputManager, PlayerInput } from '@/input/InputManager';
import { ThrustEffect } from '@/game/ThrustEffect';
import { CollisionDetector } from '@/engine/CollisionDetector';
import { CollisionHandler, enforceMinimumDistance } from '@/game/CollisionHandler';
import { GameEventMgr } from '@/engine/GameEventMgr';
import { GameEventType } from '@/engine/GameEvent';
import { createScene, createStarField, createRenderer } from '@/game/Scene';
import { createCamera, CameraController } from '@/game/Camera';

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

// Create players
const player1 = new Player(GONDI_STATS);
player1.position = { ...ARENA.PLAYER1_SPAWN };
player1.previousPosition = { ...ARENA.PLAYER1_SPAWN };

const player2 = new Player(GONDI_STATS);
player2.position = { ...ARENA.PLAYER2_SPAWN };
player2.previousPosition = { ...ARENA.PLAYER2_SPAWN };

// Reusable objects for per-frame rotation (avoids GC pressure)
const _qHead = new THREE.Quaternion();
const _qRoll = new THREE.Quaternion();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _fwd = new THREE.Vector3();

// Load ship models
const loader = new GLTFLoader();
const rad = Math.PI / 180;

function loadShipModel(
  onLoaded: (mesh: THREE.Object3D) => void,
  placeholderColor: number = 0x00ff88,
): void {
  loader.load(
    '/models/gondi.glb',
    (gltf) => {
      const container = new THREE.Group();
      const model = gltf.scene.clone();
      model.scale.set(1.8, 1.8, 1.8);
      model.rotation.set(0, 270 * rad, 90 * rad);
      container.add(model);
      scene.add(container);
      onLoaded(container);
    },
    undefined,
    () => {
      console.warn('Could not load gondi.glb, using placeholder');
      const container = new THREE.Group();
      const geo = new THREE.ConeGeometry(8, 20, 8);
      const mat = new THREE.MeshLambertMaterial({ color: placeholderColor });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.set(0, 270 * rad, 90 * rad);
      container.add(mesh);
      scene.add(container);
      onLoaded(container);
    },
  );
}

let p1Mesh: THREE.Object3D | null = null;
let p2Mesh: THREE.Object3D | null = null;

loadShipModel((mesh) => { p1Mesh = mesh; }, 0x00ff88);
loadShipModel((mesh) => {
  p2Mesh = mesh;
  mesh.position.set(player2.position.x, player2.position.y, 0);
}, 0x00ff88);

// Load flame texture
const flameTexture = new THREE.TextureLoader().load('/textures/GondiFire.jpg');

// Bullet sprite tracking
const bulletSprites = new Map<Bullet, THREE.Sprite>();

// Thrust particle effects (one per player)
const thrustTexture = new THREE.TextureLoader().load('/textures/thrust_test01.jpg');
const thrustEffect1 = new ThrustEffect(thrustTexture);
const thrustEffect2 = new ThrustEffect(thrustTexture);
scene.add(thrustEffect1.points);
scene.add(thrustEffect2.points);

// Systems
const entityManager = new EntityManager();
entityManager.add(player1);
entityManager.add(player2);
const input = new InputManager();
const cameraController = new CameraController();

// Collision detection
const collisionDetector = new CollisionDetector();
const collisionHandler = new CollisionHandler();
GameEventMgr.getInstance().addListener(collisionHandler, GameEventType.BulletHit);
GameEventMgr.getInstance().addListener(collisionHandler, GameEventType.Collision);

// Dev helper: faint arena boundary
const boundaryGeo = new THREE.EdgesGeometry(
  new THREE.PlaneGeometry(ARENA.WRAP_X * 2, ARENA.WRAP_Y * 2)
);
const boundaryMat = new THREE.LineBasicMaterial({ color: 0x333333 });
const boundary = new THREE.LineSegments(boundaryGeo, boundaryMat);
scene.add(boundary);

// Per-player update helper
function updatePlayerInput(
  player: Player,
  pi: PlayerInput,
  thrustEffect: ThrustEffect,
  dt: number,
): void {
  // Rotation
  if (pi.rotateLeft) {
    player.rotate(-1, dt);
  } else if (pi.rotateRight) {
    player.rotate(1, dt);
  } else {
    player.resetRoll(dt);
  }

  // Thrust
  if (pi.thrust) {
    player.thrust(dt);
  }

  // Thrust particles
  thrustEffect.update(dt, pi.thrust, player.position.x, player.position.y, player.angle);

  // Energy & weapons
  player.updateEnergy(dt);

  if (pi.firePrimary) {
    const bullet = player.firePrimary();
    if (bullet) {
      entityManager.add(bullet);
      const mat = new THREE.SpriteMaterial({
        map: flameTexture,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(35, 35, 1);
      scene.add(sprite);
      bulletSprites.set(bullet, sprite);
    }
  }
}

// Sync mesh to player physics state
function syncMesh(mesh: THREE.Object3D | null, player: Player): void {
  if (!mesh) return;
  mesh.position.set(player.position.x, player.position.y, player.position.z);
  const headingQ = _qHead.setFromAxisAngle(_zAxis, player.angle * rad);
  const forward = _fwd.set(0, 1, 0).applyQuaternion(headingQ);
  const rollQ = _qRoll.setFromAxisAngle(forward, player.rollAngle * rad);
  mesh.quaternion.copy(rollQ.multiply(headingQ));
}

// Game loop
const gameLoop = new GameLoop(
  (dt: number) => {
    // Collision detection FIRST (matches original C++ loop order).
    // Running before input/movement means deflected velocities are already
    // set when thrust is applied, preventing ships from re-entering overlap.
    collisionDetector.checkCollisions(entityManager.entities);
    enforceMinimumDistance(player1, player2);

    // Process input for both players
    updatePlayerInput(player1, input.player(0), thrustEffect1, dt);
    updatePlayerInput(player2, input.player(1), thrustEffect2, dt);

    // Update entities
    const camCenter = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    entityManager.update(dt, camCenter);

    // Update camera to track both players
    cameraController.update(
      camera,
      player1.position.x, player1.position.y,
      player2.position.x, player2.position.y,
      dt,
    );

    // Sync meshes
    syncMesh(p1Mesh, player1);
    syncMesh(p2Mesh, player2);

    // Sync bullet sprites and remove dead ones
    for (const [bullet, sprite] of bulletSprites) {
      if (!bullet.alive) {
        scene.remove(sprite);
        sprite.material.dispose();
        bulletSprites.delete(bullet);
      } else {
        sprite.position.set(bullet.position.x, bullet.position.y, bullet.position.z);
      }
    }

    entityManager.removeDeadEntities();

    // Parallax: stars scroll at 80% of camera speed for depth effect
    stars.position.set(camera.position.x * 0.8, camera.position.y * 0.8, ARENA.STARS_Z);
  },
  () => {
    renderer.render(scene, camera);
  }
);

gameLoop.start();
