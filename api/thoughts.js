const { createClient } = require('@supabase/supabase-js');
const { applySecurityHeaders, applyCacheControl, applyCorsHeaders } = require('../server-lib/middleware/headers.js');
const { validateUUID } = require('../server-lib/utils/sanitize.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-agent-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || !process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).includes('your_supabase') || !(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).startsWith('http')) {
    return res.status(500).json({ error: 'Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in AI Studio settings to create a match.' });
  }

  applySecurityHeaders(res);
  applyCacheControl(res);
  applyCorsHeaders(req, res);

  const supabase = createClient(
    (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // --- POST Request: Agent submits thought directly ---
  if (req.method === 'POST') {
    const agentToken = req.headers['x-agent-token'];
    if (!agentToken) {
      return res.status(403).json({ error: 'Unauthorized', code: 'INVALID_TOKEN' });
    }

    let { gameId, thought, type, id, game_id, text, thinking, reasoning } = req.body || {};
    const finalGameId = gameId || game_id || id;
    let finalThought = thought || text || thinking || reasoning || '';

    if (!finalGameId || !finalThought) {
      return res.status(400).json({ error: 'Missing gameId (or id) or thought (or text)' });
    }
    if (!validateUUID(finalGameId)) {
      return res.status(400).json({ error: 'Invalid gameId format' });
    }

    finalThought = String(finalThought);
    if (finalThought.length > 500) finalThought = finalThought.substring(0, 500);
    type = type === 'thinking' ? 'thinking' : 'companion';

    try {
      const { data: game, error } = await supabase.from('games').select('agent_token, status').eq('id', finalGameId).single();

      if (error || !game) return res.status(404).json({ error: 'Game not found' });
      if (game.agent_token !== agentToken) return res.status(403).json({ error: 'Unauthorized', code: 'INVALID_TOKEN' });

      let updates = {};
      if (type === 'thinking') {
        updates = { current_thinking: finalThought };
      } else {
        updates = {
          companion_thought: finalThought,
          companion_thought_at: new Date().toISOString()
        };
      }

      await supabase.from('games').update(updates).eq('id', finalGameId);

      return res.status(200).json({ success: true, type });
    } catch (err) {
      console.error('Error posting thought:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed. Use POST.' });
};
