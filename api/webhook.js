const { createClient } = require('@supabase/supabase-js');
const { notifyAgent } = require('./notify.js');
const { sanitizeText, validateUUID } = require('./_utils/sanitize.js');
const { validateWebhookURL } = require('./_utils/validateWebhook.js');
const { checkRateLimit } = require('./_utils/rateLimit.js');
const { applySecurityHeaders, applyCacheControl, applyRateLimitHeaders, applyCorsHeaders } = require('./_middleware/headers.js');

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

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > 10240) {
    return res.status(413).json({ error: 'Payload too large' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const rateLimitResult = checkRateLimit(ip, '/api/webhook', 5, 60000);
  applyRateLimitHeaders(res, 5, rateLimitResult.remaining, rateLimitResult.resetTime);
  
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000));
    return res.status(429).json({ error: 'Too many requests', retry_after: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000) });
  }
  
  let { id, webhook_url, agent_name, agent_avatar, agent_tagline, token } = req.body || {};
  if (!id || !webhook_url) return res.status(400).json({ error: 'Missing id or webhook_url in JSON body' });
  id = id.trim();

  if (!validateUUID(id)) {
    return res.status(400).json({ error: 'Invalid game ID format' });
  }

  const isValidWebhook = await validateWebhookURL(webhook_url);
  if (!isValidWebhook) {
    return res.status(400).json({ error: 'Invalid webhook URL' });
  }

  const agentToken = req.headers['x-agent-token'] || token || '';

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  // Verify game exists
  const { data: game, error } = await supabase.from('games').select('id, fen, turn, status, pending_events, agent_token, chat_history').eq('id', id).single();
  if (error || !game) {
    return res.status(404).json({ error: 'Game not found', code: 'GAME_NOT_FOUND' });
  }

  if (!agentToken || agentToken !== game.agent_token) {
    return res.status(403).json({ error: 'Forbidden: Invalid or missing token.', code: 'INVALID_AGENT_TOKEN' });
  }

  // Fetch move history from the new table
  const { data: movesData } = await supabase.from('moves').select('*').eq('game_id', id).order('move_number', { ascending: true });
  game.move_history = (movesData || []).map(m => ({
    ...m,
    from: m.from_square || m.from,
    to: m.to_square || m.to,
    uci: (m.from_square || m.from) + (m.to_square || m.to) + (m.promotion || '')
  }));

  const payload = {
    event: 'agent_connected',
    game_id: id,
    status: game.status,
    fen: game.fen,
    current_turn: game.turn === 'w' ? 'WHITE' : 'BLACK',
    move_count: (game.move_history || []).length,
    chat_count: (game.chat_history || []).length,
    message: 'Webhook registered successfully. You are now connected.'
  };

  const updates = { 
    webhook_url: webhook_url,
    agent_connected: true,
    agent_last_seen: new Date().toISOString(),
    webhook_fail_count: 0,
    webhook_failed: false
  };

  if (agent_name) updates.agent_name = sanitizeText(agent_name, 50);
  if (agent_tagline) updates.agent_tagline = sanitizeText(agent_tagline, 100);
  if (agent_avatar) {
    const sanitizedAvatar = Array.from(agent_avatar)[0] || '🦞';
    updates.agent_avatar = sanitizedAvatar.slice(0, 2);
  }

  let newPendingEvents = [...(game.pending_events || [])];
  
  const gameWithNewWebhook = { ...game, webhook_url: webhook_url, webhook_failed: false, webhook_fail_count: 0 };
  
  const enrichedPayload = await notifyAgent(gameWithNewWebhook, payload, supabase);
  newPendingEvents.push(enrichedPayload);

  if (!game.agent_connected) {
    const gameStartedPayload = {
      event: "game_started",
      game_id: id,
      instruction: "The game has started. Send a short, friendly greeting in chat to your opponent. Be yourself."
    };
    const enrichedGameStartedPayload = await notifyAgent(gameWithNewWebhook, gameStartedPayload, supabase);
    newPendingEvents.push(enrichedGameStartedPayload);
  }

  updates.pending_events = newPendingEvents;

  // Update webhook URL and mark agent as connected
  await supabase.from('games').update(updates).eq('id', id);

  res.status(200).json({ 
    success: true, 
    message: 'Webhook registered successfully. We will POST to this URL when it is your turn.',
    game_state: payload
  });
}
