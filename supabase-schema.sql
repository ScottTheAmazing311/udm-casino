-- UDM Casino Multiplayer Schema
-- Run this in the Supabase SQL Editor

-- Player accounts (12 fixed players with passcodes)
create table if not exists udm_players (
  id int primary key,
  name text not null,
  icon text not null,
  color text not null,
  passcode text not null,
  has_changed_passcode boolean default false,
  avatar_config jsonb,
  created_at timestamptz default now()
);

-- Seed players with default passcodes (1-12)
insert into udm_players (id, name, icon, color, passcode) values
  (1, 'Scott', 'Target', '#FF6B6B', '1'),
  (2, 'Andre', 'Sparkles', '#A78BFA', '2'),
  (3, 'Pat', 'Flame', '#F59E0B', '3'),
  (4, 'Chan', 'Gem', '#34D399', '4'),
  (5, 'Sky', 'Dice5', '#60A5FA', '5'),
  (6, 'Tones', 'Moon', '#F472B6', '6'),
  (7, 'Wim', 'Zap', '#FB923C', '7'),
  (8, 'Wake', 'Clover', '#4ADE80', '8'),
  (9, 'Geoff', 'Joystick', '#C084FC', '9'),
  (10, 'Bork', 'Star', '#FBBF24', '10'),
  (11, 'Ralph', 'CircleDot', '#38BDF8', '11'),
  (12, 'Casper', 'Orbit', '#FB7185', '12')
on conflict (id) do nothing;

-- Game tables (rooms)
create table if not exists udm_tables (
  id uuid default gen_random_uuid() primary key,
  join_code text unique not null,
  game_type text not null default 'blackjack',
  host_player_id int not null references udm_players(id),
  status text not null default 'waiting',
  created_at timestamptz default now()
);

-- Seats at a table
create table if not exists udm_seats (
  id uuid default gen_random_uuid() primary key,
  table_id uuid references udm_tables(id) on delete cascade,
  player_id int not null references udm_players(id),
  player_name text not null,
  chips int not null default 1000,
  is_connected boolean default true,
  joined_at timestamptz default now(),
  unique(table_id, player_id)
);

-- Game state (one active per table)
create table if not exists udm_game_state (
  id uuid default gen_random_uuid() primary key,
  table_id uuid references udm_tables(id) on delete cascade unique,
  phase text not null default 'waiting',
  state jsonb not null default '{}',
  current_turn_player_id int,
  version int not null default 0,
  updated_at timestamptz default now()
);

-- Indexes
create index if not exists idx_udm_tables_join_code on udm_tables(join_code);
create index if not exists idx_udm_seats_table_id on udm_seats(table_id);
create index if not exists idx_udm_game_state_table_id on udm_game_state(table_id);

-- RLS policies (permissive since we use service role for writes)
alter table udm_players enable row level security;
alter table udm_tables enable row level security;
alter table udm_seats enable row level security;
alter table udm_game_state enable row level security;

create policy "Allow all on udm_players" on udm_players for all using (true) with check (true);
create policy "Allow all on udm_tables" on udm_tables for all using (true) with check (true);
create policy "Allow all on udm_seats" on udm_seats for all using (true) with check (true);
create policy "Allow all on udm_game_state" on udm_game_state for all using (true) with check (true);

-- Enable realtime
alter publication supabase_realtime add table udm_tables;
alter publication supabase_realtime add table udm_seats;
alter publication supabase_realtime add table udm_game_state;
