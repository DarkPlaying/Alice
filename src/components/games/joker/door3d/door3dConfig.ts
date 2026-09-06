// Standardized 3D Labyrinth Architecture & Collision Constants
export const DOOR_3D_CONFIG = {
  // Standard Room Dimensions (Meters)
  ROOM_SIZE: 16.0,
  ROOM_HEIGHT: 8.0,
  WALL_THICKNESS: 0.4,

  // Standard Anime Spaceship Door Dimensions (4.15m x 4.60m)
  DOOR_WIDTH: 4.15,
  DOOR_HEIGHT: 4.60,
  DOOR_DEPTH: 0.36,

  // Pass-Through Corridor Dimensions
  CORRIDOR_WIDTH: 2.6, // Pass-through size matching increased door width

  // Mathematical Centers for Floating Special Cards (Exact geometric center of destination rooms)
  CENTER_CARD_DIST_STANDARD: 16.0, // Exact geometric center of Destination Room 1 behind door (Z = -16.0)
  CENTER_CARD_DIST_SKIP: 32.0,     // Exact geometric center of Destination Room 2 behind skip door (Z = -32.0)

  // Player Collision Limits
  PLAYER_HEIGHT: 1.6,
  PLAYER_ROOM_BOUND: 7.4,          // ROOM_SIZE/2 (8.0) - 0.6 thick solid wall block buffer
  PLAYER_CORRIDOR_HALF_WIDTH: 0.75, // Slim center doorway pass-through width
  SKIP_MAX_DEPTH: 39.4,            // Total Z depth for full destination room movement
};
