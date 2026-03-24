import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders, applyCacheControl } from './_middleware/headers.js';

export default async function handler(req, res) {
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
