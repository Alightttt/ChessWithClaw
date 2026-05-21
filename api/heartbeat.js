const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-agent-token, x-game-token');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
  }

  // Support both GET and POST formats
  let gameId = req.query.gameId || req.query.id;
  let role = req.query.role;

  if (req.method === 'POST') {
    const body = req.body || {};
    gameId = body.id || body.gameId || gameId;
    role = body.role || role;
  }

  const agentToken = req.headers['x-agent-token'];
  const gameToken = req.headers['x-game-token'];

  if (!gameId) {
    return res.status(400).json({ error: 'Missing gameId parameter or body field' });
  }

  if (!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Database credentials not configured on the server.' });
  }

  const supabase = createClient(
    (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: game, error } = await supabase
    .from('games')
    .select('id, agent_token, secret_token, status, turn')
    .eq('id', gameId)
    .single();

  if (error || !game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  if (game.status === 'finished' || game.status === 'abandoned') {
    return res.status(200).json({ alive: false, status: game.status });
  }

  // If role is agent or agent token is specified, update agent seen
  const isAgentRequest = role === 'agent' || Boolean(agentToken);
  const updates = { updated_at: new Date().toISOString() };

  if (isAgentRequest) {
    // If agentToken is provided, it must match
    if (agentToken && game.agent_token !== agentToken) {
      return res.status(401).json({ error: 'Unauthorized: Invalid agent token' });
    }
    updates.agent_last_seen = new Date().toISOString();
    updates.agent_connected = true;
  } else {
    // Human requests
    if (gameToken && game.secret_token !== gameToken) {
      return res.status(401).json({ error: 'Unauthorized: Invalid game token' });
    }
    updates.player_last_seen = new Date().toISOString();
    updates.player_connected = true;
  }

  const { error: updateError } = await supabase
    .from('games')
    .update(updates)
    .eq('id', gameId);

  if (updateError) {
    console.error("Error updating heartbeat:", updateError);
    return res.status(500).json({ error: 'Failed to record heartbeat' });
  }

  return res.status(200).json({ 
    success: true, 
    alive: true, 
    status: game.status, 
    turn: game.turn, 
    role: isAgentRequest ? 'agent' : 'human' 
  });
};
