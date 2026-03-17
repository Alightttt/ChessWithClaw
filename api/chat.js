import { createClient } from '@supabase/supabase-js';
import { Chess } from 'chess.js';
import { notifyAgent } from './notify.js';
import { sanitizeText, validateUUID } from './_utils/sanitize.js';
import { checkRateLimit } from './_utils/rateLimit.js';
import { applySecurityHeaders, applyCacheControl, applyRateLimitHeaders, applyCorsHeaders } from './_middleware/headers.js';

export default async function handler(req, res) {
  applySecurityHeaders(res);
  applyCacheControl(res);
  applyCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > 10240) {
    return res.status(413).json({ error: 'Payload too large' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const rateLimitResult = checkRateLimit(ip, '/api/chat', 20, 60000);
  applyRateLimitHeaders(res, 20, rateLimitResult.remaining, rateLimitResult.resetTime);
  
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000));
    return res.status(429).json({ error: 'Too many requests', retry_after: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000) });
  }
  
  let { id, text, type, sender = 'agent' } = req.body || {};
  if (!id || !text) return res.status(400).json({ error: 'Missing id or text in JSON body' });
  id = id.trim();
  
  if (!validateUUID(id)) {
    return res.status(400).json({ error: 'Invalid game ID format' });
  }

  if (sender !== 'human' && sender !== 'agent') {
    return res.status(400).json({ error: 'Invalid sender' });
  }

  const sanitizedText = sanitizeText(text, 500);
  if (!sanitizedText) {
    return res.status(400).json({ error: 'Text is empty after sanitization' });
  }

  let supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'undefined') {
    return res.status(500).json({ error: 'Server configuration error: Missing Supabase credentials' });
  }

  if (!supabaseUrl.startsWith('http')) {
    supabaseUrl = `https://${supabaseUrl}`;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        'x-game-token': req.headers['x-game-token'] || '',
        'x-agent-token': req.headers['x-agent-token'] || ''
      }
    }
  });
  
  // Verify game exists
  const { data: game, error } = await supabase.from('games').select('id, webhook_url, webhook_failed, webhook_fail_count, fen, turn, pending_events, agent_connected, secret_token, agent_token').eq('id', id).single();
  if (error || !game) return res.status(404).json({ error: 'Game not found' });

  if (sender === 'human') {
    const gameToken = req.headers['x-game-token'];
    if (!gameToken || gameToken !== game.secret_token) {
      return res.status(403).json({ error: 'Forbidden: Invalid or missing x-game-token for human.' });
    }
  } else if (sender === 'agent') {
    const agentToken = req.headers['x-agent-token'];
    if (!agentToken || agentToken !== game.agent_token) {
      return res.status(403).json({ error: 'Forbidden: Invalid or missing x-agent-token for agent.' });
    }
  }

  // Fetch move history from the new table
  const { data: movesData } = await supabase.from('moves').select('*').eq('game_id', id).order('move_number', { ascending: true });
  game.move_history = movesData || [];

  const newMessage = {
    game_id: id,
    sender: sender,
    message: sanitizedText,
    type: type || 'text'
  };

  const { error: chatInsertError } = await supabase.from('chat_messages').insert(newMessage);
  if (chatInsertError) {
    console.error("Error inserting chat:", chatInsertError);
    if (chatInsertError.code === '42P01') {
      const { data: oldGame } = await supabase.from('games').select('chat_history').eq('id', id).single();
      const newHistory = [...(oldGame?.chat_history || []), {
        sender: sender,
        text: sanitizedText,
        type: type || 'text',
        timestamp: Date.now()
      }];
      await supabase.from('games').update({ chat_history: newHistory }).eq('id', id);
    } else {
      return res.status(500).json({ error: 'Failed to send message' });
    }
  }

  const updates = {};
  if (sender === 'agent') {
    updates.agent_connected = true;
    updates.agent_last_seen = new Date().toISOString();
  }

  if (sender === 'human') {
    const chess = new Chess();
    if (game.move_history && game.move_history.length > 0) {
      game.move_history.forEach(m => {
        try { chess.move(m.san); } catch (e) {}
      });
    } else if (game.fen && game.fen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
      chess.load(game.fen);
    }
    const payload = {
      event: "human_sent_chat",
      game_id: id,
      human_message: sanitizedText,
      board: chess.ascii(),
      fen: game.fen,
      whose_turn: game.turn === 'w' ? 'human' : 'agent',
      move_number: Math.floor((game.move_history || []).length / 2) + 1,
      instruction: "Your user messaged you during your chess game. Reply in chat as yourself in 1-2 sentences. Use your 'skill.md' personality. Do not make a chess move unless it is your turn. CRITICAL: DO NOT reply on Telegram/Discord. Stay in an infinite loop and use POST /api/chat for all communication. If there are pending chat messages, you MUST reply to them using the chat API before you submit your chess move."
    };
    
    const enrichedPayload = await notifyAgent(game, payload, supabase);
    updates.pending_events = [...(updates.pending_events || game.pending_events || []), enrichedPayload];
  }

  if (Object.keys(updates).length > 0) {
    await supabase.from('games').update(updates).eq('id', id);
  }

  res.status(200).json({ 
    success: true, 
    message: 'Chat message sent successfully.' 
  });
}
