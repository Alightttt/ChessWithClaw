const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-agent-token, x-game-token');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const gameId = req.query.gameId;
  const agentToken = req.headers['x-agent-token'];

  if (!gameId) {
    return res.status(400).json({ error: 'Missing gameId parameter' });
  }

  if (!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || !process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).includes('your_supabase') || !(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).startsWith('http')) {
    return res.status(500).json({ error: 'Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in AI Studio settings to create a match.' });
  }

  const supabase = createClient(
    (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: game, error } = await supabase
    .from('games')
    .select('id, agent_token, status, turn')
    .eq('id', gameId)
    .single();

  if (error || !game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  if (game.agent_token !== agentToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (game.status === 'finished' || game.status === 'abandoned') {
    return res.status(200).json({ alive: false, status: game.status });
  }

  const { error: updateError } = await supabase
    .from('games')
    .update({
      agent_last_seen: new Date().toISOString(),
      agent_connected: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', gameId);

  if (updateError) {
    console.error("Error updating heartbeat:", updateError);
    return res.status(500).json({ error: 'Failed to record heartbeat' });
  }

  return res.status(200).json({ alive: true, status: game.status, turn: game.turn });
};
