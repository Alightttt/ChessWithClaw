-- Supabase Schema V2 for ChessWithClaw

-- Add agent_token to games table
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS agent_token text;

-- Add current_thinking to games table
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS current_thinking TEXT DEFAULT '';

-- 1. Moves Table
CREATE TABLE IF NOT EXISTS public.moves (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id uuid REFERENCES public.games(id) ON DELETE CASCADE,
    move_number integer NOT NULL,
    color text NOT NULL, -- 'w' or 'b'
    san text NOT NULL,
    from_square text,
    to_square text,
    promotion text,
    fen_after text NOT NULL,
    time_taken_ms integer,
    created_at timestamptz DEFAULT now()
);

-- 2. Chat Messages Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id uuid REFERENCES public.games(id) ON DELETE CASCADE,
    sender text NOT NULL, -- 'human', 'agent', 'system'
    message text NOT NULL,
    type text DEFAULT 'text', -- 'text', 'resign_request', 'draw_request', 'draw_offer', 'draw_accept', 'draw_reject'
    created_at timestamptz DEFAULT now()
);

-- 3. Agent Thoughts Table
CREATE TABLE IF NOT EXISTS public.agent_thoughts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id uuid REFERENCES public.games(id) ON DELETE CASCADE,
    move_number integer NOT NULL,
    thought text NOT NULL,
    is_final boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS for new tables
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_thoughts ENABLE ROW LEVEL SECURITY;

-- Restrict public access to SELECT only
CREATE POLICY "Allow public read access" ON public.moves FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.agent_thoughts FOR SELECT USING (true);

-- Allow insert/update only if the user has the correct token (human or agent)
-- We will handle inserts via the backend API using the service_role key or by passing the token
-- Since the backend uses the anon key, we need to allow inserts if the correct token is provided in headers
CREATE POLICY "Allow insert with token" ON public.moves FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.games g 
    WHERE g.id = game_id AND (
      g.secret_token IS NULL OR 
      current_setting('request.headers', true)::json->>'x-game-token' = g.secret_token OR
      current_setting('request.headers', true)::json->>'x-agent-token' = g.agent_token
    )
  )
);

CREATE POLICY "Allow insert with token" ON public.chat_messages FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.games g 
    WHERE g.id = game_id AND (
      g.secret_token IS NULL OR 
      current_setting('request.headers', true)::json->>'x-game-token' = g.secret_token OR
      current_setting('request.headers', true)::json->>'x-agent-token' = g.agent_token
    )
  )
);

CREATE POLICY "Allow insert with token" ON public.agent_thoughts FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.games g 
    WHERE g.id = game_id AND (
      g.secret_token IS NULL OR 
      current_setting('request.headers', true)::json->>'x-game-token' = g.secret_token OR
      current_setting('request.headers', true)::json->>'x-agent-token' = g.agent_token
    )
  )
);

CREATE POLICY "Allow update with token" ON public.agent_thoughts FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.games g 
    WHERE g.id = game_id AND (
      g.secret_token IS NULL OR 
      current_setting('request.headers', true)::json->>'x-game-token' = g.secret_token OR
      current_setting('request.headers', true)::json->>'x-agent-token' = g.agent_token
    )
  )
);

-- Update games table RLS policy
DROP POLICY IF EXISTS "Allow update with token" ON public.games;
CREATE POLICY "Allow update with token" ON public.games FOR UPDATE USING (
  secret_token IS NULL OR 
  current_setting('request.headers', true)::json->>'x-game-token' = secret_token OR
  current_setting('request.headers', true)::json->>'x-agent-token' = agent_token
);
alter publication supabase_realtime add table public.moves;
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.agent_thoughts;

-- Triggers to update games.updated_at
CREATE OR REPLACE FUNCTION update_game_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.games SET updated_at = now() WHERE id = NEW.game_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_games_on_move
    AFTER INSERT OR UPDATE ON public.moves
    FOR EACH ROW
    EXECUTE FUNCTION update_game_timestamp();

CREATE TRIGGER update_games_on_chat
    AFTER INSERT OR UPDATE ON public.chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_game_timestamp();

CREATE TRIGGER update_games_on_thought
    AFTER INSERT OR UPDATE ON public.agent_thoughts
    FOR EACH ROW
    EXECUTE FUNCTION update_game_timestamp();

-- Optional: Migrate existing data from games table to new tables
-- (This is a complex operation and might be better done manually or skipped for old games)
