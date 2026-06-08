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

  if (!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Missing environment variables', code: 'MISSING_ENV_VARS' });
  }

  applySecurityHeaders(res);
  applyCacheControl(res);
  applyCorsHeaders(req, res);

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const rateLimitResult = checkRateLimit(ip, '/api/chat', 20, 60000);
  applyRateLimitHeaders(res, 20, rateLimitResult.remaining, rateLimitResult.resetTime);
  
  if (!rateLimitResult.allowed) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  
  let { id, game_id, gameId: bodyGameId, text: bodyText, message, sender: bodySender, role, token, reasoning, thinking, action, messageId, emoji } = req.body || {};
  let gameId = game_id || bodyGameId || id;
  const msgId = id || messageId || require('crypto').randomUUID();
  let text = bodyText || message;
  let sender = bodySender || role || 'human';
  
  if (!gameId || !validateUUID(gameId)) return res.status(400).json({ error: 'Invalid game ID' });

  const supabase = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const agentToken = req.headers['x-agent-token'] || token || '';

  // Handle Action: react or typing
  if (action === 'react' || action === 'typing') {
    const { data: gameRow, error: fetchErr } = await supabase.from('games').select('agent_token').eq('id', gameId).single();
    if (fetchErr || !gameRow) return res.status(404).json({ error: 'Game not found' });
    if (sender === 'agent' && agentToken !== gameRow.agent_token) return res.status(403).json({ error: 'Forbidden' });

    if (action === 'react') {
      // NEW: Reactions now target a specific row in the 'chats' table
      const { data: chatMsg, error: chatErr } = await supabase.from('chats').select('payload').eq('id', messageId).single();
      if (chatErr || !chatMsg) return res.status(404).json({ error: 'Message not found' });
      
      const payload = chatMsg.payload || {};
      const reactions = payload.reactions || {};
      const existing = reactions[emoji] || [];
      const alreadyReacted = existing.includes(sender);
      
      const updatedReactions = { 
        ...reactions, 
        [emoji]: alreadyReacted ? existing.filter(r => r !== sender) : [...existing, sender] 
      };
      
      await supabase.from('chats').update({ payload: { ...payload, reactions: updatedReactions } }).eq('id', messageId);
      return res.status(200).json({ success: true, action: 'react' });
    }

    if (action === 'typing') {
      const isTyping = req.body.typing === true;
      const updateObj = sender === 'agent' ? { agent_typing: isTyping } : { human_typing: isTyping };
      await supabase.from('games').update(updateObj).eq('id', gameId);
      return res.status(200).json({ success: true, action: 'typing', typing: isTyping });
    }
  }

  // Handle Message Append
  if (!text) return res.status(400).json({ error: 'Missing text' });
  const sanitizedText = sanitizeText(text, 500);
  const sanitizedReasoning = sanitizeText(reasoning || thinking || '', 300);

  const { data: game, error } = await supabase.from('games').select('*').eq('id', gameId).single();
  if (error || !game) return res.status(404).json({ error: 'Game not found' });

  if (sender === 'human' && game.status === 'finished') return res.status(403).json({ error: 'Game is finished' });
  if (sender === 'agent' && agentToken !== game.agent_token) return res.status(403).json({ error: 'Invalid token' });

  // NEW: Insert into 'chats' table instead of RPC to games
  const { error: insertError } = await supabase.from('chats').insert({
    id: msgId,
    game_id: gameId,
    sender: sender,
    message: sanitizedText,
    payload: { reasoning: sanitizedReasoning }
  });

  if (insertError) {
    console.error('Insert Error:', insertError);
    return res.status(500).json({ error: 'Failed to append message' });
  }

  // Still update games for agent status/thinking tracking
  if (sender === 'agent') {
    await supabase.from('games').update({
      current_thinking: sanitizedReasoning,
      agent_typing: false,
      agent_connected: true,
      agent_last_seen: new Date().toISOString()
    }).eq('id', gameId);
  }

  if (sender === 'human') {
    const payload = {
      event: "human_sent_chat",
      game_id: gameId,
      human_message: sanitizedText,
      fen: game.fen || "",
      whose_turn: game.turn === (game.player_color || 'w') ? 'human' : 'agent',
      instruction: `Your user messaged you. Reply in 1-2 sentences in ${game.thought_language || 'english'}.`
    };
    await notifyAgent(game, payload, supabase);
  }

  return res.status(200).json({ success: true, message: { id: msgId, role: sender, text: text, timestamp: Date.now() } });
}
