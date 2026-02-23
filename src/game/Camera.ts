import * as THREE from 'three';
import { ARENA } from './Arena';

export function createCamera(aspect = 4 / 3): THREE.PerspectiveCamera {
  const fovDegrees = (0.3 * 180) / Math.PI;
  const camera = new THREE.PerspectiveCamera(fovDegrees, aspect, 0.1, 100000);

  // Start centered between spawn points
  const midX = (ARENA.PLAYER1_SPAWN.x + ARENA.PLAYER2_SPAWN.x) / 2;
  const midY = (ARENA.PLAYER1_SPAWN.y + ARENA.PLAYER2_SPAWN.y) / 2;
  const spawnDist = Math.sqrt(
    (ARENA.PLAYER2_SPAWN.x - ARENA.PLAYER1_SPAWN.x) ** 2 +
    (ARENA.PLAYER2_SPAWN.y - ARENA.PLAYER1_SPAWN.y) ** 2
  );
  camera.position.set(midX, midY, ARENA.CAM_BASE_Z - spawnDist * ARENA.CAM_DISTANCE_SCALE);
  camera.lookAt(midX, midY, 0);

  return camera;
}

/**
 * Two-player dynamic zoom camera, ported from C++ SceneMelee::AdjustCamera.
 *
 * Tracks the midpoint between two players and smoothly zooms in/out
 * based on player separation distance.
 */
export class CameraController {
  private zoomDist: number = -1;

  reset(camera: THREE.PerspectiveCamera): void {
    this.zoomDist = -1;
    const midX = (ARENA.PLAYER1_SPAWN.x + ARENA.PLAYER2_SPAWN.x) / 2;
    const midY = (ARENA.PLAYER1_SPAWN.y + ARENA.PLAYER2_SPAWN.y) / 2;
    const spawnDist = Math.sqrt(
      (ARENA.PLAYER2_SPAWN.x - ARENA.PLAYER1_SPAWN.x) ** 2 +
      (ARENA.PLAYER2_SPAWN.y - ARENA.PLAYER1_SPAWN.y) ** 2,
    );
    camera.position.set(midX, midY, ARENA.CAM_BASE_Z - spawnDist * ARENA.CAM_DISTANCE_SCALE);
    camera.lookAt(midX, midY, 0);
  }

  update(
    camera: THREE.PerspectiveCamera,
    p1x: number, p1y: number,
    p2x: number, p2y: number,
    dt: number,
    immediate: boolean = false,
  ): void {
    // Midpoint between players
    const midX = (p1x + p2x) / 2;
    const midY = (p1y + p2y) / 2;

    if (immediate) {
      // Snap camera XY to midpoint (skip smooth lerp) — used after player wrap
      camera.position.x = midX;
      camera.position.y = midY;
    } else {
      // Smooth camera position toward midpoint
      const dx = midX - camera.position.x;
      const dy = midY - camera.position.y;
      const distToCam = Math.sqrt(dx * dx + dy * dy);

      if (distToCam > 0.01) {
        const moveLen = Math.min(dt * distToCam * 0.005, distToCam);
        camera.position.x += (dx / distToCam) * moveLen;
        camera.position.y += (dy / distToCam) * moveLen;
      }
    }

    // Player separation distance (2D)
    const pdx = p2x - p1x;
    const pdy = p2y - p1y;
    const playerDist = Math.sqrt(pdx * pdx + pdy * pdy);

    // Smooth zoom with exponential averaging (400ms time constant)
    if (this.zoomDist < 0) {
      this.zoomDist = playerDist;
    } else {
      const avgr = 400 / dt;
      this.zoomDist = (this.zoomDist * (avgr - 1) / avgr) + (playerDist / avgr);
    }

    // Clamp minimum distance
    let dist = this.zoomDist;
    if (dist < ARENA.CAM_MIN_PLAYER_DISTANCE) {
      dist = ARENA.CAM_MIN_PLAYER_DISTANCE;
    }

    // Calculate Z from distance
    let z = ARENA.CAM_BASE_Z - dist * ARENA.CAM_DISTANCE_SCALE;
    if (z < ARENA.CAM_MAX_Z) {
      z = ARENA.CAM_MAX_Z;
    }

    camera.position.z = z;
    camera.lookAt(camera.position.x, camera.position.y, 0);
  }
}
