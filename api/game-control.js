const { createClient } = require('@supabase/supabase-js');
const { applySecurityHeaders, applyCacheControl, applyCorsHeaders } = require('../server-lib/middleware/headers.js');
const { validateUUID, sanitizeText } = require('../server-lib/utils/sanitize.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-agent-token, x-game-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  applySecurityHeaders(res);
  applyCacheControl(res);
  applyCorsHeaders(req, res);

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  let { gameId, action, message } = req.body || {};
  if (!gameId || !action) {
    return res.status(400).json({ error: 'Missing gameId or action' });
  }
  if (!validateUUID(gameId)) {
    return res.status(400).json({ error: 'Invalid gameId format' });
  }

  const validActions = ['offer_draw', 'resign', 'accept_draw', 'decline_draw'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  const agentToken = req.headers['x-agent-token'];

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: game, error } = await supabase.from('games').select('*').eq('id', gameId).single();

    if (error || !game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.status === 'finished') {
      return res.status(400).json({ error: 'Game is already over', code: 'GAME_FINISHED' });
    }

    if (['offer_draw', 'resign'].includes(action) && agentToken !== game.agent_token) {
      return res.status(403).json({ error: 'Unauthorized', code: 'INVALID_TOKEN' });
    }

    const agentName = game.agent_name || 'OpenClaw';
    const now = new Date().toISOString();
    let updates = {};
    let chatText = '';
    let result = undefined;

    if (action === 'resign') {
      updates = { status: 'finished', result: 'white_wins', finished_at: now, result_reason: 'resignation' };
      chatText = message || `${agentName} has resigned. Well played! 🦞`;
      result = 'white_wins';
    } else if (action === 'offer_draw') {
      updates = { draw_offer: 'agent', draw_offer_pending: true };
      chatText = message || `${agentName} offers a draw. Do you accept? 🤝`;
    } else if (action === 'accept_draw') {
      updates = { status: 'finished', result: 'draw', draw_offer: null, draw_offer_pending: false, finished_at: now, result_reason: 'agreement' };
      chatText = message || 'Draw accepted. A worthy match! 🦞';
      result = 'draw';
    } else if (action === 'decline_draw') {
      updates = { draw_offer: null, draw_offer_pending: false };
      chatText = message || 'Draw declined. The battle continues!';
    }

    const { data: gameRow } = await supabase.from('games').select('chat_history').eq('id', gameId).single();
    const existingChat = Array.isArray(gameRow?.chat_history) ? gameRow.chat_history : [];
    
    // To match what front-end does for accept_draw, we add it with a special message type if needed, but since it's just chat:
    const newChatMsg = {
      role: 'agent',
      text: chatText,
      timestamp: Date.now()
    };
    
    if (action === 'offer_draw') {
        newChatMsg.type = 'draw_offer';
    }
    // if action === sign, type = resign_request ? 
    // Wait, the client side in Game.jsx had:
    // `if (msg.type === 'resign_request') { ... }`
    // `if (msg.type === 'draw_offer') { ... }`
    
    updates.chat_history = [...existingChat, newChatMsg];

    await supabase.from('games').update(updates).eq('id', gameId);

    return res.status(200).json({ success: true, action, result });
  } catch (err) {
    console.error('Error in game control:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
