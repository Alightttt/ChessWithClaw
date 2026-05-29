const { createClient } = require('@supabase/supabase-js');
const { applySecurityHeaders, applyCacheControl, applyCorsHeaders } = require('../server-lib/middleware/headers.js');
const { validateUUID } = require('../server-lib/utils/sanitize.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-agent-token, x-game-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Database configuration missing.' });
  }

  applySecurityHeaders(res);
  applyCacheControl(res);
  applyCorsHeaders(req, res);

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  let { gameId, action, message, setting, value } = req.body || {};

  const agentToken = req.headers['x-agent-token'];
  const gameToken = req.headers['x-game-token'];

  if (!agentToken && !gameToken) {
    return res.status(401).json({ error: 'Unauthorized: Missing token header.', code: 'INVALID_TOKEN' });
  }

  if (!gameId || !action) {
    return res.status(400).json({ error: 'Missing gameId or action' });
  }
  if (!validateUUID(gameId)) {
    return res.status(400).json({ error: 'Invalid gameId format' });
  }

  const validActions = [
    'offer_draw', 'resign', 'accept_draw', 'decline_draw', 'set_thought_language', 'set_board_theme', 'set_piece_style'
  ];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: 'Invalid action', allowed: validActions });
  }

  try {
    const supabase = createClient(
      (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: game, error } = await supabase.from('games').select('*').eq('id', gameId).single();

    if (error || !game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.status === 'finished') {
      return res.status(400).json({ error: 'Game is already over', code: 'GAME_FINISHED' });
    }

    // Determine role and authorize
    let role = '';
    if (agentToken) {
      if (agentToken !== game.agent_token) {
        return res.status(401).json({ "error": "Unauthorized", "code": "INVALID_TOKEN" });
      }
      role = 'agent';
    } else {
      if (gameToken !== game.secret_token) {
        return res.status(401).json({ "error": "Unauthorized", "code": "INVALID_TOKEN" });
      }
      role = 'human';
    }

    const agentName = game.agent_name || 'OpenClaw';
    const now = new Date().toISOString();
    let updates = {};
    let chatText = '';
    let result = undefined;
    let result_reason = '';

    if (action === 'resign') {
      if (role === 'human') {
        updates = { status: 'finished', result: 'black_wins', finished_at: now, result_reason: 'resignation' };
        chatText = message || `You have resigned. ${agentName} wins! 🦞`;
        result = 'black_wins';
      } else {
        updates = { status: 'finished', result: 'white_wins', finished_at: now, result_reason: 'resignation' };
        chatText = message || `${agentName} has resigned. Well played! 🦞`;
        result = 'white_wins';
      }
    } else if (action === 'offer_draw') {
      updates = { draw_offer: role, draw_offer_pending: true };
      chatText = message || (role === 'agent' ? `${agentName} offers a draw. Do you accept? 🤝` : `You offered a draw to ${agentName}.`);
    } else if (action === 'accept_draw') {
      updates = { status: 'finished', result: 'draw', draw_offer: null, draw_offer_pending: false, finished_at: now, result_reason: 'agreement' };
      chatText = message || 'Draw accepted. A worthy match! 🦞';
      result = 'draw';
    } else if (action === 'decline_draw') {
      updates = { draw_offer: null, draw_offer_pending: false };
      chatText = message || (role === 'agent' ? `${agentName} declined the draw offer.` : `You declined the draw offer.`);
    } else if (action === 'set_thought_language') {
      updates.thought_language = value;
      chatText = `[System] Thought language set to ${value} 🦞`;
    } else if (action === 'set_board_theme') {
      updates.board_theme = value;
    } else if (action === 'set_piece_style') {
      updates.piece_style = value;
    }

    if (chatText) {
      let existingChat = Array.isArray(game.chat_history) ? game.chat_history : [];
      const newChatMsg = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
        role: role,
        text: chatText,
        timestamp: Date.now()
      };
      
      if (action === 'offer_draw') {
        newChatMsg.type = 'draw_offer';
      }
      updates.chat_history = [...existingChat, newChatMsg];
    }

    const { error: updateError } = await supabase.from('games').update(updates).eq('id', gameId);
    if (updateError) {
      console.error('Supabase update error:', updateError);
      return res.status(500).json({ error: 'Database update failed', detail: updateError.message });
    }

    return res.status(200).json({ success: true, action, result });
  } catch (err) {
    console.error('Error in action:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
