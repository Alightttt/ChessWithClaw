const { createClient } = require('@supabase/supabase-js');
const { applySecurityHeaders, applyCacheControl, applyCorsHeaders } = require('../server-lib/middleware/headers.js');
const { validateUUID, sanitizeText } = require('../server-lib/utils/sanitize.js');

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

  let { gameId, thought, type } = req.body || {};
  if (!gameId || !thought) {
    return res.status(400).json({ error: 'Missing gameId or thought' });
  }
  if (!validateUUID(gameId)) {
    return res.status(400).json({ error: 'Invalid gameId format' });
  }

  thought = String(thought);
  if (thought.length > 200) thought = thought.substring(0, 200);
  type = type === 'thinking' ? 'thinking' : 'companion';

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: game, error } = await supabase.from('games').select('agent_token, status').eq('id', gameId).single();

    if (error || !game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.agent_token !== agentToken) {
      return res.status(403).json({ error: 'Unauthorized', code: 'INVALID_TOKEN' });
    }

    let updates = {};
    if (type === 'thinking') {
      updates = { current_thinking: thought };
    } else {
      updates = {
        companion_thought: thought,
        companion_thought_at: new Date().toISOString()
      };
    }

    await supabase.from('games').update(updates).eq('id', gameId);

    return res.status(200).json({ success: true, type });
  } catch (err) {
    console.error('Error posting thought:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
