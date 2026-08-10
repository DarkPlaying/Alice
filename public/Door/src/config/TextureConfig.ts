export const TextureConfig = {
  // --- WALL CONFIGURATION & PIXEL SIZE ---
  USE_WALL_IMAGE: true,             // Set to true to use WALL_IMAGE, or false to use WALL_COLOR
  WALL_IMAGE: '/image1.png',        // Path to custom wall image
  WALL_COLOR: '#ffffff',            // Hex color when USE_WALL_IMAGE is false
  WALL_PIXEL_WIDTH: 1120,           // Wall resolution width in pixels (e.g. 1120px)
  WALL_PIXEL_HEIGHT: 628,           // Wall resolution height in pixels (e.g. 628px)

  // --- CEILING CONFIGURATION & PIXEL SIZE ---
  USE_CEILING_IMAGE: true,          // Set to true to use CEILING_IMAGE, or false to use CEILING_COLOR
  CEILING_IMAGE: '/image1.png',     // Path to custom ceiling image
  CEILING_COLOR: '#ffffff',         // Hex color when USE_CEILING_IMAGE is false
  CEILING_PIXEL_WIDTH: 1120,        // Ceiling resolution width in pixels (e.g. 1120px)
  CEILING_PIXEL_HEIGHT: 628,        // Ceiling resolution height in pixels (e.g. 628px)

  // --- FLOOR CONFIGURATION & PIXEL SIZE ---
  USE_FLOOR_IMAGE: true,            // Set to true to use FLOOR_IMAGE, or false to use FLOOR_COLOR
  FLOOR_IMAGE: '/image1.png',       // Path to custom floor image
  FLOOR_COLOR: '',                  // Hex color when USE_FLOOR_IMAGE is false
  FLOOR_PIXEL_WIDTH: 1120,          // Floor resolution width in pixels (e.g. 1120px)
  FLOOR_PIXEL_HEIGHT: 628,          // Floor resolution height in pixels (e.g. 628px)

  // --- DOOR CONFIGURATION & PIXEL SIZE ---
  USE_DOOR_IMAGE: true,             // Set to true to use DOOR_IMAGE, or false to use DOOR_COLOR
  DOOR_IMAGE: 'specialcard_joker/game.png', // Path to custom door image texture
  DOOR_COLOR: '#0f172a',            // Hex color when USE_DOOR_IMAGE is false
  DOOR_PIXEL_WIDTH: 1696,           // Door resolution width in pixels (e.g. 1696px)
  DOOR_PIXEL_HEIGHT: 2516,          // Door resolution height in pixels (e.g. 2516px)

  // --- ARCHITECTURAL BORDER LINES ---
  ENABLE_BORDER_LINES: true,        // Set to true to display architectural edge border lines
  BORDER_LINE_COLOR: '#475569',     // Slate gray color for subtle edge definition
  BORDER_LINE_OPACITY: 0.5,         // Opacity (0.1 - 1.0) for border lines
  BORDER_LINE_THICKNESS: 0.04,      // Border line thickness in meters (0.04 = 4cm)

  // --- BORDERS, PILLARS & DOORS ---
  SHOW_CORNER_PILLARS: false,       // Set to false to remove corner pillars completely
  SHOW_DOOR_FRAME: false,           // Set to false to remove dark door frames for seamless artwork
  PILLAR_COLOR: '#334155',          // Hex color for corner pillars
  BACKGROUND_COLOR: '#000000'       // Scene background color to eliminate seam border shadows
};
