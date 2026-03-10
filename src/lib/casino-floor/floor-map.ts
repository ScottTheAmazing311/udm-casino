// Top-down tile size: 32px source tiles scaled for mobile
export const TILE_SIZE = 32;
export const TILE_SCALE = 1.5; // mobile-friendly zoom
export const SCALED_TILE = TILE_SIZE * TILE_SCALE; // 48px per tile

// Tile types
export enum TileType {
  EMPTY = 0,
  FLOOR_BLUE = 1,
  FLOOR_BLUE_ALT = 2,
  FLOOR_RED = 3,
  FLOOR_ACCENT = 4,
  WALL_TOP = 10,
  WALL_LEFT = 11,
  WALL_CORNER_TL = 12,
  WALL_BOTTOM = 13,
  WALL_RIGHT = 14,
  WALL_STRIP = 15,
  BAR = 20,
  SLOT_MACHINE = 21,
  PLANT = 22,
  CHAIR = 23,
  FLOWER = 24,
  RAILING = 25,
  LAMP = 26,
  BAR_CURVE = 27,
  BLACKJACK_TABLE = 30,
  POKER_TABLE = 31,
  CRAPS_TABLE = 32,
  ROULETTE_TABLE = 33,
  DOOR = 40,
}

// 17x16 map matching the reference pixel art casino floor
// WS=wall-strip, WT=wall-top, WB=wall-bottom, F=blue floor, FA=floor-alt
// R=red carpet, RL=railing, SL=slot, PK=poker, BJ=blackjack
// CR=craps, RT=roulette, LP=lamp, BC=bar-curve, DR=door
export const FLOOR_MAP: number[][] = [
  // Row 0: Top border
  [15, 15, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 15, 15],
  // Row 1: Red carpet top edge + blue floor
  [15,  1,  3,  3,  3,  3,  3,  3,  1,  1,  1,  1,  1,  1,  1,  1, 15],
  // Row 2: Red area with railings | poker table anchor | bar
  [10,  1,  3, 25, 25, 25, 25,  3,  1,  1, 31,  4,  4,  4,  1, 27, 10],
  // Row 3: Red interior with railings | poker body
  [15,  1,  3, 25,  3,  3, 25,  3,  1,  1,  4,  4,  4,  4,  1, 27, 15],
  // Row 4: Red interior with railings | poker body
  [15,  1,  3, 25,  3,  3, 25,  3,  1,  1,  4,  4,  4,  4,  1,  1, 15],
  // Row 5: Red area with slot machines
  [10,  1,  3, 25, 21, 21, 25,  3,  1,  1,  1,  1,  1,  1,  1,  1, 10],
  // Row 6: Red carpet bottom edge
  [15,  1,  3,  3,  3,  3,  3,  3,  1,  1,  1,  1,  1,  1,  1,  1, 15],
  // Row 7: Open blue floor
  [15,  1,  2,  1,  2,  1,  2,  1,  2,  1,  2,  1,  2,  1,  2,  1, 15],
  // Row 8: Lamp | BJ table anchors
  [10,  1,  1,  1, 26,  1,  1,  1,  1,  1, 30,  4,  1, 30,  4,  1, 10],
  // Row 9: BJ table body
  [15,  1,  1,  1,  1,  1,  1,  1,  1,  1,  4,  4,  1,  4,  4,  1, 15],
  // Row 10: Open blue floor
  [15,  1,  2,  1,  2,  1,  2,  1,  2,  1,  2,  1,  2,  1,  2,  1, 15],
  // Row 11: Craps anchor | Roulette anchor
  [10,  1,  1, 32,  4,  4,  1,  1,  1, 33,  4,  4,  4,  1,  1,  1, 10],
  // Row 12: Table bodies
  [15,  1,  1,  4,  4,  4,  1,  1,  1,  4,  4,  4,  4,  1,  1,  1, 15],
  // Row 13: Open blue floor
  [15,  1,  2,  1,  2,  1,  2,  1,  2,  1,  2,  1,  2,  1,  2,  1, 15],
  // Row 14: Near door
  [15,  1,  1,  1,  1,  1,  1,  1, 40, 40,  1,  1,  1,  1,  1,  1, 15],
  // Row 15: Bottom border
  [15, 15, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 15, 15],
];

// Walkable tiles
const WALKABLE = new Set([
  TileType.FLOOR_BLUE,
  TileType.FLOOR_BLUE_ALT,
  TileType.FLOOR_RED,
  TileType.FLOOR_ACCENT,
  TileType.DOOR,
]);

export function isWalkable(x: number, y: number): boolean {
  if (y < 0 || y >= FLOOR_MAP.length || x < 0 || x >= FLOOR_MAP[0].length) return false;
  return WALKABLE.has(FLOOR_MAP[y][x]);
}

// Top-down: grid coords → pixel coords
export function gridToScreen(gx: number, gy: number): { x: number; y: number } {
  return {
    x: gx * SCALED_TILE + SCALED_TILE / 2,
    y: gy * SCALED_TILE + SCALED_TILE / 2,
  };
}

// Screen coords → grid coords
export function screenToGrid(sx: number, sy: number): { x: number; y: number } {
  return {
    x: Math.floor(sx / SCALED_TILE),
    y: Math.floor(sy / SCALED_TILE),
  };
}

// Aliases for compatibility
export const gridToIso = gridToScreen;
export const isoToGrid = screenToGrid;

// Table positions → casino table mapping
export interface FloorTableLink {
  tileX: number;
  tileY: number;
  tableIndex: number;
  gameType: string;
  label: string;
}

export const FLOOR_TABLE_LINKS: FloorTableLink[] = [
  { tileX: 11, tileY: 8,  tableIndex: 0, gameType: "blackjack", label: "Blackjack 1" },
  { tileX: 14, tileY: 8,  tableIndex: 1, gameType: "blackjack", label: "Blackjack 2" },
  { tileX: 12, tileY: 3,  tableIndex: 2, gameType: "poker",     label: "Hold'em 1" },
  { tileX: 4,  tileY: 11, tableIndex: 3, gameType: "craps",     label: "Craps 1" },
  { tileX: 11, tileY: 11, tableIndex: 4, gameType: "craps",     label: "Roulette 1" },
];

// Spawn near the door
export const SPAWN_POINT = { x: 9, y: 13 };
