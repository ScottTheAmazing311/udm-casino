-- Add slots to allowed game types
ALTER TABLE udm_casino_tables DROP CONSTRAINT IF EXISTS udm_casino_tables_game_type_check;
ALTER TABLE udm_casino_tables ADD CONSTRAINT udm_casino_tables_game_type_check
  CHECK (game_type IN ('blackjack', 'poker', 'craps', 'roulette', 'slots'));

-- Seed a slots machine table
INSERT INTO udm_casino_tables (game_type, table_name, floor_x, floor_y, max_seats, min_bet, max_bet)
VALUES ('slots', 'Lucky Slots', 2, 8, 4, 10, 500)
ON CONFLICT DO NOTHING;
