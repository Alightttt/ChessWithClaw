const { createClient } = require('@supabase/supabase-js');
const { applySecurityHeaders, applyCacheControl } = require('../server-lib/middleware/headers.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-agent-token, x-game-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing env vars: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({ 
      error: 'Server configuration error',
      code: 'MISSING_ENV_VARS'
    });
  }
  applySecurityHeaders(res);
  applyCacheControl(res);

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'undefined') {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // --- Presence Check ---
  // Disconnect agents
  await supabase
    .from('games')
    .update({ agent_connected: false })
    .eq('agent_connected', true)
    .lt('agent_last_seen', thirtySecondsAgo);

  // Disconnect humans
  await supabase
    .from('games')
    .update({ human_connected: false })
    .eq('human_connected', true)
    .lt('human_last_seen', thirtySecondsAgo);

  // --- Expire Games ---
  // Expire waiting games
  await supabase
    .from('games')
    .update({ status: 'abandoned' })
    .eq('status', 'waiting')
    .lt('created_at', twoHoursAgo);

  // Expire active games
  await supabase
    .from('games')
    .update({ status: 'abandoned' })
    .eq('status', 'active')
    .lt('updated_at', twentyFourHoursAgo);

  // Remove Supabase Realtime channels for abandoned/finished games older than 1 hour
  const { data: oldGames } = await supabase
    .from('games')
    .select('id')
    .in('status', ['abandoned', 'finished'])
    .lt('updated_at', oneHourAgo);

  if (oldGames && oldGames.length > 0) {
    for (const game of oldGames) {
      const channel1 = supabase.channel(`game-${game.id}`);
      const channel2 = supabase.channel(`agent-${game.id}`);
      await supabase.removeChannel(channel1);
      await supabase.removeChannel(channel2);
    }
  }

  res.status(200).json({ success: true });
}
