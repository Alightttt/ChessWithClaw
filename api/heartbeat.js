const { createClient } = require('@supabase/supabase-js');
const { validateUUID } = require('../server-lib/utils/sanitize.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-game-token, x-agent-token');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id, gameId, role } = req.body || {};
  const gId = id || gameId;

  if (!gId || !validateUUID(gId)) {
    return res.status(400).json({ error: 'Invalid game ID' });
  }

  const supabase = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const updateField = role === 'agent' ? { agent_last_seen: new Date().toISOString(), agent_connected: true } : { human_connected: true };
  
  const { error } = await supabase
    .from('games')
    .update(updateField)
    .eq('id', gId);

  if (error) {
    console.error('Heartbeat Error:', error);
    return res.status(500).json({ error: 'Failed to update heartbeat' });
  }

  return res.status(200).json({ success: true });
};
