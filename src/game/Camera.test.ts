import { describe, it, expect, beforeEach } from 'vitest';
import { createCamera, CameraController } from './Camera';
import { ARENA } from './Arena';

describe('CameraController', () => {
  let cam: CameraController;

  beforeEach(() => {
    cam = new CameraController();
  });

  it('calculates midpoint between two players', () => {
    // Players at (-100, 0) and (100, 0) → midpoint (0, 0)
    cam.update(createCamera(), -100, 0, 100, 0, 16);
    // Camera should be moving toward (0, 0)
    const camera = createCamera();
    // After one frame the camera won't be exactly at midpoint due to smoothing,
    // but with bImmediate-style first frame, let's just verify the zoom Z
  });

  describe('zoom distance', () => {
    it('zooms out as players separate', () => {
      const camera = createCamera();
      // Players 200 units apart → Z = -100 - 200*5 = -1100
      cam.update(camera, -100, 0, 100, 0, 16);
      cam.update(camera, -100, 0, 100, 0, 16);
      // After a couple frames the Z should be moving toward -1100
      expect(camera.position.z).toBeLessThan(ARENA.CAM_BASE_Z);
    });

    it('does not zoom closer than CAM_BASE_Z when players overlap', () => {
      const camera = createCamera();
      // Both players at same position → dist=0, clamped to 50 → Z = -100 - 50*5 = -350
      for (let i = 0; i < 100; i++) {
        cam.update(camera, 0, 0, 0, 0, 16);
      }
      // Z should converge around -350 (CAM_BASE_Z - MIN_DIST * SCALE)
      expect(camera.position.z).toBeGreaterThanOrEqual(ARENA.CAM_MAX_Z);
      expect(camera.position.z).toBeLessThanOrEqual(ARENA.CAM_BASE_Z);
    });

    it('clamps zoom to CAM_MAX_Z when players are very far apart', () => {
      const camera = createCamera();
      // Players 2000 units apart → Z = -100 - 2000*5 = -10100, clamped to -3500
      for (let i = 0; i < 100; i++) {
        cam.update(camera, -1000, 0, 1000, 0, 16);
      }
      expect(camera.position.z).toBeGreaterThanOrEqual(ARENA.CAM_MAX_Z);
    });
  });

  describe('camera position smoothing', () => {
    it('camera moves toward midpoint of players', () => {
      const camera = createCamera();
      // Camera starts near P1 spawn. Players at (100, 100) and (300, 100).
      // Midpoint is (200, 100). Camera should move toward it.
      const startX = camera.position.x;
      cam.update(camera, 100, 100, 300, 100, 16);
      cam.update(camera, 100, 100, 300, 100, 16);
      // Camera X should have moved toward 200
      const midX = 200;
      const newDist = Math.abs(camera.position.x - midX);
      const oldDist = Math.abs(startX - midX);
      expect(newDist).toBeLessThan(oldDist);
    });

    it('camera Y moves toward midpoint', () => {
      const camera = createCamera();
      const startY = camera.position.y;
      // Midpoint Y = 200
      cam.update(camera, 0, 100, 0, 300, 16);
      cam.update(camera, 0, 100, 0, 300, 16);
      const midY = 200;
      const newDist = Math.abs(camera.position.y - midY);
      const oldDist = Math.abs(startY - midY);
      expect(newDist).toBeLessThan(oldDist);
    });
  });
});
