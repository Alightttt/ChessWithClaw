-- Supabase Schema for ChessWithClaw

CREATE TABLE public.games (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    fen text NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    turn text NOT NULL DEFAULT 'w',
    move_history jsonb[] DEFAULT '{}',
    status text NOT NULL DEFAULT 'waiting', -- 'waiting', 'active', 'finished'
    result text DEFAULT '', -- 'white', 'black', 'draw', ''
    result_reason text DEFAULT '',
    human_connected boolean DEFAULT false,
    agent_connected boolean DEFAULT false,
    current_thinking text DEFAULT '',
    thinking_log jsonb[] DEFAULT '{}',
    pending_events jsonb DEFAULT '[]'::jsonb,
    secret_token text,
    agent_token uuid DEFAULT gen_random_uuid(),
    human_last_seen timestamptz,
    agent_last_seen timestamptz,
    human_last_moved_at timestamptz,
    last_impatience_at timestamptz,
    webhook_url text,
    webhook_failed boolean DEFAULT false,
    webhook_fail_count integer DEFAULT 0,
    chat_history jsonb[] DEFAULT '{}',
    updated_at timestamptz DEFAULT now(),
    expires_at timestamptz,
    agent_name text DEFAULT 'Your Agent',
    agent_avatar text DEFAULT '🤖',
    agent_tagline text DEFAULT 'OpenClaw Agent'
);

-- Function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_games_updated_at
    BEFORE UPDATE ON public.games
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can read games" ON public.games FOR SELECT USING (true);
CREATE POLICY "Anyone can create games" ON public.games FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update games" ON public.games FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "Service role can delete games" ON public.games FOR DELETE USING (auth.role() = 'service_role');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS games_status_idx ON public.games(status);
CREATE INDEX IF NOT EXISTS games_created_at_idx ON public.games(created_at);
CREATE INDEX IF NOT EXISTS games_expires_at_idx ON public.games(expires_at);

-- Enable real-time for the games table
alter publication supabase_realtime add table public.games;
