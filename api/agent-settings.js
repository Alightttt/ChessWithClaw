// ALTER TABLE games ADD COLUMN IF NOT EXISTS board_theme TEXT DEFAULT 'green';
// ALTER TABLE games ADD COLUMN IF NOT EXISTS piece_style TEXT DEFAULT 'standard';

const { createClient } = require('@supabase/supabase-js');
const { applySecurityHeaders, applyCacheControl, applyCorsHeaders } = require('../server-lib/middleware/headers.js');
const { validateUUID } = require('../server-lib/utils/sanitize.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-agent-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  applySecurityHeaders(res);
  applyCacheControl(res);
  applyCorsHeaders(req, res);

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  const agentToken = req.headers['x-agent-token'];
  if (!agentToken) {
    return res.status(403).json({ error: 'Unauthorized', code: 'INVALID_TOKEN' });
  }

  const { gameId, setting, value } = req.body || {};
  if (!gameId || !setting || !value) {
    return res.status(400).json({ error: 'Missing gameId, setting, or value' });
  }

  if (!validateUUID(gameId)) {
    return res.status(400).json({ error: 'Invalid gameId format' });
  }

  const allowedBoardThemes = ['green', 'brown', 'slate', 'navy'];
  const allowedPieceStyles = ['standard', 'neo', 'cburnett', 'alpha'];

  if (setting !== 'board_theme' && setting !== 'piece_style') {
    return res.status(400).json({ error: 'Invalid setting', allowed: ['board_theme', 'piece_style'] });
  }

  if (setting === 'board_theme' && !allowedBoardThemes.includes(value)) {
    return res.status(400).json({ error: 'Invalid setting value', allowed: allowedBoardThemes });
  }

  if (setting === 'piece_style' && !allowedPieceStyles.includes(value)) {
    return res.status(400).json({ error: 'Invalid setting value', allowed: allowedPieceStyles });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: game, error } = await supabase.from('games').select('agent_token, agent_name, chat_history').eq('id', gameId).single();

    if (error || !game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.agent_token !== agentToken) {
      return res.status(403).json({ error: 'Unauthorized', code: 'INVALID_TOKEN' });
    }

    const agentName = game.agent_name || 'OpenClaw';
    const updates = {};
    updates[setting] = value;

    let chatText = '';
    if (setting === 'board_theme') {
      chatText = `[${agentName}] changed the board theme to ${value} 🦞`;
    } else if (setting === 'piece_style') {
      chatText = `[${agentName}] changed the pieces to ${value} style 🦞`;
    }

    const existingChat = Array.isArray(game.chat_history) ? game.chat_history : [];
    const newChatMsg = {
      role: 'agent',
      text: chatText,
      timestamp: Date.now()
    };
    updates.chat_history = [...existingChat, newChatMsg];

    await supabase.from('games').update(updates).eq('id', gameId);

    return res.status(200).json({ success: true, setting, value });
  } catch (err) {
    console.error('Error updating agent setting:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
