import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GameLoop } from '@/engine/GameLoop';
import { EntityManager } from '@/engine/EntityManager';
import { Player, GONDI_STATS } from '@/game/Player';
import { ARENA } from '@/game/Arena';
import { Bullet } from '@/game/Bullet';
import { InputManager } from '@/input/InputManager';
import { ThrustEffect } from '@/game/ThrustEffect';
import { CollisionDetector } from '@/engine/CollisionDetector';
import { CollisionHandler } from '@/game/CollisionHandler';
import { GameEventMgr } from '@/engine/GameEventMgr';
import { GameEventType } from '@/engine/GameEvent';
import { EntityType } from '@/engine/Entity';
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

// Reusable objects for per-frame rotation (avoids GC pressure)
const _qHead = new THREE.Quaternion();
const _qRoll = new THREE.Quaternion();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _fwd = new THREE.Vector3();

// Load Gondi model (with fallback to placeholder)
// The outer group receives per-frame gameplay rotation (0, rollAngle, angle).
// The inner model gets a one-time base orientation (0, 270, 90) to face +Y (up on screen).
const loader = new GLTFLoader();
let playerMesh: THREE.Object3D | null = null;
const rad = Math.PI / 180;

loader.load(
  '/models/gondi.glb',
  (gltf) => {
    const container = new THREE.Group();
    const model = gltf.scene;
    model.scale.set(1.8, 1.8, 1.8);
    model.rotation.set(0, 270 * rad, 90 * rad);
    container.add(model);
    scene.add(container);
    playerMesh = container;
  },
  undefined,
  () => {
    console.warn('Could not load gondi.glb, using placeholder');
    const container = new THREE.Group();
    const geo = new THREE.ConeGeometry(8, 20, 8);
    const mat = new THREE.MeshLambertMaterial({ color: 0x00ff88 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.set(0, 270 * rad, 90 * rad);
    container.add(mesh);
    scene.add(container);
    playerMesh = container;
  }
);

let dummyMesh: THREE.Object3D | null = null;

loader.load(
  '/models/gondi.glb',
  (gltf) => {
    const container = new THREE.Group();
    const model = gltf.scene;
    model.scale.set(1.8, 1.8, 1.8);
    model.rotation.set(0, 270 * rad, 90 * rad);
    container.add(model);
    scene.add(container);
    dummyMesh = container;
    dummyMesh.position.set(dummy.position.x, dummy.position.y, 0);
  },
  undefined,
  () => {
    console.warn('Could not load gondi.glb for dummy, using placeholder');
    const container = new THREE.Group();
    const geo = new THREE.ConeGeometry(8, 20, 8);
    const mat = new THREE.MeshLambertMaterial({ color: 0xff4444 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.set(0, 270 * rad, 90 * rad);
    container.add(mesh);
    scene.add(container);
    dummyMesh = container;
    dummyMesh.position.set(dummy.position.x, dummy.position.y, 0);
  }
);

// Load flame texture
const flameTexture = new THREE.TextureLoader().load('/textures/GondiFire.jpg');

// Bullet sprite tracking
const bulletSprites = new Map<Bullet, THREE.Sprite>();

// Thrust particle effect
const thrustTexture = new THREE.TextureLoader().load('/textures/thrust_test01.jpg');
const thrustEffect = new ThrustEffect(thrustTexture);
scene.add(thrustEffect.points);

// Systems
const entityManager = new EntityManager();
entityManager.add(player);
const input = new InputManager();

// Collision detection
const collisionDetector = new CollisionDetector();
const collisionHandler = new CollisionHandler();
GameEventMgr.getInstance().addListener(collisionHandler, GameEventType.BulletHit);
GameEventMgr.getInstance().addListener(collisionHandler, GameEventType.Collision);

// Dummy target for collision testing
const dummy = new Player(GONDI_STATS);
dummy.entityType = EntityType.Dummy;
dummy.position = { ...ARENA.PLAYER2_SPAWN };
entityManager.add(dummy);

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
      player.rotate(-1, dt);
    } else if (input.rotateRight) {
      player.rotate(1, dt);
    } else {
      player.resetRoll(dt);
    }

    if (input.thrust) {
      player.thrust(dt);
    }

    // Update thrust particles
    thrustEffect.update(dt, input.thrust, player.position.x, player.position.y, player.angle);

    // Energy & weapons
    player.updateEnergy(dt);

    if (input.firePrimary) {
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

    // Update entities
    const camCenter = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    entityManager.update(dt, camCenter);

    // Collision detection
    collisionDetector.checkCollisions(entityManager.entities);

    // Update camera to follow player
    updateCamera(camera, player.position.x, player.position.y, dt);

    // Sync mesh to player state
    if (playerMesh) {
      playerMesh.position.set(player.position.x, player.position.y, player.position.z);
      // Heading: Rz(+angle) matches physics direction (-sin(a), cos(a))
      // Roll: rotate around the ship's actual forward axis for clean banking
      const headingQ = _qHead.setFromAxisAngle(_zAxis, player.angle * rad);
      const forward = _fwd.set(0, 1, 0).applyQuaternion(headingQ);
      const rollQ = _qRoll.setFromAxisAngle(forward, player.rollAngle * rad);
      playerMesh.quaternion.copy(rollQ.multiply(headingQ));
    }

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

    // Sync dummy mesh
    if (dummyMesh) {
      if (!dummy.alive) {
        scene.remove(dummyMesh);
        dummyMesh = null;
      } else {
        dummyMesh.position.set(dummy.position.x, dummy.position.y, dummy.position.z);
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
