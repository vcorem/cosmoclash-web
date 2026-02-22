import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GameLoop } from '@/engine/GameLoop';
import { EntityManager } from '@/engine/EntityManager';
import { Player, GONDI_STATS } from '@/game/Player';
import { ARENA } from '@/game/Arena';
import { Bullet, BulletConfig, FLAME_BULLET_CONFIG } from '@/game/Bullet';
import { Entity } from '@/engine/Entity';
import { EntityPool } from '@/engine/EntityPool';
import { InputManager, PlayerInput } from '@/input/InputManager';
import { ThrustEffect } from '@/game/ThrustEffect';
import { CollisionDetector } from '@/engine/CollisionDetector';
import { CollisionHandler, enforceMinimumDistance } from '@/game/CollisionHandler';
import { GameEventMgr } from '@/engine/GameEventMgr';
import { GameEventType } from '@/engine/GameEvent';
import { createScene, createStarField, createRenderer } from '@/game/Scene';
import { createCamera, CameraController } from '@/game/Camera';
import { Sun } from '@/game/Sun';
import { applySunGravity } from '@/game/Gravity';
import { Snot } from '@/game/Snot';

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

// Create sun
const sun = new Sun();

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

// Bullet pool with sprite management
const BULLET_POOL_SIZE = 50;
const bulletPool = new EntityPool<Bullet>(
  () => new Bullet(FLAME_BULLET_CONFIG),
  () => { /* reset called per-acquire with specific config */ },
  BULLET_POOL_SIZE,
);
const bulletSpriteMap = new Map<Bullet, THREE.Sprite>();

function acquireBullet(config: BulletConfig, origin: Entity): Bullet {
  const bullet = bulletPool.acquire();
  bullet.reset(config, origin);
  if (!bulletSpriteMap.has(bullet)) {
    const mat = new THREE.SpriteMaterial({
      map: flameTexture,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(35, 35, 1);
    bulletSpriteMap.set(bullet, sprite);
  }
  const sprite = bulletSpriteMap.get(bullet)!;
  sprite.visible = true;
  scene.add(sprite);
  return bullet;
}

// Thrust particle effects (one per player)
const thrustTexture = new THREE.TextureLoader().load('/textures/thrust_test01.jpg');
const thrustEffect1 = new ThrustEffect(thrustTexture);
const thrustEffect2 = new ThrustEffect(thrustTexture);
scene.add(thrustEffect1.points);
scene.add(thrustEffect2.points);

// Sun mesh — animated sphere with sprite sheet atlas
const SUN_ATLAS_COLS = 8;
const SUN_ATLAS_ROWS = 8;

const sunTexture = new THREE.TextureLoader().load('/textures/sun_atlas.jpg');
sunTexture.repeat.set(1 / SUN_ATLAS_COLS, 1 / SUN_ATLAS_ROWS);
sunTexture.wrapS = THREE.RepeatWrapping;
sunTexture.wrapT = THREE.RepeatWrapping;

const sunGeo = new THREE.SphereGeometry(65, 32, 32);
const sunMat = new THREE.MeshBasicMaterial({
  map: sunTexture,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
sunMesh.rotation.x = -90 * rad;
sunMesh.position.set(ARENA.SUN_POSITION.x, ARENA.SUN_POSITION.y, ARENA.SUN_POSITION.z);
scene.add(sunMesh);

// Sun glow — large additive billboard behind the sphere
const glowCanvas = document.createElement('canvas');
glowCanvas.width = 128;
glowCanvas.height = 128;
const glowCtx = glowCanvas.getContext('2d')!;
const gradient = glowCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
gradient.addColorStop(0, 'rgba(255, 80, 0, 0.6)');
gradient.addColorStop(0.4, 'rgba(255, 30, 0, 0.2)');
gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
glowCtx.fillStyle = gradient;
glowCtx.fillRect(0, 0, 128, 128);
const glowTexture = new THREE.CanvasTexture(glowCanvas);
const glowMat = new THREE.SpriteMaterial({
  map: glowTexture,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  transparent: true,
});
const sunGlow = new THREE.Sprite(glowMat);
sunGlow.scale.set(300, 300, 1);
sunGlow.position.set(ARENA.SUN_POSITION.x, ARENA.SUN_POSITION.y, ARENA.SUN_POSITION.z);
scene.add(sunGlow);

// Snot sprites — animated billboard with sprite sheet atlas
const SNOT_ATLAS_COLS = ARENA.SNOT_ATLAS_COLS;
const SNOT_ATLAS_ROWS = ARENA.SNOT_ATLAS_ROWS;

const snotTexture = new THREE.TextureLoader().load('/textures/snot_atlas.png');
snotTexture.repeat.set(1 / SNOT_ATLAS_COLS, 1 / SNOT_ATLAS_ROWS);
snotTexture.wrapS = THREE.RepeatWrapping;
snotTexture.wrapT = THREE.RepeatWrapping;

const snotSprites = new Map<Snot, { sprite: THREE.Sprite; texture: THREE.Texture }>();

// Sun point light
const sunLight = new THREE.PointLight(0xff0000, 2, 1500);
sunLight.position.set(ARENA.SUN_POSITION.x, ARENA.SUN_POSITION.y, ARENA.SUN_POSITION.z);
scene.add(sunLight);

// Systems
const entityManager = new EntityManager();
entityManager.add(player1);
entityManager.add(player2);
entityManager.add(sun);
const input = new InputManager();
const cameraController = new CameraController();

// Collision detection
const collisionDetector = new CollisionDetector();
const collisionHandler = new CollisionHandler();
GameEventMgr.getInstance().addListener(collisionHandler, GameEventType.BulletHit);
GameEventMgr.getInstance().addListener(collisionHandler, GameEventType.Collision);
GameEventMgr.getInstance().addListener(collisionHandler, GameEventType.SunCollision);
GameEventMgr.getInstance().addListener(collisionHandler, GameEventType.SnotHit);

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
  enemy: Player,
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
    if (player.primaryCooldown <= 0 && player.energy > player.stats.primaryEnergyCost) {
      player.energy -= player.stats.primaryEnergyCost;
      player.primaryCooldown = player.stats.primaryWeaponDelay;

      const bullet = acquireBullet(player.stats.primaryBulletConfig, player);
      bullet.angle = player.angle;

      const spawnVec = player.getFullSpeedVec(25);
      bullet.position = {
        x: player.position.x + spawnVec.x,
        y: player.position.y + spawnVec.y,
        z: player.position.z,
      };
      bullet.previousPosition = { ...bullet.position };
      const speedVec = player.getFullSpeedVec(player.stats.primaryBulletConfig.speedMaxScaler);
      bullet.accelVec = { ...speedVec };
    }
  }

  if (pi.fireSecondary) {
    const snot = player.fireSecondary(enemy);
    if (snot) {
      entityManager.add(snot);
      const mat = new THREE.SpriteMaterial({
        map: snotTexture.clone(),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      });
      mat.map!.repeat.set(1 / SNOT_ATLAS_COLS, 1 / SNOT_ATLAS_ROWS);
      mat.map!.wrapS = THREE.RepeatWrapping;
      mat.map!.wrapT = THREE.RepeatWrapping;
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(ARENA.SNOT_BILLBOARD_SIZE, ARENA.SNOT_BILLBOARD_SIZE, 1);
      scene.add(sprite);
      snotSprites.set(snot, { sprite, texture: mat.map! });
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
    const allEntities = [
      ...entityManager.entities,
      ...bulletPool.activeEntities,
    ];
    collisionDetector.checkCollisions(allEntities);
    enforceMinimumDistance(player1, player2);

    // Process input for both players
    updatePlayerInput(player1, player2, input.player(0), thrustEffect1, dt);
    updatePlayerInput(player2, player1, input.player(1), thrustEffect2, dt);

    // Update entities
    const camCenter = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    entityManager.update(dt, camCenter);

    // Update pooled bullets
    bulletPool.forEachActive((bullet) => {
      bullet.update(dt);
      bullet.handleWrapAround(camCenter);
    });

    // Sun gravity — applied to players only (matches original C++)
    applySunGravity(player1, ARENA.SUN_POSITION, dt);
    applySunGravity(player2, ARENA.SUN_POSITION, dt);

    // Sun gravity on snots in flight
    for (const [snot] of snotSprites) {
      if (!snot.attached) {
        applySunGravity(snot, ARENA.SUN_POSITION, dt);
      }
    }

    // Sun animation
    sun.updateAnimation(dt);
    const frameIndex = Math.floor(sun.currentFrame);
    const col = frameIndex % SUN_ATLAS_COLS;
    const row = Math.floor(frameIndex / SUN_ATLAS_COLS);
    sunTexture.offset.set(col / SUN_ATLAS_COLS, 1 - (row + 1) / SUN_ATLAS_ROWS);

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

    // Sync bullet sprites and release dead ones
    bulletPool.forEachActive((bullet) => {
      const sprite = bulletSpriteMap.get(bullet);
      if (!sprite) return;
      sprite.position.set(bullet.position.x, bullet.position.y, bullet.position.z);
    });
    bulletPool.releaseInactive();
    for (const [bullet, sprite] of bulletSpriteMap) {
      if (!bullet.alive) {
        sprite.visible = false;
        scene.remove(sprite);
      }
    }

    // Sync snot sprites: update position and animation frame
    for (const [snot, { sprite, texture }] of snotSprites) {
      if (!snot.alive) {
        scene.remove(sprite);
        (sprite.material as THREE.SpriteMaterial).dispose();
        texture.dispose();
        snotSprites.delete(snot);
      } else {
        sprite.position.set(snot.position.x, snot.position.y, snot.position.z);
        // Update atlas frame
        const frameIndex = Math.floor(snot.currentFrame);
        const col = frameIndex % SNOT_ATLAS_COLS;
        const row = Math.floor(frameIndex / SNOT_ATLAS_COLS);
        texture.offset.set(col / SNOT_ATLAS_COLS, 1 - (row + 1) / SNOT_ATLAS_ROWS);
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
