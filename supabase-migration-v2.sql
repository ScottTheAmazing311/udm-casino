-- UDM Casino v2 Migration
-- Run this in the Supabase SQL Editor AFTER the original schema
-- Adds: persistent chips, stats, fixed casino tables, game history, presence

-- ============================================================
-- 1. Add persistent chip balance & stats to udm_players
-- ============================================================

ALTER TABLE udm_players ADD COLUMN IF NOT EXISTS chips integer NOT NULL DEFAULT 1000;
ALTER TABLE udm_players ADD COLUMN IF NOT EXISTS chips_all_time_high integer NOT NULL DEFAULT 1000;
ALTER TABLE udm_players ADD COLUMN IF NOT EXISTS chips_all_time_low integer NOT NULL DEFAULT 1000;
ALTER TABLE udm_players ADD COLUMN IF NOT EXISTS total_hands_played integer NOT NULL DEFAULT 0;
ALTER TABLE udm_players ADD COLUMN IF NOT EXISTS total_wins integer NOT NULL DEFAULT 0;
ALTER TABLE udm_players ADD COLUMN IF NOT EXISTS total_losses integer NOT NULL DEFAULT 0;
ALTER TABLE udm_players ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false;
ALTER TABLE udm_players ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();

-- ============================================================
-- 2. Fixed casino tables (pre-seeded on the floor)
-- ============================================================

CREATE TABLE IF NOT EXISTS udm_casino_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type TEXT NOT NULL CHECK (game_type IN ('blackjack', 'poker', 'craps')),
  table_name TEXT NOT NULL,
  floor_x FLOAT NOT NULL,
  floor_y FLOAT NOT NULL,
  max_seats INTEGER NOT NULL DEFAULT 6,
  min_bet INTEGER NOT NULL DEFAULT 10,
  max_bet INTEGER NOT NULL DEFAULT 500,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed the casino floor tables
INSERT INTO udm_casino_tables (game_type, table_name, floor_x, floor_y, max_seats, min_bet, max_bet) VALUES
  ('blackjack', 'Blackjack 1',  3, 3, 6, 10, 500),
  ('blackjack', 'Blackjack 2',  7, 3, 6, 25, 1000),
  ('poker',     'Hold''em 1',   3, 7, 8, 10, 500),
  ('poker',     'Hold''em 2',   7, 7, 8, 25, 1000),
  ('craps',     'Craps 1',      5, 10, 12, 10, 500)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. Casino seats (who's sitting at fixed tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS udm_casino_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES udm_casino_tables(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES udm_players(id),
  seat_number INTEGER NOT NULL,
  sat_down_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(table_id, seat_number),
  UNIQUE(table_id, player_id)
);

-- ============================================================
-- 4. Game sessions (per casino table)
-- ============================================================

CREATE TABLE IF NOT EXISTS udm_game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES udm_casino_tables(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'betting', 'playing', 'resolving', 'complete')),
  game_state JSONB NOT NULL DEFAULT '{}',
  current_turn_player_id INTEGER,
  round_number INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- 5. Game results (hand history)
-- ============================================================

CREATE TABLE IF NOT EXISTS udm_game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES udm_game_sessions(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES udm_players(id),
  bet_amount INTEGER NOT NULL DEFAULT 0,
  payout INTEGER NOT NULL DEFAULT 0,
  hand_description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 6. Chat messages
-- ============================================================

CREATE TABLE IF NOT EXISTS udm_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INTEGER NOT NULL REFERENCES udm_players(id),
  channel TEXT NOT NULL DEFAULT 'floor',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 7. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_udm_casino_seats_table ON udm_casino_seats(table_id);
CREATE INDEX IF NOT EXISTS idx_udm_casino_seats_player ON udm_casino_seats(player_id);
CREATE INDEX IF NOT EXISTS idx_udm_game_sessions_table ON udm_game_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_udm_game_sessions_status ON udm_game_sessions(status);
CREATE INDEX IF NOT EXISTS idx_udm_game_results_session ON udm_game_results(session_id);
CREATE INDEX IF NOT EXISTS idx_udm_game_results_player ON udm_game_results(player_id);
CREATE INDEX IF NOT EXISTS idx_udm_chat_channel ON udm_chat_messages(channel, created_at DESC);

-- ============================================================
-- 8. RLS (permissive — we use service role for writes)
-- ============================================================

ALTER TABLE udm_casino_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE udm_casino_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE udm_game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE udm_game_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE udm_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on udm_casino_tables" ON udm_casino_tables FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on udm_casino_seats" ON udm_casino_seats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on udm_game_sessions" ON udm_game_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on udm_game_results" ON udm_game_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on udm_chat_messages" ON udm_chat_messages FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 9. Enable realtime on new tables
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE udm_casino_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE udm_casino_seats;
ALTER PUBLICATION supabase_realtime ADD TABLE udm_game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE udm_chat_messages;

-- ============================================================
-- 10. Atomic chip update function
-- ============================================================

CREATE OR REPLACE FUNCTION update_player_chips(
  p_player_id INTEGER,
  p_amount INTEGER
) RETURNS INTEGER AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  UPDATE udm_players
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
