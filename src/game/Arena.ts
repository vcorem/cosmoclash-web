export const ARENA = {
  // Wrap-around distances from camera center
  WRAP_X: 1500,
  WRAP_Y: 1050,

  // Camera
  CAM_BASE_Z: -100,
  CAM_MAX_Z: -3500,
  CAM_DISTANCE_SCALE: 5,
  CAM_MIN_PLAYER_DISTANCE: 50,

  // Star field
  NUM_STARS: 500,
  STARS_EXTENT: 1800,
  STARS_Z: 250,

  // Physics
  TIME_SCALER: 0.35,

  // Spawn positions
  PLAYER1_SPAWN: { x: -500, y: -70, z: 0 },
  PLAYER2_SPAWN: { x: 500, y: -70, z: 0 },
} as const;
