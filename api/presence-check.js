import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders, applyCacheControl } from './_middleware/headers.js';

export default async function handler(req, res) {
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

  res.status(200).json({ success: true });
}
