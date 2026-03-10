-- Chat messages table
CREATE TABLE IF NOT EXISTS udm_chat_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id integer NOT NULL REFERENCES udm_players(id),
  player_name text NOT NULL,
  message text NOT NULL CHECK (char_length(message) <= 200),
  chat_context text NOT NULL DEFAULT 'lobby', -- 'lobby' or table_id
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups by chat_context
CREATE INDEX idx_chat_messages_context ON udm_chat_messages(chat_context, created_at DESC);

-- Auto-delete messages older than 24 hours (optional cleanup)
-- You can run this periodically or set up a cron
-- DELETE FROM udm_chat_messages WHERE created_at < now() - interval '24 hours';

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE udm_chat_messages;
