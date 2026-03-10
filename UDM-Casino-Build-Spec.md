# UDM Casino — Full Build Specification
## A Private Multiplayer Isometric Casino for 12 Friends

---

## PROJECT OVERVIEW

UDM Casino is a private, invite-only multiplayer browser casino for a fixed group of 12 friends. Players log in, enter a pixel-art isometric casino floor where they can see other online players as avatars, walk around, and sit down at tables to play Blackjack, Texas Hold'em Poker, or Craps together in real time. Chip balances persist across sessions. The aesthetic is retro pixel art — think a GBA-era casino rendered in a modern browser.

**Stack:** Next.js 14 (App Router) + Supabase (Auth, Database, Realtime, Edge Functions) + PixiJS (isometric renderer) + Vercel (hosting)

**Players:** Exactly 12 people. No public signup. Accounts are pre-seeded or invite-only.

**Starting Balance:** $1,000 per player.

---

## PHASE 1: Foundation — Auth, Database, Project Scaffold

### 1.1 Project Setup

```bash
npx create-next-app@latest udm-casino --typescript --tailwind --app --src-dir
cd udm-casino
npm install @supabase/supabase-js @supabase/ssr pixi.js howler zustand
```

**Directory Structure:**
```
src/
├── app/
│   ├── layout.tsx              # Root layout with Supabase provider
│   ├── page.tsx                # Landing / login page
│   ├── auth/
│   │   └── callback/route.ts   # OAuth/magic link callback
│   ├── casino/
│   │   ├── layout.tsx          # Casino layout (requires auth)
│   │   ├── page.tsx            # Main casino floor (PixiJS canvas)
│   │   └── [game]/
│   │       └── page.tsx        # Game table view (blackjack, poker, craps)
│   └── api/
│       └── seed/route.ts       # One-time player seeding endpoint
├── components/
│   ├── casino/
│   │   ├── IsometricFloor.tsx  # PixiJS canvas component
│   │   ├── PlayerAvatar.tsx    # Pixel art avatar sprite
│   │   ├── CasinoTable.tsx     # Table sprite (clickable)
│   │   ├── MiniHUD.tsx         # Overlay: chip count, online players
│   │   └── ChatBubble.tsx      # Speech bubble over avatars
│   ├── games/
│   │   ├── BlackjackTable.tsx  # Full blackjack game UI
│   │   ├── PokerTable.tsx      # Full poker game UI
│   │   ├── CrapsTable.tsx      # Full craps game UI
│   │   ├── Card.tsx            # Shared card component
│   │   ├── Dice.tsx            # Shared dice component
│   │   └── ChipStack.tsx       # Chip display component
│   ├── ui/
│   │   ├── Leaderboard.tsx     # Rankings panel
│   │   ├── PlayerList.tsx      # Online players sidebar
│   │   └── GameHistory.tsx     # Recent hand/roll history
│   └── providers/
│       └── SupabaseProvider.tsx # Client-side Supabase context
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser Supabase client
│   │   ├── server.ts           # Server Supabase client
│   │   └── middleware.ts       # Auth middleware
│   ├── game-engines/
│   │   ├── blackjack.ts        # Blackjack logic (pure functions)
│   │   ├── poker.ts            # Texas Hold'em logic (pure functions)
│   │   ├── craps.ts            # Craps logic (pure functions)
│   │   └── deck.ts             # Card/deck utilities
│   ├── casino-floor/
│   │   ├── renderer.ts         # PixiJS isometric renderer setup
│   │   ├── sprites.ts          # Sprite sheet definitions
│   │   ├── camera.ts           # Camera pan/zoom
│   │   ├── pathfinding.ts      # Simple A* for avatar movement
│   │   └── floor-map.ts        # Tile map definition
│   └── store/
│       └── casino-store.ts     # Zustand store for client state
├── hooks/
│   ├── usePresence.ts          # Supabase Realtime presence
│   ├── useGameChannel.ts       # Per-table game state channel
│   └── useCasinoFloor.ts       # Floor renderer hook
├── types/
│   └── index.ts                # All TypeScript types
└── public/
    └── sprites/
        ├── floor-tiles.png     # Isometric floor tileset
        ├── tables.png          # Table sprites (blackjack, poker, craps)
        ├── avatars/            # 12 unique pixel art avatar spritesheets
        ├── decorations.png     # Slot machines, plants, bar, etc.
        └── ui/                 # Chip icons, card backs, dice sprites
```

### 1.2 Supabase Database Schema

Run these migrations in order via Supabase SQL Editor:

```sql
-- ============================================================
-- MIGRATION 001: Core Tables
-- ============================================================

-- Players table (pre-seeded, 12 fixed members)
CREATE TABLE players (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL UNIQUE,
  avatar_key TEXT NOT NULL DEFAULT 'default', -- maps to sprite sheet
  emoji TEXT NOT NULL DEFAULT '🎯',
  color TEXT NOT NULL DEFAULT '#FF6B6B',      -- accent color
  chips INTEGER NOT NULL DEFAULT 1000,
  chips_all_time_high INTEGER NOT NULL DEFAULT 1000,
  chips_all_time_low INTEGER NOT NULL DEFAULT 1000,
  total_hands_played INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  total_losses INTEGER NOT NULL DEFAULT 0,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  floor_position_x FLOAT DEFAULT 400,        -- last position on casino floor
  floor_position_y FLOAT DEFAULT 300,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Casino tables (the physical tables on the floor)
CREATE TABLE casino_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type TEXT NOT NULL CHECK (game_type IN ('blackjack', 'poker', 'craps')),
  table_name TEXT NOT NULL,                   -- "Blackjack Table 1"
  floor_x FLOAT NOT NULL,                    -- position on isometric floor
  floor_y FLOAT NOT NULL,
  max_seats INTEGER NOT NULL DEFAULT 6,
  min_bet INTEGER NOT NULL DEFAULT 10,
  max_bet INTEGER NOT NULL DEFAULT 500,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table seats (who is sitting where)
CREATE TABLE table_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES casino_tables(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  seat_number INTEGER NOT NULL,               -- 1-based seat position
  sat_down_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(table_id, seat_number),
  UNIQUE(table_id, player_id)                 -- one seat per table per player
);

-- Active game sessions
CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES casino_tables(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'betting', 'playing', 'resolving', 'complete')),
  game_state JSONB NOT NULL DEFAULT '{}',     -- full serialized game state
  round_number INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Individual player results per game session
CREATE TABLE game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  bet_amount INTEGER NOT NULL DEFAULT 0,
  payout INTEGER NOT NULL DEFAULT 0,          -- net result (positive = won, negative = lost)
  hand_description TEXT,                      -- "Blackjack!", "Full House", "Pass Line Win"
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Chat messages (casino floor + table chat)
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'floor',       -- 'floor' or table UUID
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- MIGRATION 002: Indexes
-- ============================================================

CREATE INDEX idx_table_seats_table ON table_seats(table_id);
CREATE INDEX idx_table_seats_player ON table_seats(player_id);
CREATE INDEX idx_game_sessions_table ON game_sessions(table_id);
CREATE INDEX idx_game_sessions_status ON game_sessions(status);
CREATE INDEX idx_game_results_session ON game_results(session_id);
CREATE INDEX idx_game_results_player ON game_results(player_id);
CREATE INDEX idx_chat_messages_channel ON chat_messages(channel, created_at DESC);

-- ============================================================
-- MIGRATION 003: Row Level Security
-- ============================================================

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE casino_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Players: can read all, update only own record
CREATE POLICY "Players are viewable by all authenticated users"
  ON players FOR SELECT TO authenticated USING (true);

CREATE POLICY "Players can update own record"
  ON players FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Casino tables: read-only for all
CREATE POLICY "Tables are viewable by all authenticated users"
  ON casino_tables FOR SELECT TO authenticated USING (true);

-- Table seats: read all, insert/delete own
CREATE POLICY "Seats viewable by all" ON table_seats FOR SELECT TO authenticated USING (true);
CREATE POLICY "Players can take a seat" ON table_seats FOR INSERT TO authenticated
  WITH CHECK (player_id = auth.uid());
CREATE POLICY "Players can leave a seat" ON table_seats FOR DELETE TO authenticated
  USING (player_id = auth.uid());

-- Game sessions: read all active (game state managed by edge functions)
CREATE POLICY "Sessions viewable by all" ON game_sessions FOR SELECT TO authenticated USING (true);

-- Game results: read all
CREATE POLICY "Results viewable by all" ON game_results FOR SELECT TO authenticated USING (true);

-- Chat: read all, insert own
CREATE POLICY "Chat viewable by all" ON chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Players can send messages" ON chat_messages FOR INSERT TO authenticated
  WITH CHECK (player_id = auth.uid());

-- ============================================================
-- MIGRATION 004: Seed Casino Tables
-- ============================================================

INSERT INTO casino_tables (game_type, table_name, floor_x, floor_y, max_seats, min_bet, max_bet) VALUES
  ('blackjack', 'Blackjack 1',  200, 200, 6, 10, 500),
  ('blackjack', 'Blackjack 2',  450, 200, 6, 25, 1000),
  ('poker',     'Hold''em 1',   200, 400, 8, 10, 500),
  ('poker',     'Hold''em 2',   450, 400, 8, 25, 1000),
  ('craps',     'Craps 1',      325, 550, 12, 10, 500);

-- ============================================================
-- MIGRATION 005: Functions for chip management
-- ============================================================

-- Atomic chip update (prevents race conditions)
CREATE OR REPLACE FUNCTION update_chips(
  p_player_id UUID,
  p_amount INTEGER
) RETURNS INTEGER AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  UPDATE players
  SET chips = GREATEST(0, chips + p_amount),
      chips_all_time_high = GREATEST(chips_all_time_high, chips + p_amount),
      chips_all_time_low = LEAST(chips_all_time_low, GREATEST(0, chips + p_amount)),
      total_hands_played = total_hands_played + 1,
      total_wins = total_wins + CASE WHEN p_amount > 0 THEN 1 ELSE 0 END,
      total_losses = total_losses + CASE WHEN p_amount < 0 THEN 1 ELSE 0 END
  WHERE id = p_player_id
  RETURNING chips INTO new_balance;

  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 1.3 Supabase Auth Setup

In Supabase Dashboard → Authentication → Providers:
- Enable **Email** (magic link or password — magic link recommended for simplicity)
- Set site URL to your Vercel deployment URL
- Add redirect URL: `https://your-domain.com/auth/callback`

Pre-seed the 12 player accounts. Create a one-time seed script:

```typescript
// src/app/api/seed/route.ts
// Run once to create the 12 players, then disable

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const SEED_PLAYERS = [
  { email: "scott@example.com", name: "Scott", emoji: "🎯", color: "#FF6B6B", avatar_key: "cowboy" },
  { email: "bri@example.com", name: "Bri", emoji: "✨", color: "#A78BFA", avatar_key: "sparkle" },
  { email: "jake@example.com", name: "Jake", emoji: "🔥", color: "#F59E0B", avatar_key: "flame" },
  { email: "megan@example.com", name: "Megan", emoji: "💎", color: "#34D399", avatar_key: "gem" },
  { email: "tyler@example.com", name: "Tyler", emoji: "🎲", color: "#60A5FA", avatar_key: "dice" },
  { email: "kels@example.com", name: "Kels", emoji: "🌙", color: "#F472B6", avatar_key: "moon" },
  { email: "danny@example.com", name: "Danny", emoji: "⚡", color: "#FB923C", avatar_key: "bolt" },
  { email: "ash@example.com", name: "Ash", emoji: "🍀", color: "#4ADE80", avatar_key: "clover" },
  { email: "coop@example.com", name: "Coop", emoji: "🃏", color: "#C084FC", avatar_key: "joker" },
  { email: "jess@example.com", name: "Jess", emoji: "🌟", color: "#FBBF24", avatar_key: "star" },
  { email: "mike@example.com", name: "Mike", emoji: "🎰", color: "#38BDF8", avatar_key: "slots" },
  { email: "lex@example.com", name: "Lex", emoji: "💫", color: "#FB7185", avatar_key: "comet" },
];

export async function POST(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.SEED_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // service role for admin operations
  );

  const results = [];

  for (const player of SEED_PLAYERS) {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: player.email,
      email_confirm: true,
      user_metadata: { display_name: player.name }
    });

    if (authError) {
      results.push({ email: player.email, error: authError.message });
      continue;
    }

    // Create player profile
    const { error: profileError } = await supabase.from('players').insert({
      id: authData.user.id,
      display_name: player.name,
      emoji: player.emoji,
      color: player.color,
      avatar_key: player.avatar_key,
      chips: 1000
    });

    results.push({
      email: player.email,
      success: !profileError,
      error: profileError?.message
    });
  }

  return NextResponse.json({ results });
}
```

### 1.4 Auth Middleware

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return request.cookies.get(name)?.value; },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Protect casino routes
  if (request.nextUrl.pathname.startsWith('/casino') && !user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/casino/:path*']
};
```

---

## PHASE 2: Isometric Casino Floor

### 2.1 Floor Map & Tile System

The casino floor uses a 2D array representing an isometric grid. Each cell is a tile type. The renderer converts grid coordinates to isometric screen coordinates.

```typescript
// src/lib/casino-floor/floor-map.ts

export const TILE_WIDTH = 64;   // pixel width of isometric tile
export const TILE_HEIGHT = 32;  // pixel height of isometric tile

// Tile types
export enum TileType {
  EMPTY = 0,
  FLOOR_DARK = 1,       // dark carpet
  FLOOR_LIGHT = 2,      // light carpet (diamond pattern)
  FLOOR_ACCENT = 3,     // gold/red accent tiles
  WALL_BOTTOM = 10,
  WALL_LEFT = 11,
  WALL_CORNER = 12,
  BAR = 20,
  SLOT_MACHINE = 21,
  PLANT = 22,
  BLACKJACK_TABLE = 30,  // links to casino_tables
  POKER_TABLE = 31,
  CRAPS_TABLE = 32,
}

// Map is 20x15 tiles
export const FLOOR_MAP: number[][] = [
  [12,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10],
  [11, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1],
  [11, 2, 1,22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,22, 1, 2, 1, 2],
  [11, 1, 2, 1,30, 3, 3, 1, 1,31, 3, 3, 3, 1, 1, 1, 2, 1, 2, 1],
  [11, 2, 1, 1, 3, 3, 3, 1, 1, 3, 3, 3, 3, 1, 1, 1, 1, 2, 1, 2],
  [11, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1],
  [11, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2],
  [11, 1, 2, 1,30, 3, 3, 1, 1,31, 3, 3, 3, 1, 1, 1, 2, 1, 2, 1],
  [11, 2, 1, 1, 3, 3, 3, 1, 1, 3, 3, 3, 3, 1, 1, 1, 1, 2, 1, 2],
  [11, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1],
  [11, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2],
  [11, 1, 2, 1, 1, 1, 1, 1,32, 3, 3, 3, 3, 1, 1, 1, 2, 1, 2, 1],
  [11, 2, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 1, 1,22, 1, 2, 1, 2],
  [11, 1, 2, 1,21,21,21, 1, 1, 1, 1, 1, 1, 1,20,20,20, 1, 2, 1],
  [11, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2],
];

// Convert grid position to isometric screen position
export function gridToIso(gridX: number, gridY: number): { x: number; y: number } {
  return {
    x: (gridX - gridY) * (TILE_WIDTH / 2),
    y: (gridX + gridY) * (TILE_HEIGHT / 2),
  };
}

// Convert screen position to grid position
export function isoToGrid(screenX: number, screenY: number): { x: number; y: number } {
  return {
    x: Math.floor((screenX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2),
    y: Math.floor((screenY / (TILE_HEIGHT / 2) - screenX / (TILE_WIDTH / 2)) / 2),
  };
}

// Table positions (map tile coords to casino_table IDs)
// These link the floor tiles to the database casino_tables records
export const TABLE_POSITIONS: Record<string, { tableId: string; gameType: string }> = {};
// Populated at runtime from casino_tables query
```

### 2.2 PixiJS Isometric Renderer

```typescript
// src/lib/casino-floor/renderer.ts

import * as PIXI from 'pixi.js';
import { FLOOR_MAP, TILE_WIDTH, TILE_HEIGHT, gridToIso, TileType } from './floor-map';

export class CasinoRenderer {
  app: PIXI.Application;
  floorContainer: PIXI.Container;
  avatarContainer: PIXI.Container;
  uiContainer: PIXI.Container;
  camera: { x: number; y: number; zoom: number };
  spriteSheet: PIXI.Spritesheet | null = null;
  avatarSprites: Map<string, PIXI.Container> = new Map(); // playerId -> sprite

  constructor(canvas: HTMLCanvasElement) {
    this.app = new PIXI.Application();
    this.floorContainer = new PIXI.Container();
    this.avatarContainer = new PIXI.Container();
    this.uiContainer = new PIXI.Container();
    this.camera = { x: 0, y: 0, zoom: 1 };
  }

  async init(width: number, height: number) {
    await this.app.init({
      canvas: document.getElementById('casino-canvas') as HTMLCanvasElement,
      width,
      height,
      backgroundColor: 0x0a0a12,
      antialias: false,  // pixel art — keep crispy
      resolution: 1,
    });

    // Layer order matters for depth sorting
    this.app.stage.addChild(this.floorContainer);
    this.app.stage.addChild(this.avatarContainer);
    this.app.stage.addChild(this.uiContainer);

    // Load sprite sheets
    await this.loadSprites();

    // Render floor tiles
    this.renderFloor();

    // Enable camera panning via drag
    this.setupCamera();
  }

  async loadSprites() {
    // Load the sprite sheet atlas
    // Sprite sheet should be generated from individual pixel art tiles
    // Use TexturePacker or Aseprite export
    this.spriteSheet = await PIXI.Assets.load('/sprites/casino-atlas.json');
  }

  renderFloor() {
    for (let y = 0; y < FLOOR_MAP.length; y++) {
      for (let x = 0; x < FLOOR_MAP[y].length; x++) {
        const tileType = FLOOR_MAP[y][x];
        const { x: isoX, y: isoY } = gridToIso(x, y);

        const tile = this.createTileSprite(tileType);
        if (tile) {
          tile.x = isoX;
          tile.y = isoY;

          // Tables are interactive — clicking navigates to game
          if ([TileType.BLACKJACK_TABLE, TileType.POKER_TABLE, TileType.CRAPS_TABLE].includes(tileType)) {
            tile.eventMode = 'static';
            tile.cursor = 'pointer';
            tile.on('pointerdown', () => {
              this.onTableClick(x, y, tileType);
            });
          }

          this.floorContainer.addChild(tile);
        }
      }
    }
  }

  createTileSprite(tileType: TileType): PIXI.Sprite | null {
    // Map tile types to sprite sheet frames
    // Each frame is a pre-rendered isometric tile
    const frameMap: Record<number, string> = {
      [TileType.FLOOR_DARK]: 'floor-dark',
      [TileType.FLOOR_LIGHT]: 'floor-light',
      [TileType.FLOOR_ACCENT]: 'floor-accent',
      [TileType.WALL_BOTTOM]: 'wall-bottom',
      [TileType.WALL_LEFT]: 'wall-left',
      [TileType.WALL_CORNER]: 'wall-corner',
      [TileType.BAR]: 'bar',
      [TileType.SLOT_MACHINE]: 'slot-machine',
      [TileType.PLANT]: 'plant',
      [TileType.BLACKJACK_TABLE]: 'table-blackjack',
      [TileType.POKER_TABLE]: 'table-poker',
      [TileType.CRAPS_TABLE]: 'table-craps',
    };

    const frameName = frameMap[tileType];
    if (!frameName || !this.spriteSheet) return null;

    const sprite = new PIXI.Sprite(this.spriteSheet.textures[frameName]);
    sprite.anchor.set(0.5, 1); // anchor at bottom center for isometric stacking
    return sprite;
  }

  // Add or update a player avatar on the floor
  updateAvatar(playerId: string, gridX: number, gridY: number, avatarKey: string, displayName: string) {
    let avatar = this.avatarSprites.get(playerId);

    if (!avatar) {
      avatar = this.createAvatarSprite(avatarKey, displayName);
      this.avatarContainer.addChild(avatar);
      this.avatarSprites.set(playerId, avatar);
    }

    // Smooth movement with lerp
    const target = gridToIso(gridX, gridY);
    // Use PIXI ticker for smooth interpolation
    const lerp = () => {
      avatar!.x += (target.x - avatar!.x) * 0.15;
      avatar!.y += (target.y - avatar!.y) * 0.15;
    };
    this.app.ticker.add(lerp);
    setTimeout(() => this.app.ticker.remove(lerp), 500);
  }

  removeAvatar(playerId: string) {
    const avatar = this.avatarSprites.get(playerId);
    if (avatar) {
      this.avatarContainer.removeChild(avatar);
      this.avatarSprites.delete(playerId);
    }
  }

  createAvatarSprite(avatarKey: string, displayName: string): PIXI.Container {
    const container = new PIXI.Container();

    // Pixel art character sprite (16x24 or similar)
    // This would be an animated sprite with idle/walk frames
    const body = new PIXI.Sprite(/* avatar texture from spritesheet */);
    body.anchor.set(0.5, 1);
    body.scale.set(2); // Scale up pixel art

    // Name tag
    const nameText = new PIXI.Text({
      text: displayName,
      style: {
        fontSize: 10,
        fill: '#ffffff',
        fontFamily: 'monospace',
        stroke: { color: '#000000', width: 2 },
      }
    });
    nameText.anchor.set(0.5, 1);
    nameText.y = -48;

    container.addChild(body);
    container.addChild(nameText);

    return container;
  }

  setupCamera() {
    let dragging = false;
    let lastPos = { x: 0, y: 0 };

    this.app.stage.eventMode = 'static';
    this.app.stage.on('pointerdown', (e) => {
      dragging = true;
      lastPos = { x: e.global.x, y: e.global.y };
    });
    this.app.stage.on('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.global.x - lastPos.x;
      const dy = e.global.y - lastPos.y;
      this.floorContainer.x += dx;
      this.floorContainer.y += dy;
      this.avatarContainer.x += dx;
      this.avatarContainer.y += dy;
      lastPos = { x: e.global.x, y: e.global.y };
    });
    this.app.stage.on('pointerup', () => { dragging = false; });
  }

  onTableClick(gridX: number, gridY: number, tileType: TileType) {
    // Emit event for React to handle navigation
    const event = new CustomEvent('table-click', {
      detail: { gridX, gridY, tileType }
    });
    window.dispatchEvent(event);
  }

  // Depth sort avatars by Y position (further back = rendered first)
  depthSort() {
    this.avatarContainer.children.sort((a, b) => a.y - b.y);
  }

  destroy() {
    this.app.destroy(true);
  }
}
```

### 2.3 Pixel Art Sprite Requirements

Create these sprite assets (or use an AI pixel art generator + manual cleanup):

**Floor Tiles (64x32 each, isometric diamond):**
- `floor-dark` — deep green casino carpet
- `floor-light` — slightly lighter green with subtle diamond pattern
- `floor-accent` — gold/burgundy accent tile for table borders
- `wall-bottom` — dark wood paneled wall (south-facing)
- `wall-left` — dark wood paneled wall (west-facing)
- `wall-corner` — corner piece

**Furniture (multi-tile, isometric):**
- `table-blackjack` — semicircular green felt table, 2x2 tiles
- `table-poker` — oval green felt table, 2x3 tiles
- `table-craps` — long rectangular table with side rails, 2x4 tiles
- `bar` — wooden bar counter with bottles, 1x3 tiles
- `slot-machine` — retro slot machine with flashing lights, 1x1 tile
- `plant` — potted palm or fern, 1x1 tile

**Avatars (16x24 base, 4 directions, 4 walk frames each = 64 frames per character):**
Each of the 12 players gets a unique pixel art avatar. Character designs:
- Distinct silhouettes (tall/short, hat/no hat, hair styles)
- 2-3 color palette per character matching their accent color
- Idle animation (2 frames, subtle bounce)
- Walk animation (4 frames per direction: down-left, down-right, up-left, up-right)

**UI Sprites:**
- Chip icons (white $1, red $5, blue $10, green $25, black $100, purple $500)
- Card back design (pixel art, matches casino theme)
- Dice faces (1-6, pixel art)
- Seat indicator (glowing circle on floor)
- "SIT" prompt icon
- Online indicator (green dot)

---

## PHASE 3: Realtime Multiplayer

### 3.1 Presence System (Who's Online, Where Are They)

```typescript
// src/hooks/usePresence.ts

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCasinoStore } from '@/lib/store/casino-store';

interface PlayerPresence {
  playerId: string;
  displayName: string;
  avatarKey: string;
  gridX: number;
  gridY: number;
  status: 'floor' | 'table' | 'idle';
  tableId?: string;
}

export function usePresence(currentPlayer: PlayerPresence) {
  const supabase = createClient();
  const [onlinePlayers, setOnlinePlayers] = useState<Map<string, PlayerPresence>>(new Map());

  useEffect(() => {
    const channel = supabase.channel('casino-floor', {
      config: { presence: { key: currentPlayer.playerId } }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PlayerPresence>();
        const players = new Map<string, PlayerPresence>();
        Object.entries(state).forEach(([key, presences]) => {
          if (presences.length > 0) {
            players.set(key, presences[0] as PlayerPresence);
          }
        });
        setOnlinePlayers(players);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        // Player came online — add avatar to floor
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        // Player went offline — remove avatar from floor
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(currentPlayer);
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [currentPlayer.playerId]);

  // Update position (called when player moves on floor)
  const updatePosition = async (gridX: number, gridY: number) => {
    const channel = supabase.channel('casino-floor');
    await channel.track({ ...currentPlayer, gridX, gridY });
  };

  return { onlinePlayers, updatePosition };
}
```

### 3.2 Game Channel (Per-Table Real-Time State)

```typescript
// src/hooks/useGameChannel.ts

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface GameAction {
  type: string;       // 'bet', 'hit', 'stand', 'fold', 'raise', 'roll', etc.
  playerId: string;
  payload: any;
  timestamp: number;
}

export function useGameChannel(tableId: string, playerId: string) {
  const supabase = createClient();
  const [gameState, setGameState] = useState<any>(null);

  useEffect(() => {
    // Listen for game state updates from Edge Functions
    const channel = supabase.channel(`game:${tableId}`)
      .on('broadcast', { event: 'game-state' }, ({ payload }) => {
        setGameState(payload);
      })
      .on('broadcast', { event: 'game-action' }, ({ payload }) => {
        // Handle individual actions for animations
        // (card dealt, dice rolled, chips moved)
      })
      .subscribe();

    // Also subscribe to database changes for the game session
    const dbChannel = supabase.channel(`db:game:${tableId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_sessions',
        filter: `table_id=eq.${tableId}`
      }, (payload) => {
        setGameState(payload.new.game_state);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(dbChannel);
    };
  }, [tableId]);

  // Send a game action (validated by Edge Function)
  const sendAction = useCallback(async (action: Omit<GameAction, 'playerId' | 'timestamp'>) => {
    const response = await fetch('/api/game-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableId,
        playerId,
        action: action.type,
        payload: action.payload
      })
    });
    return response.json();
  }, [tableId, playerId]);

  return { gameState, sendAction };
}
```

### 3.3 Avatar Movement & Click-to-Walk

When a player clicks on a floor tile, their avatar walks there using simple A* pathfinding. Movement is broadcast to all connected players via presence updates.

```typescript
// src/lib/casino-floor/pathfinding.ts

import { FLOOR_MAP, TileType } from './floor-map';

interface GridNode {
  x: number;
  y: number;
  g: number;  // cost from start
  h: number;  // heuristic to end
  f: number;  // g + h
  parent: GridNode | null;
}

const WALKABLE = new Set([
  TileType.FLOOR_DARK,
  TileType.FLOOR_LIGHT,
  TileType.FLOOR_ACCENT,
]);

export function findPath(
  startX: number, startY: number,
  endX: number, endY: number
): Array<{ x: number; y: number }> {
  // Standard A* implementation
  // Returns array of grid positions from start to end
  // Only walks on WALKABLE tile types
  // Diagonal movement allowed

  const open: GridNode[] = [];
  const closed = new Set<string>();

  const start: GridNode = { x: startX, y: startY, g: 0, h: 0, f: 0, parent: null };
  start.h = heuristic(startX, startY, endX, endY);
  start.f = start.h;
  open.push(start);

  while (open.length > 0) {
    // Get node with lowest f
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;
    const key = `${current.x},${current.y}`;

    if (current.x === endX && current.y === endY) {
      return reconstructPath(current);
    }

    closed.add(key);

    // Check 4 neighbors (no diagonal for cleaner isometric movement)
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const nKey = `${nx},${ny}`;

      if (closed.has(nKey)) continue;
      if (ny < 0 || ny >= FLOOR_MAP.length || nx < 0 || nx >= FLOOR_MAP[0].length) continue;
      if (!WALKABLE.has(FLOOR_MAP[ny][nx])) continue;

      const g = current.g + 1;
      const h = heuristic(nx, ny, endX, endY);
      const existing = open.find((n) => n.x === nx && n.y === ny);

      if (!existing || g < existing.g) {
        const node: GridNode = { x: nx, y: ny, g, h, f: g + h, parent: current };
        if (!existing) open.push(node);
        else Object.assign(existing, node);
      }
    }
  }

  return []; // no path found
}

function heuristic(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

function reconstructPath(node: GridNode): Array<{ x: number; y: number }> {
  const path: Array<{ x: number; y: number }> = [];
  let current: GridNode | null = node;
  while (current) {
    path.unshift({ x: current.x, y: current.y });
    current = current.parent;
  }
  return path;
}
```

---

## PHASE 4: Game Engines (Server-Authoritative)

All game logic runs in **Supabase Edge Functions** to prevent cheating. The client sends actions, the server validates and resolves them, then broadcasts the new state.

### 4.1 Supabase Edge Function: Game Action Handler

```
supabase/functions/game-action/index.ts
```

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleBlackjackAction } from './blackjack.ts';
import { handlePokerAction } from './poker.ts';
import { handleCrapsAction } from './craps.ts';

Deno.serve(async (req) => {
  const { tableId, playerId, action, payload } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Verify player auth
  const authHeader = req.headers.get('Authorization')!;
  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );
  if (authError || user?.id !== playerId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Get table info
  const { data: table } = await supabase
    .from('casino_tables')
    .select('*')
    .eq('id', tableId)
    .single();

  if (!table) {
    return new Response(JSON.stringify({ error: 'Table not found' }), { status: 404 });
  }

  // Get or create game session
  let { data: session } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('table_id', tableId)
    .neq('status', 'complete')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  // Route to appropriate game handler
  let result;
  switch (table.game_type) {
    case 'blackjack':
      result = await handleBlackjackAction(supabase, session, table, playerId, action, payload);
      break;
    case 'poker':
      result = await handlePokerAction(supabase, session, table, playerId, action, payload);
      break;
    case 'craps':
      result = await handleCrapsAction(supabase, session, table, playerId, action, payload);
      break;
  }

  // Broadcast updated game state to all players at the table
  const channel = supabase.channel(`game:${tableId}`);
  await channel.send({
    type: 'broadcast',
    event: 'game-state',
    payload: result.gameState,
  });

  return new Response(JSON.stringify(result), { status: 200 });
});
```

### 4.2 Blackjack Engine (Server-Side)

```typescript
// supabase/functions/game-action/blackjack.ts

interface BlackjackState {
  deck: Card[];
  dealerHand: Card[];
  dealerRevealed: boolean;
  players: Record<string, {
    hand: Card[];
    bet: number;
    status: 'betting' | 'playing' | 'stand' | 'bust' | 'blackjack';
    result?: { outcome: string; payout: number };
  }>;
  currentPlayerIndex: number;
  seatOrder: string[]; // player IDs in seat order
  phase: 'waiting' | 'betting' | 'dealing' | 'playing' | 'dealer-turn' | 'payout';
}

export async function handleBlackjackAction(
  supabase: any,
  session: any,
  table: any,
  playerId: string,
  action: string,
  payload: any
) {
  let state: BlackjackState = session?.game_state || createInitialState();

  switch (action) {
    case 'sit': {
      // Add player to seat order
      if (!state.seatOrder.includes(playerId)) {
        state.seatOrder.push(playerId);
        state.players[playerId] = {
          hand: [], bet: 0, status: 'betting'
        };
      }
      break;
    }

    case 'bet': {
      const amount = payload.amount;
      // Validate: player has enough chips
      const { data: player } = await supabase
        .from('players').select('chips').eq('id', playerId).single();
      if (!player || player.chips < amount) {
        return { error: 'Insufficient chips' };
      }
      if (amount < table.min_bet || amount > table.max_bet) {
        return { error: 'Bet out of range' };
      }
      state.players[playerId].bet = amount;
      state.players[playerId].status = 'betting';

      // If all seated players have bet, deal cards
      const allBet = state.seatOrder.every(pid =>
        state.players[pid]?.bet > 0
      );
      if (allBet) {
        state = dealCards(state);
      }
      break;
    }

    case 'hit': {
      const pState = state.players[playerId];
      if (pState.status !== 'playing') return { error: 'Not your turn' };
      if (state.seatOrder[state.currentPlayerIndex] !== playerId) {
        return { error: 'Not your turn' };
      }

      pState.hand.push(state.deck.pop()!);
      const value = handValue(pState.hand);
      if (value > 21) pState.status = 'bust';
      else if (value === 21) pState.status = 'stand';

      if (pState.status !== 'playing') {
        state = advanceToNextPlayer(state);
      }
      break;
    }

    case 'stand': {
      state.players[playerId].status = 'stand';
      state = advanceToNextPlayer(state);
      break;
    }

    case 'double': {
      const pState = state.players[playerId];
      const { data: player } = await supabase
        .from('players').select('chips').eq('id', playerId).single();
      if (player.chips < pState.bet * 2) return { error: 'Insufficient chips' };
      pState.bet *= 2;
      pState.hand.push(state.deck.pop()!);
      const val = handValue(pState.hand);
      pState.status = val > 21 ? 'bust' : 'stand';
      state = advanceToNextPlayer(state);
      break;
    }
  }

  // If we're in dealer-turn phase, auto-play dealer
  if (state.phase === 'dealer-turn') {
    state = playDealer(state);
    state = resolveBets(state, supabase);
  }

  // Save game state
  if (session) {
    await supabase.from('game_sessions')
      .update({ game_state: state, status: state.phase === 'payout' ? 'complete' : 'playing' })
      .eq('id', session.id);
  } else {
    await supabase.from('game_sessions').insert({
      table_id: table.id,
      game_type: 'blackjack',
      game_state: state,
      status: 'playing'
    });
  }

  return { gameState: sanitizeStateForClient(state, playerId) };
}

function createInitialState(): BlackjackState {
  return {
    deck: createShuffledDeck(4), // 4-deck shoe
    dealerHand: [],
    dealerRevealed: false,
    players: {},
    currentPlayerIndex: 0,
    seatOrder: [],
    phase: 'waiting',
  };
}

function dealCards(state: BlackjackState): BlackjackState {
  // Deal 2 cards to each player, then 2 to dealer
  for (let round = 0; round < 2; round++) {
    for (const pid of state.seatOrder) {
      state.players[pid].hand.push(state.deck.pop()!);
    }
    state.dealerHand.push(state.deck.pop()!);
  }

  // Check for player blackjacks
  for (const pid of state.seatOrder) {
    if (handValue(state.players[pid].hand) === 21) {
      state.players[pid].status = 'blackjack';
    } else {
      state.players[pid].status = 'playing';
    }
  }

  state.phase = 'playing';
  state.currentPlayerIndex = 0;

  // Skip blackjack players
  while (
    state.currentPlayerIndex < state.seatOrder.length &&
    state.players[state.seatOrder[state.currentPlayerIndex]].status !== 'playing'
  ) {
    state.currentPlayerIndex++;
  }

  if (state.currentPlayerIndex >= state.seatOrder.length) {
    state.phase = 'dealer-turn';
  }

  return state;
}

function advanceToNextPlayer(state: BlackjackState): BlackjackState {
  state.currentPlayerIndex++;
  while (
    state.currentPlayerIndex < state.seatOrder.length &&
    state.players[state.seatOrder[state.currentPlayerIndex]].status !== 'playing'
  ) {
    state.currentPlayerIndex++;
  }

  if (state.currentPlayerIndex >= state.seatOrder.length) {
    state.phase = 'dealer-turn';
  }

  return state;
}

function playDealer(state: BlackjackState): BlackjackState {
  state.dealerRevealed = true;
  while (handValue(state.dealerHand) < 17) {
    state.dealerHand.push(state.deck.pop()!);
  }
  return state;
}

async function resolveBets(state: BlackjackState, supabase: any): BlackjackState {
  const dealerVal = handValue(state.dealerHand);
  const dealerBust = dealerVal > 21;

  for (const pid of state.seatOrder) {
    const p = state.players[pid];
    const pVal = handValue(p.hand);
    let payout = 0;

    if (p.status === 'bust') {
      payout = -p.bet;
    } else if (p.status === 'blackjack') {
      payout = dealerVal === 21 && state.dealerHand.length === 2
        ? 0  // push
        : Math.floor(p.bet * 1.5); // blackjack pays 3:2
    } else if (dealerBust || pVal > dealerVal) {
      payout = p.bet;
    } else if (pVal === dealerVal) {
      payout = 0;
    } else {
      payout = -p.bet;
    }

    p.result = {
      outcome: payout > 0 ? 'WIN' : payout < 0 ? 'LOSE' : 'PUSH',
      payout
    };

    // Update chips atomically
    await supabase.rpc('update_chips', { p_player_id: pid, p_amount: payout });
  }

  state.phase = 'payout';
  return state;
}

// Don't send the full deck to clients — only reveal what they should see
function sanitizeStateForClient(state: BlackjackState, requestingPlayerId: string): any {
  return {
    ...state,
    deck: undefined, // never send deck to client
    deckRemaining: state.deck.length,
    dealerHand: state.dealerRevealed
      ? state.dealerHand
      : [state.dealerHand[0], { hidden: true }],
  };
}

// --- Card utilities (duplicate these in Edge Function) ---

interface Card { suit: string; rank: string; }

function createShuffledDeck(numDecks: number): Card[] {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck: Card[] = [];
  for (let d = 0; d < numDecks; d++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ suit, rank });
      }
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function handValue(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (['J', 'Q', 'K'].includes(card.rank)) total += 10;
    else if (card.rank === 'A') { total += 11; aces++; }
    else total += parseInt(card.rank);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}
```

### 4.3 Poker Engine (Server-Side)

Follow the same pattern as Blackjack. Key differences:

- **Blinds:** Small blind and big blind posted automatically based on seat positions. Blinds rotate each hand.
- **Betting rounds:** Pre-flop, flop, turn, river — each with full raise/call/fold/check cycle.
- **Hand evaluation:** Implement full 5-card hand ranking (Royal Flush through High Card). Evaluate best 5 from 7 cards (2 hole + 5 community).
- **Pot management:** Track main pot and side pots for all-in scenarios.
- **Showdown:** Reveal all remaining players' hands, award pot to best hand.
- **State sanitization:** Only send a player their own hole cards. Other players' cards are hidden until showdown.

### 4.4 Craps Engine (Server-Side)

Follow the same pattern. Key differences:

- **Shooter rotation:** One player rolls, all players can bet.
- **Bet types to implement:** Pass Line, Don't Pass, Field, Come, Don't Come, Place bets (6, 8).
- **Two-phase resolution:** Come-out roll (7/11 = pass win, 2/3/12 = pass lose, else set point). Point phase (hit point = pass win, 7 = pass lose).
- **Dice generation:** Server-side random. Broadcast roll animation timing to clients, then reveal result.

---

## PHASE 5: Game Table UI Components

### 5.1 Table View Architecture

When a player clicks a table on the floor and sits down, the view transitions from the isometric floor to a focused game table view. This is a React component overlaid on the PixiJS canvas (or replaces it entirely).

The game table UI should match the dark, premium aesthetic from the original prototype — dark backgrounds, clean card rendering, player avatars around the table edge, chip animations, and clear turn indicators.

```typescript
// src/app/casino/[game]/page.tsx

// Route: /casino/blackjack?table=TABLE_UUID
// Route: /casino/poker?table=TABLE_UUID
// Route: /casino/craps?table=TABLE_UUID

'use client';

import { useSearchParams } from 'next/navigation';
import { useGameChannel } from '@/hooks/useGameChannel';
import { useAuth } from '@/hooks/useAuth';
import BlackjackTable from '@/components/games/BlackjackTable';
import PokerTable from '@/components/games/PokerTable';
import CrapsTable from '@/components/games/CrapsTable';

export default function GamePage({ params }: { params: { game: string } }) {
  const searchParams = useSearchParams();
  const tableId = searchParams.get('table')!;
  const { user } = useAuth();
  const { gameState, sendAction } = useGameChannel(tableId, user.id);

  const GameComponent = {
    blackjack: BlackjackTable,
    poker: PokerTable,
    craps: CrapsTable,
  }[params.game];

  return (
    <div className="min-h-screen bg-[#0a0a12]">
      <GameComponent
        gameState={gameState}
        playerId={user.id}
        onAction={sendAction}
        tableId={tableId}
      />
    </div>
  );
}
```

### 5.2 Shared UI Principles

All game table UIs should follow these design rules:

- **Background:** `#0a0a12` (near black)
- **Card style:** Cream/off-white (`#f8f5f0`) with colored suit symbols. Red suits use `#FF6B6B`. Black suits use white text. Pixel art card back with cross-hatch pattern.
- **Player indicators:** Circular avatar with colored border matching player's accent color. Glowing border + shadow when it's their turn.
- **Chip display:** Gold text (`#FFD700`), monospace font, with `🪙` emoji prefix.
- **Action buttons:** Rounded, outlined style. Color-coded by action type (green = positive action like Hit/Call, blue = neutral like Stand/Check, red = negative like Fold, amber = risky like Double/Raise).
- **Results:** Green flash for wins (`#4ADE80`), red for losses (`#FF6B6B`), gray for pushes.
- **Animations:** Cards should slide in from deck position. Chips should stack/move with CSS transitions. Dice should tumble (CSS keyframe animation). All transitions 200-300ms ease.
- **Typography:** `DM Serif Display` for headers/numbers, `DM Sans` for body/labels, `Space Mono` for chip amounts.
- **Sound effects (optional, use Howler.js):** Card deal whoosh, chip clink, dice rattle, win jingle, bust sound.

---

## PHASE 6: Polish & Social Features

### 6.1 Leaderboard

Real-time leaderboard accessible from the casino floor (button overlay or dedicated area on the floor like a scoreboard on the wall).

Query: `SELECT * FROM players ORDER BY chips DESC`

Display: Rank, avatar, name, current chips, all-time high, win rate (total_wins / total_hands_played), P&L from starting $1,000.

### 6.2 Chat

Simple chat system:
- Floor chat: visible to all online players, appears as speech bubbles above avatars
- Table chat: visible only to players seated at the same table
- Stored in `chat_messages` table, loaded via Supabase Realtime postgres_changes

### 6.3 Spectating

Players can click a table without sitting down to spectate:
- They see the game state but cannot act
- Their avatar stands near the table on the floor
- Other players can see spectators

### 6.4 Bankrupt Recovery

If a player hits $0:
- They can "buy back in" for $500 (one time per day)
- Or the group can vote to reset everyone to $1,000
- Track total buy-backs in a separate column

### 6.5 Statistics Dashboard

Per-player stats page:
- Total hands played per game type
- Win rate per game type
- Biggest single win / loss
- Current streak (win/loss)
- Chip history chart (line graph over time using Recharts)
- Favorite table / game

---

## BUILD ORDER (Recommended)

Build in this order. Each phase is independently testable.

### Sprint 1: Foundation (Days 1-2)
1. Next.js project scaffold with TypeScript
2. Supabase project setup + run all migrations
3. Auth flow (login page, middleware, callback)
4. Seed the 12 player accounts
5. Basic authenticated landing page that shows your player profile + chip count

### Sprint 2: Game Engines (Days 3-5)
6. Port Blackjack logic to Edge Function (server-authoritative)
7. Build Blackjack table UI component (reuse/adapt from prototype)
8. Wire up Supabase Realtime game channel for Blackjack
9. Test with 2+ browser tabs (simulate multiplayer)
10. Port Poker engine to Edge Function
11. Build Poker table UI
12. Port Craps engine to Edge Function
13. Build Craps table UI

### Sprint 3: Casino Floor (Days 6-8)
14. Create/source pixel art tile sprites
15. Create/source 12 avatar sprites
16. Build PixiJS isometric renderer
17. Render floor map with tables and decorations
18. Implement click-to-walk with pathfinding
19. Connect presence system — see other players on floor
20. Table click → navigate to game view

### Sprint 4: Integration & Polish (Days 9-10)
21. Seat system (sit at table from floor, leave table → back to floor)
22. Leaderboard panel
23. Chat (floor + table)
24. Spectator mode
25. Sound effects
26. Bankrupt recovery flow
27. Deploy to Vercel

---

## ENVIRONMENT VARIABLES

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...       # server-side only
SEED_SECRET=your-one-time-seed-secret  # delete after seeding
```

---

## KEY DESIGN DECISIONS

1. **Server-authoritative game logic:** All card dealing, shuffling, and bet resolution happens in Supabase Edge Functions. Clients never see the deck. This prevents cheating entirely.

2. **Presence vs Database for positions:** Player floor positions use Supabase Realtime Presence (ephemeral, fast) — not stored in database on every move. Only saved to DB on disconnect for "resume position" on reconnect.

3. **PixiJS over HTML/CSS isometric:** PixiJS handles sprite layering, depth sorting, smooth animation, and camera panning natively. HTML/CSS isometric gets unwieldy fast with 12+ moving sprites.

4. **Zustand for client state:** Lightweight, no boilerplate. Stores current player info, UI state, cached game state between Realtime updates.

5. **Channel architecture:** One presence channel (`casino-floor`) for the whole casino. One broadcast channel per active table (`game:{tableId}`). This keeps message volume low and scoped.

6. **Pixel art at 2x scale:** Base sprites at native pixel resolution (16x24 avatars, 64x32 tiles), rendered at 2x via PixiJS `sprite.scale.set(2)` with `antialias: false` for crispy pixels.

---

## PLAYER ROSTER

Update these with real names, emails, and preferred emojis/colors:

| # | Name | Email | Emoji | Color | Avatar |
|---|------|-------|-------|-------|--------|
| 1 | Scott | | 🎯 | #FF6B6B | cowboy |
| 2 | Bri | | ✨ | #A78BFA | sparkle |
| 3 | Jake | | 🔥 | #F59E0B | flame |
| 4 | Megan | | 💎 | #34D399 | gem |
| 5 | Tyler | | 🎲 | #60A5FA | dice |
| 6 | Kels | | 🌙 | #F472B6 | moon |
| 7 | Danny | | ⚡ | #FB923C | bolt |
| 8 | Ash | | 🍀 | #4ADE80 | clover |
| 9 | Coop | | 🃏 | #C084FC | joker |
| 10 | Jess | | 🌟 | #FBBF24 | star |
| 11 | Mike | | 🎰 | #38BDF8 | slots |
| 12 | Lex | | 💫 | #FB7185 | comet |
