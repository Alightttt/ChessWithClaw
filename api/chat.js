// ALTER TABLE games ADD COLUMN IF NOT EXISTS agent_typing BOOLEAN DEFAULT false;
const { createClient } = require('@supabase/supabase-js');
const { notifyAgent } = require('../server-lib/notify.js');
const { sanitizeText, validateUUID } = require('../server-lib/utils/sanitize.js');
const { checkRateLimit } = require('../server-lib/utils/rateLimit.js');
const { applySecurityHeaders, applyCacheControl, applyRateLimitHeaders, applyCorsHeaders } = require('../server-lib/middleware/headers.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-agent-token, x-game-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || !process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).includes('your_supabase') || !(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).startsWith('http')) {
    console.error('Missing: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({ 
      error: 'Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in AI Studio settings to create a match.',
      code: 'MISSING_ENV_VARS'
    });
  }

  applySecurityHeaders(res);
  applyCacheControl(res);
  applyCorsHeaders(req, res);

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
  
  let { id, game_id, gameId: bodyGameId, text: bodyText, message, type, sender: bodySender, role, token, reasoning, thinking, action, messageId, emoji } = req.body || {};
  let gameId = game_id || bodyGameId || id;
  const msgId = id || messageId || require('crypto').randomUUID();
  let text = bodyText || message;
  let sender = bodySender || role || 'human';
  
  if (!gameId) return res.status(400).json({ error: 'Missing game ID in JSON body', code: 'MISSING_GAME_ID' });
  gameId = gameId.trim();

  const agentToken = req.headers['x-agent-token'] || token || '';
  const agentTyping = req.headers['x-agent-typing'];

  if (sender === 'agent' && agentTyping === 'true') {
    const supabase = createClient(
      (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: game, error } = await supabase.from('games').select('agent_token').eq('id', gameId).single();
    if (error || !game) return res.status(404).json({ error: 'Game not found', code: 'GAME_NOT_FOUND' });
    if (!agentToken || agentToken !== game.agent_token) {
      return res.status(403).json({ error: 'Forbidden: Invalid or missing token for agent.', code: 'INVALID_TOKEN' });
    }
    await supabase.from('games').update({ agent_typing: true }).eq('id', gameId);
    return res.status(200).json({ success: true, typing: true });
  }

  if (!validateUUID(gameId)) {
    return res.status(400).json({ error: 'Invalid game ID format', code: 'GAME_NOT_FOUND' });
  }

  if (sender !== 'human' && sender !== 'agent') {
    return res.status(400).json({ error: 'Invalid sender' });
  }

  const supabase = createClient(
    (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Reaction action
  if (action === 'react') {
    const { messageId, emoji } = req.body;
    const reactor = sender; // reactor is 'human' or 'agent'
    
    // Fetch current chat_history from games table
    const { data: gameRow, error: fetchErr } = await supabase
      .from('games')
      .select('chat_history, agent_token')
      .eq('id', gameId)
      .single();
      
    if (fetchErr || !gameRow) return res.status(404).json({ error: 'Game not found' });
      
    if (sender === 'agent' && agentToken !== gameRow.agent_token) {
      return res.status(403).json({ error: 'Forbidden' });
    }
      
    const history = gameRow.chat_history || [];
    
    // Find message by id and toggle reaction
    const updated = history.map(msg => {
      if (msg.id !== messageId && String(msg.timestamp) !== String(messageId)) return msg;
      const reactions = msg.reactions || {};
      const existing = reactions[emoji] || [];
      const alreadyReacted = existing.includes(reactor);
      return {
        ...msg,
        reactions: {
          ...reactions,
          [emoji]: alreadyReacted
            ? existing.filter(r => r !== reactor)
            : [...existing, reactor]
        }
      };
    });
    
    await supabase
      .from('games')
      .update({ chat_history: updated })
      .eq('id', gameId);
      
    return res.status(200).json({ success: true, action: 'react' });
  }

  if (!text) return res.status(400).json({ error: 'Missing text in JSON body', code: 'MISSING_TEXT' });

  const actualReasoning = reasoning || thinking || '';
  const sanitizedText = sanitizeText(text, 500);
  const sanitizedReasoning = sanitizeText(actualReasoning, 300);
  if (!sanitizedText) {
    return res.status(400).json({ error: 'Text is empty after sanitization', code: 'MISSING_TEXT' });
  }

  const gameToken = req.headers['x-game-token'] || token || '';
  
  // Verify game exists
  const { data: game, error } = await supabase.from('games').select('*').eq('id', gameId).single();
  if (error || !game) {
    if (error) {
      console.error('Supabase error in chat.js:', error);
      return res.status(404).json({ error: 'Game not found', details: error.message, code: 'GAME_NOT_FOUND' });
    }
    return res.status(404).json({ error: 'Game not found', code: 'GAME_NOT_FOUND' });
  }

  if (sender === 'human') {
    if (game.status === 'finished') {
      return res.status(403).json({ error: 'Game is finished', code: 'GAME_FINISHED' });
    }
  } else if (sender === 'agent') {
    if (!agentToken || agentToken !== game.agent_token) {
      return res.status(403).json({ error: 'Forbidden: Invalid or missing token for agent.', code: 'INVALID_TOKEN' });
    }
  }

  // Fetch move history from the new table
  const { data: movesData, error: movesError } = await supabase.from('moves').select('*').eq('game_id', gameId).order('move_number', { ascending: true });
  if (!movesError && movesData && movesData.length > 0) {
    game.move_history = movesData.map(m => ({
      ...m,
      from: m.from_square || m.from,
      to: m.to_square || m.to,
      uci: (m.from_square || m.from) + (m.to_square || m.to) + (m.promotion || '')
    }));
  }

  const { data: gameRow } = await supabase
    .from('games')
    .select('chat_history')
    .eq('id', gameId)
    .single();

  const existing = Array.isArray(gameRow?.chat_history) ? gameRow.chat_history : [];
  const newMsg = {
    id: msgId,
    role: sender,
    text: text,
    timestamp: Date.now()
  };

  const newHistory = [...existing, newMsg];
  
  const updates = {
    chat_history: newHistory
  };

  if (sender === 'agent') {
    updates.current_thinking = sanitizedReasoning || '';
    updates.agent_connected = true;
    updates.agent_last_seen = new Date().toISOString();
    if (agentTyping === 'false') {
      updates.agent_typing = false;
    }
  }

  if (sender === 'human') {
    const payload = {
      event: "human_sent_chat",
      game_id: gameId,
      human_message: sanitizedText,
      board: "",
      fen: game.fen || "",
      whose_turn: game.turn === (game.player_color || 'w') ? 'human' : 'agent',
      move_number: Math.floor((game.move_history || []).length / 2) + 1,
      instruction: "Your user messaged you during your chess game. Reply in chat as yourself in 1-2 sentences. Use your 'skill.md' personality. Do not make a chess move unless it is your turn. CRITICAL: DO NOT reply on Telegram/Discord. Stay in an infinite loop and use POST /api/chat for all communication. If there are pending chat messages, you MUST reply to them using the chat API before you submit your chess move."
    };
    
    const enrichedPayload = await notifyAgent(game, payload, supabase);
    updates.pending_events = [...(updates.pending_events || game.pending_events || []), enrichedPayload];
  }

  if (Object.keys(updates).length > 0) {
    await supabase.from('games').update(updates).eq('id', gameId);
  }

  const savedMessage = newMsg;
  const updatedChatHistory = newHistory;
  return res.status(200).json({
    success: true,
    message_id: savedMessage.id,
    message: savedMessage,
    chat_count: updatedChatHistory.length
  });
}
