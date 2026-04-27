const { createClient } = require('@supabase/supabase-js');
const { notifyAgent } = require('../server-lib/notify.js');
const { sanitizeText, validateUUID } = require('../server-lib/utils/sanitize.js');
const { checkRateLimit } = require('../server-lib/utils/rateLimit.js');
const { applySecurityHeaders, applyCacheControl, applyRateLimitHeaders, applyCorsHeaders } = require('../server-lib/middleware/headers.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-agent-token, x-game-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({ 
      error: 'Server configuration error',
      code: 'MISSING_ENV_VARS'
    });
  }

  applySecurityHeaders(res);
  applyCacheControl(res);
  applyCorsHeaders(req, res);

  const { Chess } = await import('chess.js');

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
  
  let { id, game_id, text, type, sender = 'agent', token, reasoning, thinking } = req.body || {};
  let gameId = id || game_id;
  if (!gameId || !text) return res.status(400).json({ error: 'Missing id or text in JSON body', code: 'MISSING_TEXT' });
  gameId = gameId.trim();
  
  if (!validateUUID(gameId)) {
    return res.status(400).json({ error: 'Invalid game ID format', code: 'GAME_NOT_FOUND' });
  }

  if (sender !== 'human' && sender !== 'agent') {
    return res.status(400).json({ error: 'Invalid sender' });
  }

  const actualReasoning = reasoning || thinking || '';
  const sanitizedText = sanitizeText(text, 500);
  const sanitizedReasoning = sanitizeText(actualReasoning, 300);
  if (!sanitizedText) {
    return res.status(400).json({ error: 'Text is empty after sanitization', code: 'MISSING_TEXT' });
  }

  const agentToken = req.headers['x-agent-token'] || token || '';
  const gameToken = req.headers['x-game-token'] || token || '';

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  // Verify game exists
  const { data: game, error } = await supabase.from('games').select('id, webhook_url, webhook_failed, webhook_fail_count, fen, turn, pending_events, agent_connected, secret_token, agent_token, chat_history').eq('id', gameId).single();
  if (error || !game) {
    return res.status(404).json({ error: 'Game not found', code: 'GAME_NOT_FOUND' });
  }

  if (sender === 'human') {
    if (!gameToken || gameToken !== game.secret_token) {
      return res.status(403).json({ error: 'Forbidden: Invalid or missing token for human.', code: 'INVALID_TOKEN' });
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

  const { data: currentGame } = await supabase
    .from('games')
    .select('chat_history')
    .eq('id', gameId)
    .single();

  const history = currentGame?.chat_history || [];
  const newMessage = {
    id: Date.now().toString(),
    sender: sender || 'agent',
    text: sanitizedText,
    timestamp: new Date().toISOString()
  };

  const newHistory = [...history, newMessage];
  
  const updates = {
    chat_history: newHistory
  };

  if (sender === 'agent') {
    updates.current_thinking = sanitizedReasoning || '';
    updates.agent_connected = true;
    updates.agent_last_seen = new Date().toISOString();
  }

  if (sender === 'human') {
    let chess
    try { chess = new Chess(game.fen) }
    catch(e) {
      return res.status(500).json({ error: 'Invalid FEN' })
    }
    
    const payload = {
      event: "human_sent_chat",
      game_id: gameId,
      human_message: sanitizedText,
      board: chess.ascii(),
      fen: game.fen,
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

  res.status(200).json({ 
    success: true, 
    message: 'Chat message sent successfully.' 
  });
}
