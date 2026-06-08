-- Migration: Add atomic chat message append RPC
-- To apply: Run this SQL in the Supabase SQL Editor for your project.

CREATE OR REPLACE FUNCTION append_chat_message(
    p_game_id UUID,
    p_message JSONB,
    p_pending_event JSONB DEFAULT NULL,
    p_agent_thinking TEXT DEFAULT NULL,
    p_agent_typing BOOLEAN DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE games
    SET 
        -- chat_history is jsonb[] (Postgres Array)
        chat_history = array_append(COALESCE(chat_history, ARRAY[]::JSONB[]), p_message),
        
        -- pending_events is jsonb (JSON Array blob)
        pending_events = CASE 
            WHEN p_pending_event IS NOT NULL THEN 
                COALESCE(pending_events, '[]'::JSONB) || p_pending_event
            ELSE pending_events
        END,
        
        current_thinking = CASE 
            WHEN p_agent_thinking IS NOT NULL THEN p_agent_thinking 
            ELSE current_thinking 
        END,
        
        agent_typing = CASE 
            WHEN p_agent_typing IS NOT NULL THEN p_agent_typing 
            ELSE agent_typing 
        END,
        
        agent_connected = CASE 
            WHEN p_agent_thinking IS NOT NULL THEN true 
            ELSE agent_connected 
        END,
        
        agent_last_seen = CASE 
            WHEN p_agent_thinking IS NOT NULL THEN NOW() 
            ELSE agent_last_seen 
        END
    WHERE id = p_game_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION append_chat_message IS 'Atomically appends a message to chat_history and optionally updates pending_events, thinking, and typing state. Handles chat_history as jsonb[] and pending_events as jsonb.';
