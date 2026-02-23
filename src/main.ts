import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GameLoop } from '@/engine/GameLoop';
import { EntityManager } from '@/engine/EntityManager';
import { Player, GONDI_STATS } from '@/game/Player';
import { MichiGichiPlayer } from '@/game/MichiGichiPlayer';
import { ARENA } from '@/game/Arena';
import { Bullet, BulletConfig, FLAME_BULLET_CONFIG, PLASMA_BULLET_CONFIG, SUN_BULLET_CONFIG } from '@/game/Bullet';
import { Entity, EntityType } from '@/engine/Entity';
import { EntityPool } from '@/engine/EntityPool';
import { InputManager, PlayerInput } from '@/input/InputManager';
import { ThrustEffect } from '@/game/ThrustEffect';
import { CollisionDetector } from '@/engine/CollisionDetector';
import { CollisionHandler, enforceMinimumDistance } from '@/game/CollisionHandler';
import { GameEventMgr, GameEventListener } from '@/engine/GameEventMgr';
import { GameEvent, GameEventType, ExplosionEvent } from '@/engine/GameEvent';
import { Explosion } from '@/game/Explosion';
import { createScene, createStarField, createRenderer } from '@/game/Scene';
import { createCamera, CameraController } from '@/game/Camera';
import { Sun } from '@/game/Sun';
import { applySunGravity } from '@/game/Gravity';
import { Snot, SNOT_CONFIG } from '@/game/Snot';
import { Asteroid } from '@/game/Asteroid';
import { HUD } from '@/ui/HUD';
import '@/ui/hud.css';

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
const player1 = new MichiGichiPlayer();
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
let p1Mixer: THREE.AnimationMixer | null = null;
let p1AnimAction: THREE.AnimationAction | null = null;

// Load MichiGichi model with animation for Player 1
loader.load(
  '/models/michiGichi.glb',
  (gltf) => {
    const container = new THREE.Group();
    const model = gltf.scene.clone();
    model.scale.set(2.0, 2.0, 2.0);
    model.rotation.set(-90 * rad, Math.PI, 0);
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (mat.emissive) mat.emissive.set(0, 0, 0);
      }
    });
    container.add(model);
    scene.add(container);
    p1Mesh = container;

    if (gltf.animations.length > 0) {
      p1Mixer = new THREE.AnimationMixer(model);
      const clip = gltf.animations[0];
      p1AnimAction = p1Mixer.clipAction(clip);
      p1AnimAction.play();
      p1AnimAction.paused = true;
    }
  },
  undefined,
  () => {
    console.warn('Could not load michiGichi.glb, using placeholder');
    const container = new THREE.Group();
    const geo = new THREE.ConeGeometry(8, 20, 8);
    const mat = new THREE.MeshLambertMaterial({ color: 0xff8800 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.set(0, 270 * rad, 90 * rad);
    container.add(mesh);
    scene.add(container);
    p1Mesh = container;
  },
);

// Load Gondi model for Player 2 (unchanged)
loadShipModel((mesh) => {
  p2Mesh = mesh;
  mesh.position.set(player2.position.x, player2.position.y, 0);
}, 0x00ff88);

// Load flame texture
const flameTexture = new THREE.TextureLoader().load('/textures/GondiFire.jpg');
let plasmaAtlasImage: HTMLImageElement | null = null;
new THREE.TextureLoader().load('/textures/plasma_atlas.png', (tex) => {
  plasmaAtlasImage = tex.image as HTMLImageElement;
});
const sunShotTexture = new THREE.TextureLoader().load('/textures/sun_shot.png');

// Bullet pool with sprite management
const BULLET_POOL_SIZE = 50;
const bulletPool = new EntityPool<Bullet>(
  () => new Bullet(FLAME_BULLET_CONFIG),
  () => { /* reset called per-acquire with specific config */ },
  BULLET_POOL_SIZE,
);
const bulletSpriteMap = new Map<Bullet, THREE.Sprite>();

function acquireBullet(config: BulletConfig, origin: Entity, target?: Entity): Bullet {
  const bullet = bulletPool.acquire();
  bullet.reset(config, origin);
  if (config.tracking && target) {
    bullet.trackingTarget = target;
  }
  if (config === PLASMA_BULLET_CONFIG) {
    bullet.animFrame = 0;
    bullet.animSpeed = 0.4;
  }

  if (!bulletSpriteMap.has(bullet)) {
    const mat = new THREE.SpriteMaterial({
      map: flameTexture,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    const sprite = new THREE.Sprite(mat);
    bulletSpriteMap.set(bullet, sprite);
  }
  const sprite = bulletSpriteMap.get(bullet)!;

  const mat = sprite.material as THREE.SpriteMaterial;
  if (config === PLASMA_BULLET_CONFIG && plasmaAtlasImage) {
    const tex = new THREE.Texture(plasmaAtlasImage);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.repeat.set(1 / 10, 1 / 8);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    mat.map = tex;
    sprite.scale.set(50, 50, 1);
  } else if (config === SUN_BULLET_CONFIG) {
    mat.map = sunShotTexture;
    sprite.scale.set(10, 10, 1);
  } else {
    mat.map = flameTexture;
    sprite.scale.set(35, 35, 1);
  }
  mat.needsUpdate = true;

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

const SNOT_POOL_SIZE = 80;
const snotPool = new EntityPool<Snot>(
  () => new Snot(player1, player2),
  () => { /* reset called per-acquire */ },
  SNOT_POOL_SIZE,
);
const snotSpriteMap = new Map<Snot, { sprite: THREE.Sprite; texture: THREE.Texture }>();

function acquireSnot(origin: Entity, target: Player): Snot {
  const snot = snotPool.acquire();
  snot.resetSnot(origin, target);
  if (!snotSpriteMap.has(snot)) {
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
    snotSpriteMap.set(snot, { sprite, texture: mat.map! });
  }
  const { sprite } = snotSpriteMap.get(snot)!;
  sprite.visible = true;
  scene.add(sprite);
  return snot;
}

// Explosion sprites — animated billboard with sprite sheet atlas
const EXPL_ATLAS_COLS = ARENA.EXPLOSION_ATLAS_COLS;
const EXPL_ATLAS_ROWS = ARENA.EXPLOSION_ATLAS_ROWS;

const explosionTexture = new THREE.TextureLoader().load('/textures/explosion_atlas.png');
explosionTexture.repeat.set(1 / EXPL_ATLAS_COLS, 1 / EXPL_ATLAS_ROWS);
explosionTexture.wrapS = THREE.RepeatWrapping;
explosionTexture.wrapT = THREE.RepeatWrapping;

const EXPLOSION_POOL_SIZE = 15;
const explosionPool = new EntityPool<Explosion>(
  () => new Explosion(),
  (e) => e.reset(),
  EXPLOSION_POOL_SIZE,
);
const explosionSpriteMap = new Map<Explosion, THREE.Sprite>();

function spawnExplosion(x: number, y: number, z: number, entityType: EntityType): void {
  const expl = explosionPool.acquire();
  expl.position = { x, y, z };
  expl.previousPosition = { x, y, z };

  if (!explosionSpriteMap.has(expl)) {
    const mat = new THREE.SpriteMaterial({
      map: explosionTexture.clone(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    mat.map!.repeat.set(1 / EXPL_ATLAS_COLS, 1 / EXPL_ATLAS_ROWS);
    mat.map!.wrapS = THREE.RepeatWrapping;
    mat.map!.wrapT = THREE.RepeatWrapping;
    const sprite = new THREE.Sprite(mat);
    explosionSpriteMap.set(expl, sprite);
  }
  const sprite = explosionSpriteMap.get(expl)!;
  const size = entityType === EntityType.Asteroid
    ? ARENA.EXPLOSION_ASTEROID_BILLBOARD_SIZE
    : ARENA.EXPLOSION_BILLBOARD_SIZE;
  sprite.scale.set(size, size, 1);
  sprite.visible = true;
  scene.add(sprite);
}

// Asteroid pool with 3D mesh management
const asteroidPool = new EntityPool<Asteroid>(
  () => new Asteroid(0),
  () => { /* reset called per-acquire with specific type */ },
  ARENA.ASTEROID_COUNT,
);
const asteroidMeshMap = new Map<Asteroid, THREE.Group>();

// Load asteroid glTF models (3 types)
const asteroidModels: THREE.Group[] = [];
let asteroidModelsLoaded = 0;

function loadAsteroidModels(onAllLoaded: () => void): void {
  for (let i = 0; i < 3; i++) {
    const filename = `/models/asteroid0${i + 1}.glb`;
    loader.load(
      filename,
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(
          ARENA.ASTEROID_MESH_SCALE,
          ARENA.ASTEROID_MESH_SCALE,
          ARENA.ASTEROID_MESH_SCALE,
        );
        // Fix materials converted from Irrlicht Blinn-Phong to Three.js PBR:
        // Original models have emissiveFactor 0.7 which washes out textures in PBR
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
            mat.emissive.set(0, 0, 0);
          }
        });
        asteroidModels[i] = model;
        asteroidModelsLoaded++;
        if (asteroidModelsLoaded === 3) onAllLoaded();
      },
      undefined,
      () => {
        console.warn(`Could not load ${filename}, using placeholder`);
        const geo = new THREE.IcosahedronGeometry(ARENA.ASTEROID_COLLISION_RADII[i], 1);
        const mat = new THREE.MeshLambertMaterial({ color: 0x888888 });
        const mesh = new THREE.Mesh(geo, mat);
        const group = new THREE.Group();
        group.add(mesh);
        asteroidModels[i] = group;
        asteroidModelsLoaded++;
        if (asteroidModelsLoaded === 3) onAllLoaded();
      },
    );
  }
}

function spawnAsteroids(): void {
  for (let i = 0; i < ARENA.ASTEROID_COUNT; i++) {
    const type = Math.floor(Math.random() * 3);
    const asteroid = asteroidPool.acquire();
    asteroid.reset(type);
    asteroid.position = {
      x: ARENA.WRAP_X - Math.random() * ARENA.WRAP_X * 2,
      y: ARENA.WRAP_Y - Math.random() * ARENA.WRAP_Y * 2,
      z: 0,
    };
    asteroid.previousPosition = { ...asteroid.position };

    const meshClone = asteroidModels[type].clone();
    meshClone.position.set(asteroid.position.x, asteroid.position.y, 0);
    scene.add(meshClone);
    asteroidMeshMap.set(asteroid, meshClone);
  }
}

loadAsteroidModels(() => {
  spawnAsteroids();
});

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

// HUD overlay
const hud = new HUD();

// Game state
type GameState = 'playing' | 'gameOver';
let gameState: GameState = 'playing';
let winnerNum: 1 | 2 = 1;
let gameOverDelay = 0;
const GAME_OVER_DELAY_MS = 1500;

// Collision detection
const collisionDetector = new CollisionDetector();
const collisionHandler = new CollisionHandler();
GameEventMgr.getInstance().addListener(collisionHandler, GameEventType.BulletHit);
GameEventMgr.getInstance().addListener(collisionHandler, GameEventType.Collision);
GameEventMgr.getInstance().addListener(collisionHandler, GameEventType.SunCollision);
GameEventMgr.getInstance().addListener(collisionHandler, GameEventType.SnotHit);

const explosionListener: GameEventListener = {
  onGameEvent(event: GameEvent) {
    if (event.type === GameEventType.Explosion) {
      const e = (event as ExplosionEvent).entity;
      spawnExplosion(e.position.x, e.position.y, e.position.z, e.entityType);
    }
  },
};
GameEventMgr.getInstance().addListener(explosionListener, GameEventType.Explosion);

// Dev helper: faint arena boundary
const boundaryGeo = new THREE.EdgesGeometry(
  new THREE.PlaneGeometry(ARENA.WRAP_X * 2, ARENA.WRAP_Y * 2)
);
const boundaryMat = new THREE.LineBasicMaterial({ color: 0x333333 });
const boundary = new THREE.LineSegments(boundaryGeo, boundaryMat);
scene.add(boundary);

// Debug: press 1/2 to instantly kill player 1/2 with explosion
window.addEventListener('keydown', (e) => {
  if (gameState !== 'playing') return;
  const target = e.key === '1' ? player1 : e.key === '2' ? player2 : null;
  if (target && target.alive) {
    target.health = 0;
    target.destroy();
    GameEventMgr.getInstance().sendEvent(new ExplosionEvent(target));
  }
});

// Restart round on any key during gameOver
window.addEventListener('keydown', (e) => {
  if (gameState !== 'gameOver') return;
  if (gameOverDelay < GAME_OVER_DELAY_MS) return;

  // Reset players and re-add to EntityManager exactly once
  // (removeDeadEntities() only removed the dead player; the survivor is still in the list)
  player1.resetForNewRound({ ...ARENA.PLAYER1_SPAWN });
  player2.resetForNewRound({ ...ARENA.PLAYER2_SPAWN });
  entityManager.entities = entityManager.entities.filter(e => e !== player1 && e !== player2);
  entityManager.add(player1);
  entityManager.add(player2);

  // Clear all pools
  bulletPool.releaseAll();
  snotPool.releaseAll();
  explosionPool.releaseAll();

  // Clear and respawn asteroids
  asteroidPool.releaseAll();
  for (const [, mesh] of asteroidMeshMap) {
    mesh.visible = false;
    scene.remove(mesh);
  }
  asteroidMeshMap.clear();
  if (asteroidModelsLoaded === 3) spawnAsteroids();

  // Hide bullet/snot/explosion sprites
  for (const [, sprite] of bulletSpriteMap) {
    sprite.visible = false;
    scene.remove(sprite);
  }
  for (const [, { sprite }] of snotSpriteMap) {
    sprite.visible = false;
    scene.remove(sprite);
  }
  for (const [, sprite] of explosionSpriteMap) {
    sprite.visible = false;
    scene.remove(sprite);
  }

  // Reset camera zoom
  cameraController.reset(camera);

  // Reset game state
  hud.hide();
  gameState = 'playing';
});

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

      const bullet = acquireBullet(player.stats.primaryBulletConfig, player, enemy);
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
    if (player instanceof MichiGichiPlayer) {
      player.triggerMorph();
    } else {
      if (player.secondaryCooldown <= 0 && player.energy > player.stats.primaryEnergyCost) {
        player.energy -= player.stats.primaryEnergyCost;
        player.secondaryCooldown = ARENA.SECONDARY_WEAPON_DELAY;

        const snot = acquireSnot(player, enemy);
        snot.angle = player.angle;

        const spawnVec = player.getFullSpeedVec(25);
        snot.position = {
          x: player.position.x + spawnVec.x,
          y: player.position.y + spawnVec.y,
          z: player.position.z,
        };
        snot.previousPosition = { ...snot.position };
        const speedVec = player.getFullSpeedVec(SNOT_CONFIG.speedMaxScaler);
        snot.accelVec = { ...speedVec };
      }
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
    const camCenter = { x: camera.position.x, y: camera.position.y, z: camera.position.z };

    if (gameState === 'playing') {
      // Collision detection FIRST (matches original C++ loop order)
      const allEntities = [
        ...entityManager.entities,
        ...bulletPool.activeEntities,
        ...snotPool.activeEntities,
        ...asteroidPool.activeEntities,
      ];
      collisionDetector.checkCollisions(allEntities);
      enforceMinimumDistance(player1, player2);

      // Process input for both players
      updatePlayerInput(player1, player2, input.player(0), thrustEffect1, dt);
      updatePlayerInput(player2, player1, input.player(1), thrustEffect2, dt);

      if (player1 instanceof MichiGichiPlayer) {
        player1.updateMorph(dt);
      }

      // Update entities
      entityManager.update(dt, camCenter);

      // Update pooled bullets
      bulletPool.forEachActive((bullet) => {
        bullet.update(dt);
        bullet.handleWrapAround(camCenter);
      });

      // Update pooled snots
      snotPool.forEachActive((snot) => {
        snot.update(dt);
        snot.handleWrapAround(camCenter);
      });

      // Update pooled asteroids
      asteroidPool.forEachActive((asteroid) => {
        asteroid.update(dt);
        asteroid.handleWrapAround(camCenter);
      });

      // Sun gravity — applied to players only (matches original C++)
      applySunGravity(player1, ARENA.SUN_POSITION, dt);
      applySunGravity(player2, ARENA.SUN_POSITION, dt);

      // Winner detection
      if (!player1.alive || !player2.alive) {
        gameState = 'gameOver';
        winnerNum = player1.alive ? 1 : 2;
        gameOverDelay = 0;
      }
    } else {
      // gameOver: accumulate delay, show winner after explosion
      gameOverDelay += dt;
      if (gameOverDelay >= GAME_OVER_DELAY_MS) {
        hud.showWinner(winnerNum);
      }
    }

    // --- Always runs regardless of game state ---

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
    if (p1Mesh) p1Mesh.visible = player1.alive;
    if (p2Mesh) p2Mesh.visible = player2.alive;

    // Sync MichiGichi morph animation frame
    if (p1Mixer && p1AnimAction && player1 instanceof MichiGichiPlayer) {
      const clip = p1AnimAction.getClip();
      p1AnimAction.time = (player1.currentAnimFrame / 42) * clip.duration;
      p1Mixer.update(0);
    }

    // Sync bullet sprites and release dead ones
    bulletPool.forEachActive((bullet) => {
      const sprite = bulletSpriteMap.get(bullet);
      if (!sprite) return;
      sprite.position.set(bullet.position.x, bullet.position.y, bullet.position.z);

      if (bullet.config === PLASMA_BULLET_CONFIG) {
        // Advance animation: m_curTex += m_AnimSpeed * dt (matching C++ Render)
        bullet.animFrame += bullet.animSpeed * dt;
        if (bullet.animFrame > 41) {
          bullet.animSpeed = 0.03; // slow loop after fade-in
        }
        if (bullet.animFrame > 79) {
          bullet.animFrame = 41; // loop back to frame 41
        }

        // UV offset into 10x8 atlas
        const mat = sprite.material as THREE.SpriteMaterial;
        if (mat.map) {
          const fi = Math.min(Math.floor(bullet.animFrame), 79);
          const col = fi % 10;
          const row = Math.floor(fi / 10);
          mat.map.offset.set(col / 10, 1 - (row + 1) / 8);
        }

        // Billboard size: curScale = max(20, elapsed / 60) (C++ line 117-120)
        const elapsed = bullet.config.maxTtl - bullet.ttl;
        const size = Math.max(20, elapsed / 60.0);
        sprite.scale.set(size, size, 1);
      }
    });
    bulletPool.releaseInactive();
    for (const [bullet, sprite] of bulletSpriteMap) {
      if (!bullet.alive) {
        sprite.visible = false;
        scene.remove(sprite);
      }
    }

    // Sync snot sprites
    snotPool.forEachActive((snot) => {
      const entry = snotSpriteMap.get(snot);
      if (!entry) return;
      const { sprite, texture } = entry;
      sprite.position.set(snot.position.x, snot.position.y, snot.position.z);
      const frameIndex = Math.floor(snot.currentFrame);
      const sCol = frameIndex % SNOT_ATLAS_COLS;
      const sRow = Math.floor(frameIndex / SNOT_ATLAS_COLS);
      texture.offset.set(sCol / SNOT_ATLAS_COLS, 1 - (sRow + 1) / SNOT_ATLAS_ROWS);
    });
    snotPool.releaseInactive();
    for (const [snot, { sprite }] of snotSpriteMap) {
      if (!snot.alive) {
        sprite.visible = false;
        scene.remove(sprite);
      }
    }

    // Update explosions (always — so death animation plays during gameOver)
    explosionPool.forEachActive((expl) => {
      expl.update(dt);
      expl.handleWrapAround(camCenter);
    });

    // Sync explosion sprites
    explosionPool.forEachActive((expl) => {
      const sprite = explosionSpriteMap.get(expl);
      if (!sprite) return;
      sprite.position.set(expl.position.x, expl.position.y, expl.position.z);
      const eFrameIndex = Math.floor(expl.currentFrame);
      const eCol = eFrameIndex % EXPL_ATLAS_COLS;
      const eRow = Math.floor(eFrameIndex / EXPL_ATLAS_COLS);
      (sprite.material as THREE.SpriteMaterial).map!.offset.set(
        eCol / EXPL_ATLAS_COLS,
        1 - (eRow + 1) / EXPL_ATLAS_ROWS,
      );
    });
    explosionPool.releaseInactive();
    for (const [expl, sprite] of explosionSpriteMap) {
      if (!expl.alive) {
        sprite.visible = false;
        scene.remove(sprite);
      }
    }

    // Sync asteroid meshes
    asteroidPool.forEachActive((asteroid) => {
      const mesh = asteroidMeshMap.get(asteroid);
      if (!mesh) return;
      mesh.position.set(asteroid.position.x, asteroid.position.y, asteroid.position.z);
      mesh.rotation.set(
        asteroid.curXAngle * rad,
        asteroid.curYAngle * rad,
        0,
      );
    });
    asteroidPool.releaseInactive();
    for (const [asteroid, mesh] of asteroidMeshMap) {
      if (!asteroid.alive) {
        mesh.visible = false;
        scene.remove(mesh);
      }
    }

    entityManager.removeDeadEntities();

    // Parallax: stars scroll at 80% of camera speed for depth effect
    stars.position.set(camera.position.x * 0.8, camera.position.y * 0.8, ARENA.STARS_Z);

    // HUD update every frame
    hud.update(player1.health, player1.energy, player2.health, player2.energy);
  },
  () => {
    renderer.render(scene, camera);
  }
);

gameLoop.start();
