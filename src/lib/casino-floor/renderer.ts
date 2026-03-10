import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  Texture,
} from "pixi.js";
import {
  FLOOR_MAP,
  SCALED_TILE,
  TileType,
  gridToScreen,
  screenToGrid,
  FLOOR_TABLE_LINKS,
} from "./floor-map";
import { findPath } from "./pathfinding";

const TILE_ASSETS: Record<string, string> = {
  carpetBlue:      "/tiles/carpet-blue.png",
  carpetBlueAlt:   "/tiles/carpet-blue-alt.png",
  carpetRed:       "/tiles/carpet-red.png",
  carpetRedAlt:    "/tiles/carpet-red-alt.png",
  wallDark:        "/tiles/wall-dark.png",
  wallStrip:       "/tiles/wall-strip.png",
  tablePoker:      "/tiles/table-poker.png",
  tableBjLeft:     "/tiles/table-bj-left.png",
  tableBjRight:    "/tiles/table-bj-right.png",
  tableRoulette:   "/tiles/table-roulette.png",
  tableRoulette2:  "/tiles/table-roulette2.png",
  slotMachine:     "/tiles/slot-machine.png",
  slotMachine2:    "/tiles/slot-machine-2.png",
  plant:           "/tiles/plant.png",
  flower:          "/tiles/flower.png",
  lampTall:        "/tiles/lamp-tall.png",
  railing:         "/tiles/railing.png",
  barCounter:      "/tiles/bar-counter.png",
  barPost:         "/tiles/bar-post.png",
  entrance:        "/tiles/entrance.png",
};

interface AvatarSprite {
  container: Container;
  gridX: number;
  gridY: number;
  targetPath: Array<{ x: number; y: number }>;
  pathIndex: number;
  walking: boolean;
  playerId: number;
  bobPhase: number;
}

export class CasinoRenderer {
  app: Application;
  worldContainer: Container;
  floorContainer: Container;
  objectContainer: Container;
  avatarContainer: Container;
  labelContainer: Container;
  avatars: Map<number, AvatarSprite> = new Map();
  camera = { x: 0, y: 0 };
  dragging = false;
  dragStart = { x: 0, y: 0 };
  dragCameraStart = { x: 0, y: 0 };
  onTableClick?: (tableIndex: number) => void;
  onFloorClick?: (gx: number, gy: number) => void;
  width = 0;
  height = 0;
  private textures: Record<string, Texture> = {};

  constructor() {
    this.app = new Application();
    this.worldContainer = new Container();
    this.floorContainer = new Container();
    this.objectContainer = new Container();
    this.avatarContainer = new Container();
    this.labelContainer = new Container();
  }

  async init(canvas: HTMLCanvasElement, width: number, height: number) {
    this.width = width;
    this.height = height;

    await this.app.init({
      canvas,
      width,
      height,
      backgroundColor: 0x060610,
      antialias: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });

    // Load all tile textures
    const entries = Object.entries(TILE_ASSETS);
    const loaded = await Promise.all(
      entries.map(async ([key, path]) => {
        try {
          const tex = await Assets.load<Texture>(path);
          return [key, tex] as const;
        } catch {
          console.warn(`Failed to load: ${path}`);
          return [key, null] as const;
        }
      })
    );
    for (const [key, tex] of loaded) {
      if (tex) this.textures[key] = tex;
    }

    this.worldContainer.addChild(this.floorContainer);
    this.worldContainer.addChild(this.objectContainer);
    this.worldContainer.addChild(this.avatarContainer);
    this.worldContainer.addChild(this.labelContainer);
    this.app.stage.addChild(this.worldContainer);

    this.renderFloor();
    this.renderObjects();
    this.renderTableLabels();
    this.setupInteraction();
    this.centerCamera();

    this.app.ticker.add(() => this.updateAvatars());
  }

  private spr(key: string, x: number, y: number, w: number, h: number): Sprite | null {
    const tex = this.textures[key];
    if (!tex) return null;
    const s = new Sprite(tex);
    s.x = x;
    s.y = y;
    s.width = w;
    s.height = h;
    return s;
  }

  centerCamera() {
    const mapW = FLOOR_MAP[0].length * SCALED_TILE;
    const mapH = FLOOR_MAP.length * SCALED_TILE;
    this.camera.x = this.width / 2 - mapW / 2;
    this.camera.y = this.height / 2 - mapH / 2;
    this.worldContainer.x = this.camera.x;
    this.worldContainer.y = this.camera.y;
  }

  renderFloor() {
    for (let y = 0; y < FLOOR_MAP.length; y++) {
      for (let x = 0; x < FLOOR_MAP[y].length; x++) {
        const tile = FLOOR_MAP[y][x];
        if (tile === TileType.EMPTY) continue;

        const px = x * SCALED_TILE;
        const py = y * SCALED_TILE;
        let texKey: string;
        let fallbackColor = 0x0d1830;

        switch (tile) {
          case TileType.FLOOR_BLUE:
            texKey = "carpetBlue";
            break;
          case TileType.FLOOR_BLUE_ALT:
            texKey = "carpetBlueAlt";
            break;
          case TileType.FLOOR_RED:
            texKey = (x + y) % 2 === 0 ? "carpetRed" : "carpetRedAlt";
            break;
          case TileType.FLOOR_ACCENT:
            // Accent tiles under tables - use blue carpet
            texKey = (x + y) % 2 === 0 ? "carpetBlue" : "carpetBlueAlt";
            break;
          case TileType.WALL_TOP:
          case TileType.WALL_LEFT:
          case TileType.WALL_CORNER_TL:
          case TileType.WALL_BOTTOM:
          case TileType.WALL_RIGHT:
            texKey = "wallDark";
            fallbackColor = 0x1a1220;
            break;
          case TileType.WALL_STRIP:
            texKey = "wallStrip";
            fallbackColor = 0x12091a;
            break;
          case TileType.DOOR:
            texKey = "carpetBlue";
            break;
          // Object tiles still need a floor underneath
          case TileType.SLOT_MACHINE:
          case TileType.RAILING:
            texKey = (x + y) % 2 === 0 ? "carpetRed" : "carpetRedAlt";
            break;
          case TileType.LAMP:
          case TileType.PLANT:
          case TileType.FLOWER:
          case TileType.BLACKJACK_TABLE:
          case TileType.POKER_TABLE:
          case TileType.CRAPS_TABLE:
          case TileType.ROULETTE_TABLE:
            texKey = (x + y) % 2 === 0 ? "carpetBlue" : "carpetBlueAlt";
            break;
          case TileType.BAR:
          case TileType.BAR_CURVE:
            texKey = (x + y) % 2 === 0 ? "carpetBlue" : "carpetBlueAlt";
            break;
          default:
            texKey = "carpetBlue";
            break;
        }

        const s = this.spr(texKey, px, py, SCALED_TILE, SCALED_TILE);
        if (s) {
          this.floorContainer.addChild(s);
        } else {
          const g = new Graphics();
          g.rect(px, py, SCALED_TILE, SCALED_TILE);
          g.fill(fallbackColor);
          this.floorContainer.addChild(g);
        }
      }
    }
  }

  renderObjects() {
    for (let y = 0; y < FLOOR_MAP.length; y++) {
      for (let x = 0; x < FLOOR_MAP[y].length; x++) {
        const tile = FLOOR_MAP[y][x];
        const px = x * SCALED_TILE;
        const py = y * SCALED_TILE;

        switch (tile) {
          case TileType.POKER_TABLE: {
            // Large poker table - spans ~4x3 tiles from anchor
            // poker.png is a big oval table with chairs
            const w = SCALED_TILE * 4.5;
            const h = SCALED_TILE * 3;
            const ox = px - SCALED_TILE * 0.25;
            const oy = py - SCALED_TILE * 0.2;
            const s = this.spr("tablePoker", ox, oy, w, h);
            if (s) this.objectContainer.addChild(s);
            break;
          }
          case TileType.BLACKJACK_TABLE: {
            // Half-circle BJ tables - alternate left/right facing
            // Check if this is the first or second BJ table by x position
            const isLeft = x <= 11;
            const texName = isLeft ? "tableBjLeft" : "tableBjRight";
            const w = SCALED_TILE * 2;
            const h = SCALED_TILE * 1.8;
            const ox = px - SCALED_TILE * 0.5;
            const oy = py - SCALED_TILE * 0.3;
            const s = this.spr(texName, ox, oy, w, h);
            if (s) this.objectContainer.addChild(s);
            break;
          }
          case TileType.CRAPS_TABLE: {
            // Craps/roulette table 1 - table-roulette.png style
            const w = SCALED_TILE * 3.5;
            const h = SCALED_TILE * 2;
            const ox = px - SCALED_TILE * 0.25;
            const oy = py - SCALED_TILE * 0.1;
            const s = this.spr("tableRoulette", ox, oy, w, h);
            if (s) this.objectContainer.addChild(s);
            break;
          }
          case TileType.ROULETTE_TABLE: {
            // Roulette table 2 - table-roulette2.png style
            const w = SCALED_TILE * 3.8;
            const h = SCALED_TILE * 2;
            const ox = px - SCALED_TILE * 0.2;
            const oy = py - SCALED_TILE * 0.1;
            const s = this.spr("tableRoulette2", ox, oy, w, h);
            if (s) this.objectContainer.addChild(s);
            break;
          }
          case TileType.SLOT_MACHINE: {
            const w = SCALED_TILE * 0.9;
            const h = SCALED_TILE * 1.5;
            const ox = px + (SCALED_TILE - w) / 2;
            const oy = py - SCALED_TILE * 0.4;
            // Alternate slot machine styles
            const slotTex = x % 2 === 0 ? "slotMachine" : "slotMachine2";
            const s = this.spr(slotTex, ox, oy, w, h);
            if (s) this.objectContainer.addChild(s);
            break;
          }
          case TileType.RAILING: {
            const w = SCALED_TILE * 1;
            const h = SCALED_TILE * 0.4;
            const ox = px;
            const oy = py + SCALED_TILE * 0.3;
            const s = this.spr("railing", ox, oy, w, h);
            if (s) this.objectContainer.addChild(s);
            break;
          }
          case TileType.LAMP: {
            const w = SCALED_TILE * 0.7;
            const h = SCALED_TILE * 1.8;
            const ox = px + (SCALED_TILE - w) / 2;
            const oy = py - SCALED_TILE * 0.7;
            const s = this.spr("lampTall", ox, oy, w, h);
            if (s) this.objectContainer.addChild(s);
            break;
          }
          case TileType.BAR_CURVE: {
            const w = SCALED_TILE * 1.2;
            const h = SCALED_TILE * 1.8;
            const ox = px - SCALED_TILE * 0.1;
            const oy = py - SCALED_TILE * 0.3;
            const s = this.spr("barPost", ox, oy, w, h);
            if (s) this.objectContainer.addChild(s);
            break;
          }
          case TileType.PLANT: {
            this.placeObj("plant", px, py, 0.8, 1.2);
            break;
          }
          case TileType.FLOWER: {
            this.placeObj("flower", px, py, 0.9, 1.1);
            break;
          }
          case TileType.BAR: {
            this.placeObj("barCounter", px, py, 1.6, 1.6);
            break;
          }
          case TileType.DOOR: {
            this.placeObj("entrance", px, py, 1.8, 1.5);
            break;
          }
        }
      }
    }
  }

  private placeObj(key: string, px: number, py: number, tw: number, th: number) {
    const w = SCALED_TILE * tw;
    const h = SCALED_TILE * th;
    const s = this.spr(key, px - (w - SCALED_TILE) / 2, py - (h - SCALED_TILE) / 2, w, h);
    if (s) this.objectContainer.addChild(s);
  }

  renderTableLabels() {
    const style = new TextStyle({
      fontSize: 10,
      fill: 0xffd700,
      fontFamily: "monospace",
      fontWeight: "bold",
      stroke: { color: 0x000000, width: 3 },
    });

    for (const link of FLOOR_TABLE_LINKS) {
      const { x: sx, y: sy } = gridToScreen(link.tileX, link.tileY);
      const label = new Text({ text: link.label, style });
      label.anchor.set(0.5, 1);
      label.x = sx;
      label.y = sy - SCALED_TILE * 1.2;
      this.labelContainer.addChild(label);
    }
  }

  setupInteraction() {
    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;
    let didDrag = false;

    this.app.stage.on("pointerdown", (e) => {
      this.dragging = true;
      didDrag = false;
      this.dragStart = { x: e.global.x, y: e.global.y };
      this.dragCameraStart = { x: this.camera.x, y: this.camera.y };
    });

    this.app.stage.on("pointermove", (e) => {
      if (!this.dragging) return;
      const dx = e.global.x - this.dragStart.x;
      const dy = e.global.y - this.dragStart.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag = true;
      this.camera.x = this.dragCameraStart.x + dx;
      this.camera.y = this.dragCameraStart.y + dy;
      this.worldContainer.x = this.camera.x;
      this.worldContainer.y = this.camera.y;
    });

    this.app.stage.on("pointerup", (e) => {
      this.dragging = false;
      if (didDrag) return;
      const worldX = e.global.x - this.camera.x;
      const worldY = e.global.y - this.camera.y;
      const grid = screenToGrid(worldX, worldY);

      for (const link of FLOOR_TABLE_LINKS) {
        const dx = Math.abs(grid.x - link.tileX);
        const dy = Math.abs(grid.y - link.tileY);
        if (dx <= 1 && dy <= 1) {
          this.onTableClick?.(link.tableIndex);
          return;
        }
      }
      this.onFloorClick?.(grid.x, grid.y);
    });
  }

  // ─── Avatars ───

  addAvatar(playerId: number, gridX: number, gridY: number, name: string, color: string) {
    if (this.avatars.has(playerId)) return;

    const container = new Container();
    const { x: sx, y: sy } = gridToScreen(gridX, gridY);
    container.x = sx;
    container.y = sy;

    const shadow = new Graphics();
    shadow.ellipse(0, 10, 10, 4);
    shadow.fill({ color: 0x000000, alpha: 0.35 });
    container.addChild(shadow);

    const colorNum = parseInt(color.replace("#", ""), 16);
    const body = new Graphics();

    // Feet
    body.rect(-5, 5, 4, 4);
    body.fill(0x333333);
    body.rect(1, 5, 4, 4);
    body.fill(0x333333);
    // Torso
    body.rect(-6, -8, 12, 13);
    body.fill(colorNum);
    body.stroke({ width: 1, color: 0x000000, alpha: 0.3 });
    // Arms
    body.rect(-9, -6, 3, 9);
    body.fill(colorNum);
    body.rect(6, -6, 3, 9);
    body.fill(colorNum);
    // Head
    body.rect(-5, -18, 10, 10);
    body.fill(0xf5c8a0);
    body.stroke({ width: 1, color: 0x000000, alpha: 0.2 });
    // Hair
    body.rect(-5, -20, 10, 4);
    body.fill(colorNum);
    // Eyes
    body.rect(-3, -15, 2, 2);
    body.fill(0x222222);
    body.rect(1, -15, 2, 2);
    body.fill(0x222222);

    container.addChild(body);

    const label = new Text({
      text: name,
      style: new TextStyle({
        fontSize: 9,
        fill: 0xffffff,
        fontFamily: "monospace",
        fontWeight: "bold",
        stroke: { color: 0x000000, width: 3 },
      }),
    });
    label.anchor.set(0.5, 1);
    label.y = -24;
    container.addChild(label);

    const dot = new Graphics();
    dot.circle(8, -22, 3);
    dot.fill(0x4ade80);
    dot.stroke({ width: 1, color: 0x000000 });
    container.addChild(dot);

    this.avatarContainer.addChild(container);
    this.avatars.set(playerId, {
      container, gridX, gridY,
      targetPath: [], pathIndex: 0,
      walking: false, playerId, bobPhase: 0,
    });
    this.depthSort();
  }

  removeAvatar(playerId: number) {
    const avatar = this.avatars.get(playerId);
    if (avatar) {
      this.avatarContainer.removeChild(avatar.container);
      avatar.container.destroy({ children: true });
      this.avatars.delete(playerId);
    }
  }

  walkAvatar(playerId: number, targetX: number, targetY: number) {
    const avatar = this.avatars.get(playerId);
    if (!avatar) return;
    const path = findPath(avatar.gridX, avatar.gridY, targetX, targetY);
    if (path.length <= 1) return;
    avatar.targetPath = path;
    avatar.pathIndex = 1;
    avatar.walking = true;
  }

  updateAvatars() {
    const speed = 2.5;
    const avatarList = Array.from(this.avatars.values());
    for (const avatar of avatarList) {
      if (!avatar.walking || avatar.pathIndex >= avatar.targetPath.length) {
        avatar.walking = false;
        if (avatar.container.children[1]) avatar.container.children[1].y = 0;
        continue;
      }
      const target = avatar.targetPath[avatar.pathIndex];
      const targetPos = gridToScreen(target.x, target.y);
      const dx = targetPos.x - avatar.container.x;
      const dy = targetPos.y - avatar.container.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < speed) {
        avatar.container.x = targetPos.x;
        avatar.container.y = targetPos.y;
        avatar.gridX = target.x;
        avatar.gridY = target.y;
        avatar.pathIndex++;
        if (avatar.pathIndex >= avatar.targetPath.length) avatar.walking = false;
        this.depthSort();
      } else {
        avatar.container.x += (dx / dist) * speed;
        avatar.container.y += (dy / dist) * speed;
        avatar.bobPhase += 0.3;
        if (avatar.container.children[1]) {
          avatar.container.children[1].y = Math.sin(avatar.bobPhase) * 1.5;
        }
      }
    }
  }

  depthSort() {
    this.avatarContainer.children.sort((a, b) => a.y - b.y);
  }

  getAvatarPosition(playerId: number): { x: number; y: number } | null {
    const avatar = this.avatars.get(playerId);
    if (!avatar) return null;
    return { x: avatar.gridX, y: avatar.gridY };
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.app.renderer.resize(width, height);
  }

  destroy() {
    this.app.destroy(true, { children: true });
  }
}
