import * as THREE from 'three';
import { ARENA } from './Arena';

export function createCamera(): THREE.PerspectiveCamera {
  // FOV 0.3 radians = ~17.19 degrees
  const fovDegrees = (0.3 * 180) / Math.PI;
  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.PerspectiveCamera(fovDegrees, aspect, 0.1, 100000);

  // Start at a reasonable zoom for single player
  camera.position.set(
    ARENA.PLAYER1_SPAWN.x,
    ARENA.PLAYER1_SPAWN.y,
    ARENA.CAM_BASE_Z - 200 * ARENA.CAM_DISTANCE_SCALE
  );
  camera.lookAt(ARENA.PLAYER1_SPAWN.x, ARENA.PLAYER1_SPAWN.y, 0);

  return camera;
}

export function updateCamera(
  camera: THREE.PerspectiveCamera,
  targetX: number,
  targetY: number,
  dt: number
): void {
  // Smooth camera follow
  const dx = targetX - camera.position.x;
  const dy = targetY - camera.position.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len > 0.01) {
    const speed = len * 0.005 * dt;
    const move = Math.min(speed, len);
    camera.position.x += (dx / len) * move;
    camera.position.y += (dy / len) * move;
  }

  camera.lookAt(camera.position.x, camera.position.y, 0);
}
